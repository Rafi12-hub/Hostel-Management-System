import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Users,
  QrCode,
  CalendarCheck,
  Wrench,
  UserCheck,
  Activity,
  BedDouble,
  Megaphone,
  ShieldCheck,
  Plus,
  Sparkles,
} from "lucide-react";
import { useDemoAuth } from "@/context/DemoAuthContext";
import { listCollection } from "@/lib/firestore";
import { KpiCard } from "@/components/ui/KpiCard";
import { PageHeader } from "@/components/ui/PageHeader";
import { StudentDashboard } from "@/components/dashboard/StudentDashboard";
import { NightRollCallWardenOverview } from "@/components/nightRollCall/NightRollCallWardenOverview";
import { ParentDashboard } from "@/components/dashboard/ParentDashboard";
import { MessManagePanel } from "@/components/dashboard/MessManagePanel";
import { WardenMessSummary } from "@/components/dashboard/WardenMessSummary";
import { WardenFeedbackHub } from "@/components/dashboard/WardenFeedbackHub";
import { AdminMessAnalytics } from "@/components/dashboard/AdminMessAnalytics";
import { SecurityDashboard } from "@/components/dashboard/SecurityDashboard";
import { AdminSecurityDashboard } from "@/components/dashboard/AdminSecurityDashboard";

export default function Dashboard() {
  const { user, role } = useDemoAuth();
  const navigate = useNavigate();
  const [students, setStudents] = useState<any[]>([]);
  const [gatePasses, setGatePasses] = useState<any[]>([]);
  const [maintenance, setMaintenance] = useState<any[]>([]);
  const [activityLogs, setActivityLogs] = useState<any[]>([]);

  useEffect(() => {
    listCollection("Student").then(setStudents);
    listCollection("GatePass").then(setGatePasses);
    listCollection("Maintenance").then(setMaintenance);
    listCollection("ActivityLog", { limit: 6 }).then(setActivityLogs);
  }, []);

  const totalStudents = students.length;
  const outsideCount = students.filter((s) => s.status === "outside").length;
  const leaveCount = students.filter((s) => s.status === "leave").length;
  const presentCount = Math.max(0, totalStudents - outsideCount - leaveCount);

  const pendingPasses = gatePasses.filter((g) => g.status === "pending").length;
  const openTickets = maintenance.filter((m) => m.status !== "closed" && m.status !== "completed").length;

  const quickActions = [
    { label: "Add Student", path: "/students", icon: Plus, tone: "bg-indigo-50 text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-300" },
    { label: "Allocate Room", path: "/room-availability", icon: BedDouble, tone: "bg-sky-50 text-sky-600 dark:bg-sky-950/50 dark:text-sky-300" },
    { label: "Approve Passes", path: "/gate-pass", icon: QrCode, tone: "bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-300" },
    { label: "Record Attendance", path: "/attendance", icon: UserCheck, tone: "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-300" },
    { label: "Post Announcement", path: "/manage-announcements", icon: Megaphone, tone: "bg-purple-50 text-purple-600 dark:bg-purple-950/50 dark:text-purple-300" },
    { label: "Maintenance", path: "/maintenance", icon: Wrench, tone: "bg-rose-50 text-rose-600 dark:bg-rose-950/50 dark:text-rose-300" },
  ];

  // Wrapper components render their own headers — page keeps a single max-width
  // column for the student-first mobile shell.
  return (
    <div className="pb-4">
      {/* ----------------- STUDENT VIEW ----------------- */}
      {role === "student" && <StudentDashboard />}

      {/* ----------------- PARENT VIEW ----------------- */}
      {role === "parent" && (
        <div className="mx-auto max-w-md space-y-5">
          <ParentDashboard />
        </div>
      )}

      {/* ----------------- SECURITY VIEW ----------------- */}
      {role === "security" && (
        <div className="mx-auto max-w-6xl space-y-6">
          <PageHeader
            title={`Welcome, ${user?.name}`}
            subtitle={`${user?.roleTitle} · RGMCET Hostel Hub`}
          />
          <SecurityDashboard />
        </div>
      )}

      {/* ----------------- WARDEN VIEW ----------------- */}
      {role === "warden" && (
        <div className="mx-auto max-w-6xl space-y-6">
          <PageHeader
            title={`Welcome, ${user?.name}`}
            subtitle={`${user?.roleTitle} · RGMCET Hostel Hub`}
          />
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-600/10 px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-wider text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300">
              <ShieldCheck className="h-3.5 w-3.5" /> Role: {role?.toUpperCase()}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600/10 px-3 py-1.5 text-[11px] font-bold text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300">
              <Users className="h-3.5 w-3.5" /> {students.length} Residents
            </span>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4">
            <KpiCard label="Present Residents" value={presentCount} icon={UserCheck} tone="green" />
            <KpiCard label="Outside Campus" value={outsideCount} icon={Users} tone="amber" />
            <KpiCard label="On Official Leave" value={leaveCount} icon={CalendarCheck} tone="blue" />
            <KpiCard label="Open Maintenance" value={openTickets} icon={Wrench} tone="purple" />
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <NightRollCallWardenOverview />

            <div className="rounded-[1.25rem] border border-slate-200 bg-white p-6 shadow-card dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4 dark:border-slate-800 mb-4">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Pending Gate Pass Approvals</h3>
                <Link to="/gate-pass" className="text-xs font-bold text-indigo-600 hover:underline">Review All ({pendingPasses}) →</Link>
              </div>
              <p className="text-xs text-slate-500">Approve or reject student out-pass requests with one click.</p>
            </div>
          </div>

          <AdminSecurityDashboard />

          <WardenMessSummary />

          <WardenFeedbackHub />
        </div>
      )}

      {/* ----------------- MESS MANAGER VIEW ----------------- */}
      {role === "mess_manager" && (
        <div className="mx-auto max-w-5xl">
          <MessManagePanel />
        </div>
      )}

      {/* ----------------- ADMIN / MANAGEMENT / PRINCIPAL COMMAND CENTER ----------------- */}
      {(role === "admin" || role === "management" || role === "principal" || role === "chief_warden" || role === "hostel_office" || role === "housekeeping" || role === "medical") && (
        <div className="mx-auto max-w-6xl space-y-5 sm:space-y-6">
          <PageHeader
            title={`Welcome, ${user?.name}`}
            subtitle={`${user?.roleTitle} · RGMCET Hostel Hub`}
          />
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-600/10 px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-wider text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300">
              <ShieldCheck className="h-3.5 w-3.5" /> Role: {role?.toUpperCase()}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600/10 px-3 py-1.5 text-[11px] font-bold text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300">
              <Users className="h-3.5 w-3.5" /> {students.length} Residents
            </span>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4">
            <KpiCard label="Total Enrolled Students" value={totalStudents} icon={Users} tone="indigo" sub="Across 3 Hostels" onClick={() => navigate("/students")} />
            <KpiCard label="Present in Hostel" value={presentCount} icon={UserCheck} tone="green" sub={`${totalStudents ? Math.round((presentCount/totalStudents)*100) : 0}% occupancy`} onClick={() => navigate("/attendance")} />
            <KpiCard label="Pending Gate Passes" value={pendingPasses} icon={QrCode} tone="amber" sub="Awaiting approval" onClick={() => navigate("/gate-pass")} />
            <KpiCard label="Open Maintenance SLA" value={openTickets} icon={Wrench} tone="purple" sub="Open requests" onClick={() => navigate("/maintenance")} />
          </div>

          {/* Quick Actions */}
          <div className="rounded-[1.25rem] border border-slate-200 bg-white p-4 shadow-card dark:border-slate-800 dark:bg-slate-900 sm:p-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-sm font-extrabold uppercase tracking-wider text-slate-900 dark:text-white">
                <Sparkles className="h-4 w-4 text-indigo-600" /> Quick Actions
              </h3>
              <span className="text-[11px] font-semibold text-slate-400">Tap to jump</span>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {quickActions.map((qa) => {
                const Icon = qa.icon;
                return (
                  <button
                    key={qa.label}
                    onClick={() => navigate(qa.path)}
                    className="flex flex-col items-start gap-2.5 rounded-2xl border border-slate-100 bg-slate-50 p-3.5 text-left transition-all active:scale-[0.98] hover:border-indigo-200 hover:bg-white dark:border-slate-800 dark:bg-slate-800/60 dark:hover:bg-slate-800"
                  >
                    <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${qa.tone}`}>
                      <Icon className="h-4.5 w-4.5" />
                    </span>
                    <span className="text-xs font-bold leading-tight text-slate-800 dark:text-slate-100">
                      {qa.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <AdminSecurityDashboard />

          {/* Activity Log Feed */}
          <div className="rounded-[1.25rem] border border-slate-200 bg-white p-4 shadow-card dark:border-slate-800 dark:bg-slate-900 sm:p-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 dark:border-slate-800 mb-4">
              <h3 className="flex items-center gap-2 text-base font-bold text-slate-900 dark:text-white">
                <Activity className="h-5 w-5 text-indigo-600" />
                Live System Audit & Activity Feed
              </h3>
              <Link to="/audit-logs" className="text-xs font-bold text-indigo-600 hover:underline">
                Full Log →
              </Link>
            </div>

            <div className="space-y-2.5">
              {activityLogs.length === 0 ? (
                <p className="py-6 text-center text-xs font-semibold text-slate-400">
                  No activity recorded yet.
                </p>
              ) : (
                activityLogs.map((log) => (
                  <div key={log.id} className="flex items-start justify-between gap-3 rounded-xl bg-slate-50 p-3 text-xs dark:bg-slate-800/60">
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-x-2 font-bold text-slate-900 dark:text-white">
                        <span className="truncate">{log.user}</span>
                        <span className="shrink-0 text-[10px] font-medium text-slate-400">({log.role})</span>
                      </p>
                      <p className="mt-0.5 break-words text-slate-600 dark:text-slate-300">{log.action}</p>
                    </div>
                    <span className="shrink-0 text-[10px] text-slate-400">
                      {new Date(log.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ----------------- MESS ANALYTICS (ADMIN / CHIEF WARDEN / MANAGEMENT / PRINCIPAL) ----------------- */}
      {(role === "admin" || role === "chief_warden" || role === "management" || role === "principal") && (
        <div className="mx-auto max-w-6xl">
          <AdminMessAnalytics />
        </div>
      )}
    </div>
  );
}