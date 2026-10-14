import React, { useState, useEffect } from "react";
import { Search, ArrowRightLeft } from "lucide-react";
import { subscribeCollection } from "@/lib/firestore";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { ResponsiveTable, type TableColumn } from "@/components/ui/ResponsiveTable";

export default function EntryExit() {
  const [logs, setLogs] = useState<any[]>([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const unsub = subscribeCollection("EntryExit", setLogs);
    return () => unsub();
  }, []);

  const filtered = logs.filter((l) => {
    const q = search.toLowerCase();
    return (
      (l.student_name || "").toLowerCase().includes(q) ||
      (l.student_id || "").toLowerCase().includes(q) ||
      (l.transaction_id || "").toLowerCase().includes(q)
    );
  });

  const columns: TableColumn<any>[] = [
    {
      key: "txn",
      header: "Txn ID",
      render: (l) => <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">{l.transaction_id}</span>,
    },
    {
      key: "student",
      header: "Student Details",
      render: (l) => (
        <div>
          <p className="font-bold text-slate-900 dark:text-white">{l.student_name}</p>
          <p className="text-[10px] text-slate-500">{l.hostel} · Room {l.room}</p>
        </div>
      ),
    },
    {
      key: "gate",
      header: "Gate & Officer",
      cardHidden: true,
      render: (l) => (
        <div>
          <p className="font-semibold text-slate-800 dark:text-slate-200">{l.gate}</p>
          <p className="text-[10px] text-slate-500">{l.security_staff || "Security Desk"}</p>
        </div>
      ),
    },
    {
      key: "exit",
      header: "Exit Time",
      render: (l) => <span className="text-slate-800 dark:text-slate-200">{l.exit_time}</span>,
    },
    {
      key: "expected",
      header: "Expected Return",
      cardHidden: true,
      render: (l) => <span className="text-slate-800 dark:text-slate-200">{l.expected_return}</span>,
    },
    {
      key: "actual",
      header: "Actual Return",
      cardHidden: true,
      render: (l) => <span className="text-slate-800 dark:text-slate-200">{l.actual_return || "—"}</span>,
    },
    {
      key: "status",
      header: "Status",
      render: (l) => <StatusBadge status={l.status} size="sm" />,
    },
  ];

  return (
    <div className="space-y-5 sm:space-y-6">
      <PageHeader
        title="Gate Entry & Exit Logs"
        subtitle="Real-time audit trail of student movements across campus security gates"
      />

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by student name, ID, or transaction ID..."
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
          <div className="flex items-center justify-between">
            <div className="min-w-0">
              <p className="truncate font-mono text-sm font-bold text-indigo-600 dark:text-indigo-400">{l.transaction_id}</p>
              <p className="text-xs font-bold text-slate-900 dark:text-white">{l.student_name}</p>
            </div>
            <StatusBadge status={l.status} size="sm" />
          </div>
        )}
        cardBody={(l) => (
          <div className="space-y-1 text-xs">
            <p className="text-slate-500">{l.hostel} · Room {l.room}</p>
            <div className="flex items-center justify-between text-slate-600 dark:text-slate-300">
              <span>Exit: {l.exit_time}</span>
              <span>Return: {l.actual_return || l.expected_return}</span>
            </div>
          </div>
        )}
        empty={
          <EmptyState icon={ArrowRightLeft} title="No gate transactions" description="Transaction logs will appear when students exit/enter." />
        }
      />
    </div>
  );
}