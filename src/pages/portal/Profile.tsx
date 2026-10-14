import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  User as UserIcon,
  GraduationCap,
  Building2,
  Phone,
  Siren,
  Settings,
  Bell,
  Lock,
  LifeBuoy,
  LogOut,
  ChevronRight,
  Mail,
  Cake,
  HelpCircle,
  CheckCircle2,
  X,
  Fingerprint,
  ShieldCheck,
} from "lucide-react";
import { useDemoAuth } from "@/context/DemoAuthContext";
import { subscribeCollection } from "@/lib/firestore";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { QRCode } from "@/components/ui/QRCode";

export default function Profile() {
  const { user, logout, sendPasswordReset } = useDemoAuth();
  const navigate = useNavigate();
  const [students, setStudents] = useState<any[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [passResetOpen, setPassResetOpen] = useState(false);
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  useEffect(() => {
    const unsub = subscribeCollection("Student", (data) => {
      setStudents(data);
      setLoaded(true);
    });
    return () => unsub();
  }, []);

  const me = useMemo(
    () => students.find((s) => String(s.student_id).trim().toUpperCase() === String(user?.studentId || "").toUpperCase()),
    [students, user?.studentId]
  );

  return (
    <div className="mx-auto max-w-md space-y-5 pb-4">
      {/* Header avatar */}
      <header className="flex flex-col items-center pt-2">
        <img
          src={user?.avatarUrl}
          alt={user?.name}
          className="h-20 w-20 rounded-[1.5rem] border border-slate-200 object-cover shadow-card dark:border-slate-700"
        />
        <h1 className="font-display mt-3 text-xl font-bold tracking-tight text-slate-900 dark:text-white">
          {user?.name}
        </h1>
        <p className="text-xs font-medium text-indigo-600 dark:text-indigo-400">
          {user?.roleTitle || user?.role}
        </p>
      </header>

      {/* Digital ID card — scanned at the security gate for Gate Pass verification */}
      <section className="overflow-hidden rounded-[1.25rem] border border-slate-200 bg-white shadow-card dark:border-slate-800 dark:bg-slate-900">
        <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 p-5 text-white">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-indigo-300">
              RGMCET Resident Digital ID
            </span>
            <span className="text-[10px] font-semibold text-slate-400">2026–2027</span>
          </div>
          <div className="mt-4 flex items-center gap-4">
            <img
              src={user?.avatarUrl}
              alt={user?.name}
              className="h-14 w-14 rounded-2xl border-2 border-indigo-400/60 object-cover"
            />
            <div className="min-w-0">
              <h3 className="truncate text-base font-extrabold">{user?.name}</h3>
              <p className="font-mono text-xs text-indigo-300">{user?.studentId}</p>
              <p className="mt-0.5 truncate text-[11px] text-slate-300">
                {user?.hostel?.split(" (")[0]} · Room {user?.room}
              </p>
            </div>
          </div>
        </div>
        <div className="flex flex-col items-center p-5">
          <div className="rounded-2xl border border-slate-100 p-3 dark:border-slate-800">
            <QRCode
              value={`${user?.studentId}|${user?.name}|${user?.hostel}|${user?.room}`}
              size={140}
            />
          </div>
          <p className="mt-3 text-center text-[10px] font-medium text-slate-400">
            Scan at Security Gate for Gate Pass verification
          </p>
        </div>
      </section>

      {/* Personal Information */}
      <section>
        <h2 className="mb-2.5 flex items-center gap-1.5 text-sm font-bold text-slate-900 dark:text-white">
          <UserIcon className="h-4 w-4 text-indigo-600" /> Personal Information
        </h2>
        <div className="overflow-hidden rounded-[1.25rem] border border-slate-200 bg-white shadow-card dark:border-slate-800 dark:bg-slate-900">
          <Row icon={GraduationCap} label="Student ID" value={user?.studentId} mono load={loaded} />
          <Divider />
          <Row icon={UserIcon} label="Branch" value={me?.branch} load={loaded} />
          <Divider />
          <Row icon={GraduationCap} label="Year" value={me?.year} load={loaded} />
          <Divider />
          <Row icon={Mail} label="Email" value={user?.email} load={loaded} />
        </div>
      </section>

      {/* Hostel Information */}
      <section>
        <h2 className="mb-2.5 flex items-center gap-1.5 text-sm font-bold text-slate-900 dark:text-white">
          <Building2 className="h-4 w-4 text-teal-600" /> Hostel Information
        </h2>
        <div className="overflow-hidden rounded-[1.25rem] border border-slate-200 bg-white shadow-card dark:border-slate-800 dark:bg-slate-900">
          <Row icon={Building2} label="Hostel" value={user?.hostel} load={loaded} />
          <Divider />
          <Row icon={UserIcon} label="Block" value={me?.block} load={loaded} />
          <Divider />
          <Row icon={ChevronRight} label="Room · Bed" value={`${user?.room} · ${me?.bed || "—"}`} load={loaded} />
          <Divider />
          <Row icon={Phone} label="Mobile" value={me?.mobile} load={loaded} />
        </div>
      </section>

      {/* Emergency Contact */}
      <section>
        <h2 className="mb-2.5 flex items-center gap-1.5 text-sm font-bold text-slate-900 dark:text-white">
          <Siren className="h-4 w-4 text-red-500" /> Emergency Contact
        </h2>
        <div className="overflow-hidden rounded-[1.25rem] border border-slate-200 bg-white shadow-card dark:border-slate-800 dark:bg-slate-900">
          <Row icon={UserIcon} label="Parent / Guardian" value={me?.parent_name} load={loaded} />
          <Divider />
          <Row icon={Phone} label="Contact Number" value={me?.parent_phone} mono load={loaded} />
        </div>
      </section>

      {/* Face & Gate Security */}
      {user?.role === "student" && (
        <section>
          <h2 className="mb-2.5 flex items-center gap-1.5 text-sm font-bold text-slate-900 dark:text-white">
            <ShieldCheck className="h-4 w-4 text-indigo-600" /> Face & Gate Security
          </h2>
          <div className="overflow-hidden rounded-[1.25rem] border border-slate-200 bg-white shadow-card dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center gap-3 px-4 py-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-50 dark:bg-indigo-950/50">
                <Fingerprint className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-bold text-slate-900 dark:text-white">Face recognition</span>
                <span className="block truncate text-[11px] font-medium text-slate-400">
                  {me?.face_enrolled
                    ? `Enrolled · ${me.face_samples || 0} sample(s) ready`
                    : "Not enrolled yet — gate scanning needs your face"}
                </span>
              </span>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                me?.face_enrolled
                  ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"
                  : "bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300"
              }`}>
                {me?.face_enrolled ? "ENROLLED" : "PENDING"}
              </span>
            </div>
            <div className="mx-4 h-px bg-slate-100 dark:bg-slate-800" />
            <SettingRow
              icon={Fingerprint}
              label={me?.face_enrolled ? "Re-enroll my face" : "Enroll my face"}
              sub="Capture a couple of snapshots for secure gate identity"
              onClick={() => navigate("/face/enrollment")}
            />
          </div>
        </section>
      )}

      {/* Account Settings */}
      <section>
        <h2 className="mb-2.5 flex items-center gap-1.5 text-sm font-bold text-slate-900 dark:text-white">
          <Settings className="h-4 w-4 text-slate-500" /> Account Settings
        </h2>
        <div className="overflow-hidden rounded-[1.25rem] border border-slate-200 bg-white shadow-card dark:border-slate-800 dark:bg-slate-900">
          <SettingRow
            icon={UserIcon}
            label="Edit Profile"
            sub="Update your personal details"
            onClick={() => setEditOpen(true)}
          />
          <Divider />
          <SettingRow
            icon={Lock}
            label="Change Password"
            sub="Send a password reset email"
            onClick={() => setPassResetOpen(true)}
          />
          <Divider />
          <SettingRow
            icon={Bell}
            label="Notifications"
            sub="Manage notification preferences"
            onClick={() => navigate("/notifications")}
          />
          <Divider />
          <SettingRow
            icon={LifeBuoy}
            label="Help & Support"
            sub="Contact the hostel office"
            onClick={() => navigate("/contact")}
          />
          <Divider />
          <SettingRow
            icon={LogOut}
            label="Logout"
            sub="Sign out of the portal"
            danger
            onClick={() => setLogoutOpen(true)}
          />
        </div>
      </section>

      {/* Edit Profile sheet */}
      {editOpen && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-slate-900/50 backdrop-blur-sm sm:items-center p-4 pb-safe">
          <div className="w-full max-w-sm rounded-[1.25rem] border border-slate-200 bg-white p-5 shadow-card-hover dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-start justify-between">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Edit Profile</h3>
              <button onClick={() => setEditOpen(false)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-3 rounded-xl bg-slate-50 p-4 text-xs leading-relaxed text-slate-600 dark:bg-slate-800/60 dark:text-slate-300">
              <p className="flex items-center gap-1.5 font-bold text-slate-800 dark:text-slate-200">
                <HelpCircle className="h-4 w-4 text-indigo-600" /> How to update your details
              </p>
              <p className="mt-2">
                Name, branch, mobile and guardian details are verified records maintained by the Hostel Office.
                Please visit the warden's office with your student ID to update them, or raise a request using
                the maintenance portal.
              </p>
              <button
                onClick={() => {
                  setEditOpen(false);
                  navigate("/maintenance?category=housekeeping");
                }}
                className="mt-3 w-full rounded-xl bg-indigo-600 py-2.5 text-xs font-bold text-white hover:bg-indigo-700"
              >
                Raise Update Request
              </button>
            </div>
            <p className="mt-3 text-center text-[11px] text-slate-400">
              <Cake className="mr-1 inline h-3 w-3" /> Registered since 2026 · RGMCET
            </p>
          </div>
        </div>
      )}

      {/* Password reset confirm */}
      <ConfirmDialog
        open={passResetOpen}
        destructive={false}
        title="Reset your password"
        description="A password reset email will be sent to your registered email address. Follow the link in the email to set a new password."
        confirmLabel="Send Reset Email"
        onConfirm={async () => {
          const res = await sendPasswordReset(user?.email || "");
          setPassResetOpen(false);
          if (res.ok) {
            setResetSent(true);
            setTimeout(() => setResetSent(false), 4000);
          }
        }}
        onCancel={() => setPassResetOpen(false)}
      />

      {/* Logout confirm */}
      <ConfirmDialog
        open={logoutOpen}
        title="Sign out?"
        description="You will be signed out of the RGM Hostel Portal. Any pending requests remain saved."
        confirmLabel="Logout"
        onConfirm={async () => {
          await logout();
          navigate("/login");
        }}
        onCancel={() => setLogoutOpen(false)}
      />

      {/* Reset email success toast */}
      {resetSent && (
        <div className="fixed inset-x-4 bottom-20 z-50 flex items-center gap-2 rounded-2xl border border-emerald-200 bg-white px-4 py-3 shadow-card-hover dark:border-emerald-800 dark:bg-slate-900">
          <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
          <p className="text-xs font-semibold text-emerald-800 dark:text-emerald-300">
            Password reset email sent. Please check your inbox.
          </p>
        </div>
      )}
    </div>
  );
}

const Row: React.FC<{ icon: any; label: string; value?: string; mono?: boolean; load?: boolean }> = ({
  icon: Icon,
  label,
  value,
  mono,
  load,
}) => (
  <div className="flex items-center gap-3 px-4 py-3">
    {load ? (
      <Icon className="h-4.5 w-4.5 shrink-0 text-slate-400" />
    ) : (
      <div className="skeleton h-4 w-4 shrink-0 rounded-full" />
    )}
    <span className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</span>
    <span className={`ml-auto truncate text-xs font-bold text-slate-900 dark:text-white ${mono ? "font-mono" : ""}`}>
      {value || "—"}
    </span>
  </div>
);

const SettingRow: React.FC<{ icon: any; label: string; sub?: string; onClick?: () => void; danger?: boolean }> = ({
  icon: Icon,
  label,
  sub,
  onClick,
  danger,
}) => (
  <button onClick={onClick} className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50">
    <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${danger ? "bg-red-50 dark:bg-red-950/50" : "bg-slate-100 dark:bg-slate-800"}`}>
      <Icon className={`h-4 w-4 ${danger ? "text-red-600 dark:text-red-400" : "text-slate-500 dark:text-slate-400"}`} />
    </span>
    <span className="min-w-0 flex-1">
      <span className={`block text-sm font-bold ${danger ? "text-red-600 dark:text-red-400" : "text-slate-900 dark:text-white"}`}>{label}</span>
      {sub && <span className="block truncate text-[11px] font-medium text-slate-400">{sub}</span>}
    </span>
    <ChevronRight className="h-4 w-4 shrink-0 text-slate-300" />
  </button>
);

const Divider: React.FC = () => <div className="mx-4 h-px bg-slate-100 dark:bg-slate-800" />;