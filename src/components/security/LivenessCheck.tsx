import React, { useCallback, useEffect, useRef, useState } from "react";
import * as faceapi from "face-api.js";
import { Camera, Loader2, CheckCircle2, AlertTriangle, ScanFace, Eye, Play, X } from "lucide-react";
import { loadFaceModels } from "@/lib/faceRecognition";
import { BlinkDetector, eyeOpenRatio } from "@/lib/faceSecurity";

export type LivenessPhase =
  | "idle" // showing start button
  | "starting" // loading models / requesting camera
  | "scanning" // face detected, looking for blink
  | "no_face" // prompt to move into frame
  | "multi_face"
  | "no_camera"
  | "failed"
  | "verified";

const FRAME_MS = 220;

/**
 * Webcam liveness challenge used by the gate scanner.
 *
 * Flow: face detected ✓ -> "Please blink once" -> blink detected -> liveness
 * verified ✓ -> descriptor extracted and handed to the caller. Blink is ONLY a
 * liveness layer; identity + gate pass validation stays with the caller.
 */
export const LivenessCheck: React.FC<{
  onVerified: (descriptor: number[]) => void;
  onFail?: (message: string) => void;
  onCancel?: () => void;
}> = ({ onVerified, onFail, onCancel }) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectorRef = useRef(new BlinkDetector(1));
  const doneRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [phase, setPhase] = useState<LivenessPhase>("idle");
  const [message, setMessage] = useState("");
  const [blinks, setBlinks] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const stopCamera = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  const cleanup = useCallback(() => {
    stopCamera();
    if (!doneRef.current) onFail?.("Liveness check cancelled.");
  }, [stopCamera, onFail]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const extractDescriptor = useCallback(async (): Promise<number[] | null> => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return null;
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const result = await faceapi
      .detectSingleFace(canvas, new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.5 }))
      .withFaceLandmarks()
      .withFaceDescriptor();
    return result?.descriptor ? Array.from(result.descriptor) : null;
  }, []);

  const startScan = useCallback(async () => {
    setPhase("starting");
    setError(null);
    doneRef.current = false;
    detectorRef.current.reset();
    setBlinks(0);
    try {
      await loadFaceModels();
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }

      await new Promise((r) => setTimeout(r, 250));
setPhase("scanning");
        setMessage("Face detected ✓ · Liveness checking…");

        timerRef.current = setInterval(async () => {
          if (doneRef.current) return;
          const video = videoRef.current;
          if (!video || video.readyState < 2) return;

          const results = await faceapi
            .detectAllFaces(video, new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.5 }))
            .withFaceLandmarks()
            .withFaceDescriptors();

          if (results.length === 0) {
            setPhase("no_face");
            setMessage("No face detected. Please position yourself in the frame.");
            return;
          }
          if (results.length > 1) {
            setPhase("multi_face");
            setMessage("Multiple faces detected.");
            return;
          }
          setPhase("scanning");
          const blinkCount = detectorRef.current.count;
          if (blinkCount === 0) setMessage("Face detected ✓ · Please blink once");
          else setMessage("Face detected ✓ · Blink seen ✓ · Verifying…");

          const ear = eyeOpenRatio(results[0].landmarks);
          const blinked = detectorRef.current.update(ear);
          const newCount = detectorRef.current.count;
          if (newCount > blinkCount) setBlinks(newCount);
          if (blinked || (newCount >= 1 && ear !== null && ear < 0.3)) {
            doneRef.current = true;
            if (timerRef.current) clearInterval(timerRef.current);
            setMessage("Liveness verified ✓ · Identifying…");
            const descriptor = await extractDescriptor();
            stopCamera();
            if (descriptor) {
              setPhase("verified");
              setMessage("Liveness verified ✓ · Identity verified ✓");
              onVerified(descriptor);
            } else {
              setPhase("failed");
              setMessage("Liveness verification failed. Please look at the camera and try again.");
              onFail?.("Could not extract a face template. Liveness check failed.");
            }
          }
        }, FRAME_MS);
    } catch (err: any) {
      setPhase("failed");
      if (err?.name === "NotAllowedError" || err?.name === "PermissionDeniedError") {
        setError("Camera permission denied. Allow camera access and retry.");
      } else if (err?.name === "NotFoundError") {
        setError("No camera found on this device.");
      } else {
        setError(err?.message || "Unable to access the camera.");
      }
    }
  }, [extractDescriptor, onVerified, onFail, stopCamera]);

  const retry = useCallback(() => {
    stopCamera();
    setError(null);
    setBlinks(0);
    startScan();
  }, [startScan, stopCamera]);

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-card dark:border-slate-800 dark:bg-slate-900">
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-black">
        <video ref={videoRef} autoPlay playsInline muted className={`h-full w-full object-cover ${phase === "idle" || phase === "starting" ? "hidden" : ""}`} />

        {phase === "idle" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-white">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-indigo-600/90">
              <ScanFace className="h-8 w-8" />
            </div>
            <p className="text-xs font-bold uppercase tracking-widest text-slate-300">Liveness Check</p>
            <button
              onClick={startScan}
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-indigo-500"
            >
              <Play className="h-4 w-4" /> Start Liveness Check
            </button>
          </div>
        )}

        {phase === "starting" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-white">
            <Loader2 className="h-7 w-7 animate-spin text-indigo-400" />
            <p className="text-xs font-semibold text-slate-300">Loading face models & camera…</p>
          </div>
        )}

        {(phase === "scanning" || phase === "no_face" || phase === "multi_face" || phase === "verified") && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="aspect-[3/4] h-[70%] rounded-[2rem] border-2 border-emerald-400/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
          </div>
        )}

        {phase === "no_camera" || (phase === "failed" && error) ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-6 text-center">
            <AlertTriangle className="h-8 w-8 text-red-400" />
            <p className="text-xs font-bold text-red-200">{error}</p>
            <button onClick={retry} className="mt-1 rounded-lg bg-white/20 px-3 py-1.5 text-xs font-bold text-white hover:bg-white/30">
              Retry
            </button>
          </div>
        ) : null}

        {/* Status overlay (top-left) */}
        {phase !== "idle" && phase !== "starting" && (
          <div className="pointer-events-none absolute left-3 top-3 flex flex-col items-start gap-2">
            {phase === "scanning" || phase === "verified" ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/90 px-3 py-1 text-[11px] font-bold text-white">
                <CheckCircle2 className="h-3.5 w-3.5" /> Face detected
              </span>
            ) : null}
            {phase === "no_face" && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/90 px-3 py-1 text-[11px] font-bold text-white">
                <AlertTriangle className="h-3.5 w-3.5" /> No face — center yourself
              </span>
            )}
            {phase === "multi_face" && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/90 px-3 py-1 text-[11px] font-bold text-white">
                <AlertTriangle className="h-3.5 w-3.5" /> Multiple faces
              </span>
            )}
            {blinks > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/90 px-3 py-1 text-[11px] font-bold text-white">
                <Eye className="h-3.5 w-3.5" /> Blink {blinks}/1 ✓
              </span>
            )}
          </div>
        )}
      </div>

      <div className="space-y-2.5 p-4">
        {message && (
          <div className="flex items-start gap-2 rounded-xl bg-slate-50 p-3 text-xs font-semibold text-slate-700 dark:bg-slate-800/60 dark:text-slate-200">
            {phase === "verified" ? (
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
            ) : phase === "failed" ? (
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
            ) : (
              <Camera className="mt-0.5 h-4 w-4 shrink-0 text-indigo-600" />
            )}
            <span>{message}</span>
          </div>
        )}

        {phase === "failed" && !error && (
          <p className="text-[11px] font-semibold text-red-600 dark:text-red-400">
            Liveness verification failed. Please look at the camera and try again.
          </p>
        )}

        <div className="flex items-center justify-end gap-2">
          {phase !== "verified" && onCancel && (
            <button
              onClick={() => {
                cleanup();
                onCancel();
              }}
              className="inline-flex items-center gap-1 rounded-lg px-3 py-2 text-xs font-bold text-slate-500 hover:text-slate-700 dark:text-slate-400"
            >
              <X className="h-3.5 w-3.5" /> Cancel
            </button>
          )}
          {phase === "verified" && (
            <button
              onClick={() => {
                stopCamera();
                onCancel?.();
              }}
              className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700"
            >
              <CheckCircle2 className="h-3.5 w-3.5" /> Continue
            </button>
          )}
        </div>
      </div>
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
};