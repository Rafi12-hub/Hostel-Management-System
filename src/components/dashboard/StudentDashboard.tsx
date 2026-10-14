import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Bell,
  Wrench,
  QrCode,
  Utensils,
  BedDouble,
  ChevronRight,
  CalendarDays,
  CheckCircle2,
  Moon,
  Activity,
  ShieldCheck,
  RefreshCw,
} from "lucide-react";
import { useDemoAuth } from "@/context/DemoAuthContext";
import {
  subscribeCollection,
  listCollection,
} from "@/lib/firestore";
import {
  MEAL_LABELS,
  MEAL_ORDER,
  ensureMealConfig,
  getActiveMeal,
  mealPercentageInRange,
  todayStr,
  fmtHm,
  type MealConfig,
} from "@/lib/hostelService";
import { TodayMenuCard } from "@/components/dashboard/TodayMenuCard";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { SkeletonCard } from "@/components/ui/Skeleton";

function greeting(): string {
  const h = new Date().getHours();
  if (h < 5) return "Good night";
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function todayLabel(): string {
  return new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

const HOSTEL_SHORT: Record<string, string> = {
  "APJ Abdul Kalam Boys Hostel (BH-1)": "BH-1 · APJ Abdul Kalam",
  "CV Raman Boys Hostel (BH-2)": "BH-2 · CV Raman",
  "Kalpana Chawla Girls Hostel (GH-1)": "GH-1 · Kalpana Chawla",
};

const ACTIVE_STATUS = ["new", "assigned", "in_progress"];

interface QuickAction {
  label: string;
  path: string;
  icon: any;
  tone: string;
  iconBg: string;
}

const QUICK_ACTIONS: QuickAction[] = [
  {
    label: "Complaint",
    path: "/maintenance",
    icon: Wrench,
    tone: "text-amber-600 dark:text-amber-400",
    iconBg: "bg-amber-50 dark:bg-amber-950/50",
  },
  {
    label: "Outpass",
    path: "/gate-pass",
    icon: QrCode,
    tone: "text-indigo-600 dark:text-indigo-400",
    iconBg: "bg-indigo-50 dark:bg-indigo-950/50",
  },
  {
    label: "Mess",
    path: "/mess",
    icon: Utensils,
    tone: "text-emerald-600 dark:text-emerald-400",
    iconBg: "bg-emerald-50 dark:bg-emerald-950/50",
  },
  {
    label: "My Room",
    path: "/my-room",
    icon: BedDouble,
    tone: "text-sky-600 dark:text-sky-400",
    iconBg: "bg-sky-50 dark:bg-sky-950/50",
  },
];

export const StudentDashboard: React.FC = () => {
  const { user } = useDemoAuth();
  const studentId = user?.studentId || "";

  const [students, setStudents] = useState<any[]>([]);
  const [tickets, setTickets] = useState<any[]>([]);
  const [passes, setPasses] = useState<any[]>([]);
  const [leaves, setLeaves] = useState<any[]>([]);
  const [records, setRecords] = useState<any[]>([]);
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [config, setConfig] = useState<MealConfig | null>(null);
  const [now, setNow] = useState(new Date());
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let mounted = true;
    const unsubs: (() => void)[] = [];
    const sub = (name: string, fn: (d: any) => void) => {
      const u = subscribeCollection(name, fn);
      unsubs.push(u);
    };
    sub("Student", setStudents);
    sub("Maintenance", setTickets);
    sub("GatePass", setPasses);
    sub("Leave", setLeaves);
    sub("MessAttendance", setRecords);
    sub("Announcement", setAnnouncements);
    sub("Notification", setNotifications);
    listCollection("Announcement").then(() => setLoaded(true)).catch(() => setLoaded(true));
    ensureMealConfig().then((c) => mounted && setConfig(c));
    const tick = setInterval(() => setNow(new Date()), 60000);
    return () => {
      mounted = false;
      clearInterval(tick);
      unsubs.forEach((u) => u());
    };
  }, []);

  const myStudent = useMemo(
    () => students.find((s) => String(s.student_id).trim().toUpperCase() === studentId.toUpperCase()),
    [students, studentId]
  );

  const unreadCount = notifications.filter((n) => !n.read).length;

  const activePass = useMemo(() => {
    const mine = passes
      .filter((p) => String(p.student_id).trim().toUpperCase() === studentId.toUpperCase())
      .filter((p) => !["rejected", "completed", "canceled"].includes(p.status))
      .sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());
    return mine[0] || null;
  }, [passes, studentId]);

  const todayLeave = useMemo(() => {
    const today = todayStr();
    return leaves.find(
      (l) =>
        String(l.student_id).trim().toUpperCase() === studentId.toUpperCase() &&
        l.status === "approved" &&
        l.from_date <= today &&
        l.to_date >= today
    );
  }, [leaves, studentId]);

  const checkInState = (() => {
    if (todayLeave) return { text: "On Leave", tone: "warning" as const };
    if (activePass) return { text: "Currently Out", tone: "warning" as const };
    return { text: "Currently Checked In", tone: "success" as const };
  })();

  const pendingComplaints = tickets.filter(
    (t) =>
      String(t.student_id).trim().toUpperCase() === studentId.toUpperCase() &&
      ACTIVE_STATUS.includes(t.status)
  ).length;

  const attendancePct = useMemo(() => {
    const from = new Date();
    from.setDate(from.getDate() - 13);
    const pct = mealPercentageInRange(records, studentId, from.toISOString().split("T")[0], todayStr());
    return records.length ? pct : null;
  }, [records, studentId]);

  const mealsToday = useMemo(() => {
    const today = todayStr();
    return records.filter(
      (r) => String(r.student_id).trim().toUpperCase() === studentId.toUpperCase() && r.date === today
    ).length;
  }, [records, studentId]);

  const activeMeal = config ? getActiveMeal(config, now) : null;
  const nextMeal = useMemo(() => {
    if (!config) return null;
    const curMin = now.getHours() * 60 + now.getMinutes();
    for (const meal of MEAL_ORDER) {
      const t = config[meal];
      const start = Number(t.start.split(":")[0]) * 60 + Number(t.start.split(":")[1]);
      if (start > curMin) return { meal, start: t.start };
    }
    return { meal: "breakfast" as const, start: config.breakfast.start };
  }, [config, now]);

  const recentAnnouncements = useMemo(
    () =>
      [...announcements]
        .sort((a, b) => new Date(b.start_date || b.expiry_date || 0).getTime() - new Date(a.start_date || a.expiry_date || 0).getTime())
        .slice(0, 3),
    [announcements]
  );

  const bedNumber = myStudent?.bed ? String(myStudent.bed).replace(/\D+/g, "") : "";

  const overview = [
    {
      label: "Attendance",
      value: attendancePct !== null ? `${attendancePct}%` : "—",
      detail: attendancePct !== null ? `${mealsToday}/4 meals today` : "No data yet",
      tone: attendancePct !== null && attendancePct < 50 ? "text-amber-600" : "text-indigo-700 dark:text-indigo-300",
    },
    {
      label: "Mess",
      value: activeMeal ? "Active" : "Next",
      detail: activeMeal ? `${MEAL_LABELS[activeMeal.meal]} · ${fmtHm(activeMeal.timing.end)}` : nextMeal ? `${MEAL_LABELS[nextMeal.meal]} · ${fmtHm(nextMeal.start)}` : "—",
      tone: activeMeal ? "text-emerald-600" : "text-indigo-700 dark:text-indigo-300",
    },
    {
      label: "Complaints",
      value: `${pendingComplaints} Pending`,
      detail: pendingComplaints ? "Being addressed" : "Everything looks good",
      tone: pendingComplaints ? "text-amber-600" : "text-indigo-700 dark:text-indigo-300",
    },
    {
      label: "Outpass",
      value: activePass ? "Active" : "No Active Request",
      detail: activePass ? `${activePass.destination} · ${activePass.exit_time}` : "Ready when you need it",
      tone: activePass ? "text-indigo-700 dark:text-indigo-300" : "text-slate-500",
    },
  ];

  return (
    <div className="mx-auto max-w-md space-y-5 pb-4">
      {/* Greeting header */}
      <header className="flex items-center gap-3">
        <Link to="/profile" className="shrink-0">
          <img
            src={user?.avatarUrl}
            alt={user?.name}
            className="h-12 w-12 rounded-2xl border border-slate-200 object-cover shadow-sm dark:border-slate-700"
          />
        </Link>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{todayLabel()}</p>
          <h1 className="font-display text-lg font-bold leading-tight tracking-tight text-slate-900 dark:text-white truncate">
            {greeting()} 👋
          </h1>
          <p className="truncate text-sm font-medium text-indigo-600 dark:text-indigo-400">
            {user?.name}
          </p>
        </div>
        <Link
          to="/notifications"
          className="relative rounded-full border border-slate-200 bg-white p-2.5 text-slate-600 shadow-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
          aria-label="Notifications"
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white">
              {unreadCount}
            </span>
          )}
        </Link>
      </header>

      {/* Hostel info card */}
      {!loaded ? (
        <SkeletonCard />
      ) : (
        <section className="overflow-hidden rounded-[1.25rem] border border-slate-200 bg-white shadow-card dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between px-5 pt-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              My Hostel
            </p>
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold ${
                checkInState.tone === "success"
                  ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"
                  : "bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300"
              }`}
            >
              <CheckCircle2 className="h-3 w-3" />
              {checkInState.text}
            </span>
          </div>
          <p className="px-5 pt-1 text-sm font-bold text-slate-800 dark:text-slate-200">
            {HOSTEL_SHORT[user?.hostel || ""] || user?.hostel || "Hostel"}
          </p>
          <div className="mt-3 grid grid-cols-3 divide-x divide-slate-100 border-t border-slate-100 dark:divide-slate-800 dark:border-slate-800">
            <div className="px-5 py-3.5">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Block</p>
              <p className="mt-0.5 text-base font-extrabold text-slate-900 dark:text-white">
                {myStudent?.block || "—"}
              </p>
            </div>
            <div className="px-5 py-3.5">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Room</p>
              <p className="mt-0.5 text-base font-extrabold text-slate-900 dark:text-white">
                {user?.room || "—"}
              </p>
            </div>
            <div className="px-5 py-3.5">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Bed</p>
              <p className="mt-0.5 text-base font-extrabold text-slate-900 dark:text-white">
                {bedNumber ? bedNumber.padStart(2, "0") : "—"}
              </p>
            </div>
          </div>
        </section>
      )}

      {/* Quick Actions */}
      <section>
        <div className="mb-2.5 flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white">Quick Actions</h2>
          <span className="text-[10px] font-medium text-slate-400">Everything you need, one tap away</span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {QUICK_ACTIONS.map((qa) => {
            const Icon = qa.icon;
            return (
              <Link
                key={qa.label}
                to={qa.path}
                className="group flex items-center gap-3 rounded-[1.25rem] border border-slate-200 bg-white p-3.5 shadow-card transition-all hover:border-indigo-200 hover:shadow-card-hover active:scale-[0.98] dark:border-slate-800 dark:bg-slate-900 dark:hover:border-indigo-800"
              >
                <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${qa.iconBg}`}>
                  <Icon className={`h-5 w-5 ${qa.tone}`} />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-bold text-slate-900 dark:text-white">{qa.label}</span>
                  <span className="flex items-center gap-0.5 text-[10px] font-medium text-slate-400">
                    Open <ChevronRight className="h-3 w-3" />
                  </span>
                </span>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Today's Overview */}
      <section>
        <div className="mb-2.5 flex items-center justify-between">
          <h2 className="flex items-center gap-1.5 text-sm font-bold text-slate-900 dark:text-white">
            <Activity className="h-4 w-4 text-indigo-600" /> Today's Overview
          </h2>
          <button
            onClick={() => {
              listCollection("Student").then(setStudents);
              listCollection("Maintenance").then(setTickets);
            }}
            className="inline-flex items-center gap-1 rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
            aria-label="Refresh"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
        <div className="overflow-hidden rounded-[1.25rem] border border-slate-200 bg-white shadow-card dark:border-slate-800 dark:bg-slate-900">
          {overview.map((row, idx) => (
            <React.Fragment key={row.label}>
              {idx > 0 && <div className="mx-5 h-px bg-slate-100 dark:bg-slate-800" />}
              <div className="flex items-center justify-between px-5 py-3">
                <div>
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{row.label}</p>
                  <p className="mt-0.5 text-sm font-bold text-slate-900 dark:text-white">{row.value}</p>
                </div>
                <div className="text-right">
                  <p className={`text-xs font-semibold ${row.tone}`}>{row.detail}</p>
                </div>
              </div>
            </React.Fragment>
          ))}
        </div>
      </section>

      {/* Night Roll Call banner */}
      <Link
        to="/night-roll-call"
        className="flex items-center gap-3 rounded-[1.25rem] border border-indigo-100 bg-indigo-50/70 px-4 py-3 dark:border-indigo-900 dark:bg-indigo-950/40"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white">
          <Moon className="h-4.5 w-4.5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-bold text-indigo-900 dark:text-indigo-200">Night Roll Call</span>
          <span className="block truncate text-[11px] font-medium text-indigo-600 dark:text-indigo-400">
            Complete today's roll call — FRS face check-in
          </span>
        </span>
        <ChevronRight className="h-4 w-4 shrink-0 text-indigo-400" />
      </Link>

      {/* Today's menu */}
      <TodayMenuCard />

      {/* Announcements */}
      <section>
        <div className="mb-2.5 flex items-center justify-between">
          <h2 className="flex items-center gap-1.5 text-sm font-bold text-slate-900 dark:text-white">
            <CalendarDays className="h-4 w-4 text-teal-600" /> Announcements
          </h2>
          <Link to="/manage-announcements" className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400">
            View all
          </Link>
        </div>
        {recentAnnouncements.length === 0 && (
          <div className="rounded-[1.25rem] border border-dashed border-slate-300 bg-white px-5 py-6 text-center dark:border-slate-700 dark:bg-slate-900">
            <ShieldCheck className="mx-auto h-6 w-6 text-slate-300" />
            <p className="mt-2 text-xs font-semibold text-slate-500 dark:text-slate-400">No announcements right now</p>
          </div>
        )}
        <div className="space-y-2.5">
          {recentAnnouncements.map((ann) => (
            <Link
              key={ann.id}
              to="/manage-announcements"
              className="block rounded-[1.25rem] border border-slate-200 bg-white p-4 shadow-card transition-all hover:border-indigo-200 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-indigo-800"
            >
              <div className="flex items-center justify-between gap-3">
                <h3 className="min-w-0 flex-1 truncate text-sm font-bold text-slate-900 dark:text-white">
                  {ann.title}
                </h3>
                {ann.category && <StatusBadge status={ann.category} size="sm" />}
              </div>
              <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                {ann.description}
              </p>
              <p className="mt-2 text-[10px] font-medium text-slate-400">
                {ann.start_date ? new Date(ann.start_date).toLocaleDateString("en-US", { day: "numeric", month: "short" }) : ""}
              </p>
            </Link>
          ))}
        </div>
      </section>

      {/* Bottom spacer handled by layout bottom padding */}
      <div className="h-2" />
    </div>
  );
};

export default StudentDashboard;