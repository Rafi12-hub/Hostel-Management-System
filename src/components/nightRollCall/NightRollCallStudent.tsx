import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Moon, CheckCircle2, KeyRound, Camera, Wifi, ShieldCheck, AlertTriangle, X, Loader, ScanFace } from "lucide-react";
import { useDemoAuth } from "@/context/DemoAuthContext";
import {
  subscribeCollection,
  createRecord,
} from "@/lib/firestore";
import { QRCode } from "@/components/ui/QRCode";
import { FaceRecognitionScanner } from "@/components/faceRecognition/FaceRecognitionScanner";
import {
  ensureNrcConfig,
  generateNrcToken,
  windowState,
  fmtTime,
  todayStr,
  getOrCreateSession,
  existingRecord,
  validateAndRecordCheckIn,
  dueReminderCode,
  reminderMeta,
  type NightRollCallConfig,
  type WindowState,
} from "@/lib/nightRollCall";

export const NightRollCallStudent: React.FC = () => {
  const { user } = useDemoAuth();
  const [config, setConfig] = useState<NightRollCallConfig | null>(null);
  const [records, setRecords] = useState<any[]>([]);
  const [gatePasses, setGatePasses] = useState<any[]>([]);
  const [leaves, setLeaves] = useState<any[]>([]);
  const [session, setSession] = useState<any>(null);
  const [window, setWindow] = useState<WindowState>("NOT_OPENED");
  const [record, setRecord] = useState<any>(null);
  const [exempt, setExempt] = useState<{ status: string; reason: string } | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  // token refreshed every tokenTtl minutes
  const [token, setToken] = useState<ReturnType<typeof generateNrcToken> | null>(null);
  const [tokenExpiry, setTokenExpiry] = useState<number | null>(null);
  const [countdown, setCountdown] = useState(0);

  const [codeInput, setCodeInput] = useState("");
  const [selfie, setSelfie] = useState<string | null>(null);
  const [networkOk, setNetworkOk] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [lateReason, setLateReason] = useState("");

  // FRS state: the logged-in student's own enrolled descriptor + live scan
  const [myStudent, setMyStudent] = useState<any>(null);
  const [frsScanning, setFrsScanning] = useState(false);
  const [frsMsg, setFrsMsg] = useState<{ ok: boolean; msg: string } | null>(null);

  const hostel = user?.hostel || "APJ Abdul Kalam Boys Hostel (BH-1)";

  const refreshToken = useCallback(
    (cfg: NightRollCallConfig) => {
      setToken(generateNrcToken((user?.name || "STUDENT").replace(/\s+/g, ""), cfg));
      setTokenExpiry(Date.now() + cfg.tokenTtlMinutes * 60 * 1000);
    },
    [user?.name]
  );

  useEffect(() => {
    let mounted = true;
    (async () => {
      const cfg = await ensureNrcConfig();
      if (!mounted) return;
      setConfig(cfg);
      refreshToken(cfg);
      setLoading(false);
    })();
    return () => {
      mounted = false;
    };
  }, [refreshToken]);

  // Poll token expiry so the QR/code rotates on schedule.
  useEffect(() => {
    if (!config) return;
    const interval = setInterval(() => {
      if (tokenExpiry && Date.now() >= tokenExpiry) refreshToken(config!);
      if (tokenExpiry) setCountdown(Math.max(0, Math.ceil((tokenExpiry - Date.now()) / 1000)));
    }, 1000);
    return () => clearInterval(interval);
  }, [config, tokenExpiry, refreshToken]);

  // Realtime subscriptions
  useEffect(() => {
    const unsubR = subscribeCollection("NightRollCallRecords", (d: any) => setRecords(d.filter((r: any) => String(r.studentId).trim().toUpperCase() === String(user?.studentId || "").trim().toUpperCase())));
    const unsubG = subscribeCollection("GatePass", setGatePasses);
    const unsubL = subscribeCollection("Leave", setLeaves);
    const unsubS = subscribeCollection("Student", (d: any) =>
      setMyStudent(d.find((s: any) => String(s.student_id).trim().toUpperCase() === String(user?.studentId || "").trim().toUpperCase()) || null)
    );
    return () => {
      unsubR();
      unsubG();
      unsubL();
      unsubS();
    };
  }, [user?.studentId]);

  // Face encoding for THIS student only - the FRS scanner only recognises the
  // logged-in resident, so a roll call can never be completed by another person.
  const myEnrolled = useMemo(
    () =>
      myStudent?.faceDescriptor?.encoding?.length
        ? [{ label: String(user?.studentId || "student"), encoding: myStudent.faceDescriptor.encoding }]
        : [],
    [myStudent, user?.studentId]
  );

  // Recompute status each second (window + record).
  useEffect(() => {
    const tick = () => {
      if (config) setWindow(windowState(config));
    };
    tick();
    const i = setInterval(tick, 1000);
    return () => clearInterval(i);
  }, [config]);

  // Auto in-app reminders at 15-min / 5-min / closing thresholds.
  useEffect(() => {
    if (!config) return;
    let dispatched = false;
    const tick = async () => {
      const code = dueReminderCode(config!, new Date());
      if (code && !dispatched && config!.enabled) {
        dispatched = true;
        const meta = reminderMeta(code);
        try {
          await createRecord("Notification", {
            type: meta.type,
            title: meta.title,
            message: meta.message,
            role: "student",
            recipient: user?.studentId || "student",
            read: false,
            timestamp: new Date().toISOString(),
          });
        } catch {
          /* noop */
        }
      }
    };
    tick();
    const i = setInterval(tick, 1000);
    return () => clearInterval(i);
  }, [config, user?.studentId]);

  const today = todayStr();
  const myRecord = record || records.find((r) => r.sessionId === session?.id && String(r.studentId).trim().toUpperCase() === String(user?.studentId || "").trim().toUpperCase());

  const windowsOpen = window === "OPEN" || window === "GRACE";
  const windowLabel =
    window === "NOT_OPENED" ? "Not open yet" :
    window === "OPEN" ? "Open" :
    window === "GRACE" ? "Late (grace)" : "Closed";

  const handleOpen = async () => {
    if (!config) return;
    const cfg = config;
    setResult(null);
    // Determine exemption from gate pass / leave
    const sid = (user?.studentId || "").trim().toUpperCase();
    const hasGate = gatePasses.find((g) => String(g.student_id).trim().toUpperCase() === sid && g.date === today && (g.status === "approved" || g.status === "exited"));
    const hasLeave = leaves.find((l) => String(l.student_id).trim().toUpperCase() === sid && l.status === "approved" && l.from_date <= today && l.to_date >= today);
    if (hasGate) {
      setExempt({ status: "OUTSIDE", reason: `Exited on gate pass ${hasGate.pass_id} (expected ${hasGate.expected_return})` });
    } else if (hasLeave) {
      setExempt({ status: "ON_LEAVE", reason: `Approved leave ${hasLeave.from_date} → ${hasLeave.to_date}` });
    } else {
      setExempt(null);
    }
    // Get / create session
    const sess = await getOrCreateSession(today, hostel, cfg, user?.name || "Student");
    setSession(sess);

    // Existing record for this session+student
    const ex = await existingRecord(sess.id, user?.studentId || "");
    setRecord(ex || null);
    setModalOpen(true);
    refreshToken(cfg);
  };

  const handleConfirm = async () => {
    if (!config || !session || submitting) return;
    setSubmitting(true);
    setResult(null);
    try {
      const w = windowState(config);
      const verdict = await validateAndRecordCheckIn({
        studentName: user?.name || "Student",
        studentId: user?.studentId || "",
        sessionId: session.id,
        config,
        submittedToken: exempt ? undefined : codeInput,
        expectedToken: token?.token || "",
        window: w,
        lateReason: lateReason,
        selfieUrl: selfie || undefined,
        networkVerified: networkOk,
        exemptStatus: exempt ? (exempt.status as any) : undefined,
        exemptReason: exempt?.reason,
      });
      if (verdict.ok && verdict.record) {
        setRecord(verdict.record as any);
        setResult({ ok: true, msg: "Night Roll Call completed successfully." });
        // Track activity + notification
        await createRecord("ActivityLog", {
          user: user?.name || "Student",
          role: "student",
          action: `Completed Night Roll Call (${verdict.status}) via ${verdict.record.verificationMethod}`,
          module: "NightRollCall",
          record: verdict.record.id,
          timestamp: new Date().toISOString(),
        });
      } else {
        setResult({ ok: false, msg: verdict.error || "Unable to complete roll call." });
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleExemptConfirm = async () => {
    if (!config || !session || !exempt || submitting) return;
    setSubmitting(true);
    setResult(null);
    try {
      const sess = session;
      const verdict = await validateAndRecordCheckIn({
        studentName: user?.name || "Student",
        studentId: user?.studentId || "",
        sessionId: sess.id,
        config,
        expectedToken: token?.token || "",
        window: windowState(config),
        selfieUrl: selfie || undefined,
        networkVerified: networkOk,
        exemptStatus: exempt.status as any,
        exemptReason: exempt.reason,
      });
      if (verdict.ok && verdict.record) {
        setRecord(verdict.record as any);
        setResult({ ok: true, msg: `Recorded as ${verdict.status}. You are exempt from roll call.` });
        await createRecord("ActivityLog", {
          user: user?.name || "Student",
          role: "student",
          action: `Marked ${verdict.status} for Night Roll Call (${exempt.reason})`,
          module: "NightRollCall",
          record: verdict.record.id,
          timestamp: new Date().toISOString(),
        });
      } else {
        setResult({ ok: false, msg: verdict.error || "Unable to record." });
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleFrIdentified = async (match: { label: string; distance: number; confidence: number }) => {
    setFrsScanning(false);
    const sid = (user?.studentId || "").trim().toUpperCase();
    if (String(match.label).trim().toUpperCase() !== sid) {
      setFrsMsg({ ok: false, msg: "The face detected does not match your registered FRS identity. Please try again." });
      return;
    }
    if (!config || !session || submitting) return;
    setSubmitting(true);
    setResult(null);
    try {
      const w = windowState(config);
      const verdict = await validateAndRecordCheckIn({
        studentName: user?.name || "Student",
        studentId: user?.studentId || "",
        sessionId: session.id,
        config,
        expectedToken: token?.token || "",
        window: w,
        lateReason,
        faceVerified: true,
        networkVerified: networkOk,
      });
      if (verdict.ok && verdict.record) {
        setRecord(verdict.record as any);
        setResult({ ok: true, msg: "FRS verified. Night Roll Call completed successfully." });
        await createRecord("ActivityLog", {
          user: user?.name || "Student",
          role: "student",
          action: `Completed Night Roll Call via Face Recognition (${(match.confidence * 100).toFixed(0)}% match)`,
          module: "NightRollCall",
          record: verdict.record.id,
          timestamp: new Date().toISOString(),
        });
      } else {
        setResult({ ok: false, msg: verdict.error || "Unable to complete roll call." });
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleCameraCapture = () => {
    // Prototype selfie: use a fixed sample image and record a timestamp.
    const stamp = Date.now();
    setSelfie(`https://api.qrserver.com/v1/create-qr-code/?size=0&data=snapshot_${accountSalt(user?.studentId || "")}_${stamp}`);
  };

  const simulatedNetwork = () => {
    setNetworkOk((v) => !v);
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-md dark:border-slate-800 dark:bg-slate-900">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
            <Moon className="h-6 w-6" />
          </div>
          <div>
            <h3 className="text-base font-extrabold text-slate-900 dark:text-white">Night Roll Call</h3>
            <p className="text-[11px] text-slate-500">{hostel}</p>
          </div>
        </div>
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-bold ${
            loading ? "bg-slate-100 text-slate-500" :
            window === "OPEN" ? "bg-emerald-100 text-emerald-700" :
            window === "GRACE" ? "bg-orange-100 text-orange-700" :
            window === "NOT_OPENED" ? "bg-amber-100 text-amber-700" :
            "bg-slate-200 text-slate-600"
          }`}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-current" /> {windowLabel}
        </span>
      </div>

      {/* Roll call window display */}
      <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-800/40">
        <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Roll Call Window</p>
        <p className="mt-1 text-sm font-extrabold text-slate-900 dark:text-white">
          {config ? `${formatHm(config.startTime)} – ${formatHm(config.endTime)}` : "…"}
        </p>
        {config && (
          <p className="mt-0.5 text-[10px] text-slate-400">Grace (late) until {formatHm(config.graceEndTime)}</p>
        )}
      </div>

      {/* Status body */}
      {myRecord ? (
        <div className="mt-5 flex items-center gap-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900 dark:bg-emerald-950/40">
          <CheckCircle2 className="h-9 w-9 text-emerald-600" />
          <div>
            <p className="text-sm font-extrabold text-emerald-900 dark:text-emerald-200">
              Night Roll Call {myRecord.status === "LATE" ? "Completed (Late)" : "Completed"}
            </p>
            <p className="text-xs text-emerald-700 dark:text-emerald-300">
              Time: {myRecord.completedAt ? new Date(myRecord.completedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : fmtTime()}
              {myRecord.status === "LATE" && myRecord.lateReason ? ` · Reason: ${myRecord.lateReason}` : ""}
            </p>
            <p className="text-[10px] text-emerald-700/70 dark:text-emerald-300/70 mt-0.5">
              Status: {myRecord.status} · Method: {myRecord.verificationMethod.replace(/_/g, " ")}
            </p>
          </div>
        </div>
      ) : exempt ? (
        <div className="mt-5 flex items-center justify-between gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4 dark:border-blue-900 dark:bg-blue-950/40">
          <div>
            <p className="text-sm font-extrabold text-blue-900 dark:text-blue-200">You are {exempt.status.replace(/_/g, " ")}</p>
            <p className="text-xs text-blue-700 dark:text-blue-300">{exempt.reason}</p>
          </div>
          <button
            onClick={() => { setResult(null); setModalOpen(true); }}
            className="shrink-0 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700"
          >
            {myRecord ? "View" : "Confirm Status"}
          </button>
        </div>
      ) : (
        <div className="mt-5 flex flex-col items-center gap-3">
          <p className="inline-flex items-center gap-2 rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            <AlertTriangle className="h-4 w-4 text-amber-500" /> NOT COMPLETED
          </p>
          <button
            onClick={handleOpen}
            disabled={!windowsOpen}
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-6 py-3 text-sm font-extrabold text-white shadow-md shadow-indigo-600/20 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Moon className="h-5 w-5" /> {window === "GRACE" ? "Complete Late Roll Call" : "Complete Night Roll Call"}
          </button>
          {!windowsOpen && (
            <p className="text-[11px] text-slate-400">
              {window === "NOT_OPENED" ? `Opens at ${config ? formatHm(config.startTime) : "21:30"}` : "Window has closed for tonight."}
            </p>
          )}
        </div>
      )}

      {/* Completion modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/60 backdrop-blur-sm p-4 pb-safe overflow-y-auto sm:items-center">
          <div className="w-full max-w-lg my-8 rounded-2xl bg-white p-6 shadow-2xl sm:my-8 dark:bg-slate-900 space-y-5 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                {exempt ? "Confirm Roll Call Status" : "Complete Night Roll Call"}
              </h3>
              <button onClick={() => setModalOpen(false)} className="text-slate-400"><X className="h-5 w-5" /></button>
            </div>

            {/* Step 1: exemption message */}
            {exempt ? (
              <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-xs text-blue-800 dark:border-blue-900 dark:bg-blue-950/50 dark:text-blue-200">
                <p className="font-bold flex items-center gap-2"><ShieldCheck className="h-4 w-4" /> Automatically Exempt</p>
                <p className="mt-1">Your status has been auto-classified as <b>{exempt.status.replace(/_/g, " ")}</b>. You are not required to complete a physical roll call.</p>
              </div>
            ) : (
              <>
                {/* Face Recognition (FRS) - the night roll call biometric */}
                <div className={`rounded-xl border p-4 dark:border-slate-800 ${myEnrolled.length > 0 ? "border-indigo-200 bg-indigo-50/60 dark:bg-indigo-950/30" : "border-amber-200 bg-amber-50/60 dark:bg-amber-950/30"}`}>
                  <p className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <ScanFace className={`h-4 w-4 ${myEnrolled.length > 0 ? "text-indigo-600 dark:text-indigo-400" : "text-amber-500"}`} />
                    Complete with Face Recognition (FRS)
                  </p>

                  {myEnrolled.length > 0 ? (
                    <>
                      {!frsScanning && !myRecord && (
                        <button
                          onClick={() => { setFrsMsg(null); setFrsScanning(true); }}
                          className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 py-2 text-xs font-bold text-white hover:bg-indigo-700"
                        >
                          <ScanFace className="h-4 w-4" /> Scan My Face (FRS)
                        </button>
                      )}
                      {frsScanning && (
                        <div className="mt-2">
                          <FaceRecognitionScanner
                            enrolled={myEnrolled}
                            onIdentified={handleFrIdentified}
                            onClose={() => setFrsScanning(false)}
                          />
                        </div>
                      )}
                      {frsMsg && (
                        <div className={`mt-2 rounded-lg border px-3 py-2 text-[11px] font-bold ${frsMsg.ok ? "bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-950/40" : "bg-red-50 border-red-200 text-red-700 dark:bg-red-950/40"}`}>
                          {frsMsg.msg}
                        </div>
                      )}
                      {!frsScanning && !frsMsg && (
                        <p className="mt-2 text-[10px] text-slate-500">
                          Only <b>YOUR</b> enrolled face is recognised here — the scanner never matches other students, so the roll call can only be completed for yourself.
                        </p>
                      )}
                    </>
                  ) : (
                    <p className="mt-2 text-[11px] font-semibold text-amber-800 dark:text-amber-300">
                      Your face is not registered for FRS yet. Visit the Warden&apos;s office for your first-time FRS registration, then you can check in with your face.
                    </p>
                  )}
                </div>

                {/* OR divider */}
                <div className="flex items-center gap-2">
                  <span className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
                  <span className="text-[10px] font-bold text-slate-400">OR USE QR / CODE</span>
                  <span className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
                </div>

                {/* Token display */}
                <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800/50">
                  <div className="flex flex-col items-center gap-3">
                    <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Dynamic Night Roll Call QR</p>
                    <QRCode value={token?.qrPayload || "ROLLCALL"} size={150} />
                    <p className="font-mono text-xs font-bold text-indigo-600 dark:text-indigo-400">{token?.qrPayload}</p>
                    <p className="text-[10px] text-slate-400">
                      {tokenExpiry ? `Rotates in ${countdown}s` : "Refreshing…"}
                    </p>
                  </div>
                </div>

                {/* OR code entry */}
                <div className="flex items-center gap-2">
                  <span className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
                  <span className="text-[10px] font-bold text-slate-400">OR</span>
                  <span className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1.5">
                    <KeyRound className="h-3.5 w-3.5" /> Enter Night Roll Call Code
                  </label>
                  <input
                    type="text"
                    value={codeInput}
                    onChange={(e) => setCodeInput(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    placeholder="847291"
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 p-3 text-center text-lg font-mono tracking-widest text-slate-900 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                  <p className="mt-1 text-[10px] text-slate-400">Single-use, time-limited code. Expires automatically.</p>
                </div>

                {/* Optional selfie */}
                <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
                  <p className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <Camera className="h-4 w-4" /> Live Selfie (optional)
                  </p>
                  <button
                    onClick={handleCameraCapture}
                    className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200"
                  >
                    <Camera className="h-3.5 w-3.5" /> {selfie ? "Retake Selfie" : "Open Camera"}
                  </button>
                  {selfie && (
                    <p className="mt-1 text-[10px] text-emerald-600 font-semibold">✓ Selfie captured (prototype).</p>
                  )}
                </div>

                {/* Optional wifi */}
                <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-700 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Wifi className="h-4 w-4 text-indigo-600" />
                    <p className="text-xs font-bold text-slate-700 dark:text-slate-300">Hostel Network ({config?.wifiSsid})</p>
                  </div>
                  <button
                    onClick={simulatedNetwork}
                    className={`rounded-lg px-3 py-1 text-[11px] font-bold ${networkOk ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"}`}
                  >
                    {networkOk ? "Connected" : "Verify"}
                  </button>
                </div>
              </>
            )}

            {result && (
              <div className={`rounded-xl border p-3 text-xs font-bold ${result.ok ? "bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-950/40" : "bg-red-50 border-red-200 text-red-700 dark:bg-red-950/40"}`}>
                {result.msg}
              </div>
            )}

            {/* Grace / late reason */}
            {!exempt && window === "GRACE" && !myRecord && (
              <div>
                <label className="block text-xs font-bold text-orange-600 dark:text-orange-300 mb-1">Why were you late? *</label>
                <textarea
                  rows={2}
                  value={lateReason}
                  onChange={(e) => setLateReason(e.target.value)}
                  placeholder="Required for late roll call"
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>
            )}

            {!myRecord && (
              <button
                onClick={exempt ? handleExemptConfirm : handleConfirm}
                disabled={submitting || (!exempt && !codeInput.trim())}
                className="w-full rounded-xl bg-indigo-600 py-3 text-xs font-extrabold text-white shadow-md hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {submitting ? <Loader className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                {exempt ? "Confirm My Status" : "Complete Night Roll Call"}
              </button>
            )}
            {myRecord && (
              <button onClick={() => setModalOpen(false)} className="w-full rounded-xl bg-slate-100 py-3 text-xs font-bold text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200">
                Close
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

function formatHm(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${String(hour12).padStart(2, "0")}:${String(m).padStart(2, "0")} ${ampm}`;
}

function accountSalt(s: string): string {
  return (s || "student").replace(/[^A-Za-z0-9]/g, "").slice(0, 8);
}
