import React, { useState, useEffect } from "react";
import { BedDouble } from "lucide-react";
import { listCollection, updateRecord } from "@/lib/firestore";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { ResponsiveTable, type TableColumn } from "@/components/ui/ResponsiveTable";

const CONDITION_CHIP: Record<string, string> = {
  excellent: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300",
  good: "bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300",
  needs_repair: "bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300",
  poor: "bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300",
};

export default function Rooms() {
  const [hostels, setHostels] = useState<any[]>([]);
  const [rooms, setRooms] = useState<any[]>([]);

  useEffect(() => {
    Promise.all([listCollection("Hostel"), listCollection("Room")]).then(
      ([h, r]) => {
        setHostels(h);
        setRooms(r);
      }
    );
  }, []);

  const handleUpdateCondition = async (roomId: string, newCondition: string) => {
    await updateRecord("Room", roomId, { condition: newCondition });
    setRooms(await listCollection("Room"));
  };

  const columns: TableColumn<any>[] = [
    {
      key: "room",
      header: "Room",
      render: (rm) => (
        <span className="font-extrabold text-indigo-600 dark:text-indigo-400">Room {rm.room_number}</span>
      ),
    },
    {
      key: "hostel",
      header: "Hostel & Block",
      render: (rm) => (
        <div>
          <p className="font-semibold text-slate-800 dark:text-slate-200">{rm.hostel}</p>
          <p className="text-[10px] text-slate-500">{rm.block} · Floor {rm.floor}</p>
        </div>
      ),
    },
    {
      key: "occupancy",
      header: "Occupancy",
      render: (rm) => {
        const cap = rm.capacity || 3;
        const occPct = Math.round((rm.occupied / cap) * 100);
        return (
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-700 dark:text-slate-300">{rm.occupied}/{cap}</span>
            <div className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
              <div className={`h-full rounded-full ${occPct >= 100 ? "bg-rose-500" : "bg-teal-500"}`} style={{ width: `${occPct}%` }} />
            </div>
          </div>
        );
      },
    },
    {
      key: "status",
      header: "Status",
      render: (rm) => <StatusBadge status={rm.status} size="sm" />,
    },
    {
      key: "condition",
      header: "Condition",
      render: (rm) => (
        <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold capitalize ${CONDITION_CHIP[rm.condition] || CONDITION_CHIP.good}`}>
          {rm.condition?.replace("_", " ")}
        </span>
      ),
    },
    {
      key: "update",
      header: "Update",
      render: (rm) => (
        <select
          value={rm.condition}
          onChange={(e) => handleUpdateCondition(rm.id, e.target.value)}
          className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-[11px] font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700"
        >
          <option value="excellent">Excellent</option>
          <option value="good">Good</option>
          <option value="needs_repair">Needs Repair</option>
          <option value="poor">Poor</option>
        </select>
      ),
    },
  ];

  const cardHeader = (rm: any) => (
    <div className="flex items-center justify-between">
      <div className="min-w-0">
        <p className="text-sm font-bold text-slate-900 dark:text-white">Room {rm.room_number}</p>
        <p className="mt-0.5 text-[11px] text-slate-500">{rm.block} · Floor {rm.floor}</p>
      </div>
      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold capitalize ${CONDITION_CHIP[rm.condition] || CONDITION_CHIP.good}`}>
        {rm.condition?.replace("_", " ")}
      </span>
    </div>
  );

  const cardBody = (rm: any) => {
    const cap = rm.capacity || 3;
    const occPct = Math.round((rm.occupied / cap) * 100);
    return (
      <div className="space-y-2 text-xs">
        <p className="truncate font-semibold text-slate-700 dark:text-slate-300">{rm.hostel}</p>
        <div className="flex items-center justify-between text-xs">
          <span className="font-bold text-slate-700 dark:text-slate-300">{rm.occupied}/{cap} occupied</span>
          <span className={`font-extrabold ${occPct >= 100 ? "text-rose-600" : "text-teal-600"}`}>{occPct}%</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
          <div className={`h-full rounded-full ${occPct >= 100 ? "bg-rose-500" : "bg-teal-500"}`} style={{ width: `${occPct}%` }} />
        </div>
        <div className="flex items-center justify-between pt-1">
          <StatusBadge status={rm.status} size="sm" />
          <select
            value={rm.condition}
            onChange={(e) => handleUpdateCondition(rm.id, e.target.value)}
            className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-[11px] font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700"
          >
            <option value="excellent">Excellent</option>
            <option value="good">Good</option>
            <option value="needs_repair">Needs Repair</option>
            <option value="poor">Poor</option>
          </select>
        </div>
      </div>
    );
  };

  return (
    <div className="mx-auto max-w-5xl space-y-5 pb-4 sm:space-y-6">
      <PageHeader
        title="Rooms & Hostels"
        subtitle="Manage room occupancy and maintenance condition across blocks"
      />

      {/* Hostel Summary Cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
        {hostels.map((h) => {
          const occPct = h.capacity ? Math.round((h.occupied / h.capacity) * 100) : 0;
          return (
            <div
              key={h.id}
              className="rounded-[1.25rem] border border-slate-200 bg-white p-4 shadow-card dark:border-slate-800 dark:bg-slate-900 sm:p-5"
            >
              <div className="flex items-center justify-between">
                <h3 className="min-w-0 truncate text-sm font-extrabold text-slate-900 dark:text-white">{h.name}</h3>
                <StatusBadge status={h.status} size="sm" />
              </div>
              <p className="mt-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">{h.type}</p>
              <div className="mt-4">
                <div className="mb-1.5 flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-700 dark:text-slate-300">{h.occupied} / {h.capacity} occupied</span>
                  <span className={`font-extrabold ${occPct >= 90 ? "text-rose-600" : "text-indigo-600"}`}>{occPct}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                  <div
                    className={`h-full rounded-full ${occPct >= 90 ? "bg-rose-500" : "bg-indigo-500"}`}
                    style={{ width: `${occPct}%` }}
                  />
                </div>
              </div>
              <div className="mt-4 space-y-1.5 text-[11px]">
                <div className="flex justify-between">
                  <span className="text-slate-500">Mess Facility</span>
                  <span className="font-bold text-emerald-600">Active</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Room Inspection Table */}
      <div className="rounded-[1.25rem] border border-slate-200 bg-white shadow-card dark:border-slate-800 dark:bg-slate-900">
        <div className="border-b border-slate-100 p-4 dark:border-slate-800">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">Room Inspection & Condition Logs</h3>
          <p className="text-[10px] text-slate-400">Update the maintenance condition of each room; changes reflect instantly</p>
        </div>
        <ResponsiveTable
          columns={columns}
          rows={rooms.slice(0, 15)}
          rowKey={(rm) => rm.id}
          cardHeader={cardHeader}
          cardBody={cardBody}
          empty={
            <EmptyState icon={BedDouble} title="No rooms found" description="Room data will appear here once assigned." />
          }
        />
      </div>
    </div>
  );
}