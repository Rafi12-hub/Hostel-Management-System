import React, { useState, useEffect } from "react";
import { Search, Package } from "lucide-react";
import { subscribeCollection } from "@/lib/firestore";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { ResponsiveTable, type TableColumn } from "@/components/ui/ResponsiveTable";

export default function Inventory() {
  const [items, setItems] = useState<any[]>([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const unsub = subscribeCollection("Inventory", setItems);
    return () => unsub();
  }, []);

  const filtered = items.filter(
    (i) =>
      i.item.toLowerCase().includes(search.toLowerCase()) ||
      i.category.toLowerCase().includes(search.toLowerCase())
  );

  const columns: TableColumn<any>[] = [
    {
      key: "item",
      header: "Item Name",
      render: (i) => <span className="font-bold text-slate-900 dark:text-white">{i.item}</span>,
    },
    {
      key: "category",
      header: "Category",
      render: (i) => <span className="text-slate-800 dark:text-slate-200">{i.category}</span>,
    },
    {
      key: "quantity",
      header: "Quantity",
      render: (i) => <span className="font-extrabold text-indigo-600 dark:text-indigo-400">{i.quantity} {i.unit}</span>,
    },
    {
      key: "supplier",
      header: "Supplier",
      cardHidden: true,
      render: (i) => <span className="text-slate-700 dark:text-slate-300">{i.supplier}</span>,
    },
    {
      key: "expiry",
      header: "Expiry",
      cardHidden: true,
      render: (i) => <span className="text-slate-700 dark:text-slate-300">{i.expiry}</span>,
    },
    {
      key: "status",
      header: "Stock Status",
      render: (i) => <StatusBadge status={i.status} size="sm" />,
    },
  ];

  return (
    <div className="space-y-5 sm:space-y-6">
      <PageHeader
        title="Hostel Inventory"
        subtitle="Manage food grains, cleaning chemicals, electrical spares, and medical supplies"
      />

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search inventory items..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-4 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          />
        </div>
      </div>

      <ResponsiveTable
        columns={columns}
        rows={filtered}
        rowKey={(i) => i.id}
        cardHeader={(i) => (
          <div className="flex items-center justify-between">
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-slate-900 dark:text-white">{i.item}</p>
              <p className="text-[11px] text-slate-500">{i.category}</p>
            </div>
            <StatusBadge status={i.status} size="sm" />
          </div>
        )}
        cardBody={(i) => (
          <div className="flex items-center justify-between text-xs">
            <span className="font-extrabold text-indigo-600 dark:text-indigo-400">{i.quantity} {i.unit}</span>
            <span className="text-slate-500">Exp: {i.expiry}</span>
          </div>
        )}
        empty={
          <EmptyState icon={Package} title="No inventory items" description="Stock data will appear here." />
        }
      />
    </div>
  );
}