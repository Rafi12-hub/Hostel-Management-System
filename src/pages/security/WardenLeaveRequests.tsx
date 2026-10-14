import React, { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarRange, MapPin, CheckCircle2, XCircle, Clock, QrCode, MessageSquareText, Loader2 } from "lucide-react";
import { subscribeCollection, updateRecord } from "@/lib/firestore";
import { useToast } from "@/components/ui/Toast";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Button } from "@/components/ui/Button";
import { findStudentByKey, createApprovedGatePass } from "@/lib/gateService";
import { notifyLeaveApproved, notifyLeaveRejected, processWhatsAppQueue } from "@/lib/whatsappNotifier";

type Tab = "pending" | "approved" | "rejected" | "all";

export default function WardenLeaveRequests() {
  const { toast } = useToast();
  const [leaves, setLeaves] = useState<any[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [tab, setTab] = useState<Tab>("pending");
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    const unsub = subscribeCollection("Leave", (d) => {
      setLeaves(d);
      setLoaded(true);
    });
    return () => unsub();
  }, []);

  const stats = useMemo(() => {
    let pending = 0;
    let approved = 0;
    let rejected = 0;
    leaves.forEach((l) => {
      if (l.status === "pending") pending++;
      else if (l.status === "approved") approved++;
      else if (l.status === "rejected") rejected++;
    });
    return { pending, approved, rejected, all: leaves.length };
  }, [leaves]);

  const visible = useMemo(() => {
    const sorted = [...leaves].sort((a, b) => String(b.from_date || "").localeCompare(String(a.from_date || "")));
    if (tab === "all") return sorted;
    return sorted.filter((l) => l.status === tab);
  }, [leaves, tab]);

  const handleApprove = useCallback(
    async (leave: any) => {
      if (busyId) return;
      setBusyId(leave.id);
      try {
        const student = await findStudentByKey(leave.student_id);
        if (!student) {
          toast("Could not find the linked student record.", "error");
          return;
        }

        await updateRecord("Leave", leave.id, { status: "approved", approved_at: new Date().toISOString() });

        // Create the secure gate pass with the leave window; only THIS pass can
        // move the student out of the hostel (face + QR at the gate).
        const pass = await createApprovedGatePass({
          student,
          passNumber: `GP-${new Date().getFullYear()}-${String(Math.floor(1000 + Math.random() * 9000))}`,
          leaveId: leave.id,
          date: leave.from_date,
          toDate: leave.to_date,
          exitTime: leave.exit_time || "09:00",
          expectedReturn: leave.expected_return || "20:00",
          reason: leave.reason,
          destination: leave.destination,
        });

        // Reflect approval in the hostel status (ON_LEAVE window).
        await updateRecord("Student", student.id, {
          status: "leave",
          hostel_status: "on_leave",
          updated_at: new Date().toISOString(),
        }).catch(() => {});

        // WhatsApp the parent (queued, deduped, retried).
        await notifyLeaveApproved({
          student,
          studentId: String(leave.student_id || "").trim(),
          studentName: leave.student_name,
          leaveId: leave.id,
          date: leave.from_date,
          leaving_at: `${leave.from_date}T${leave.exit_time || "09:00"}`,
          leaving_time: leave.exit_time || "09:00",
          expected_return_at: `${leave.to_date}T${leave.expected_return || "20:00"}`,
          expected_return_time: leave.expected_return || "20:00",
          from_date: leave.from_date,
          to_date: leave.to_date,
          exit_time: leave.exit_time || "09:00",
          expected_return: leave.expected_return || "20:00",
          destination: leave.destination,
          hostel: student.hostel,
          pass: pass,
          pass_id: pass.id,
          pass_number: pass.pass_number,
        });
        await processWhatsAppQueue().catch(() => {});

        toast("Leave approved — gate pass generated & parent notified.", "success");
      } catch (e: any) {
        toast(`Approval failed: ${e?.message || "unknown error"}`, "error");
      } finally {
        setBusyId(null);
      }
    },
    [busyId, toast]
  );

  const handleReject = useCallback(
    async (leave: any) => {
      if (busyId) return;
      setBusyId(leave.id);
      try {
        await updateRecord("Leave", leave.id, { status: "rejected", rejected_at: new Date().toISOString() });
        const student = await findStudentByKey(leave.student_id);
        await notifyLeaveRejected({
          student,
          studentId: String(leave.student_id || "").trim(),
          studentName: leave.student_name,
          leaveId: leave.id,
          date: leave.from_date,
          pass_number: "",
        }).catch(() => {});
        await processWhatsAppQueue().catch(() => {});
        toast("Leave request rejected.", "info");
      } catch (e: any) {
        toast(`Rejection failed: ${e?.message || "unknown error"}`, "error");
      } finally {
        setBusyId(null);
      }
    },
    [busyId, toast]
  );

  return (
    <div className="mx-auto max-w-3xl space-y-5 pb-4">
      <PageHeader
        title="Leave Approvals"
        subtitle="Provisional outstation leave → approved gate pass + parent notification"
      />

      {/* Tabs */}
      <div className="flex flex-wrap gap-2">
        {(
          [
            { key: "pending", label: "Pending", tone: "bg-amber-500" },
            { key: "approved", label: "Approved", tone: "bg-emerald-500" },
            { key: "rejected", label: "Rejected", tone: "bg-rose-500" },
            { key: "all", label: "All", tone: "bg-slate-400" },
          ] as const
        ).map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-bold transition ${
              tab === t.key
                ? "bg-indigo-600 text-white"
                : "bg-white text-slate-600 ring-1 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700"
            }`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${t.tone}`} />
            {t.label} · {stats[t.key as Tab]}
          </button>
        ))}
      </div>

      {!loaded ? (
        <div className="flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white p-10 text-sm font-semibold text-slate-500 dark:border-slate-800 dark:bg-slate-900">
          <Loader2 className="h-5 w-5 animate-spin text-indigo-600" /> Loading leave requests…
        </div>
      ) : visible.length === 0 ? (
        <EmptyState
          title={tab === "pending" ? "No pending leave requests" : "No requests in this view"}
          description="Students' outstation leave applications will appear here."
          icon={CalendarRange}
        />
      ) : (
        <div className="space-y-3">
          {visible.map((lv) => (
            <article key={lv.id} className="overflow-hidden rounded-[1.25rem] border border-slate-200 bg-white shadow-card dark:border-slate-800 dark:bg-slate-900">
              <div className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="mb-1 text-sm font-bold text-slate-900 dark:text-white">{lv.student_name}</p>
                    <div className="inline-flex items-center gap-2 rounded-xl bg-indigo-50 px-3 py-1.5 dark:bg-indigo-950/40">
                      <CalendarRange className="h-3.5 w-3.5 text-indigo-600" />
                      <span className="text-xs font-extrabold text-indigo-700 dark:text-indigo-300">
                        {lv.from_date} → {lv.to_date}
                      </span>
                      {lv.exit_time && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-indigo-400">
                          <Clock className="h-3 w-3" /> exit {lv.exit_time}
                        </span>
                      )}
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-3">
                      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300">
                        <MapPin className="h-3.5 w-3.5 text-teal-600" /> {lv.destination}
                      </span>
                      {lv.emergency_contact && (
                        <span className="text-[11px] font-semibold text-slate-400">Contact {lv.emergency_contact}</span>
                      )}
                    </div>
                    <p className="mt-1 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400 line-clamp-2">{lv.reason}</p>
                  </div>
                  <StatusBadge status={lv.status} size="sm" />
                </div>

                {lv.status === "approved" && (
                  <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl bg-emerald-50 p-2.5 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                    <QrCode className="h-4 w-4 shrink-0" />
                    A secure gate pass was auto-generated. Student must scan face + QR at the gate to leave.
                    <MessageSquareText className="ml-auto h-4 w-4 shrink-0" /> Parent WhatsApp sent.
                  </div>
                )}
              </div>

              {lv.status === "pending" && (
                <div className="flex items-center gap-2 border-t border-slate-100 px-4 py-3 dark:border-slate-800">
                  <Button
                    size="sm"
                    variant="success"
                    icon={CheckCircle2}
                    loading={busyId === lv.id}
                    disabled={!!busyId}
                    onClick={() => void handleApprove(lv)}
                  >
                    Approve & issue gate pass
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    icon={XCircle}
                    loading={busyId === lv.id}
                    disabled={!!busyId}
                    onClick={() => void handleReject(lv)}
                  >
                    Reject
                  </Button>
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}