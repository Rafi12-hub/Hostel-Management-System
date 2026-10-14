import React from "react";
import { Link, useLocation } from "react-router-dom";
import {
  Home,
  Users,
  QrCode,
  Utensils,
  MoreHorizontal,
  type LucideIcon,
} from "lucide-react";
import { useDemoAuth, type Role } from "@/context/DemoAuthContext";

interface BottomNavItem {
  label: string;
  path?: string;
  icon: LucideIcon;
  visible: (role: Role) => boolean;
  action?: "drawer";
}

const ITEMS: BottomNavItem[] = [
  {
    label: "Home",
    path: "/dashboard",
    icon: Home,
    visible: () => true,
  },
  {
    label: "Students",
    path: "/students",
    icon: Users,
    visible: (r) =>
      ["admin", "warden", "chief_warden", "hostel_office", "management", "principal"].includes(r),
  },
  {
    label: "Passes",
    path: "/gate-pass",
    icon: QrCode,
    visible: (r) => ["student", "security", "warden", "admin", "chief_warden", "hostel_office"].includes(r),
  },
  {
    label: "Mess",
    path: "/mess",
    icon: Utensils,
    visible: (r) => ["student", "mess_manager", "admin", "chief_warden"].includes(r),
  },
];

interface BottomNavProps {
  onOpenDrawer: () => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({ onOpenDrawer }) => {
  const { role } = useDemoAuth();
  const location = useLocation();

  const quickItems = (role ? ITEMS.filter((i) => i.visible(role)) : []).slice(0, 3);

  const isActive = (path: string) =>
    location.pathname === path || (path === "/dashboard" && location.pathname === "/");

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200/80 bg-white/90 backdrop-blur-lg pb-safe dark:border-slate-800 dark:bg-slate-900/90 lg:hidden"
      aria-label="Bottom navigation"
    >
      <div className="flex items-stretch justify-around px-2 pt-1.5">
        {quickItems.map((item) => {
          const Icon = item.icon;
          const active = item.path && isActive(item.path);
          return (
            <Link
              key={item.label}
              to={item.path!}
              aria-current={active ? "page" : undefined}
              className="relative flex min-w-0 flex-1 flex-col items-center gap-1 py-1.5"
            >
              <span
                className={`flex h-8 w-14 items-center justify-center rounded-full transition-all ${
                  active
                    ? "bg-indigo-600/10 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300"
                    : "text-slate-400 dark:text-slate-500"
                }`}
              >
                <Icon className={`h-[22px] w-[22px] ${active ? "stroke-[2.2]" : "stroke-[1.8]"}`} />
              </span>
              <span
                className={`text-[10px] font-semibold leading-none ${
                  active ? "text-indigo-700 dark:text-indigo-300" : "text-slate-400 dark:text-slate-500"
                }`}
              >
                {item.label}
              </span>
            </Link>
          );
        })}

        {/* More → full navigation drawer */}
        <button
          onClick={onOpenDrawer}
          aria-label="Open full menu"
          className="relative flex min-w-0 flex-1 flex-col items-center gap-1 py-1.5"
        >
          <span className="flex h-8 w-14 items-center justify-center rounded-full text-slate-400 transition-all dark:text-slate-500">
            <MoreHorizontal className="h-[22px] w-[22px] stroke-[1.8]" />
          </span>
          <span className="text-[10px] font-semibold leading-none text-slate-400 dark:text-slate-500">More</span>
        </button>
      </div>
    </nav>
  );
};