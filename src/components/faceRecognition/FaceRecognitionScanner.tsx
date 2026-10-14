import React, { useRef, useState, useCallback, useEffect } from "react";
import { Loader2, UserCheck, AlertTriangle, VideoOff, ScanFace } from "lucide-react";
import {
  loadFaceModels,
  extractDescriptor,
  matchDescriptor,
  similarity,
  type FaceEncoding,
} from "@/lib/faceRecognition";

/**
 * Live Facial Recognition Scanner used for ATTENDANCE.
 * Continuously reads frames from the webcam, extracts a face descriptor and
 * matches it against the enrolled students to identify the correct person.
 *
 * On a confident match it calls `onIdentified(student)` and stops scanning.
 */
export const FaceRecognitionScanner: React.FC<{
  enrolled: FaceEncoding[];
  onIdentified: (match: { label: string; distance: number; confidence: number }) => void;
  onClose: () => void;
}> = ({ enrolled, onIdentified, onClose }) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number>(0);
  const busyRef = useRef(false);
  const matchedRef = useRef(false);

  const [status, setStatus] = useState<"loading" | "ready" | "error" | "matching" | "identified">("loading");
  const [error, setError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<{ label: string; distance: number; confidence: number } | null>(null);

  const stop = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  const detectFacesLoopRef = useRef<() => void>(() => {});

  React.useEffect(() => {
    detectFacesLoopRef.current = async () => {
      if (!videoRef.current || matchedRef.current) return;
      try {
        if (videoRef.current.readyState >= 2 && !busyRef.current) {
          busyRef.current = true;
          const descriptor = await extractDescriptor(videoRef.current);
          if (descriptor) {
            const match = await matchDescriptor(descriptor, enrolled);
            if (match && !matchedRef.current) {
              matchedRef.current = true;
              setScanning(false);
              setStatus("identified");
              const conf = similarity(match.distance);
              setResult({ label: match.label, distance: match.distance, confidence: conf });
              stop();
              onIdentified({ label: match.label, distance: match.distance, confidence: conf });
              return;
            }
          }
          busyRef.current = false;
        }
      } catch {
        busyRef.current = false;
      }
      if (!matchedRef.current) rafRef.current = requestAnimationFrame(() => detectFacesLoopRef.current());
    };
  }, [enrolled, onIdentified, stop]);

  const start = useCallback(async () => {
    setStatus("loading");
    setError(null);
    try {
      await loadFaceModels();
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });
      streamRef.current = stream;
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {
            setError("Could not start the video feed.");
            setStatus("error");
          });
          setStatus("ready");
          setScanning(true);
          rafRef.current = requestAnimationFrame(() => detectFacesLoopRef.current());
        }
      }, 120);
    } catch (err: any) {
      if (err?.name === "NotAllowedError" || err?.name === "PermissionDeniedError") {
        setError("Camera permission denied. Allow camera access and try again.");
      } else if (err?.name === "NotFoundError" || err?.name === "DevicesNotFoundError") {
        setError("No camera found on this device.");
      } else {
        setError("Unable to access the camera.");
      }
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    start();
    return () => {
      stop();
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [start, stop]);

  return (
    <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
      <p className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 mb-2">
        <ScanFace className="h-4 w-4 text-indigo-600 dark:text-indigo-400" /> Facial Recognition
        <span className="ml-auto text-[10px] font-semibold text-slate-400">{enrolled.length} enrolled</span>
      </p>

      {error && (
        <div className="mb-2 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[11px] font-semibold text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" /> <span>{error}</span>
        </div>
      )}

      <div className="relative bg-black rounded-xl overflow-hidden w-full aspect-video flex items-center justify-center">
        {status === "loading" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-white">
            <Loader2 className="h-8 w-8 animate-spin" />
            <p className="text-xs font-semibold">Loading models & camera…</p>
          </div>
        )}
        {status === "error" ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-6 text-center">
            <VideoOff className="h-10 w-10 text-red-400" />
            <p className="text-xs font-bold text-red-200">{error}</p>
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="mt-1 rounded-lg bg-white/10 px-3 py-1.5 text-xs font-bold text-white hover:bg-white/20"
              >
                Close
              </button>
            )}
          </div>
        ) : (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className={`w-full h-full object-cover ${status === "loading" ? "hidden" : ""}`}
          />
        )}

        {scanning && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-40 h-40 rounded-full border-2 border-emerald-400/70 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]">
              <div className="absolute top-2 left-1/2 -translate-x-1/2 animate-pulse text-emerald-300 text-[10px] font-bold whitespace-nowrap">
                Matching face…
              </div>
            </div>
          </div>
        )}

        {status === "identified" && result && (
          <div className="absolute inset-0 bg-emerald-600/80 flex items-center justify-center">
            <div className="flex flex-col items-center gap-2 px-4 text-center text-white">
              <UserCheck className="h-12 w-12" />
              <p className="text-lg font-extrabold">{result.label}</p>
              <p className="text-xs font-semibold">
                Identity confirmed · {(result.confidence * 100).toFixed(0)}% match
              </p>
            </div>
          </div>
        )}
      </div>

      <p className="mt-2 text-center text-[10px] text-slate-400">
        Look directly into the camera. The scanner detects your face and matches it against enrolled students.
      </p>
    </div>
  );
};
