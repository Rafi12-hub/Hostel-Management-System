import React, { useState, useEffect } from "react";
import { Grid, Building, CheckCircle2, AlertTriangle } from "lucide-react";
import { listCollection } from "@/lib/firestore";
import { KpiCard } from "@/components/ui/KpiCard";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { PageHeader } from "@/components/ui/PageHeader";

export default function RoomAvailability() {
  const [rooms, setRooms] = useState<any[]>([]);
  const [selectedHostel, setSelectedHostel] = useState("all");
  const [selectedBlock, setSelectedBlock] = useState("all");
  const [selectedFloor, setSelectedFloor] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("all");

  useEffect(() => {
    listCollection("Room").then(setRooms);
  }, []);

  const totalRooms = rooms.length;
  const vacantRooms = rooms.filter((r) => r.status === "vacant").length;
  const occupiedRooms = rooms.filter((r) => r.status === "occupied").length;
  const maintenanceRooms = rooms.filter((r) => r.status === "maintenance").length;

  const filtered = rooms.filter((r) => {
    const matchesHostel = selectedHostel === "all" || r.hostel === selectedHostel;
    const matchesBlock = selectedBlock === "all" || r.block === selectedBlock;
    const matchesFloor = selectedFloor === "all" || String(r.floor) === selectedFloor;
    const matchesStatus = selectedStatus === "all" || r.status === selectedStatus;
    return matchesHostel && matchesBlock && matchesFloor && matchesStatus;
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Visual Room Availability Grid"
        subtitle="Real-time room allocation status across all hostel blocks and floors"
      />

      {/* KPIs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <KpiCard label="Total Hostel Rooms" value={totalRooms} icon={Grid} tone="slate" />
        <KpiCard label="Fully Vacant Rooms" value={vacantRooms} icon={CheckCircle2} tone="green" />
        <KpiCard label="Occupied Rooms" value={occupiedRooms} icon={Building} tone="indigo" />
        <KpiCard label="Under Maintenance" value={maintenanceRooms} icon={AlertTriangle} tone="amber" />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 bg-white p-4 rounded-xl border border-slate-200 dark:border-slate-800 dark:bg-slate-900 shadow-sm">
        <select
          value={selectedHostel}
          onChange={(e) => setSelectedHostel(e.target.value)}
          className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
        >
          <option value="all">All Hostels</option>
          <option value="APJ Abdul Kalam Boys Hostel (BH-1)">BH-1 (APJ Abdul Kalam)</option>
          <option value="CV Raman Boys Hostel (BH-2)">BH-2 (CV Raman)</option>
          <option value="Kalpana Chawla Girls Hostel (GH-1)">GH-1 (Kalpana Chawla)</option>
        </select>

        <select
          value={selectedBlock}
          onChange={(e) => setSelectedBlock(e.target.value)}
          className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
        >
          <option value="all">All Blocks</option>
          <option value="Block A">Block A</option>
          <option value="Block B">Block B</option>
        </select>

        <select
          value={selectedFloor}
          onChange={(e) => setSelectedFloor(e.target.value)}
          className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
        >
          <option value="all">All Floors</option>
          <option value="1">1st Floor</option>
          <option value="2">2nd Floor</option>
          <option value="3">3rd Floor</option>
        </select>

        <select
          value={selectedStatus}
          onChange={(e) => setSelectedStatus(e.target.value)}
          className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
        >
          <option value="all">All Statuses</option>
          <option value="vacant">Vacant</option>
          <option value="occupied">Occupied</option>
          <option value="maintenance">Maintenance</option>
        </select>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8">
        {filtered.map((r) => {
          const isVacant = r.status === "vacant";
          const isMaint = r.status === "maintenance";

          return (
            <div
              key={r.id}
              className={`rounded-xl border p-3 text-center transition-all ${
                isVacant
                  ? "border-emerald-300 bg-emerald-50 text-emerald-900 dark:bg-emerald-950/60 dark:border-emerald-800 dark:text-emerald-200"
                  : isMaint
                  ? "border-amber-300 bg-amber-50 text-amber-900 dark:bg-amber-950/60 dark:border-amber-800 dark:text-amber-200"
                  : "border-slate-200 bg-white text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
              }`}
            >
              <h4 className="text-sm font-extrabold">{r.room_number}</h4>
              <p className="text-[10px] opacity-80">{r.block}</p>
              <div className="mt-2 flex justify-center">
                <StatusBadge status={r.status} size="sm" className="text-[9px] px-1.5 py-0" />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
