import React, { useState, useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Plus,
  X,
  Zap,
  Droplets,
  Wind,
  Snowflake,
  Armchair,
  Wifi,
  Sparkles,
  Hammer,
  ChevronDown,
  CheckCircle2,
  Clock,
  Loader2,
} from "lucide-react";
import { subscribeCollection, createRecord, updateRecord } from "@/lib/firestore";
import { useDemoAuth } from "@/context/DemoAuthContext";
import { EmptyState } from "@/components/ui/EmptyState";
import { SkeletonCard } from "@/components/ui/Skeleton";

const CATEGORY_META: Record<string, { icon: any; tone: string; bg: string }> = {
  electrical: { icon: Zap, tone: "text-amber-500", bg: "bg-amber-50 dark:bg-amber-950/50" },
  plumbing: { icon: Droplets, tone: "text-sky-500", bg: "bg-sky-50 dark:bg-sky-950/50" },
  fan: { icon: Wind, tone: "text-indigo-500", bg: "bg-indigo-50 dark:bg-indigo-950/50" },
  ac: { icon: Snowflake, tone: "text-blue-500", bg: "bg-blue-50 dark:bg-blue-950/50" },
  furniture: { icon: Armchair, tone: "text-orange-500", bg: "bg-orange-50 dark:bg-orange-950/50" },
  wifi: { icon: Wifi, tone: "text-emerald-500", bg: "bg-emerald-50 dark:bg-emerald-950/50" },
  housekeeping: { icon: Sparkles, tone: "text-purple-500", bg: "bg-purple-50 dark:bg-purple-950/50" },
};

// Map raw statuses to the friendly student-facing labels.
function displayStatus(s: string): { label: string; step: number } {
  switch (s) {
    case "in_progress":
      return { label: "In Progress", step: 1 };
    case "completed":
    case "closed":
      return { label: "Resolved", step: 2 };
    default:
      return { label: "Pending", step: 0 };
  }
}

const STATUS_CHIP: Record<string, string> = {
  pending: "bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300",
  in_progress: "bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300",
  resolved: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300",
};

export default function Maintenance() {
  const { user, role } = useDemoAuth();
  const [searchParams] = useSearchParams();
  const preselect = searchParams.get("category") || "electrical";
  const isStudent = role === "student";

  const [tickets, setTickets] = useState<any[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    category: preselect,
    priority: "medium",
    description: "",
    photo_url: "",
  });

  useEffect(() => {
    if (preselect && preselect !== form.category) {
      setForm((f) => ({ ...f, category: preselect }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preselect]);

  useEffect(() => {
    const unsub = subscribeCollection("Maintenance", (d) => {
      setTickets(d);
      setLoaded(true);
    });
    return () => unsub();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.description.trim()) return;
    setSubmitting(true);
    const tktId = "TKT-" + Math.floor(1000 + Math.random() * 9000);
    await createRecord("Maintenance", {
      ticket_id: tktId,
      student_id: user?.studentId || "22091A001",
      student_name: user?.name || "Aarav Reddy",
      hostel: user?.hostel || "APJ Abdul Kalam Boys Hostel (BH-1)",
      room: user?.room || "101",
      category: form.category,
      priority: form.priority,
      description: form.description.trim(),
      photo_url: form.photo_url || "https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=300&auto=format&fit=crop&q=80",
      status: "new",
      assigned_to: "Unassigned",
      sla_hours: form.priority === "critical" ? 12 : form.priority === "high" ? 24 : 48,
      resolved_date: "",
      student_confirmed: false,
    });
    setSubmitting(false);
    setModalOpen(false);
    setForm({ category: preselect, priority: "medium", description: "", photo_url: "" });
  };

  const handleUpdateStatus = async (id: string, newStatus: string) => {
    await updateRecord("Maintenance", id, {
      status: newStatus,
      resolved_date: newStatus === "completed" ? new Date().toISOString() : "",
    });
  };

  // For students: only their own complaints.
  const visible = useMemo(() => {
    if (!isStudent) return [...tickets].sort((a, b) => String(b.created_at || b.ticket_id || "").localeCompare(String(a.created_at || a.ticket_id || "")));
    const sid = String(user?.studentId || "").trim().toUpperCase();
    return tickets
      .filter((t) => String(t.student_id).trim().toUpperCase() === sid)
      .sort((a, b) => String(b.created_at || b.ticket_id || "").localeCompare(String(a.created_at || a.ticket_id || "")));
  }, [tickets, isStudent, user?.studentId]);

  const isStaff = role === "housekeeping" || role === "warden" || role === "admin";

  return (
    <div className="mx-auto max-w-2xl space-y-5 pb-4">
      <header className="flex items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-bold tracking-tight text-slate-900 dark:text-white">
            My Complaints
          </h1>
          <p className="mt-0.5 text-xs font-medium text-slate-500 dark:text-slate-400">
            Report issues and track their resolution
          </p>
        </div>
        <button
          onClick={() => setModalOpen(true)}
          className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-indigo-700 active:scale-95 transition-all"
        >
          <Plus className="h-4 w-4" /> New Complaint
        </button>
      </header>

      {/* Complaint list */}
      {!loaded ? (
        <div className="space-y-3">
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : visible.length === 0 ? (
        <EmptyState
          title="No complaints yet"
          description="Everything looks good! 🎉 Raise a complaint if you need any repair in your room."
          icon={CheckCircle2}
          action={
            <button
              onClick={() => setModalOpen(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-700"
            >
              <Plus className="h-4 w-4" /> New Complaint
            </button>
          }
        />
      ) : (
        <div className="space-y-3">
          {visible.map((tkt) => {
            const cat = CATEGORY_META[tkt.category] || { icon: Hammer, tone: "text-slate-500", bg: "bg-slate-100 dark:bg-slate-800" };
            const Icon = cat.icon;
            const ds = displayStatus(tkt.status);
            const expanded = expandedId === tkt.id;
            return (
              <article
                key={tkt.id}
                className="overflow-hidden rounded-[1.25rem] border border-slate-200 bg-white shadow-card dark:border-slate-800 dark:bg-slate-900"
              >
                <button
                  onClick={() => setExpandedId(expanded ? null : tkt.id)}
                  className="w-full p-4 text-left"
                >
                  <div className="flex items-start gap-3">
                    <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${cat.bg}`}>
                      <Icon className={`h-5 w-5 ${cat.tone}`} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="text-sm font-bold capitalize text-slate-900 dark:text-white">
                          {tkt.category} Issue
                        </h3>
                        <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-bold ${STATUS_CHIP[ds.label.toLowerCase()] || STATUS_CHIP.pending}`}>
                          {ds.label}
                        </span>
                      </div>
                      <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                        {tkt.description}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] font-medium text-slate-400">
                        <span className="font-mono text-indigo-600 dark:text-indigo-400">{tkt.ticket_id}</span>
                        <span>Room {tkt.room}</span>
                        <span>{tkt.date || (tkt.created_at ? new Date(tkt.created_at).toLocaleDateString() : "—")}</span>
                        {!isStudent && <span>{tkt.student_name}</span>}
                      </div>
                    </div>
                    <ChevronDown className={`h-4 w-4 shrink-0 self-center text-slate-300 transition-transform ${expanded ? "rotate-180" : ""}`} />
                  </div>
                </button>

                {/* Expandable timeline */}
                {expanded && (
                  <div className="border-t border-slate-100 px-4 py-4 dark:border-slate-800">
                    {/* Priority + SLA */}
                    <div className="mb-3 flex flex-wrap gap-2 text-[10px] font-bold">
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 uppercase text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                        {tkt.priority} priority
                      </span>
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                        SLA · {tkt.sla_hours}h
                      </span>
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                        {tkt.assigned_to || "Unassigned"}
                      </span>
                    </div>

                    {/* Status timeline */}
                    <div className="flex items-center">
                      {["Submitted", "In Progress", "Resolved"].map((step, i) => {
                        const isDone = ds.step >= i;
                        const isCurrent = ds.step === i;
                        return (
                          <React.Fragment key={step}>
                            {i > 0 && (
                              <div className={`h-0.5 flex-1 rounded-full ${isDone ? "bg-indigo-500" : "bg-slate-200 dark:bg-slate-700"}`} />
                            )}
                            <div className="flex flex-col items-center px-1">
                              <span
                                className={`flex h-7 w-7 items-center justify-center rounded-full border-2 ${
                                  isDone
                                    ? "border-indigo-500 bg-indigo-500 text-white"
                                    : "border-slate-200 bg-white text-slate-400 dark:border-slate-700 dark:bg-slate-800"
                                } ${isCurrent ? "ring-4 ring-indigo-500/20" : ""}`}
                              >
                                {isDone ? (
                                  <CheckCircle2 className="h-4 w-4" />
                                ) : (
                                  <Clock className="h-3.5 w-3.5" />
                                )}
                              </span>
                              <span className={`mt-1 whitespace-nowrap text-[9px] font-bold ${isDone ? "text-indigo-600 dark:text-indigo-400" : "text-slate-400"}`}>
                                {step}
                              </span>
                            </div>
                          </React.Fragment>
                        );
                      })}
                    </div>

                    {tkt.resolved_date && (
                      <p className="mt-2 text-[10px] font-medium text-emerald-600">
                        Resolved on {new Date(tkt.resolved_date).toLocaleDateString()}
                      </p>
                    )}

                    {/* Staff actions */}
                    {isStaff && (tkt.status === "new" || tkt.status === "assigned" || tkt.status === "in_progress") && (
                      <div className="mt-4 flex gap-2">
                        <button
                          onClick={() => handleUpdateStatus(tkt.id, "in_progress")}
                          className="flex-1 rounded-xl bg-blue-600 py-2 text-[11px] font-bold text-white hover:bg-blue-700"
                        >
                          Mark In Progress
                        </button>
                        <button
                          onClick={() => handleUpdateStatus(tkt.id, "completed")}
                          className="flex-1 rounded-xl bg-emerald-600 py-2 text-[11px] font-bold text-white hover:bg-emerald-700"
                        >
                          Mark Resolved
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}

      {/* New Complaint Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/60 backdrop-blur-sm sm:items-center p-4 pb-safe">
          <div className="w-full max-w-md rounded-[1.25rem] bg-white p-6 shadow-2xl dark:bg-slate-900 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">New Complaint</h3>
              <button onClick={() => setModalOpen(false)} className="text-slate-400">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleCreate} className="mt-4 space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Category</label>
                <select
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 p-2.5 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                >
                  <option value="electrical">Electrical</option>
                  <option value="plumbing">Plumbing</option>
                  <option value="fan">Fan / Regulator</option>
                  <option value="ac">Air Conditioning</option>
                  <option value="furniture">Furniture</option>
                  <option value="wifi">Wi-Fi Internet</option>
                  <option value="housekeeping">Sanitation</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Priority</label>
                <select
                  value={form.priority}
                  onChange={(e) => setForm({ ...form, priority: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 p-2.5 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Description *</label>
                <textarea
                  rows={3}
                  required
                  placeholder="Describe the issue you're facing…"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>

              <button
                type="submit"
                disabled={submitting || !form.description.trim()}
                className="w-full rounded-xl bg-indigo-600 py-3 text-xs font-bold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Submit Complaint
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}