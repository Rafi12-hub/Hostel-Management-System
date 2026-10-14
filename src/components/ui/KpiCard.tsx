import React from "react";
import { type LucideIcon } from "lucide-react";

export type KpiTone = "slate" | "blue" | "green" | "amber" | "red" | "purple" | "teal" | "indigo";

interface KpiCardProps {
  label: string;
  value: string | number;
  sub?: string;
  icon: LucideIcon;
  tone?: KpiTone;
  className?: string;
  onClick?: () => void;
}

const TONE_CLASSES: Record<KpiTone, { bg: string; iconBg: string; text: string; iconColor: string }> = {
  slate: { bg: "bg-slate-50 border-slate-200 dark:bg-slate-900 dark:border-slate-800", iconBg: "bg-slate-200 dark:bg-slate-800", text: "text-slate-900 dark:text-slate-100", iconColor: "text-slate-700 dark:text-slate-300" },
  blue: { bg: "bg-blue-50/70 border-blue-200 dark:bg-blue-950/40 dark:border-blue-900", iconBg: "bg-blue-100 dark:bg-blue-900/60", text: "text-blue-950 dark:text-blue-100", iconColor: "text-blue-600 dark:text-blue-400" },
  green: { bg: "bg-emerald-50/70 border-emerald-200 dark:bg-emerald-950/40 dark:border-emerald-900", iconBg: "bg-emerald-100 dark:bg-emerald-900/60", text: "text-emerald-950 dark:text-emerald-100", iconColor: "text-emerald-600 dark:text-emerald-400" },
  amber: { bg: "bg-amber-50/70 border-amber-200 dark:bg-amber-950/40 dark:border-amber-900", iconBg: "bg-amber-100 dark:bg-amber-900/60", text: "text-amber-950 dark:text-amber-100", iconColor: "text-amber-600 dark:text-amber-400" },
  red: { bg: "bg-red-50/70 border-red-200 dark:bg-red-950/40 dark:border-red-900", iconBg: "bg-red-100 dark:bg-red-900/60", text: "text-red-950 dark:text-red-100", iconColor: "text-red-600 dark:text-red-400" },
  purple: { bg: "bg-purple-50/70 border-purple-200 dark:bg-purple-950/40 dark:border-purple-900", iconBg: "bg-purple-100 dark:bg-purple-900/60", text: "text-purple-950 dark:text-purple-100", iconColor: "text-purple-600 dark:text-purple-400" },
  teal: { bg: "bg-teal-50/70 border-teal-200 dark:bg-teal-950/40 dark:border-teal-900", iconBg: "bg-teal-100 dark:bg-teal-900/60", text: "text-teal-950 dark:text-teal-100", iconColor: "text-teal-600 dark:text-teal-400" },
  indigo: { bg: "bg-indigo-50/70 border-indigo-200 dark:bg-indigo-950/40 dark:border-indigo-900", iconBg: "bg-indigo-100 dark:bg-indigo-900/60", text: "text-indigo-950 dark:text-indigo-100", iconColor: "text-indigo-600 dark:text-indigo-400" },
};

export const KpiCard: React.FC<KpiCardProps> = ({
  label,
  value,
  sub,
  icon: Icon,
  tone = "indigo",
  className = "",
  onClick,
}) => {
  const styles = TONE_CLASSES[tone] || TONE_CLASSES.indigo;

  return (
    <div
      onClick={onClick}
      className={`rounded-xl border p-5 transition-all duration-200 hover:shadow-md ${styles.bg} ${onClick ? "cursor-pointer active:scale-98" : ""} ${className}`}
    >
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400">{label}</p>
          <h3 className={`mt-1.5 text-2xl font-bold tracking-tight ${styles.text}`}>{value}</h3>
          {sub && <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{sub}</p>}
        </div>
        <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${styles.iconBg}`}>
          <Icon className={`h-6 w-6 ${styles.iconColor}`} />
        </div>
      </div>
    </div>
  );
};
