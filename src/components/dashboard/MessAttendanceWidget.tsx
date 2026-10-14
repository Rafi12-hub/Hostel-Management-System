import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { Utensils, CheckCircle2, XCircle, Clock, ScanLine, Loader2, Camera, VideoOff } from "lucide-react";
import { subscribeCollection } from "@/lib/firestore";
import { useDemoAuth } from "@/context/DemoAuthContext";
import {
  MEAL_ORDER,
  MEAL_LABELS,
  MEAL_EMOJIS,
  mealMapForDay,
  completedMealCountForDay,
  ensureMealConfig,
  getActiveMeal,
  recordMessScan,
  fmtHm,
  nowHhmm,
  hoursToMinutes,
  todayStr,
  MESS_QR_PATTERN,
  type MealConfig,
  type ActiveMeal,
} from "@/lib/hostelService";

const HOSTEL_MESS: Record<string, string> = {
  "APJ Abdul Kalam Boys Hostel (BH-1)": "RGMCET-KRISHNA-MESS-01",
  "CV Raman Boys Hostel (BH-2)": "RGMCET-RAMAN-MESS-02",
  "Kalpana Chawla Girls Hostel (GH-1)": "RGMCET-CHAWLA-MESS-03",
};

const _BD = typeof (globalThis as any).BarcodeDetector !== "undefined";
const hasBarcodeDetector = _BD;

export const MessAttendanceWidget: React.FC = () => {
  const { user } = useDemoAuth();
  const studentId = user?.studentId || "";
  const hostel = user?.hostel || "";

  const [records, setRecords] = useState<any[]>([]);
  const [config, setConfig] = useState<MealConfig | null>(null);
  const [now, setNow] = useState(new Date());

  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraLoading, setCameraLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [verdict, setVerdict] = useState<{ ok: boolean; message: string } | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number>(0);
  const detectorRef = useRef<any>(null);

  useEffect(() => {
    const unsub = subscribeCollection("MessAttendance", setRecords);
    ensureMealConfig().then(setConfig).catch(() => setConfig(null));
    const tick = setInterval(() => setNow(new Date()), 30000);
    return () => {
      unsub();
      clearInterval(tick);
    };
  }, []);

  const map = useMemo(
    () => mealMapForDay(records, studentId, todayStr(now)),
    [records, studentId, now]
  );
  const done = completedMealCountForDay(records, studentId, todayStr(now));
  const active: ActiveMeal | null = config ? getActiveMeal(config, now) : null;

  const stopCamera = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
      videoRef.current = null;
    }
  }, []);

  const submitPayload = useCallback(
    async (qrPayload: string) => {
      setProcessing(true);
      setVerdict(null);
      try {
        const res = await recordMessScan({
          studentId,
          studentName: user?.name || "Student",
          hostel,
          room: user?.room || "",
          qrPayload,
        });
        if (res.ok) {
          setVerdict({ ok: true, message: `Present — ${MEAL_LABELS[res.meal!]} attendance recorded!` });
          setTimeout(() => {
            setCameraOpen(false);
            setVerdict(null);
          }, 1800);
        } else {
          setVerdict({ ok: false, message: res.error || "Scan failed." });
        }
      } catch {
        setVerdict({ ok: false, message: "Could not reach the server. Try again." });
      }
      setProcessing(false);
    },
    [studentId, user, hostel]
  );

  const scanLoopRef = useRef<() => void>(() => {});

  const scanLoop = useCallback(async () => {
    if (!videoRef.current || !detectorRef.current || !cameraOpen) return;
    try {
      if (videoRef.current.readyState >= 2) {
        const barcodes = await detectorRef.current.detect(videoRef.current);
        if (barcodes.length > 0) {
          const raw = String(barcodes[0].rawValue || "").trim();
          if (MESS_QR_PATTERN.test(raw) && !processing) {
            await submitPayload(raw);
          }
        }
      }
    } catch {
      /* detector busy or frame skipped */
    }
    if (cameraOpen) rafRef.current = requestAnimationFrame(scanLoopRef.current);
  }, [cameraOpen, processing, submitPayload]);

  useEffect(() => {
    scanLoopRef.current = scanLoop;
  }, [scanLoop]);

  useEffect(() => {
    if (cameraOpen && hasBarcodeDetector) {
      detectorRef.current = new (globalThis as any).BarcodeDetector({ formats: ["qr_code"] });
      rafRef.current = requestAnimationFrame(scanLoopRef.current);
    }
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [cameraOpen]);

  const openCamera = async () => {
    setVerdict(null);
    setCameraError(null);
    setCameraLoading(true);
    setCameraOpen(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      streamRef.current = stream;
      setCameraLoading(false);
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
      }, 100);
    } catch (err: any) {
      setCameraLoading(false);
      if (err?.name === "NotAllowedError" || err?.name === "PermissionDeniedError") {
        setCameraError("Camera permission denied. Please allow camera access and try again.");
      } else if (err?.name === "NotFoundError" || err?.name === "DevicesNotFoundError") {
        setCameraError("No camera found on this device.");
      } else {
        setCameraError("Unable to access camera. Use manual entry below.");
      }
    }
  };

  const closeCamera = () => {
    stopCamera();
    setCameraOpen(false);
    setCameraError(null);
    setVerdict(null);
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const input = (e.target as HTMLFormElement).querySelector<HTMLInputElement>("[name='qr']");
    if (input?.value.trim()) {
      await submitPayload(input.value.trim());
      input.value = "";
    }
  };

  const mealState = (meal: (typeof MEAL_ORDER)[number]) => {
    const rec = map[meal];
    if (rec)
      return {
        state: "recorded" as const,
        note: new Date(rec.scanned_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
    const t = config?.[meal];
    if (t && hoursToMinutes(nowHhmm(now)) > hoursToMinutes(t.end))
      return { state: "missed" as const, note: "No scan" };
    return { state: "pending" as const, note: "Not yet" };
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-md dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center justify-between border-b border-slate-100 pb-4 dark:border-slate-800 mb-4">
        <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <Utensils className="h-5 w-5 text-emerald-600" /> Today's Mess Attendance
        </h3>
        <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-extrabold text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
          {done}/{MEAL_ORDER.length} meals
        </span>
      </div>

      {/* Live session banner */}
      {active && (
        <div className="mb-4 flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50/70 px-4 py-3 dark:border-emerald-900 dark:bg-emerald-950/40">
          <div className="text-xs">
            <p className="font-extrabold text-emerald-900 dark:text-emerald-200 flex items-center gap-1.5">
              <ScanLine className="h-4 w-4 animate-pulse" /> {MEAL_LABELS[active.meal]} session is live
            </p>
            <p className="mt-0.5 text-emerald-700 dark:text-emerald-400">
              {fmtHm(active.timing.start)} – {fmtHm(active.timing.end)} · Point your camera at the mess hall QR
            </p>
          </div>
          <button
            onClick={openCamera}
            className="shrink-0 inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white shadow-md hover:bg-emerald-700 active:scale-95 transition-all"
          >
            <Camera className="h-4 w-4" /> Scan QR
          </button>
        </div>
      )}

      {/* Meal grid */}
      <div className="grid grid-cols-4 gap-3">
        {MEAL_ORDER.map((meal) => {
          const s = mealState(meal);
          return (
            <div
              key={meal}
              className={`rounded-xl border p-3 text-center transition-all ${
                s.state === "recorded"
                  ? "border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/40"
                  : s.state === "missed"
                    ? "border-slate-200 bg-slate-50 opacity-60 dark:border-slate-800 dark:bg-slate-800/40"
                    : "border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-800/40"
              }`}
            >
              <p className="text-lg">{MEAL_EMOJIS[meal]}</p>
              <p className="mt-1 text-[11px] font-bold text-slate-900 dark:text-white">{MEAL_LABELS[meal]}</p>
              <p className="mt-1 flex items-center justify-center gap-1 text-[10px] font-semibold text-slate-500">
                {s.state === "recorded" && <CheckCircle2 className="h-3 w-3 text-emerald-600" />}
                {s.state === "missed" && <XCircle className="h-3 w-3 text-slate-400" />}
                {s.state === "pending" && <Clock className="h-3 w-3 text-slate-400" />}
                <span className={s.state === "recorded" ? "text-emerald-700 dark:text-emerald-300 font-bold" : ""}>
                  {s.state === "recorded" ? "Present" : s.note}
                </span>
              </p>
            </div>
          );
        })}
      </div>

      {/* Scan button (always available for demo / fallback) */}
      <button
        onClick={openCamera}
        className="mt-4 w-full rounded-xl border-2 border-dashed border-emerald-300 py-3 text-xs font-extrabold text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-300 dark:hover:bg-emerald-950/30 transition-colors flex items-center justify-center gap-2"
      >
        <Camera className="h-4 w-4" /> Open Camera to Scan Mess QR
      </button>

      {/* ==================== CAMERA MODAL ==================== */}
      {cameraOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-4 pb-safe overflow-y-auto">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl dark:bg-slate-900 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-slate-800">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Camera className="h-5 w-5 text-emerald-600" /> Scan Mess Hall QR
              </h3>
              <button onClick={closeCamera} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">
                <XCircle className="h-5 w-5" />
              </button>
            </div>

            {/* Camera viewfinder */}
            <div className="relative bg-black aspect-video flex items-center justify-center">
              {cameraLoading && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-white">
                  <Loader2 className="h-8 w-8 animate-spin" />
                  <p className="text-xs font-semibold">Requesting camera access…</p>
                </div>
              )}

              {cameraError && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center">
                  <VideoOff className="h-10 w-10 text-red-400" />
                  <p className="text-xs font-bold text-red-300">{cameraError}</p>
                </div>
              )}

              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={`w-full h-full object-cover ${cameraLoading || cameraError ? "hidden" : ""}`}
              />

              {/* Scanning frame overlay */}
              {!cameraError && !cameraLoading && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="w-56 h-56 rounded-2xl border-2 border-emerald-400/70 shadow-[0_0_0_9999px_rgba(0,0,0,0.4)]">
                    <div className="w-full h-full rounded-2xl relative">
                      <div className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-emerald-400 rounded-tl-lg" />
                      <div className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-emerald-400 rounded-tr-lg" />
                      <div className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-emerald-400 rounded-bl-lg" />
                      <div className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-emerald-400 rounded-br-lg" />
                    </div>
                  </div>
                </div>
              )}

              {/* Processing overlay */}
              {processing && (
                <div className="absolute inset-0 bg-emerald-900/60 flex items-center justify-center">
                  <div className="flex flex-col items-center gap-2 text-white">
                    <Loader2 className="h-8 w-8 animate-spin" />
                    <p className="text-sm font-bold">Recording attendance…</p>
                  </div>
                </div>
              )}

              {/* Success flash */}
              {verdict?.ok && (
                <div className="absolute inset-0 bg-emerald-600/80 flex items-center justify-center">
                  <div className="flex flex-col items-center gap-2 text-white">
                    <CheckCircle2 className="h-16 w-16" />
                    <p className="text-lg font-extrabold">{verdict.message}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Bottom area */}
            <div className="px-5 py-4 space-y-3">
              {verdict && !verdict.ok && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-bold text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
                  {verdict.message}
                </div>
              )}

              {active && (
                <p className="text-center text-[11px] text-slate-500">
                  Point your camera at the QR poster on the mess hall wall. The scan auto-detects and marks you present.
                </p>
              )}

              {/* Manual fallback */}
              <form onSubmit={handleManualSubmit} className="flex gap-2">
                <input
                  name="qr"
                  type="text"
                  placeholder={HOSTEL_MESS[hostel] || "Enter QR code manually"}
                  className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 font-mono text-xs dark:bg-slate-800 dark:border-slate-700"
                />
                <button
                  type="submit"
                  disabled={processing}
                  className="rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-60"
                >
                  {processing ? <Loader2 className="h-4 w-4 animate-spin" /> : "Submit"}
                </button>
              </form>

              {!hasBarcodeDetector && !cameraError && (
                <p className="text-center text-[10px] text-amber-600 dark:text-amber-400">
                  Auto-scan not supported on this browser — enter the QR payload manually.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};