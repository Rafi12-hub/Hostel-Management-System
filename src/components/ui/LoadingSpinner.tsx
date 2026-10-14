import React from "react";

interface LoadingSpinnerProps {
  label?: string;
  className?: string;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ label = "Loading...", className = "" }) => {
  return (
    <div className={`flex flex-col items-center justify-center p-8 ${className}`}>
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-600 dark:border-indigo-950 dark:border-t-indigo-400" />
      {label && <p className="mt-3 text-xs font-medium text-slate-500 dark:text-slate-400">{label}</p>}
    </div>
  );
};

// Full-viewport loader used as the React.lazy Suspense fallback.
// 100dvh instead of 100vh: the dynamic viewport height stays correct when the
// mobile browser chrome collapses/expands so the loader never crops or jumps.
export const PageLoader: React.FC = () => (
  <div className="flex min-h-dvh items-center justify-center bg-white dark:bg-slate-950">
    <LoadingSpinner label="Loading page..." />
  </div>
);
