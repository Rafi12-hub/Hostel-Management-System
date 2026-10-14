import React, { useCallback, useEffect, useRef, useState } from "react";
import jsQR from "jsqr";
import { Loader2, ScanLine, CameraOff, QrCode } from "lucide-react";

/**
 * Live QR code scanner using jsQR. Streams the camera into a hidden canvas,
 * decodes a frame every ~150 ms and calls onDecoded with the payload.
 */
export const QRScanner: React.FC<{
  onDecoded: (payload: string) => void;
  onFail?: (message: string) => void;
  className?: string;
  scanning?: boolean;
}> = ({ onDecoded, onFail, className = "", scanning = true }) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const doneRef = useRef(false);

  const [state, setState] = useState<"starting" | "ready" | "error">("starting");
  const [error, setError] = useState<string | null>(null);

  const stop = useCallback(() => {
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

  useEffect(() => {
    let cancelled = false;

    const start = async () => {
      setState("starting");
      setError(null);
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
        setState("ready");

        timerRef.current = setInterval(() => {
          const video = videoRef.current;
          const canvas = canvasRef.current;
          if (!video || !canvas || doneRef.current || !scanning) return;
          if (video.readyState < 2) return;

          if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
            canvas.width = video.videoWidth || 640;
            canvas.height = video.videoHeight || 480;
          }
          const ctx = canvas.getContext("2d", { willReadFrequently: true });
          if (!ctx) return;
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: "dontInvert",
          });
          if (code && code.data) {
            doneRef.current = true;
            stop();
            onDecoded(code.data);
          }
        }, 150);
      } catch (err: any) {
        setState("error");
        setError(
          err?.name === "NotAllowedError" || err?.name === "PermissionDeniedError"
            ? "Camera permission denied. Allow camera access in browser settings."
            : err?.name === "NotFoundError"
              ? "No camera available on this device."
              : err?.message || "Unable to start camera."
        );
        onFail?.(String(err?.message || "Camera error"));
      }
    };

    start();
    return () => {
      cancelled = true;
      stop();
    };
  }, [stop, onDecoded, onFail, scanning]);

  return (
    <div className={`overflow-hidden rounded-2xl border border-slate-200 bg-black shadow-sm dark:border-slate-800 ${className}`}>
      <div className="relative aspect-[4/3] w-full overflow-hidden">
        <video ref={videoRef} muted playsInline className={`h-full w-full object-cover ${state !== "ready" ? "hidden" : ""}`} />

        {state === "starting" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-slate-200">
            <Loader2 className="h-7 w-7 animate-spin text-indigo-400" />
            <p className="text-xs font-semibold">Starting camera…</p>
          </div>
        )}

        {state === "error" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center text-slate-200">
            <CameraOff className="h-8 w-8 text-red-400" />
            <p className="text-xs font-semibold">{error}</p>
          </div>
        )}

        {state === "ready" && scanning && (
          <>
            <div className="pointer-events-none absolute inset-0">
              <div className="absolute inset-x-0 top-1/2 h-28 -translate-y-1/2 border-x-2 border-emerald-400/80 bg-emerald-400/5" />
              <div className="absolute inset-y-0 left-1/2 w-72 -translate-x-1/2 border-y-2 border-emerald-400/80" />
              <ScanLine className="absolute left-1/2 top-1/2 h-28 w-72 -translate-x-1/2 -translate-y-1/2 text-emerald-300/40" />
            </div>
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-3 py-1 text-[11px] font-bold text-emerald-300">
              Point at the gate-pass QR code
            </div>
          </>
        )}

        {state === "ready" && !scanning && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50">
            <QrCode className="h-10 w-10 text-emerald-400" />
          </div>
        )}
      </div>
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
};