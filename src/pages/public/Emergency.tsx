import { PhoneCall, ShieldAlert, Stethoscope, AlertTriangle, Flame, HeartPulse } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";

export default function Emergency() {
  const contacts = [
    { title: "Campus Medical Helpline (24/7)", number: "+91 8514 275201", ext: "Ext: 404", desc: "Resident Medical Officer (Dr. S. K. Rao) & Dispensary", icon: Stethoscope, tone: "border-emerald-200 bg-emerald-50/50" },
    { title: "Main Security Gate Control", number: "+91 8514 275202", ext: "Ext: 101", desc: "Chief Security Officer (Officer Ramesh Kumar)", icon: ShieldAlert, tone: "border-blue-200 bg-blue-50/50" },
    { title: "Chief Warden Office", number: "+91 8514 275203", ext: "Ext: 202", desc: "Dr. S. V. Krishna (Boys & Girls Hostels)", icon: PhoneCall, tone: "border-indigo-200 bg-indigo-50/50" },
    { title: "24/7 Campus Ambulance", number: "+91 94400 99911", ext: "Immediate", desc: "On-call driver stationed at Health Center quadrangle", icon: HeartPulse, tone: "border-red-200 bg-red-50/50" },
    { title: "Nandyal Fire Station", number: "101 / +91 8514 220101", ext: "Govt Helpline", desc: "Fire emergency response force", icon: Flame, tone: "border-amber-200 bg-amber-50/50" },
    { title: "Nandyal Rural Police Station", number: "100 / +91 8514 245100", ext: "Govt Helpline", desc: "Local police assistance station", icon: AlertTriangle, tone: "border-rose-200 bg-rose-50/50" },
  ];

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-8">
      <PageHeader
        title="Emergency Contacts & Helpline"
        subtitle="24/7 immediate assistance for medical, security, fire, or personal safety emergencies"
      />

      {/* Red Alert Header Banner */}
      <div className="rounded-2xl bg-gradient-to-r from-red-900 via-red-800 to-slate-900 p-6 text-white shadow-xl flex flex-col sm:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-red-500/20 text-red-300 border border-red-400/30 animate-pulse">
            <AlertTriangle className="h-8 w-8" />
          </div>
          <div>
            <h3 className="text-lg font-extrabold">24/7 Emergency Response</h3>
            <p className="text-xs text-red-200 mt-1 max-w-xl">
              For any medical, security, fire, or personal safety emergency, contact the numbers below immediately. Response staff are on duty around the clock.
            </p>
          </div>
        </div>

        <a
          href="tel:+918514275201"
          className="inline-flex items-center gap-2 shrink-0 rounded-xl bg-red-600 px-6 py-3 text-xs font-bold text-white shadow-lg hover:bg-red-500 transition-all active:scale-95"
        >
          <PhoneCall className="h-4 w-4" />
          Call RMO Dispensary Now
        </a>
      </div>

      {/* Contacts Grid */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {contacts.map((c, idx) => {
          const Icon = c.icon;
          return (
            <div
              key={idx}
              className={`rounded-2xl border ${c.tone} p-6 shadow-sm dark:bg-slate-900 dark:border-slate-800 flex flex-col justify-between`}
            >
              <div>
                <div className="flex items-center justify-between border-b border-slate-200/60 pb-3 dark:border-slate-800">
                  <h4 className="text-base font-extrabold text-slate-900 dark:text-white">{c.title}</h4>
                  <Icon className="h-5 w-5 text-slate-600 dark:text-slate-400" />
                </div>
                <p className="mt-3 text-xs text-slate-600 dark:text-slate-400">{c.desc}</p>
                <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
                  <span className="text-lg font-extrabold text-indigo-700 dark:text-indigo-400">{c.number}</span>
                  <span className="rounded-full bg-slate-200/60 px-2.5 py-0.5 text-[10px] font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                    {c.ext}
                  </span>
                </div>
              </div>

              <a
                href={`tel:${c.number.replace(/[^0-9+]/g, "")}`}
                className="mt-6 flex w-full min-h-11 items-center justify-center gap-2 rounded-xl bg-slate-900 py-3 text-xs font-bold text-white hover:bg-slate-800 transition-colors"
              >
                <PhoneCall className="h-3.5 w-3.5" /> Direct Call
              </a>
            </div>
          );
        })}
      </div>
    </div>
  );
}
