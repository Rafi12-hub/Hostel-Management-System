import React, { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { Moon, UserCheck, Users, AlertTriangle, Radio, ScanFace } from "lucide-react";
import { subscribeCollection } from "@/lib/firestore";
import { classifyStudents } from "@/lib/nightRollCall";

export const NightRollCallWardenOverview: React.FC = () => {
  const [students, setStudents] = useState<any[]>([]);
  const [gatePasses, setGatePasses] = useState<any[]>([]);
  const [leaves, setLeaves] = useState<any[]>([]);
  const [records, setRecords] = useState<any[]>([]);

  useEffect(() => {
    const unsubs = [
      subscribeCollection("Student", (d: any) => setStudents(d)),
      subscribeCollection("GatePass", (d: any) => setGatePasses(d)),
      subscribeCollection("Leave", (d: any) => setLeaves(d)),
      subscribeCollection("NightRollCallRecords", (d: any) => setRecords(d)),
    ];
    return () => unsubs.forEach((u) => u());
  }, []);

  const [autoStatus, setAutoStatus] = useState<Record<string, string>>({});
  useEffect(() => {
    let mounted = true;
    classifyStudents(students, gatePasses, leaves).then((res) => {
      if (!mounted) return;
      const map: Record<string, string> = {};
      res.forEach((c) => (map[String(c.student.student_id).trim().toUpperCase()] = c.nrcStatus));
      setAutoStatus(map);
    });
    return () => {
      mounted = false;
    };
  }, [students, gatePasses, leaves]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { PRESENT: 0, LATE: 0, OUTSIDE: 0, ON_LEAVE: 0, PENDING: 0, UNKNOWN: 0 };
    students.forEach((s) => {
      const sid = String(s.student_id).trim().toUpperCase();
      const record = records.find((r) => String(r.studentId).trim().toUpperCase() === sid && r.status !== "OUTSIDE" && r.status !== "ON_LEAVE");
      const status = record ? record.status : autoStatus[sid] || "PENDING";
      c[status] = (c[status] || 0) + 1;
    });
    return c;
  }, [students, records, autoStatus]);

  const total = students.length || 105;
  const done = (counts.PRESENT || 0) + (counts.LATE || 0);
  const pct = total ? Math.round((done / total) * 100) : 0;
  const missing = (counts.PENDING || 0) + (counts.UNKNOWN || 0);

  const frsMissing = students.filter((s) => !s.face_enrolled && !(s.faceDescriptor && s.faceDescriptor.encoding && s.faceDescriptor.encoding.length > 0)).length;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-md dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center justify-between border-b border-slate-100 pb-4 dark:border-slate-800 mb-4">
        <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
          </span>
          Live Night Roll Call
        </h3>
        <Link to="/night-roll-call" className="text-xs font-bold text-indigo-600 hover:underline">Open Dashboard →</Link>
      </div>

      <div className="mb-3 flex items-center justify-between">
        <span className="text-xs text-slate-500"><b className="text-slate-900 dark:text-white">{done}</b> of {total} verified</span>
        <span className="text-lg font-black text-indigo-600 dark:text-indigo-400">{pct}%</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
        <div className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-emerald-500 transition-all duration-700" style={{ width: `${pct}%` }} />
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-xl bg-emerald-50 p-2.5 dark:bg-emerald-950/40">
          <UserCheck className="mx-auto h-4 w-4 text-emerald-600" />
          <p className="mt-1 text-sm font-black text-emerald-700 dark:text-emerald-300">{counts.PRESENT}</p>
          <p className="text-[9px] font-semibold text-emerald-600/70 uppercase">Present</p>
        </div>
        <div className="rounded-xl bg-amber-50 p-2.5 dark:bg-amber-950/40">
          <Users className="mx-auto h-4 w-4 text-amber-600" />
          <p className="mt-1 text-sm font-black text-amber-700 dark:text-amber-300">{(counts.OUTSIDE || 0) + (counts.ON_LEAVE || 0)}</p>
          <p className="text-[9px] font-semibold text-amber-600/70 uppercase">Out/Leave</p>
        </div>
        <div className="rounded-xl bg-red-50 p-2.5 dark:bg-red-950/40">
          <AlertTriangle className="mx-auto h-4 w-4 text-red-600" />
          <p className="mt-1 text-sm font-black text-red-700 dark:text-red-300">{missing}</p>
          <p className="text-[9px] font-semibold text-red-600/70 uppercase">Missing</p>
        </div>
      </div>

      {missing > 0 ? (
        <Link to="/night-roll-call" className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 py-2.5 text-xs font-bold text-white shadow-md hover:bg-indigo-700">
          <Moon className="h-4 w-4" /> Review {missing} Missing Roll Call
        </Link>
      ) : (
        <p className="mt-4 flex items-center justify-center gap-2 rounded-xl bg-slate-50 py-2.5 text-xs font-bold text-emerald-700 dark:bg-slate-800/60 dark:text-emerald-300">
          <Radio className="h-4 w-4" /> All residents accounted for
        </p>
      )}

      {frsMissing > 0 && (
        <Link
          to="/night-roll-call?tab=frs"
          className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 py-2.5 text-xs font-bold text-indigo-700 hover:bg-indigo-100 dark:border-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-300"
        >
          <ScanFace className="h-4 w-4" /> {frsMissing} students need first-time FRS registration
        </Link>
      )}
      {frsMissing === 0 && total > 0 && (
        <p className="mt-2 flex items-center justify-center gap-2 rounded-xl bg-slate-50 py-2.5 text-xs font-bold text-slate-600 dark:bg-slate-800/60 dark:text-slate-300">
          <ScanFace className="h-4 w-4" /> FRS active - all faces enrolled
        </p>
      )}
    </div>
  );
};
