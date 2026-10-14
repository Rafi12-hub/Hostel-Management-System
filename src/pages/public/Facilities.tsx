import {
  BedDouble,
  Utensils,
  Wifi,
  BookOpen,
  Droplets,
  Zap,
  Sparkles,
  Stethoscope,
  Camera,
  Tv,
  Award,
  Car,
} from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";

export default function Facilities() {
  const allFacilities = [
    { title: "Accommodation & Rooms", desc: "Spacious, well-ventilated 3-seater rooms equipped with separate study tables, ergonomic chairs, individual wardrobes, LED lighting, and ceiling fans.", icon: BedDouble },
    { title: "Central Dining Mess", desc: "Hygienic, multi-cuisine dining hall serving 4 meals daily (Breakfast, Lunch, Evening Snacks, and Dinner). Pure veg options prepared under strict quality standards.", icon: Utensils },
    { title: "High-Speed Wi-Fi 6", desc: "Campus-wide fiber optic wireless mesh network providing uninterrupted high-bandwidth internet for study, research, and project submissions.", icon: Wifi },
    { title: "Air-Conditioned Study Halls", desc: "Dedicated quiet reading rooms open 24/7 with comfortable seating, study dividers, power sockets, and reference textbooks.", icon: BookOpen },
    { title: "Solar Hot Water System", desc: "High-efficiency solar water heating panels providing 24/7 hot water supply in all resident bathrooms.", icon: Droplets },
    { title: "24/7 Power Backup", desc: "High-output diesel generator sets ensuring zero electricity downtime for lighting, fans, and study areas during outages.", icon: Zap },
    { title: "Daily Housekeeping", desc: "Professional sanitation crew performing daily room cleaning, corridor sweeping, bathroom disinfection, and waste management.", icon: Sparkles },
    { title: "Resident Doctor & Dispensary", desc: "24/7 on-campus health clinic with Resident Medical Officer (RMO), trained nurses, essential medicines, and emergency ambulance service.", icon: Stethoscope },
    { title: "Biometric & CCTV Security", desc: "Multi-tier security gate entry with biometric fingerprint logs, RFID gate passes, and 24/7 high-definition CCTV surveillance across campus.", icon: Camera },
    { title: "Recreation & TV Lounge", desc: "Common entertainment rooms equipped with LED TVs, indoor games (Table Tennis, Carrom, Chess), and daily English & Telugu newspapers.", icon: Tv },
    { title: "Sports & Fitness Center", desc: "Dedicated basketball court, volleyball court, badminton courts, cricket nets, and a modern gym for student physical fitness.", icon: Award },
    { title: "Covered Vehicle Parking", desc: "Secure multi-row parking bay for resident two-wheelers with security log check at entry and exit.", icon: Car },
  ];

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-8">
      <PageHeader
        title="Hostel Facilities & Infrastructure"
        subtitle="12 world-class amenities designed to support academic focus and comfortable campus living"
      />

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {allFacilities.map((fac, idx) => {
          const Icon = fac.icon;
          return (
            <div
              key={idx}
              className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm hover:shadow-md transition-all dark:border-slate-800 dark:bg-slate-900 group"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400 mb-4 group-hover:scale-110 transition-transform">
                <Icon className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-extrabold text-slate-900 dark:text-white">{fac.title}</h3>
              <p className="mt-2 text-xs leading-relaxed text-slate-600 dark:text-slate-400">{fac.desc}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
