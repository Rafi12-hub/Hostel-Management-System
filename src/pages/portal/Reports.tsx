import React, { useState } from "react";
import { FileText, Download, Printer, CheckCircle } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";

export default function Reports() {
  const [downloaded, setDownloaded] = useState<string | null>(null);

  const reportsList = [
    { id: "rep_1", title: "Monthly Resident Attendance Summary", desc: "Detailed breakdown of student present, outside, and leave metrics across all 3 hostels.", category: "Attendance" },
    { id: "rep_2", title: "Gate Pass Usage & Overdue Audit Report", desc: "Analysis of local out-passes issued, gate timestamps, and overdue security violations.", category: "Security" },
    { id: "rep_3", title: "Maintenance SLA & Complaint Resolution Times", desc: "SLA compliance rates for electrical, plumbing, Wi-Fi, and housekeeping repairs.", category: "Maintenance" },
    { id: "rep_4", title: "Central Mess Consumption & Waste Metrics", desc: "Daily meal headcount vs food preparation volume, remaining stock, and waste reduction stats.", category: "Mess & Catering" },
    { id: "rep_5", title: "Outstation Leave & Parent Verification Log", desc: "Complete log of student leave applications and parental telephone approvals.", category: "Discipline" },
  ];

  const handleDownload = (title: string) => {
    setDownloaded(title);
    setTimeout(() => setDownloaded(null), 2500);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Hostel Administrative Reports"
        subtitle="Generate printable PDF and CSV analytical summaries for management review"
      />

      {downloaded && (
        <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4 text-xs font-bold text-emerald-800 flex items-center gap-2">
          <CheckCircle className="h-4 w-4 text-emerald-600" />
          Report exported: <strong>{downloaded}</strong> (CSV / PDF format downloaded)
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {reportsList.map((rep) => (
          <div key={rep.id} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-md dark:border-slate-800 dark:bg-slate-900 flex flex-col justify-between space-y-4">
            <div>
              <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
                <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-[10px] font-bold text-indigo-700 uppercase dark:bg-indigo-950 dark:text-indigo-300">
                  {rep.category}
                </span>
                <FileText className="h-5 w-5 text-slate-400" />
              </div>
              <h3 className="mt-3 text-base font-extrabold text-slate-900 dark:text-white">{rep.title}</h3>
              <p className="mt-1.5 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">{rep.desc}</p>
            </div>

            <div className="flex gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                onClick={() => handleDownload(rep.title)}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 py-2.5 text-xs font-bold text-white hover:bg-indigo-700"
              >
                <Download className="h-4 w-4" /> Export CSV
              </button>
              <button
                onClick={() => window.print()}
                className="inline-flex items-center justify-center rounded-xl border border-slate-200 p-2.5 text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300"
              >
                <Printer className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
