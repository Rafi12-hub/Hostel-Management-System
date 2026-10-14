import React, { useState, useEffect } from "react";
import { Plus, LogOut } from "lucide-react";
import { subscribeCollection, createRecord, updateRecord } from "@/lib/firestore";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { PageHeader } from "@/components/ui/PageHeader";
import { ResponsiveModal } from "@/components/ui/ResponsiveModal";
import { ResponsiveTable, type TableColumn } from "@/components/ui/ResponsiveTable";
import { FormField } from "@/components/ui/FormField";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/Toast";

const INPUT = "w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white";

export default function Visitors() {
  const [visitors, setVisitors] = useState<any[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const { success: toastSuccess } = useToast();

  const [form, setForm] = useState({
    name: "",
    phone: "",
    relationship: "Father",
    student_name: "",
    student_id: "",
    purpose: "",
    entry_time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    expected_exit: "16:00",
    id_verification: "Aadhaar Verified",
  });

  useEffect(() => {
    const unsub = subscribeCollection("Visitor", setVisitors);
    return () => unsub();
  }, []);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await createRecord("Visitor", { ...form, status: "inside" });
      setModalOpen(false);
      toastSuccess("Visitor registered successfully");
    } finally {
      setSaving(false);
    }
  };

  const handleCheckout = async (id: string) => {
    await updateRecord("Visitor", id, { status: "exited" });
  };

  const columns: TableColumn<any>[] = [
    {
      key: "visitor",
      header: "Visitor Details",
      render: (v) => (
        <div>
          <p className="font-bold text-slate-900 dark:text-white">{v.name}</p>
          <p className="text-[10px] text-slate-500">{v.phone}</p>
        </div>
      ),
    },
    {
      key: "relationship",
      header: "Relationship",
      cardHidden: true,
      render: (v) => <span className="text-slate-800 dark:text-slate-200">{v.relationship}</span>,
    },
    {
      key: "student",
      header: "Resident Student",
      render: (v) => <span className="font-bold text-indigo-600 dark:text-indigo-400">{v.student_name}</span>,
    },
    {
      key: "purpose",
      header: "Purpose",
      cardHidden: true,
      render: (v) => <span className="max-w-[200px] truncate text-slate-700 dark:text-slate-300">{v.purpose}</span>,
    },
    {
      key: "timings",
      header: "Timings",
      cardHidden: true,
      render: (v) => <span className="text-slate-800 dark:text-slate-200">In: {v.entry_time} | Out: {v.expected_exit}</span>,
    },
    {
      key: "id",
      header: "ID Status",
      cardHidden: true,
      render: (v) => <span className="font-semibold text-emerald-600">{v.id_verification}</span>,
    },
    {
      key: "status",
      header: "Status",
      render: (v) => <StatusBadge status={v.status} size="sm" />,
    },
    {
      key: "actions",
      header: "Actions",
      render: (v) =>
        v.status === "inside" ? (
          <Button variant="danger" size="sm" onClick={() => handleCheckout(v.id)}>
            <LogOut className="h-3 w-3" /> Log Exit
          </Button>
        ) : null,
    },
  ];

  return (
    <div className="space-y-5 sm:space-y-6">
      <PageHeader
        title="Visitor Register"
        subtitle="Track parent and guardian visits, ID verification, and security lobby checkouts"
        actions={
          <Button onClick={() => setModalOpen(true)}>
            <Plus className="h-4 w-4" /> Register Visitor
          </Button>
        }
      />

      <ResponsiveTable
        columns={columns}
        rows={visitors}
        rowKey={(v) => v.id}
        cardHeader={(v) => (
          <div className="flex items-center justify-between">
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-slate-900 dark:text-white">{v.name}</p>
              <p className="text-[11px] text-slate-500">{v.relationship}</p>
            </div>
            <StatusBadge status={v.status} size="sm" />
          </div>
        )}
        cardBody={(v) => (
          <div className="space-y-1 text-xs">
            <p className="text-slate-600 dark:text-slate-300">{v.purpose}</p>
            <div className="flex items-center justify-between">
              <span className="text-slate-500">In: {v.entry_time} → Out: {v.expected_exit}</span>
              {v.status === "inside" && (
                <Button variant="danger" size="sm" onClick={() => handleCheckout(v.id)}>
                  <LogOut className="h-3 w-3" /> Exit
                </Button>
              )}
            </div>
          </div>
        )}
        empty={
          <EmptyState icon={LogOut} title="No visitors recorded" description="Register a visitor when someone checks in." />
        }
      />

      <ResponsiveModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Register Visitor Entry"
        footer={
          <div className="flex gap-3">
            <Button variant="secondary" fullWidth onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button fullWidth form="visitor-form" type="submit" loading={saving}>Log Check-In</Button>
          </div>
        }
      >
        <form id="visitor-form" onSubmit={handleRegister} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField label="Visitor Name" required>
            <input className={INPUT} required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </FormField>
          <FormField label="Phone Number" required>
            <input className={INPUT} required value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </FormField>
          <FormField label="Relationship">
            <input className={INPUT} value={form.relationship} onChange={(e) => setForm({ ...form, relationship: e.target.value })} />
          </FormField>
          <FormField label="Resident Student" required>
            <input className={INPUT} required value={form.student_name} onChange={(e) => setForm({ ...form, student_name: e.target.value })} />
          </FormField>
          <FormField label="Purpose of Visit" className="sm:col-span-2">
            <textarea rows={2} className={INPUT} value={form.purpose} onChange={(e) => setForm({ ...form, purpose: e.target.value })} />
          </FormField>
          <div className="grid grid-cols-2 gap-3 sm:col-span-2">
            <FormField label="Entry Time">
              <input className={INPUT} type="time" value={form.entry_time} onChange={(e) => setForm({ ...form, entry_time: e.target.value })} />
            </FormField>
            <FormField label="Expected Exit">
              <input className={INPUT} type="time" value={form.expected_exit} onChange={(e) => setForm({ ...form, expected_exit: e.target.value })} />
            </FormField>
          </div>
        </form>
      </ResponsiveModal>
    </div>
  );
}