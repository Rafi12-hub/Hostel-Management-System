import React, { useState, useEffect } from "react";
import { subscribeCollection, updateRecord } from "@/lib/firestore";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { PageHeader } from "@/components/ui/PageHeader";

export default function Housekeeping() {
  const [cleaningLogs, setCleaningLogs] = useState<any[]>([]);

  useEffect(() => {
    const unsub = subscribeCollection("Cleaning", setCleaningLogs);
    return () => unsub();
  }, []);

  const handleToggleCheck = async (logId: string, itemKey: string, currentVal: boolean, checklistObj: any) => {
    const newChecklist = { ...checklistObj, [itemKey]: !currentVal };
    const totalKeys = Object.keys(newChecklist).length;
    const completedCount = Object.values(newChecklist).filter(Boolean).length;
    const completionPct = Math.round((completedCount / totalKeys) * 100);

    await updateRecord("Cleaning", logId, {
      checklist: newChecklist,
      completion: completionPct,
      status: completionPct === 100 ? "completed" : "in_progress",
    });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Housekeeping & Daily Sanitation Checklists"
        subtitle="Manage room cleaning schedules, staff assignments, and inspection progress %"
      />

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {cleaningLogs.map((log) => (
          <div key={log.id} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-md dark:border-slate-800 dark:bg-slate-900 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
              <div>
                <h3 className="text-base font-extrabold text-slate-900 dark:text-white">Room {log.room}</h3>
                <p className="text-[11px] text-slate-500">{log.hostel}</p>
              </div>
              <StatusBadge status={log.status} size="sm" />
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
                <span>Sanitation Completion</span>
                <span>{log.completion}%</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                <div className="h-full bg-emerald-500 transition-all duration-300" style={{ width: `${log.completion}%` }} />
              </div>
            </div>

            <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
              <p className="font-bold text-slate-700 dark:text-slate-300 mb-2">Cleaning Checklist:</p>
              {Object.entries(log.checklist || {}).map(([key, val]) => (
                <label key={key} className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 p-2 text-slate-800 dark:bg-slate-800/60 dark:text-slate-200 cursor-pointer">
                  <span className="capitalize">{key.replace(/_/g, " ")}</span>
                  <input
                    type="checkbox"
                    checked={Boolean(val)}
                    onChange={() => handleToggleCheck(log.id, key, Boolean(val), log.checklist)}
                    className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                </label>
              ))}
            </div>

            <p className="text-[11px] text-slate-400">Assigned Lead: <strong>{log.staff}</strong> · Date: {log.date}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
