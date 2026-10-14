import React, { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { QrCode, Plus, X, Clock, CheckCircle2, XCircle, ScanLine, MapPin } from "lucide-react";
import { subscribeCollection, createRecord, updateRecord } from "@/lib/firestore";
import { useDemoAuth } from "@/context/DemoAuthContext";
import { findStudentByKey, generatePassNumber, generateQrToken, gatePassQrPayload } from "@/lib/gateService";
import { notifyGatePassApproved, notifyGatePassRejected, processWhatsAppQueue } from "@/lib/whatsappNotifier";
import { QRCode } from "@/components/ui/QRCode";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { SkeletonCard } from "@/components/ui/Skeleton";

// Clean human labels + timeline step for each raw status.
const STATUS_META: Record<string, { label: string; chip: string; step: number }> = {
  pending: { label: "Pending Approval", chip: "bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300", step: 0 },
  approved: { label: "Approved", chip: "bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300", step: 1 },
  active: { label: "Active", chip: "bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300", step: 1 },
  exited: { label: "Outside", chip: "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300", step: 2 },
  overdue: { label: "Overdue", chip: "bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300", step: 2 },
  completed: { label: "Completed", chip: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300", step: 3 },
  rejected: { label: "Rejected", chip: "bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300", step: -1 },
  cancelled: { label: "Cancelled", chip: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300", step: -1 },
  expired: { label: "Expired", chip: "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300", step: -2 },
};

export default function GatePass() {
  const { user, role } = useDemoAuth();
  const [passes, setPasses] = useState<any[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  const [form, setForm] = useState({
    exit_time: "17:00",
    expected_return: "20:30",
    destination: "Nandyal Main Market",
    reason: "Purchasing project supplies & personal items",
  });

  useEffect(() => {
    const unsub = subscribeCollection("GatePass", (d) => {
      setPasses(d);
      setLoaded(true);
    });
    return () => unsub();
  }, []);

  const handleApply = async (e: React.FormEvent) => {
    e.preventDefault();
    const passId = generatePassNumber();
    const token = generateQrToken();
    await createRecord("GatePass", {
      pass_id: passId,
      pass_number: passId,
      student_id: user?.studentId || "22091A001",
      student_name: user?.name || "Aarav Reddy",
      hostel: user?.hostel || "APJ Abdul Kalam Boys Hostel (BH-1)",
      room: user?.room || "101",
      date: new Date().toISOString().split("T")[0],
      exit_time: form.exit_time,
      expected_return: form.expected_return,
      reason: form.reason,
      destination: form.destination,
      status: "pending",
      // Opaque one-time token; the real authority is this document.
      qr_token: token,
      qr_code: gatePassQrPayload(token),
      gate: "Main Security Gate 1",
      security_staff: "",
      actual_return: "",
      return_status: "pending",
      created_at: new Date().toISOString(),
    });
    setModalOpen(false);
  };

  const handleApprove = async (id: string, item: any) => {
    await updateRecord("GatePass", id, { status: "approved", approved_at: new Date().toISOString() });
    const student = await findStudentByKey(item.student_id || item.studentId).catch(() => null);
    await notifyGatePassApproved({
      student,
      studentId: item.student_id || item.studentId,
      studentName: item.student_name,
      pass: item,
      passId: id,
      pass_id: item.pass_id,
      pass_number: item.pass_number || item.pass_id,
      date: item.date,
      exit_time: item.exit_time,
      expected_return: item.expected_return,
      leaving_time: item.exit_time,
      expected_return_time: item.expected_return,
      destination: item.destination,
      hostel: item.hostel,
    });
    await processWhatsAppQueue().catch(() => {});
  };

  const handleReject = async (id: string, item: any) => {
    await updateRecord("GatePass", id, { status: "rejected", rejected_at: new Date().toISOString() });
    const student = await findStudentByKey(item.student_id || item.studentId).catch(() => null);
    await notifyGatePassRejected({
      student,
      studentId: item.student_id || item.studentId,
      studentName: item.student_name,
      pass: item,
      passId: id,
      pass_id: item.pass_id,
      pass_number: item.pass_number || item.pass_id,
      date: item.date,
      destination: item.destination,
      hostel: item.hostel,
    });
    await processWhatsAppQueue().catch(() => {});
  };

  // Students only see their own passes; staff see everything.
  const visible = useMemo(() => {
    if (role !== "student") return [...passes].sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));
    const sid = String(user?.studentId || "").trim().toUpperCase();
    return passes
      .filter((p) => String(p.student_id || "").trim().toUpperCase() === sid)
      .sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));
  }, [passes, role, user?.studentId]);

  const STAFF_WARDEN = ["warden", "admin", "chief_warden"].includes(role || "");
  const STAFF_SECURITY = ["security", "admin"].includes(role || "");

  return (
    <div className="mx-auto max-w-2xl space-y-5 pb-4">
      <PageHeader
        title="Gate Pass"
        subtitle="Digital out-pass applications, approvals & gate verification"
        actions={
          role === "student" ? (
            <button
              onClick={() => setModalOpen(true)}
              className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-indigo-700 active:scale-95 transition-all"
            >
              <Plus className="h-4 w-4" /> New Out-Pass
            </button>
          ) : null
        }
      />

      {!loaded ? (
        <div className="space-y-3"><SkeletonCard /><SkeletonCard /></div>
      ) : visible.length === 0 ? (
        <EmptyState
          title="No gate passes yet"
          description="Apply for a local out-pass whenever you step out of the hostel."
          icon={QrCode}
          action={
            role === "student" ? (
              <button
                onClick={() => setModalOpen(true)}
                className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-700"
              >
                <Plus className="h-4 w-4" /> New Out-Pass
              </button>
            ) : undefined
          }
        />
      ) : (
        <div className="space-y-3">
          {visible.map((p) => {
            const meta = STATUS_META[p.status] || STATUS_META.pending;
            const steps = ["Submitted", "Approved", "Exited", "Returned"];
            return (
              <article
                key={p.id}
                className="overflow-hidden rounded-[1.25rem] border border-slate-200 bg-white shadow-card dark:border-slate-800 dark:bg-slate-900"
              >
                {/* Card header */}
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-extrabold text-indigo-600 dark:text-indigo-400">{p.pass_id}</span>
                        <span className="text-[10px] text-slate-400">{p.date}</span>
                      </div>
                      {role !== "student" && (
                        <p className="mt-0.5 text-xs font-bold text-slate-700 dark:text-slate-200">
                          {p.student_name} · Room {p.room}
                        </p>
                      )}
                      <div className="mt-1.5 flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                        <MapPin className="h-3.5 w-3.5 text-teal-600" />
                        <p className="truncate text-xs font-semibold">{p.destination}</p>
                      </div>
                      <p className="mt-0.5 text-[11px] text-slate-400 line-clamp-1">{p.reason}</p>
                    </div>
                    <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold ${meta.chip}`}>
                      {meta.label}
                    </span>
                  </div>
                </div>

                {/* Timeline */}
                {p.status !== "rejected" ? (
                  <div className="border-t border-slate-100 px-4 py-3.5 dark:border-slate-800">
                    <div className="flex items-center">
                      {steps.map((step, i) => {
                        const isDone = meta.step >= i;
                        const isCurrent = meta.step === i && p.status !== "completed";
                        return (
                          <React.Fragment key={step}>
                            {i > 0 && (
                              <div className={`h-0.5 flex-1 rounded-full ${isDone ? "bg-indigo-500" : "bg-slate-200 dark:bg-slate-700"}`} />
                            )}
                            <div className="flex flex-col items-center px-1">
                              <span
                                className={`flex h-6 w-6 items-center justify-center rounded-full border-2 ${
                                  isDone
                                    ? "border-indigo-500 bg-indigo-500 text-white"
                                    : "border-slate-200 bg-white text-slate-400 dark:border-slate-700 dark:bg-slate-800"
                                } ${isCurrent ? "ring-4 ring-indigo-500/20" : ""}`}
                              >
                                {isDone ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Clock className="h-3 w-3" />}
                              </span>
                              <span className={`mt-1 whitespace-nowrap text-[9px] font-bold ${isDone ? "text-indigo-600 dark:text-indigo-400" : "text-slate-400"}`}>
                                {step}
                              </span>
                            </div>
                          </React.Fragment>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="border-t border-slate-100 px-4 py-3 dark:border-slate-800">
                    <div className="flex items-center gap-2 rounded-xl bg-rose-50 p-2.5 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
                      <XCircle className="h-4 w-4 shrink-0" />
                      <p className="text-[11px] font-bold">This out-pass request was not approved.</p>
                    </div>
                  </div>
                )}

                {/* Meta strip */}
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 pb-3 pt-1">
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-500">
                    <Clock className="h-3 w-3" /> Exit {p.exit_time} → Return {p.expected_return}
                  </span>
                  {p.actual_return && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-600">
                      <CheckCircle2 className="h-3 w-3" /> Returned {p.actual_return}
                    </span>
                  )}
                  {p.return_status === "late" && (
                    <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-600 dark:bg-rose-950/50 dark:text-rose-300">
                      Late return
                    </span>
                  )}
                </div>

                {/* QR for approved / outside passes */}
                {(p.status === "approved" || p.status === "active" || p.status === "exited" || p.status === "overdue") && (
                  <div className="flex items-center gap-3 border-t border-slate-100 px-4 py-3 dark:border-slate-800">
                    <div className="rounded-lg border border-slate-100 bg-white p-1.5 dark:border-slate-800 dark:bg-slate-900">
                      <QRCode value={p.qr_code || ""} size={72} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-1 text-[11px] font-bold text-slate-700 dark:text-slate-200">
                        <QrCode className="h-3.5 w-3.5 text-indigo-600" /> Gate pass QR
                      </p>
                      <p className="font-mono text-[10px] font-semibold text-indigo-600 dark:text-indigo-400">
                        {p.pass_number || p.pass_id}
                      </p>
                      <p className="mt-0.5 text-[10px] leading-relaxed text-slate-400">
                        {p.status === "exited" || p.status === "overdue"
                          ? "Keep it ready — security verifies this QR with your face when you return."
                          : "Show this QR at the main gate. Security verifies it with your face before exit."}
                      </p>
                    </div>
                  </div>
                )}

                {/* Actions */}
                {(STAFF_WARDEN && p.status === "pending" || STAFF_SECURITY) && (
                  <div className={`flex gap-2 border-t border-slate-100 p-3 dark:border-slate-800 ${p.status === "pending" && STAFF_WARDEN && STAFF_SECURITY ? "" : ""}`}>
                    {STAFF_WARDEN && p.status === "pending" && (
                      <>
                        <button
                          onClick={() => handleApprove(p.id, p)}
                          className="flex-1 rounded-xl bg-emerald-600 py-2.5 text-[11px] font-bold text-white hover:bg-emerald-700"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => handleReject(p.id, p)}
                          className="flex-1 rounded-xl bg-rose-600 py-2.5 text-[11px] font-bold text-white hover:bg-rose-700"
                        >
                          Reject
                        </button>
                      </>
                    )}
                    {STAFF_SECURITY && (p.status === "approved" || p.status === "exited") && (
                      <Link
                        to="/security/gate-scanner"
                        className="flex items-center justify-center gap-2 rounded-xl bg-indigo-600 py-2.5 text-[11px] font-bold text-white hover:bg-indigo-700 flex-1"
                      >
                        <ScanLine className="h-4 w-4" /> Scan at Gate
                      </Link>
                    )}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/60 backdrop-blur-sm sm:items-center p-4 pb-safe">
          <div className="w-full max-w-md rounded-[1.25rem] bg-white p-6 shadow-2xl dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Apply for Local Gate Pass</h3>
              <button onClick={() => setModalOpen(false)} className="text-slate-400"><X className="h-5 w-5" /></button>
            </div>
            <form onSubmit={handleApply} className="mt-4 space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Destination</label>
                <input
                  type="text"
                  required
                  value={form.destination}
                  onChange={(e) => setForm({ ...form, destination: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 p-2.5 dark:bg-slate-800 dark:text-white dark:border-slate-700"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Exit Time</label>
                  <input type="time" required value={form.exit_time}
                    onChange={(e) => setForm({ ...form, exit_time: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 p-2.5 dark:bg-slate-800 dark:text-white dark:border-slate-700" />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Expected Return</label>
                  <input type="time" required value={form.expected_return}
                    onChange={(e) => setForm({ ...form, expected_return: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 p-2.5 dark:bg-slate-800 dark:text-white dark:border-slate-700" />
                </div>
              </div>
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Reason for Out-Pass</label>
                <textarea rows={3} required value={form.reason}
                  onChange={(e) => setForm({ ...form, reason: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 p-2.5 dark:bg-slate-800 dark:text-white dark:border-slate-700" />
              </div>
              <button type="submit"
                className="w-full rounded-xl bg-indigo-600 py-3 text-xs font-bold text-white shadow-md hover:bg-indigo-700">
                Submit Gate Pass Request
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}