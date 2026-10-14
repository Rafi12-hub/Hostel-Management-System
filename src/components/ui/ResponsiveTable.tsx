import React from "react";
import { LoadingSpinner } from "./LoadingSpinner";
import { EmptyState } from "./EmptyState";

export interface TableColumn<T> {
  key: string;
  header: string;
  render: (row: T) => React.ReactNode;
  className?: string;
  /** Hide this column on mobile cards */
  cardHidden?: boolean;
}

interface ResponsiveTableProps<T> {
  columns: TableColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  /** Custom header node for the mobile card (defaults to first visible column) */
  cardHeader?: (row: T) => React.ReactNode;
  /** Custom body node for the mobile card (defaults to a 2-col grid of visible columns) */
  cardBody?: (row: T) => React.ReactNode;
  cardActions?: (row: T) => React.ReactNode;
  loading?: boolean;
  empty?: React.ReactNode;
  className?: string;
}

export function ResponsiveTable<T>({
  columns,
  rows,
  rowKey,
  cardHeader,
  cardBody,
  cardActions,
  loading,
  empty,
  className = "",
}: ResponsiveTableProps<T>) {
  const visibleCols = columns.filter((c) => !c.cardHidden);
  const [titleCol, ...detailCols] = visibleCols;

  if (loading) {
    return (
      <div className={`rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 ${className}`}>
        <LoadingSpinner label="Loading records..." />
      </div>
    );
  }

  if (rows.length === 0) {
    return <div className={className}>{empty || <EmptyState />}</div>;
  }

  return (
    <div className={`${className} space-y-3`}>
      {/* ===== Mobile card list ===== */}
      <div className="grid grid-cols-1 gap-3 md:hidden">
        {rows.map((row) => (
          <div
            key={rowKey(row)}
            className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900"
          >
            <div className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  {cardHeader ? (
                    cardHeader(row)
                  ) : titleCol ? (
                    <div className="text-sm font-bold text-slate-900 dark:text-white">{titleCol.render(row)}</div>
                  ) : null}
                </div>
                {cardActions && <div className="flex shrink-0 items-center gap-1.5">{cardActions(row)}</div>}
              </div>

              <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3">
                {cardBody ? (
                  cardBody(row)
                ) : (
                  detailCols.map((col) => (
                    <div key={col.key} className="flex flex-col">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        {col.header}
                      </span>
                      <span className="mt-0.5 text-xs font-semibold text-slate-700 dark:text-slate-200">
                        {col.render(row)}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ===== Desktop table ===== */}
      <div className="hidden overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 md:block">
        <div className="scroll-touch overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 uppercase text-slate-700 dark:bg-slate-800 dark:text-slate-300">
              <tr>
                {columns.map((c) => (
                  <th key={c.key} className={`px-4 py-3 font-bold ${c.className || ""}`}>
                    {c.header}
                  </th>
                ))}
                {cardActions && <th className="px-4 py-3" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {rows.map((row) => (
                <tr key={rowKey(row)} className="transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-800/50">
                  {columns.map((c) => (
                    <td key={c.key} className={`px-4 py-3.5 ${c.className || ""}`}>
                      {c.render(row)}
                    </td>
                  ))}
                  {cardActions && (
                    <td className="px-4 py-3.5">
                      <div className="flex items-center justify-end gap-1.5">{cardActions(row)}</div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}