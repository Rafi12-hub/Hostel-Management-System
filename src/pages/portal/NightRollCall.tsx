import React, { useState, useEffect, useMemo } from "react";
import { useLocation } from "react-router-dom";
import {
  Moon,
  Users,
  UserCheck,
  Clock,
  AlertTriangle,
  Search,
  Plus,
  X,
  Radio,
  History,
  Settings as SettingsIcon,
  MapPin,
  CheckCircle2,
  Save,
  ScanFace,
  ShieldCheck,
} from "lucide-react";
import {
  subscribeCollection,
  createRecord,
  updateRecord,
} from "@/lib/firestore";
import { useDemoAuth } from "@/context/DemoAuthContext";
import { notifyParent } from "@/lib/parentNotifier";
import { KpiCard } from "@/components/ui/KpiCard";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { FrsEnrollModal } from "@/components/faceRecognition/FrsEnrollModal";
import { NightRollCallStudent } from "@/components/nightRollCall/NightRollCallStudent";
import {
  classifyStudents,
  ensureNrcConfig,
  saveNrcConfig,
  generateNrcToken,
  todayStr,
  windowState,
  type NightRollCallConfig,
  type RollCallStatus,
} from "@/lib/nightRollCall";

const STATUS_TONES: Record<string, string> = {
  PRESENT: "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800",
  LATE: "bg-orange-100 text-orange-800 border-orange-300 dark:bg-orange-950/60 dark:text-orange-300 dark:border-orange-800",
  OUTSIDE: "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800",
  ON_LEAVE: "bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800",
  PENDING: "bg-red-100 text-red-800 border-red-300 dark:bg-red-950/60 dark:text-red-300 dark:border-red-800",
  UNKNOWN: "bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-800",
};

export default function NightRollCall() {
  const { user } = useDemoAuth();
  const location = useLocation();
  const [tab, setTab] = useState<"overview" | "monitor" | "missing" | "checkpoints" | "history" | "settings" | "frs">(() =>
    new URLSearchParams(location.search).get("tab") === "frs" ? "frs" : "overview"
  );

  const [students, setStudents] = useState<any[]>([]);
  const [gatePasses, setGatePasses] = useState<any[]>([]);
  const [leaves, setLeaves] = useState<any[]>([]);
  const [records, setRecords] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [checkpoints, setCheckpoints] = useState<any[]>([]);
  const [config, setConfig] = useState<NightRollCallConfig | null>(null);

  const [hostelFilter, setHostelFilter] = useState("APJ Abdul Kalam Boys Hostel (BH-1)");
  const [blockFilter, setBlockFilter] = useState("all");
  const [floorFilter, setFloorFilter] = useState("all");
  const [search, setSearch] = useState("");

  const [cpModal, setCpModal] = useState(false);
  const [cpForm, setCpForm] = useState({ locationName: "", blockId: "Block A", floorId: "1", active: true });

  const [rev, setRev] = useState(0);

  const [frsStudent, setFrsStudent] = useState<any>(null);

  useEffect(() => {
    const unsubs = [
      subscribeCollection("Student", (d: any) => setStudents(d)),
      subscribeCollection("GatePass", (d: any) => setGatePasses(d)),
      subscribeCollection("Leave", (d: any) => setLeaves(d)),
      subscribeCollection("NightRollCallRecords", (d: any) => setRecords(d)),
      subscribeCollection("NightRollCallSessions", (d: any) => setSessions(d)),
      subscribeCollection("NightRollCallCheckpoints", (d: any) => setCheckpoints(d)),
    ];
    return () => unsubs.forEach((u) => u());
  }, []);

  useEffect(() => {
    ensureNrcConfig().then(setConfig);
  }, []);

  // Live clock for window state
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const i = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(i);
  }, []);

  const today = todayStr();
  const state = config ? windowState(config, now) : "NOT_OPENED";

  // classifyStudents returns a Promise — resolve it into a lookup map.
  const [autoStatus, setAutoStatus] = useState<Record<string, { status: RollCallStatus; reason?: string }>>({});
  useEffect(() => {
    let mounted = true;
    classifyStudents(students, gatePasses, leaves).then((res) => {
      if (!mounted) return;
      const map: Record<string, { status: RollCallStatus; reason?: string }> = {};
      res.forEach((c) => {
        map[String(c.student.student_id).trim().toUpperCase()] = { status: c.nrcStatus, reason: c.reason };
      });
      setAutoStatus(map);
    });
    return () => {
      mounted = false;
    };
  }, [students, gatePasses, leaves, rev]);

  // Build a unified resident status table: student + auto status + (maybe) record
  const statusRows = useMemo(() => {
    // Only consider roll-call records for TODAY's session(s) so completed
    // check-ins from previous nights never count as this evening's status.
    const todaySessionIds = new Set(
      sessions.filter((sn) => String(sn.date) === today).map((sn) => sn.id)
    );
    const todaysRecords = todaySessionIds.size
      ? records.filter((r) => todaySessionIds.has(r.sessionId))
      : records.filter((r) => r.completedAt && new Date(r.completedAt).toISOString().split("T")[0] === today);

    return students.map((s) => {
      const sid = String(s.student_id).trim().toUpperCase();
      const record = todaysRecords.find((r) => String(r.studentId).trim().toUpperCase() === sid && r.status !== "OUTSIDE" && r.status !== "ON_LEAVE");
      const auto = autoStatus[sid];
      let status: RollCallStatus = auto?.status || "PENDING";
      let reason = auto?.reason;
      if (record) {
        status = record.status as RollCallStatus;
        reason = record.lateReason || reason;
      } else if (!s.hostel) {
        status = "UNKNOWN";
      }
      return { student: s, autoStatus: auto?.status, record, status, reason };
    });
  }, [students, records, autoStatus, sessions, today]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { Total: students.length, PRESENT: 0, LATE: 0, OUTSIDE: 0, ON_LEAVE: 0, PENDING: 0, UNKNOWN: 0 };
    statusRows.forEach((r) => {
      c[r.status] = (c[r.status] || 0) + 1;
    });
    return c;
  }, [statusRows, students.length]);

  const completionPct = statusRows.length
    ? Math.round(((counts.PRESENT + counts.LATE) / statusRows.length) * 100)
    : 0;

  // FRS enrollment stats (warden registers faces here on first use)
  const frsStats = useMemo(() => {
    const enrolled = students.filter((s) => s.face_enrolled || (s.faceDescriptor && s.faceDescriptor.encoding));
    return { enrolled: enrolled.length, missing: Math.max(0, students.length - enrolled.length) };
  }, [students]);

  // Live activity feed (most recent completed records)
  const activity = useMemo(() => {
    return [...records]
      .filter((r) => r.completedAt && (r.status === "PRESENT" || r.status === "LATE"))
      .sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime())
      .slice(0, 8);
  }, [records]);

  // Missing list: PENDING + UNKNOWN
  const missing = statusRows.filter((r) => r.status === "PENDING" || r.status === "UNKNOWN");

  const filteredStatusRows = statusRows.filter((r) => {
    const s = r.student;
    const matchesHostel = s.hostel === hostelFilter;
    const matchesBlock = blockFilter === "all" || s.block === blockFilter;
    const matchesFloor = floorFilter === "all" || String(s.floor) === floorFilter;
    const matchesSearch = (s.name || "").toLowerCase().includes(search.toLowerCase()) || String(s.student_id || "").toLowerCase().includes(search.toLowerCase());
    return matchesHostel && matchesBlock && matchesFloor && matchesSearch;
  });

  const activeHostels = useMemo(() => Array.from(new Set(students.map((s) => s.hostel).filter(Boolean))), [students]);
  const activeBlocks = useMemo(() => Array.from(new Set(students.filter((s) => s.hostel === hostelFilter).map((s) => s.block).filter(Boolean))), [students, hostelFilter]);
  const activeFloors = useMemo(() => Array.from(new Set(students.filter((s) => s.hostel === hostelFilter).map((s) => String(s.floor)).filter(Boolean))).sort(), [students, hostelFilter]);

  const handleAddCheckpoint = async (e: React.FormEvent) => {
    e.preventDefault();
    const ttl = config?.tokenTtlMinutes || 5;
    const theToken = generateNrcToken("CHECKPOINT", {
      tokenTtlMinutes: ttl, startTime: "21:30", endTime: "22:00", graceEndTime: "22:15", wifiSsid: "RGMCET-HOSTEL-WIFI", requireSelfie: false, requireWifi: false, enabled: true,
    });
    await createRecord("NightRollCallCheckpoints", {
      hostelId: "h_" + (hostelFilter.includes("GH") ? "3" : hostelFilter.includes("BH-2") ? "2" : "1"),
      hostel: hostelFilter,
      blockId: cpForm.blockId,
      block: cpForm.blockId,
      floorId: cpForm.floorId,
      floor: cpForm.floorId,
      locationName: cpForm.locationName,
      qrToken: theToken.token,
      tokenExpiry: new Date(Date.now() + ttl * 60000).toISOString(),
      active: cpForm.active,
      createdAt: new Date().toISOString(),
    });
    setCpModal(false);
    setCpForm({ locationName: "", blockId: "Block A", floorId: "1", active: true });
    setRev((r) => r + 1);
  };

  const toggleCheckpoint = async (id: string, active: boolean) => {
    await updateRecord("NightRollCallCheckpoints", id, { active });
    setRev((r) => r + 1);
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!config) return;
    await saveNrcConfig(config);
    setRev((r) => r + 1);
  };

  // Manual mark present (warden override for PENDING students)
  const handleManualMark = async (sid: string) => {
    const rs = sessions.find((s) => s.hostel === hostelFilter && s.date === today);
    const fallbackSessionId = rs ? rs.id : today + hostelFilter;
    const session = rs || { id: fallbackSessionId };
    await createRecord("NightRollCallRecords", {
      sessionId: session.id,
      studentId: sid,
      completedAt: new Date().toISOString(),
      status: "PRESENT",
      verificationMethod: "MANUAL",
      lateReason: "",
      createdAt: new Date().toISOString(),
    });
    await createRecord("ActivityLog", {
      user: user?.name || "Warden",
      role: "warden",
      action: `Manually marked ${sid} PRESENT for Night Roll Call`,
      module: "NightRollCall",
      record: sid,
      timestamp: new Date().toISOString(),
    });
    setRev((r) => r + 1);
  };

  const notifyMissings = async () => {
    for (const { student: s } of missing) {
      await notifyParent({
        student_id: s.student_id,
        student_name: s.name,
        hostel: s.hostel,
        room: s.room,
        event: "Night Roll Call Missing",
        message: `RGMCET Hostel: ${s.name} has NOT completed tonight's Night Roll Call and is unaccounted for. Please contact the warden urgently.`,
        channel: "sms",
        priority: "high",
      });
    }
    await createRecord("ActivityLog", {
      user: user?.name || "Warden",
      role: "warden",
      action: `Dispatched missing Night Roll Call alerts for ${missing.length} student(s)`,
      module: "NightRollCall",
      record: today,
      timestamp: new Date().toISOString(),
    });
    setRev((r) => r + 1);
  };

  const renderStatusBadge = (status: string) => (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold ${STATUS_TONES[status] || STATUS_TONES.PENDING}`}>
      {status.replace(/_/g, " ")}
    </span>
  );

  // Students: the Night Roll Call module IS their FRS (Face Recognition Service).
  const isStudent = user?.role === "student";

  return isStudent ? (
    <div className="space-y-6">
      <PageHeader
        title="Night Roll Call — FRS"
        subtitle="Your nightly face-recognition check-in. Only YOUR face completes this roll call."
      />
      <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-4 text-xs text-indigo-800 dark:border-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-200">
        <p className="font-bold flex items-center gap-2"><ScanFace className="h-4 w-4" /> FRS is your Night Roll Call.</p>
        <p className="mt-1">
          The Night Roll Call module is powered by Face Recognition Service (FRS). Register your face once at the
          warden&apos;s office for first-time FRS registration, then complete tonight&apos;s roll call by scanning your face.
          The scanner never matches other students, so the roll call can only be completed for yourself.
        </p>
      </div>
      <NightRollCallStudent />
    </div>
  ) : (
    <div className="space-y-6">
      <PageHeader
        title="Night Roll Call Dashboard"
        subtitle="Live digital roll call with dynamic QR verification, automatic status, and missing-student alerts"
        actions={
          <span className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-bold ${
            state === "OPEN" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
            : state === "GRACE" ? "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300"
            : state === "NOT_OPENED" ? "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
            : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
          }`}>
            <Radio className={`h-4 w-4 ${state === "OPEN" ? "animate-pulse" : ""}`} />
            {state === "OPEN" ? "Roll Call Open" : state === "GRACE" ? "Grace Period" : state === "NOT_OPENED" ? "Not Opened" : "Closed"}
          </span>
        }
      />

      {/* Tabs */}
      <div className="flex flex-wrap gap-2">
        {([
          ["overview", "Overview", Users],
          ["monitor", "Live Monitor", Radio],
          ["missing", "Missing List", AlertTriangle],
          ["checkpoints", "Checkpoints", MapPin],
          ["frs", "FRS Registration", ScanFace],
          ["history", "History", History],
          ["settings", "Settings", SettingsIcon],
        ] as const).map(([key, label, Icon]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-bold transition-colors ${
              tab === key ? "bg-indigo-600 text-white shadow-md" : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-300"
            }`}
          >
            <Icon className="h-4 w-4" /> {label}
            {key === "missing" && missing.length > 0 && (
              <span className="rounded-full bg-red-600 px-1.5 text-[10px] text-white">{missing.length}</span>
            )}
            {key === "frs" && frsStats.missing > 0 && (
              <span className="rounded-full bg-amber-500 px-1.5 text-[10px] text-white">{frsStats.missing}</span>
            )}
          </button>
        ))}
      </div>

      {/* ------------------ OVERVIEW TAB ------------------ */}
      {tab === "overview" && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-7">
            <KpiCard label="Total Residents" value={counts.Total || students.length} icon={Users} tone="indigo" />
            <KpiCard label="Completed" value={counts.PRESENT} icon={UserCheck} tone="green" sub={`${completionPct}%`} />
            <KpiCard label="Outside" value={counts.OUTSIDE} icon={Users} tone="amber" />
            <KpiCard label="On Leave" value={counts.ON_LEAVE} icon={UserCheck} tone="blue" />
            <KpiCard label="Late" value={counts.LATE} icon={Clock} tone="amber" />
            <KpiCard label="Pending" value={counts.PENDING} icon={AlertTriangle} tone="red" />
            <KpiCard label="Unknown" value={counts.UNKNOWN} icon={Moon} tone="purple" />
          </div>

          {/* Progress bar */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-md dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">Roll Call Completion</h3>
              <span className="text-xl font-black text-indigo-600 dark:text-indigo-400">{completionPct}%</span>
            </div>
            <div className="h-3 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
              <div
                className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-emerald-500 transition-all duration-700"
                style={{ width: `${completionPct}%` }}
              />
            </div>
            <p className="mt-2 text-[11px] text-slate-400">
              {(counts.PRESENT + counts.LATE)} of {counts.Total} residents verified ({counts.OUTSIDE} outside, {counts.ON_LEAVE} on leave).
            </p>
          </div>

          {/* Live feed */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-md dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 dark:border-slate-800">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
                </span>
                Live Roll Call Activity
              </h3>
              <span className="text-[11px] text-slate-400">{today}</span>
            </div>
            <div className="mt-4 space-y-2.5">
              {activity.length === 0 ? (
                <p className="py-6 text-center text-xs text-slate-400">Waiting for students to check in…</p>
              ) : (
                activity.map((r) => {
                  const st = students.find((s) => String(s.student_id).trim().toUpperCase() === String(r.studentId).trim().toUpperCase());
                  return (
                    <div key={r.id} className="flex items-center justify-between rounded-xl bg-slate-50 p-3 text-xs dark:bg-slate-800/60">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-100 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-300">
                          <CheckCircle2 className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="font-bold text-slate-900 dark:text-white">
                            {st?.name || r.studentId} completed Night Roll Call.
                          </p>
                          <p className="text-[11px] text-slate-500">
                            Room {st?.room || "—"} · {r.verificationMethod.replace(/_/g, " ")}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-[11px] font-mono text-slate-400">
                          {r.completedAt ? new Date(r.completedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—"}
                        </span>
                        {renderStatusBadge(r.status)}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* ------------------ LIVE MONITOR TAB ------------------ */}
      {tab === "monitor" && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search by name or student ID..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-4 py-2 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <select value={hostelFilter} onChange={(e) => { setHostelFilter(e.target.value); setBlockFilter("all"); setFloorFilter("all"); }} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white">
                {activeHostels.map((h) => <option key={h} value={h}>{h}</option>)}
              </select>
              <select value={blockFilter} onChange={(e) => setBlockFilter(e.target.value)} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white">
                <option value="all">All Blocks</option>
                {activeBlocks.map((b) => <option key={b} value={b}>{b}</option>)}
              </select>
              <select value={floorFilter} onChange={(e) => setFloorFilter(e.target.value)} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white">
                <option value="all">All Floors</option>
                {activeFloors.map((f) => <option key={f} value={f}>Floor {f}</option>)}
              </select>
            </div>
          </div>

          {/* Status grid */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredStatusRows.map(({ student: s, status, reason }) => (
              <div key={s.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <img src={s.photo_url} alt={s.name} className="h-9 w-9 rounded-full object-cover" />
                    <div>
                      <p className="text-xs font-bold text-slate-900 dark:text-white">{s.name}</p>
                      <p className="text-[10px] font-mono text-indigo-600 dark:text-indigo-400">{s.student_id}</p>
                    </div>
                  </div>
                  {renderStatusBadge(status)}
                </div>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-x-2 gap-y-1 text-[11px] text-slate-500">
                  <span>{s.hostel?.split(" ")[0]} · {s.block} Flr {s.floor} · Room {s.room}</span>
                  <span className="font-mono">{s.mobile || "—"}</span>
                </div>
                {reason && <p className="mt-2 rounded-lg bg-slate-50 px-2.5 py-1.5 text-[10px] text-slate-500 dark:bg-slate-800/60 line-clamp-2">{reason}</p>}
                {status === "PENDING" && (
                  <button
                    onClick={() => handleManualMark(s.student_id)}
                    className="mt-2 w-full rounded-lg bg-indigo-600 py-2.5 text-[11px] font-bold text-white hover:bg-indigo-700"
                  >
                    Mark Present (Manual)
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ------------------ MISSING LIST TAB ------------------ */}
      {tab === "missing" && (
        <div className="space-y-4">
          {missing.length === 0 ? (
            <EmptyState title="No missing students" description="Everyone has completed their Night Roll Call. Great job!" icon={CheckCircle2} />
          ) : (
            <>
              <div className="rounded-xl bg-red-50 border border-red-200 p-4 text-xs font-bold text-red-800 flex flex-wrap items-center justify-between gap-2 dark:bg-red-950/40 dark:text-red-300">
                <span className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 shrink-0" /> Warning: {missing.length} student(s) have not completed Night Roll Call.</span>
                <button onClick={notifyMissings} className="shrink-0 rounded-lg bg-red-600 px-3 py-2.5 min-h-11 text-[11px] font-bold text-white hover:bg-red-700">
                  Notify Parents & Warden
                </button>
              </div>

              {/* Mobile cards */}
              <div className="space-y-3 md:hidden">
                {missing.map(({ student: s, status, reason }) => (
                  <div key={s.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-2.5">
                        <img src={s.photo_url} alt={s.name} className="h-10 w-10 shrink-0 rounded-full object-cover" />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold text-slate-900 dark:text-white">{s.name}</p>
                          <p className="font-mono text-[11px] text-indigo-600 dark:text-indigo-400">{s.student_id}</p>
                        </div>
                      </div>
                      {renderStatusBadge(status)}
                    </div>
                    <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
                      <span>{s.block} · F{s.floor} · Room {s.room}</span>
                      <span className="font-mono">{s.mobile}</span>
                    </div>
                    <p className="mt-1.5 text-[11px] text-slate-400 line-clamp-2">{reason || "No gate pass / leave on record"}</p>
                    <button onClick={() => handleManualMark(s.student_id)} className="mt-3 w-full rounded-lg bg-indigo-600 py-2.5 text-[11px] font-bold text-white hover:bg-indigo-700">
                      Mark Present
                    </button>
                  </div>
                ))}
              </div>

              <div className="hidden overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-md dark:border-slate-800 dark:bg-slate-900 md:block">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-700 uppercase font-bold dark:bg-slate-800 dark:text-slate-300">
                      <tr>
                        <th className="px-4 py-3">Student</th>
                        <th className="px-4 py-3">Hostel / Block / Floor / Room</th>
                        <th className="px-4 py-3">Mobile</th>
                        <th className="px-4 py-3">Last Status</th>
                        <th className="px-4 py-3">Entry / Exit</th>
                        <th className="px-4 py-3">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {missing.map(({ student: s, status, reason }) => (
                        <tr key={s.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50">
                          <td className="px-4 py-3.5">
                            <div className="flex items-center gap-2.5">
                              <img src={s.photo_url} alt={s.name} className="h-8 w-8 rounded-full object-cover" />
                              <div>
                                <p className="font-bold text-slate-900 dark:text-white">{s.name}</p>
                                <p className="text-[10px] font-mono text-indigo-600 dark:text-indigo-400">{s.student_id}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3.5 text-slate-700 dark:text-slate-300">
                            {s.block} / F{s.floor} / Room {s.room}
                          </td>
                          <td className="px-4 py-3.5 font-mono text-slate-600 dark:text-slate-400">{s.mobile}</td>
                          <td className="px-4 py-3.5">{renderStatusBadge(status)}</td>
                          <td className="px-4 py-3.5 text-[10px] text-slate-400">{reason || "No gate pass / leave on record"}</td>
                          <td className="px-4 py-3.5">
                            <button onClick={() => handleManualMark(s.student_id)} className="rounded-lg bg-indigo-600 px-3 py-2.5 text-[11px] font-bold text-white hover:bg-indigo-700">
                              Mark Present
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ------------------ CHECKPOINTS TAB ------------------ */}
      {tab === "checkpoints" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Roll Call QR Checkpoints</h3>
            <button onClick={() => setCpModal(true)} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-indigo-700">
              <Plus className="h-4 w-4" /> Add Checkpoint
            </button>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {checkpoints.map((cp) => (
              <div key={cp.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-5 w-5 text-indigo-600" />
                    <div>
                      <p className="text-sm font-bold text-slate-900 dark:text-white">{cp.locationName}</p>
                      <p className="text-[10px] text-slate-500">{cp.hostel} · {cp.block} · Floor {cp.floor}</p>
                    </div>
                  </div>
                  <span className={`flex h-2.5 w-2.5 rounded-full ${cp.active ? "bg-emerald-500" : "bg-slate-300"}`} />
                </div>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
                  <span className="font-mono text-xs font-bold text-indigo-600 dark:text-indigo-400">{cp.qrToken}</span>
                  <label className="flex items-center gap-2 text-[10px] font-semibold text-slate-500">
                    Active
                    <input type="checkbox" checked={cp.active} onChange={(e) => toggleCheckpoint(cp.id, e.target.checked)} className="h-4 w-4" />
                  </label>
                </div>
                <p className="mt-1 text-[10px] text-slate-400">Token rotates at {cp.tokenExpiry ? new Date(cp.tokenExpiry).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—"}</p>
              </div>
            ))}
            {checkpoints.length === 0 && <EmptyState title="No checkpoints" description="Add a QR checkpoint location." icon={MapPin} className="col-span-full" />}
          </div>
        </div>
      )}

      {/* ------------------ FRS REGISTRATION TAB ------------------ */}
      {tab === "frs" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <KpiCard label="FRS Enrolled" value={frsStats.enrolled} icon={ShieldCheck} tone="green" sub="Can check in by face" />
            <KpiCard label="Pending First-time Registration" value={frsStats.missing} icon={ScanFace} tone={frsStats.missing > 0 ? "amber" : "green"} sub="Visit warden office" />
            <KpiCard label="Total Residents" value={students.length} icon={Users} tone="indigo" />
          </div>

          <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-4 text-xs text-indigo-800 dark:border-indigo-900 dark:bg-indigo-950/40 dark:text-indigo-200">
            <p className="font-bold flex items-center gap-2"><ScanFace className="h-4 w-4" /> FRS = the Night Roll Call biometric</p>
            <p className="mt-1">
              Face Recognition Service (FRS) is now the primary Night Roll Call verification. Register each resident&apos;s face here the first time
              — after that they can check in instantly by scanning their face from the student portal. Select a student below and capture their face.
            </p>
          </div>

          {frsStats.missing === 0 && frsStats.enrolled > 0 ? (
            <EmptyState title="All residents enrolled" description="Every student has a registered FRS face. Night Roll Call can run fully on face recognition." icon={ShieldCheck} />
          ) : (
            <>
              {/* Mobile cards */}
              <div className="space-y-3 md:hidden">
                {filteredStatusRows.map(({ student: s }) => {
                  const enrolled = s.face_enrolled || (s.faceDescriptor && s.faceDescriptor.encoding && s.faceDescriptor.encoding.length > 0);
                  return (
                    <div key={s.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex min-w-0 items-center gap-2.5">
                          <img src={s.photo_url} alt={s.name} className="h-10 w-10 shrink-0 rounded-full object-cover" />
                          <div className="min-w-0">
                            <p className="truncate text-sm font-bold text-slate-900 dark:text-white">{s.name}</p>
                            <p className="font-mono text-[11px] text-indigo-600 dark:text-indigo-400">{s.student_id}</p>
                          </div>
                        </div>
                        <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold ${
                          enrolled
                            ? "border-emerald-300 bg-emerald-100 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                            : "border-amber-300 bg-amber-100 text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300"
                        }`}>
                          {enrolled ? <><ShieldCheck className="h-3 w-3" /> Enrolled</> : "Not enrolled"}
                        </span>
                      </div>
                      <p className="mt-2 text-[11px] text-slate-500">{s.hostel?.split(" ")[0]} · {s.block} Flr {s.floor} · Room {s.room}</p>
                      <button
                        onClick={() => setFrsStudent(s)}
                        className={`mt-3 w-full rounded-lg py-2.5 text-[11px] font-bold text-white ${
                          enrolled ? "bg-slate-600 hover:bg-slate-700" : "bg-indigo-600 hover:bg-indigo-700"
                        }`}
                      >
                        <ScanFace className="mr-1 h-3.5 w-3.5 inline" /> {enrolled ? "Re-enroll" : "Register FRS"}
                      </button>
                    </div>
                  );
                })}
              </div>

              <div className="hidden overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-md dark:border-slate-800 dark:bg-slate-900 md:block">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-700 uppercase font-bold dark:bg-slate-800 dark:text-slate-300">
                      <tr>
                        <th className="px-4 py-3">Student</th>
                        <th className="px-4 py-3">Hostel / Room</th>
                        <th className="px-4 py-3">FRS Status</th>
                        <th className="px-4 py-3">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {filteredStatusRows.map(({ student: s }) => {
                        const enrolled = s.face_enrolled || (s.faceDescriptor && s.faceDescriptor.encoding && s.faceDescriptor.encoding.length > 0);
                        return (
                          <tr key={s.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50">
                            <td className="px-4 py-3.5">
                              <div className="flex items-center gap-2.5">
                                <img src={s.photo_url} alt={s.name} className="h-8 w-8 rounded-full object-cover" />
                                <div>
                                  <p className="font-bold text-slate-900 dark:text-white">{s.name}</p>
                                  <p className="text-[10px] font-mono text-indigo-600 dark:text-indigo-400">{s.student_id}</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3.5 text-slate-600 dark:text-slate-300">
                              {s.hostel?.split(" ")[0]} · {s.block} Flr {s.floor} · Room {s.room}
                            </td>
                            <td className="px-4 py-3.5">
                              <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold ${
                                enrolled
                                  ? "border-emerald-300 bg-emerald-100 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                                  : "border-amber-300 bg-amber-100 text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300"
                              }`}>
                                {enrolled ? <><ShieldCheck className="h-3 w-3" /> Enrolled</> : "Not enrolled"}
                              </span>
                            </td>
                            <td className="px-4 py-3.5">
                              <button
                                onClick={() => setFrsStudent(s)}
                                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2.5 text-[11px] font-bold text-white ${
                                  enrolled ? "bg-slate-600 hover:bg-slate-700" : "bg-indigo-600 hover:bg-indigo-700"
                                }`}
                              >
                                <ScanFace className="h-3.5 w-3.5" /> {enrolled ? "Re-enroll" : "Register FRS"}
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ------------------ HISTORY TAB ------------------ */}
      {tab === "history" && (
        <>
          {/* Mobile cards */}
          <div className="space-y-3 md:hidden">
            {[...records]
              .sort((a, b) => new Date(b.completedAt || 0).getTime() - new Date(a.completedAt || 0).getTime())
              .slice(0, 50)
              .map((r) => {
                const st = students.find((s) => String(s.student_id).trim().toUpperCase() === String(r.studentId).trim().toUpperCase());
                return (
                  <div key={r.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-slate-900 dark:text-white">{st?.name || r.studentId}</p>
                        <p className="font-mono text-[11px] text-indigo-600 dark:text-indigo-400">{r.studentId}</p>
                      </div>
                      {renderStatusBadge(r.status)}
                    </div>
                    <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
                      <span>{r.hostel?.split(" ")[0] || st?.hostel?.split(" ")[0] || "—"} · Room {st?.room || "—"}</span>
                      <span className="font-mono">{r.completedAt ? new Date(r.completedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—"}</span>
                    </div>
                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-[10px] text-slate-400">{r.completedAt ? new Date(r.completedAt).toLocaleDateString() : "—"}</span>
                      <span className="text-[10px] font-bold uppercase text-slate-500">{r.verificationMethod?.replace(/_/g, " ")}</span>
                    </div>
                  </div>
                );
              })}
          </div>

          <div className="hidden overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-md dark:border-slate-800 dark:bg-slate-900 md:block">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-700 uppercase font-bold dark:bg-slate-800 dark:text-slate-300">
                <tr>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Student</th>
                  <th className="px-4 py-3">Hostel</th>
                  <th className="px-4 py-3">Room</th>
                  <th className="px-4 py-3">Completion Time</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Verification Method</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {[...records]
                  .sort((a, b) => new Date(b.completedAt || 0).getTime() - new Date(a.completedAt || 0).getTime())
                  .slice(0, 50)
                  .map((r) => {
                    const st = students.find((s) => String(s.student_id).trim().toUpperCase() === String(r.studentId).trim().toUpperCase());
                    return (
                      <tr key={r.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50">
                        <td className="px-4 py-3.5 text-slate-500">{r.completedAt ? new Date(r.completedAt).toLocaleDateString() : r.createdAt ? new Date(r.createdAt).toLocaleDateString() : "—"}</td>
                        <td className="px-4 py-3.5 font-bold text-slate-900 dark:text-white">{st?.name || r.studentId}<span className="block text-[10px] font-mono text-indigo-600">{r.studentId}</span></td>
                        <td className="px-4 py-3.5 text-slate-600 dark:text-slate-300">{r.hostel?.split(" ")[0] || st?.hostel?.split(" ")[0] || "—"}</td>
                        <td className="px-4 py-3.5 text-slate-600 dark:text-slate-300">{st?.room || "—"}</td>
                        <td className="px-4 py-3.5 font-mono text-slate-700 dark:text-slate-200">{r.completedAt ? new Date(r.completedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—"}</td>
                        <td className="px-4 py-3.5">{renderStatusBadge(r.status)}</td>
                        <td className="px-4 py-3.5 uppercase text-[10px] font-bold text-slate-500">{r.verificationMethod?.replace(/_/g, " ")}</td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      </>
      )}

      {/* ------------------ SETTINGS TAB ------------------ */}
      {tab === "settings" && config && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Config */}
          <form onSubmit={handleSaveConfig} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-md dark:border-slate-800 dark:bg-slate-900 space-y-4">
            <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2"><SettingsIcon className="h-5 w-5 text-indigo-600" /> Roll Call Configuration</h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Start</label>
                <input type="time" value={config.startTime} onChange={(e) => setConfig({ ...config, startTime: e.target.value })} className="w-full rounded-lg border border-slate-200 bg-slate-50 p-2 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Close</label>
                <input type="time" value={config.endTime} onChange={(e) => setConfig({ ...config, endTime: e.target.value })} className="w-full rounded-lg border border-slate-200 bg-slate-50 p-2 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Grace End</label>
                <input type="time" value={config.graceEndTime} onChange={(e) => setConfig({ ...config, graceEndTime: e.target.value })} className="w-full rounded-lg border border-slate-200 bg-slate-50 p-2 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Token TTL (minutes)</label>
              <input type="number" min={1} max={60} value={config.tokenTtlMinutes} onChange={(e) => setConfig({ ...config, tokenTtlMinutes: Number(e.target.value) })} className="w-full rounded-lg border border-slate-200 bg-slate-50 p-2 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Hostel Wi-Fi SSID (simulated)</label>
              <input type="text" value={config.wifiSsid} onChange={(e) => setConfig({ ...config, wifiSsid: e.target.value })} className="w-full rounded-lg border border-slate-200 bg-slate-50 p-2 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
            </div>
            <div className="flex items-center justify-between rounded-lg bg-slate-50 p-3 dark:bg-slate-800/60">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Require Selfie (optional)</span>
              <input type="checkbox" checked={config.requireSelfie} onChange={(e) => setConfig({ ...config, requireSelfie: e.target.checked })} className="h-4 w-4" />
            </div>
            <div className="flex items-center justify-between rounded-lg bg-slate-50 p-3 dark:bg-slate-800/60">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Require Hostel Network (simulated)</span>
              <input type="checkbox" checked={config.requireWifi} onChange={(e) => setConfig({ ...config, requireWifi: e.target.checked })} className="h-4 w-4" />
            </div>
            <div className="flex items-center justify-between rounded-lg bg-slate-50 p-3 dark:bg-slate-800/60">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Roll Call Enabled</span>
              <input type="checkbox" checked={config.enabled} onChange={(e) => setConfig({ ...config, enabled: e.target.checked })} className="h-4 w-4" />
            </div>
            <button type="submit" className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-xs font-bold text-white hover:bg-indigo-700 min-h-11">
              <Save className="h-4 w-4" /> Save Configuration
            </button>
          </form>

          {/* Late check-in review */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-md dark:border-slate-800 dark:bg-slate-900">
            <h3 className="text-base font-extrabold text-slate-900 dark:text-white mb-4 flex items-center gap-2"><Clock className="h-5 w-5 text-orange-500" /> Late Check-In Review</h3>
            {records.filter((r) => r.status === "LATE").length === 0 ? (
              <EmptyState title="No late check-ins" description="All students checked in on time." icon={CheckCircle2} />
            ) : (
              <div className="space-y-3">
                {records.filter((r) => r.status === "LATE").map((r) => {
                  const st = students.find((s) => String(s.student_id).trim().toUpperCase() === String(r.studentId).trim().toUpperCase());
                  return (
                    <div key={r.id} className="rounded-xl border border-orange-200 bg-orange-50/60 p-3 dark:border-orange-900 dark:bg-orange-950/30">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-bold text-slate-900 dark:text-white">{st?.name || r.studentId}</p>
                        <span className="text-[10px] font-mono text-slate-500">{r.completedAt ? new Date(r.completedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—"}</span>
                      </div>
                      <p className="mt-1 text-[11px] text-slate-600 dark:text-slate-300">Reason: {r.lateReason || "Not provided"}</p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Add checkpoint modal */}
      {cpModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/60 backdrop-blur-sm p-4 pb-safe sm:items-center">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Add QR Checkpoint</h3>
              <button onClick={() => setCpModal(false)} className="text-slate-400"><X className="h-5 w-5" /></button>
            </div>
            <form onSubmit={handleAddCheckpoint} className="mt-4 space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Hostel</label>
                <input readOnly value={hostelFilter} className="w-full rounded-lg border border-slate-200 bg-slate-100 p-2.5 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400" />
              </div>
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Location Name</label>
                <input required type="text" value={cpForm.locationName} onChange={(e) => setCpForm({ ...cpForm, locationName: e.target.value })} placeholder="e.g. Hostel Entrance, Study Hall" className="w-full rounded-lg border border-slate-200 bg-slate-50 p-2.5 dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Block</label>
                  <select value={cpForm.blockId} onChange={(e) => setCpForm({ ...cpForm, blockId: e.target.value })} className="w-full rounded-lg border border-slate-200 bg-slate-50 p-2.5 dark:border-slate-700 dark:bg-slate-800 dark:text-white">
                    <option>Block A</option>
                    <option>Block B</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Floor</label>
                  <select value={cpForm.floorId} onChange={(e) => setCpForm({ ...cpForm, floorId: e.target.value })} className="w-full rounded-lg border border-slate-200 bg-slate-50 p-2.5 dark:border-slate-700 dark:bg-slate-800 dark:text-white">
                    <option value="0">Ground</option>
                    <option value="1">1</option>
                    <option value="2">2</option>
                    <option value="3">3</option>
                  </select>
                </div>
              </div>
              <button type="submit" className="w-full rounded-xl bg-indigo-600 py-3 text-xs font-bold text-white hover:bg-indigo-700">Create Checkpoint</button>
            </form>
          </div>
        </div>
      )}
    {/* FRS first-time registration modal */}
      {frsStudent && (
        <FrsEnrollModal
          student={frsStudent}
          actor={user?.name || "Warden"}
          onClose={() => setFrsStudent(null)}
          onSaved={() => setRev((r) => r + 1)}
        />
      )}
    </div>
  );
}
