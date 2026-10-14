import React, { useState, useEffect } from "react";
import { CheckCircle2, ChevronDown, ChevronUp } from "lucide-react";
import { listCollection } from "@/lib/firestore";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { PageHeader } from "@/components/ui/PageHeader";

export default function Hostels() {
  const [hostels, setHostels] = useState<any[]>([]);
  const [expandedHostel, setExpandedHostel] = useState<string | null>(null);

  useEffect(() => {
    listCollection("Hostel").then(setHostels);
  }, []);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-8">
      <PageHeader
        title="Hostel Buildings & Residences"
        subtitle="Explore our modern APJ Abdul Kalam, CV Raman, and Kalpana Chawla residential blocks"
      />

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        {hostels.map((hostel) => {
          const occPercentage = Math.round((hostel.occupied / hostel.capacity) * 100);
          const isExpanded = expandedHostel === hostel.id;

          return (
            <div
              key={hostel.id}
              className="rounded-2xl border border-slate-200 bg-white p-6 shadow-md transition-all hover:shadow-lg dark:border-slate-800 dark:bg-slate-900 flex flex-col justify-between"
            >
              <div>
                {/* Header */}
                <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-4 dark:border-slate-800">
                  <div>
                    <span className={`inline-block rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                      hostel.type === "Boys" ? "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300" : "bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300"
                    }`}>
                      {hostel.type} Hostel
                    </span>
                    <h3 className="mt-2 text-xl font-extrabold text-slate-900 dark:text-white">{hostel.name}</h3>
                  </div>
                  <StatusBadge status={hostel.status} size="sm" />
                </div>

                {/* Capacity & Occupancy Bar */}
                <div className="mt-6 space-y-2">
                  <div className="flex flex-wrap justify-between gap-x-2 gap-y-1 text-xs font-bold text-slate-700 dark:text-slate-300">
                    <span>Occupancy Rate</span>
                    <span>{hostel.occupied} / {hostel.capacity} Residents ({occPercentage}%)</span>
                  </div>
                  <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                    <div
                      className={`h-full transition-all duration-500 ${
                        occPercentage > 90 ? "bg-amber-500" : "bg-indigo-600"
                      }`}
                      style={{ width: `${occPercentage}%` }}
                    />
                  </div>
                </div>

                {/* Facilities Badges */}
                <div className="mt-6">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3">
                    Included Amenities
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {hostel.facilities.map((fac: string, idx: number) => (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                      >
                        <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                        {fac}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Expand details toggle */}
              <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  onClick={() => setExpandedHostel(isExpanded ? null : hostel.id)}
                  className="flex min-h-11 w-full items-center justify-between rounded-lg px-2 py-2 text-xs font-bold text-indigo-600 hover:underline dark:text-indigo-400"
                >
                  <span>{isExpanded ? "Hide Room & Floor Details" : "View Room & Floor Structure"}</span>
                  {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>

                {isExpanded && (
                  <div className="mt-4 space-y-3 rounded-xl bg-slate-50 p-4 text-xs dark:bg-slate-800/60">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Blocks:</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">Block A & Block B</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Floors:</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">3 Floors per block</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Room Types:</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">3-Seater Shared Rooms</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Mess Availability:</span>
                      <span className="font-semibold text-emerald-600">Attached Dining Mess</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
