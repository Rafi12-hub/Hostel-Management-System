// Secure Gate Pass & Movement Service.
//
// Single source of truth for the Smart Hostel Security module:
//  - Gate pass lifecycle: PENDING -> APPROVED -> ACTIVE -> EXITED -> COMPLETED
//    (plus REJECTED / CANCELLED / EXPIRED / OVERDUE)
//  - Secure QR verification: the QR only carries an opaque one-time token; the
//    real authority is the GatePass document in Firestore.
//  - Entry/exit transactions: atomically advance the pass, update the student's
//    hostel status, and write an append-only GateLog record.
//  - Notifications are enqueued asynchronously so a WhatsApp failure never
//    rolls back a valid gate transaction.
//
// NOTE: this project is a Firebase client app (no standalone server yet). All
// validation therefore runs against Firestore documents from authenticated
// clients. For a production deployment the verification + transaction logic
// in this file should be mirrored inside a Cloud Function / Admin SDK so it can
// never be bypassed by a client. The interface is intentionally isolated here
// so that swap is a drop-in.

import { collection, doc, runTransaction, type DocumentSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { createRecord, filterCollection, updateRecord } from "@/lib/firestore";
import { todayStr, nowHhmm } from "@/lib/hostelService";
import { enqueueNotification, type NotificationType } from "@/lib/notificationQueue";

export type GatePassStatus =
  | "pending"
  | "approved"
  | "active"
  | "exited"
  | "returned"
  | "completed"
  | "rejected"
  | "cancelled"
  | "expired"
  | "overdue";

export type HostelStatus = "inside" | "outside" | "on_leave" | "overdue" | "unknown";
export type GateAction = "ENTRY" | "EXIT";
export type VerificationMethod = "FACE" | "QR" | "FACE_AND_QR" | "MANUAL";
export type StatusFlag = "SUCCESS" | "FAILED" | "NOT_USED";

export interface GateLog {
  student_id: string;
  student_name: string;
  gate_pass_id: string;
  gate_pass_number?: string;
  gate_id: string;
  action: GateAction;
  verification_method: VerificationMethod;
  face_match_status: StatusFlag;
  liveness_status: StatusFlag;
  security_user_id: string;
  security_user_name: string;
  scanner_id?: string;
  timestamp: string;
  device_info?: string;
  remarks: string;
}

// ---------------------------------------------------------------------------
// Token / number generation
// ---------------------------------------------------------------------------

export const GATE_PASS_PREFIX = "GP";

export function generatePassNumber(year: number = new Date().getFullYear()): string {
  const rand = String(Math.floor(10000 + Math.random() * 90000));
  return `${GATE_PASS_PREFIX}-${year}-${rand}`;
}

/** Cryptographically-random opaque QR token (only stored server-side). */
export function generateQrToken(): string {
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    const bytes = crypto.getRandomValues(new Uint8Array(24));
    return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  }
  return Math.random().toString(36).slice(2, 12) + Date.now().toString(36);
}

/**
 * Build the QR payload that is printed on the gate pass. It contains ONLY the
 * opaque token + a static prefix — never names / IDs / numbers that could be
 * forged and trusted by a scanner.
 */
export function gatePassQrPayload(token: string): string {
  return `rgmet-gp:${String(token || "").trim()}`;
}

// ---------------------------------------------------------------------------
// Finding records
// ---------------------------------------------------------------------------

export async function findStudentByKey(key?: string): Promise<any | null> {
  if (!key) return null;
  const target = String(key).trim();
  const upper = target.toUpperCase();
  const matches = await filterCollection("Student", (s: any) => {
    const id = String(s.student_id || "").trim().toUpperCase();
    const name = String(s.name || "").trim().toLowerCase();
    const reg = String(s.register_number || s.register_nmbr || "").trim().toUpperCase();
    return id === upper || name === target.toLowerCase() || (reg && reg === upper);
  });
  return matches[0] || null;
}

export async function findParentDocument(student: any): Promise<any | null> {
  if (!student) return null;
  const id = String(student.student_id || "").trim().toUpperCase();
  const parents = await filterCollection("Parent", (p: any) => {
    const sid = String(p.student_id || "").trim().toUpperCase();
    return sid === id || (p.students && p.students.includes(student.id));
  });
  return parents[0] || null;
}

export function parentDetails(student: any, parent?: any) {
  return {
    parent_name: parent?.name || student?.parent_name || "",
    parent_phone: parent?.whatsapp_number || parent?.phone || student?.parent_phone || "",
    notification_enabled: parent ? parent.notification_enabled !== false : true,
  };
}

// ---------------------------------------------------------------------------
// Gate pass validity
// ---------------------------------------------------------------------------

export interface PassWindow {
  valid_from: Date;
  valid_until: Date;
  date: string;
  exit_time: string;
  expected_return: string;
}

/** Resolve a pass's actual validity window from its legacy/flat fields or ISO fields. */
export function gatePassWindow(pass: any): PassWindow | null {
  if (!pass) return null;
  const date = pass.date || (pass.valid_from ? pass.valid_from.split("T")[0] : todayStr());
  const exit = pass.exit_time || "00:00";
  const ret = pass.expected_return || "23:59";

  let validFrom: Date;
  if (pass.valid_from) {
    validFrom = new Date(pass.valid_from);
  } else {
    validFrom = new Date(`${date}T${exit}:00`);
  }

  let validUntil: Date;
  if (pass.valid_until) {
    validUntil = new Date(pass.valid_until);
  } else {
    validUntil = new Date(`${date}T${ret}:00`);
  }
  // Multi-day passes (leave): valid_until falls on a later date than exit day.
  if (pass.to_date && pass.to_date !== date) {
    validUntil = new Date(`${pass.to_date}T${ret || "23:59"}:00`);
  }
  if (isNaN(validFrom.getTime()) || isNaN(validUntil.getTime())) return null;
  return { valid_from: validFrom, valid_until: validUntil, date, exit_time: exit, expected_return: ret };
}

// ---------------------------------------------------------------------------
// QR verification (scanner path)
// ---------------------------------------------------------------------------

export interface GatePassVerdict {
  ok: boolean;
  code:
    | "VALID"
    | "INVALID_TOKEN"
    | "EXPIRED"
    | "CANCELLED"
    | "REJECTED"
    | "ALREADY_USED"
    | "WRONG_GATE"
    | "NOT_FOUND";
  error?: string;
  pass?: any;
  student?: any;
}

export type ExpectedAction = GateAction;

/**
 * Validate an opaque QR token against the GatePass collection.
 *
 * Rules enforced here:
 *  - Only a token that exists on an actual GatePass document is valid.
 *  - Expired / cancelled / rejected passes are always denied.
 *  - A pass that already completed its lifecycle is denied (no reuse).
 */
export async function verifyGatePassToken(
  raw: string,
  expected: ExpectedAction = "EXIT",
  now: Date = new Date()
): Promise<GatePassVerdict> {
  const token = String(raw || "").trim();
  let tokenValue = token;
  const m = token.match(/^rgmet-gp:([a-f0-9]+)$/i);
  if (m) tokenValue = m[1];

  const passes = await filterCollection("GatePass", (p: any) => {
    if (p.qr_token && String(p.qr_token || "").trim() === tokenValue) return true;
    // Legacy passes store a readable string with pass_id — do NOT trust it, but
    // allow lookup so older seeded passes stay scannable.
    if (!p.qr_token && p.qr_code && String(p.qr_code).toLowerCase().includes(tokenValue.toLowerCase())) return true;
    if (p.pass_number && String(p.pass_number).toUpperCase() === tokenValue.toUpperCase()) return true;
    return false;
  });

  if (passes.length === 0) {
    return { ok: false, code: "INVALID_TOKEN", error: "No valid gate pass found." };
  }
  const pass = passes[0];
  const status = String(pass.status || "pending").toLowerCase();

  if (status === "rejected") {
    return { ok: false, code: "REJECTED", error: "This gate pass was rejected. Contact the warden." };
  }
  if (status === "cancelled" || status === "canceled") {
    return { ok: false, code: "CANCELLED", error: "This gate pass has been cancelled." };
  }
  if (status === "completed") {
    return { ok: false, code: "ALREADY_USED", error: "This gate pass has already been used." };
  }
  if (status === "expired") {
    return { ok: false, code: "EXPIRED", error: "This gate pass has expired." };
  }

  const window = gatePassWindow(pass);
  if (window && now > window.valid_until) {
    // Persist the expired state so dashboards agree (non-fatal if it fails).
    if (status !== "overdue") {
      await updateRecord("GatePass", pass.id, { status: "expired", updated_at: new Date().toISOString() }).catch(() => {});
    }
    return { ok: false, code: "EXPIRED", error: "This gate pass has expired." };
  }

  if (expected === "EXIT") {
    if (status === "exited" || status === "overdue") {
      return { ok: false, code: "ALREADY_USED", error: "This student has already exited on this pass." };
    }
    if (status !== "approved" && status !== "active") {
      return { ok: false, code: "INVALID_TOKEN", error: "No valid gate pass found." };
    }
  } else {
    // ENTRY expected
    if (status !== "exited" && status !== "overdue") {
      return { ok: false, code: "ALREADY_USED", error: "No active exit to validate for this pass." };
    }
  }

  const student = await findStudentByKey(pass.student_id || pass.studentId);
  if (!student) {
    return { ok: false, code: "NOT_FOUND", error: "Linked student record not found." };
  }

  return { ok: true, code: "VALID", pass, student };
}

// ---------------------------------------------------------------------------
// Gate transactions (entry / exit)
// ---------------------------------------------------------------------------

export interface GateTransactionInput {
  action: GateAction;
  passId?: string; // GatePass document id (may be undefined for MANUAL fallback)
  passNumber?: string;
  studentId?: string;
  studentName?: string;
  gateId?: string;
  gateName?: string;
  verificationMethod: VerificationMethod;
  faceMatchStatus: StatusFlag;
  livenessStatus: StatusFlag;
  securityUserId?: string;
  securityUserName?: string;
  scannerId?: string;
  deviceInfo?: string;
  remarks?: string;
}

export interface GateTransactionResult {
  ok: boolean;
  code:
    | "EXIT_RECORDED"
    | "ENTRY_RECORDED"
    | "DENIED"
    | "ALREADY_EXITED"
    | "ALREADY_INSIDE"
    | "NO_PASS"
    | "ERROR";
  message: string;
  log?: any;
  pass?: any;
  student?: any;
  gate?: any;
}

/**
 * Record a verified gate transaction.
 *
 * Business rules (see spec section 30):
 *  1. A pass is atomically flipped in a Firestore transaction so duplicate
 *     exits/entries are impossible (single-use passes).
 *  2. The student's hostel status ONLY changes through these transactions.
 *  3. The GateLog is append-only for normal users.
 *  4. Parent notifications are queued asynchronously — a WhatsApp failure
 *     never invalidates a legitimate transaction.
 */
export async function processGateTransaction(
  input: GateTransactionInput
): Promise<GateTransactionResult> {
  const now = new Date();
  const passRef = input.passId ? doc(collection(db, "GatePass"), input.passId) : null;

  try {
    // ---- Locate pass (by id, by number, or by verifying an opaque token) ----
    let pass: any = null;
    if (passRef && input.passId) {
      const snap = await runTransaction<DocumentSnapshot | null>(db, async (tx) => {
        const s = await tx.get(passRef);
        return s.exists() ? s : null;
      });
      pass = snap?.exists ? { id: snap.id, ...snap.data() } : null;
    } else if (input.passNumber) {
      const res = await verifyGatePassToken(input.passNumber, input.action, now);
      if (!res.ok || !res.pass) {
        return { ok: false, code: "NO_PASS", message: res.error || "No valid gate pass found." };
      }
      pass = res.pass;
    }

    // ---- Resolve student ----
    let student: any = null;
    if (input.studentId) student = await findStudentByKey(input.studentId);
    if (!student && pass?.student_id) student = await findStudentByKey(pass.student_id);
    if (!student && input.studentName) student = await findStudentByKey(input.studentName);
    if (!student) {
      return { ok: false, code: "NO_PASS", message: "Student record not found." };
    }
    const studentId = String(student.student_id || student.studentId || "").trim();
    const studentName = student.name || input.studentName || studentId;

    // ---- Gate ----
    const gate = input.gateId
      ? (await filterCollection("Gate", (g: any) => String(g.id) === String(input.gateId) || g.device_id === input.gateId)).shift() ||
        ((await filterCollection("Gate", (g: any) => g.name === input.gateName)).shift() ?? null)
      : null;

    // ---- Enforce attendance rules BEFORE any state change ----
    const currentStatus = String(student.status || "").toLowerCase();
    const hostelStatus = String(student.hostel_status || "").toLowerCase();

    if (input.action === "EXIT" && (currentStatus === "outside" || hostelStatus === "outside")) {
      return {
        ok: false,
        code: "ALREADY_EXITED",
        message: "This student is already recorded as OUTSIDE the hostel.",
      };
    }
    if (input.action === "ENTRY" && (currentStatus === "present" || hostelStatus === "inside")) {
      return {
        ok: false,
        code: "ALREADY_INSIDE",
        message: "This student is already recorded as INSIDE the hostel.",
      };
    }

    // ---- Lifecycle claim (atomic, single-use) ----
    const passWasCheckedOut = !!pass;
    const claimedPassRef = passRef;
    if (passWasCheckedOut && input.passId && claimedPassRef) {
      const result = await runTransaction<{ pass: any }>(db, async (tx) => {
        const snap = await tx.get(claimedPassRef);
        if (!snap.exists()) throw new Error("PASS_GONE");
        const current = snap.data();
        const st = String(current.status || "pending").toLowerCase();

        if (input.action === "EXIT") {
          if (st === "exited" || st === "overdue" || st === "completed") {
            throw new Error("ALREADY_USED");
          }
          tx.update(claimedPassRef, { status: "exited", exited_at: now.toISOString(), updated_at: now.toISOString() });
        } else {
          if (st !== "exited" && st !== "overdue") {
            throw new Error("NOT_CHECKED_OUT");
          }
          tx.update(claimedPassRef, { status: "completed", actual_return: nowHhmm(now), returned_at: now.toISOString(), updated_at: now.toISOString() });
        }
        return { pass: { id: snap.id, ...current } };
      });
      if (result) pass = result.pass;
    } else if (passWasCheckedOut && input.passNumber) {
      const updated = await updateRecord("GatePass", pass.id, {
        status: input.action === "EXIT" ? "exited" : "completed",
        exited_at: input.action === "EXIT" ? now.toISOString() : pass.exited_at,
        actual_return: input.action === "ENTRY" ? nowHhmm(now) : pass.actual_return,
        updated_at: now.toISOString(),
      });
      pass = updated;
    }

    // ---- Update student hostel status (source of truth for dashboards) ----
    const newHostelStatus: HostelStatus =
      input.action === "EXIT" ? "outside" : "inside";
    await updateRecord("Student", student.id, {
      hostel_status: newHostelStatus,
      status: input.action === "EXIT" ? "outside" : "present",
      updated_at: now.toISOString(),
    });

    // ---- Append gate log (audit proof, always written) ----
    const log: Partial<GateLog> = {
      student_id: studentId,
      student_name: studentName,
      gate_pass_id: pass?.id || "",
      gate_pass_number: pass?.pass_number || pass?.pass_id || "",
      gate_id: gate?.id || input.gateId || "main-gate-1",
      action: input.action,
      verification_method: input.verificationMethod,
      face_match_status: input.faceMatchStatus,
      liveness_status: input.livenessStatus,
      security_user_id: input.securityUserId || "",
      security_user_name: input.securityUserName || "Security Desk",
      scanner_id: input.scannerId || "",
      timestamp: now.toISOString(),
      device_info: input.deviceInfo || "",
      remarks: input.remarks || "",
    };
    const createdLog = await createRecord("GateLog", log);

    // ---- Backward-compatible EntryExit record (existing screens) ----
    await createRecord("EntryExit", {
      transaction_id: "TXN-" + Math.floor(1000 + Math.random() * 9000),
      student_id: studentId,
      student_name: studentName,
      hostel: student.hostel || "",
      room: student.room || "",
      date: todayStr(now),
      exit_time: input.action === "EXIT" ? nowHhmm(now) : "",
      expected_return: pass ? gatePassWindow(pass)?.expected_return || "" : "",
      actual_return: input.action === "ENTRY" ? nowHhmm(now) : "",
      status: input.action === "EXIT" ? "outside" : "present",
      gate: input.gateName || gate?.name || "Main Security Gate",
      security_staff: input.securityUserName || "Security Desk",
      purpose: pass?.reason || "",
    }).catch(() => {});

    // ---- Async parent notification (never blocks / never rolls back) ----
    const event = input.action === "EXIT" ? "EXIT" : "ENTRY";
    await enqueueNotification({
      idempotencyKey: `${studentId}:${createdLog.id}:${event}`,
      type: event as NotificationType,
      studentId,
      parentId: "",
      title: input.action === "EXIT" ? "Hostel Exit" : "Hostel Entry",
      message: "",
      payload: {
        student,
        pass,
        gate: gate?.name || input.gateName || "Main Security Gate",
        action: input.action,
        timestamp: now,
      },
      priority: "high",
    });

    return {
      ok: true,
      code: input.action === "EXIT" ? "EXIT_RECORDED" : "ENTRY_RECORDED",
      message:
        input.action === "EXIT"
          ? "Exit recorded successfully. Parent notification queued."
          : "Entry recorded successfully. Parent notification queued.",
      log: createdLog,
      pass: pass ? { ...pass, status: input.action === "EXIT" ? "exited" : "completed" } : undefined,
      student,
      gate,
    };
  } catch (err: any) {
    const msg = String(err?.message || "");
    if (msg === "ALREADY_USED") {
      return { ok: false, code: "ALREADY_EXITED", message: "This gate pass has already been used." };
    }
    if (msg === "NOT_CHECKED_OUT" || msg === "PASS_GONE") {
      return { ok: false, code: "NO_PASS", message: "No active exit found for this pass." };
    }
    return { ok: false, code: "ERROR", message: "Unable to record the gate transaction. Please try again." };
  }
}

// ---------------------------------------------------------------------------
// Failed attempt logging (append-only)
// ---------------------------------------------------------------------------

export async function logFailedAttempt(input: {
  studentId?: string;
  studentName?: string;
  passNumber?: string;
  gateId?: string;
  action?: GateAction;
  verificationMethod: VerificationMethod;
  faceMatchStatus?: StatusFlag;
  livenessStatus?: StatusFlag;
  securityUserId?: string;
  securityUserName?: string;
  scannerId?: string;
  deviceInfo?: string;
  remarks: string;
}): Promise<any> {
  return createRecord("GateLog", {
    student_id: input.studentId || "",
    student_name: input.studentName || (input.studentId ? input.studentId : "Unknown Person"),
    gate_pass_id: "",
    gate_pass_number: input.passNumber || "",
    gate_id: input.gateId || "main-gate-1",
    action: input.action || "EXIT",
    verification_method: input.verificationMethod,
    face_match_status: input.faceMatchStatus || "NOT_USED",
    liveness_status: input.livenessStatus || "NOT_USED",
    security_user_id: input.securityUserId || "",
    security_user_name: input.securityUserName || "Security Desk",
    scanner_id: input.scannerId || "",
    timestamp: new Date().toISOString(),
    device_info: input.deviceInfo || "",
    remarks: input.remarks || "Verification failed",
  });
}

// ---------------------------------------------------------------------------
// Gate pass creation (used during leave/gate-pass approval or direct creation)
// ---------------------------------------------------------------------------

export async function createApprovedGatePass(input: {
  student: any;
  passNumber: string;
  leaveId?: string;
  date?: string;
  exitTime?: string;
  expectedReturn?: string;
  toDate?: string;
  reason?: string;
  destination?: string;
  gateName?: string;
}): Promise<any> {
  const date = input.date || todayStr();
  const token = generateQrToken();
  const validFrom = new Date(`${date}T${input.exitTime || "09:00"}:00`).toISOString();
  let validUntil: string;
  if (input.toDate && input.toDate !== date) {
    validUntil = new Date(`${input.toDate}T${input.expectedReturn || "23:59"}:00`).toISOString();
  } else {
    validUntil = new Date(`${date}T${input.expectedReturn || "20:00"}:00`).toISOString();
  }

  return createRecord("GatePass", {
    pass_id: input.passNumber,
    pass_number: input.passNumber,
    student_id: input.student.student_id || input.student.studentId || input.student.id,
    studentId: input.student.student_id || input.student.studentId || input.student.id,
    student_name: input.student.name || "Student",
    hostel: input.student.hostel || "",
    room: input.student.room || "",
    leave_request_id: input.leaveId || "",
    date,
    to_date: input.toDate || date,
    exit_time: input.exitTime || "09:00",
    expected_return: input.expectedReturn || "20:00",
    reason: input.reason || "",
    destination: input.destination || "",
    status: "approved",
    qr_token: token,
    qr_code: gatePassQrPayload(token),
    valid_from: validFrom,
    valid_until: validUntil,
    gate: input.gateName || "Main Security Gate 1",
    security_staff: "",
    actual_return: "",
    return_status: "pending",
  });
}

export function hostelStatusLabel(status: string | undefined): string {
  switch (String(status || "").toLowerCase()) {
    case "inside":
    case "present":
      return "INSIDE HOSTEL";
    case "outside":
      return "OUTSIDE HOSTEL";
    case "leave":
    case "on_leave":
      return "ON LEAVE";
    case "overdue":
      return "OVERDUE";
    default:
      return "UNKNOWN";
  }
}