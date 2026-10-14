import React, { useRef, useState, useCallback } from "react";
import { Camera, Loader2, RefreshCw, CheckCircle2, AlertTriangle, VideoOff, X } from "lucide-react";
import { loadFaceModels, enrollFace, type FaceEncoding } from "@/lib/faceRecognition";

/**
 * Webcam face capture used for ENROLLMENT.
 * Lets the user point the camera at their face, snap a still, and extracts a
 * 128-d face descriptor. The result is returned to the parent via onCaptured.
 */
export const FaceCapture: React.FC<{
  label: string;
  onCaptured: (enc: FaceEncoding | null, photoDataUrl: string | null) => void;
  onClose?: () => void;
}> = ({ label, onCaptured, onClose }) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [loading, setLoading] = useState(false);
  const [warmup, setWarmup] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);

  const startCamera = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      setWarmup(true);
      await loadFaceModels();
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });
      streamRef.current = stream;
      setLoading(false);
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
        setWarmup(false);
      }, 120);
    } catch (err: any) {
      setLoading(false);
      setWarmup(false);
      if (err?.name === "NotAllowedError" || err?.name === "PermissionDeniedError") {
        setError("Camera permission denied. Allow camera access and try again.");
      } else if (err?.name === "NotFoundError" || err?.name === "DevicesNotFoundError") {
        setError("No camera found on this device.");
      } else {
        setError("Unable to access the camera.");
      }
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  const capture = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current || processing) return;
    setProcessing(true);
    setError(null);
    try {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("no ctx");
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
      const enc = await enrollFace(canvas, label);
      if (!enc) {
        setError("No face detected in the photo. Make sure your face is visible and well-lit, then retake.");
        setProcessing(false);
        return;
      }
      setPreview(dataUrl);
      stopCamera();
      onCaptured(enc, dataUrl);
    } catch {
      setError("Face detection failed. Try again with better lighting.");
    }
    setProcessing(false);
  }, [canvasRef, label, onCaptured, processing, stopCamera]);

  const reset = useCallback(() => {
    setError(null);
    setPreview(null);
    startCamera();
  }, [startCamera]);

  return (
    <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
      <p className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 mb-2">
        <Camera className="h-4 w-4 text-indigo-600 dark:text-indigo-400" /> Facial Enrolment
      </p>

      {error && (
        <div className="mb-2 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[11px] font-semibold text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" /> <span>{error}</span>
        </div>
      )}

      {preview ? (
        <div className="flex flex-col items-center gap-2">
          <img src={preview} alt="Captured" className="h-40 w-40 rounded-xl object-cover border border-emerald-300" />
          <p className="flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="h-3.5 w-3.5" /> Face enrolled successfully
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={reset}
              className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200"
            >
              <RefreshCw className="h-3 w-3" /> Retake
            </button>
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200"
              >
                <X className="h-3 w-3" /> Close
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2">
          <div className="relative bg-black rounded-xl overflow-hidden w-full max-w-xs aspect-[4/3] flex items-center justify-center">
            {loading && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-white">
                <Loader2 className="h-7 w-7 animate-spin" />
                <p className="text-xs font-semibold">{warmup ? "Loading face models…" : "Requesting camera…"}</p>
              </div>
            )}
            {error ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-6 text-center">
                <VideoOff className="h-8 w-8 text-red-400" />
                <p className="text-[11px] font-bold text-red-200">{error}</p>
              </div>
            ) : (
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={`w-full h-full object-cover ${loading ? "hidden" : ""}`}
              />
            )}
            {!loading && !error && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-32 h-32 rounded-full border-2 border-emerald-400/70 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
              </div>
            )}
            <canvas ref={canvasRef} className="hidden" />
          </div>

          <button
            type="button"
            onClick={capture}
            disabled={loading || processing}
            className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {processing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Camera className="h-3.5 w-3.5" />}
            {processing ? "Detecting face…" : "Capture & Enrol Face"}
          </button>
        </div>
      )}
    </div>
  );
};
