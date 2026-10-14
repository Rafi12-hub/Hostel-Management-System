import React, { useState, useCallback } from "react";
import { ScanFace, Loader2, UserCheck, X, CheckCircle2, AlertTriangle } from "lucide-react";
import { listCollection, createRecord, updateRecord, type WithId } from "@/lib/firestore";
import { FaceRecognitionScanner } from "@/components/faceRecognition/FaceRecognitionScanner";
import { todayStr, MEAL_LABELS, getActiveMeal, ensureMealConfig } from "@/lib/hostelService";
import type { FaceEncoding } from "@/lib/faceRecognition";

/**
 * Facial Recognition Attendance Scanner (warden / security).
 *
 * Loads every enrolled student's face descriptor from the Student collection,
 * runs a live camera scan, and when a face is confidently matched it records
 * attendance for THAT specific student (the "correct student") in the
 * MessAttendance collection and flips their status to "present".
 */
export const FaceAttendanceScanner: React.FC<{
  onClose: () => void;
  /** When set (student app), the scanner ONLY recognises this one student. */
  restrictToStudentId?: string;
}> = ({ onClose, restrictToStudentId }) => {
  const [enrolled, setEnrolled] = useState<FaceEncoding[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(true);
  const [studentsById, setStudentsById] = useState<Record<string, WithId<any>>>({});
  const [scanning, setScanning] = useState(false);
  const [sidebarError, setSidebarError] = useState<string | null>(null);
  const [result, setResult] = useState<
    | { type: "recorded"; student: WithId<any>; meal: string; confidence: number }
    | { type: "error"; message: string }
    | { type: "already"; student: WithId<any>; meal: string }
    | null
  >(null);
  const [writing, setWriting] = useState(false);

  const loadStudents = useCallback(async () => {
    setLoadingStudents(true);
    try {
      const all = await listCollection<any>("Student");
      // In student mode only THIS student's face is enrolled in the matcher, so
      // a student can never be marked present (or mark anyone else) by scanning
      // another person's face.
      const students = restrictToStudentId
        ? all.filter((s) => String(s.student_id).trim().toUpperCase() === String(restrictToStudentId).trim().toUpperCase())
        : all;
      const byId: Record<string, WithId<any>> = {};
      const enc: FaceEncoding[] = [];
      students.forEach((s) => {
        byId[s.student_id] = s;
        const fd = s.faceDescriptor || s.faceEncoding;
        if (fd && Array.isArray(fd.encoding) && fd.encoding.length > 0) {
          enc.push({ label: String(s.student_id), encoding: fd.encoding });
        }
      });
      setStudentsById(byId);
      setEnrolled(enc);
      setScanning(true);
    } catch {
      setSidebarError("Could not load enrolled students.");
    } finally {
      setLoadingStudents(false);
    }
  }, [restrictToStudentId]);

  React.useEffect(() => {
    loadStudents();
  }, [loadStudents]);

  const handleIdentified = useCallback(
    async (match: { label: string; distance: number; confidence: number }) => {
      if (writing) return;
      setWriting(true);
      try {
        const sid = match.label;
        // Strict self-only guard: in student mode a different student's face
        // can never be recorded via this device/account.
        if (restrictToStudentId && String(sid).trim().toUpperCase() !== String(restrictToStudentId).trim().toUpperCase()) {
          setResult({ type: "error", message: "This face is not yours. You can only mark YOUR own attendance with FRS." });
          setWriting(false);
          return;
        }
        const student = studentsById[sid];
        if (!student) {
          setResult({ type: "error", message: `Matched identity ${sid} but no student record was found.` });
          setWriting(false);
          return;
        }

        // Check auto-detect the currently active meal (if any).
        const config = await ensureMealConfig();
        const active = getActiveMeal(config);
        const meal = active ? active.meal : null;
        const today = todayStr();

        if (meal) {
          // Duplicate guard for this meal+student today.
          const existing = await listCollection<any>("MessAttendance");
          const dup = existing.find(
            (m) => m.date === today && m.meal === meal && String(m.student_id).toUpperCase() === sid.toUpperCase()
          );
          if (dup) {
            setResult({
              type: "already",
              student,
              meal: MEAL_LABELS[meal],
            });
            setWriting(false);
            return;
          }
        }

        // Update the student's live status to present.
        await updateRecord("Student", student.id, { status: "present" });

        // Record attendance in the shared collection.
        await createRecord("MessAttendance", {
          date: today,
          meal: meal || "lunch",
          status: "recorded",
          student_id: sid,
          student_name: student.name,
          hostel: student.hostel || "",
          room: student.room || "",
          mess_code: "FRS-SCAN",
          mess_name: "Face Recognition Scan",
          scanned_at: new Date().toISOString(),
          verification: "face_recognition",
          confidence: Math.round(match.confidence * 100),
          distance: match.distance,
          source: "face_recognition",
        });

        await createRecord("ActivityLog", {
          user: student.name,
          role: student.role || "student",
          action: `Face-recognised & marked present (${(match.confidence * 100).toFixed(0)}% match)`,
          module: "FaceAttendance",
          timestamp: new Date().toISOString(),
        });

        setResult({
          type: "recorded",
          student,
          meal: meal ? MEAL_LABELS[meal] : "Attendance",
          confidence: match.confidence,
        });
      } catch {
        setResult({ type: "error", message: "Failed to record attendance. Please try again." });
      } finally {
        setWriting(false);
      }
    },
    [studentsById, writing, restrictToStudentId]
  );

  const closeAndReset = () => {
    setResult(null);
    setScanning(true);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-4 pb-safe overflow-y-auto">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900 max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <ScanFace className="h-5 w-5 text-indigo-600" /> Face Recognition Attendance
          </h3>
          <button onClick={onClose} className="text-slate-400"><X className="h-5 w-5" /></button>
        </div>

        <div className="mt-4 space-y-4">
          {loadingStudents ? (
            <div className="flex flex-col items-center justify-center gap-2 py-10 text-slate-400">
              <Loader2 className="h-8 w-8 animate-spin" />
              <p className="text-xs font-semibold">Loading enrolled students…</p>
            </div>
          ) : (
            <>
              {sidebarError && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[11px] font-semibold text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
                  {sidebarError}
                </div>
              )}

              {enrolled.length === 0 && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] font-semibold text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
                  {restrictToStudentId
                    ? "You have not registered your face for FRS yet. Visit the Warden for your first-time FRS registration."
                    : "No students have enrolled faces yet. Register students and capture their faces from the Students page first."}
                </div>
              )}

              {!result && scanning && enrolled.length > 0 && (
                <FaceRecognitionScanner
                  enrolled={enrolled}
                  onIdentified={handleIdentified}
                  onClose={closeAndReset}
                />
              )}

              {result?.type === "recorded" && (
                <div className="flex flex-col items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-center dark:border-emerald-900 dark:bg-emerald-950/40">
                  <CheckCircle2 className="h-12 w-12 text-emerald-600" />
                  <div>
                    <p className="text-base font-extrabold text-emerald-800 dark:text-emerald-200">
                      {result.student.name}
                    </p>
                    <p className="text-xs font-mono text-emerald-700 dark:text-emerald-300">
                      {result.student.student_id} · Room {result.student.room}
                    </p>
                    <p className="mt-1 text-sm font-bold text-emerald-700 dark:text-emerald-300">
                      Marked present for {result.meal}
                    </p>
                    <p className="text-[11px] text-emerald-600/80 dark:text-emerald-300/70">
                      Identity confidence: {(result.confidence * 100).toFixed(0)}%
                    </p>
                  </div>
                  <button
                    onClick={closeAndReset}
                    disabled={writing}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
                  >
                    {writing ? <Loader2 className="h-4 w-4 animate-spin" /> : <ScanFace className="h-4 w-4" />}
                    Scan Next Student
                  </button>
                </div>
              )}

              {result?.type === "already" && (
                <div className="flex flex-col items-center gap-3 rounded-xl border border-blue-200 bg-blue-50 p-5 text-center dark:border-blue-900 dark:bg-blue-950/40">
                  <UserCheck className="h-12 w-12 text-blue-600" />
                  <div>
                    <p className="text-base font-extrabold text-blue-800 dark:text-blue-200">
                      {result.student.name}
                    </p>
                    <p className="text-xs font-mono text-blue-700 dark:text-blue-300">
                      {result.student.student_id}
                    </p>
                    <p className="mt-1 text-sm font-bold text-blue-700 dark:text-blue-300">
                      Already recorded for {result.meal} today
                    </p>
                  </div>
                  <button
                    onClick={closeAndReset}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700"
                  >
                    <ScanFace className="h-4 w-4" /> Scan Next Student
                  </button>
                </div>
              )}

              {result?.type === "error" && (
                <div className="flex flex-col items-center gap-3 rounded-xl border border-red-200 bg-red-50 p-5 text-center dark:border-red-900 dark:bg-red-950/40">
                  <AlertTriangle className="h-12 w-12 text-red-600" />
                  <p className="text-sm font-bold text-red-700 dark:text-red-300">{result.message}</p>
                  <button
                    onClick={closeAndReset}
                    className="rounded-xl bg-red-600 px-4 py-2 text-xs font-bold text-white hover:bg-red-700"
                  >
                    Back to Scan
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
