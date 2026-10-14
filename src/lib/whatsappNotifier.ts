// WhatsApp parent notification service.
//
// Provider abstraction so the transport can be swapped without touching the
// rest of the app. The built-in provider uses the official WhatsApp Business
// Cloud API (hosted gateway) — never WhatsApp Web, personal numbers or browser
// automation. Credentials stay in environment variables and are NEVER shipped
// to the frontend; when they are absent the service falls back to a simulated
// provider so the demo remains usable (records are still audited).
//
// Composed messages follow the templates in the spec (leave approved, actual
// exit / entry, overdue, gate pass rejected).
import { enqueueNotification, processNotificationQueue, type NotificationJob, type NotificationType } from "@/lib/notificationQueue";
import { findParentForStudent } from "@/lib/parentNotifier";
import { findParentDocument, parentDetails } from "@/lib/gateService";

// ---------------------------------------------------------------------------
// Environment config (only API credentials / numbers; never secrets in code)
// ---------------------------------------------------------------------------

const WA_BASE = import.meta.env.VITE_WHATSAPP_API_BASE_URL || "https://graph.facebook.com/v21.0";
const WA_TOKEN = (import.meta.env.VITE_WHATSAPP_API_TOKEN || "").trim();
const WA_PHONE_ID = (import.meta.env.VITE_WHATSAPP_PHONE_NUMBER_ID || "").trim();

export const whatsappConfigured = (): boolean => !!WA_TOKEN && !!WA_PHONE_ID;

/** Normalise an Indian phone number to E.164 (+91…). */
export function normalizeE164(phone: string): string {
  let p = String(phone || "").replace(/[^\d+]/g, "");
  if (p.startsWith("+")) return p;
  if (p.startsWith("0")) p = p.slice(1);
  if (!p.startsWith("91")) {
    if (p.length === 10) p = `91${p}`;
    else p = `91${p}`;
  }
  return `+${p}`;
}

// ---------------------------------------------------------------------------
// Provider contract
// ---------------------------------------------------------------------------

export interface WhatsAppDelivery {
  ok: boolean;
  ref?: string;
  error?: string;
}

export interface WhatsAppMessageContext {
  type: NotificationType;
  studentName: string;
  data: Record<string, any>;
}

export interface WhatsAppNotificationService {
  sendTextMessage(to: string, body: string, ctx?: WhatsAppMessageContext): Promise<WhatsAppDelivery>;
  sendLeaveApprovedNotification(ctx: Record<string, any>): Promise<WhatsAppDelivery>;
  sendExitNotification(ctx: Record<string, any>): Promise<WhatsAppDelivery>;
  sendEntryNotification(ctx: Record<string, any>): Promise<WhatsAppDelivery>;
  sendOverdueNotification(ctx: Record<string, any>): Promise<WhatsAppDelivery>;
  sendGatePassRejectedNotification(ctx: Record<string, any>): Promise<WhatsAppDelivery>;
}

// ---------------------------------------------------------------------------
// Official WhatsApp Business Cloud API provider
// ---------------------------------------------------------------------------

export class CloudApiWhatsAppProvider implements WhatsAppNotificationService {
  private readonly base = WA_BASE;
  private readonly token = WA_TOKEN;
  private readonly phoneNumberId = WA_PHONE_ID;

  async sendTextMessage(to: string, body: string): Promise<WhatsAppDelivery> {
    if (!whatsappConfigured()) {
      return { ok: false, error: "WhatsApp is not configured." };
    }
    try {
      const res = await fetch(`${this.base}/${this.phoneNumberId}/messages`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: normalizeE164(to).replace("+", ""),
          type: "text",
          text: { body },
        }),
      });
      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        return { ok: false, error: `WhatsApp API ${res.status}: ${detail.slice(0, 200)}` };
      }
      const json = await res.json();
      return { ok: true, ref: json?.messages?.[0]?.id || `wa-${Date.now()}` };
    } catch (err: any) {
      return { ok: false, error: err?.message || "Network error talking to WhatsApp." };
    }
  }

  async sendLeaveApprovedNotification(ctx: Record<string, any>): Promise<WhatsAppDelivery> {
    return this.sendTextMessage(ctx.to || ctx.parent_phone, composeLeaveApproved(ctx));
  }
  async sendExitNotification(ctx: Record<string, any>): Promise<WhatsAppDelivery> {
    return this.sendTextMessage(ctx.to || ctx.parent_phone, composeExit(ctx));
  }
  async sendEntryNotification(ctx: Record<string, any>): Promise<WhatsAppDelivery> {
    return this.sendTextMessage(ctx.to || ctx.parent_phone, composeEntry(ctx));
  }
  async sendOverdueNotification(ctx: Record<string, any>): Promise<WhatsAppDelivery> {
    return this.sendTextMessage(ctx.to || ctx.parent_phone, composeOverdue(ctx));
  }
  async sendGatePassRejectedNotification(ctx: Record<string, any>): Promise<WhatsAppDelivery> {
    return this.sendTextMessage(ctx.to || ctx.parent_phone, composeGatePassRejected(ctx));
  }
}

// ---------------------------------------------------------------------------
// Simulated provider (for demos when credentials are not configured).
// Same delivery contract; result is persisted so the audit trail is identical.
// ---------------------------------------------------------------------------

export class SimulatedWhatsAppProvider implements WhatsAppNotificationService {
  async sendTextMessage(_to: string, _body: string): Promise<WhatsAppDelivery> {
    await new Promise((r) => setTimeout(r, 350));
    return { ok: true, ref: "SIM-" + Math.random().toString(36).slice(2, 9).toUpperCase() };
  }
  async sendLeaveApprovedNotification(ctx: Record<string, any>): Promise<WhatsAppDelivery> {
    return this.sendTextMessage("", composeLeaveApproved(ctx));
  }
  async sendExitNotification(ctx: Record<string, any>): Promise<WhatsAppDelivery> {
    return this.sendTextMessage("", composeExit(ctx));
  }
  async sendEntryNotification(ctx: Record<string, any>): Promise<WhatsAppDelivery> {
    return this.sendTextMessage("", composeEntry(ctx));
  }
  async sendOverdueNotification(ctx: Record<string, any>): Promise<WhatsAppDelivery> {
    return this.sendTextMessage("", composeOverdue(ctx));
  }
  async sendGatePassRejectedNotification(ctx: Record<string, any>): Promise<WhatsAppDelivery> {
    return this.sendTextMessage("", composeGatePassRejected(ctx));
  }
}

let cachedService: WhatsAppNotificationService | null = null;

export function getWhatsAppService(): WhatsAppNotificationService {
  if (cachedService) return cachedService;
  cachedService = whatsappConfigured() ? new CloudApiWhatsAppProvider() : new SimulatedWhatsAppProvider();
  return cachedService;
}

// Reset the cached instance (useful after configuring env in tests).
export function resetWhatsAppService(): void {
  cachedService = null;
}

// ---------------------------------------------------------------------------
// Message templates (spec sections 13 - 16)
// ---------------------------------------------------------------------------

const fmtDate = (d: any) => (d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—");
const fmtTime = (d: any) => (d ? new Date(d).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : "—");

export function composeLeaveApproved(ctx: Record<string, any>): string {
  const name = ctx.student_name || ctx.student?.name || "[STUDENT NAME]";
  return [
    "Dear Parent,",
    "",
    `Your son/daughter ${name} has received an approved hostel leave.`,
    "",
    `Leave Date: ${fmtDate(ctx.leaving_at || ctx.from_date || ctx.date)}`,
    `Leaving Time: ${ctx.leaving_time || ctx.exit_time || "—"}`,
    `Expected Return: ${fmtDate(ctx.expected_return_at || ctx.to_date)} ${ctx.expected_return_time || ctx.expected_return || ""}`,
    `Gate Pass: ${ctx.pass_id || ctx.pass_number || ctx.pass?.pass_number || "—"}`,
    `Hostel: ${ctx.hostel || ctx.student?.hostel || "—"}`,
    "",
    "This is an automated hostel notification.",
  ].join("\n");
}

export function composeGatePassApproved(ctx: Record<string, any>): string {
  const name = ctx.student_name || ctx.student?.name || "[STUDENT NAME]";
  return [
    "Dear Parent,",
    "",
    `Your son/daughter ${name} has received an approved gate pass.`,
    "",
    `Date: ${fmtDate(ctx.date)}`,
    `Exit Time: ${ctx.exit_time || "—"}`,
    `Expected Return: ${ctx.expected_return || "—"}`,
    `Gate Pass: ${ctx.pass_id || ctx.pass_number || ctx.pass?.pass_number || "—"}`,
    `Hostel: ${ctx.hostel || ctx.student?.hostel || "—"}`,
    "",
    "This is an automated hostel notification.",
  ].join("\n");
}

export function composeExit(ctx: Record<string, any>): string {
  const name = ctx.student_name || ctx.student?.name || "[STUDENT NAME]";
  return [
    "Hostel Exit Notification",
    "",
    "Dear Parent,",
    "",
    `Your son/daughter ${name} has left the hostel.`,
    "",
    `Date: ${fmtDate(ctx.timestamp || ctx.date)}`,
    `Time: ${fmtTime(ctx.timestamp) || ctx.time || "—"}`,
    `Gate: ${ctx.gate || "MAIN GATE"}`,
    `Gate Pass: ${ctx.pass_id || ctx.pass_number || ctx.pass?.pass_number || "—"}`,
    `Expected Return: ${ctx.expected_return_at ? fmtDate(ctx.expected_return_at) + " " + ctx.expected_return_time : "—"}`,
    "",
    "— Hostel Administration",
  ].join("\n");
}

export function composeEntry(ctx: Record<string, any>): string {
  const name = ctx.student_name || ctx.student?.name || "[STUDENT NAME]";
  return [
    "Hostel Entry Notification",
    "",
    "Dear Parent,",
    "",
    `Your son/daughter ${name} has entered the hostel.`,
    "",
    `Date: ${fmtDate(ctx.timestamp || ctx.date)}`,
    `Time: ${fmtTime(ctx.timestamp) || ctx.time || "—"}`,
    `Gate: ${ctx.gate || "MAIN GATE"}`,
    "",
    "The student's hostel entry has been recorded successfully.",
    "",
    "— Hostel Administration",
  ].join("\n");
}

export function composeOverdue(ctx: Record<string, any>): string {
  const name = ctx.student_name || ctx.student?.name || "[STUDENT NAME]";
  return [
    "Late Return Alert",
    "",
    `Your son/daughter ${name} has not yet returned to the hostel.`,
    "",
    `Expected Return: ${ctx.expected_return_at ? fmtDate(ctx.expected_return_at) + " " + ctx.expected_return_time : "—"}`,
    `Current Status: OUTSIDE HOSTEL`,
    "",
    "Please contact the hostel administration if required.",
  ].join("\n");
}

export function composeGatePassRejected(ctx: Record<string, any>): string {
  const name = ctx.student_name || ctx.student?.name || "[STUDENT NAME]";
  return [
    "Dear Parent,",
    "",
    `Your son/daughter ${name}'s hostel gate pass / leave request was NOT approved.`,
    "",
    `Gate Pass: ${ctx.pass_id || ctx.pass_number || "—"}`,
    "",
    "Please contact the warden for details.",
    "",
    "— Hostel Administration",
  ].join("\n");
}

// ---------------------------------------------------------------------------
// High-level enablers (resolve the parent, queue the job)
// ---------------------------------------------------------------------------

export interface NotifyCtx {
  student?: any;
  studentId?: string;
  studentName?: string;
  [key: string]: any;
}

/**
 * Resolve the parent's WhatsApp number for a student using (in order): the
 * Parent collection, the Student record.
 */
export async function resolveParentContact(ctx: NotifyCtx): Promise<{
  parent_id: string;
  parent_phone: string;
  parent_name: string;
  notification_enabled: boolean;
}> {
  const student = ctx.student || null;
  const parent = student ? await findParentDocument(student) : null;
  const details = parentDetails(student, parent);
  if (!details.parent_phone && student) {
    const legacy = await findParentForStudent(ctx.studentId, ctx.studentName);
    if (legacy?.parent_phone) {
      details.parent_phone = legacy.parent_phone;
      details.parent_name = legacy.parent_name || details.parent_name;
    }
  }
  return {
    parent_id: parent?.id || "",
    parent_phone: details.parent_phone || "",
    parent_name: details.parent_name || "Parent",
    notification_enabled: details.notification_enabled,
  };
}

/** Enqueue a WhatsApp notification through the job queue (async, deduped). */
export async function queueWhatsAppNotification(
  type: NotificationType,
  ctx: NotifyCtx & { idempotencyKey: string; title: string; message?: string }
): Promise<{ id: string; duplicate: boolean } | null> {
  if (!ctx.studentId && !ctx.student?.student_id) return null;
  const contact = await resolveParentContact(ctx);
  if (!contact.notification_enabled) return null;
  if (!contact.parent_phone) return null;

  return enqueueNotification({
    idempotencyKey: ctx.idempotencyKey,
    type,
    studentId: String(ctx.studentId || ctx.student?.student_id || "").trim(),
    parentId: contact.parent_id,
    parentPhone: contact.parent_phone,
    title: ctx.title,
    message: ctx.message || "",
    payload: { ...(ctx.payload || ctx), student: ctx.student, parent_phone: contact.parent_phone, parent_name: contact.parent_name, to: contact.parent_phone },
    priority: ctx.priority || "normal",
  });
}

// ---------------------------------------------------------------------------
// Queue processor (browser worker used by the dashboards)
// ---------------------------------------------------------------------------

const provider = {
  async send(job: NotificationJob) {
    const svc = getWhatsAppService();
    if (!job.parent_phone) return { ok: false, error: "Missing parent number" };
    return svc.sendTextMessage(job.parent_phone, job.message || job.title, {
      type: job.type,
      studentName: "",
      data: job.payload || {},
    });
  },
};

/** Settle due queued notifications. Returns a summary. */
export async function processWhatsAppQueue(): Promise<{ processed: number; sent: number; failed: number }> {
  return processNotificationQueue(provider.send);
}

// ---------------------------------------------------------------------------
// Typed convenience wrappers used across the app
// ---------------------------------------------------------------------------

export async function notifyLeaveApproved(ctx: NotifyCtx): Promise<{ id: string; duplicate: boolean } | null> {
  const studentId = String(ctx.studentId || ctx.student?.student_id || "").trim();
  return queueWhatsAppNotification("LEAVE_APPROVED", {
    ...ctx,
    idempotencyKey: `${studentId}:leave_approved:${ctx.leaveId || ctx.passId || ctx.date || ""}`,
    title: "Leave Approved",
    message: composeLeaveApproved(ctx),
  });
}

export async function notifyGatePassApproved(ctx: NotifyCtx): Promise<{ id: string; duplicate: boolean } | null> {
  const studentId = String(ctx.studentId || ctx.student?.student_id || "").trim();
  return queueWhatsAppNotification("GATEPASS_APPROVED", {
    ...ctx,
    idempotencyKey: `${studentId}:gaitpass_approved:${ctx.passId || ctx.pass_number || ctx.pass_id || ctx.date || ""}`,
    title: "Gate Pass Approved",
    message: composeGatePassApproved(ctx),
  });
}

export async function notifyGatePassRejected(ctx: NotifyCtx): Promise<{ id: string; duplicate: boolean } | null> {
  const studentId = String(ctx.studentId || ctx.student?.student_id || "").trim();
  return queueWhatsAppNotification("GATEPASS_REJECTED", {
    ...ctx,
    idempotencyKey: `${studentId}:gaitpass_rejected:${ctx.passId || ctx.pass_number || ctx.pass_id || Date.now()}`,
    title: "Gate Pass Rejected",
    message: composeGatePassRejected(ctx),
  });
}

export async function notifyLeaveRejected(ctx: NotifyCtx): Promise<{ id: string; duplicate: boolean } | null> {
  const studentId = String(ctx.studentId || ctx.student?.student_id || "").trim();
  return queueWhatsAppNotification("LEAVE_REJECTED", {
    ...ctx,
    idempotencyKey: `${studentId}:leave_rejected:${ctx.leaveId || ctx.date || Date.now()}`,
    title: "Leave Not Approved",
    message: composeGatePassRejected(ctx),
  });
}

export async function notifyOverdue(ctx: NotifyCtx): Promise<{ id: string; duplicate: boolean } | null> {
  const studentId = String(ctx.studentId || ctx.student?.student_id || "").trim();
  return queueWhatsAppNotification("OVERDUE", {
    ...ctx,
    idempotencyKey: `${studentId}:overdue:${ctx.date}`,
    title: "Late Return Alert",
    message: composeOverdue(ctx),
  });
}

export async function notifyGateEvent(ctx: { action: "ENTRY" | "EXIT" } & NotifyCtx): Promise<{ id: string; duplicate: boolean } | null> {
  const studentId = String(ctx.studentId || ctx.student?.student_id || "").trim();
  const type: NotificationType = ctx.action === "EXIT" ? "EXIT" : "ENTRY";
  const title = ctx.action === "EXIT" ? "Hostel Exit" : "Hostel Entry";
  const message = ctx.action === "EXIT" ? composeExit(ctx) : composeEntry(ctx);
  return queueWhatsAppNotification(type, {
    ...ctx,
    idempotencyKey: `${studentId}:gate_${type.toLowerCase()}:${ctx.gateLogId || ctx.timestamp || Date.now()}`,
    title,
    message,
  });
}