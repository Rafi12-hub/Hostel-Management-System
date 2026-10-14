import React, { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import {
  Star,
  CalendarDays,
  CalendarCheck,
  CheckCircle2,
  Clock,
  Hammer,
} from "lucide-react";
import { listCollection, subscribeCollection, createRecord } from "@/lib/firestore";
import { useDemoAuth } from "@/context/DemoAuthContext";
import { PageHeader } from "@/components/ui/PageHeader";
import { SkeletonCard } from "@/components/ui/Skeleton";
import {
  MEAL_ORDER,
  MEAL_LABELS,
  MEAL_EMOJIS,
  DEFAULT_MEAL_CONFIG,
  ensureMealConfig,
  getActiveMeal,
  todayStr,
  nowHhmm,
  hoursToMinutes,
  fmtHm,
  type MealConfig,
  type MealKey,
} from "@/lib/hostelService";
import { MealBookingPanel } from "@/components/mess/MealBookingPanel";
import { MessAttendanceWidget } from "@/components/dashboard/MessAttendanceWidget";

type MealState = "completed" | "current" | "upcoming" | "missed";

export default function Mess() {
  const { role, user } = useDemoAuth();
  const [messAttendance, setMessAttendance] = useState<any[]>([]);
  const [feedback, setFeedback] = useState<any[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [config, setConfig] = useState<MealConfig>(DEFAULT_MEAL_CONFIG);
  const [now, setNow] = useState(new Date());
  const [loaded, setLoaded] = useState(false);
  const [tab, setTab] = useState<"today" | "book" | "feedback">("today");

  const [form, setForm] = useState({
    rating: 5,
    taste: 5,
    quality: 4,
    cleanliness: 5,
    comments: "",
    hostel: user?.hostel || "APJ Abdul Kalam Boys Hostel (BH-1)",
  });

  useEffect(() => {
    listCollection("MessAttendance").then(setMessAttendance);
    const unsub = subscribeCollection("FoodFeedback", setFeedback);
    const cfgP = ensureMealConfig().then((c) => setConfig(c));
    const tick = setInterval(() => setNow(new Date()), 30000);
    Promise.all([cfgP]).then(() => setLoaded(true));
    return () => {
      unsub();
      clearInterval(tick);
    };
  }, []);

  const handleCreateFeedback = async (e: React.FormEvent) => {
    e.preventDefault();
    await createRecord("FoodFeedback", {
      ...form,
      hostel: user?.hostel || form.hostel,
      date: new Date().toISOString().split("T")[0],
    });
    setForm((f) => ({ ...f, comments: "" }));
    setModalOpen(false);
  };

  const avgRating = feedback.length
    ? (feedback.reduce((acc, f) => acc + (f.rating || 5), 0) / feedback.length).toFixed(1)
    : "—";

  const studentId = user?.studentId || "";
  const today = todayStr(now);

  // Per-meal state for the student timeline.
  const mealStates = useMemo(() => {
    const states: Record<MealKey, { state: MealState; note?: string }> = {
      breakfast: { state: "upcoming" },
      lunch: { state: "upcoming" },
      snacks: { state: "upcoming" },
      dinner: { state: "upcoming" },
    };
    if (!studentId) return states;
    const currentMin = hoursToMinutes(nowHhmm(now));
    const active = getActiveMeal(config, now);
    for (const meal of MEAL_ORDER) {
      const recorded = messAttendance.find(
        (r) =>
          String(r.student_id).trim().toUpperCase() === studentId.toUpperCase() &&
          r.date === today &&
          r.meal === meal
      );
      const t = config[meal];
      const start = hoursToMinutes(t.start);
      const end = hoursToMinutes(t.end);
      if (recorded) {
        states[meal] = {
          state: "completed",
          note: new Date(recorded.scanned_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        };
      } else if (active?.meal === meal) {
        states[meal] = { state: "current", note: "Now serving" };
      } else if (currentMin < start) {
        states[meal] = { state: "upcoming" };
      } else if (currentMin > end) {
        states[meal] = { state: "missed", note: "Window closed" };
      }
    }
    return states;
  }, [messAttendance, config, now, studentId, today]);

  const doneCount = MEAL_ORDER.filter((m) => mealStates[m].state === "completed").length;

  const timeline = MEAL_ORDER.map((meal) => {
    const t = config[meal];
    const s = mealStates[meal];
    const isCurrent = s.state === "current";
    return { meal, start: t.start, end: t.end, state: s.state, note: s.note, isCurrent };
  });

  return (
    <div className="mx-auto max-w-3xl space-y-5 pb-4">
      <PageHeader
        title="Mess & Dining"
        subtitle="Meal timings, advance booking, attendance and feedback"
        actions={
          <button
            onClick={() => setModalOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-indigo-700"
          >
            <Star className="h-4 w-4 fill-current" /> Give Feedback
          </button>
        }
      />

      {/* Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {(
          [
            ["today", "Meal Timeline", Clock],
            ["book", "Book Meals", CalendarCheck],
            ["feedback", "Attendance & Feedback", Star],
          ] as const
        ).map(([key, label, Icon]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`inline-flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-xs font-bold transition-colors ${
              tab === key
                ? "bg-indigo-600 text-white shadow-md"
                : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
            }`}
          >
            <Icon className="h-4 w-4" /> {label}
            {key === "today" && role === "student" && (
              <span className={`rounded-full px-1.5 text-[10px] ${tab === key ? "bg-white/20" : "bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300"}`}>
                {doneCount}/4
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ------------------ MEAL TIMELINE TAB ------------------ */}
      {tab === "today" && (
        <div className="space-y-5">
          {!loaded ? (
            <SkeletonCard />
          ) : (
            <section className="rounded-[1.25rem] border border-slate-200 bg-white p-5 shadow-card dark:border-slate-800 dark:bg-slate-900">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">Today's Meal Schedule</h2>
                <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-extrabold text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300">
                  {doneCount}/{MEAL_ORDER.length} done
                </span>
              </div>

              {/* Timeline */}
              <div className="relative space-y-0">
                <div className="absolute left-[1.05rem] top-2 bottom-2 w-px bg-slate-200 dark:bg-slate-700" />
                {timeline.map((item) => {
                  const stateMeta = {
                    completed: {
                      ring: "border-2 border-emerald-400",
                      chip: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300",
                      text: "Completed",
                    },
                    current: {
                      ring: "border-2 border-indigo-500 ring-4 ring-indigo-500/20",
                      chip: "bg-indigo-600 text-white",
                      text: "Now Serving",
                    },
                    upcoming: {
                      ring: "border-2 border-slate-300 dark:border-slate-600",
                      chip: "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400",
                      text: "Upcoming",
                    },
                    missed: {
                      ring: "border-2 border-slate-200 dark:border-slate-700",
                      chip: "bg-slate-100 text-slate-400 line-through dark:bg-slate-800 dark:text-slate-500",
                      text: "Missed",
                    },
                  }[item.state];
                  const active = item.isCurrent;
                  return (
                    <div
                      key={item.meal}
                      className={`relative flex items-center gap-3 py-3 ${active ? "rounded-2xl bg-indigo-50/50 p-3 -mx-3 dark:bg-indigo-950/30" : ""}`}
                    >
                      {/* Node */}
                      <span className={`relative z-10 flex h-[1.35rem] w-[1.35rem] shrink-0 items-center justify-center rounded-full bg-white ${stateMeta.ring} shadow-sm`}>
                        {item.state === "completed" ? (
                          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                        ) : (
                          <span className="text-[11px]">{MEAL_EMOJIS[item.meal]}</span>
                        )}
                      </span>
                      <div className={`min-w-0 flex-1 ${active ? "" : "opacity-80"}`}>
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-bold text-slate-900 dark:text-white">
                            {MEAL_LABELS[item.meal]}
                          </p>
                          <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${stateMeta.chip}`}>
                            {stateMeta.text}
                            {item.note ? ` · ${item.note}` : ""}
                          </span>
                        </div>
                        <p className="mt-0.5 text-xs font-medium text-slate-500 dark:text-slate-400">
                          {fmtHm(item.start)} – {fmtHm(item.end)}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Quick actions */}
              <div className="mt-4 grid grid-cols-2 gap-3 border-t border-slate-100 pt-4 dark:border-slate-800">
                <Link
                  to="/food-menu"
                  className="flex items-center gap-2.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-bold text-slate-700 hover:border-teal-300 hover:bg-teal-50/40 dark:border-slate-700 dark:bg-slate-800/40 dark:text-slate-200"
                >
                  <CalendarDays className="h-4 w-4 text-teal-600" /> View Weekly Menu
                </Link>
                <button
                  onClick={() => setTab("feedback")}
                  className="flex items-center gap-2.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-bold text-slate-700 text-left hover:border-indigo-300 hover:bg-indigo-50/40 dark:border-slate-700 dark:bg-slate-800/40 dark:text-slate-200"
                >
                  <Hammer className="h-4 w-4 text-indigo-600" /> Attendance & Feedback
                </button>
              </div>
            </section>
          )}

          {/* Mess status strip for non-students */}
          {role !== "student" && (
            <div className="rounded-[1.25rem] border border-slate-200 bg-white p-5 shadow-card dark:border-slate-800 dark:bg-slate-900">
              <p className="text-xs font-bold text-slate-900 dark:text-white mb-3">Current Session</p>
              {getActiveMeal(config, now) ? (
                <p className="text-sm font-bold text-emerald-600">
                  {MEAL_LABELS[getActiveMeal(config, now)!.meal]} is live until{" "}
                  {fmtHm(getActiveMeal(config, now)!.timing.end)}
                </p>
              ) : (
                <p className="text-sm text-slate-500">No meal session active right now.</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* ------------------ BOOK MEALS TAB ------------------ */}
      {tab === "book" && <MealBookingPanel />}

      {/* ------------------ ATTENDANCE & FEEDBACK TAB ------------------ */}
      {tab === "feedback" && (
        <div className="space-y-5">
          {/* Live scan widget */}
          {role === "student" && <MessAttendanceWidget />}

          {/* Feedback summary */}
          <div className="rounded-[1.25rem] border border-slate-200 bg-white p-5 shadow-card dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800 mb-4">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Food Feedback</h3>
              <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-extrabold text-amber-700 dark:bg-amber-950/50 dark:text-amber-300">
                Avg {avgRating} / 5 ⭐
              </span>
            </div>

            <div className="space-y-3">
              {feedback.length === 0 && (
                <p className="py-8 text-center text-xs text-slate-400">
                  No feedback yet. Be the first to share your thoughts!
                </p>
              )}
              {feedback.map((fb) => (
                <div key={fb.id} className="rounded-xl bg-slate-50 p-4 dark:bg-slate-800/60">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-100 text-xs font-extrabold text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                        {fb.rating} ⭐
                      </span>
                      <div>
                        <p className="text-xs font-bold text-slate-900 dark:text-white">{fb.hostel}</p>
                        <p className="text-[10px] text-slate-400">{fb.date}</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
                        Taste {fb.taste}/5
                      </span>
                      <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700 dark:bg-blue-950/50 dark:text-blue-300">
                        Quality {fb.quality}/5
                      </span>
                      <span className="rounded-full bg-purple-50 px-2 py-0.5 text-[10px] font-bold text-purple-700 dark:bg-purple-950/50 dark:text-purple-300">
                        Clean {fb.cleanliness}/5
                      </span>
                    </div>
                  </div>
                  <p className="mt-2.5 text-xs leading-relaxed text-slate-700 dark:text-slate-300">{fb.comments}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Feedback Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/60 backdrop-blur-sm sm:items-center p-4 pb-safe">
          <div className="w-full max-w-md rounded-[1.25rem] bg-white p-6 shadow-2xl dark:bg-slate-900 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Give Feedback</h3>
              <button onClick={() => setModalOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                <span className="text-xl leading-none">×</span>
              </button>
            </div>
            <form onSubmit={handleCreateFeedback} className="mt-4 space-y-4 text-xs">
              <div className="grid grid-cols-4 gap-2">
                {[
                  { key: "taste", label: "Taste" },
                  { key: "quality", label: "Quality" },
                  { key: "cleanliness", label: "Cleanliness" },
                  { key: "rating", label: "Overall" },
                ].map((f) => (
                  <div key={f.key}>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">{f.label}</label>
                    <select
                      value={form[f.key as keyof typeof form] as number}
                      onChange={(e) => setForm({ ...form, [f.key]: Number(e.target.value) })}
                      className="w-full rounded-lg border border-slate-200 bg-slate-50 p-2.5 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    >
                      {[1, 2, 3, 4, 5].map((v) => (
                        <option key={v} value={v}>{v} ★</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Comments & Taste Feedback
                </label>
                <textarea
                  rows={3}
                  placeholder="How was today's food?"
                  required
                  value={form.comments}
                  onChange={(e) => setForm({ ...form, comments: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>

              <div className="flex gap-2 pt-1">
                <button type="submit" className="w-full rounded-xl bg-indigo-600 py-3 text-xs font-bold text-white shadow-sm hover:bg-indigo-700">
                  Post Meal Feedback
                </button>
                <button type="button" onClick={() => setModalOpen(false)} className="w-full rounded-xl bg-slate-100 py-3 text-xs font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}