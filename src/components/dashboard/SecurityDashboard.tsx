import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Users, QrCode, AlertTriangle, ArrowRightLeft, ScanLine, DoorOpen, MessageCircle } from "lucide-react";
import { subscribeCollection } from "@/lib/firestore";
import { KpiCard } from "@/components/ui/KpiCard";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import { processWhatsAppQueue } from "@/lib/whatsappNotifier";

/** Security-guard landing: today's gate traffic, live movement, overdue monitor. */
export const SecurityDashboard: React.FC = () => {
  const [students, setStudents] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [passes, setPasses] = useState<any[]>([]);

  useEffect(() => {
    const unsubs = [
      subscribeCollection("Student", setStudents),
      subscribeCollection("GateLog", setLogs),
      subscribeCollection("GatePass", setPasses),
    ];
    processWhatsAppQueue().catch(() => {});
    return () => unsubs.forEach((u) => u());
  }, []);

  const today = new Date().toISOString().slice(0, 10);
  const outside = students.filter((s) => (s.status === "outside" || s.status === "overdue") && String(s.status).toLowerCase() !== "leave");
  const outsideCount = students.filter((s) => String(s.status || "").toLowerCase() === "outside").length;
  const overdueCount = students.filter((s) => String(s.hostel_status || s.status || "").toLowerCase() === "overdue").length;
  const todayTxns = logs.filter((l) => String(l.timestamp || "").startsWith(today)).length;
  const pendingPasses = passes.filter((p) => p.status === "pending").length;

  const recentLogs = useMemo(
    () => [...logs].sort((a, b) => String(b.timestamp || "").localeCompare(String(a.timestamp || ""))).slice(0, 6),
    [logs]
  );

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <KpiCard label="Outside Right Now" value={outsideCount} icon={Users} tone="amber" />
        <KpiCard label="Overdue Alerts" value={overdueCount} icon={AlertTriangle} tone="red" />
        <KpiCard label="Transit Today" value={todayTxns} icon={ArrowRightLeft} tone="blue" />
        <KpiCard label="Pending Approvals" value={pendingPasses} icon={QrCode} tone="indigo" />
      </div>

      {/* Scanner CTA */}
      <Link
        to="/security/gate-scanner"
        className="flex items-center gap-4 rounded-2xl border border-indigo-200 bg-gradient-to-br from-indigo-600 to-indigo-700 p-4 text-white shadow-card transition hover:shadow-card-hover dark:border-indigo-900"
      >
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/15">
          <ScanLine className="h-6 w-6" />
        </span>
        <span className="flex-1">
          <span className="block text-sm font-bold">Open Gate Scanner</span>
          <span className="block text-[11px] font-semibold text-indigo-100">
            Face + QR verification · blink liveness · entry/exit logging
          </span>
        </span>
        <span className="text-2xl">→</span>
      </Link>

      {/* Live gate logs */}
      <div className="rounded-[1.25rem] border border-slate-200 bg-white p-5 shadow-card dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-4 dark:border-slate-800">
          <h3 className="flex items-center gap-2 text-base font-bold text-slate-900 dark:text-white">
            <DoorOpen className="h-5 w-5 text-emerald-600" /> Latest Gate Transactions
          </h3>
          <Link to="/security/gate-activity" className="text-xs font-bold text-indigo-600 hover:underline">
            View all →
          </Link>
        </div>
        {recentLogs.length === 0 ? (
          <EmptyState
            title="No gate activity yet"
            description="Scans done through the gate scanner will appear here in real time."
            icon={ScanLine}
          />
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {recentLogs.map((log) => (
              <div key={log.id} className="flex items-center gap-3 py-3 text-xs">
                <span
                  className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                    log.action === "EXIT" ? "bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-300" : "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-300"
                  }`}
                >
                  <ArrowRightLeft className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold text-slate-900 dark:text-white">
                    {log.student_name || "Unknown"} · {log.action === "EXIT" ? "EXIT" : "ENTRY"}
                  </p>
                  <p className="truncate text-[11px] text-slate-500">{log.gate_pass_number || "No pass"} · {log.verification_method}</p>
                </div>
                <div className="text-right">
                  {log.timestamp ? (
                    <p className="font-semibold text-slate-600 dark:text-slate-300">
                      {new Date(log.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  ) : null}
                  {log.face_match_status === "FAILED" && <p className="text-[10px] font-bold text-red-500">Face FAILED</p>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Overdue / outside monitor */}
      <div className="rounded-[1.25rem] border border-slate-200 bg-white p-5 shadow-card dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-4 dark:border-slate-800">
          <h3 className="flex items-center gap-2 text-base font-bold text-slate-900 dark:text-white">
            <AlertTriangle className="h-5 w-5 text-amber-500" /> Outside Hostel Monitor
          </h3>
          <span className="text-[11px] font-semibold text-slate-400">{outside.length} students</span>
        </div>
        {outside.length === 0 ? (
          <p className="py-4 text-center text-xs font-semibold text-slate-400">All students are accounted for inside the campus.</p>
        ) : (
          <div className="space-y-2.5">
            {outside.slice(0, 8).map((s) => (
              <div key={s.id} className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 p-3 dark:bg-slate-800/60">
                <div className="flex min-w-0 items-center gap-3">
                  {s.photo_url ? (
                    <img src={s.photo_url} alt={s.name} className="h-9 w-9 rounded-full object-cover" />
                  ) : (
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                      {String(s.name || "?").charAt(0)}
                    </span>
                  )}
                  <div className="min-w-0">
                    <p className="truncate text-xs font-bold text-slate-900 dark:text-white">
                      {s.name} <span className="font-medium text-slate-400">({s.student_id})</span>
                    </p>
                    <p className="truncate text-[11px] text-slate-500">{s.hostel} · Room {s.room}</p>
                  </div>
                </div>
                <StatusBadge status={s.hostel_status || s.status} size="sm" />
              </div>
            ))}
          </div>
        )}
        {overdueCount > 0 && (
          <div className="mt-3 flex items-center gap-2 rounded-xl bg-amber-50 p-3 text-[11px] font-semibold text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
            <MessageCircle className="h-4 w-4 shrink-0" />
            {overdueCount} student(s) past their expected return — WhatsApp alerts are being sent to parents.
          </div>
        )}
      </div>
    </div>
  );
};

export default SecurityDashboard;