import React, { useState, useEffect } from "react";
import { Plus, Trash2, Eye, EyeOff, X, Lock, Megaphone, AlertTriangle, Utensils, Hammer, PartyPopper } from "lucide-react";
import { subscribeCollection, createRecord, deleteRecord, updateRecord } from "@/lib/firestore";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { PageHeader } from "@/components/ui/PageHeader";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { SkeletonCard } from "@/components/ui/Skeleton";
import { useDemoAuth } from "@/context/DemoAuthContext";

const MANAGER_ROLES = ["admin", "warden", "mess_manager", "hostel_office", "chief_warden", "management", "principal", "housekeeping"];

const CATEGORY_ICON: Record<string, { icon: any; tone: string; bg: string }> = {
  general: { icon: Megaphone, tone: "text-slate-600", bg: "bg-slate-100 dark:bg-slate-800" },
  emergency: { icon: AlertTriangle, tone: "text-rose-600", bg: "bg-rose-50 dark:bg-rose-950/50" },
  mess: { icon: Utensils, tone: "text-amber-600", bg: "bg-amber-50 dark:bg-amber-950/50" },
  maintenance: { icon: Hammer, tone: "text-blue-600", bg: "bg-blue-50 dark:bg-blue-950/50" },
  events: { icon: PartyPopper, tone: "text-emerald-600", bg: "bg-emerald-50 dark:bg-emerald-950/50" },
};

export default function ManageAnnouncements() {
  const { role } = useDemoAuth();
  const canManage = !!role && MANAGER_ROLES.includes(role);
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null);

  const [form, setForm] = useState({
    title: "",
    description: "",
    category: "general",
    audience: "All Students",
    hostel: "All Hostels",
    priority: "medium",
    visibility: "public",
  });

  useEffect(() => {
    const unsub = subscribeCollection("Announcement", (d) => {
      setAnnouncements(d);
      setLoaded(true);
    });
    return () => unsub();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title || !form.description) return;
    await createRecord("Announcement", {
      ...form,
      start_date: new Date().toISOString().split("T")[0],
      expiry_date: "2026-12-31",
    });
    setModalOpen(false);
    setForm({ title: "", description: "", category: "general", audience: "All Students", hostel: "All Hostels", priority: "medium", visibility: "public" });
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await deleteRecord("Announcement", deleteTarget.id);
    setDeleteTarget(null);
  };

  const handleToggleVisibility = async (id: string, currentVis: string) => {
    await updateRecord("Announcement", id, {
      visibility: currentVis === "public" ? "private" : "public",
    });
  };

  return (
    <div className="mx-auto max-w-2xl space-y-5 pb-4">
      <PageHeader
        title={canManage ? "Manage Announcements" : "Hostel Announcements"}
        subtitle={
          canManage
            ? "Broadcast notices, emergency circulars, and mess updates"
            : "Latest notices, circulars, and mess updates from the administration"
        }
        actions={
          canManage && (
            <button
              onClick={() => setModalOpen(true)}
              className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-indigo-700 active:scale-95 transition-all"
            >
              <Plus className="h-4 w-4" /> Create
            </button>
          )
        }
      />

      {!canManage && (
        <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs dark:border-slate-800 dark:bg-slate-800/40">
          <Lock className="h-4 w-4 shrink-0 text-slate-500" />
          <span className="text-slate-600 dark:text-slate-300">You have read-only access.</span>
        </div>
      )}

      {!loaded ? (
        <div className="space-y-3"><SkeletonCard /><SkeletonCard /></div>
      ) : (
        <div className="space-y-3">
          {announcements.map((ann) => {
            const cat = CATEGORY_ICON[ann.category] || CATEGORY_ICON.general;
            const Icon = cat.icon;
            return (
              <article
                key={ann.id}
                className="rounded-[1.25rem] border border-slate-200 bg-white p-4 shadow-card dark:border-slate-800 dark:bg-slate-900"
              >
                <div className="flex items-start gap-3">
                  <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${cat.bg}`}>
                    <Icon className={`h-5 w-5 ${cat.tone}`} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white">{ann.title}</h3>
                      <StatusBadge status={ann.priority} size="sm" />
                      <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase ${
                        ann.visibility === "public"
                          ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"
                          : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                      }`}>
                        {ann.visibility}
                      </span>
                    </div>
                    <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-300">{ann.description}</p>
                    <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[10px] font-semibold text-slate-400">
                      <span className="capitalize">{ann.category}</span>
                      <span>·</span>
                      <span>{ann.audience}</span>
                      <span>·</span>
                      <span>{ann.hostel}</span>
                      {ann.start_date && (
                        <>
                          <span>·</span>
                          <span>{ann.start_date}</span>
                        </>
                      )}
                    </div>
                  </div>

                  {canManage && (
                    <div className="flex shrink-0 items-center gap-2">
                      <button
                        onClick={() => handleToggleVisibility(ann.id, ann.visibility)}
                        title={ann.visibility === "public" ? "Make private" : "Make public"}
                        className="rounded-xl border border-slate-200 p-2 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300"
                      >
                        {ann.visibility === "public" ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                      <button
                        onClick={() => setDeleteTarget(ann)}
                        className="rounded-xl bg-rose-50 p-2 text-rose-600 hover:bg-rose-100 dark:bg-rose-950/50 dark:text-rose-400"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {canManage && modalOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/60 backdrop-blur-sm sm:items-center p-4 pb-safe">
          <div className="w-full max-w-md rounded-[1.25rem] bg-white p-6 shadow-2xl dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">New Announcement</h3>
              <button onClick={() => setModalOpen(false)} className="text-slate-400"><X className="h-5 w-5" /></button>
            </div>
            <form onSubmit={handleCreate} className="mt-4 space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Title *</label>
                <input
                  type="text" required value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 p-2.5 dark:bg-slate-800 dark:text-white dark:border-slate-700"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Description *</label>
                <textarea
                  rows={3} required value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 p-2.5 dark:bg-slate-800 dark:text-white dark:border-slate-700"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Category</label>
                  <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 p-2.5 dark:bg-slate-800 dark:text-white dark:border-slate-700">
                    <option value="general">General</option>
                    <option value="emergency">Emergency</option>
                    <option value="mess">Mess</option>
                    <option value="maintenance">Maintenance</option>
                    <option value="events">Events</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Priority</label>
                  <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 p-2.5 dark:bg-slate-800 dark:text-white dark:border-slate-700">
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                  </select>
                </div>
              </div>
              <button type="submit" className="w-full rounded-xl bg-indigo-600 py-3 text-xs font-bold text-white shadow-sm hover:bg-indigo-700">
                Publish Announcement
              </button>
            </form>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete announcement?"
        description={`"${deleteTarget?.title}" will be permanently removed for all students.`}
        confirmLabel="Delete"
        destructive
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}