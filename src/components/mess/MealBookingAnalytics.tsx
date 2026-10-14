import React, { useState, useEffect, useCallback } from "react";
import {
  BarChart3,
  Users,
  Calendar,
  Loader2,
  UtensilsCrossed,
} from "lucide-react";
import {
  MEAL_ORDER,
  MEAL_LABELS,
  MEAL_EMOJIS,
  type MealKey,
  todayStr,
} from "@/lib/hostelService";
import {
  getFullDayAnalytics,
  bookableDates,
  type MealBookingSummary,
} from "@/lib/mealBooking";
import { KpiCard } from "@/components/ui/KpiCard";

function dayLabel(dateStr: string): string {
  const t = todayStr();
  if (dateStr === t) return "Today";
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (dateStr === tomorrow.toISOString().split("T")[0]) return "Tomorrow";
  return new Date(dateStr).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

const TONE_MAP: Record<MealKey, string> = {
  breakfast: "amber",
  lunch: "green",
  snacks: "blue",
  dinner: "purple",
};

export const MealBookingAnalytics: React.FC<{ hostel: string }> = ({ hostel }) => {
  const [date, setDate] = useState(todayStr());
  const [data, setData] = useState<MealBookingSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const summaries = await getFullDayAnalytics(date, hostel);
      setData(summaries);
    } finally {
      setLoading(false);
    }
  }, [date, hostel]);

  useEffect(() => {
    load();
  }, [load]);

  const totalBookings = data.reduce((sum, s) => sum + s.total, 0);
  const dates = bookableDates(7);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-md dark:border-slate-800 dark:bg-slate-900">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-4 dark:border-slate-800 mb-4">
        <h3 className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-indigo-600" />
          Item-Wise Booking Analytics
        </h3>
      </div>

      {/* Date selector */}
      <div className="mb-4">
        <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-500">
          <Calendar className="mr-1 inline h-3.5 w-3.5" /> Date
        </p>
        <div className="flex flex-wrap gap-1.5">
          {dates.map((d) => (
            <button
              key={d}
              onClick={() => setDate(d)}
              className={`rounded-lg px-2.5 py-1 text-[10px] font-bold transition-colors ${
                date === d
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
              }`}
            >
              {dayLabel(d)}
            </button>
          ))}
        </div>
      </div>

      {/* KPI summary */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <KpiCard
          label="Total Bookings"
          value={totalBookings}
          icon={Users}
          tone="indigo"
          sub={`${hostel.split(" ")[0]}`}
        />
        <KpiCard
          label="Meals with Bookings"
          value={data.filter((s) => s.total > 0).length}
          icon={UtensilsCrossed}
          tone="green"
          sub={`out of ${MEAL_ORDER.length}`}
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-indigo-600" />
          <span className="ml-2 text-xs text-slate-500">Loading analytics...</span>
        </div>
      ) : data.every((s) => s.total === 0) ? (
        <p className="text-center text-xs text-slate-400 py-8">
          No bookings for {dayLabel(date)}.
        </p>
      ) : (
        <div className="space-y-5">
          {data.map((summary) => {
            if (summary.total === 0) return null;
            const maxCount = Math.max(...summary.items.map((i) => i.count), 1);

            return (
              <div key={summary.meal}>
                <p className="text-xs font-extrabold text-slate-900 dark:text-white mb-2 flex items-center gap-1.5">
                  <span>{MEAL_EMOJIS[summary.meal]}</span>
                  {MEAL_LABELS[summary.meal]}
                  <span className="ml-auto text-[10px] font-bold text-slate-400">
                    {summary.total} bookings
                  </span>
                </p>
                <div className="space-y-2">
                  {summary.items.map((item) => {
                    const pct = Math.round((item.count / maxCount) * 100);
                    return (
                      <div key={item.item}>
                        <div className="flex items-center justify-between text-[11px] mb-1">
                          <span className="font-semibold text-slate-700 dark:text-slate-300 truncate max-w-[70%]">
                            {item.item}
                          </span>
                          <span className="font-bold text-indigo-700 dark:text-indigo-300">
                            {item.count} Students
                          </span>
                        </div>
                        <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                          <div
                            className={`h-full rounded-full bg-gradient-to-r ${
                              (TONE_MAP[summary.meal] || "indigo") === "amber"
                                ? "from-amber-400 to-amber-600"
                                : (TONE_MAP[summary.meal] || "indigo") === "green"
                                ? "from-emerald-400 to-emerald-600"
                                : (TONE_MAP[summary.meal] || "indigo") === "blue"
                                ? "from-blue-400 to-blue-600"
                                : "from-purple-400 to-purple-600"
                            } transition-all duration-500`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-center dark:bg-slate-800/60">
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">
                    Total {MEAL_LABELS[summary.meal]} Bookings:{" "}
                    <span className="text-indigo-700 dark:text-indigo-300">{summary.total} Students</span>
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
