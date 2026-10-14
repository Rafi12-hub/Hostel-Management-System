import React, { useEffect, useMemo, useState } from "react";
import { Users, Utensils, Clock, ArrowRightLeft, CalendarCheck, CheckCircle2 } from "lucide-react";
import { filterCollection, subscribeCollection } from "@/lib/firestore";
import { useDemoAuth } from "@/context/DemoAuthContext";
import { KpiCard } from "@/components/ui/KpiCard";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  MEAL_ORDER,
  MEAL_LABELS,
  MEAL_EMOJIS,
  mealMapForDay,
  completedMealCountForDay,
  mealPercentageInRange,
  todayStr,
} from "@/lib/hostelService";

const last7 = () => {
  const d = new Date();
  d.setDate(d.getDate() - 6);
  return todayStr(d);
};

export const ParentDashboard: React.FC = () => {
  const { user } = useDemoAuth();
  const studentId = user?.studentId || "";

  const [student, setStudent] = useState<any>(null);
  const [records, setRecords] = useState<any[]>([]);
  const [gatePasses, setGatePasses] = useState<any[]>([]);
  const [leaves, setLeaves] = useState<any[]>([]);
  const [today, setToday] = useState(todayStr());

  useEffect(() => {
    if (!studentId) return;
    filterCollection("Student", (s: any) =>
      String(s.student_id || "").trim().toUpperCase() === studentId.trim().toUpperCase()
    ).then((rows) => setStudent(rows[0] || null));
    const unsubMsgs = subscribeCollection("MessAttendance", setRecords);
    const unsubG = subscribeCollection("GatePass", setGatePasses);
    const unsubL = subscribeCollection("Leave", setLeaves);
    const tick = setInterval(() => setToday(todayStr()), 60000);
    return () => {
      unsubMsgs();
      unsubG();
      unsubL();
      clearInterval(tick);
    };
  }, [studentId]);

  const map = useMemo(() => mealMapForDay(records, studentId, today), [records, studentId, today]);
  const done = completedMealCountForDay(records, studentId, today);
  const pct7 = mealPercentageInRange(records, studentId, last7(), today);

  const myHolidays =
    gatePasses.filter(
      (g) => String(g.student_id || "").trim().toUpperCase() === studentId.trim().toUpperCase()
    ) || [];
  const myLeaves =
    leaves.filter(
      (l) => String(l.student_id || "").trim().toUpperCase() === studentId.trim().toUpperCase()
    ) || [];
  const activePass = myHolidays.find(
    (g) => g.date === today && g.status !== "completed" && (g.status === "approved" || g.status === "exited")
  );
  const activeLeave = myLeaves.find(
    (l) => l.status === "approved" && l.from_date <= today && l.to_date >= today
  );

  if (!studentId) {
    return (
      <EmptyState
        icon={Users}
        title="No linked student"
        description="This Parent account is not linked to a student. Ask the administrator to link a student ID."
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Child's Today's Meals" value={`${done} / ${MEAL_ORDER.length}`} icon={Utensils} tone="green" sub="Breakfast · Lunch · Snacks · Dinner" />
        <KpiCard label="Attendance (7 days)" value={`${pct7}%`} icon={Clock} tone="indigo" sub="Meals attended in the last week" />
        <KpiCard label="Current Status" value={student?.status || "present"} icon={Users} tone={student?.status === "outside" ? "amber" : student?.status === "leave" ? "blue" : "green"} sub="Hostel occupancy status" />
        <KpiCard label="Outing / Leave" value={activeLeave ? "On Leave" : activePass ? "Allowed Out" : "In Hostel"} icon={activeLeave || activePass ? CalendarCheck : ArrowRightLeft} tone={activeLeave || activePass ? "amber" : "slate"} sub={activePass ? `Pass ${activePass.pass_id}` : activeLeave ? `Leave till ${activeLeave.to_date}` : "No pending outing"} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Child profile + meals today */}
        <div className="lg:col-span-2 rounded-2xl border border-slate-200 bg-white p-6 shadow-md dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center gap-4 border-b border-slate-100 pb-4 mb-4 dark:border-slate-800">
            <img
              src={student?.photo_url || user?.avatarUrl}
              alt={student?.name || "Child"}
              className="h-14 w-14 rounded-full border-2 border-indigo-300 object-cover"
            />
            <div className="flex-1">
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white">{student?.name || user?.name}</h3>
              <p className="text-xs text-slate-500">
                {student?.student_id || studentId} · {student?.hostel || user?.hostel || "Hostel"} · Room {student?.room || user?.room || "-"}
              </p>
            </div>
            {student && <StatusBadge status={student.status} size="sm" />}
          </div>

          <h4 className="text-xs font-extrabold uppercase tracking-wide text-slate-500 mb-3">Meal Status · {today}</h4>
          <div className="grid grid-cols-4 gap-3">
            {MEAL_ORDER.map((meal) => {
              const rec = map[meal];
              return (
                <div
                  key={meal}
                  className={`rounded-xl border p-3 text-center ${
                    rec
                      ? "border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/40"
                      : "border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-800/40"
                  }`}
                >
                  <p className="text-lg">{MEAL_EMOJIS[meal]}</p>
                  <p className="mt-1 text-[11px] font-bold text-slate-900 dark:text-white">{MEAL_LABELS[meal]}</p>
                  {rec ? (
                    <p className="mt-1 flex items-center justify-center gap-1 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300">
                      <CheckCircle2 className="h-3 w-3" />
                      {new Date(rec.scanned_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  ) : (
                    <p className="mt-1 text-[10px] font-semibold text-slate-400">Not recorded</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Movement feed */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-md dark:border-slate-800 dark:bg-slate-900 space-y-4">
          <h4 className="text-xs font-extrabold uppercase tracking-wide text-slate-500">Recent Movement</h4>
          {myHolidays.length === 0 && myLeaves.length === 0 ? (
            <p className="text-xs text-slate-400">No recent gate passes or leave requests.</p>
          ) : (
            <>
              {myHolidays.slice(0, 3).map((g) => (
                <div key={g.id} className="rounded-xl bg-slate-50 p-3 text-xs dark:bg-slate-800/50">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900 dark:text-white">{g.pass_id}</span>
                    <StatusBadge status={g.status} size="sm" />
                  </div>
                  <p className="mt-1 text-[11px] text-slate-500">{g.purpose}</p>
                  <p className="text-[10px] text-slate-400">
                    Out {g.exit_time} · Return {g.expected_return}
                  </p>
                </div>
              ))}
              {myLeaves.slice(0, 3).map((l) => (
                <div key={l.id} className="rounded-xl bg-slate-50 p-3 text-xs dark:bg-slate-800/50">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900 dark:text-white">{l.title || l.from_date}</span>
                    <StatusBadge status={l.status} size="sm" />
                  </div>
                  <p className="mt-1 text-[11px] text-slate-500">
                    {l.from_date} → {l.to_date}
                  </p>
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
};