import React, { useState, useEffect, useCallback } from "react";
import {
  UtensilsCrossed,
  Calendar,
  CheckCircle2,
  Circle,
  Loader2,
  AlertTriangle,
  Ban,
  ChevronRight,
} from "lucide-react";
import { useDemoAuth } from "@/context/DemoAuthContext";
import {
  MEAL_ORDER,
  MEAL_LABELS,
  MEAL_EMOJIS,
  type MealKey,
  todayStr,
} from "@/lib/hostelService";
import {
  bookMeal,
  cancelBooking,
  getMenuForDate,
  getBookingsForStudent,
  isBookingAllowed,
  bookableDates,
  type MealBooking,
} from "@/lib/mealBooking";
import { type WithId } from "@/lib/firestore";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function dayLabel(dateStr: string): string {
  const t = todayStr();
  if (dateStr === t) return "Today";
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (dateStr === tomorrow.toISOString().split("T")[0]) return "Tomorrow";
  return new Date(dateStr).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function tomorrowStr(): string {
  const t = new Date();
  t.setDate(t.getDate() + 1);
  return t.toISOString().split("T")[0];
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const MealBookingPanel: React.FC = () => {
  const { user } = useDemoAuth();
  const hostel = user?.hostel || "APJ Abdul Kalam Boys Hostel (BH-1)";

  const [selectedDate, setSelectedDate] = useState(tomorrowStr());
  const [menu, setMenu] = useState<WithId<any> | null>(null);
  const [bookings, setBookings] = useState<WithId<MealBooking>[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState<MealKey | null>(null);

  // Per-meal selection state: which radio is selected
  const [selections, setSelections] = useState<Record<MealKey, string>>({
    breakfast: "",
    lunch: "",
    snacks: "",
    dinner: "",
  });

  // Per-meal deadline status
  const [deadlines, setDeadlines] = useState<Record<MealKey, { allowed: boolean; reason?: string }>>({
    breakfast: { allowed: false },
    lunch: { allowed: false },
    snacks: { allowed: false },
    dinner: { allowed: false },
  });

  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [menuData, bookingData] = await Promise.all([
        getMenuForDate(selectedDate, hostel),
        user?.studentId ? getBookingsForStudent(user.studentId, selectedDate) : Promise.resolve([]),
      ]);
      setMenu(menuData);
      setBookings(bookingData);

      // Pre-fill selections from existing bookings
      const prefill: Record<MealKey, string> = { breakfast: "", lunch: "", snacks: "", dinner: "" };
      bookingData.forEach((b) => {
        prefill[b.mealType as MealKey] = b.selectedMenuItem;
      });
      setSelections(prefill);

      // Check deadlines for each meal
      const dl: Record<MealKey, { allowed: boolean; reason?: string }> = {
        breakfast: { allowed: false },
        lunch: { allowed: false },
        snacks: { allowed: false },
        dinner: { allowed: false },
      };
      for (const meal of MEAL_ORDER) {
        dl[meal] = await isBookingAllowed(selectedDate, meal);
      }
      setDeadlines(dl);
    } finally {
      setLoading(false);
    }
  }, [selectedDate, hostel, user?.studentId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleBook = async (meal: MealKey) => {
    const item = selections[meal];
    if (!item || !user?.studentId) return;
    setSubmitting(meal);
    setMsg(null);
    try {
      const res = await bookMeal({
        studentId: user.studentId,
        studentName: user.name || "Student",
        hostel,
        room: user.room || "",
        mealDate: selectedDate,
        mealType: meal,
        selectedMenuItem: item,
      });
      if (res.ok) {
        setMsg({ ok: true, text: `${MEAL_LABELS[meal]} booked: ${item}` });
        await loadData();
      } else {
        setMsg({ ok: false, text: res.error || "Booking failed." });
      }
    } finally {
      setSubmitting(null);
    }
  };

  const handleCancel = async (booking: WithId<MealBooking>) => {
    setSubmitting(booking.mealType as MealKey);
    setMsg(null);
    try {
      const res = await cancelBooking(booking.id);
      if (res.ok) {
        setMsg({ ok: true, text: `${MEAL_LABELS[booking.mealType as MealKey]} booking cancelled.` });
        await loadData();
      } else {
        setMsg({ ok: false, text: res.error || "Cancel failed." });
      }
    } finally {
      setSubmitting(null);
    }
  };

  const dates = bookableDates(7);

  // Helper: get existing booking for a meal
  const existingBooking = (meal: MealKey) =>
    bookings.find((b) => b.mealType === meal && b.bookingStatus === "BOOKED");

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-md dark:border-slate-800 dark:bg-slate-900">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-slate-100 pb-4 dark:border-slate-800 mb-4">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
          <UtensilsCrossed className="h-6 w-6" />
        </div>
        <div>
          <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
            Meal Booking
          </h3>
          <p className="text-[11px] text-slate-500">
            Select your preferred menu item for each meal — book 24 hours in advance
          </p>
        </div>
      </div>

      {/* Date selector */}
      <div className="mb-5">
        <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-500">
          <Calendar className="mr-1 inline h-3.5 w-3.5" /> Select Date
        </p>
        <div className="flex flex-wrap gap-2">
          {dates.map((d) => (
            <button
              key={d}
              onClick={() => setSelectedDate(d)}
              className={`rounded-lg px-3 py-1.5 text-[11px] font-bold transition-colors ${
                selectedDate === d
                  ? "bg-indigo-600 text-white shadow-md"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
              }`}
            >
              {dayLabel(d)}
            </button>
          ))}
        </div>
      </div>

      {/* Messages */}
      {msg && (
        <div
          className={`mb-4 rounded-xl border px-4 py-3 text-xs font-bold ${
            msg.ok
              ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
              : "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
          }`}
        >
          {msg.text}
        </div>
      )}

      {/* Loading */}
      {loading ? (
        <div className="flex items-center justify-center py-10">
          <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
          <span className="ml-2 text-xs text-slate-500">Loading menu...</span>
        </div>
      ) : !menu ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-center dark:border-amber-900 dark:bg-amber-950/30">
          <AlertTriangle className="mx-auto mb-2 h-8 w-8 text-amber-500" />
          <p className="text-xs font-bold text-amber-800 dark:text-amber-300">
            No menu published for {dayLabel(selectedDate)}.
          </p>
          <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-1">
            The Mess Administrator has not published the menu for this date yet. Please check back later.
          </p>
        </div>
      ) : (
        /* Meal cards */
        <div className="space-y-4">
          {MEAL_ORDER.map((meal) => {
            const items: string[] = menu[meal] || [];
            const booked = existingBooking(meal);
            const dl = deadlines[meal];
            const isSubmittingMeal = submitting === meal;

            return (
              <div
                key={meal}
                className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/60"
              >
                {/* Meal header */}
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                    <span>{MEAL_EMOJIS[meal]}</span> {MEAL_LABELS[meal]}
                    {booked && (
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                        BOOKED
                      </span>
                    )}
                  </p>
                  {!dl.allowed && (
                    <span className="text-[10px] font-bold text-red-500 flex items-center gap-1">
                      <Ban className="h-3 w-3" /> Deadline passed
                    </span>
                  )}
                </div>

                {/* No items */}
                {items.length === 0 ? (
                  <p className="text-[11px] text-slate-400">No items published for this meal.</p>
                ) : (
                  <>
                    {/* Radio items */}
                    <div className="space-y-1.5">
                      {items.map((item) => {
                        const isSelected = selections[meal] === item;
                        const isBookedItem = booked?.selectedMenuItem === item;
                        return (
                          <label
                            key={item}
                            className={`flex items-center gap-3 rounded-lg px-3 py-2 text-xs font-semibold transition-colors cursor-pointer ${
                              isSelected
                                ? "bg-indigo-100 text-indigo-900 border border-indigo-300 dark:bg-indigo-950/60 dark:text-indigo-200 dark:border-indigo-800"
                                : "bg-white text-slate-700 border border-transparent hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                            }`}
                          >
                            <span className="shrink-0">
                              {isSelected ? (
                                <CheckCircle2 className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                              ) : (
                                <Circle className="h-4 w-4 text-slate-300 dark:text-slate-600" />
                              )}
                            </span>
                            <input
                              type="radio"
                              name={`meal-${meal}`}
                              value={item}
                              checked={isSelected}
                              disabled={!dl.allowed}
                              onChange={() =>
                                setSelections((prev) => ({ ...prev, [meal]: item }))
                              }
                              className="sr-only"
                            />
                            <span className="flex-1">{item}</span>
                            {isBookedItem && !isSelected && (
                              <span className="text-[10px] text-emerald-600 dark:text-emerald-400">current</span>
                            )}
                          </label>
                        );
                      })}
                    </div>

                    {/* Actions */}
                    <div className="mt-3 flex items-center gap-2">
                      {booked ? (
                        <>
                          <button
                            onClick={() => handleBook(meal)}
                            disabled={!dl.allowed || !selections[meal] || selections[meal] === booked.selectedMenuItem || isSubmittingMeal}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-indigo-700 disabled:opacity-50"
                          >
                            {isSubmittingMeal ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <ChevronRight className="h-3.5 w-3.5" />
                            )}
                            {selections[meal] === booked.selectedMenuItem
                              ? "Selected"
                              : "Change Selection"}
                          </button>
                          <button
                            onClick={() => handleCancel(booked)}
                            disabled={isSubmittingMeal}
                            className="inline-flex items-center gap-1 rounded-lg bg-red-50 px-3 py-1.5 text-[11px] font-bold text-red-600 hover:bg-red-100 dark:bg-red-950/40 dark:text-red-400"
                          >
                            Cancel Booking
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => handleBook(meal)}
                          disabled={!dl.allowed || !selections[meal] || isSubmittingMeal}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-1.5 text-[11px] font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
                        >
                          {isSubmittingMeal ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <CheckCircle2 className="h-3.5 w-3.5" />
                          )}
                          Confirm {MEAL_LABELS[meal]} Booking
                        </button>
                      )}
                    </div>

                    {/* Deadline info */}
                    {!dl.allowed && dl.reason && (
                      <p className="mt-2 text-[10px] text-red-500">{dl.reason}</p>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
