import React, { useEffect, useMemo, useState } from "react";
import { ArrowRightLeft, ScanLine, AlertTriangle, Inbox } from "lucide-react";
import { subscribeCollection } from "@/lib/firestore";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ResponsiveTable, type TableColumn } from "@/components/ui/ResponsiveTable";
import { EmptyState } from "@/components/ui/EmptyState";

type FilterValue = "all" | "ENTRY" | "EXIT" | "failed";

export default function GateActivity() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [filter, setFilter] = useState<FilterValue>("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    const unsub = subscribeCollection("GateLog", (d) => {
      setLogs(d);
      setLoaded(true);
    });
    return () => unsub();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return [...logs]
      .filter((l) => {
        if (filter === "ENTRY" && l.action !== "ENTRY") return false;
        if (filter === "EXIT" && l.action !== "EXIT") return false;
        if (filter === "failed" && !(l.face_match_status === "FAILED" || (l.remarks && String(l.remarks).toLowerCase().includes("fail")))) return false;
        if (q && !String(`${l.student_name || ""} ${l.student_id || ""} ${l.gate_pass_number || ""}`).toLowerCase().includes(q)) return false;
        return true;
      })
      .sort((a, b) => String(b.timestamp || "").localeCompare(String(a.timestamp || "")));
  }, [logs, filter, search]);

  const summary = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const todayLogs = logs.filter((l) => String(l.timestamp || "").startsWith(today));
    return {
      total: todayLogs.length,
      exits: todayLogs.filter((l) => l.action === "EXIT").length,
      entries: todayLogs.filter((l) => l.action === "ENTRY").length,
      denied: todayLogs.filter((l) => l.face_match_status === "FAILED" || String(l.remarks || "").toLowerCase().includes("fail")).length,
    };
  }, [logs]);

  const columns: TableColumn<any>[] = [
    {
      key: "student",
      header: "Student",
      render: (l) => (
        <div className="flex items-center gap-2">
          <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${l.action === "EXIT" ? "bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-300" : "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-300"}`}>
            <ArrowRightLeft className="h-3.5 w-3.5" />
          </span>
          <div>
            <p className="font-bold text-slate-900 dark:text-white">{l.student_name}</p>
            <p className="text-[11px] text-slate-400">{l.student_id}</p>
          </div>
        </div>
      ),
    },
    {
      key: "action",
      header: "Action",
      render: (l) => <StatusBadge status={l.action === "EXIT" ? "outside" : "inside"} size="sm" />,
      className: "",
    },
    {
      key: "method",
      header: "Verify",
      cardHidden: true,
      render: (l) => {
        const method = String(l.verification_method || "").toLowerCase();
        const face = method.includes("face");
        const qr = method.includes("qr");
        const chip = face && qr ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300" : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300";
        return <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${chip}`}>{l.verification_method}</span>;
      },
    },
    { key: "pass", header: "Gate Pass", cardHidden: true, render: (l) => <span className="text-slate-600 dark:text-slate-300">{l.gate_pass_number || "—"}</span> },
    {
      key: "face",
      header: "Face / Liveness",
      cardHidden: true,
      render: (l) => {
        const faceOk = l.face_match_status !== "FAILED";
        const liveOk = l.liveness_status !== "FAILED";
        return (
          <span className={`inline-flex items-center gap-1 text-[10px] font-bold ${faceOk && liveOk ? "text-emerald-600" : "text-red-500"}`}>
            {faceOk && liveOk ? <ScanLine className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
            {l.face_match_status || "—"} · {l.liveness_status || "—"}
          </span>
        );
      },
    },
    { key: "gate", header: "Gate", cardHidden: true, render: (l) => <span className="text-slate-500">{l.gate_id || "main-gate-1"}</span> },
    {
      key: "time",
      header: "Time",
      render: (l) =>
        l.timestamp ? (
          <span className="text-slate-500">
            {new Date(l.timestamp).toLocaleString([], { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
          </span>
        ) : (
          "—"
        ),
    },
  ];

  const filters: { key: FilterValue; label: string; count: number }[] = [
    { key: "all", label: "All", count: summary.total },
    { key: "EXIT", label: "Exits", count: summary.exits },
    { key: "ENTRY", label: "Entries", count: summary.entries },
    { key: "failed", label: "Denied", count: summary.denied },
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-5 pb-4">
      <PageHeader title="Gate Activity & Audit Log" subtitle="Append-only entry/exit log recorded at the security scanner" />

      {/* Summary chips */}
      <div className="flex flex-wrap items-center gap-2">
        {filters.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`rounded-full px-3 py-1.5 text-[11px] font-bold transition ${
              filter === f.key
                ? "bg-indigo-600 text-white"
                : "bg-white text-slate-600 ring-1 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700"
            }`}
          >
            {f.label} · {f.count}
          </button>
        ))}
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name / ID / pass…"
          className="ml-auto w-48 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 outline-none focus:border-indigo-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
        />
      </div>

      <ResponsiveTable
        columns={columns}
        rows={filtered}
        loading={!loaded}
        rowKey={(l) => l.id}
        className="-mx-4 sm:mx-0"
        empty={
          <EmptyState
            title="No matching gate activity"
            description="Verified scans made through the gate scanner appear here. None match the current filter."
            icon={Inbox}
          />
        }
        cardHeader={(l) => (
          <div className="flex items-center gap-2">
            <StatusBadge status={l.action === "EXIT" ? "outside" : "inside"} size="sm" />
            <span className="truncate">{l.student_name}</span>
          </div>
        )}
        cardActions={() => null}
        cardBody={(l) => (
          <>
            {[
              ["ID", l.student_id || "—"],
              ["Pass", l.gate_pass_number || "—"],
              ["Verify", l.verification_method || "—"],
              ["Time", l.timestamp ? new Date(l.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—"],
            ].map(([k, v]) => (
              <div key={k}>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{k}</span>
                <span className="mt-0.5 block text-xs font-semibold text-slate-700 dark:text-slate-200">{v}</span>
              </div>
            ))}
          </>
        )}
      />
    </div>
  );
}