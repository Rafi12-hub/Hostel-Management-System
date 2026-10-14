import React, { useState, useEffect, useMemo } from "react";
import { UserCheck, Users, CalendarCheck, Clock, Search, ScanFace } from "lucide-react";
import { subscribeCollection } from "@/lib/firestore";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import { ResponsiveTable, type TableColumn } from "@/components/ui/ResponsiveTable";
import { Button } from "@/components/ui/Button";
import { FaceAttendanceScanner } from "@/components/faceRecognition/FaceAttendanceScanner";

const STATUS_TONE: Record<string, string> = {
  present: "bg-emerald-500",
  outside: "bg-amber-500",
  leave: "bg-blue-500",
  late: "bg-rose-500",
};

export default function Attendance() {
  const [students, setStudents] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [selectedHostel, setSelectedHostel] = useState("all");
  const [frsOpen, setFrsOpen] = useState(false);

  useEffect(() => {
    const unsub = subscribeCollection("Student", setStudents);
    return () => unsub();
  }, []);

  const total = Math.max(students.length, 1);
  const present = students.filter((s) => s.status === "present").length;
  const outside = students.filter((s) => s.status === "outside").length;
  const leave = students.filter((s) => s.status === "leave").length;
  const late = students.filter((s) => s.status === "late").length;
  const pct = Math.round((present / total) * 100);

  const filtered = useMemo(
    () =>
      students.filter((s) => {
        const matchesSearch =
          s.name.toLowerCase().includes(search.toLowerCase()) ||
          (s.student_id || "").toLowerCase().includes(search.toLowerCase());
        const matchesHostel = selectedHostel === "all" || s.hostel === selectedHostel;
        return matchesSearch && matchesHostel;
      }),
    [students, search, selectedHostel]
  );

  const columns: TableColumn<any>[] = [
    {
      key: "student",
      header: "Student",
      render: (s) => (
        <div className="flex items-center gap-2.5">
          <img src={s.photo_url} alt={s.name} className="h-8 w-8 shrink-0 rounded-full object-cover" />
          <div className="min-w-0">
            <p className="truncate font-bold text-slate-900 dark:text-white">{s.name}</p>
            <p className="text-[10px] font-mono text-indigo-600 dark:text-indigo-400">{s.student_id}</p>
          </div>
        </div>
      ),
    },
    {
      key: "hostel",
      header: "Hostel & Room",
      render: (s) => (
        <div>
          <p className="max-w-[180px] truncate font-semibold text-slate-800 dark:text-slate-200">{s.hostel}</p>
          <p className="text-[10px] text-slate-500">{s.block} · Room {s.room}</p>
        </div>
      ),
    },
    {
      key: "lastActivity",
      header: "Last Gate Activity",
      cardHidden: true,
      render: () => (
        <span className="text-slate-500">Biometric Verified Today</span>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (s) => <StatusBadge status={s.status} size="sm" />,
    },
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-5 pb-4">
      <PageHeader
        title="Resident Attendance"
        subtitle="Live occupancy and attendance status across all hostel blocks"
        actions={
          <Button onClick={() => setFrsOpen(true)}>
            <ScanFace className="h-4 w-4" /> Face Recognition
          </Button>
        }
      />

      {/* Overall summary hero */}
      <section className="overflow-hidden rounded-[1.25rem] border border-slate-200 bg-white shadow-card dark:border-slate-800 dark:bg-slate-900">
        <div className="p-4 sm:p-5">
          <div className="flex items-center gap-4">
            <div className="relative flex h-20 w-20 shrink-0 items-center justify-center">
              <svg viewBox="0 0 100 100" className="h-20 w-20 -rotate-90">
                <circle cx="50" cy="50" r="42" fill="none" stroke="currentColor" strokeWidth="10" className="text-slate-100 dark:text-slate-800" />
                <circle
                  cx="50" cy="50" r="42" fill="none"
                  stroke="currentColor" strokeWidth="10" strokeLinecap="round"
                  strokeDasharray={`${(pct / 100) * 263.9} 263.9`}
                  className="text-indigo-600 transition-all duration-700"
                />
              </svg>
              <div className="absolute text-center">
                <p className="font-display text-xl font-extrabold text-slate-900 dark:text-white">{pct}%</p>
                <p className="text-[8px] font-bold uppercase tracking-wider text-slate-400">On Site</p>
              </div>
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">Residents Present</h2>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                {present} of {students.length} residents currently inside the hostel
              </p>
              <div className="mt-3 flex h-2 w-full max-w-xs overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                {[
                  ["present", present],
                  ["outside", outside],
                  ["leave", leave],
                  ["late", late],
                ].map(([key, count]) =>
                  (count as number) > 0 ? (
                    <div
                      key={key as string}
                      style={{ width: `${((count as number) / total) * 100}%` }}
                      className={`${STATUS_TONE[key as string]} h-full`}
                    />
                  ) : null
                )}
              </div>
              <div className="mt-2 flex flex-wrap gap-3 text-[10px] font-bold">
                <span className="flex items-center gap-1 text-emerald-600"><span className="h-2 w-2 rounded-full bg-emerald-500" /> Present {present}</span>
                <span className="flex items-center gap-1 text-amber-600"><span className="h-2 w-2 rounded-full bg-amber-500" /> Outside {outside}</span>
                <span className="flex items-center gap-1 text-blue-600"><span className="h-2 w-2 rounded-full bg-blue-500" /> Leave {leave}</span>
                <span className="flex items-center gap-1 text-rose-600"><span className="h-2 w-2 rounded-full bg-rose-500" /> Late {late}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-px border-t border-slate-100 bg-slate-100 dark:border-slate-800 dark:bg-slate-800">
          {[
            ["Present", present, "text-emerald-600", UserCheck],
            ["Outside", outside, "text-amber-600", Users],
            ["Leave", leave, "text-blue-600", CalendarCheck],
            ["Late", late, "text-rose-600", Clock],
          ].map(([label, value, tone, Icon]: any) => (
            <div key={label} className="flex items-center gap-2.5 bg-white p-3 dark:bg-slate-900 sm:p-3.5">
              <span className={`flex h-9 w-9 items-center justify-center rounded-xl bg-slate-50 dark:bg-slate-800 ${tone}`}>
                <Icon className="h-4.5 w-4.5" />
              </span>
              <div>
                <p className="text-base font-extrabold text-slate-900 dark:text-white">{value}</p>
                <p className="text-[10px] font-bold text-slate-400">{label}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Search + filter */}
      <div className="flex flex-col gap-2.5 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search student attendance…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-4 text-xs text-slate-900 shadow-sm focus:border-indigo-300 dark:border-slate-800 dark:bg-slate-900 dark:text-white"
          />
        </div>
        <select
          value={selectedHostel}
          onChange={(e) => setSelectedHostel(e.target.value)}
          className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs text-slate-900 shadow-sm sm:flex-none dark:border-slate-800 dark:bg-slate-900 dark:text-white"
        >
          <option value="all">All Hostels</option>
          <option value="APJ Abdul Kalam Boys Hostel (BH-1)">BH-1 (APJ Abdul Kalam)</option>
          <option value="CV Raman Boys Hostel (BH-2)">BH-2 (CV Raman)</option>
          <option value="Kalpana Chawla Girls Hostel (GH-1)">GH-1 (Kalpana Chawla)</option>
        </select>
      </div>

      {/* Responsive table: mobile cards + desktop table */}
      <ResponsiveTable
        columns={columns}
        rows={filtered.slice(0, 20)}
        rowKey={(s) => s.id}
        cardHeader={(s) => (
          <div className="flex items-center gap-3">
            <img src={s.photo_url} alt={s.name} className="h-10 w-10 shrink-0 rounded-full object-cover" />
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-slate-900 dark:text-white">{s.name}</p>
              <p className="text-[11px] font-mono text-indigo-600 dark:text-indigo-400">{s.student_id}</p>
            </div>
          </div>
        )}
        cardBody={(s) => (
          <div className="flex items-center justify-between pt-1 text-xs">
            <span className="truncate font-semibold text-slate-500">{s.block} · Room {s.room}</span>
            <StatusBadge status={s.status} size="sm" />
          </div>
        )}
        empty={
          <EmptyState title="No residents match" description="Try a different search or hostel filter." icon={Users} />
        }
      />

      {frsOpen && <FaceAttendanceScanner onClose={() => setFrsOpen(false)} />}
    </div>
  );
}