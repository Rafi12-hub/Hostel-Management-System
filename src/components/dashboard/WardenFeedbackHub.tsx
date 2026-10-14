import React, { useEffect, useMemo, useState } from "react";
import { Utensils, Wrench, MessageSquare, Inbox } from "lucide-react";
import { subscribeCollection } from "@/lib/firestore";
import { StatusBadge } from "@/components/ui/StatusBadge";

type Source = "mess" | "maintenance";

interface FeedbackItem {
  id: string;
  source: Source;
  title: string;
  detail: string;
  hostel: string;
  room?: string;
  date: string;
  meta: string[];
  rating?: number;
  status?: string;
}

export const WardenFeedbackHub: React.FC = () => {
  const [feedback, setFeedback] = useState<any[]>([]);
  const [maintenance, setMaintenance] = useState<any[]>([]);
  const [filter, setFilter] = useState<"all" | "mess" | "maintenance">("all");

  useEffect(() => {
    const unsubF = subscribeCollection("FoodFeedback", setFeedback);
    const unsubM = subscribeCollection("Maintenance", setMaintenance);
    return () => {
      unsubF();
      unsubM();
    };
  }, []);

  const items = useMemo<FeedbackItem[]>(() => {
    const mess: FeedbackItem[] = feedback.map((f) => ({
      id: `mess-${f.id}`,
      source: "mess",
      title: f.hostel || "Mess",
      detail: f.comments || "No comment",
      hostel: f.hostel || "Unknown hostel",
      room: f.room || "",
      date: f.date || "",
      rating: Number(f.rating) || 0,
      meta: [
        `Taste ${f.taste || "-"}/5`,
        `Quality ${f.quality || "-"}/5`,
        `Cleanliness ${f.cleanliness || "-"}/5`,
      ],
    }));

    const maint: FeedbackItem[] = maintenance.map((m) => ({
      id: `maint-${m.id}`,
      source: "maintenance",
      title: `${m.category || "Maintenance"} ticket ${m.ticket_id || ""}`,
      detail: m.description || "No description",
      hostel: m.hostel || "Unknown hostel",
      room: m.room || "",
      date: (m.date || m.resolved_date || "").slice(0, 10),
      status: m.status || "new",
      meta: [`Priority: ${m.priority || "medium"}`, `Assigned: ${m.assigned_to || "Unassigned"}`],
    }));

    const all = [...mess, ...maint].sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));
    if (filter === "mess") return all.filter((i) => i.source === "mess");
    if (filter === "maintenance") return all.filter((i) => i.source === "maintenance");
    return all;
  }, [feedback, maintenance, filter]);

  const messCount = feedback.length;
  const maintCount = maintenance.length;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-md dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-wrap items-center justify-between border-b border-slate-100 pb-4 mb-4 gap-3 dark:border-slate-800">
        <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-indigo-600" /> All Resident Feedback & Complaints
        </h3>
        <div className="flex items-center gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
          {(["all", "mess", "maintenance"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setFilter(v)}
              className={`rounded-lg px-3 py-1.5 text-[11px] font-bold capitalize transition-colors ${
                filter === v
                  ? "bg-white text-indigo-700 shadow-sm dark:bg-slate-700 dark:text-indigo-300"
                  : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
              }`}
            >
              {v === "all" ? `All (${messCount + maintCount})` : v === "mess" ? `Mess (${messCount})` : `Maintenance (${maintCount})`}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        {items.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-10 text-center">
            <Inbox className="h-10 w-10 text-slate-300 dark:text-slate-600" />
            <p className="text-xs text-slate-400">No feedback or complaints yet.</p>
          </div>
        )}

        {items.map((item) => (
          <div key={item.id} className="rounded-xl border border-slate-100 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800/50">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <span
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                    item.source === "mess"
                      ? "bg-amber-100 text-amber-600 dark:bg-amber-950 dark:text-amber-300"
                      : "bg-blue-100 text-blue-600 dark:bg-blue-950 dark:text-blue-300"
                  }`}
                >
                  {item.source === "mess" ? <Utensils className="h-4 w-4" /> : <Wrench className="h-4 w-4" />}
                </span>
                <div>
                  <p className="text-xs font-bold text-slate-900 dark:text-white">{item.title}</p>
                  <p className="text-[11px] text-slate-500">
                    {item.source === "mess" ? "Mess Feedback" : "Maintenance Complaint"} · {item.hostel}
                    {item.room ? ` · Room ${item.room}` : ""}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {item.rating ? (
                  <span className="rounded-full bg-amber-50 px-2 py-1 text-[10px] font-extrabold text-amber-700 dark:bg-amber-950/50 dark:text-amber-300">
                    ★ {item.rating}/5
                  </span>
                ) : item.status ? (
                  <StatusBadge status={item.status} size="sm" />
                ) : null}
                <span className="text-[10px] font-semibold text-slate-400">{item.date}</span>
              </div>
            </div>
            <p className="mt-2 pl-12 text-xs text-slate-700 dark:text-slate-300">{item.detail}</p>
            <div className="mt-2 pl-12 flex flex-wrap gap-2">
              {item.meta.map((m, i) => (
                <span key={i} className="rounded-md bg-white border border-slate-200 px-2 py-0.5 text-[10px] font-semibold text-slate-500 dark:bg-slate-900 dark:border-slate-700">
                  {m}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
