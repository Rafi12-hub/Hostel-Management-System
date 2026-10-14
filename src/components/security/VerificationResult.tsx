import React from "react";
import { AlertTriangle, CheckCircle2, XCircle, Clock, User, DoorOpen, ArrowRightLeft } from "lucide-react";

export type VerificationResultKind = "success" | "blocked" | "error";

export interface GateVerificationSummary {
  kind: VerificationResultKind;
  title: string;
  message: string;
  studentName?: string;
  studentId?: string;
  room?: string;
  gate?: string;
  action?: "ENTRY" | "EXIT";
  time?: string;
  matchScore?: number;
  reason?: string;
}

/**
 * Rich gate-verification result shown on the scanner page:
 * green success / amber blocked / red error with icons + student context.
 */
export const VerificationResult: React.FC<{ result: GateVerificationSummary; onReset?: () => void }> = ({
  result,
  onReset,
}) => {
  const config = (() => {
    switch (result.kind) {
      case "success":
        return {
          ring: "border-emerald-300 dark:border-emerald-700",
          chip: "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
          icon: <CheckCircle2 className="h-9 w-9 text-emerald-600" />,
        };
      case "blocked":
        return {
          ring: "border-amber-300 dark:border-amber-700",
          chip: "bg-amber-50 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
          icon: <AlertTriangle className="h-9 w-9 text-amber-500" />,
        };
      case "error":
        return {
          ring: "border-red-300 dark:border-red-700",
          chip: "bg-red-50 text-red-700 dark:bg-red-900/40 dark:text-red-300",
          icon: <XCircle className="h-9 w-9 text-red-500" />,
        };
    }
  })();

  return (
    <div className="space-y-3">
      <div className={`rounded-2xl border-2 bg-white shadow-card p-5 dark:bg-slate-900 ${config.ring}`}>
        <div className="flex items-start gap-4">
          <div className="shrink-0">{config.icon}</div>
          <div className="min-w-0 flex-1">
            <p className="text-base font-bold text-slate-900 dark:text-white">{result.title}</p>
            <p className="mt-1 text-sm font-medium text-slate-500 dark:text-slate-400">{result.message}</p>

            {result.reason && (
              <div className={`mt-3 inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-bold ${config.chip}`}>
                <AlertTriangle className="h-3.5 w-3.5" />
                {result.reason}
              </div>
            )}

            {result.studentName && (
              <div className="mt-4 space-y-2">
                <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
                  <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-700 dark:text-slate-200">
                    <User className="h-4 w-4 text-indigo-600" /> {result.studentName}
                  </span>
                  <span className="text-xs font-bold text-slate-400">{result.studentId}</span>
                  {result.room && (
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400">
                      <DoorOpen className="h-3.5 w-3.5" /> {result.room}
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
                  {result.gate && (
                    <span className="inline-flex items-center gap-1.5">
                      <ArrowRightLeft className="h-3.5 w-3.5 text-emerald-600" />
                      {result.action === "EXIT" ? "EXIT" : "ENTRY"} · {result.gate}
                    </span>
                  )}
                  {result.time && (
                    <span className="inline-flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5 text-slate-400" /> {result.time}
                    </span>
                  )}
                  {result.matchScore !== undefined && (
                    <span className="inline-flex items-center gap-1.5 text-emerald-600">
                      Face match {(result.matchScore * 100).toFixed(0)}%
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {onReset && (
        <button
          onClick={onReset}
          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
        >
          Scan next student
        </button>
      )}
    </div>
  );
};