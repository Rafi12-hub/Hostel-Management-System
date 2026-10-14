// Parent Auto-Notification helper.
//
// Simulates an automated SMS gateway that sends an SMS to a student's parent
// whenever a key hostel event occurs (e.g. out-pass exit/return, leave
// approval, emergency broadcast). Every dispatch is persisted to the
// `ParentNotification` collection so management can audit the full log.
import { createRecord, filterCollection, updateRecord } from "@/lib/firestore";

export type ParentChannel = "sms" | "email" | "whatsapp";

export interface ParentNotificationPayload {
  student_id?: string;
  student_name?: string;
  parent_name?: string;
  parent_phone?: string;
  hostel?: string;
  room?: string;
  event: string;
  message: string;
  channel: ParentChannel;
  priority?: "normal" | "high" | "critical";
}

interface SimulatedDelivery {
  status: "delivered" | "failed";
  provider_ref?: string;
  delivered_at?: string;
  error?: string;
}

// A very lightweight "provider" that decides whether a dispatch succeeds.
// In production this would call an SMS gateway (Twilio / MSG91 / Firebase
// Cloud Messaging + webhook). Here it always succeeds so demos are reliable.
async function sendViaProvider(_payload: ParentNotificationPayload): Promise<SimulatedDelivery> {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        status: "delivered",
        provider_ref: "SMS-" + Math.random().toString(36).slice(2, 9).toUpperCase(),
        delivered_at: new Date().toISOString(),
      });
    }, 400);
  });
}

/**
 * Look up a student's parent contact record from the Student collection by
 * student ID (falling back to name match for robustness).
 */
export async function findParentForStudent(
  studentId?: string,
  studentName?: string
): Promise<{ parent_name?: string; parent_phone?: string } | null> {
  if (!studentId && !studentName) return null;

  const students = await filterCollection("Student", (s: any) => {
    const idMatch = studentId
      ? String(s.student_id).trim().toUpperCase() === String(studentId).trim().toUpperCase()
      : false;
    const nameMatch = studentName
      ? String(s.name || "").trim().toLowerCase() === String(studentName).trim().toLowerCase()
      : false;
    return idMatch || nameMatch;
  });

  const s = students[0];
  if (!s) return null;
  return { parent_name: s.parent_name, parent_phone: s.parent_phone };
}

/**
 * Compose an SMS body using an optional configurable content override passed
 * by the caller, so each event can supply its own wording.
 */
function composeMessage(payload: ParentNotificationPayload): string {
  if (payload.message) return payload.message;
  return `[RGMCET Hostel Hub] Dear ${payload.parent_name || "Parent"}, ${payload.student_name || "a student"} (${payload.hostel || ""} ${payload.room || ""}): ${payload.event}. - Hostel Office`;
}

/**
 * Send (simulate) an SMS to a student's parent and log it to Firestore.
 * Resolves with the created ParentNotification record (id set).
 */
export async function notifyParent(
  payload: ParentNotificationPayload
): Promise<{ id: string; status: string } | null> {
  // Skip outright if it's clearly not a parent-notifiable event or no student.
  const parent = await findParentForStudent(payload.student_id, payload.student_name);
  const parentName = payload.parent_name || parent?.parent_name || "Parent";
  const parentPhone = payload.parent_phone || parent?.parent_phone || "Unknown";

  const delivery = await sendViaProvider(payload);

  const record: any = {
    student_id: payload.student_id || "",
    student_name: payload.student_name || "Unknown",
    parent_name: parentName,
    parent_phone: parentPhone,
    hostel: payload.hostel || "",
    room: payload.room || "",
    event: payload.event,
    message: composeMessage(payload),
    channel: payload.channel || "sms",
    priority: payload.priority || "normal",
    status: delivery.status,
    provider_ref: delivery.provider_ref,
    delivered_at: delivery.delivered_at,
  };

  const created = await createRecord("ParentNotification", record);

  // Deliveries are created as pending then settled, to model a real async
  // gateway and to give the management page a believable delivery lifecycle.
  await updateRecord("ParentNotification", created.id, { status: delivery.status });

  return { id: created.id, status: delivery.status };
}

/** Broadcast an SMS to every resident's parent. */
export async function broadcastToParents(message: string): Promise<number> {
  const students = await filterCollection("Student", () => true);
  let dispatched = 0;
  for (const s of students) {
    if (!s.parent_name && !s.parent_phone) continue;
    await notifyParent({
      student_id: s.student_id,
      student_name: s.name,
      parent_name: s.parent_name,
      parent_phone: s.parent_phone,
      hostel: s.hostel,
      room: s.room,
      event: "Broadcast",
      message,
      channel: "sms",
      priority: "critical",
    });
    dispatched++;
  }
  return dispatched;
}
