import React, { useState } from "react";
import { X, ShieldCheck, Loader2, CheckCircle2, AlertTriangle, ScanFace, Save } from "lucide-react";
import { updateRecord, createRecord } from "@/lib/firestore";
import { FaceCapture } from "@/components/faceRecognition/FaceCapture";
import type { FaceEncoding } from "@/lib/faceRecognition";

/**
 * First-time FRS (Face Recognition Service) registration modal.
 *
 * Ran by the Warden on behalf of a student who has NOT enrolled their face
 * yet. Captures a live face, builds the 128-d descriptor and persists it on the
 * Student record so the student can check into the FRS Night Roll Call.
 */
export const FrsEnrollModal: React.FC<{
  student: any;
  actor: string;
  onClose: () => void;
  onSaved?: () => void;
}> = ({ student, actor, onClose, onSaved }) => {
  const [captured, setCaptured] = useState<{ enc: FaceEncoding; photo: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const alreadyEnrolled = !!student.faceDescriptor || !!student.face_enrolled;

  const handleSave = async () => {
    if (!captured) return;
    setSaving(true);
    setError(null);
    try {
      await updateRecord("Student", student.id, {
        faceDescriptor: captured.enc,
        face_enrolled: true,
        photo_url: captured.photo || student.photo_url || "",
      });
      await createRecord("ActivityLog", {
        user: actor || "Warden",
        role: "warden",
        action: `${alreadyEnrolled ? "Re-enrolled" : "Registered"} ${student.name} (${student.student_id}) for FRS Night Roll Call`,
        module: "FRS",
        record: student.student_id,
        timestamp: new Date().toISOString(),
      });
      await createRecord("Notification", {
        type: "info",
        title: "FRS Face Registration Complete",
        message: `Warden ${actor} registered your face for Facial Recognition Service (FRS). You can now check in to Night Roll Call with your face.`,
        role: "student",
        recipient: student.student_id,
        read: false,
        timestamp: new Date().toISOString(),
      });
      setSaved(true);
      onSaved?.();
    } catch {
      setError("Failed to save the face registration. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/60 backdrop-blur-sm p-4 pb-safe overflow-y-auto sm:items-center">
      <div className="w-full max-w-md my-8 rounded-2xl bg-white p-6 shadow-2xl sm:my-8 dark:bg-slate-900 max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <ScanFace className="h-5 w-5 text-indigo-600" /> {alreadyEnrolled ? "Re-enroll FRS Face" : "First-time FRS Registration"}
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="h-5 w-5" /></button>
        </div>

        {/* Student info */}
        <div className="mt-4 flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/60">
          <img src={student.photo_url} alt={student.name} className="h-10 w-10 rounded-full object-cover" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-slate-900 dark:text-white">{student.name}</p>
            <p className="text-[10px] font-mono text-indigo-600 dark:text-indigo-400">{student.student_id}</p>
            <p className="text-[10px] text-slate-500">{student.hostel} · {student.block} Room {student.room}</p>
          </div>
          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
            alreadyEnrolled
              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
              : "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
          }`}>
            {alreadyEnrolled ? <><ShieldCheck className="h-3 w-3" /> Enrolled</> : "Not enrolled"}
          </span>
        </div>

        {alreadyEnrolled && !saved && (
          <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] font-semibold text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
            <p className="flex items-center gap-1.5"><AlertTriangle className="h-3.5 w-3.5" /> This student already has a face enrolled. Capture a fresh face to re-register it.</p>
          </div>
        )}

        {error && (
          <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[11px] font-semibold text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
            {error}
          </div>
        )}

        <div className="mt-4">
          {saved ? (
            <div className="flex flex-col items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-center dark:border-emerald-900 dark:bg-emerald-950/40">
              <CheckCircle2 className="h-12 w-12 text-emerald-600" />
              <div>
                <p className="text-sm font-extrabold text-emerald-800 dark:text-emerald-200">FRS Registration Complete</p>
                <p className="mt-1 text-xs text-emerald-700 dark:text-emerald-300">
                  {student.name} can now complete Night Roll Call using Face Recognition.
                </p>
              </div>
              <button onClick={onClose} className="rounded-xl bg-emerald-600 px-5 py-2 text-xs font-bold text-white hover:bg-emerald-700">
                Close
              </button>
            </div>
          ) : (
            <FaceCapture
              label={student.student_id || student.name || "student"}
              onCaptured={(enc, photo) => setCaptured(enc && photo ? { enc, photo } : null)}
            />
          )}
        </div>

        {captured && !saved && (
          <button
            onClick={handleSave}
            disabled={saving}
            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 py-3 text-xs font-extrabold text-white shadow-md hover:bg-indigo-700 disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {saving ? "Saving registration…" : alreadyEnrolled ? "Save Face (Re-enroll)" : "Save FRS Registration"}
          </button>
        )}
      </div>
    </div>
  );
};