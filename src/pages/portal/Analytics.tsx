import React, { useState, useEffect, useMemo } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
} from "recharts";
import { PageHeader } from "@/components/ui/PageHeader";
import { subscribeCollection } from "@/lib/firestore";

const STATUS_COLORS: Record<string, string> = {
  PRESENT: "#10b981",
  LATE: "#f59e0b",
  OUTSIDE: "#fbbf24",
  ON_LEAVE: "#3b82f6",
  PENDING: "#ef4444",
  UNKNOWN: "#a855f7",
};

export default function Analytics() {
  const [records, setRecords] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);

  useEffect(() => {
    const unsub1 = subscribeCollection("NightRollCallRecords", (d: any) => setRecords(d));
    const unsub2 = subscribeCollection("Student", (d: any) => setStudents(d));
    return () => { unsub1(); unsub2(); };
  }, []);

  // Night Roll Call analytics (live)
  const nrc = useMemo(() => {
    // Local calendar date (consistent with the rest of the app's time handling).
    const d = new Date();
    const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    // Only count records created for today's roll-call window so historical
    // nights don't inflate today's completion stats.
    const todayRecords = records.filter((r) => {
      if (!r.completedAt) return false;
      const rd = new Date(r.completedAt);
      if (isNaN(rd.getTime())) return false;
      const rdate = `${rd.getFullYear()}-${String(rd.getMonth() + 1).padStart(2, "0")}-${String(rd.getDate()).padStart(2, "0")}`;
      return rdate === today;
    });

    const total = students.length;
    const byStatus: Record<string, number> = {};
    todayRecords.forEach((r) => { byStatus[r.status] = (byStatus[r.status] || 0) + 1; });

    const completion = total ? Math.round(((byStatus.PRESENT || 0) + (byStatus.LATE || 0)) / total * 100) : 0;

    const byId = new Map<string, any>();
    students.forEach((s) => byId.set(String(s.student_id || "").trim().toUpperCase(), s));

    const completionByHostel = new Map<string, { done: number; total: number }>();
    students.forEach((s) => {
      const key = (s.hostel || "Unknown").split(" ")[0];
      const cur = completionByHostel.get(key) || { done: 0, total: 0 };
      cur.total += 1;
      completionByHostel.set(key, cur);
    });
    todayRecords.forEach((r) => {
      const st = byId.get(String(r.studentId || "").trim().toUpperCase());
      if ((r.status === "PRESENT" || r.status === "LATE") && st) {
        const key = (st.hostel || "Unknown").split(" ")[0];
        const cur = completionByHostel.get(key);
        if (cur) cur.done += 1;
      }
    });
    const byHostelData = Array.from(completionByHostel.entries()).map(([name, v]) => ({
      name, Completion: v.total ? Math.round((v.done / v.total) * 100) : 0,
    }));

    const byBlock = new Map<string, { done: number; total: number }>();
    students.forEach((s) => {
      const key = s.block || "N/A";
      const cur = byBlock.get(key) || { done: 0, total: 0 };
      cur.total += 1;
      byBlock.set(key, cur);
    });
    todayRecords.forEach((r) => {
      const st = students.find((s) => String(s.student_id).trim().toUpperCase() === String(r.studentId).trim().toUpperCase());
      if ((r.status === "PRESENT" || r.status === "LATE") && st) {
        const key = st.block || "N/A";
        const cur = byBlock.get(key);
        if (cur) cur.done += 1;
      }
    });
    const byBlockData = Array.from(byBlock.entries()).map(([name, v]) => ({
      name, Completion: v.total ? Math.round((v.done / v.total) * 100) : 0,
    }));

    const byFloor = new Map<string, { done: number; total: number }>();
    students.forEach((s) => {
      const key = String(s.floor || "N/A");
      const cur = byFloor.get(key) || { done: 0, total: 0 };
      cur.total += 1;
      byFloor.set(key, cur);
    });
    todayRecords.forEach((r) => {
      const st = students.find((s) => String(s.student_id).trim().toUpperCase() === String(r.studentId).trim().toUpperCase());
      if ((r.status === "PRESENT" || r.status === "LATE") && st) {
        const key = String(st.floor || "N/A");
        const cur = byFloor.get(key);
        if (cur) cur.done += 1;
      }
    });
    const byFloorData = Array.from(byFloor.entries()).map(([name, v]) => ({
      name: `F${name}`, Completion: v.total ? Math.round((v.done / v.total) * 100) : 0,
    }));

    const completed = todayRecords.filter((r) => r.completedAt && (r.status === "PRESENT" || r.status === "LATE"));
    const avgMs = completed.length
      ? completed.reduce((acc, r) => acc + new Date(r.completedAt).getTime(), 0) / completed.length
      : 0;
    const avgTime = completed.length
      ? new Date(avgMs).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      : "—";

    return { total, byStatus, completion, byHostelData, byBlockData, byFloorData, completed: completed.length, avgTime, late: byStatus.LATE || 0, pending: byStatus.PENDING || 0 };
  }, [records, students]);

  const statusData = Object.entries(nrc.byStatus).map(([name, value]) => ({ name, value: value as number }));

  const occupancyData = [
    { name: "APJ Abdul Kalam (BH-1)", Occupied: 310, Capacity: 350 },
    { name: "CV Raman (BH-2)", Occupied: 265, Capacity: 300 },
    { name: "Kalpana Chawla (GH-1)", Occupied: 378, Capacity: 400 },
  ];

  const maintenanceData = [
    { name: "Electrical", count: 42 },
    { name: "Plumbing", count: 28 },
    { name: "Wi-Fi", count: 35 },
    { name: "Furniture", count: 18 },
    { name: "Sanitation", count: 15 },
  ];

  const gatePassTrend = [
    { day: "Mon", passes: 45 },
    { day: "Tue", passes: 38 },
    { day: "Wed", passes: 52 },
    { day: "Thu", passes: 60 },
    { day: "Fri", passes: 95 },
    { day: "Sat", passes: 140 },
    { day: "Sun", passes: 110 },
  ];

  return (
    <div className="space-y-8">
      <PageHeader
        title="Hostel Analytics & Operations Insights"
        subtitle="Visual analytics on room occupancy, mess dining trends, maintenance volume, and security movements"
      />

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        {/* Occupancy Chart */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-md dark:border-slate-800 dark:bg-slate-900 space-y-4">
          <h3 className="text-base font-extrabold text-slate-900 dark:text-white">Hostel Occupancy vs Capacity</h3>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={occupancyData}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis />
                <Tooltip />
                <Bar dataKey="Occupied" fill="#4f46e5" radius={[6, 6, 0, 0]} />
                <Bar dataKey="Capacity" fill="#cbd5e1" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Gate Pass Trend */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-md dark:border-slate-800 dark:bg-slate-900 space-y-4">
          <h3 className="text-base font-extrabold text-slate-900 dark:text-white">Weekly Gate Pass Frequency</h3>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={gatePassTrend}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="day" />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="passes" stroke="#10b981" strokeWidth={3} dot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Maintenance Breakdown */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-md dark:border-slate-800 dark:bg-slate-900 space-y-4 lg:col-span-2">
          <h3 className="text-base font-extrabold text-slate-900 dark:text-white">Maintenance Complaints by Category</h3>
          <div className="h-64 w-full flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={maintenanceData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis type="number" />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="count" fill="#818cf8" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* ------------------- NIGHT ROLL CALL ANALYTICS ------------------- */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Status distribution */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-md dark:border-slate-800 dark:bg-slate-900 space-y-4 lg:col-span-1">
          <h3 className="text-base font-extrabold text-slate-900 dark:text-white">Night Roll Call Status Distribution</h3>
          <p className="text-xs text-slate-500">Completion: {nrc.completion}% · Avg time {nrc.avgTime} · Late {nrc.late} · Pending {nrc.pending}</p>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={statusData} dataKey="value" nameKey="name" outerRadius={90} label>
                  {statusData.map((entry, idx) => (
                    <Cell key={idx} fill={STATUS_COLORS[entry.name] || "#94a3b8"} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Completion by hostel */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-md dark:border-slate-800 dark:bg-slate-900 space-y-4 lg:col-span-2">
          <h3 className="text-base font-extrabold text-slate-900 dark:text-white">Completion by Hostel</h3>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={nrc.byHostelData}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis domain={[0, 100]} />
                <Tooltip />
                <Bar dataKey="Completion" fill="#10b981" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Completion by block */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-md dark:border-slate-800 dark:bg-slate-900 space-y-4">
          <h3 className="text-base font-extrabold text-slate-900 dark:text-white">Completion by Block</h3>
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={nrc.byBlockData}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis domain={[0, 100]} />
                <Tooltip />
                <Bar dataKey="Completion" fill="#4f46e5" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Completion by floor */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-md dark:border-slate-800 dark:bg-slate-900 space-y-4">
          <h3 className="text-base font-extrabold text-slate-900 dark:text-white">Completion by Floor</h3>
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={nrc.byFloorData}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis domain={[0, 100]} />
                <Tooltip />
                <Bar dataKey="Completion" fill="#8b5cf6" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Trend */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-md dark:border-slate-800 dark:bg-slate-900 space-y-4 lg:col-span-1">
          <h3 className="text-base font-extrabold text-slate-900 dark:text-white">Late & Missing Trend Snapshot</h3>
          <div className="space-y-3">
            {[
              { label: "Late Students", value: nrc.late, color: "bg-orange-500" },
              { label: "Pending (Missing)", value: nrc.pending, color: "bg-red-500" },
              { label: "Outside", value: nrc.byStatus.OUTSIDE || 0, color: "bg-amber-500" },
              { label: "On Leave", value: nrc.byStatus.ON_LEAVE || 0, color: "bg-blue-500" },
              { label: "Completed", value: nrc.completed, color: "bg-emerald-500" },
            ].map((row) => (
              <div key={row.label} className="flex items-center justify-between rounded-xl bg-slate-50 p-3 text-xs dark:bg-slate-800/60">
                <span className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                  <span className={`h-2.5 w-2.5 rounded-full ${row.color}`} /> {row.label}
                </span>
                <span className="font-black text-slate-900 dark:text-white">{row.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
