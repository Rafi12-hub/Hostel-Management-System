import React, { useEffect, useMemo, useState } from "react";
import { Utensils, Users, ScanLine, Moon } from "lucide-react";
import { subscribeCollection } from "@/lib/firestore";
import { KpiCard } from "@/components/ui/KpiCard";
import {
  MEAL_ORDER,
  MEAL_LABELS,
  MEAL_EMOJIS,
  ensureMealConfig,
  getActiveMeal,
  todayMealCounts,
  todayCountsByHostel,
  fmtHm,
  todayStr,
} from "@/lib/hostelService";

export const WardenMessSummary: React.FC = () => {
  const [records, setRecords] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [config, setConfig] = useState<any>(null);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const unsubA = subscribeCollection("MessAttendance", setRecords);
    const unsubS = subscribeCollection("Student", setStudents);
    ensureMealConfig().then(setConfig).catch(() => undefined);
    const tick = setInterval(() => setNow(new Date()), 30000);
    return () => {
      unsubA();
      unsubS();
      clearInterval(tick);
    };
  }, []);

  const liveCounts = useMemo(() => todayMealCounts(records), [records]);
  const byHostel = useMemo(() => todayCountsByHostel(records), [records]);
  const active = getActiveMeal(config, now);
  const presentNow = students.filter((s) => s.status === "present" || s.status === "late").length;
  const dinnerCount = liveCounts.dinner || 0;

  const recentScans = useMemo(
    () =>
      [...records]
        .filter((r) => r.date === todayStr(now))
        .sort((a, b) => String(b.scanned_at || "").localeCompare(String(a.scanned_at || "")))
        .slice(0, 6),
    [records, now]
  );

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {MEAL_ORDER.map((meal, idx) => (
          <KpiCard
            key={meal}
            label={`${MEAL_LABELS[meal]} Diners Today`}
            value={liveCounts[meal]}
            icon={Utensils}
            tone={idx === 0 ? "amber" : idx === 1 ? "green" : idx === 2 ? "teal" : "purple"}
            sub={config?.[meal] ? `${fmtHm(config[meal].start)} – ${fmtHm(config[meal].end)}` : undefined}
          />
        ))}
      </div>

      {active && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 text-sm dark:border-emerald-900 dark:bg-emerald-950/40 flex items-center justify-between">
          <p className="font-bold text-emerald-900 dark:text-emerald-200 flex items-center gap-2">
            <ScanLine className="h-5 w-5 animate-pulse" /> {MEAL_LABELS[active.meal]} session is live now
          </p>
          <p className="text-xs text-emerald-700 dark:text-emerald-400">
            {fmtHm(active.timing.start)} – {fmtHm(active.timing.end)}
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-md dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4 dark:border-slate-800">
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Users className="h-5 w-5 text-emerald-600" /> Attendance by Hostel · Today
            </h3>
          </div>
          <div className="space-y-3">
            {Object.keys(byHostel).length === 0 && (
              <p className="py-6 text-center text-xs text-slate-400">No scans yet today.</p>
            )}
            {Object.entries(byHostel).map(([hostel, meals]) => (
              <div key={hostel} className="rounded-xl bg-slate-50 p-4 text-xs dark:bg-slate-800/50">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900 dark:text-white">{hostel}</span>
                  <span className="font-extrabold text-emerald-700 dark:text-emerald-300">
                    {Object.values(meals).reduce((a, b) => a + b, 0)} meals
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {MEAL_ORDER.map((m) => (
                    <span key={m} className="rounded-lg bg-white border border-slate-200 px-2.5 py-1 text-[10px] font-bold text-slate-600 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-300">
                      {MEAL_EMOJIS[m]} {MEAL_LABELS[m]}: {meals[m] ?? 0}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-md dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4 dark:border-slate-800">
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Moon className="h-5 w-5 text-indigo-600" /> Dinner vs Night Roll Call
            </h3>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-xl bg-purple-50 border border-purple-200 p-4 text-center dark:bg-purple-950/40 dark:border-purple-900">
              <p className="text-2xl font-extrabold text-purple-700 dark:text-purple-300">{presentNow}</p>
              <p className="text-[10px] font-bold uppercase tracking-wide text-purple-500 mt-1">Present in hostel</p>
            </div>
            <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4 text-center dark:bg-emerald-950/40 dark:border-emerald-900">
              <p className="text-2xl font-extrabold text-emerald-700 dark:text-emerald-300">{dinnerCount}</p>
              <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-500 mt-1">Dinner diners</p>
            </div>
          </div>
          <p className="mt-3 text-[11px] text-slate-500">
            Combine dinner scans with the nightly roll call to verify who was on the hostel premises.
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-md dark:border-slate-800 dark:bg-slate-900">
        <h3 className="text-base font-bold text-slate-900 dark:text-white border-b border-slate-100 pb-4 mb-4 dark:border-slate-800">
          Latest Check-Ins
        </h3>
        <div className="space-y-2">
          {recentScans.length === 0 && <p className="py-4 text-center text-xs text-slate-400">No check-ins yet.</p>}
          {recentScans.map((r) => (
            <div key={r.id} className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-2.5 text-xs dark:bg-slate-800/50">
              <div className="flex items-center gap-3">
                <span>{MEAL_EMOJIS[r.meal as keyof typeof MEAL_EMOJIS]}</span>
                <div>
                  <p className="font-bold text-slate-900 dark:text-white">
                    {r.student_name} <span className="font-mono text-[10px] text-slate-400">({r.student_id})</span>
                  </p>
                  <p className="text-[10px] text-slate-500">{r.hostel}</p>
                </div>
              </div>
              <span className="text-[10px] font-semibold text-slate-400">
                {new Date(r.scanned_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};