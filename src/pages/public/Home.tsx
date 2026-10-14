import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Utensils,
  Building2,
  LogIn,
  CheckCircle2,
  Wifi,
  Zap,
  Droplets,
  ShieldCheck,
  Megaphone,
  BookOpen,
  HelpCircle,
  PhoneCall,
  Mail,
  Activity,
  Award,
  BedDouble,
  Tv,
  Sparkles,
  Stethoscope,
  Car,
  Camera,
} from "lucide-react";
import { listCollection, filterCollection } from "@/lib/firestore";
import { QRCode } from "@/components/ui/QRCode";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Image } from "@/components/ui/Image";

export default function Home() {
  const [todayMenu, setTodayMenu] = useState<any>(null);
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [hostelStatus, setHostelStatus] = useState<string>("All Systems Operational");

  useEffect(() => {
    // Fetch today's menu
    listCollection("Menu").then((res) => {
      if (res.length > 0) setTodayMenu(res[0]);
    });

    // Fetch announcements
    filterCollection("Announcement", { visibility: "public" }).then((res) => {
      setAnnouncements(res.slice(0, 5));
    });

    // Fetch hostel status setting
    filterCollection("Settings", { key: "hostel_status" }).then((res) => {
      if (res.length > 0) setHostelStatus(res[0].value);
    });
  }, []);

  const statusItems = [
    { label: "Hostel Operations", status: "normal", icon: Activity },
    { label: "Central Mess", status: "normal", icon: Utensils },
    { label: "Water Supply", status: "normal", icon: Droplets },
    { label: "Power & Backup", status: "normal", icon: Zap },
    { label: "Wi-Fi Network", status: "normal", icon: Wifi },
    { label: "24/7 Security", status: "normal", icon: ShieldCheck },
  ];

  const facilities = [
    { title: "Modern Accommodation", desc: "Spacious, well-ventilated 3-seater rooms with dedicated study tables & wardrobes.", icon: BedDouble },
    { title: "Central Dining Mess", desc: "Hygienic, nutritious South Indian & North Indian multi-cuisine veg meals prepared daily.", icon: Utensils },
    { title: "Campus-wide Wi-Fi 6", desc: "High-speed optical fiber wireless connectivity across all hostel blocks and study halls.", icon: Wifi },
    { title: "Air-Conditioned Study Rooms", desc: "Quiet 24/7 reading halls equipped with power sockets & reference books.", icon: BookOpen },
    { title: "Solar Hot Water System", desc: "Eco-friendly solar water heaters providing 24/7 hot water supply in all bathrooms.", icon: Droplets },
    { title: "Uninterrupted Power Backup", desc: "High-capacity diesel generators ensuring round-the-clock electricity.", icon: Zap },
    { title: "Daily Housekeeping", desc: "Professional room cleaning, corridor sanitation, and waste collection routines.", icon: Sparkles },
    { title: "24/7 Medical Care", desc: "Resident Medical Officer (RMO) on campus with fully equipped dispensary & ambulance.", icon: Stethoscope },
    { title: "Biometric & CCTV Security", desc: "Multi-tier security gate entry with biometric logs and 24/7 HD CCTV surveillance.", icon: Camera },
    { title: "Recreation & TV Lounge", desc: "Indoor games (Table Tennis, Chess, Carrom), LED TV lounges, and news reading areas.", icon: Tv },
    { title: "Outdoor Sports Courts", desc: "Volleyball courts, basketball courts, and cricket ground within hostel premises.", icon: Award },
    { title: "Vehicle Parking Lot", desc: "Secured covered parking for two-wheelers with security log verification.", icon: Car },
  ];

  return (
    <div className="space-y-16 pb-16">
      {/* Hero Section */}
      <section className="relative min-h-[560px] w-full overflow-hidden bg-slate-900 text-white flex items-center">
        {/* Background Image */}
        <div className="absolute inset-0 z-0">
          <Image
            src="https://media.base44.com/images/public/6a8e859522d0c3ff1205c51b/3fcdec637_rgm-building-photo.jpg"
            alt="RGMCET Main Campus"
            className="h-full w-full object-cover object-center"
          />
        </div>

        {/* Hero Content
            Mobile (below sm) gets responsive top padding clamp(32px,6vh,72px) so
            the badge/headline sit comfortably below the header + status bar even
            on short screens; desktop keeps the original pt-20 (unchanged). */}
        <div className="relative z-10 w-full pb-20 pt-[clamp(32px,6vh,72px)] sm:pt-20">
          <div className="mx-auto max-w-2xl space-y-6 px-4 sm:px-6 lg:px-8">
            {/* Live Operational Badge */}
            <div className="inline-flex items-center gap-2 rounded-full bg-emerald-500/10 border border-emerald-500/30 px-3.5 py-1 text-xs font-bold text-emerald-400 backdrop-blur-md">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
              <span>{hostelStatus}</span>
            </div>

            <h1 className="text-3xl font-extrabold tracking-tight sm:text-5xl lg:text-6xl text-white leading-tight">
              RGMCET <span className="text-indigo-400">Hostel Hub</span>
            </h1>

            <p className="text-lg font-semibold text-white tracking-wide uppercase leading-snug">
              Smart • Safe<br />
              Connected Campus Living
            </p>

            <p className="text-sm sm:text-base text-slate-300 leading-relaxed max-w-xl">
              Welcome to the official hostel portal of Rajeev Gandhi Memorial College of Engineering and Technology. Explore daily dining menus, hostel amenities, gate passes, maintenance tracking, and real-time announcements.
            </p>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center gap-4 pt-2">
              <Link
                to="/food-menu"
                className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-indigo-600/30 hover:bg-indigo-700 transition-all active:scale-95"
              >
                <Utensils className="h-4 w-4" />
                View Today's Menu
              </Link>
              <Link
                to="/hostels"
                className="inline-flex items-center gap-2 rounded-lg bg-white/10 border border-white/20 px-6 py-3 text-sm font-bold text-white backdrop-blur-md hover:bg-white/20 transition-all active:scale-95"
              >
                <Building2 className="h-4 w-4" />
                Explore Hostels
              </Link>
              <Link
                to="/login"
                className="inline-flex items-center gap-2 rounded-lg bg-slate-800 border border-slate-700 px-6 py-3 text-sm font-bold text-slate-200 hover:bg-slate-700 transition-all active:scale-95"
              >
                <LogIn className="h-4 w-4" />
                Hostel Login
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Hostel Live Status Bar */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 -mt-10 relative z-20">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4 dark:border-slate-800 mb-4">
            <h3 className="text-sm font-extrabold uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-2">
              <Activity className="h-4 w-4 text-indigo-600" />
              Live Campus Infrastructure Status
            </h3>
            <span className="text-xs text-slate-500 font-medium">Updated Just Now</span>
          </div>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            {statusItems.map((st, idx) => {
              const Icon = st.icon;
              return (
                <div key={idx} className="flex flex-col items-center rounded-xl bg-slate-50 p-3 text-center dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-100 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400 mb-2">
                    <Icon className="h-4 w-4" />
                  </div>
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200">{st.label}</span>
                  <StatusBadge status={st.status} size="sm" className="mt-2 text-[10px]" />
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Today's Food Menu Section */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <span className="text-xs font-bold uppercase tracking-widest text-indigo-600 dark:text-indigo-400">
              Fresh & Hygienic Meals
            </span>
            <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white sm:text-3xl mt-1">
              Today's Mess Menu
            </h2>
          </div>
          <Link
            to="/food-menu"
            className="inline-flex items-center gap-2 text-xs font-bold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400"
          >
            View Weekly Schedule →
          </Link>
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { title: "Breakfast", time: "7:30 AM - 9:00 AM", items: todayMenu?.breakfast || ["Idli & Medu Vada", "Sambar & Chutney", "Tea / Coffee"], tone: "from-amber-500/10 to-orange-500/5 border-amber-200" },
            { title: "Lunch", time: "12:30 PM - 2:00 PM", items: todayMenu?.lunch || ["Steamed Rice", "Andhra Pappu", "Paneer Masala", "Curd"], tone: "from-emerald-500/10 to-teal-500/5 border-emerald-200" },
            { title: "Snacks", time: "4:30 PM - 5:30 PM", items: todayMenu?.snacks || ["Onion Pakoda / Samosa", "Hot Masala Chai"], tone: "from-purple-500/10 to-indigo-500/5 border-purple-200" },
            { title: "Dinner", time: "7:30 PM - 9:00 PM", items: todayMenu?.dinner || ["Chapati & Dal Tadka", "Veg Biryani & Raita", "Gulab Jamun"], tone: "from-blue-500/10 to-sky-500/5 border-blue-200" },
          ].map((meal, idx) => (
            <div
              key={idx}
              className={`rounded-2xl border p-6 bg-gradient-to-b ${meal.tone} bg-white dark:bg-slate-900 shadow-md flex flex-col justify-between`}
            >
              <div>
                <div className="flex items-center justify-between border-b border-slate-200/60 pb-3 dark:border-slate-800">
                  <h3 className="text-lg font-extrabold text-slate-900 dark:text-white">{meal.title}</h3>
                  <Utensils className="h-5 w-5 text-slate-400" />
                </div>
                <p className="mt-2 text-xs font-semibold text-slate-500 dark:text-slate-400">{meal.time}</p>
                <ul className="mt-4 space-y-2 text-xs text-slate-700 dark:text-slate-300">
                  {meal.items.map((it: string, i: number) => (
                    <li key={i} className="flex items-center gap-2">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                      <span>{it}</span>
                    </li>
                  ))}
                </ul>
              </div>
              {todayMenu?.is_special && idx === 1 && (
                <span className="mt-4 inline-block rounded-full bg-amber-500/20 px-3 py-1 text-[10px] font-bold text-amber-700 dark:text-amber-300 text-center">
                  ✨ Special Festival Menu
                </span>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Facilities Section */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <span className="text-xs font-bold uppercase tracking-widest text-indigo-600 dark:text-indigo-400">
            World-Class Infrastructure
          </span>
          <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white sm:text-3xl mt-1">
            Hostel Facilities & Amenities
          </h2>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            Designed for convenience, academic focus, and student wellbeing.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {facilities.map((fac, idx) => {
            const Icon = fac.icon;
            return (
              <div
                key={idx}
                className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm hover:shadow-md transition-all dark:border-slate-800 dark:bg-slate-900 group"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400 mb-4 group-hover:scale-110 transition-transform">
                  <Icon className="h-6 w-6" />
                </div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">{fac.title}</h3>
                <p className="mt-2 text-xs leading-relaxed text-slate-500 dark:text-slate-400">{fac.desc}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Announcements & QR Section Grid */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          {/* Latest Announcements */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                <Megaphone className="h-5 w-5 text-indigo-600" />
                Latest Hostel Announcements
              </h2>
              <Link to="/announcements" className="text-xs font-bold text-indigo-600 hover:underline">
                View All
              </Link>
            </div>

            <div className="space-y-3">
              {announcements.map((ann) => (
                <div
                  key={ann.id}
                  className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 flex items-start gap-4"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                    <Megaphone className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white">{ann.title}</h4>
                      <StatusBadge status={ann.priority} size="sm" />
                    </div>
                    <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">{ann.description}</p>
                    <div className="mt-2 flex items-center gap-3 text-[10px] text-slate-400">
                      <span>Audience: {ann.audience}</span>
                      <span>•</span>
                      <span>Hostel: {ann.hostel}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Quick QR & Actions Card */}
          <div className="rounded-2xl border border-slate-200 bg-gradient-to-b from-indigo-900 to-slate-900 p-6 text-white shadow-xl flex flex-col items-center text-center justify-between">
            <div>
              <span className="rounded-full bg-indigo-500/20 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-indigo-300">
                Instant Access
              </span>
              <h3 className="mt-3 text-lg font-bold">Scan for Today's Mess Menu</h3>
              <p className="mt-1 text-xs text-slate-300">Point your smartphone camera to view the live food menu instantly.</p>
            </div>

            <div className="my-6">
              <QRCode value={`${window.location.origin}/food-menu`} size={150} alt="Food Menu QR Code" />
            </div>

            <Link
              to="/food-menu"
              className="w-full min-h-11 rounded-xl bg-indigo-600 py-3 text-xs font-bold text-white shadow-md hover:bg-indigo-500 transition-colors"
            >
              Open Menu Page
            </Link>
          </div>
        </div>
      </section>

      {/* Quick Links Section */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Link
            to="/hostel-rules"
            className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm hover:border-indigo-500 dark:border-slate-800 dark:bg-slate-900 transition-all group"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400 group-hover:scale-105 transition-transform">
              <BookOpen className="h-6 w-6" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">Hostel Rules</h4>
              <p className="text-xs text-slate-500">Read policies & timing</p>
            </div>
          </Link>

          <Link
            to="/faq"
            className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm hover:border-indigo-500 dark:border-slate-800 dark:bg-slate-900 transition-all group"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-purple-50 text-purple-600 dark:bg-purple-950 dark:text-purple-400 group-hover:scale-105 transition-transform">
              <HelpCircle className="h-6 w-6" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">FAQ Section</h4>
              <p className="text-xs text-slate-500">Common questions answered</p>
            </div>
          </Link>

          <Link
            to="/emergency"
            className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm hover:border-red-500 dark:border-slate-800 dark:bg-slate-900 transition-all group"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-red-50 text-red-600 dark:bg-red-950 dark:text-red-400 group-hover:scale-105 transition-transform">
              <PhoneCall className="h-6 w-6" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">Emergency Contacts</h4>
              <p className="text-xs text-slate-500">24/7 Helpline & Doctors</p>
            </div>
          </Link>

          <Link
            to="/contact"
            className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm hover:border-indigo-500 dark:border-slate-800 dark:bg-slate-900 transition-all group"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400 group-hover:scale-105 transition-transform">
              <Mail className="h-6 w-6" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">Contact Us</h4>
              <p className="text-xs text-slate-500">Reach the hostel office</p>
            </div>
          </Link>
        </div>
      </section>
    </div>
  );
}
