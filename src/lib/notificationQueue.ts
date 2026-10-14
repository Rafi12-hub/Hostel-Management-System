// Async notification queue.
//
// Gate transactions should NEVER be rolled back because a WhatsApp provider is
// down. Instead we persist a NotificationJob and settle it asynchronously:
//
//   EVENT -> NotificationJob(pending) -> provider -> SENT | FAILED(retry/backoff)
//
// Idempotency: jobs carry an idempotency_key (e.g. student_id:gate_log_id:type)
// so retries / double events never produce a duplicate WhatsApp message.
import { createRecord, filterCollection, updateRecord } from "@/lib/firestore";

export type NotificationType =
  | "LEAVE_APPROVED"
  | "LEAVE_REJECTED"
  | "GATEPASS_APPROVED"
  | "GATEPASS_REJECTED"
  | "EXIT"
  | "ENTRY"
  | "OVERDUE"
  | "BROADCAST";

export type JobStatus = "pending" | "sending" | "sent" | "failed" | "cancelled";

export interface NotificationJob {
  idempotency_key: string;
  type: NotificationType;
  student_id: string;
  parent_id: string;
  parent_phone: string;
  title: string;
  message: string;
  payload?: any;
  status: JobStatus;
  attempts: number;
  max_attempts: number;
  next_attempt_at: string;
  last_error?: string;
  provider_ref?: string;
  sent_at?: string;
  priority?: "normal" | "high" | "critical";
  created_at: string;
}

export const DEFAULT_MAX_ATTEMPTS = 5;

export function backoffDelayMs(attempt: number, base = 2500): number {
  // Exponential backoff with jitter: ~2.5s, 5s, 10s, 20s…
  const exp = Math.min(6, Math.max(0, attempt - 1));
  return base * 2 ** exp + Math.floor(Math.random() * 500);
}

/**
 * Create a notification job, honouring idempotency (a job with the same key and
 * a non-terminal state silently becomes a no-op). Every job also creates a
 * `ParentNotification` audit row for the management screens.
 */
export async function enqueueNotification(input: {
  idempotencyKey: string;
  type: NotificationType;
  studentId: string;
  parentId?: string;
  parentPhone?: string;
  title: string;
  message: string;
  payload?: any;
  priority?: "normal" | "high" | "critical";
}): Promise<{ id: string; duplicate: boolean } | null> {
  const key = String(input.idempotencyKey || "").trim();
  if (!key || !input.studentId) return null;

  const existing = await filterCollection("NotificationJob", (j: any) => {
    if (j.idempotency_key !== key) return false;
    const status = String(j.status || "");
    return status === "pending" || status === "sending" || status === "sent";
  });
  if (existing.length > 0) {
    return { id: existing[0].id, duplicate: true };
  }

  const now = new Date();
  const job = await createRecord<NotificationJob>("NotificationJob", {
    idempotency_key: key,
    type: input.type,
    student_id: input.studentId,
    parent_id: input.parentId || "",
    parent_phone: input.parentPhone || "",
    title: input.title,
    message: input.message,
    payload: input.payload || {},
    status: "pending",
    attempts: 0,
    max_attempts: DEFAULT_MAX_ATTEMPTS,
    next_attempt_at: now.toISOString(),
    priority: input.priority || "normal",
  });

  // Parent notification audit row (matches the existing collection so the
  // Parent SMS Alerts page keeps working).
  await createRecord("ParentNotification", {
    student_id: input.studentId,
    student_name: input.payload?.student?.name || "",
    hostel: input.payload?.student?.hostel || "",
    room: input.payload?.student?.room || "",
    event: input.title,
    message: input.message || input.title,
    channel: "whatsapp",
    priority: input.priority || "normal",
    status: "sending",
    job_id: job.id,
  }).catch(() => {});

  return { id: job.id, duplicate: false };
}

/**
 * Process every due job. In this client architecture this is triggered after
 * app boot + on a slow interval from the dashboards; in production this loop
 * runs in a Cloud Function/worker with the SAME contract.
 *
 * `send` is injected so this queue never imports provider internals.
 */
export async function processNotificationQueue(send: (job: NotificationJob) => Promise<{ ok: boolean; ref?: string; error?: string }>): Promise<{ processed: number; sent: number; failed: number }> {
  const now = new Date();
  const due = await filterCollection("NotificationJob", (j: any) => {
    const status = String(j.status || "");
    if (status !== "pending" && status !== "failed") return false;
    const attempts = Number(j.attempts || 0);
    const maxAttempts = Number(j.max_attempts || DEFAULT_MAX_ATTEMPTS);
    if (attempts >= maxAttempts) return false;
    if (!j.next_attempt_at) return true;
    return new Date(j.next_attempt_at).getTime() <= now.getTime();
  });

  let sent = 0;
  let failed = 0;
  for (const job of due) {
    const attempts = Number(job.attempts || 0) + 1;
    await updateRecord("NotificationJob", job.id, { status: "sending", attempts, last_error: "" }).catch(() => {});
    const delivery = await send(job);
    if (delivery.ok) {
      await updateRecord("NotificationJob", job.id, {
        status: "sent",
        provider_ref: delivery.ref || "",
        sent_at: now.toISOString(),
      }).catch(() => {});
      await filterCollection("ParentNotification", (p: any) => p.job_id === job.id)
        .then((rows) => rows.length && updateRecord("ParentNotification", rows[0].id, { status: "delivered", provider_ref: delivery.ref || "", delivered_at: now.toISOString() }))
        .catch(() => {});
      sent++;
    } else {
      const failedAttempts = attempts;
      const failedStatus: JobStatus = failedAttempts >= Number(job.max_attempts || DEFAULT_MAX_ATTEMPTS) ? "failed" : "failed";
      await updateRecord("NotificationJob", job.id, {
        status: failedStatus,
        last_error: delivery.error || "Delivery failed",
        next_attempt_at: new Date(now.getTime() + backoffDelayMs(failedAttempts)).toISOString(),
      }).catch(() => {});
      failed++;
    }
  }
  return { processed: due.length, sent, failed };
}