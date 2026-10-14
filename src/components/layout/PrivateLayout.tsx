import React, { useState, useEffect } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  Building,
  Grid,
  QrCode,
  ArrowRightLeft,
  CalendarCheck,
  UserCheck,
  Moon,
  UserPlus,
  Wrench,
  Sparkles,
  Utensils,
  Package,
  Megaphone,
  Bell,
  FileText,
  BarChart3,
  History,
  Settings,
  LogOut,
  ChevronLeft,
  Menu,
  Sun,
  Shield,
  CheckCheck,
  MessageSquareText,
  BedDouble,
  User as UserIcon,
  ScanLine,
  Fingerprint,
  ClipboardCheck,
  BellRing,
  DoorOpen,
} from "lucide-react";
import { useDemoAuth, type Role } from "@/context/DemoAuthContext";
import { useTheme } from "@/context/ThemeContext";
import { subscribeCollection, updateRecord } from "@/lib/firestore";
import { BottomNav } from "@/components/layout/BottomNav";
import { MobileDrawer } from "@/components/ui/MobileDrawer";

interface NavItem {
  label: string;
  path: string;
  icon: any;
  roles: Role[];
}

const ALL_NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", path: "/dashboard", icon: LayoutDashboard, roles: ["student", "parent", "security", "warden", "mess_manager", "housekeeping", "admin", "management", "hostel_office", "medical", "principal"] },
  { label: "My Room", path: "/my-room", icon: BedDouble, roles: ["student", "warden", "admin", "chief_warden", "management", "principal", "hostel_office"] },
  { label: "Students", path: "/students", icon: Users, roles: ["admin", "warden", "hostel_office", "management", "principal"] },
  { label: "Hostels & Rooms", path: "/rooms", icon: Building, roles: ["admin", "warden", "management", "principal"] },
  { label: "Room Availability", path: "/room-availability", icon: Grid, roles: ["admin", "warden", "hostel_office", "management", "principal"] },
  { label: "Gate Pass", path: "/gate-pass", icon: QrCode, roles: ["student", "security", "warden", "admin", "hostel_office"] },
  { label: "Entry / Exit Logs", path: "/entry-exit", icon: ArrowRightLeft, roles: ["security", "admin", "warden"] },
  { label: "Gate Scanner", path: "/security/gate-scanner", icon: ScanLine, roles: ["security", "warden", "admin", "hostel_office", "management"] },
  { label: "Gate Activity & Logs", path: "/security/gate-activity", icon: DoorOpen, roles: ["security", "warden", "admin", "hostel_office", "management", "principal"] },
  { label: "Face Enrollment", path: "/face/enrollment", icon: Fingerprint, roles: ["student"] },
  { label: "Leave Approvals", path: "/warden/leave-requests", icon: ClipboardCheck, roles: ["warden", "admin", "hostel_office"] },
  { label: "Leave Requests", path: "/leave", icon: CalendarCheck, roles: ["student", "warden", "admin", "hostel_office"] },
  { label: "Attendance Overview", path: "/attendance", icon: UserCheck, roles: ["warden", "admin", "management", "principal"] },
  { label: "Night Roll Call (FRS)", path: "/night-roll-call", icon: Moon, roles: ["student", "warden", "admin"] },
  { label: "Visitors Register", path: "/visitors", icon: UserPlus, roles: ["security", "warden", "hostel_office", "admin"] },
  { label: "Maintenance", path: "/maintenance", icon: Wrench, roles: ["student", "housekeeping", "warden", "admin"] },
  { label: "Housekeeping", path: "/housekeeping", icon: Sparkles, roles: ["housekeeping", "admin"] },
  { label: "Mess & Dining", path: "/mess", icon: Utensils, roles: ["student", "mess_manager", "admin"] },
  { label: "Inventory Stock", path: "/inventory", icon: Package, roles: ["mess_manager", "admin"] },
  { label: "User Management", path: "/user-management", icon: Users, roles: ["admin", "warden"] },
  { label: "Announcements", path: "/manage-announcements", icon: Megaphone, roles: ["student", "warden", "mess_manager", "hostel_office", "admin"] },
  { label: "Notifications", path: "/notifications", icon: Bell, roles: ["student", "parent", "security", "warden", "mess_manager", "housekeeping", "admin", "management", "hostel_office", "medical", "principal"] },
  { label: "Profile", path: "/profile", icon: UserIcon, roles: ["student", "parent", "security", "warden", "mess_manager", "housekeeping", "admin", "management", "hostel_office", "medical", "principal"] },
  { label: "Parent SMS Alerts", path: "/parent-notifications", icon: MessageSquareText, roles: ["warden", "hostel_office", "admin", "management", "principal"] },
  { label: "WhatsApp Queue Log", path: "/notification-log", icon: BellRing, roles: ["warden", "hostel_office", "admin", "management", "principal"] },
  { label: "Reports", path: "/reports", icon: FileText, roles: ["admin", "management", "principal"] },
  { label: "Analytics", path: "/analytics", icon: BarChart3, roles: ["admin", "management", "principal"] },
  { label: "Audit Logs", path: "/audit-logs", icon: History, roles: ["admin", "management"] },
  { label: "System Settings", path: "/settings", icon: Settings, roles: ["admin", "management"] },
];

export const PrivateLayout: React.FC = () => {
  const { user, role, logout } = useDemoAuth();
  const { theme, toggleTheme } = useTheme();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);

  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const unsub = subscribeCollection("Notification", (data) => {
      setNotifications(data);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    setMobileOpen(false);
    setNotifOpen(false);
  }, [location.pathname]);

  const filteredNavItems = ALL_NAV_ITEMS.filter((item) => {
    if (!role) return false;
    const effectiveRole: Role = role === "chief_warden" ? "admin" : role;
    return item.roles.includes(effectiveRole);
  });
  const unreadCount = notifications.filter((n) => !n.read).length;

  const markAllRead = async () => {
    const unread = notifications.filter((n) => !n.read);
    for (const item of unread) {
      await updateRecord("Notification", item.id, { read: true });
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const NavList: React.FC<{ items: NavItem[]; onNavigate?: () => void }> = ({ items, onNavigate }) => (
    <nav className="space-y-1 px-3 py-4">
      {items.map((item) => {
        const isActive =
          location.pathname === item.path ||
          (item.path === "/dashboard" && location.pathname === "/");
        const Icon = item.icon;
        return (
          <Link
            key={item.path}
            to={item.path}
            onClick={onNavigate}
            aria-current={isActive ? "page" : undefined}
            className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold transition-all ${
              isActive
                ? "bg-indigo-600/10 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
            }`}
          >
            <Icon className={`h-5 w-5 shrink-0 ${isActive ? "text-indigo-600 dark:text-indigo-400" : ""}`} />
            <span className="flex-1 truncate">{item.label}</span>
            {isActive && <span className="h-2 w-2 shrink-0 rounded-full bg-indigo-500" />}
          </Link>
        );
      })}
    </nav>
  );

  const UserCard: React.FC<{ onNavigate?: () => void }> = ({ onNavigate }) => (
    <Link
      to="/profile"
      onClick={onNavigate}
      className="flex items-center gap-3 border-b border-slate-100 bg-gradient-to-br from-slate-50 to-slate-100 p-4 dark:border-slate-800 dark:from-slate-900 dark:to-slate-950"
    >
      <img
        src={user?.avatarUrl}
        alt={user?.name}
        className="h-11 w-11 shrink-0 rounded-full border-2 border-indigo-500/40 object-cover"
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold text-slate-900 dark:text-white">{user?.name}</p>
        <p className="truncate text-[11px] font-semibold text-indigo-600 dark:text-indigo-400">
          {user?.roleTitle} · Role: {role?.toUpperCase()}
        </p>
      </div>
    </Link>
  );

  return (
    <div className="flex h-dvh w-full overflow-hidden bg-slate-100 font-sans dark:bg-slate-950">
      {/* ===== Mobile Navigation Drawer ===== */}
      <MobileDrawer open={mobileOpen} onClose={() => setMobileOpen(false)} side="left" widthClass="w-80 max-w-[88vw]">
        <div className="flex h-full flex-col">
          <div className="flex items-center gap-2 px-5 pb-1 pt-5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-[#1e1b4b] to-[#4f46e5] p-0.5">
              <img
                src="https://media.base44.com/images/public/6a8e859522d0c3ff1205c51b/40a48d7b6_logo.jpg"
                alt="RGMCET Crest"
                className="h-full w-full rounded-[8px] object-contain"
              />
            </div>
            <span className="text-base font-extrabold tracking-tight text-slate-900 dark:text-white">
              Hostel Hub
            </span>
          </div>
          <UserCard onNavigate={() => setMobileOpen(false)} />
          <div className="min-h-0 flex-1 overflow-y-auto scroll-touch">
            <NavList items={filteredNavItems} onNavigate={() => setMobileOpen(false)} />
          </div>
          <div className="shrink-0 border-t border-slate-100 p-3 pb-safe dark:border-slate-800">
            <button
              onClick={handleLogout}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-red-50 py-3 text-sm font-bold text-red-600 transition-colors hover:bg-red-100 dark:bg-red-950/40 dark:text-red-400 dark:hover:bg-red-950/60"
            >
              <LogOut className="h-4 w-4" /> Logout
            </button>
          </div>
        </div>
      </MobileDrawer>

      {/* ===== Desktop Sidebar ===== */}
      <aside
        className={`hidden shrink-0 flex-col border-r border-slate-200 bg-white transition-all duration-300 dark:border-slate-800 dark:bg-slate-900 lg:flex ${
          collapsed ? "w-20" : "w-64"
        }`}
      >
        <div className="flex h-16 shrink-0 items-center justify-between border-b border-slate-100 px-4 dark:border-slate-800">
          <Link to="/dashboard" className="flex items-center gap-3 overflow-hidden">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-[#1e1b4b] to-[#4f46e5] p-0.5 shadow-md shadow-indigo-500/20">
              <img
                src="https://media.base44.com/images/public/6a8e859522d0c3ff1205c51b/40a48d7b6_logo.jpg"
                alt="RGMCET Crest"
                className="h-full w-full rounded-[10px] object-contain"
              />
            </div>
            {!collapsed && (
              <div className="flex flex-col">
                <span className="text-base font-extrabold tracking-tight text-slate-900 dark:text-white">
                  RGMCET Portal
                </span>
                <span className="text-[10px] font-semibold uppercase tracking-wide text-indigo-600 dark:text-indigo-400">
                  {user?.roleTitle || "Hostel Hub"}
                </span>
              </div>
            )}
          </Link>
          <button
            onClick={() => setCollapsed(!collapsed)}
            title="Toggle sidebar"
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
          >
            <ChevronLeft className={`h-5 w-5 transition-transform ${collapsed ? "rotate-180" : ""}`} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto scroll-touch">
          <NavList items={filteredNavItems} />
        </div>

        <div className="shrink-0 border-t border-slate-100 p-3 dark:border-slate-800">
          <div className={`flex items-center ${collapsed ? "justify-center" : "justify-between"} gap-2`}>
            <div className="flex items-center gap-2.5 overflow-hidden">
              <img
                src={user?.avatarUrl}
                alt={user?.name}
                className="h-9 w-9 shrink-0 rounded-full border border-slate-200 object-cover dark:border-slate-700"
              />
              {!collapsed && (
                <div className="truncate">
                  <p className="truncate text-xs font-bold text-slate-900 dark:text-white">{user?.name}</p>
                  <p className="truncate text-[10px] capitalize text-slate-500 dark:text-slate-400">{user?.role}</p>
                </div>
              )}
            </div>
            {!collapsed && (
              <button
                onClick={handleLogout}
                title="Logout"
                className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:text-slate-500 dark:hover:bg-red-950/40 dark:hover:text-red-400"
              >
                <LogOut className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </aside>

      {/* ===== Main Column ===== */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Slim sticky top header (safe-area band + bar). On notch /
            edge-to-edge devices a safe-top-band row (exactly the status-bar
            height) renders above the bar so the header never sits under the
            native status icons; it collapses to 0 on desktop. */}
        <div className="z-30 shrink-0 border-b border-slate-200/80 dark:border-slate-800">
          <div aria-hidden="true" className="safe-top-band" />
          <header className="flex h-14 items-center justify-between gap-2 bg-white/90 px-2 backdrop-blur dark:bg-slate-900/90 sm:px-4">
          {/* Left: hamburger + short title */}
          <div className="flex min-w-0 flex-1 items-center gap-1 overflow-hidden whitespace-nowrap">
            <button
              onClick={() => setMobileOpen(true)}
              aria-label="Open navigation menu"
              className="shrink-0 rounded-xl p-2.5 text-slate-600 transition-colors hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 lg:hidden"
            >
              <Menu className="h-6 w-6" />
            </button>
            <Link to="/dashboard" className="flex min-w-0 flex-1 items-center gap-2">
              <div className="hidden h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-tr from-[#1e1b4b] to-[#4f46e5] p-0.5 sm:flex">
                <img
                  src="https://media.base44.com/images/public/6a8e859522d0c3ff1205c51b/40a48d7b6_logo.jpg"
                  alt=""
                  className="h-full w-full rounded-md object-contain"
                />
              </div>
              <span className="truncate whitespace-nowrap text-sm font-extrabold tracking-tight text-slate-900 dark:text-white sm:text-base">
                Hostel Hub
              </span>
            </Link>
          </div>

          {/* Right: essential actions only */}
          <div className="flex shrink-0 items-center gap-0.5 sm:gap-1">
            <button
              onClick={toggleTheme}
              title={theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
              aria-label="Toggle theme"
              className="rounded-xl p-2.5 text-slate-600 transition-colors hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </button>

            {/* Notifications */}
            <div className="relative">
              <button
                onClick={() => setNotifOpen(!notifOpen)}
                aria-label="Notifications"
                className="relative rounded-xl p-2.5 text-slate-600 transition-colors hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                <Bell className="h-5 w-5" />
                {unreadCount > 0 && (
                  <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </button>

              {notifOpen && (
                <div className="absolute right-0 mt-2 w-[19rem] rounded-2xl border border-slate-200 bg-white p-3 shadow-card-hover dark:border-slate-800 dark:bg-slate-900 z-50">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2 dark:border-slate-800">
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white">Notifications</h4>
                    <button
                      onClick={markAllRead}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-600 hover:underline dark:text-indigo-400"
                    >
                      <CheckCheck className="h-3 w-3" /> Mark all read
                    </button>
                  </div>
                  <div className="mt-2 max-h-64 space-y-2 overflow-y-auto scroll-touch">
                    {notifications.length === 0 ? (
                      <div className="py-8 text-center">
                        <p className="text-xs font-semibold text-slate-400">No notifications yet</p>
                      </div>
                    ) : (
                      notifications.slice(0, 5).map((n) => (
                        <div
                          key={n.id}
                          className={`rounded-xl p-2.5 text-xs transition-colors ${
                            n.read
                              ? "bg-slate-50 text-slate-600 dark:bg-slate-800/40 dark:text-slate-400"
                              : "bg-indigo-50/70 font-medium text-indigo-950 dark:bg-indigo-950/40 dark:text-indigo-200"
                          }`}
                        >
                          <p className="font-bold text-slate-900 dark:text-white">{n.title}</p>
                          <p className="mt-0.5 text-[11px] leading-tight opacity-90">{n.message}</p>
                          <span className="mt-1 block text-[9px] text-slate-400">
                            {new Date(n.timestamp).toLocaleDateString([], { month: "short", day: "numeric" })} ·{" "}
                            {new Date(n.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                  <Link
                    to="/notifications"
                    onClick={() => setNotifOpen(false)}
                    className="mt-2 block rounded-xl bg-slate-50 py-2 text-center text-xs font-bold text-indigo-600 hover:bg-slate-100 dark:bg-slate-800/60 dark:text-indigo-400"
                  >
                    View all notifications →
                  </Link>
                </div>
              )}
            </div>

            {/* Avatar / profile shortcut */}
            <Link
              to="/profile"
              aria-label="Profile"
              className="ml-1 flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-800"
            >
              <img src={user?.avatarUrl} alt="" className="h-full w-full object-cover" />
            </Link>

            {/* Desktop-only extras */}
            <Link
              to="/"
              className="hidden items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 xl:inline-flex"
            >
              Public Website
            </Link>
            <span className="hidden items-center gap-1.5 rounded-full bg-indigo-50 px-3 py-1.5 text-[11px] font-bold text-indigo-700 lg:inline-flex dark:bg-indigo-950/60 dark:text-indigo-300">
              <Shield className="h-3 w-3" />
              <span className="uppercase">{user?.role}</span>
            </span>
            <button
              onClick={handleLogout}
              title="Logout"
              className="hidden rounded-xl p-2.5 text-slate-500 transition-colors hover:bg-red-50 hover:text-red-600 dark:text-slate-400 dark:hover:bg-red-950/40 dark:hover:text-red-400 lg:block"
            >
              <LogOut className="h-5 w-5" />
            </button>
          </div>
          </header>
        </div>

        {/* Scrollable content (keeps clear of fixed bottom nav) */}
        <main className="scroll-touch min-h-0 flex-1 overflow-y-auto px-3 pb-24 pt-4 sm:px-6 lg:px-8 lg:pb-8">
          <Outlet />
        </main>
      </div>

      {/* ===== Mobile Bottom Navigation ===== */}
      <BottomNav onOpenDrawer={() => setMobileOpen(true)} />
    </div>
  );
};