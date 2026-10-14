import React from "react";
import { AlertCircle } from "lucide-react";

interface FormFieldProps {
  label: string;
  required?: boolean;
  error?: string;
  hint?: string;
  id?: string;
  className?: string;
  children: React.ReactNode;
}

export const FormField: React.FC<FormFieldProps> = ({
  label,
  required,
  error,
  hint,
  id,
  className = "",
  children,
}) => (
  <div className={`flex flex-col gap-1.5 ${className}`}>
    <label
      htmlFor={id}
      className="text-xs font-bold uppercase tracking-wide text-slate-600 dark:text-slate-300"
    >
      {label}
      {required && <span className="ml-0.5 text-red-500">*</span>}
    </label>
    {children}
    {error ? (
      <p className="flex items-center gap-1.5 text-xs font-semibold text-red-600 dark:text-red-400">
        <AlertCircle className="h-3.5 w-3.5 shrink-0" /> {error}
      </p>
    ) : hint ? (
      <p className="text-[11px] text-slate-400">{hint}</p>
    ) : null}
  </div>
);

export const inputClass = (invalid?: boolean) =>
  `w-full rounded-xl border bg-slate-50 px-3.5 text-sm text-slate-900 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500/30 dark:bg-slate-800 dark:text-white ${
    invalid
      ? "border-red-400 dark:border-red-500"
      : "border-slate-200 focus:border-indigo-500 dark:border-slate-700"
  }`;