import React, { useState, useEffect, useMemo } from "react";
import { Plus, X, Clock, CheckCircle2, XCircle, MapPin, Phone, CalendarRange, QrCode as QrIcon } from "lucide-react";
import { subscribeCollection, createRecord, updateRecord, filterCollection } from "@/lib/firestore";
import { useDemoAuth } from "@/context/DemoAuthContext";
import { findStudentByKey, createApprovedGatePass, generatePassNumber } from "@/lib/gateService";
import { notifyLeaveApproved, notifyLeaveRejected, processWhatsAppQueue } from "@/lib/whatsappNotifier";
import { QRCode } from "@/components/ui/QRCode";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { SkeletonCard } from "@/components/ui/Skeleton";

const todayStr = () => new Date().toISOString().split("T")[0];
const threeDaysAheadStr = () =>
  new Date(Date.now() + 86400000 * 3).toISOString().split("T")[0];

const STATUS_META: Record<string, { label: string; chip: string; step: number }> = {
  pending: { label: "Pending Approval", chip: "bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300", step: 0 },
  approved: { label: "Approved", chip: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300", step: 1 },
  rejected: { label: "Rejected", chip: "bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300", step: -1 },
};

export default function Leave() {
  const { user, role } = useDemoAuth();
  const [leaves, setLeaves] = useState<any[]>([]);
  const [gatePasses, setGatePasses] = useState<any[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  const [form, setForm] = useState({
    from_date: todayStr(),
    to_date: threeDaysAheadStr(),
    reason: "Sister's Marriage Ceremony in Kurnool",
    destination: "Kurnool",
    emergency_contact: "+91 94400 12345",
  });

  useEffect(() => {
    const unsubs: (() => void)[] = [
      subscribeCollection("Leave", (d) => {
        setLeaves(d);
        setLoaded(true);
      }),
      subscribeCollection("GatePass", setGatePasses),
    ];
    return () => unsubs.forEach((u) => u());
  }, []);

  const handleApply = async (e: React.FormEvent) => {
    e.preventDefault();
    await createRecord("Leave", {
      student_id: user?.studentId || "22091A001",
      student_name: user?.name || "Aarav Reddy",
      from_date: form.from_date,
      to_date: form.to_date,
      reason: form.reason,
      destination: form.destination,
      emergency_contact: form.emergency_contact,
      status: "pending",
      exit_time: "09:00",
      expected_return: "20:00",
      created_at: new Date().toISOString(),
    });
    setModalOpen(false);
  };

  const handleApprove = async (id: string, lv: any) => {
    await updateRecord("Leave", id, { status: "approved", approved_at: new Date().toISOString() });

    const targetId = String(lv.student_id || "").trim().toUpperCase();
    if (!targetId) return;

    const students = await filterCollection("Student", (s: any) =>
      String(s.student_id || "").trim().toUpperCase() === targetId
    );
    const student = students[0] || null;
    const fallback = {
      student_id: lv.student_id,
      name: lv.student_name,
      hostel: lv.hostel || "RGMCET Hostel",
      room: lv.room || "",
    };

    // Approving a leave issues a secure one-time gate pass (face + QR at gate).
    // Guard against double-issuing if the warden already approved from the
    // dedicated Leave Approvals page.
    let pass: any = null;
    const existing = await filterCollection("GatePass", (p: any) => p.leave_request_id === id);
    if (existing.length > 0) {
      pass = existing[0];
    } else {
      const passNumber = generatePassNumber();
      pass = await createApprovedGatePass({
        student: student || fallback,
        passNumber,
        leaveId: id,
        date: lv.from_date,
        toDate: lv.to_date,
        exitTime: lv.exit_time || "09:00",
        expectedReturn: lv.expected_return || "20:00",
        reason: lv.reason,
        destination: lv.destination,
      });
    }

    if (student) {
      await updateRecord("Student", student.id, {
        status: "leave",
        hostel_status: "on_leave",
        updated_at: new Date().toISOString(),
      }).catch(() => {});
    }

    // Parent WhatsApp — queued, deduped, retried (writes ParentNotification audit too).
    await notifyLeaveApproved({
      student: student || fallback,
      studentId: String(lv.student_id || "").trim(),
      studentName: lv.student_name,
      leaveId: id,
      date: lv.from_date,
      leaving_at: `${lv.from_date}T${lv.exit_time || "09:00"}`,
      leaving_time: lv.exit_time || "09:00",
      expected_return_at: `${lv.to_date}T${lv.expected_return || "20:00"}`,
      expected_return_time: lv.expected_return || "20:00",
      from_date: lv.from_date,
      to_date: lv.to_date,
      exit_time: lv.exit_time || "09:00",
      expected_return: lv.expected_return || "20:00",
      destination: lv.destination,
      hostel: student?.hostel || lv.hostel || "",
      pass: pass,
      pass_id: pass?.id,
      pass_number: pass?.pass_number || pass?.pass_id || "",
    });
    await processWhatsAppQueue().catch(() => {});
  };

  const handleReject = async (id: string, lv: any) => {
    await updateRecord("Leave", id, { status: "rejected", rejected_at: new Date().toISOString() });
    const student = await findStudentByKey(lv.student_id).catch(() => null);
    await notifyLeaveRejected({
      student,
      studentId: String(lv.student_id || "").trim(),
      studentName: lv.student_name,
      leaveId: id,
      date: lv.from_date,
      pass_number: "",
    }).catch(() => {});
    await processWhatsAppQueue().catch(() => {});
  };

  const visible = useMemo(() => {
    if (role !== "student") return [...leaves].sort((a, b) => String(b.from_date || "").localeCompare(String(a.from_date || "")));
    const sid = String(user?.studentId || "").trim().toUpperCase();
    return leaves
      .filter((lv) => String(lv.student_id || "").trim().toUpperCase() === sid)
      .sort((a, b) => String(b.from_date || "").localeCompare(String(a.from_date || "")));
  }, [leaves, role, user?.studentId]);

  const STAFF = ["warden", "admin", "chief_warden", "hostel_office"].includes(role || "");

  return (
    <div className="mx-auto max-w-2xl space-y-5 pb-4">
      <PageHeader
        title="Outstation Leave"
        subtitle="Long-leave permissions, parental verification & warden approvals"
        actions={
          role === "student" ? (
            <button
              onClick={() => setModalOpen(true)}
              className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-indigo-700 active:scale-95 transition-all"
            >
              <Plus className="h-4 w-4" /> New Leave
            </button>
          ) : null
        }
      />

      {!loaded ? (
        <div className="space-y-3"><SkeletonCard /><SkeletonCard /></div>
      ) : visible.length === 0 ? (
        <EmptyState
          title="No leave requests yet"
          description="Planning to head home or out of town? Apply for outstation leave here."
          icon={CalendarRange}
          action={
            role === "student" ? (
              <button
                onClick={() => setModalOpen(true)}
                className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-700"
              >
                <Plus className="h-4 w-4" /> New Leave
              </button>
            ) : undefined
          }
        />
      ) : (
        <div className="space-y-3">
          {visible.map((lv) => {
            const meta = STATUS_META[lv.status] || STATUS_META.pending;
            return (
              <article
                key={lv.id}
                className="overflow-hidden rounded-[1.25rem] border border-slate-200 bg-white shadow-card dark:border-slate-800 dark:bg-slate-900"
              >
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      {role !== "student" && (
                        <p className="mb-1 text-xs font-bold text-slate-700 dark:text-slate-200">{lv.student_name}</p>
                      )}
                      {/* Date range */}
                      <div className="inline-flex items-center gap-2 rounded-xl bg-indigo-50 px-3 py-1.5 dark:bg-indigo-950/40">
                        <CalendarRange className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
                        <span className="text-xs font-extrabold text-indigo-700 dark:text-indigo-300">
                          {lv.from_date} → {lv.to_date}
                        </span>
                        <span className="text-[10px] font-semibold text-indigo-400">
                          {Math.max(1, Math.round((new Date(lv.to_date).getTime() - new Date(lv.from_date).getTime()) / 86400000) + 1)} day(s)
                        </span>
                      </div>
                      <div className="mt-2 flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                        <MapPin className="h-3.5 w-3.5 text-teal-600" />
                        <p className="text-xs font-semibold">{lv.destination}</p>
                      </div>
                      <p className="mt-0.5 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400 line-clamp-2">{lv.reason}</p>
                    </div>
                    <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold ${meta.chip}`}>
                      {meta.label}
                    </span>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl bg-slate-50 p-2.5 text-[10px] font-semibold text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
                    <span className="inline-flex items-center gap-1">
                      <Phone className="h-3 w-3" /> {lv.emergency_contact}
                    </span>
                    {lv.status === "approved" && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
                        <CheckCircle2 className="h-3 w-3" /> Parent verification required
                      </span>
                    )}
                  </div>
                  {lv.status === "approved" &&
                    (() => {
                      const lp = gatePasses.find((g: any) => g.leave_request_id === lv.id);
                      if (!lp) return null;
                      return (
                        <div className="mt-3 flex items-center gap-3 rounded-xl bg-slate-50 p-2.5 dark:bg-slate-800/60">
                          <div className="rounded-lg border border-slate-100 bg-white p-1.5 dark:border-slate-800 dark:bg-slate-900">
                            <QRCode value={lp.qr_code || ""} size={72} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="flex items-center gap-1 text-[11px] font-bold text-slate-700 dark:text-slate-200">
                              <QrIcon className="h-3.5 w-3.5 text-indigo-600" /> Leave gate pass issued
                            </p>
                            <p className="font-mono text-[10px] font-semibold text-indigo-600 dark:text-indigo-400">
                              {lp.pass_number || lp.pass_id}
                            </p>
                            <p className="mt-0.5 text-[10px] leading-relaxed text-slate-400">
                              Show this QR at the security gate — face + QR are both verified before you exit.
                            </p>
                          </div>
                        </div>
                      );
                    })()}
                </div>

                {/* Status footer + actions */}
                {lv.status !== "rejected" ? (
                  <div className="flex items-center gap-2 border-t border-slate-100 px-4 py-3 dark:border-slate-800">
                    <div className="flex items-center gap-2 flex-1">
                      {["Submitted", "Approved"].map((step, i) => {
                        const isDone = meta.step >= i;
                        return (
                          <React.Fragment key={step}>
                            {i > 0 && (
                              <div className={`h-0.5 w-8 rounded-full ${isDone ? "bg-indigo-500" : "bg-slate-200 dark:bg-slate-700"}`} />
                            )}
                            <span
                              className={`flex h-6 w-6 items-center justify-center rounded-full border-2 ${
                                isDone
                                  ? "border-indigo-500 bg-indigo-500 text-white"
                                  : "border-slate-200 bg-white text-slate-400 dark:border-slate-700 dark:bg-slate-800"
                              }`}
                            >
                              {isDone ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Clock className="h-3 w-3" />}
                            </span>
                            <span className={`text-[9px] font-bold ${isDone ? "text-indigo-600 dark:text-indigo-400" : "text-slate-400"}`}>
                              {step}
                            </span>
                          </React.Fragment>
                        );
                      })}
                    </div>
                    {STAFF && lv.status === "pending" && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleApprove(lv.id, lv)}
                          className="rounded-xl bg-emerald-600 px-4 py-2 text-[11px] font-bold text-white hover:bg-emerald-700"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => handleReject(lv.id, lv)}
                          className="rounded-xl bg-rose-600 px-4 py-2 text-[11px] font-bold text-white hover:bg-rose-700"
                        >
                          Reject
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="border-t border-slate-100 px-4 py-3 dark:border-slate-800">
                    <div className="flex items-center gap-2 rounded-xl bg-rose-50 p-2.5 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
                      <XCircle className="h-4 w-4 shrink-0" />
                      <p className="text-[11px] font-bold">This leave request was not approved.</p>
                    </div>
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
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Apply for Outstation Leave</h3>
              <button onClick={() => setModalOpen(false)} className="text-slate-400"><X className="h-5 w-5" /></button>
            </div>
            <form onSubmit={handleApply} className="mt-4 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">From Date</label>
                  <input type="date" required value={form.from_date}
                    onChange={(e) => setForm({ ...form, from_date: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 p-2.5 dark:bg-slate-800 dark:text-white dark:border-slate-700" />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">To Date</label>
                  <input type="date" required value={form.to_date}
                    onChange={(e) => setForm({ ...form, to_date: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 p-2.5 dark:bg-slate-800 dark:text-white dark:border-slate-700" />
                </div>
              </div>
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Destination City</label>
                <input type="text" required value={form.destination}
                  onChange={(e) => setForm({ ...form, destination: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 p-2.5 dark:bg-slate-800 dark:text-white dark:border-slate-700" />
              </div>
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Parent Emergency Contact</label>
                <input type="text" required value={form.emergency_contact}
                  onChange={(e) => setForm({ ...form, emergency_contact: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 p-2.5 dark:bg-slate-800 dark:text-white dark:border-slate-700" />
              </div>
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Reason for Leave</label>
                <textarea rows={3} required value={form.reason}
                  onChange={(e) => setForm({ ...form, reason: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 p-2.5 dark:bg-slate-800 dark:text-white dark:border-slate-700" />
              </div>
              <button type="submit"
                className="w-full rounded-xl bg-indigo-600 py-3 text-xs font-bold text-white shadow-md hover:bg-indigo-700">
                Submit Leave Application
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}