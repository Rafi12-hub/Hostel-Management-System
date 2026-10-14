import React, { useEffect } from "react";
import { X } from "lucide-react";

interface MobileDrawerProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  side?: "left" | "right";
  widthClass?: string;
  headerLabel?: string;
  showClose?: boolean;
}

export const MobileDrawer: React.FC<MobileDrawerProps> = ({
  open,
  onClose,
  children,
  side = "left",
  widthClass = "w-80 max-w-[86vw]",
  headerLabel,
  showClose = true,
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
    <div className="fixed inset-0 z-[80] lg:hidden">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />

      {/* Panel */}
      <div
        role="dialog"
        aria-modal="true"
        className={`absolute inset-y-0 ${
          side === "left" ? "left-0" : "right-0"
        } flex flex-col bg-white shadow-2xl pt-safe pb-safe dark:bg-slate-900 animate-[drawer-in_.25s_ease-out] ${
          widthClass
        }`}
      >
        {headerLabel && (
          <div className="flex h-14 shrink-0 items-center justify-between border-b border-slate-100 px-4 dark:border-slate-800">
            <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">{headerLabel}</h3>
            {showClose && (
              <button
                onClick={onClose}
                aria-label="Close menu"
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="h-5 w-5" />
              </button>
            )}
          </div>
        )}
        <div className="flex-1 overflow-y-auto scroll-touch">{children}</div>
      </div>

      <style>{`@keyframes drawer-in{from{transform:translateX(${
        side === "left" ? "-100%" : "100%"
      })}to{transform:translateX(0)}}`}</style>
    </div>
  );
};