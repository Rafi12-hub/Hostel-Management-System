import React, { useState, useEffect, useMemo } from "react";
import { CheckCheck, Bell, BellRing, AlertTriangle, CheckCircle2, Info, Filter } from "lucide-react";
import { subscribeCollection, updateRecord } from "@/lib/firestore";
import { PageHeader } from "@/components/ui/PageHeader";
import { SkeletonCard } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";

const TYPE_META: Record<string, { icon: any; tone: string; bg: string }> = {
  info: { icon: Info, tone: "text-blue-600", bg: "bg-blue-50 dark:bg-blue-950/50" },
  success: { icon: CheckCircle2, tone: "text-emerald-600", bg: "bg-emerald-50 dark:bg-emerald-950/50" },
  warning: { icon: AlertTriangle, tone: "text-amber-600", bg: "bg-amber-50 dark:bg-amber-950/50" },
  critical: { icon: BellRing, tone: "text-rose-600", bg: "bg-rose-50 dark:bg-rose-950/50" },
};

function isToday(ts: string) {
  const d = new Date(ts);
  const now = new Date();
  return d.toDateString() === now.toDateString();
}

function fmtTime(ts: string) {
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default function Notifications() {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [typeFilter, setTypeFilter] = useState("all");

  useEffect(() => {
    const unsub = subscribeCollection("Notification", (d) => {
      setNotifications(d);
      setLoaded(true);
    });
    return () => unsub();
  }, []);

  const handleMarkRead = async (id: string) => {
    await updateRecord("Notification", id, { read: true });
  };

  const handleMarkAllRead = async () => {
    for (const n of notifications.filter((x) => !x.read)) {
      await updateRecord("Notification", n.id, { read: true });
    }
  };

  const filtered = useMemo(() => {
    const list = notifications.filter((n) => typeFilter === "all" || n.type === typeFilter);
    return list.sort((a, b) => String(b.timestamp || "").localeCompare(String(a.timestamp || "")));
  }, [notifications, typeFilter]);

  const groups = useMemo(() => {
    const today = filtered.filter((n) => n.timestamp && isToday(n.timestamp));
    const earlier = filtered.filter((n) => !n.timestamp || !isToday(n.timestamp));
    return { today, earlier };
  }, [filtered]);

  const unread = filtered.filter((n) => !n.read).length;

  const renderRow = (n: any) => {
    const meta = TYPE_META[n.type] || TYPE_META.info;
    const Icon = meta.icon;
    return (
      <button
        key={n.id}
        onClick={() => handleMarkRead(n.id)}
        className={`w-full rounded-2xl border p-4 text-left shadow-card transition-all ${
          n.read
            ? "border-slate-200 bg-white opacity-80 dark:border-slate-800 dark:bg-slate-900"
            : "border-indigo-200 bg-white dark:border-indigo-900 dark:bg-slate-900"
        }`}
      >
        <div className="flex items-start gap-3">
          <span className={`relative flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${meta.bg}`}>
            <Icon className={`h-5 w-5 ${meta.tone}`} />
            {!n.read && (
              <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full bg-indigo-600 ring-2 ring-white dark:ring-slate-900" />
            )}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <h4 className={`text-sm font-bold text-slate-900 dark:text-white ${n.read ? "" : ""}`}>
                {n.title}
              </h4>
              <span className="shrink-0 text-[10px] font-bold text-slate-400">
                {n.timestamp ? fmtTime(n.timestamp) : ""}
              </span>
            </div>
            <p className="mt-0.5 text-xs leading-relaxed text-slate-600 dark:text-slate-300">{n.message}</p>
            <span className="mt-2 inline-block rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-slate-500 dark:bg-slate-800 dark:text-slate-400">
              {n.type}
            </span>
          </div>
        </div>
      </button>
    );
  };

  return (
    <div className="mx-auto max-w-2xl space-y-5 pb-4">
      <PageHeader
        title="Notifications"
        subtitle="Approvals, gate passes, broadcasts and alerts"
        actions={
          unread > 0 ? (
            <button
              onClick={handleMarkAllRead}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
            >
              <CheckCheck className="h-4 w-4 text-emerald-600" /> Mark all read
            </button>
          ) : null
        }
      />

      {/* Filter chips */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        <button
          onClick={() => setTypeFilter("all")}
          className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[11px] font-bold ${
            typeFilter === "all"
              ? "bg-indigo-600 text-white"
              : "border border-slate-200 bg-white text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
          }`}
        >
          <Bell className="h-3.5 w-3.5" /> All
        </button>
        {["info", "success", "warning", "critical"].map((t) => (
          <button
            key={t}
            onClick={() => setTypeFilter(t)}
            className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[11px] font-bold capitalize ${
              typeFilter === t
                ? "bg-indigo-600 text-white"
                : "border border-slate-200 bg-white text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
            }`}
          >
            <Filter className="h-3 w-3" /> {t}
          </button>
        ))}
      </div>

      {!loaded ? (
        <div className="space-y-3"><SkeletonCard /><SkeletonCard /><SkeletonCard /></div>
      ) : filtered.length === 0 ? (
        <EmptyState
          title={typeFilter === "all" ? "You're all caught up" : "No notifications here"}
          description="New updates and alerts will show up here in real time."
          icon={CheckCircle2}
        />
      ) : (
        <div className="space-y-5">
          {groups.today.length > 0 && (
            <section>
              <h3 className="mb-2 text-[11px] font-extrabold uppercase tracking-widest text-slate-400">
                Today
              </h3>
              <div className="space-y-2.5">{groups.today.map(renderRow)}</div>
            </section>
          )}
          {groups.earlier.length > 0 && (
            <section>
              <h3 className="mb-2 text-[11px] font-extrabold uppercase tracking-widest text-slate-400">
                Earlier
              </h3>
              <div className="space-y-2.5">
                {groups.earlier.map(renderRow)}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}