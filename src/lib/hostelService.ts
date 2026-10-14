// Central Integrated Hostel Service.
//
// Single source of truth for cross-dashboard, realtime workflows:
//  - Mess QR attendance (wallet QR -> MessAttendance -> every dashboard)
//  - Meal session detection & configurable timings (Settings collection)
//  - Shared aggregation helpers (student / parent / mess / warden / admin)
//  - Cross-cut notification + activity logging
//
// All dashboards read/write the SAME collections (MessAttendance, GatePass,
// Leave, Maintenance, Cleaning, NightRollCallRecords, ...). There are no
// per-dashboard duplicate tables.

import {
  createRecord,
  filterCollection,
  updateRecord,
  type WithId,
} from "@/lib/firestore";

// ---------------------------------------------------------------------------
// Meals & meal-session config
// ---------------------------------------------------------------------------

export type MealKey = "breakfast" | "lunch" | "snacks" | "dinner";

export const MEAL_ORDER: MealKey[] = ["breakfast", "lunch", "snacks", "dinner"];

export const MEAL_LABELS: Record<MealKey, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  snacks: "Snacks",
  dinner: "Dinner",
};

export const MEAL_EMOJIS: Record<MealKey, string> = {
  breakfast: "🍞",
  lunch: "🍛",
  snacks: "🍵",
  dinner: "🍽️",
};

export interface MealTiming {
  start: string; // "07:30" (24h)
  end: string; // "09:00"
}

export type MealConfig = Record<MealKey, MealTiming>;

export const DEFAULT_MEAL_CONFIG: MealConfig = {
  breakfast: { start: "07:30", end: "09:00" },
  lunch: { start: "12:30", end: "14:00" },
  snacks: { start: "16:30", end: "17:30" },
  dinner: { start: "19:30", end: "21:00" },
};

export const MEAL_CONFIG_KEY = "meal_config";

// ---------------------------------------------------------------------------
// Time helpers (clock-based, same convention as NightRollCall)
// ---------------------------------------------------------------------------

export function todayStr(d: Date = new Date()): string {
  // Use the LOCAL calendar date so it stays consistent with the local-clock
  // window comparisons used elsewhere in the app (getActiveMeal, meal booking).
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

export function nowHhmm(d: Date = new Date()): string {
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

export function hoursToMinutes(hhmm: string): number {
  const [h, m] = String(hhmm || "00:00").split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

export function fmtTime(d: Date = new Date()): string {
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function fmtHm(hhmm: string): string {
  const mins = hoursToMinutes(hhmm);
  const h = Math.floor(mins / 60) % 24;
  const m = mins % 60;
  const ampm = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${String(hour12).padStart(2, "0")}:${String(m).padStart(2, "0")} ${ampm}`;
}

export interface ActiveMeal {
  meal: MealKey;
  timing: MealTiming;
}

/** Which meal session is currently active, if any. */
export function getActiveMeal(config: MealConfig, now: Date = new Date()): ActiveMeal | null {
  const cur = hoursToMinutes(nowHhmm(now));
  for (const meal of MEAL_ORDER) {
    const t = config[meal];
    const start = hoursToMinutes(t.start);
    const end = hoursToMinutes(t.end);
    if (cur >= start && cur <= end) return { meal, timing: t };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Meal config persistence (Settings collection - editable by Mess Staff/Admin)
// ---------------------------------------------------------------------------

export async function ensureMealConfig(): Promise<MealConfig> {
  const res = await filterCollection("Settings", { key: MEAL_CONFIG_KEY });
  if (res.length > 0) {
    const row = res[0];
    const cfg: MealConfig = JSON.parse(JSON.stringify(DEFAULT_MEAL_CONFIG));
    for (const meal of MEAL_ORDER) {
      const t = row[meal];
      if (t && typeof t.start === "string" && typeof t.end === "string") {
        cfg[meal] = { start: t.start, end: t.end };
      }
    }
    return cfg;
  }
  return { ...DEFAULT_MEAL_CONFIG };
}

export async function saveMealConfig(config: MealConfig): Promise<void> {
  const res = await filterCollection("Settings", { key: MEAL_CONFIG_KEY });
  const payload = {
    ...config,
    key: MEAL_CONFIG_KEY,
    category: "mess",
    updated_at: new Date().toISOString(),
  };
  if (res.length > 0) {
    await updateRecord("Settings", res[0].id, payload);
  } else {
    await createRecord("Settings", payload);
  }
}

// ---------------------------------------------------------------------------
// Mess QR checkpoints
//
// The QR pinned on the mess hall wall identifies the LOCATION + HOSTEL +
// checkpoint - NOT the student. Who is attending is decided entirely by the
// authenticated student account (or the linked student for read-only parents).
// ---------------------------------------------------------------------------

export interface MessPoint {
  id: string;
  code: string; // e.g. "RGMCET-KRISHNA-MESS-01" (stable location id)
  name: string; // "Krishna Mess Hall"
  hostel: string; // linked hostel
  hall: string;
  active: boolean;
  currentCycleCode?: string; // rotating public code the students scan
  cycleExpiresAt?: string; // ISO timestamp — after this the QR is invalid until regenerated
  cycleActive?: boolean; // whether the current cycle code may be scanned
  rotationDays?: number; // how long a cycle lasts before needing regeneration (default 3)
}

export const MESS_QR_PATTERN = /^RGMCET-[A-Z0-9]+-MESS-[A-Z0-9]{4,6}$/i;

/** Days a generated mess QR stays valid before requiring regeneration. */
export const MESS_QR_ROTATION_DAYS = 3;

/** Generate a fresh random cycle code for a mess point, valid for ~3 days. */
export function generateMessCycleCode(point: { code: string; name?: string }): string {
  const rand = Math.random().toString(36).toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
  return `RGMCET-${(point.name || point.code)
    .replace(/[^A-Z0-9]/gi, "")
    .slice(0, 12)
    .toUpperCase()}-MESS-${rand || "A1B2C3"}`;
}

/** Build the QR payload text shown on the wall / in the manager dashboard. */
export function messCyclePayload(point: WithId<MessPoint>): string {
  return point.currentCycleCode || point.code;
}

/** Compute the next cycle expiry (now + rotationDays). */
export function messCycleExpiry(point: WithId<MessPoint>, from: Date = new Date()): Date {
  const days = point.rotationDays || MESS_QR_ROTATION_DAYS;
  const d = new Date(from);
  d.setDate(d.getDate() + days);
  return d;
}

/** Look up a registered Mess checkpoint by its QR payload (rotating cycle code). */
export async function findMessPoint(qrPayload: string): Promise<WithId<MessPoint> | null> {
  const qr = String(qrPayload || "").trim();
  if (!qr) return null;
  const res = await filterCollection("MessPoint", (p: any) =>
    p.active !== false && (p.currentCycleCode === qr || p.code === qr)
  );
  return res[0] || null;
}

/** Look up the mess point belonging to a hostel (for the manager dashboard). */
export async function getMessPointForHostel(hostel: string): Promise<WithId<MessPoint> | null> {
  if (!hostel) return null;
  const res = await filterCollection("MessPoint", (p: any) => p.hostel === hostel);
  return res[0] || null;
}

/**
 * Regenerate a mess point's public QR code (used by the Mess Manager).
 * Issues a brand-new cycle code valid for ~3 days and records an activity log
 * so the rotation is auditable.
 */
export async function regenerateMessQr(
  point: WithId<MessPoint>,
  actorName = "Mess Manager"
): Promise<WithId<MessPoint>> {
  const now = new Date();
  const currentCycleCode = generateMessCycleCode(point);
  const cycleExpiresAt = messCycleExpiry(point, now).toISOString();
  const updated = await updateRecord<MessPoint>("MessPoint", point.id, {
    currentCycleCode,
    cycleExpiresAt,
    cycleActive: true,
  });
  await createRecord("ActivityLog", {
    user: actorName,
    role: "mess_manager",
    action: `Rotated Mess QR code for ${point.name} (${point.hostel}). New code valid until ${new Date(
      cycleExpiresAt
    ).toLocaleDateString()}.`,
    module: "Mess",
    record: point.id,
    timestamp: now.toISOString(),
  });
  return updated;
}

/** Whether a mess point's current cycle QR is still valid (not expired/inactive). */
export function isMessCycleValid(point: WithId<MessPoint>, now: Date = new Date()): boolean {
  if (!point.cycleActive) return false;
  if (!point.cycleExpiresAt) return true; // legacy points without rotation are always valid
  const expiresAt = new Date(point.cycleExpiresAt).getTime();
  if (isNaN(expiresAt)) return true;
  return now.getTime() < expiresAt;
}

// ---------------------------------------------------------------------------
// Mess QR attendance (the single write path used by every dashboard)
// ---------------------------------------------------------------------------

export interface MessAttendanceRecord {
  id: string;
  date: string; // YYYY-MM-DD
  meal: MealKey;
  status: "recorded";
  student_id: string;
  student_name: string;
  hostel: string;
  room: string;
  mess_code: string;
  mess_name: string;
  scanned_at: string; // ISO timestamp
  source: string; // "student_qr" | "manual" | …
  created_at: string;
}

export type MessScanCode =
  | "RECORDED"
  | "ALREADY_RECORDED"
  | "NO_ACTIVE_MEAL"
  | "INVALID_QR"
  | "WRONG_MESS"
  | "EXPIRED_QR";

export interface MessScanVerdict {
  ok: boolean;
  code: MessScanCode;
  error?: string;
  meal?: MealKey;
  record?: WithId<MessAttendanceRecord>;
  existing?: WithId<MessAttendanceRecord>;
}

export interface MessScanContext {
  studentId: string;
  studentName: string;
  hostel: string;
  room: string;
  qrPayload: string;
}

/**
 * Validate a mess QR scan and record attendance if every check passes:
 *  1. QR payload must be a registered, active Mess checkpoint
 *  2. Checkpoint must belong to the student's hostel
 *  3. A meal session must currently be active
 *  4. Duplicate protection (one record per meal per day)
 * Recorded attendance then flows automatically to the Student / Parent / Mess
 * Staff / Warden / Admin dashboards through the shared MessAttendance
 * collection, and an Activity Log entry is created.
 */
export async function recordMessScan(ctx: MessScanContext): Promise<MessScanVerdict> {
  const point = await findMessPoint(ctx.qrPayload);
  if (!point) {
    return { ok: false, code: "INVALID_QR", error: "Invalid or unrecognised Mess QR code. Please scan the official mess poster." };
  }
  if (point.hostel !== ctx.hostel) {
    return {
      ok: false,
      code: "WRONG_MESS",
      error: `This QR belongs to ${point.hostel}, but you are assigned to ${ctx.hostel}. Use your own mess hall's QR.`,
    };
  }
  if (!isMessCycleValid(point)) {
    return {
      ok: false,
      code: "EXPIRED_QR",
      error: "This Mess QR has expired. Please ask the Mess Manager for the current QR.",
    };
  }

  const config = await ensureMealConfig();
  const active = getActiveMeal(config);
  if (!active) {
    return {
      ok: false,
      code: "NO_ACTIVE_MEAL",
      error: "No active meal session right now.",
    };
  }

  const today = todayStr();
  const sid = String(ctx.studentId || "").trim().toUpperCase();
  const dup = await filterCollection("MessAttendance", (m: any) =>
    m.date === today &&
    m.meal === active.meal &&
    String(m.student_id || "").trim().toUpperCase() === sid
  );
  if (dup.length > 0) {
    const existing = dup[0] as WithId<MessAttendanceRecord>;
    const at = existing.scanned_at
      ? new Date(existing.scanned_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      : "";
    return {
      ok: false,
      code: "ALREADY_RECORDED",
      error: `You already recorded ${MEAL_LABELS[active.meal]} today${at ? ` at ${at}` : ""}.`,
      existing,
      meal: active.meal,
    };
  }

  const record = (await createRecord("MessAttendance", {
    date: today,
    meal: active.meal,
    status: "recorded",
    student_id: ctx.studentId,
    student_name: ctx.studentName || "Student",
    hostel: ctx.hostel,
    room: ctx.room || "",
    mess_code: point.code,
    mess_name: point.name,
    scanned_at: new Date().toISOString(),
    source: "student_qr",
  })) as WithId<MessAttendanceRecord>;

  await createRecord("ActivityLog", {
    user: ctx.studentName || "Student",
    role: "student",
    action: `Recorded ${MEAL_LABELS[active.meal]} meal attendance via Mess QR (${point.code}) at ${point.name}`,
    module: "Mess",
    record: record.id,
    timestamp: new Date().toISOString(),
  });

  await createRecord("Notification", {
    type: "info",
    title: `${MEAL_LABELS[active.meal]} Attendance Recorded`,
    message: `Your ${MEAL_LABELS[active.meal].toLowerCase()} attendance was recorded at ${fmtTime()}.`,
    role: "student",
    recipient: ctx.studentId,
    read: false,
    timestamp: new Date().toISOString(),
  });

  return { ok: true, code: "RECORDED", meal: active.meal, record };
}

// ---------------------------------------------------------------------------
// Shared meal aggregation helpers (pure functions over MessAttendance rows)
// ---------------------------------------------------------------------------

/** Map of meal -> record for a single student on a single day. */
export function mealMapForDay(
  records: WithId<MessAttendanceRecord>[],
  studentId: string,
  date: string = todayStr()
): Partial<Record<MealKey, WithId<MessAttendanceRecord>>> {
  const sid = String(studentId || "").trim().toUpperCase();
  const map: Partial<Record<MealKey, WithId<MessAttendanceRecord>>> = {};
  records.forEach((r) => {
    if (
      String(r.student_id || "").trim().toUpperCase() === sid &&
      r.date === date &&
      (r.meal as MealKey) in MEAL_LABELS
    ) {
      map[r.meal as MealKey] = r;
    }
  });
  return map;
}

export function completedMealCountForDay(
  records: WithId<MessAttendanceRecord>[],
  studentId: string,
  date: string = todayStr()
): number {
  return Object.values(mealMapForDay(records, studentId, date)).filter(Boolean).length;
}

/**
 * Meal attendance percentage across a date range: recorded meals divided by
 * eligible meals (days in range × 4). Parent & student history cards use this.
 */
export function mealPercentageInRange(
  records: WithId<MessAttendanceRecord>[],
  studentId: string,
  fromDate: string,
  toDate: string
): number {
  if (fromDate > toDate) return 0;
  const start = new Date(fromDate);
  const end = new Date(toDate);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return 0;
  const days = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000) + 1);
  const eligible = days * 4;
  const sid = String(studentId || "").trim().toUpperCase();
  const recorded = records.filter(
    (r) =>
      String(r.student_id || "").trim().toUpperCase() === sid &&
      r.date >= fromDate &&
      r.date <= toDate
  ).length;
  return eligible ? Math.min(100, Math.round((recorded / eligible) * 100)) : 0;
}

/** Live counts of today's attendance per meal (Mess Staff + Warden live view). */
export function todayMealCounts(records: WithId<MessAttendanceRecord>[], date: string = todayStr()) {
  const byMeal: Record<MealKey, number> = { breakfast: 0, lunch: 0, snacks: 0, dinner: 0 };
  records.forEach((r) => {
    if (r.date === date && r.meal in byMeal) {
      byMeal[r.meal as MealKey] += 1;
    }
  });
  return byMeal;
}

/** Hostel-wise today's counts (Admin + Warden hostel-wise view). */
export function todayCountsByHostel(records: WithId<MessAttendanceRecord>[], date: string = todayStr()) {
  const map: Record<string, Record<MealKey, number>> = {};
  records.forEach((r) => {
    if (r.date !== date) return;
    const key = r.hostel || "Unknown";
    if (!map[key]) map[key] = { breakfast: 0, lunch: 0, snacks: 0, dinner: 0 };
    if (r.meal in map[key]) map[key][r.meal as MealKey] += 1;
  });
  return map;
}

// ---------------------------------------------------------------------------
// Mess QR printable poster download
// ---------------------------------------------------------------------------

export interface MessPosterStyle {
  hostel: string;
  messName: string;
  hall?: string;
  payload: string;
  expiresAt: string; // ISO
  sub?: string;
  qrSize?: number;
}

/**
 * Render a mess QR poster onto a canvas (QR centred, hostel + mess name, and a
 * "valid until" line) and trigger a PNG download. Uses the same QR image
 * service as the on-screen <QRCode /> component.
 */
export async function downloadMessPoster(opts: MessPosterStyle): Promise<void> {
  const qrSize = opts.qrSize || 320;
  const pad = 48;
  const headerH = 130;
  const footerH = 96;
  const width = qrSize + pad * 2;
  const height = headerH + qrSize + footerH;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=${qrSize}x${qrSize}&data=${encodeURIComponent(
    opts.payload
  )}`;

  const img = new Image();
  img.crossOrigin = "anonymous";
  img.src = qrUrl;
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("Failed to load QR image."));
  });

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is not supported.");

  // Background
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = "#0f172a";
  ctx.lineWidth = 3;
  ctx.strokeRect(6, 6, width - 12, height - 12);

  // Header: hostel + mess name
  ctx.fillStyle = "#0f172a";
  ctx.textAlign = "center";
  ctx.font = "bold 30px sans-serif";
  ctx.fillText(opts.messName, width / 2, 52, width - pad);
  ctx.font = "18px sans-serif";
  ctx.fillStyle = "#475569";
  ctx.fillText(opts.hostel, width / 2, 84, width - pad);
  if (opts.hall) {
    ctx.fillText(opts.hall, width / 2, 110, width - pad);
  }

  // QR image
  const qrY = headerH;
  ctx.drawImage(img, (width - qrSize) / 2, qrY, qrSize, qrSize);

  // Footer: payload + validity
  ctx.textAlign = "center";
  ctx.font = "bold 16px monospace";
  ctx.fillStyle = "#0f172a";
  ctx.fillText(opts.payload, width / 2, qrY + qrSize + 34, width - pad);
  ctx.font = "15px sans-serif";
  ctx.fillStyle = "#b45309";
  const expiry = new Date(opts.expiresAt);
  const validLine = expiry.getTime()
    ? `Valid until ${expiry.toLocaleDateString()} · Scan to mark meal attendance`
    : "Scan to mark meal attendance";
  ctx.fillText(validLine, width / 2, qrY + qrSize + 64, width - pad);

  const a = document.createElement("a");
  a.download = `mess-qr-${opts.messName.replace(/[^A-Za-z0-9]+/g, "-").toLowerCase()}.png`;
  a.href = canvas.toDataURL("image/png");
  a.click();
}