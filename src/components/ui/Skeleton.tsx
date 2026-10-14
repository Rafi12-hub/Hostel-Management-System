import React from "react";

interface SkeletonProps {
  className?: string;
}

export const Skeleton: React.FC<SkeletonProps> = ({ className = "" }) => (
  <div className={`skeleton ${className}`} aria-hidden="true" />
);

export const SkeletonLine: React.FC<{ className?: string }> = ({ className = "" }) => (
  <div className={`skeleton h-3 ${className}`} aria-hidden="true" />
);

export const SkeletonCircle: React.FC<{ className?: string }> = ({ className = "" }) => (
  <div className={`skeleton rounded-full ${className}`} aria-hidden="true" />
);

/** Full-page inline skeleton used while portal data loads for a card area. */
export const SkeletonCard: React.FC<{ className?: string }> = ({ className = "" }) => (
  <div className={`space-y-3 rounded-[1.25rem] border border-slate-200 bg-white p-5 shadow-card dark:border-slate-800 dark:bg-slate-900 ${className}`}>
    <div className="flex items-center gap-3">
      <SkeletonCircle className="h-9 w-9" />
      <div className="flex-1 space-y-2">
        <SkeletonLine className="w-1/3" />
        <SkeletonLine className="w-1/2" />
      </div>
    </div>
    <SkeletonLine className="w-full" />
    <SkeletonLine className="w-4/5" />
    <SkeletonLine className="w-3/5" />
  </div>
);