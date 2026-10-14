// Overdue / late-return detection.
//
// A student is OVERDUE when their expected-return time has passed while they
// are still recorded OUTSIDE. Alerts are deduplicated (one per student per day)
// and parent WhatsApp alerts are queued through the async notification queue.
import { createRecord, filterCollection, updateRecord } from "@/lib/firestore";
import { gatePassWindow } from "@/lib/gateService";
import { notifyOverdue } from "@/lib/whatsappNotifier";
import { todayStr } from "@/lib/hostelService";

export interface OverdueScanResult {
  scanned: number;
  overdue: number;
  alertsQueued: number;
  updatedIds: string[];
}

const OVERDUE_ALERT_KEY = "overdue_alert";

/**
 * Scan students + active passes and mark anyone whose expected return has
 * passed while their hostel status is OUTSIDE.
 *
 * Rules:
 *  - Students with an active (approved) leave are treated as ON_LEAVE, not
 *    overdue, until they are due back.
 *  - Status is only ever downgraded here (outside → overdue); the ENTRY
 *    transaction restores INSIDE.
 *  - Alerts are deduplicated by a stored Notification per student/day.
 */
export async function runOverdueCheck(now: Date = new Date()): Promise<OverdueScanResult> {
  const [students, passes, notifications] = await Promise.all([
    filterCollection("Student", () => true),
    filterCollection("GatePass", () => true),
    filterCollection("Notification", () => true),
  ]);
  const today = todayStr(now);

  const result: OverdueScanResult = { scanned: 0, overdue: 0, alertsQueued: 0, updatedIds: [] };

  for (const s of students) {
    const sid = String(s.student_id || s.studentId || "").trim().toUpperCase();
    if (!sid) continue;
    const status = String(s.status || "").toLowerCase();
    const hostelStatus = String(s.hostel_status || "").toLowerCase();

    const isCurrentlyOutside =
      hostelStatus === "outside" || status === "outside" || status === "late";

    // Active approved leave = ON_LEAVE until the return date passes.
    if (s.hostel_status !== "on_leave" && String(s.hostel_status || "").toLowerCase() === "on_leave") {
      // If leave period ended and still outside -> overdue handled below.
    }

    // Find the student's most recent pass that is open (exited / overdue).
    const openPass = passes
      .filter((p) => {
        const pid = String(p.student_id || p.studentId || "").trim().toUpperCase();
        return pid === sid && ["exited", "overdue", "approved", "active", "pending"].includes(String(p.status || "").toLowerCase());
      })
      .sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")))[0];

    const window = openPass ? gatePassWindow(openPass) : null;
    const isOverdue = !!window && now > window.valid_until && isCurrentlyOutside;

    if (!isOverdue) continue;

    result.scanned++;
    if (openPass.status !== "overdue") {
      await updateRecord("GatePass", openPass.id, { status: "overdue", updated_at: now.toISOString() }).catch(() => {});
    }
    if (String(s.hostel_status || "").toLowerCase() !== "overdue") {
      await updateRecord("Student", s.id, { hostel_status: "overdue", status: "overdue", updated_at: now.toISOString() }).catch(() => {});
    }
    result.overdue++;
    result.updatedIds.push(openPass.id);

    // ---- Deduplicate alert (one per student per day) ----
    const existingAlert = notifications.some(
      (n) =>
        String(n.recipient || "").trim().toUpperCase() === sid &&
        n.key === OVERDUE_ALERT_KEY &&
        String(n.timestamp || "").startsWith(today)
    );
    if (existingAlert) continue;

    const student = s;
    await createRecord("Notification", {
      type: "warning",
      title: "Late Return Alert",
      message: `${student.name} (${sid}) has not returned to the hostel. Expected return was ${new Date(
        window.valid_until
      ).toLocaleString()}.`,
      role: "warden",
      recipient: sid,
      key: OVERDUE_ALERT_KEY,
      read: false,
      timestamp: now.toISOString(),
    }).catch(() => {});

    await notifyOverdue({
      student,
      studentId: sid,
      studentName: student.name,
      hostel: student.hostel,
      room: student.room,
      pass: openPass,
      expected_return_at: window.valid_until.toISOString(),
      expected_return_time: window.expected_return,
      date: today,
    });
    result.alertsQueued++;
  }

  return result;
}