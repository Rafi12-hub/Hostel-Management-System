import React, { useState } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import {
  Menu,
  X,
  LogIn,
  UtensilsCrossed,
  Building2,
  Bell,
  BookOpen,
  HelpCircle,
  PhoneCall,
  Mail,
  ShieldCheck,
  Award,
  Sun,
  Moon,
} from "lucide-react";
import { useDemoAuth } from "@/context/DemoAuthContext";
import { useTheme } from "@/context/ThemeContext";

export const PublicLayout: React.FC = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();
  const { isAuthenticated, user } = useDemoAuth();
  const { theme, toggleTheme } = useTheme();

  const navItems = [
    { label: "Home", path: "/" },
    { label: "Food Menu", path: "/food-menu", icon: UtensilsCrossed },
    { label: "Hostels", path: "/hostels", icon: Building2 },
    { label: "Facilities", path: "/facilities" },
    { label: "Announcements", path: "/announcements", icon: Bell },
    { label: "Rules", path: "/hostel-rules", icon: BookOpen },
    { label: "FAQ", path: "/faq", icon: HelpCircle },
    { label: "Emergency", path: "/emergency", icon: PhoneCall },
    { label: "Contact", path: "/contact", icon: Mail },
  ];

  return (
    <div className="flex min-h-dvh flex-col bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-50">
      {/* Top Bar */}
      {/* On notch devices / edge-to-edge Android the layout viewport may extend
          under the system status bar (viewport-fit=cover). A safe-top-band row
          (exactly env(safe-area-inset-top) tall) is rendered ABOVE the white
          header so the app stops below the native time/signal/battery icons —
          leaving a clean visible gap and never rendering the header under them.
          The band is 0px tall on desktop, so there is no desktop change. */}
      <div className="sticky top-0 z-40">
        <div aria-hidden="true" className="safe-top-band" />
        <header className="w-full border-b border-slate-200/80 bg-white/95 backdrop-blur-md dark:border-slate-800/80 dark:bg-slate-900/95">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          {/* Brand Logo */}
          <Link to="/" className="group flex min-w-0 items-center gap-3">
            <div className="min-w-0">
              <span className="flex items-center gap-1.5 text-base font-extrabold tracking-tight text-slate-900 dark:text-white sm:text-lg">
                <span className="truncate">
                  RGMCET <span className="text-indigo-600 dark:text-indigo-400">Hostel Hub</span>
                </span>
              </span>
              <p className="truncate text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Autonomous · Estd 1995
              </p>
            </div>
          </Link>

          {/* Desktop Nav Links */}
          <nav className="hidden items-center gap-1 lg:flex">
            {navItems.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${
                    isActive
                      ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {/* Header Actions */}
          <div className="flex items-center gap-3">
            {/* Theme Toggle */}
            <button
              onClick={toggleTheme}
              title={theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
              className="inline-flex items-center justify-center rounded-lg p-2 text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white transition-colors"
            >
              {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </button>

            {isAuthenticated ? (
              <Link
                to="/dashboard"
                className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-indigo-600 px-2.5 py-2 text-xs font-bold text-white shadow-sm transition-all hover:bg-indigo-700 active:scale-95 sm:px-4"
              >
                <ShieldCheck className="h-4 w-4" />
                <span className="hidden sm:inline">Go to Portal ({user?.role})</span>
              </Link>
            ) : (
              <Link
                to="/login"
                className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-indigo-600 px-2.5 py-2 text-xs font-bold text-white shadow-sm transition-all hover:bg-indigo-700 active:scale-95 sm:px-4"
              >
                <LogIn className="h-4 w-4" />
                <span className="hidden sm:inline">Hostel Login</span>
              </Link>
            )}

            {/* Mobile Menu Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="inline-flex items-center justify-center rounded-lg p-2 text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 lg:hidden"
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="border-b border-slate-200 bg-white px-4 pt-2 pb-6 dark:border-slate-800 dark:bg-slate-900 lg:hidden">
            <nav className="flex flex-col gap-1">
              {navItems.map((item) => {
                const isActive = location.pathname === item.path;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors ${
                      isActive
                        ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300"
                        : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                    }`}
                  >
                    {item.icon && <item.icon className="h-4 w-4 text-indigo-500" />}
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>
        )}
        </header>
      </div>

      {/* Main Content Area */}
      <main className="flex-1">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-slate-900 text-slate-300 dark:border-slate-800 dark:bg-slate-950">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-8 md:grid-cols-4">
            {/* Col 1 */}
            <div className="space-y-4 md:col-span-2">
              <div className="flex items-center gap-3">
                <img
                  src="https://media.base44.com/images/public/6a8e859522d0c3ff1205c51b/40a48d7b6_logo.jpg"
                  alt="RGMCET Crest"
                  className="h-10 w-10 rounded-lg object-contain bg-white p-0.5"
                />
                <div>
                  <h3 className="text-lg font-bold text-white">RGMCET Hostel Hub</h3>
                  <p className="text-xs text-indigo-400 font-medium">EDUCATION FOR PEACE · ESTD 1995</p>
                </div>
              </div>
              <p className="max-w-md text-xs leading-relaxed text-slate-400">
                Rajeev Gandhi Memorial College of Engineering & Technology (Autonomous), Nandyal, Andhra Pradesh. Providing a safe, comfortable, and modern living environment for students with 24/7 digital management.
              </p>
              <div className="flex items-center gap-4 text-xs font-semibold text-slate-400">
                <span className="flex items-center gap-1"><Award className="h-4 w-4 text-amber-400" /> NAAC A+ Accredited</span>
                <span className="flex items-center gap-1"><ShieldCheck className="h-4 w-4 text-emerald-400" /> NBA Approved</span>
              </div>
            </div>

            {/* Col 2: Quick Links */}
            <div>
              <h4 className="text-sm font-bold uppercase tracking-wider text-white">Quick Links</h4>
              <ul className="mt-3 space-y-2 text-xs">
                <li><Link to="/food-menu" className="hover:text-indigo-400 transition-colors">Today's Mess Menu</Link></li>
                <li><Link to="/hostels" className="hover:text-indigo-400 transition-colors">Hostel Buildings</Link></li>
                <li><Link to="/hostel-rules" className="hover:text-indigo-400 transition-colors">Hostel Rules & Discipline</Link></li>
                <li><Link to="/emergency" className="hover:text-indigo-400 transition-colors">Emergency Contacts</Link></li>
                <li><Link to="/faq" className="hover:text-indigo-400 transition-colors">FAQ & Support</Link></li>
              </ul>
            </div>

            {/* Col 3: Contact Info */}
            <div>
              <h4 className="text-sm font-bold uppercase tracking-wider text-white">Hostel Office</h4>
              <address className="mt-3 not-italic space-y-2 text-xs text-slate-400">
                <p>RGMCET Campus, NH-40,</p>
                <p>Nandyal - 518501, Andhra Pradesh</p>
                <p className="text-indigo-300 font-semibold">Phone: +91 8514 275201 / 275203</p>
                <p className="text-indigo-300 font-semibold">Email: hostel@rgmcet.edu.in</p>
              </address>
            </div>
          </div>

          <div className="mt-10 border-t border-slate-800 pt-6 text-center text-xs text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p>© {new Date().getFullYear()} RGMCET Hostel Hub. All rights reserved.</p>
            <p className="text-slate-400">Smart • Safe • Connected Campus Management</p>
          </div>
        </div>
      </footer>
    </div>
  );
};
