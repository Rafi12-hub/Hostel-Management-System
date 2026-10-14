import React, { useState, useEffect } from "react";
import {
  Plus,
  Users,
  Search,
  Edit,
  Trash2,
  X,
  KeyRound,
  UserPlus,
  ShieldCheck,
} from "lucide-react";
import { useDemoAuth, ADMIN_MANAGED_ROLES, type Role } from "@/context/DemoAuthContext";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { EmptyState } from "@/components/ui/EmptyState";

const ROLE_TITLES: Record<Role, string> = {
  student: "Student",
  parent: "Parent / Guardian",
  security: "Security",
  warden: "Warden",
  chief_warden: "Chief Warden",
  mess_manager: "Mess Manager",
  housekeeping: "Housekeeping",
  admin: "Admin",
  management: "Management",
  hostel_office: "Hostel Office",
  medical: "Medical",
  principal: "Principal",
};

interface ModalState {
  open: boolean;
  editingId: string | null;
  name: string;
  email: string;
  password: string;
  role: Role;
  active: boolean;
  studentId: string;
}

const INITIAL_MODAL: ModalState = {
  open: false,
  editingId: null,
  name: "",
  email: "",
  password: "",
  role: "security",
  active: true,
  studentId: "",
};

export default function UserManagement() {
  const { user, listUsers, createUser, updateUser, deleteUser, sendPasswordReset } = useDemoAuth();
  const [users, setUsers] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState<ModalState>(INITIAL_MODAL);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadUsers = async () => {
    const list = await listUsers();
    const sorted = [...list].sort((a, b) => (a.role < b.role ? -1 : a.role > b.role ? 1 : 0));
    setUsers(sorted);
  };

  useEffect(() => {
    loadUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const flash = (msg: string, ok: boolean) => {
    if (ok) setSuccess(msg);
    else setError(msg);
    setTimeout(() => {
      setSuccess("");
      setError("");
    }, 3000);
  };

  const openCreate = () => {
    setModal({ ...INITIAL_MODAL, open: true });
    setError("");
  };

  const openEdit = (u: any) => {
    setModal({
      open: true,
      editingId: u.id,
      name: u.name || "",
      email: u.email,
      password: "",
      role: u.role,
      active: u.active !== false,
      studentId: u.studentId || "",
    });
    setError("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (modal.editingId) {
      const res = await updateUser(modal.editingId, {
        name: modal.name,
        email: modal.email,
        active: modal.active,
      });
      if (!res.ok) return setError(res.error || "Update failed.");
      flash("User account updated successfully.", true);
    } else {
      const res = await createUser({
        name: modal.name,
        email: modal.email,
        password: modal.password,
        role: modal.role,
        studentId: modal.role === "parent" || modal.role === "student" ? modal.studentId : undefined,
      });
      if (!res.ok) return setError(res.error || "Creation failed.");
      flash("User account created successfully.", true);
    }
    setModal({ ...INITIAL_MODAL });
    loadUsers();
  };

  const handleSendReset = async (u: any) => {
    setError("");
    const res = await sendPasswordReset(u.email);
    if (!res.ok) return flash(res.error || "Unable to send reset email.", false);
    flash(`Password reset email sent to ${u.email}.`, true);
  };

  const handleDelete = async (u: any) => {
    if (!window.confirm(`Delete the account for ${u.name || u.email}? This cannot be undone.`)) return;
    const res = await deleteUser(u.id);
    if (!res.ok) return flash(res.error || "Delete failed.", false);
    flash("User account deleted.", true);
    loadUsers();
  };

  const filtered = users.filter((u) => {
    const q = search.toLowerCase();
    return (
      (u.name || "").toLowerCase().includes(q) ||
      (u.email || "").toLowerCase().includes(q) ||
      (u.role || "").toLowerCase().includes(q)
    );
  });

  const staffUsers = filtered.filter((u) => u.role !== "student");
  const studentUsers = filtered.filter((u) => u.role === "student");

  const inputCls =
    "w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs font-semibold text-slate-900 dark:bg-slate-800 dark:border-slate-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500";

  const renderUserRow = (u: any) => (
    <div
      key={u.id}
      className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
          <ShieldCheck className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-bold text-slate-900 dark:text-white truncate">
              {u.name || "—"}
            </p>
            <span className="rounded-md bg-indigo-50 px-2 py-0.5 text-[10px] font-bold uppercase text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
              {ROLE_TITLES[u.role as Role] || u.role}
            </span>
            <StatusBadge
              status={u.active === false ? "disabled" : "active"}
              size="sm"
            />
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{u.email}</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={() => openEdit(u)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 min-h-11"
        >
          <Edit className="h-3.5 w-3.5" /> Edit
        </button>
        <button
          onClick={() => handleSendReset(u)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 px-3 py-2.5 text-xs font-bold text-indigo-600 hover:bg-indigo-50 dark:border-indigo-900 dark:text-indigo-400 dark:hover:bg-indigo-950/40 min-h-11"
        >
          <KeyRound className="h-3.5 w-3.5" /> Send Reset
        </button>
        <button
          onClick={() => handleDelete(u)}
          disabled={u.id === user?.id}
          title={u.id === user?.id ? "You cannot delete your own account" : "Delete account"}
          className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-2.5 text-xs font-bold text-red-600 hover:bg-red-50 disabled:opacity-40 disabled:cursor-not-allowed dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950/40 min-h-11"
        >
          <Trash2 className="h-3.5 w-3.5" /> Delete
        </button>
      </div>
    </div>
  );

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        title="User Account Management"
        subtitle="Create and manage login credentials for staff and students. Accounts are provisioned by warden, chief warden, or admin."
        actions={
          <button
            onClick={openCreate}
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-bold text-white shadow-md hover:bg-indigo-700 active:scale-95 transition-all"
          >
            <UserPlus className="h-4 w-4" /> Create Account
          </button>
        }
      />

      {success && (
        <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4 text-xs font-bold text-emerald-800 flex items-center gap-2 dark:bg-emerald-950/40 dark:border-emerald-900 dark:text-emerald-300">
          <ShieldCheck className="h-4 w-4" /> {success}
        </div>
      )}
      {error && (
        <div className="rounded-xl bg-red-50 border border-red-200 p-4 text-xs font-bold text-red-700 dark:bg-red-950/40 dark:border-red-900 dark:text-red-300">
          {error}
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
        <input
          type="text"
          placeholder="Search by name, email or role..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-xl border border-slate-200 bg-white p-3 pl-10 text-xs font-semibold text-slate-900 dark:bg-slate-900 dark:border-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>

      {/* Staff Accounts (Admin-created) */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <KeyRound className="h-4 w-4 text-indigo-600" />
          <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
            Staff Accounts <span className="text-xs font-semibold text-slate-400">({staffUsers.length}) · Created by Admin</span>
          </h3>
        </div>
        {staffUsers.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No staff accounts yet"
            description="Use 'Create Account' to add login credentials for staff roles such as warden, security, mess manager and more."
          />
        ) : (
          <div className="space-y-3">{staffUsers.map(renderUserRow)}</div>
        )}
      </div>

      {/* Student Accounts (provisioned by staff) */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-emerald-600" />
          <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
            Student Accounts <span className="text-xs font-semibold text-slate-400">({studentUsers.length}) · Created by Admin/Warden</span>
          </h3>
        </div>
        {studentUsers.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No student accounts"
            description="Select the 'Student' role and enter the student ID to provision a login for a hostel resident."
          />
        ) : (
          <div className="space-y-3">{studentUsers.map(renderUserRow)}</div>
        )}
      </div>

      {/* Create / Edit Modal */}
      {modal.open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/60 backdrop-blur-sm p-4 pb-safe sm:items-center">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl sm:dark:bg-slate-900 dark:bg-slate-900 sm:max-h-[90vh] overflow-y-auto max-h-[90vh]">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 dark:border-slate-800">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  {modal.editingId ? "Edit User Account" : "Create User Account"}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {modal.editingId
                    ? "Update credentials or active status."
                    : "Generate login credentials for staff or a student."}
                </p>
              </div>
              <button
                onClick={() => setModal({ ...INITIAL_MODAL })}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="mt-4 space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={modal.name}
                  onChange={(e) => setModal({ ...modal, name: e.target.value })}
                  className={inputCls}
                  placeholder="e.g. Ramesh Kumar"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Email (Login ID)</label>
                <input
                  type="email"
                  required
                  value={modal.email}
                  onChange={(e) => setModal({ ...modal, email: e.target.value })}
                  className={inputCls}
                  placeholder="staff@rgmcet.edu.in"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Role</label>
                  <select
                    value={modal.role}
                    disabled={!!modal.editingId}
                    onChange={(e) => setModal({ ...modal, role: e.target.value as Role })}
                    className={inputCls}
                  >
                    {ADMIN_MANAGED_ROLES.map((r) => (
                      <option key={r} value={r}>
                        {ROLE_TITLES[r]}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Account Status</label>
                  <select
                    value={modal.active ? "active" : "disabled"}
                    onChange={(e) => setModal({ ...modal, active: e.target.value === "active" })}
                    className={inputCls}
                  >
                    <option value="active">Active</option>
                    <option value="disabled">Disabled</option>
                  </select>
                </div>
              </div>
              {!modal.editingId && (
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Temporary Password
                  </label>
                  <input
                    type="password"
                    value={modal.password}
                    onChange={(e) => setModal({ ...modal, password: e.target.value })}
                    required
                    minLength={6}
                    className={inputCls}
                    placeholder="At least 6 characters"
                  />
                  <p className="mt-1 text-[10px] text-slate-400">
                    The user can reset this later via a password reset email.
                  </p>
                </div>
              )}

              {(modal.role === "parent" || modal.role === "student") && (
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {modal.role === "student" ? "Student ID" : "Linked Student ID"}
                  </label>
                  <input
                    type="text"
                    value={modal.studentId}
                    onChange={(e) => setModal({ ...modal, studentId: e.target.value })}
                    required={modal.role === "parent" || modal.role === "student"}
                    className={inputCls}
                    placeholder="e.g. 22091A003"
                  />
                  <p className="mt-1 text-[10px] text-slate-400">
                    {modal.role === "student"
                      ? "The student's profile is linked to this hostel record."
                      : "The parent dashboard will show this student's meal and movement status."}
                  </p>
                </div>
              )}
              {modal.editingId && (
                <>
                  <div className="rounded-xl bg-indigo-50/60 border border-indigo-100 p-3 text-[11px] text-indigo-900 dark:bg-indigo-950/40 dark:border-indigo-900/60 dark:text-indigo-200">
                    You cannot set passwords directly. Send the user a password reset email — they
                    will choose a new password themselves.
                  </div>
                  <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
                    <input
                      type="checkbox"
                      checked={modal.active}
                      onChange={(e) => setModal({ ...modal, active: e.target.checked })}
                      className="h-4 w-4 rounded"
                    />
                    Account active
                  </label>
                </>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setModal({ ...INITIAL_MODAL })}
                  className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-bold text-white shadow-md hover:bg-indigo-700"
                >
                  {modal.editingId ? (
                    <>
                      <Edit className="h-3.5 w-3.5" /> Save Changes
                    </>
                  ) : (
                    <>
                      <Plus className="h-3.5 w-3.5" /> Create Account
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
