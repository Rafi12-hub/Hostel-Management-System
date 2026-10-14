import React, { useState } from "react";
import { Clock, ShieldAlert, Utensils, Users, Calendar, AlertOctagon, Cpu } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";

export default function HostelRules() {
  const [activeTab, setActiveTab] = useState("entry_exit");

  const categories = [
    { id: "entry_exit", label: "Entry & Exit Timings", icon: Clock },
    { id: "mess", label: "Mess & Dining Discipline", icon: Utensils },
    { id: "discipline", label: "General Code of Conduct", icon: ShieldAlert },
    { id: "visitors", label: "Visitor Policy", icon: Users },
    { id: "leave", label: "Leave Application Rules", icon: Calendar },
    { id: "emergency", label: "Safety & Emergency Protocols", icon: AlertOctagon },
    { id: "electronics", label: "Electrical Appliances", icon: Cpu },
  ];

  const rulesContent: Record<string, { title: string; rules: string[] }> = {
    entry_exit: {
      title: "Gate Entry & Night Curfew Timings",
      rules: [
        "Daily main campus gate entry for hostel residents closes strictly at 9:00 PM.",
        "Night roll call commences at 9:00 PM in respective block lobbies by Wardens.",
        "Students exiting the campus for short local visits must possess an approved Gate Pass with valid QR Code.",
        "Overdue returns past 9:00 PM will trigger automated notifications to parents and chief warden.",
        "Biometric fingerprint / RFID gate logging is mandatory during every entry and exit transaction.",
      ],
    },
    mess: {
      title: "Mess & Dining Hall Regulations",
      rules: [
        "Meal Timings: Breakfast (7:30 - 9:00 AM), Lunch (12:30 - 2:00 PM), Snacks (4:30 - 5:30 PM), Dinner (7:30 - 9:00 PM).",
        "Wastage of food is strictly prohibited; residents are urged to take self-measured portions.",
        "Hostel mess utensils (plates, glasses, spoons) must not be carried inside hostel bedrooms.",
        "External food delivery (Zomato/Swiggy) is allowed at the main gate security lounge until 8:30 PM.",
        "Strict decorum and cleanliness must be maintained inside the central dining hall at all times.",
      ],
    },
    discipline: {
      title: "General Campus Discipline & Anti-Ragging",
      rules: [
        "Ragging in any form is a severe criminal offense and will attract immediate expulsion and legal action.",
        "Possession or consumption of alcohol, tobacco, narcotics, or contraband substances is strictly forbidden.",
        "Noise levels must be kept low post 10:00 PM to ensure an optimal study environment for all residents.",
        "Loud music, shouting, or rowdy behavior in corridors or balconies is prohibited.",
        "Defacing walls, damaging college property, or tampering with electrical fittings will invite heavy fines.",
      ],
    },
    visitors: {
      title: "Parent & Visitor Entry Policy",
      rules: [
        "Parents and guardians are allowed to visit residents only between 10:00 AM and 6:00 PM.",
        "Visitors must register their Aadhaar / Government ID at the security gate before entry.",
        "Male visitors are strictly prohibited inside Girls Hostel premises under all circumstances.",
        "Overnight stay of guests or outside friends in resident rooms is strictly prohibited.",
        "Visitors are restricted to the designated hostel visitor lobby and reception parlor.",
      ],
    },
    leave: {
      title: "Out-of-Station Leave Permissions",
      rules: [
        "Students taking out-of-station leave must submit an online Leave Application at least 24 hours prior.",
        "Leave requests exceeding 2 days require parental telephonic confirmation with the Chief Warden.",
        "Students must mark their return on the portal immediately upon arriving back at the hostel.",
        "Unauthorized absence from the hostel for more than 3 consecutive days will lead to disciplinary review.",
      ],
    },
    emergency: {
      title: "Emergency & Medical Incident Protocols",
      rules: [
        "In case of medical illness or injury, contact the RMO immediately at ext 404 or the 24/7 campus ambulance.",
        "Fire extinguishers are located on every corridor; do not tamper with safety equipment unless responding to fire.",
        "In case of emergency evacuation, gather at the main central quadrangle assembly point.",
      ],
    },
    electronics: {
      title: "Permitted Electrical Appliances",
      rules: [
        "Laptops, mobile chargers, study lamps, and desktop PCs are allowed inside student rooms.",
        "High-wattage appliances such as electric irons, induction stoves, water heaters, and immersion rods are banned.",
        "All power switches and fans must be turned off when leaving the room.",
      ],
    },
  };

  const currentSection = rulesContent[activeTab];

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-8">
      <PageHeader
        title="Hostel Rules & Regulations"
        subtitle="Comprehensive guidelines ensuring safety, discipline, and mutual respect across RGMCET hostels"
      />

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-4">
        {/* Sidebar Nav Tabs */}
        <div className="space-y-1 bg-white p-3 rounded-2xl border border-slate-200 dark:border-slate-800 dark:bg-slate-900 shadow-sm h-fit">
          {categories.map((cat) => {
            const Icon = cat.icon;
            const isActive = activeTab === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setActiveTab(cat.id)}
                className={`flex w-full items-center gap-3 rounded-xl px-3.5 py-3 text-xs font-bold transition-all ${
                  isActive
                    ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800"
                }`}
              >
                <Icon className={`h-4 w-4 ${isActive ? "text-white" : "text-indigo-600 dark:text-indigo-400"}`} />
                <span className="text-left">{cat.label}</span>
              </button>
            );
          })}
        </div>

        {/* Rules Content Panel */}
        <div className="lg:col-span-3 rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-md dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-xl font-extrabold text-slate-900 dark:text-white border-b border-slate-100 pb-4 dark:border-slate-800">
            {currentSection.title}
          </h2>

          <ul className="mt-6 space-y-4">
            {currentSection.rules.map((rule, idx) => (
              <li key={idx} className="flex items-start gap-3.5 rounded-xl bg-slate-50 p-4 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-indigo-700 font-bold text-xs dark:bg-indigo-950 dark:text-indigo-300">
                  {idx + 1}
                </span>
                <p className="text-xs font-medium text-slate-700 dark:text-slate-300 leading-relaxed pt-0.5">{rule}</p>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
