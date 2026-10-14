import React, { useEffect } from "react";
import { X } from "lucide-react";

interface ResponsiveModalProps {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: string;
  size?: "sm" | "md" | "lg" | "xl";
}

const SIZE_CLASSES = {
  sm: "sm:max-w-md",
  md: "sm:max-w-lg",
  lg: "sm:max-w-2xl",
  xl: "sm:max-w-4xl",
};

export const ResponsiveModal: React.FC<ResponsiveModalProps> = ({
  open,
  onClose,
  title,
  children,
  footer,
  maxWidth,
  size = "md",
}) => {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[90] overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />

      {/* Bottom sheet on mobile → centered dialog on larger screens */}
      <div className="flex min-h-full items-center justify-center p-0 sm:p-6">
        <div
          role="dialog"
          aria-modal="true"
className={`modal-sheet flex w-full flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl pb-safe dark:bg-slate-900 sm:rounded-2xl ${
            maxWidth || SIZE_CLASSES[size]
          }`}
        >
          {title && (
            <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-5 py-4 pt-safe dark:border-slate-800">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">{title}</h3>
              <button
                onClick={onClose}
                aria-label="Close dialog"
                className="-mr-1 rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          )}

          <div className="flex-1 overflow-y-auto scroll-touch px-5 py-5">{children}</div>

          {footer && (
            <div className="shrink-0 border-t border-slate-100 px-5 py-4 dark:border-slate-800">
              {footer}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};