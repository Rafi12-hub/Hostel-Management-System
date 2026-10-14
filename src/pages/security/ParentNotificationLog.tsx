import React, { useEffect, useMemo, useState } from "react";
import { MessageSquareText, CheckCircle2, XCircle, Clock, Loader2, RefreshCw } from "lucide-react";
import { subscribeCollection } from "@/lib/firestore";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { processWhatsAppQueue } from "@/lib/whatsappNotifier";
import { useToast } from "@/components/ui/Toast";

type JobFilter = "all" | "sent" | "pending" | "failed";

export default function ParentNotificationLog() {
  const { toast } = useToast();
  const [jobs, setJobs] = useState<any[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [filter, setFilter] = useState<JobFilter>("all");
  const [settling, setSettling] = useState(false);

  useEffect(() => {
    const unsubs: (() => void)[] = [];
    unsubs.push(subscribeCollection("NotificationJob", setJobs));
    setLoaded(true);
    return () => unsubs.forEach((u) => u());
  }, []);

  const stats = useMemo(() => {
    return {
      pending: jobs.filter((j) => j.status === "pending" || j.status === "sending").length,
      sent: jobs.filter((j) => j.status === "sent").length,
      failed: jobs.filter((j) => j.status === "failed").length,
    };
  }, [jobs]);

  const visible = useMemo(() => {
    const sorted = [...jobs].sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || "")));
    if (filter === "all") return sorted;
    return sorted.filter((j) => j.status === filter);
  }, [jobs, filter]);

  const settleQueue = async () => {
    setSettling(true);
    try {
      const res = await processWhatsAppQueue();
      toast(`Queue settled: ${res.sent} sent, ${res.failed} failed.`, res.failed ? "info" : "success");
    } catch {
      toast("Could not settle the queue right now.", "error");
    } finally {
      setSettling(false);
    }
  };

  const jobColor = (status: string) =>
    status === "sent" ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300" : status === "failed" ? "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300" : "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300";

  return (
    <div className="mx-auto max-w-4xl space-y-5 pb-4">
      <PageHeader
        title="Parent Notification Log"
        subtitle="Async WhatsApp gateway — idempotent jobs with retries & full audit trail"
        actions={
          <Button variant="secondary" size="sm" icon={RefreshCw} loading={settling} onClick={() => void settleQueue()}>
            Settle queue
          </Button>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        {(
          [
            { key: "all", label: "All" },
            { key: "pending", label: "Pending / retrying" },
            { key: "sent", label: "Delivered" },
            { key: "failed", label: "Failed" },
          ] as const
        ).map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`rounded-full px-3 py-1.5 text-[11px] font-bold transition ${
              filter === f.key
                ? "bg-indigo-600 text-white"
                : "bg-white text-slate-600 ring-1 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700"
            }`}
          >
            {f.label} · {f.key === "all" ? jobs.length : stats[f.key as Exclude<JobFilter, "all">]}
          </button>
        ))}
        <span className="ml-auto inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-400">
          <MessageSquareText className="h-3.5 w-3.5" /> jobs: {stats.pending} queued · {stats.sent} sent · {stats.failed} failed
        </span>
      </div>

      {!loaded ? (
        <div className="flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white p-10 text-sm font-semibold text-slate-500 dark:border-slate-800 dark:bg-slate-900">
          <Loader2 className="h-5 w-5 animate-spin text-indigo-600" /> Loading notification jobs…
        </div>
      ) : visible.length === 0 ? (
        <EmptyState
          title="No notification jobs yet"
          description="Leave approvals, gate exits/entries and overdue alerts enqueue jobs here."
          icon={MessageSquareText}
        />
      ) : (
        <div className="space-y-3">
          {visible.map((j) => (
            <article key={j.id} className="rounded-[1.25rem] border border-slate-200 bg-white p-4 shadow-card dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${jobColor(j.status)}`}>
                      {j.status === "sent" ? <CheckCircle2 className="h-3 w-3" /> : j.status === "failed" ? <XCircle className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                      {String(j.status || "pending").toUpperCase()}
                    </span>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500 dark:bg-slate-800 dark:text-slate-300">
                      {j.type}
                    </span>
                    <span className="text-[10px] font-semibold text-slate-400">
                      attempts {j.attempts}/{j.max_attempts || 5}
                    </span>
                  </div>
                  <p className="mt-1.5 text-sm font-bold text-slate-900 dark:text-white">{j.title}</p>
                  <p className="mt-0.5 text-xs font-semibold text-slate-500 dark:text-slate-400">
                    Student {j.student_id} · to +{String(j.parent_phone || "").replace(/^\+/, "") || "unknown"}
                  </p>
                  {j.message && <p className="mt-1.5 whitespace-pre-line rounded-xl bg-slate-50 p-2.5 text-[11px] leading-relaxed text-slate-600 dark:bg-slate-800/60 dark:text-slate-300">{j.message}</p>}
                  {j.last_error && <p className="mt-1 text-[11px] font-semibold text-rose-600">Last error: {j.last_error}</p>}
                </div>
                <div className="shrink-0 text-right text-[10px] font-semibold text-slate-400">
                  {j.created_at ? new Date(j.created_at).toLocaleString([], { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "—"}
                  {j.sent_at && <p className="mt-0.5 text-emerald-600">sent {new Date(j.sent_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</p>}
                  {j.provider_ref && <p className="mt-0.5">ref {j.provider_ref}</p>}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}