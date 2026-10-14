// Meal Booking Service
//
// Handles student advance meal bookings with menu-item selection:
//  - Book a specific menu item for a meal on a given date
//  - Enforce 24-hour advance booking deadline
//  - Prevent changes after the deadline
//  - Validate selected item exists in the published menu
//  - Item-wise analytics for mess admin dashboards

import {
  createRecord,
  filterCollection,
  updateRecord,
  type WithId,
} from "@/lib/firestore";
import {
  type MealKey,
  MEAL_LABELS,
  ensureMealConfig,
  todayStr,
} from "@/lib/hostelService";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MealBooking {
  id: string;
  studentId: string;
  studentName: string;
  hostel: string;
  room: string;
  mealDate: string;       // "YYYY-MM-DD"
  mealType: MealKey;
  selectedMenuItem: string;
  bookingStatus: "BOOKED" | "CANCELLED";
  attendanceStatus: "PENDING" | "PRESENT";
  bookedAt: string;       // ISO timestamp
}

export interface MenuItemCount {
  item: string;
  count: number;
}

export interface MealBookingSummary {
  meal: MealKey;
  total: number;
  items: MenuItemCount[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Number of hours before a meal's start time that a booking is still allowed. */
const BOOKING_DEADLINE_HOURS = 24;

/** Returns the meal's start time on the given date as a Date object. */
function mealStartTime(mealDate: string, mealTiming: { start: string }): Date {
  const [h, m] = mealTiming.start.split(":").map(Number);
  const dt = new Date(mealDate);
  dt.setHours(h, m, 0, 0);
  return dt;
}

/**
 * Check whether a booking is still allowed for this meal+date.
 * Allowed if current time is at least BOOKING_DEADLINE_HOURS before the meal starts.
 */
export async function isBookingAllowed(
  mealDate: string,
  mealType: MealKey
): Promise<{ allowed: boolean; reason?: string }> {
  const config = await ensureMealConfig();
  const timing = config[mealType];
  if (!timing) return { allowed: false, reason: `Unknown meal type: ${mealType}` };

  const mealStart = mealStartTime(mealDate, timing);
  const deadline = new Date(mealStart.getTime() - BOOKING_DEADLINE_HOURS * 3600 * 1000);
  const now = new Date();

  if (now >= deadline) {
    return {
      allowed: false,
      reason: `Booking deadline has passed. The ${MEAL_LABELS[mealType]} booking for ${mealDate} closed at ${deadline.toLocaleString()}.`,
    };
  }
  return { allowed: true };
}

/** Fetch the menu document for a given date+hostel. */
export async function getMenuForDate(
  mealDate: string,
  hostel: string
): Promise<WithId<any> | null> {
  const menus = await filterCollection("Menu", (m: any) =>
    m.date === mealDate && m.hostel === hostel
  );
  return menus[0] || null;
}

/** Fetch existing bookings for a student on a given date. */
export async function getBookingsForStudent(
  studentId: string,
  mealDate: string
): Promise<WithId<MealBooking>[]> {
  return filterCollection("MealBooking", (b: any) =>
    b.studentId === studentId &&
    b.mealDate === mealDate &&
    b.bookingStatus === "BOOKED"
  );
}

/** Fetch all active (BOOKED) bookings for a date+hostel. */
export async function getBookingsForDate(
  mealDate: string,
  hostel: string
): Promise<WithId<MealBooking>[]> {
  return filterCollection("MealBooking", (b: any) =>
    b.mealDate === mealDate &&
    b.hostel === hostel &&
    b.bookingStatus === "BOOKED"
  );
}

/**
 * Create or update a meal booking.
 * Validates: deadline, menu item exists, no duplicate.
 * Returns the created/updated booking or an error.
 */
export async function bookMeal(opts: {
  studentId: string;
  studentName: string;
  hostel: string;
  room: string;
  mealDate: string;
  mealType: MealKey;
  selectedMenuItem: string;
}): Promise<{ ok: boolean; booking?: WithId<MealBooking>; error?: string }> {
  const { studentId, studentName, hostel, room, mealDate, mealType, selectedMenuItem } = opts;

  // 1. Check deadline
  const deadline = await isBookingAllowed(mealDate, mealType);
  if (!deadline.allowed) return { ok: false, error: deadline.reason };

  // 2. Validate menu item exists
  const menu = await getMenuForDate(mealDate, hostel);
  if (!menu) return { ok: false, error: `No menu published for ${hostel} on ${mealDate}.` };

  const mealItems: string[] = menu[mealType] || [];
  const itemExists = mealItems.some(
    (item) => item.toLowerCase().trim() === selectedMenuItem.toLowerCase().trim()
  );
  if (!itemExists) {
    return {
      ok: false,
      error: `"${selectedMenuItem}" is not available for ${MEAL_LABELS[mealType]} on ${mealDate}. Available: ${mealItems.join(", ")}`,
    };
  }

  // 3. Check for existing booking — update if present, create if not
  const existing = await getBookingsForStudent(studentId, mealDate);
  const existingForMeal = existing.find((b) => b.mealType === mealType);

  const now = new Date().toISOString();

  if (existingForMeal) {
    // Update the selected item
    await updateRecord("MealBooking", existingForMeal.id, {
      selectedMenuItem,
      bookedAt: now,
    });
    return {
      ok: true,
      booking: { ...existingForMeal, selectedMenuItem, bookedAt: now } as WithId<MealBooking>,
    };
  }

  // Create new booking
  const booking = await createRecord("MealBooking", {
    studentId,
    studentName,
    hostel,
    room,
    mealDate,
    mealType,
    selectedMenuItem,
    bookingStatus: "BOOKED",
    attendanceStatus: "PENDING",
    bookedAt: now,
  });

  return { ok: true, booking };
}

/**
 * Cancel a student's booking for a specific meal on a date.
 */
export async function cancelBooking(
  bookingId: string
): Promise<{ ok: boolean; error?: string }> {
  const booking = await filterCollection("MealBooking", (b: any) => b.id === bookingId);
  if (booking.length === 0) return { ok: false, error: "Booking not found." };
  if (booking[0].bookingStatus !== "BOOKED") return { ok: false, error: "Booking already cancelled." };

  await updateRecord("MealBooking", bookingId, {
    bookingStatus: "CANCELLED",
  });
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Analytics
// ---------------------------------------------------------------------------

/**
 * Compute item-wise student counts for a given meal on a date.
 * Used by mess admin dashboards to determine food quantity.
 */
export async function getBookingAnalytics(
  mealDate: string,
  hostel: string,
  mealType: MealKey
): Promise<MealBookingSummary> {
  const bookings = await getBookingsForDate(mealDate, hostel);
  const mealBookings = bookings.filter((b) => b.mealType === mealType);

  const countMap: Record<string, number> = {};
  mealBookings.forEach((b) => {
    const key = b.selectedMenuItem.trim();
    countMap[key] = (countMap[key] || 0) + 1;
  });

  const items: MenuItemCount[] = Object.entries(countMap)
    .map(([item, count]) => ({ item, count }))
    .sort((a, b) => b.count - a.count);

  return { meal: mealType, total: mealBookings.length, items };
}

/**
 * Get full-day analytics across all meals.
 */
export async function getFullDayAnalytics(
  mealDate: string,
  hostel: string
): Promise<MealBookingSummary[]> {
  const meals: MealKey[] = ["breakfast", "lunch", "snacks", "dinner"];
  return Promise.all(meals.map((m) => getBookingAnalytics(mealDate, hostel, m)));
}

/**
 * Compute how many days ahead of today a meal date is.
 * Returns 0 for today, 1 for tomorrow, etc.
 */
export function daysAhead(mealDate: string): number {
  const today = new Date(todayStr());
  const target = new Date(mealDate);
  return Math.round((target.getTime() - today.getTime()) / 86400000);
}

/**
 * Generate the list of bookable dates (today through today+6).
 * The 24-hour rule determines which ones are actually open.
 */
export function bookableDates(count = 7): string[] {
  const dates: string[] = [];
  const base = new Date(todayStr());
  for (let i = 0; i < count; i++) {
    const d = new Date(base);
    d.setDate(base.getDate() + i);
    dates.push(d.toISOString().split("T")[0]);
  }
  return dates;
}
