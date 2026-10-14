import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Users,
  ArrowRightLeft,
  Fingerprint,
  MessageSquareText,
  AlertTriangle,
  RefreshCw,
  DoorOpen,
  ScanLine,
  Upload,
  BarChart3,
  PieChart,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  PieChart as RePieChart,
  Pie,
  Cell,
} from "recharts";
import { subscribeCollection } from "@/lib/firestore";
import { KpiCard } from "@/components/ui/KpiCard";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import { hostelStatusLabel } from "@/lib/gateService";
import { processWhatsAppQueue } from "@/lib/whatsappNotifier";
import { runOverdueCheck } from "@/lib/overdueService";

const STATUS_PIE_COLORS: Record<string, string> = {
  inside: "#10b981",
  outside: "#f59e0b",
  on_leave: "#3b82f6",
  overdue: "#ef4444",
  unknown: "#a855f7",
};

/** Admin / warden security command center: KPIs, trends, queue, logs. */
export const AdminSecurityDashboard: React.FC = () => {
  const [students, setStudents] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [jobs, setJobs] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    const unsubs = [
      subscribeCollection("Student", setStudents),
      subscribeCollection("GateLog", setLogs),
      subscribeCollection("NotificationJob", setJobs),
    ];
    processWhatsAppQueue().catch(() => {});
    return () => unsubs.forEach((u) => u());
  }, []);

  const totalStudents = students.length;
  const outsideCount = students.filter((s) => String(s.hostel_status || s.status || "").toLowerCase() === "outside").length;
  const overdueCount = students.filter((s) => String(s.hostel_status || s.status || "").toLowerCase() === "overdue").length;
  const onLeaveCount = students.filter((s) => String(s.hostel_status || s.status || "").toLowerCase() === "on_leave").length;
  const enrolledFaces = students.filter((s) => s.face_enrolled || s.faceDescriptor).length;

  const today = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }, []);
  const todayTxns = logs.filter((l) => String(l.timestamp || "").startsWith(today));
  const exitsToday = todayTxns.filter((l) => l.action === "EXIT").length;
  const entriesToday = todayTxns.filter((l) => l.action === "ENTRY").length;

  const queuePending = jobs.filter((j) => j.status === "pending" || j.status === "sending").length;
  const queueSent = jobs.filter((j) => j.status === "sent").length;
  const queueFailed = jobs.filter((j) => j.status === "failed").length;

  // 7-day entry/exit trend from GateLog.
  const trend = useMemo(() => {
    const days: { label: string; entries: number; exits: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const dayLogs = logs.filter((l) => String(l.timestamp || "").startsWith(key));
      days.push({
        label: d.toLocaleDateString([], { weekday: "short", day: "numeric" }),
        entries: dayLogs.filter((l) => l.action === "ENTRY").length,
        exits: dayLogs.filter((l) => l.action === "EXIT").length,
      });
    }
    return days;
  }, [logs]);

  // hostel_status distribution pie.
  const statusDist = useMemo(() => {
    const counts: Record<string, number> = { inside: 0, outside: 0, on_leave: 0, overdue: 0, unknown: 0 };
    students.forEach((s) => {
      const k = String(s.hostel_status || "").toLowerCase();
      counts[k in counts ? k : "unknown"] += 1;
    });
    return Object.entries(counts)
      .filter(([, v]) => v > 0)
      .map(([name, value]) => ({ name: hostelStatusLabel(name), key: name, value }));
  }, [students]);

  const recentLogs = useMemo(
    () => [...logs].sort((a, b) => String(b.timestamp || "").localeCompare(String(a.timestamp || ""))).slice(0, 8),
    [logs]
  );

  const triggerOverdueCheck = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    setNotice(null);
    try {
      const res = await runOverdueCheck();
      await processWhatsAppQueue();
      setNotice(`Overdue scan complete: ${res.overdue} overdue, ${res.alertsQueued} parent alerts queued.`);
    } catch (e: any) {
      setNotice(`Overdue scan failed: ${e?.message || "unknown error"}`);
    } finally {
      setBusy(false);
    }
  }, [busy]);

  const triggerQueue = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    setNotice(null);
    try {
      const res = await processWhatsAppQueue();
      setNotice(`Notification queue settled: ${res.sent} sent, ${res.failed} failed (${res.processed} processed).`);
    } catch (e: any) {
      setNotice(`Queue process failed: ${e?.message || "unknown error"}`);
    } finally {
      setBusy(false);
    }
  }, [busy]);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <KpiCard label="Outside Now" value={outsideCount} icon={Users} tone="amber" />
        <KpiCard label="Transit Today" value={todayTxns.length} icon={ArrowRightLeft} tone="blue" sub={`${exitsToday} exits · ${entriesToday} entries`} />
        <KpiCard label="On Leave" value={onLeaveCount} icon={ArrowRightLeft} tone="indigo" />
        <KpiCard label="Face Enrolled" value={enrolledFaces} icon={Fingerprint} tone="green" sub={`${totalStudents} residents`} />
      </div>

      {/* Overdue / queue strip */}
      {(overdueCount > 0 || queuePending > 0 || queueFailed > 0) && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {overdueCount > 0 && (
            <Link to="/security/gate-activity" className="flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs dark:border-amber-800 dark:bg-amber-950/30">
              <AlertTriangle className="h-6 w-6 shrink-0 text-amber-600" />
              <span className="font-bold text-amber-800 dark:text-amber-200">
                {overdueCount} student(s) overdue — {outsideCount} still outside.
              </span>
            </Link>
          )}
          {queuePending > 0 && (
            <div className="flex items-center gap-3 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-xs dark:border-blue-800 dark:bg-blue-950/30">
              <MessageSquareText className="h-6 w-6 shrink-0 text-blue-600" />
              <span className="font-bold text-blue-800 dark:text-blue-200">
                {queuePending} parent alert(s) waiting in the WhatsApp queue.
              </span>
            </div>
          )}
          {queueFailed > 0 && (
            <div className="flex items-center gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-xs dark:border-red-800 dark:bg-red-950/30">
              <AlertTriangle className="h-6 w-6 shrink-0 text-red-600" />
              <span className="font-bold text-red-800 dark:text-red-200">
                {queueFailed} notification(s) failed after retries.
              </span>
            </div>
          )}
        </div>
      )}

      {/* Charts + quick actions */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <div className="rounded-[1.25rem] border border-slate-200 bg-white p-5 shadow-card dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-4 dark:border-slate-800">
            <h3 className="flex items-center gap-2 text-base font-bold text-slate-900 dark:text-white">
              <BarChart3 className="h-5 w-5 text-indigo-600" /> Entry / Exit Traffic (7 days)
            </h3>
            <Link to="/security/gate-activity" className="text-xs font-bold text-indigo-600 hover:underline">Details →</Link>
          </div>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={trend}>
                <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-slate-200 dark:text-slate-700" />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} stroke="currentColor" className="text-slate-400" />
                <YAxis allowDecimals={false} tick={{ fontSize: 10 }} stroke="currentColor" className="text-slate-400" />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 12 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="entries" name="Entries" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="exits" name="Exits" fill="#f59e0b" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-[1.25rem] border border-slate-200 bg-white p-5 shadow-card dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-4 dark:border-slate-800">
            <h3 className="flex items-center gap-2 text-base font-bold text-slate-900 dark:text-white">
              <PieChart className="h-5 w-5 text-emerald-600" /> Student Movement Status
            </h3>
          </div>
          {statusDist.length === 0 ? (
            <EmptyState title="No students yet" description="Student records will populate this chart." />
          ) : (
            <div className="flex items-center gap-5">
              <div className="h-44 w-44 shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <RePieChart>
                    <Pie data={statusDist} dataKey="value" nameKey="name" innerRadius={42} outerRadius={70} paddingAngle={2}>
                      {statusDist.map((s) => (
                        <Cell key={s.key} fill={STATUS_PIE_COLORS[s.key] || "#a855f7"} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ fontSize: 12, borderRadius: 12 }} />
                  </RePieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex-1 space-y-1.5">
                {statusDist.map((s) => (
                  <div key={s.key} className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1.5 font-semibold text-slate-600 dark:text-slate-300">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: STATUS_PIE_COLORS[s.key] || "#a855f7" }} />
                      {s.name}
                    </span>
                    <span className="font-bold text-slate-900 dark:text-white">{s.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-2.5">
        <button
          onClick={() => void triggerOverdueCheck()}
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-xl bg-amber-600 px-4 py-2.5 text-xs font-bold text-white transition hover:bg-amber-700 disabled:opacity-60"
        >
          {busy ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} Run Overdue Check
        </button>
        <button
          onClick={() => void triggerQueue()}
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-bold text-white transition hover:bg-indigo-700 disabled:opacity-60"
        >
          {busy ? <RefreshCw className="h-4 w-4 animate-spin" /> : <MessageSquareText className="h-4 w-4" />} Settle WhatsApp Queue
        </button>
        <Link
          to="/security/gate-scanner"
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
        >
          <ScanLine className="h-4 w-4" /> Gate Scanner
        </Link>
        <span className="text-[11px] font-semibold text-slate-400">
          WhatsApp: {queuePending} pending · {queueSent} sent · {queueFailed} failed
        </span>
      </div>
      {notice && <p className="rounded-xl bg-slate-100 px-3 py-2 text-[11px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">{notice}</p>}

      {/* Recent gate logs */}
      <div className="rounded-[1.25rem] border border-slate-200 bg-white p-5 shadow-card dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-4 dark:border-slate-800">
          <h3 className="flex items-center gap-2 text-base font-bold text-slate-900 dark:text-white">
            <DoorOpen className="h-5 w-5 text-emerald-600" /> Audit Trail — Recent Gate Logs
          </h3>
          <Link to="/security/gate-activity" className="text-xs font-bold text-indigo-600 hover:underline">Full log →</Link>
        </div>
        {recentLogs.length === 0 ? (
          <EmptyState title="No gate logs yet" description="Verified scans are recorded here as append-only entries." icon={ScanLine} />
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {recentLogs.map((log) => (
              <div key={log.id} className="flex items-center gap-3 py-3 text-xs">
                <span className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${log.action === "EXIT" ? "bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-300" : "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-300"}`}>
                  <ArrowRightLeft className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold text-slate-900 dark:text-white">
                    {log.student_name} · <StatusBadge status={log.action === "EXIT" ? "outside" : "inside"} size="sm" />
                  </p>
                  <p className="truncate text-[11px] text-slate-500">
                    {log.gate_pass_number || "manual"} · {log.verification_method} · {log.face_match_status === "FAILED" ? "face failed" : "face ok"}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="font-semibold text-slate-600 dark:text-slate-300">
                    {log.timestamp ? new Date(log.timestamp).toLocaleString([], { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "—"}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminSecurityDashboard;