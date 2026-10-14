import React, { useState, useEffect } from "react";
import { CheckCircle, MessageSquareText, Loader2 } from "lucide-react";
import { filterCollection, updateRecord, createRecord } from "@/lib/firestore";
import { useDemoAuth } from "@/context/DemoAuthContext";
import { whatsappConfigured, processWhatsAppQueue } from "@/lib/whatsappNotifier";
import { PageHeader } from "@/components/ui/PageHeader";

export default function Settings() {
  const { user } = useDemoAuth();
  const [statusMessage, setStatusMessage] = useState("All Systems Operational");
  const [saved, setSaved] = useState(false);
  const [waBusy, setWaBusy] = useState(false);
  const [waResult, setWaResult] = useState<{ processed: number; sent: number; failed: number } | null>(null);

  useEffect(() => {
    filterCollection("Settings", { key: "hostel_status" }).then((res) => {
      if (res.length > 0) setStatusMessage(res[0].value);
    });
  }, []);

  const handleSaveStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await filterCollection("Settings", { key: "hostel_status" });
    if (res.length > 0) {
      await updateRecord("Settings", res[0].id, { value: statusMessage });
    } else {
      await createRecord("Settings", { key: "hostel_status", value: statusMessage, category: "system" });
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const flushQueue = async () => {
    setWaBusy(true);
    const res = await processWhatsAppQueue().catch(() => ({ processed: 0, sent: 0, failed: 0 }));
    setWaResult(res);
    setWaBusy(false);
  };

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <PageHeader
        title="System Configuration & Preferences"
        subtitle="Manage global operational banners, role switches, and notification behavior"
      />

      {saved && (
        <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4 text-xs font-bold text-emerald-800 flex items-center gap-2">
          <CheckCircle className="h-4 w-4 text-emerald-600" /> System settings updated successfully!
        </div>
      )}

      {/* Public Status Banner Setting */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-md dark:border-slate-800 dark:bg-slate-900 space-y-4">
        <h3 className="text-base font-extrabold text-slate-900 dark:text-white">Public Campus Status Message</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          This message is displayed prominently on the public homepage live status badge.
        </p>

        <form onSubmit={handleSaveStatus} className="space-y-4 text-xs">
          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Status Banner Text</label>
            <input
              type="text"
              required
              value={statusMessage}
              onChange={(e) => setStatusMessage(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs font-semibold text-slate-900 dark:bg-slate-800 dark:border-slate-700 dark:text-white"
            />
          </div>

          <button type="submit" className="rounded-xl bg-indigo-600 px-6 py-2.5 text-xs font-bold text-white shadow-md hover:bg-indigo-700">
            Save Status Banner
          </button>
        </form>
      </div>

      {/* Parent WhatsApp Notifications */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-md dark:border-slate-800 dark:bg-slate-900 space-y-4">
        <h3 className="text-base font-extrabold text-slate-900 dark:text-white">Parent WhatsApp Notifications</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Gate exit/entry, leave approvals and overdue alerts are queued (deduped, retried) and delivered to the
          student&apos;s parent on record.
        </p>

        <div className="flex flex-wrap items-center gap-2">
          <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold ${
            whatsappConfigured()
              ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"
              : "bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300"
          }`}>
            {whatsappConfigured()
              ? "WhatsApp Cloud API configured — live delivery"
              : "Simulation mode — set VITE_WHATSAPP_API_TOKEN & VITE_WHATSAPP_PHONE_NUMBER_ID to enable live delivery"}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => void flushQueue()}
            disabled={waBusy}
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-6 py-2.5 text-xs font-bold text-white shadow-md hover:bg-indigo-700 disabled:opacity-60"
          >
            {waBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageSquareText className="h-4 w-4" />}
            Flush pending notifications
          </button>
          {waResult && (
            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
              Processed {waResult.processed} · sent {waResult.sent} · failed {waResult.failed}
            </span>
          )}
        </div>
      </div>

      {/* Account Information */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-md dark:border-slate-800 dark:bg-slate-900 space-y-3">
        <h3 className="text-base font-extrabold text-slate-900 dark:text-white">Signed In As</h3>
        <div className="flex items-center gap-3">
          <img
            src={user?.avatarUrl}
            alt={user?.name}
            className="h-12 w-12 rounded-full border border-slate-200 object-cover dark:border-slate-700"
          />
          <div>
            <p className="text-sm font-bold text-slate-900 dark:text-white">{user?.name}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">{user?.email} · {user?.role}</p>
          </div>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Your login credentials are managed by the administrator. Contact the hostel admin to reset your password.
        </p>
      </div>
    </div>
  );
}
