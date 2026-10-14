// Night Roll Call core logic: dynamic QR tokens, one-time codes, session
// lifecycle, automatic student status classification, and security validations.
//
// Time handling is intentionally clock-based (HH:MM within today) so roll-call
// windows like 09:30 PM - 10:00 PM are easy to reason about in the demo. A
// real deployment would compute against stored timestamps and server time.
import {
  createRecord,
  filterCollection,
  updateRecord,
  type WithId,
} from "@/lib/firestore";

export type RollCallStatus =
  | "PRESENT"
  | "LATE"
  | "OUTSIDE"
  | "ON_LEAVE"
  | "PENDING"
  | "UNKNOWN";

export type VerificationMethod =
  | "DYNAMIC_QR"
  | "ONE_TIME_CODE"
  | "FACE_RECOGNITION"
  | "LATE_CHECKIN"
  | "MANUAL";

export interface RollCallSession {
  id: string;
  hostelId: string;
  hostel?: string;
  date: string; // YYYY-MM-DD
  startTime: string; // "21:30"
  endTime: string; // "22:00"
  graceEndTime: string; // "22:15"
  active: boolean;
  createdBy?: string;
  createdAt?: string;
}

export interface Checkpoint {
  id: string;
  hostelId: string;
  hostel?: string;
  blockId: string;
  block?: string;
  floorId: string;
  floor?: string;
  locationName: string;
  qrToken: string;
  tokenExpiry: string; // ISO timestamp
  active: boolean;
  createdAt?: string;
}

export interface RollCallRecord {
  id: string;
  sessionId: string;
  studentId: string;
  checkpointId?: string;
  completedAt: string; // ISO timestamp
  status: RollCallStatus;
  verificationMethod: VerificationMethod;
  lateReason?: string;
  selfieUrl?: string;
  networkVerified?: boolean;
  createdAt?: string;
}

// Config stored in the Settings collection. Keys are namespaced with
// "nrc_" so they don't collide with existing settings.
export interface NightRollCallConfig {
  startTime: string; // "21:30"
  endTime: string; // "22:00"
  graceEndTime: string; // "22:15"
  tokenTtlMinutes: number; // 5
  wifiSsid: string; // "RGMCET-HOSTEL-WIFI"
  requireSelfie: boolean; // optional
  requireWifi: boolean; // optional
  enabled: boolean;
}

export const DEFAULT_NRC_CONFIG: NightRollCallConfig = {
  startTime: "21:30",
  endTime: "22:00",
  graceEndTime: "22:15",
  tokenTtlMinutes: 5,
  wifiSsid: "RGMCET-HOSTEL-WIFI",
  requireSelfie: false,
  requireWifi: false,
  enabled: true,
};

export const NRC_CONFIG_KEY = "nrc_config";

// ---------------------------------------------------------------------------
// Time helpers
// ---------------------------------------------------------------------------

export function fmtTime(d: Date = new Date()): string {
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true });
}

export function todayStr(d: Date = new Date()): string {
  // Local calendar date, consistent with the local-clock window comparisons
  // (windowState / nowHhmm) used throughout the roll-call flow.
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function hoursToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

// Convert "21:30" to a Date on the given day.
export function timeToDate(hhmm: string, base: Date = new Date()): Date {
  const [h, m] = hhmm.split(":").map(Number);
  const d = new Date(base);
  d.setHours(h, m, 0, 0);
  return d;
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

// Now as "HH:MM" in 24h format for window comparison.
function nowHhmm(d: Date = new Date()): string {
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

export type WindowState =
  | "NOT_OPENED"
  | "OPEN"
  | "GRACE"
  | "CLOSED";

export function windowState(config: NightRollCallConfig, now: Date = new Date()): WindowState {
  const cur = hoursToMinutes(nowHhmm(now));
  const start = hoursToMinutes(config.startTime);
  const end = hoursToMinutes(config.endTime);
  const grace = hoursToMinutes(config.graceEndTime);
  if (cur < start) return "NOT_OPENED";
  if (cur < end) return "OPEN";
  if (cur < grace) return "GRACE";
  return "CLOSED";
}

// ---------------------------------------------------------------------------
// Token generation (dynamic QR / one-time code)
// ---------------------------------------------------------------------------

export function randomOtp(len = 6): string {
  let out = "";
  for (let i = 0; i < len; i++) out += Math.floor(Math.random() * 10);
  return out;
}

export interface NrcToken {
  token: string;
  qrPayload: string; // ROLLCALL-<NAME>-<OTP>
  expiry: Date;
}

// Build a single shared dynamic token (global OTP + QR) for all checkpoints
// during a session window. This is what the student scans/enters.
export function generateNrcToken(
  studentName: string,
  config: NightRollCallConfig,
  now: Date = new Date()
): NrcToken {
  const formattedName = (studentName || "STUDENT").replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  const otp = randomOtp();
  const expiry = new Date(now.getTime() + config.tokenTtlMinutes * 60 * 1000);
  return {
    token: otp,
    qrPayload: `ROLLCALL-${formattedName}-${otp}`,
    expiry,
  };
}

// ---------------------------------------------------------------------------
// Config + session helpers
// ---------------------------------------------------------------------------

export async function ensureNrcConfig(): Promise<NightRollCallConfig> {
  const res = await filterCollection("Settings", { key: NRC_CONFIG_KEY });
  if (res.length > 0) {
    const row = res[0];
    return {
      ...DEFAULT_NRC_CONFIG,
      startTime: row.startTime ?? DEFAULT_NRC_CONFIG.startTime,
      endTime: row.endTime ?? DEFAULT_NRC_CONFIG.endTime,
      graceEndTime: row.graceEndTime ?? DEFAULT_NRC_CONFIG.graceEndTime,
      tokenTtlMinutes: row.tokenTtlMinutes ?? DEFAULT_NRC_CONFIG.tokenTtlMinutes,
      wifiSsid: row.wifiSsid ?? DEFAULT_NRC_CONFIG.wifiSsid,
      requireSelfie: row.requireSelfie ?? DEFAULT_NRC_CONFIG.requireSelfie,
      requireWifi: row.requireWifi ?? DEFAULT_NRC_CONFIG.requireWifi,
      enabled: row.enabled ?? DEFAULT_NRC_CONFIG.enabled,
    };
  }
  return { ...DEFAULT_NRC_CONFIG };
}

export async function saveNrcConfig(config: NightRollCallConfig): Promise<void> {
  const res = await filterCollection("Settings", { key: NRC_CONFIG_KEY });
  const payload = { ...config, key: NRC_CONFIG_KEY, category: "system" };
  if (res.length > 0) {
    await updateRecord("Settings", res[0].id, payload);
  } else {
    await createRecord("Settings", payload);
  }
}

// Find the active session for a given date/hostel, creating it if missing.
export async function getOrCreateSession(
  date: string,
  hostel: string,
  config: NightRollCallConfig,
  createdBy: string
): Promise<WithId<RollCallSession>> {
  const existing = await filterCollection("NightRollCallSessions", (s: any) =>
    String(s.date) === date && (s.hostel || "") === hostel
  );
  if (existing.length > 0) {
    const s = existing[existing.length - 1];
    // Refresh the window so the session tracks latest config.
    await updateRecord("NightRollCallSessions", s.id, {
      startTime: config.startTime,
      endTime: config.endTime,
      graceEndTime: config.graceEndTime,
      active: true,
      hostelId: "h_" + (hostel.includes("GH") ? "3" : hostel.includes("BH-2") ? "2" : "1"),
    });
    return s as WithId<RollCallSession>;
  }
  return (await createRecord("NightRollCallSessions", {
    hostelId: "h_" + (hostel.includes("GH") ? "3" : hostel.includes("BH-2") ? "2" : "1"),
    hostel,
    date,
    startTime: config.startTime,
    endTime: config.endTime,
    graceEndTime: config.graceEndTime,
    active: true,
    createdBy,
    createdAt: new Date().toISOString(),
  })) as WithId<RollCallSession>;
}

// ---------------------------------------------------------------------------
// Automatic status classification
// ---------------------------------------------------------------------------

export interface ClassifiedStudent {
  student: WithId<any>;
  nrcStatus: RollCallStatus;
  reason?: string;
}

// Decide each student's automatic roll-call status BEFORE check-in.
// - Approved leave spanning today   -> ON_LEAVE
// - Active/approved gate pass (exited outside) -> OUTSIDE
// - Otherwise expected in hostel -> PENDING (or UNKNOWN when no hostel data)
export async function classifyStudents(
  students: WithId<any>[],
  gatePasses: WithId<any>[],
  leaves: WithId<any>[]
): Promise<ClassifiedStudent[]> {
  const today = todayStr();
  return students.map((s) => {
    const sid = String(s.student_id).trim().toUpperCase();

    // Approved leave covering today
    const activeLeave = leaves.find(
      (l) =>
        l.status === "approved" &&
        String(l.student_id).trim().toUpperCase() === sid &&
        l.from_date <= today &&
        l.to_date >= today
    );
    if (activeLeave) {
      return {
        student: s,
        nrcStatus: "ON_LEAVE" as RollCallStatus,
        reason: `Approved leave ${activeLeave.from_date} → ${activeLeave.to_date} (${activeLeave.destination})`,
      };
    }

    // Approved / exited gate pass (student is outside)
    const gate = gatePasses.find((g) => {
      const gid = String(g.student_id).trim().toUpperCase();
      return gid === sid && g.date === today && (g.status === "approved" || g.status === "exited");
    });
    if (gate) {
      return {
        student: s,
        nrcStatus: "OUTSIDE" as RollCallStatus,
        reason: gate.status === "exited"
          ? `Exited hostel on gate pass ${gate.pass_id} at ${gate.exit_time}, expected ${gate.expected_return}`
          : `Approved gate pass ${gate.pass_id} (${gate.exit_time}–${gate.expected_return})`,
      };
    }

    // Late existing flag
    if (s.status === "late") {
      return { student: s, nrcStatus: "LATE" as RollCallStatus, reason: "Previously flagged late" };
    }

    // Expected but not yet checked in
    if (!s.hostel) {
      return { student: s, nrcStatus: "UNKNOWN" as RollCallStatus, reason: "No hostel assignment on record" };
    }
    return { student: s, nrcStatus: "PENDING" as RollCallStatus, reason: "Expected in hostel, awaiting check-in" };
  });
}

// ---------------------------------------------------------------------------
// Existing check-in / duplicate detection
// ---------------------------------------------------------------------------

export async function existingRecord(
  sessionId: string,
  studentId: string
): Promise<WithId<RollCallRecord> | null> {
  const res = await filterCollection("NightRollCallRecords", (r: any) =>
    r.sessionId === sessionId && String(r.studentId).trim().toUpperCase() === String(studentId).trim().toUpperCase()
  );
  return res[0] || null;
}

// ---------------------------------------------------------------------------
// Security validation of a check-in attempt
// ---------------------------------------------------------------------------

export interface CheckInVerdict {
  ok: boolean;
  error?: string;
  record?: WithId<RollCallRecord>;
  status?: RollCallStatus;
}

export interface CheckInContext {
  studentName: string;
  studentId: string;
  sessionId: string;
  config: NightRollCallConfig;
  submittedToken?: string;
  expectedToken: string; // the current active OTP
  window: WindowState;
  lateReason?: string;
  selfieUrl?: string;
  networkVerified?: boolean;
  faceVerified?: boolean; // true when the student completed roll call via FRS
  exemptStatus?: RollCallStatus; // OUTSIDE / ON_LEAVE if already classified
  exemptReason?: string;
}

// Validate and record a check-in, enforcing all security rules:
//  - one check-in per student per session (duplicate prevention)
//  - attempt inside window (OPEN => PRESENT, GRACE => LATE + reason)
//  - no old token usage (exact match against current token)
//  - NOT_OPENED / CLOSED => rejected
export async function validateAndRecordCheckIn(ctx: CheckInContext): Promise<CheckInVerdict> {
  // 1. Duplicate prevention
  const dup = await existingRecord(ctx.sessionId, ctx.studentId);
  if (dup) {
    return {
      ok: false,
      error: "You have already completed tonight's Night Roll Call.",
      record: dup,
      status: dup.status,
    };
  }

  // 2. Window enforcement
  if (ctx.window === "NOT_OPENED") {
    return { ok: false, error: `Roll call has not opened yet. It opens at ${ctx.config.startTime}.` };
  }
  if (ctx.window === "CLOSED") {
    return { ok: false, error: "Roll call is closed. Please contact your Warden." };
  }

  const isGrace = ctx.window === "GRACE";
  if (isGrace && !ctx.lateReason?.trim()) {
    return { ok: false, error: "You are late. Please provide a reason for your late check-in." };
  }

  // 3. Token verification (only required when the student is actually checking
  // in — exempt students skip it, and FRS check-ins verify identity via the
  // face descriptor instead of a shared code).
  if (ctx.submittedToken) {
    if (ctx.submittedToken.trim() !== ctx.expectedToken.trim()) {
      return { ok: false, error: "Invalid or expired Roll Call code. Please use the current code." };
    }
  } else if (!ctx.exemptStatus && !ctx.faceVerified) {
    return { ok: false, error: "A Night Roll Call code (or FRS scan) is required to complete check-in." };
  }

  // 4. Compute final status & method
  const status: RollCallStatus = ctx.exemptStatus
    ? ctx.exemptStatus
    : isGrace
      ? "LATE"
      : "PRESENT";
  const method: VerificationMethod = ctx.exemptStatus
    ? "MANUAL"
    : ctx.faceVerified
      ? "FACE_RECOGNITION"
      : isGrace
        ? "LATE_CHECKIN"
        : "DYNAMIC_QR";

  const record = (await createRecord("NightRollCallRecords", {
    sessionId: ctx.sessionId,
    studentId: ctx.studentId,
    completedAt: new Date().toISOString(),
    status,
    verificationMethod: method,
    lateReason: isGrace ? ctx.lateReason : "",
    selfieUrl: ctx.selfieUrl || "",
    networkVerified: !!ctx.networkVerified,
    exemptReason: ctx.exemptReason || "",
    createdAt: new Date().toISOString(),
  })) as WithId<RollCallRecord>;

  return { ok: true, record, status };
}

// ---------------------------------------------------------------------------
// In-app reminders during the roll-call window
// ---------------------------------------------------------------------------

// Compute which reminder threshold (minutes-to-close) is currently due. Each
// threshold is a 1-minute window so we dispatch it exactly once.
export function dueReminderCode(
  config: NightRollCallConfig,
  now: Date = new Date()
): ReminderCode | null {
  const cur = hoursToMinutes(nowHhmm(now));
  const end = hoursToMinutes(config.endTime);
  const grace = hoursToMinutes(config.graceEndTime);
  if (cur >= end && cur < end + 2 && cur < grace) return "CLOSED";
  if (cur >= end - 5 && cur < end - 4) return "CLOSED_5";
  if (cur >= end - 15 && cur < end - 14) return "CLOSED_15";
  return null;
}

export type ReminderCode = "CLOSED_15" | "CLOSED_5" | "CLOSED";

export function reminderMeta(code: ReminderCode): { title: string; message: string; type: string } {
  if (code === "CLOSED_5") {
    return { title: "Night Roll Call closes in 5 minutes", message: "⚠️ Complete your Night Roll Call now before the window closes.", type: "warning" };
  }
  if (code === "CLOSED_15") {
    return { title: "Night Roll Call closes in 15 minutes", message: "⚠️ Complete your Night Roll Call now. The window is still open.", type: "warning" };
  }
  return { title: "Night Roll Call Closed", message: "Roll Call has closed. If you missed it, check in during the grace period or contact your Warden.", type: "critical" };
}

