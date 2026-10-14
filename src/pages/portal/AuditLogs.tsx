import React, { useState, useEffect } from "react";
import { Search, ScrollText } from "lucide-react";
import { subscribeCollection } from "@/lib/firestore";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { ResponsiveTable, type TableColumn } from "@/components/ui/ResponsiveTable";

export default function AuditLogs() {
  const [logs, setLogs] = useState<any[]>([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const unsub = subscribeCollection("ActivityLog", setLogs);
    return () => unsub();
  }, []);

  const filtered = logs.filter(
    (l) =>
      l.user.toLowerCase().includes(search.toLowerCase()) ||
      l.action.toLowerCase().includes(search.toLowerCase()) ||
      l.module.toLowerCase().includes(search.toLowerCase())
  );

  const columns: TableColumn<any>[] = [
    {
      key: "timestamp",
      header: "Timestamp",
      render: (l) => (
        <span className="text-[11px] font-mono text-slate-500">
          {new Date(l.timestamp).toLocaleString()}
        </span>
      ),
    },
    {
      key: "user",
      header: "User & Role",
      render: (l) => (
        <div>
          <p className="font-bold text-slate-900 dark:text-white">{l.user}</p>
          <p className="text-[10px] capitalize text-indigo-600 dark:text-indigo-400">{l.role}</p>
        </div>
      ),
    },
    {
      key: "module",
      header: "Module",
      cardHidden: true,
      render: (l) => <span className="font-semibold text-slate-800 dark:text-slate-200">{l.module}</span>,
    },
    {
      key: "action",
      header: "Action Details",
      render: (l) => <span className="max-w-[300px] truncate text-slate-700 dark:text-slate-300">{l.action}</span>,
    },
    {
      key: "record",
      header: "Record ID",
      cardHidden: true,
      render: (l) => <span className="font-mono text-[10px] text-slate-400">{l.record}</span>,
    },
  ];

  return (
    <div className="space-y-5 sm:space-y-6">
      <PageHeader
        title="System Audit Trail"
        subtitle="Immutable history of all administrative write, update, and delete actions"
      />

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by user, action, or module..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-4 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          />
        </div>
      </div>

      <ResponsiveTable
        columns={columns}
        rows={filtered}
        rowKey={(l) => l.id}
        cardHeader={(l) => (
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-slate-900 dark:text-white">{l.user}</p>
            <p className="text-[11px] capitalize text-indigo-600 dark:text-indigo-400">{l.role} · {l.module}</p>
          </div>
        )}
        cardBody={(l) => (
          <div className="space-y-1 text-xs">
            <p className="truncate text-slate-700 dark:text-slate-300">{l.action}</p>
            <p className="font-mono text-[10px] text-slate-400">
              {new Date(l.timestamp).toLocaleString()}
            </p>
          </div>
        )}
        empty={
          <EmptyState icon={ScrollText} title="No audit logs" description="System activity logs will appear here." />
        }
      />
    </div>
  );
}