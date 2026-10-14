import React, { useState, useEffect } from "react";
import { Search, Plus, ScanFace, ShieldCheck, Users } from "lucide-react";
import { subscribeCollection, createRecord } from "@/lib/firestore";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { ResponsiveTable, type TableColumn } from "@/components/ui/ResponsiveTable";
import { ResponsiveModal } from "@/components/ui/ResponsiveModal";
import { FormField } from "@/components/ui/FormField";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { FaceCapture } from "@/components/faceRecognition/FaceCapture";
import { FrsEnrollModal } from "@/components/faceRecognition/FrsEnrollModal";
import { useDemoAuth } from "@/context/DemoAuthContext";

const INPUT = "w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white";

export default function Students() {
  const { user } = useDemoAuth();
  const { success: toastSuccess } = useToast();
  const [students, setStudents] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [selectedHostel, setSelectedHostel] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [saving, setSaving] = useState(false);

  const [frsStudent, setFrsStudent] = useState<any>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({
    student_id: "",
    name: "",
    email: "",
    branch: "Computer Science (CSE)",
    year: "3rd Year",
    mobile: "",
    hostel: "APJ Abdul Kalam Boys Hostel (BH-1)",
    block: "Block A",
    floor: 1,
    room: "101",
    bed: "Bed 1",
    status: "present",
    parent_name: "",
    parent_phone: "",
    photo_url: "",
    faceDescriptor: null as { label: string; encoding: number[] } | null,
  });

  useEffect(() => {
    const unsub = subscribeCollection("Student", setStudents);
    return () => unsub();
  }, []);

  const handleCreateStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.student_id || !form.name) return;
    setSaving(true);
    try {
      await createRecord("Student", {
        ...form,
        faceDescriptor: form.faceDescriptor || null,
        photo_url:
          form.photo_url ||
          "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
        face_enrolled: !!form.faceDescriptor,
      });
      setModalOpen(false);
      toastSuccess("Student added successfully");
    } finally {
      setSaving(false);
    }
  };

  const filtered = students.filter((s) => {
    const q = search.toLowerCase();
    const matchesSearch =
      (s.name || "").toLowerCase().includes(q) ||
      (s.student_id || "").toLowerCase().includes(q) ||
      (s.room && s.room.toString().includes(q));
    const matchesHostel = selectedHostel === "all" || s.hostel === selectedHostel;
    const matchesStatus = selectedStatus === "all" || s.status === selectedStatus;
    return matchesSearch && matchesHostel && matchesStatus;
  });

  const columns: TableColumn<any>[] = [
    {
      key: "student",
      header: "Student",
      render: (s) => (
        <div className="flex items-center gap-3">
          <img src={s.photo_url} alt={s.name} className="h-9 w-9 shrink-0 rounded-full border border-slate-200 object-cover" />
          <div className="min-w-0">
            <p className="truncate font-bold text-slate-900 dark:text-white">{s.name}</p>
            <p className="font-mono text-[10px] text-indigo-600 dark:text-indigo-400">{s.student_id}</p>
          </div>
        </div>
      ),
    },
    {
      key: "branch",
      header: "Branch & Year",
      render: (s) => (
        <div>
          <p className="font-semibold text-slate-800 dark:text-slate-200">{s.branch}</p>
          <p className="text-[10px] text-slate-500">{s.year}</p>
        </div>
      ),
    },
    {
      key: "room",
      header: "Hostel & Room",
      render: (s) => (
        <div>
          <p className="max-w-[200px] truncate font-semibold text-slate-800 dark:text-slate-200">{s.hostel}</p>
          <p className="text-[10px] text-slate-500">{s.block} · Room {s.room} ({s.bed})</p>
        </div>
      ),
    },
    {
      key: "contact",
      header: "Contact",
      cardHidden: true,
      render: (s) => (
        <div>
          <p className="text-slate-800 dark:text-slate-200">{s.mobile}</p>
          <p className="max-w-[150px] truncate text-[10px] text-slate-500">{s.email}</p>
        </div>
      ),
    },
    {
      key: "parent",
      header: "Parent",
      cardHidden: true,
      render: (s) => (
        <div>
          <p className="text-slate-800 dark:text-slate-200">{s.parent_name}</p>
          <p className="text-[10px] text-slate-500">{s.parent_phone}</p>
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (s) => <StatusBadge status={s.status} size="sm" />,
    },
    {
      key: "frs",
      header: "FRS",
      render: (s) =>
        s.face_enrolled || (s.faceDescriptor && s.faceDescriptor.encoding && s.faceDescriptor.encoding.length > 0) ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
            <ShieldCheck className="h-3 w-3" /> Enrolled
          </span>
        ) : (
          <button
            onClick={() => setFrsStudent(s)}
            className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-indigo-700"
          >
            <ScanFace className="h-3 w-3" /> Register FRS
          </button>
        ),
    },
  ];

  const cardActions = (s: any) => (
    <button
      onClick={() => setFrsStudent(s)}
      aria-label={`Register face for ${s.name}`}
      className="rounded-lg bg-indigo-50 p-2 text-indigo-600 transition-colors hover:bg-indigo-100 dark:bg-indigo-950/50 dark:text-indigo-300"
    >
      <ScanFace className="h-4 w-4" />
    </button>
  );

  const resetForm = () => {
    setForm({
      student_id: "",
      name: "",
      email: "",
      branch: "Computer Science (CSE)",
      year: "3rd Year",
      mobile: "",
      hostel: "APJ Abdul Kalam Boys Hostel (BH-1)",
      block: "Block A",
      floor: 1,
      room: "101",
      bed: "Bed 1",
      status: "present",
      parent_name: "",
      parent_phone: "",
      photo_url: "",
      faceDescriptor: null,
    });
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <PageHeader
        title="Student Directory"
        subtitle={`Managing ${students.length} registered hostel residents`}
        actions={
          <Button
            onClick={() => {
              resetForm();
              setModalOpen(true);
            }}
          >
            <Plus className="h-4 w-4" /> Add New Student
          </Button>
        }
      />

      {/* Filters */}
      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:flex-row sm:items-center sm:justify-between sm:p-4">
        <div className="relative w-full sm:w-auto sm:flex-1">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            placeholder="Search name, ID, or room..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-4 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={selectedHostel}
            onChange={(e) => setSelectedHostel(e.target.value)}
            className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-900 focus:outline-none sm:flex-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          >
            <option value="all">All Hostels</option>
            <option value="APJ Abdul Kalam Boys Hostel (BH-1)">BH-1 (APJ Abdul Kalam)</option>
            <option value="CV Raman Boys Hostel (BH-2)">BH-2 (CV Raman)</option>
            <option value="Kalpana Chawla Girls Hostel (GH-1)">GH-1 (Kalpana Chawla)</option>
          </select>

          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-900 focus:outline-none sm:flex-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          >
            <option value="all">All Statuses</option>
            <option value="present">Present</option>
            <option value="outside">Outside</option>
            <option value="leave">On Leave</option>
            <option value="late">Late Return</option>
          </select>
        </div>
      </div>

      <ResponsiveTable
        columns={columns}
        rows={filtered}
        rowKey={(s) => s.id}
        cardActions={cardActions}
        cardHeader={(s) => (
          <div className="flex items-center gap-3">
            <img src={s.photo_url} alt={s.name} className="h-11 w-11 shrink-0 rounded-full border border-slate-200 object-cover" />
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-slate-900 dark:text-white">{s.name}</p>
              <p className="font-mono text-[11px] text-indigo-600 dark:text-indigo-400">{s.student_id}</p>
            </div>
          </div>
        )}
        empty={
          <EmptyState
            icon={Users}
            title="No students found"
            description="Try adjusting your search query or filters."
            action={
              <Button variant="secondary" size="sm" onClick={() => { setSearch(""); setSelectedHostel("all"); setSelectedStatus("all"); }}>
                Clear filters
              </Button>
            }
          />
        }
      />

      {/* Add Student → Bottom sheet on mobile, dialog on desktop */}
      <ResponsiveModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Register New Student"
        size="lg"
        footer={
          <div className="flex gap-3">
            <Button variant="secondary" fullWidth onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button fullWidth form="student-form" type="submit" loading={saving}>
              Save Student Record
            </Button>
          </div>
        }
      >
        <form id="student-form" onSubmit={handleCreateStudent} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField label="Student ID" required>
            <input className={INPUT} required placeholder="22091A010" value={form.student_id} onChange={(e) => setForm({ ...form, student_id: e.target.value })} />
          </FormField>
          <FormField label="Full Name" required>
            <input className={INPUT} required placeholder="Venkatesh Rao" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </FormField>
          <FormField label="Branch">
            <select className={INPUT} value={form.branch} onChange={(e) => setForm({ ...form, branch: e.target.value })}>
              <option>Computer Science (CSE)</option>
              <option>Electronics & Comm (ECE)</option>
              <option>Electrical & Electronics (EEE)</option>
              <option>Mechanical Eng (ME)</option>
              <option>Civil Eng (CE)</option>
              <option>AI & Data Science (AIDS)</option>
            </select>
          </FormField>
          <FormField label="Year">
            <select className={INPUT} value={form.year} onChange={(e) => setForm({ ...form, year: e.target.value })}>
              <option>1st Year</option>
              <option>2nd Year</option>
              <option>3rd Year</option>
              <option>4th Year</option>
            </select>
          </FormField>
          <FormField label="Mobile">
            <input className={INPUT} type="tel" value={form.mobile} onChange={(e) => setForm({ ...form, mobile: e.target.value })} placeholder="+91 98765 43210" />
          </FormField>
          <FormField label="Hostel">
            <select className={INPUT} value={form.hostel} onChange={(e) => setForm({ ...form, hostel: e.target.value })}>
              <option>APJ Abdul Kalam Boys Hostel (BH-1)</option>
              <option>CV Raman Boys Hostel (BH-2)</option>
              <option>Kalpana Chawla Girls Hostel (GH-1)</option>
            </select>
          </FormField>
          <FormField label="Block">
            <input className={INPUT} value={form.block} onChange={(e) => setForm({ ...form, block: e.target.value })} />
          </FormField>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Room No">
              <input className={INPUT} value={form.room} onChange={(e) => setForm({ ...form, room: e.target.value })} />
            </FormField>
            <FormField label="Bed">
              <input className={INPUT} value={form.bed} onChange={(e) => setForm({ ...form, bed: e.target.value })} />
            </FormField>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:col-span-2">
            <FormField label="Parent Name">
              <input className={INPUT} value={form.parent_name} onChange={(e) => setForm({ ...form, parent_name: e.target.value })} placeholder="Mr. Rao" />
            </FormField>
            <FormField label="Parent Phone">
              <input className={INPUT} type="tel" value={form.parent_phone} onChange={(e) => setForm({ ...form, parent_phone: e.target.value })} placeholder="+91 94400 12345" />
            </FormField>
          </div>

          {form.faceDescriptor && (
            <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-[11px] font-bold text-emerald-700 sm:col-span-2 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300">
              <ShieldCheck className="h-4 w-4 shrink-0" /> Face enrolled for {form.faceDescriptor.label}
            </div>
          )}

          <div className="sm:col-span-2">
            <FaceCapture
              label={form.name || form.student_id || "student"}
              onCaptured={(enc, photo) => {
                setForm((f) => ({ ...f, faceDescriptor: enc, photo_url: photo || f.photo_url }));
              }}
            />
          </div>

          <FormField label="Profile Photo URL (optional)" className="sm:col-span-2">
            <input
              className={INPUT}
              value={form.photo_url}
              onChange={(e) => setForm({ ...form, photo_url: e.target.value })}
              placeholder="https://…/photo.jpg"
            />
          </FormField>
        </form>
      </ResponsiveModal>

      {frsStudent && (
        <FrsEnrollModal
          student={frsStudent}
          actor={user?.name || "Warden"}
          onClose={() => setFrsStudent(null)}
        />
      )}
    </div>
  );
}