import React, { useState, useEffect } from "react";
import { MessageSquareText, Send, Users, CheckCircle2, Phone } from "lucide-react";
import { subscribeCollection } from "@/lib/firestore";
import { broadcastToParents } from "@/lib/parentNotifier";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { KpiCard } from "@/components/ui/KpiCard";
import { PageHeader } from "@/components/ui/PageHeader";
import { ResponsiveModal } from "@/components/ui/ResponsiveModal";
import { ResponsiveTable, type TableColumn } from "@/components/ui/ResponsiveTable";
import { FormField } from "@/components/ui/FormField";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";

const INPUT = "w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white";

export default function ParentNotifications() {
  const [log, setLog] = useState<any[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [broadcastMsg, setBroadcastMsg] = useState("");
  const [broadcasting, setBroadcasting] = useState(false);
  const { success: toastSuccess } = useToast();

  useEffect(() => {
    const unsub = subscribeCollection("ParentNotification", (data) => {
      const sorted = [...data].sort(
        (a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
      );
      setLog(sorted);
    });
    return () => unsub();
  }, []);

  const delivered = log.filter((n) => n.status === "delivered").length;
  const critical = log.filter((n) => n.priority === "critical").length;
  const unique = new Set(log.map((n) => n.parent_phone)).size;

  const handleBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!broadcastMsg.trim() || broadcasting) return;
    setBroadcasting(true);
    const count = await broadcastToParents(broadcastMsg.trim());
    toastSuccess(`${count} parent SMS dispatched successfully.`);
    setBroadcastMsg("");
    setModalOpen(false);
    setBroadcasting(false);
  };

  const columns: TableColumn<any>[] = [
    {
      key: "parent",
      header: "Parent",
      render: (n) => (
        <div>
          <p className="font-bold text-slate-900 dark:text-white">{n.parent_name}</p>
          <p className="text-[10px] text-slate-500">{n.student_name} ({n.student_id})</p>
        </div>
      ),
    },
    {
      key: "contact",
      header: "Contact",
      cardHidden: true,
      render: (n) => <span className="font-mono text-slate-800 dark:text-slate-200">{n.parent_phone}</span>,
    },
    {
      key: "student",
      header: "Student",
      cardHidden: true,
      render: (n) => (
        <span className="text-slate-800 dark:text-slate-200">
          {n.hostel ? n.hostel.split(" ")[0] : "—"}
          {n.room ? ` · Room ${n.room}` : ""}
        </span>
      ),
    },
    {
      key: "event",
      header: "Event / Message",
      render: (n) => (
        <div>
          <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-bold uppercase text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
            {n.event}
          </span>
          <p className="mt-1 max-w-[250px] text-[11px] leading-tight text-slate-500 line-clamp-2">{n.message}</p>
        </div>
      ),
    },
    {
      key: "channel",
      header: "Channel",
      cardHidden: true,
      render: (n) => <span className="text-[10px] font-bold uppercase text-slate-500">{n.channel}</span>,
    },
    {
      key: "status",
      header: "Status",
      render: (n) => (
        <div>
          <StatusBadge status={n.status} size="sm" />
          {n.provider_ref && <p className="mt-0.5 font-mono text-[9px] text-slate-400">{n.provider_ref}</p>}
        </div>
      ),
    },
    {
      key: "delivered",
      header: "Delivered At",
      cardHidden: true,
      render: (n) => (
        <span className="text-[10px] text-slate-500">
          {n.delivered_at
            ? new Date(n.delivered_at).toLocaleString([], { dateStyle: "short", timeStyle: "short" })
            : "—"}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-5 sm:space-y-6">
      <PageHeader
        title="Parent Notifications"
        subtitle="Automated SMS updates to parents for gate pass, leave, and emergency events"
        actions={
          <Button onClick={() => setModalOpen(true)}>
            <Send className="h-4 w-4" /> Broadcast
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4">
        <KpiCard label="Total Dispatched" value={log.length} icon={MessageSquareText} tone="indigo" />
        <KpiCard label="Delivered SMS" value={delivered} icon={CheckCircle2} tone="green" />
        <KpiCard label="Parents Reached" value={unique} icon={Users} tone="blue" />
        <KpiCard label="Critical Alerts" value={critical} icon={Phone} tone="red" />
      </div>

      <div className="rounded-2xl border border-indigo-100 bg-indigo-50/60 p-4 text-xs text-indigo-700 leading-relaxed dark:border-indigo-900 dark:bg-indigo-950/40 dark:text-indigo-300 sm:p-5">
        <h4 className="mb-1 text-sm font-extrabold text-indigo-900 dark:text-indigo-200">
          Automated Parent Communication
        </h4>
        <p>
          Parents are automatically notified via SMS whenever a resident logs out of the gate, returns,
          has an outstation leave approved, or during an emergency broadcast.
        </p>
      </div>

      <ResponsiveTable
        columns={columns}
        rows={log}
        rowKey={(n) => n.id}
        cardHeader={(n) => (
          <div className="flex items-center justify-between">
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-slate-900 dark:text-white">{n.parent_name}</p>
              <p className="text-[11px] text-slate-500">{n.student_name}</p>
            </div>
            <StatusBadge status={n.status} size="sm" />
          </div>
        )}
        cardBody={(n) => (
          <div className="space-y-1 text-xs">
            <span className="inline-block rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-bold uppercase text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
              {n.event}
            </span>
            <p className="line-clamp-2 text-slate-500">{n.message}</p>
          </div>
        )}
        empty={
          <div className="py-10 text-center text-sm font-semibold text-slate-400">
            No parent notifications dispatched yet.
          </div>
        }
      />

      <ResponsiveModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Parent SMS Broadcast"
        footer={
          <div className="flex gap-3">
            <Button variant="secondary" fullWidth onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button fullWidth form="broadcast-form" type="submit" loading={broadcasting}>
              <Send className="h-4 w-4" /> Send Broadcast
            </Button>
          </div>
        }
      >
        <form id="broadcast-form" onSubmit={handleBroadcast} className="space-y-4">
          <FormField label="Emergency / Circular Message" required>
            <textarea
              rows={4}
              required
              value={broadcastMsg}
              onChange={(e) => setBroadcastMsg(e.target.value)}
              placeholder="e.g. Due to heavy rains, all residents must remain inside tonight."
              className={INPUT}
            />
            <p className="mt-1 text-[10px] text-slate-400">This SMS will be sent to every resident parent on file.</p>
          </FormField>
        </form>
      </ResponsiveModal>
    </div>
  );
}