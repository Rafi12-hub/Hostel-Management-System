import React, { useCallback, useEffect, useRef, useState } from "react";
import { Camera, CheckCircle2, AlertTriangle, RefreshCw, Fingerprint, Loader2, ImageOff } from "lucide-react";
import { useDemoAuth } from "@/context/DemoAuthContext";
import { filterCollection, updateRecord } from "@/lib/firestore";
import { loadFaceModels } from "@/lib/faceRecognition";
import { analyseSnapshot, enrollFromSnapshots, type QualityReport } from "@/lib/faceSecurity";
import { PageHeader } from "@/components/ui/PageHeader";
import { useToast } from "@/components/ui/Toast";
import { Button } from "@/components/ui/Button";

const REQUIRED_SAMPLES = 3;
const MAX_SAMPLES = 5;

export default function FaceEnrollment() {
  const { user } = useDemoAuth();
  const { toast: showToast } = useToast();

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [student, setStudent] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [cameraOn, setCameraOn] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [warmup, setWarmup] = useState(false);

  const [samples, setSamples] = useState<HTMLCanvasElement[]>([]);
  const [quality, setQuality] = useState<QualityReport | null>(null);
  const [capturing, setCapturing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [enrolled, setEnrolled] = useState(false);

  const startCamera = useCallback(async () => {
    setCameraError(null);
    setWarmup(true);
    try {
      await loadFaceModels();
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });
      streamRef.current = stream;
      setWarmup(false);
      setCameraOn(true);
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
      }, 120);
    } catch (err: any) {
      setWarmup(false);
      setCameraOn(false);
      setCameraError(
        err?.name === "NotAllowedError" || err?.name === "PermissionDeniedError"
          ? "Camera permission denied. Allow camera access and try again."
          : err?.name === "NotFoundError"
            ? "No camera found on this device."
            : err?.message || "Unable to access the camera."
      );
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraOn(false);
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const students = await filterCollection("Student", (s: any) =>
        String(s.student_id || "").trim().toUpperCase() === String(user?.studentId || "").trim().toUpperCase()
      );
      if (!mounted) return;
      setStudent(students[0] || null);
      setEnrolled(!!(students[0] && (students[0].face_enrolled || students[0].faceDescriptor)));
      setLoading(false);
    })();
    return () => {
      mounted = false;
      stopCamera();
    };
  }, [user?.studentId, stopCamera]);

  const captureSample = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current || capturing || samples.length >= MAX_SAMPLES) return;
    setCapturing(true);
    setQuality(null);
    try {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("no ctx");
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const report = await analyseSnapshot(canvas);
      setQuality(report);
      if (report.ok) {
        // Clone the canvas into a fresh detached canvas so later captures can't
        // mutate earlier samples.
        const clone = document.createElement("canvas");
        clone.width = canvas.width;
        clone.height = canvas.height;
        const c2 = clone.getContext("2d");
        if (c2) c2.drawImage(canvas, 0, 0);
        setSamples((prev) => [...prev, clone]);
        showToast("Sample captured ✓", "success");
      } else {
        showToast(report.reasons.join(" "), "info");
      }
    } catch {
      showToast("Could not analyse this frame. Try again.", "info");
    } finally {
      setCapturing(false);
    }
  }, [capturing, samples.length, showToast]);

  const removeSample = useCallback((idx: number) => {
    setSamples((prev) => prev.filter((_, i) => i !== idx));
    setQuality(null);
  }, []);

  const finalize = useCallback(async () => {
    if (!student || samples.length < REQUIRED_SAMPLES || saving) return;
    setSaving(true);
    try {
      const { enrollment, rejected } = await enrollFromSnapshots(samples, {
        label: String(student.student_id || user?.studentId || "student"),
        samples: 0,
        minGoodSamples: REQUIRED_SAMPLES,
      });
      if (!enrollment) {
        const reasons = rejected[0]?.reasons?.join(" ") || "Enrollment failed — capture more good samples.";
        showToast(reasons, "info");
        return;
      }
      await updateRecord("Student", student.id, {
        faceDescriptor: { label: String(student.student_id || user?.studentId || "student"), encoding: enrollment.encoding },
        face_embedding: { label: String(student.student_id || user?.studentId || "student"), encoding: enrollment.encoding },
        face_enrolled: true,
        face_enrolled_at: new Date().toISOString(),
        face_samples: enrollment.sampleCount,
      });
      stopCamera();
      setEnrolled(true);
      setSamples([]);
      showToast("Face enrolled successfully!", "success");
    } catch (e: any) {
      showToast(e?.message || "Enrollment failed. Please try again.", "error");
    } finally {
      setSaving(false);
    }
  }, [samples, saving, showToast, student, user?.studentId, stopCamera]);

  const resetAll = useCallback(() => {
    setSamples([]);
    setQuality(null);
    setCameraError(null);
    if (!cameraOn) startCamera();
  }, [cameraOn, startCamera]);

  return (
    <div className="mx-auto max-w-xl space-y-5 pb-4">
      <PageHeader title="Face Enrollment" subtitle="Register your face so the gate scanner can recognise you (multi-sample + liveness ready)" />

      {loading ? (
        <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white p-8 text-sm font-semibold text-slate-500 dark:border-slate-800 dark:bg-slate-900">
          <Loader2 className="h-5 w-5 animate-spin text-indigo-600" /> Loading your profile…
        </div>
      ) : !student ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm font-semibold text-slate-500 dark:border-slate-800 dark:bg-slate-900">
          No student profile found for the logged-in demo account.
        </div>
      ) : (
        <>
          {/* Status banner */}
          <div
            className={`flex items-center gap-3 rounded-2xl border p-4 text-xs font-bold ${
              enrolled
                ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                : "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
            }`}
          >
            {enrolled ? <CheckCircle2 className="h-6 w-6 shrink-0" /> : <Fingerprint className="h-6 w-6 shrink-0" />}
            <div>
              <p>{student.name} ({student.student_id})</p>
              <p className="mt-0.5 text-[11px] font-semibold">
                {enrolled ? `Enrolled on ${new Date(student.face_enrolled_at || new Date()).toLocaleDateString()}` : "Not enrolled yet — camera scan required"}
              </p>
            </div>
          </div>

          {/* Camera area */}
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-card dark:border-slate-800 dark:bg-slate-900">
            <div className="relative aspect-[4/3] w-full overflow-hidden bg-black">
              <video ref={videoRef} autoPlay playsInline muted className={`h-full w-full object-cover ${!cameraOn ? "hidden" : ""}`} />

              {!cameraOn && !cameraError && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-white">
                  <Fingerprint className="h-10 w-10 text-indigo-400" />
                  <p className="text-xs font-bold uppercase tracking-widest text-slate-300">Face enrollment</p>
                  <Button onClick={() => void startCamera()} loading={warmup} icon={Camera}>
                    Start Camera
                  </Button>
                </div>
              )}
              {warmup && cameraOn && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-white">
                  <Loader2 className="h-7 w-7 animate-spin text-indigo-400" />
                  <p className="text-xs font-semibold text-slate-300">Starting camera…</p>
                </div>
              )}
              {cameraError && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-6 text-center">
                  <ImageOff className="h-8 w-8 text-red-400" />
                  <p className="text-xs font-bold text-red-200">{cameraError}</p>
                </div>
              )}
              {cameraOn && !warmup && (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <div className="aspect-[3/4] h-[72%] rounded-[2rem] border-2 border-emerald-400/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
                </div>
              )}
              <canvas ref={canvasRef} className="hidden" />
            </div>

            <div className="space-y-3 p-4">
              {/* Quality feedback */}
              {quality && (
                <div className={`flex items-start gap-2 rounded-xl p-3 text-[11px] font-semibold ${quality.ok ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300" : "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"}`}>
                  {quality.ok ? <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" /> : <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />}
                  <span>{quality.ok ? "Good sample — face detected, eyes clear." : quality.reasons.join(" ") || "Frame rejected."}</span>
                </div>
              )}

              {/* Sample thumbnails */}
              <div>
                <p className="mb-2 text-xs font-bold text-slate-700 dark:text-slate-300">
                  Samples: {samples.length}/{REQUIRED_SAMPLES} required
                </p>
                <div className="flex flex-wrap gap-2">
                  {samples.map((c, idx) => (
                    <div key={idx} className="relative h-16 w-16 overflow-hidden rounded-xl border border-emerald-300">
                      <img src={c.toDataURL("image/jpeg", 0.7)} alt={`sample ${idx + 1}`} className="h-full w-full object-cover" />
                      <button
                        onClick={() => removeSample(idx)}
                        className="absolute right-0.5 top-0.5 rounded-full bg-red-500 p-0.5 text-[9px] font-bold text-white"
                        title="Remove sample"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                  {Array.from({ length: Math.max(0, REQUIRED_SAMPLES - samples.length) }).map((_, i) => (
                    <div key={`ph-${i}`} className="flex h-16 w-16 items-center justify-center rounded-xl border-2 border-dashed border-slate-200 text-[10px] font-bold text-slate-300 dark:border-slate-700">
                      {i + 1}
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="primary"
                  size="md"
                  icon={Camera}
                  onClick={() => void captureSample()}
                  disabled={!cameraOn || capturing || samples.length >= MAX_SAMPLES}
                  loading={capturing}
                >
                  {capturing ? "Analysing…" : samples.length >= MAX_SAMPLES ? `Max ${MAX_SAMPLES} samples` : "Capture sample"}
                </Button>
                {samples.length >= MAX_SAMPLES && (
                  <Button variant="secondary" onClick={resetAll} icon={RefreshCw}>
                    Clear samples
                  </Button>
                )}
                <span className="ml-auto text-[10px] font-semibold text-slate-400">
                  {MAX_SAMPLES - samples.length} captures left
                </span>
              </div>

              <Button
                variant="success"
                size="lg"
                fullWidth
                loading={saving}
                disabled={samples.length < REQUIRED_SAMPLES}
                onClick={() => void finalize()}
              >
                {enrolled ? "Re-enroll with new samples" : `Enroll Face (${samples.length}/${REQUIRED_SAMPLES})`}
              </Button>
            </div>
          </div>

          <p className="text-[11px] leading-relaxed text-slate-400">
            Your face is converted to a secure 128-d mathematical template — raw photographs are never stored. The
            scanner requires a live blink and a valid gate pass before an exit/entry is recorded.
          </p>
        </>
      )}
    </div>
  );
}