import React, { useEffect, useMemo, useState } from "react";
import { Utensils, BarChart3, Users, Star, CalendarDays } from "lucide-react";
import { subscribeCollection } from "@/lib/firestore";
import { KpiCard } from "@/components/ui/KpiCard";
import {
  MEAL_ORDER,
  MEAL_LABELS,
  MEAL_EMOJIS,
  todayMealCounts,
  todayCountsByHostel,
  todayStr,
} from "@/lib/hostelService";

export const AdminMessAnalytics: React.FC = () => {
  const [records, setRecords] = useState<any[]>([]);
  const [feedback, setFeedback] = useState<any[]>([]);

  useEffect(() => {
    const unsubA = subscribeCollection("MessAttendance", setRecords);
    const unsubF = subscribeCollection("FoodFeedback", setFeedback);
    return () => {
      unsubA();
      unsubF();
    };
  }, []);

  const liveCounts = useMemo(() => todayMealCounts(records, todayStr()), [records]);
  const byHostel = useMemo(() => todayCountsByHostel(records, todayStr()), [records]);
  const totalToday = Object.values(liveCounts).reduce((a, b) => a + b, 0);
  const avgRating = (feedback.reduce((acc, f) => acc + (f.rating || 5), 0) / (feedback.length || 1)).toFixed(1);

  const last7Days = useMemo(() => {
    const out: { label: string; total: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = todayStr(d);
      out.push({
        label: d.toLocaleDateString([], { weekday: "short", day: "numeric" }),
        total: records.filter((r) => r.date === key).length,
      });
    }
    return out;
  }, [records]);

  const maxDay = Math.max(...last7Days.map((d) => d.total), 1);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Today's Total Meal Scans" value={totalToday} icon={Utensils} tone="indigo" sub="All hostels combined" />
        <KpiCard label="Avg Food Rating" value={`${avgRating} / 5`} icon={Star} tone="amber" sub="Resident feedback" />
        <KpiCard label="Breakfast Diners" value={liveCounts.breakfast} icon={MEAL_EMOJIS.breakfast.includes("🍞") ? Utensils : Utensils} tone="amber" />
        <KpiCard label="Lunch Diners" value={liveCounts.lunch} icon={MEAL_EMOJIS.lunch.includes("🍛") ? Utensils : Utensils} tone="green" />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Hostel-wise today */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-md dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4 dark:border-slate-800">
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Users className="h-5 w-5 text-emerald-600" /> Today by Hostel & Meal
            </h3>
          </div>
          <div className="space-y-3">
            {Object.keys(byHostel).length === 0 && (
              <p className="py-6 text-center text-xs text-slate-400">No scans recorded yet today.</p>
            )}
            {Object.entries(byHostel).map(([hostel, meals]) => (
              <div key={hostel} className="rounded-xl bg-slate-50 p-4 text-xs dark:bg-slate-800/50">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900 dark:text-white">{hostel}</span>
                  <span className="font-extrabold text-indigo-700 dark:text-indigo-300">
                    {Object.values(meals).reduce((a, b) => a + b, 0)}
                  </span>
                </div>
                <div className="mt-2 space-y-1.5">
                  {MEAL_ORDER.map((m) => {
                    const val = meals[m] ?? 0;
                    return (
                      <div key={m} className="flex items-center gap-2">
                        <span className="w-20 text-[10px] font-bold text-slate-500">{MEAL_LABELS[m]}</span>
                        <div className="flex-1 h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-emerald-500"
                            style={{ width: `${Math.min(100, (val / Math.max(totalToday, 1)) * 300)}%` }}
                          />
                        </div>
                        <span className="w-8 text-right text-[10px] font-bold text-slate-600 dark:text-slate-300">{val}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 7-day trend + recent feedback */}
        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-md dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4 dark:border-slate-800">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <CalendarDays className="h-5 w-5 text-purple-600" /> Daily Scan Trend (7 days)
              </h3>
            </div>
            <div className="flex items-end gap-2 h-32">
              {last7Days.map((d) => (
                <div key={d.label} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300">{d.total}</span>
                  <div
                    className="w-full rounded-t-lg bg-gradient-to-t from-indigo-600 to-purple-500"
                    style={{ height: `${Math.max(6, (d.total / maxDay) * 100)}%` }}
                  />
                  <span className="text-[9px] text-slate-400">{d.label}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-md dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4 dark:border-slate-800">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-amber-600" /> Latest Resident Feedback
              </h3>
            </div>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {feedback.length === 0 && <p className="py-4 text-center text-xs text-slate-400">No feedback yet.</p>}
              {feedback.slice(0, 6).map((f) => (
                <div key={f.id} className="rounded-lg bg-slate-50 p-3 text-[11px] dark:bg-slate-800/50">
                  <div className="flex justify-between">
                    <span className="font-bold text-slate-900 dark:text-white">{f.hostel}</span>
                    <span className="font-bold text-amber-600">{f.rating} ⭐</span>
                  </div>
                  <p className="mt-0.5 text-slate-600 dark:text-slate-300 line-clamp-2">{f.comments}</p>
                  <p className="mt-1 text-[9px] text-slate-400">
                    {f.date} · Taste {f.taste}/5 · Quality {f.quality}/5
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};