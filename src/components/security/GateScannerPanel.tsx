import React, { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, ScanLine, SwitchCamera, RefreshCw, ShieldCheck, Fingerprint, Wifi, WifiOff } from "lucide-react";
import { filterCollection } from "@/lib/firestore";
import {
  verifyGatePassToken,
  processGateTransaction,
  logFailedAttempt,
  type GatePassVerdict,
  type GateTransactionResult,
  type GateAction,
} from "@/lib/gateService";
import { verifyIdentity } from "@/lib/faceSecurity";
import { QRScanner } from "@/components/security/QRScanner";
import { LivenessCheck } from "@/components/security/LivenessCheck";
import { VerificationResult, type GateVerificationSummary } from "@/components/security/VerificationResult";

type ScannerMode = "qr" | "face_and_qr" | "face_only";
type ScannerPhase = "mode" | "qr" | "face" | "processing" | "result";

const DEFAULT_GATE_ID = "main-gate-1";
const DEFAULT_GATE_NAME = "Main Security Gate 1";

/**
 * Security desk gate scanner.
 *
 * Pipeline (face_and_qr mode):
 *  1) Scan pass QR          -> opaque token -> verifyGatePassToken()
 *  2) Compute the expected action from pass state (approved -> EXIT, exited -> ENTRY)
 *  3) Liveness (blink) + identity (face match)
 *  4) processGateTransaction() atomically records the txn, logs it append-only
 *     and queues the parent WhatsApp notification.
 *
 * A QR by itself is never enough; a face match (or explicit staff fallback)
 * must confirm the pass holder, and an invalid pass can NEVER be overridden by
 * face recognition.
 */
export const GateScannerPanel: React.FC<{
  securityUser?: { name?: string; id?: string };
  gateId?: string;
  gateName?: string;
  className?: string;
}> = ({ securityUser, gateId = DEFAULT_GATE_ID, gateName = DEFAULT_GATE_NAME, className = "" }) => {
  const [phase, setPhase] = useState<ScannerPhase>("mode");
  const [mode, setMode] = useState<ScannerMode>("face_and_qr");
  const [ready, setReady] = useState(false);

  const [students, setStudents] = useState<any[]>([]);
  const [verdict, setVerdict] = useState<GatePassVerdict | null>(null);
  const [result, setResult] = useState<GateVerificationSummary | null>(null);
  const [busy, setBusy] = useState(false);
  const [pendingAction, setPendingAction] = useState<GateAction | null>(null);

  const processingRef = useRef(false);

  // Load enrolled students once.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const studentsData = await filterCollection("Student", () => true);
        if (cancelled) return;
        setStudents(studentsData.filter((s) => s.face_enrolled || s.faceDescriptor));
        setReady(true);
      } catch {
        setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const reset = useCallback(() => {
    setVerdict(null);
    setResult(null);
    setBusy(false);
    setPendingAction(null);
    processingRef.current = false;
    setPhase("mode");
  }, []);

  const finalizeTransfer = useCallback(
    async (action: GateAction, v: GatePassVerdict, descriptor: number[] | null) => {
    if (processingRef.current) return;
    processingRef.current = true;
    setPhase("processing");

    let matchedStudent: any = v.student;
    let matchScore: number | undefined;

    // Face mode: identity must confirm the pass holder; it never overrides an
    // invalid pass (already checked via verifyGatePassToken).
    if (descriptor) {
      const identity = await verifyIdentity(descriptor, students);
      if (!identity.ok || !identity.student) {
        await logFailedAttempt({
          studentId: v.student?.student_id,
          studentName: v.student?.name,
          passNumber: v.pass?.pass_number,
          gateId,
          action,
          verificationMethod: mode === "face_and_qr" ? "FACE_AND_QR" : "FACE",
          faceMatchStatus: "FAILED",
          livenessStatus: "SUCCESS",
          securityUserId: securityUser?.id,
          securityUserName: securityUser?.name,
          remarks: identity.error || "Face identity did not match",
        }).catch(() => {});
        setResult({
          kind: "blocked",
          title: "Face identity does not match",
          message: "The person at the gate does not match the enrolled face for this gate pass.",
          studentName: v.student?.name,
          studentId: v.student?.student_id,
          room: v.student?.room,
          gate: gateName,
          action,
          reason: identity.error || "No matching enrolled face",
        });
        setPhase("result");
        processingRef.current = false;
        return;
      }
      matchedStudent = identity.student;
      matchScore = identity.similarity;

      const enrolledLabel = v.student.faceDescriptor?.label || "";
      const matchedLabel = identity.student.faceDescriptor?.label || "";
      if (enrolledLabel && matchedLabel && enrolledLabel !== matchedLabel && enrolledLabel !== String(identity.student.student_id || "").toUpperCase()) {
        await logFailedAttempt({
          studentId: v.student?.student_id,
          studentName: v.student?.name,
          passNumber: v.pass?.pass_number,
          gateId,
          action,
          verificationMethod: "FACE_AND_QR",
          faceMatchStatus: "FAILED",
          livenessStatus: "SUCCESS",
          securityUserId: securityUser?.id,
          securityUserName: securityUser?.name,
          remarks: "Face matched a different student than the pass holder",
        }).catch(() => {});
        setResult({
          kind: "blocked",
          title: "Identity mismatch",
          message: "The face at the gate belongs to a different student than this gate pass.",
          studentName: v.student?.name,
          studentId: v.student?.student_id,
          room: v.student?.room,
          gate: gateName,
          action,
          reason: "Face verified a different student",
        });
        setPhase("result");
        processingRef.current = false;
        return;
      }
    }

    const txn: GateTransactionResult = await processGateTransaction({
      action,
      passId: v.pass?.id,
      passNumber: v.pass?.pass_number,
      studentId: matchedStudent.student_id || matchedStudent.studentId,
      studentName: matchedStudent.name,
      gateId,
      gateName,
      verificationMethod: descriptor ? (mode === "face_and_qr" ? "FACE_AND_QR" : "FACE") : "QR",
      faceMatchStatus: descriptor ? "SUCCESS" : "NOT_USED",
      livenessStatus: descriptor ? "SUCCESS" : "NOT_USED",
      securityUserId: securityUser?.id,
      securityUserName: securityUser?.name,
      deviceInfo: "Gate Scanner Panel",
    });

    if (txn.ok) {
      setResult({
        kind: "success",
        title: action === "EXIT" ? "Exit recorded" : "Entry recorded",
        message: txn.message,
        studentName: txn.student?.name || matchedStudent.name,
        studentId: txn.student?.student_id || matchedStudent.student_id,
        room: txn.student?.room,
        gate: gateName,
        action,
        time: new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }),
        matchScore,
      });
    } else {
      await logFailedAttempt({
        studentId: matchedStudent.student_id || matchedStudent.studentId,
        studentName: matchedStudent.name,
        passNumber: v.pass?.pass_number,
        gateId,
        action,
        verificationMethod: descriptor ? (mode === "face_and_qr" ? "FACE_AND_QR" : "FACE") : "QR",
        faceMatchStatus: descriptor ? "SUCCESS" : "NOT_USED",
        livenessStatus: descriptor ? "SUCCESS" : "NOT_USED",
        securityUserId: securityUser?.id,
        securityUserName: securityUser?.name,
        remarks: txn.message,
      }).catch(() => {});
      setResult({
        kind: "blocked",
        title: action === "EXIT" ? "Exit blocked" : "Entry blocked",
        message: txn.message,
        studentName: matchedStudent.name,
        studentId: matchedStudent.student_id,
        room: matchedStudent.room,
        gate: gateName,
        action,
        reason: txn.message,
      });
    }
    setPhase("result");
    processingRef.current = false;
  }, [mode, students, gateId, gateName, securityUser?.id, securityUser?.name]);

  const handleFaceVerified = useCallback(
    (descriptor: number[]) => {
      if (!verdict || !pendingAction) return;
      void finalizeTransfer(pendingAction, verdict, descriptor);
    },
    [verdict, pendingAction, finalizeTransfer]
  );

  const handleQrDecoded = useCallback(
    async (payload: string) => {
      if (processingRef.current || busy) return;
      setBusy(true);
      setPhase("processing");
      try {
        const v = await verifyGatePassToken(payload);
        setVerdict(v);
        if (!v.ok || !v.pass || !v.student) {
          await logFailedAttempt({
            studentId: v.student?.student_id || "",
            studentName: v.student?.name || "",
            passNumber: "",
            gateId,
            action: "EXIT",
            verificationMethod: "QR",
            faceMatchStatus: "NOT_USED",
            livenessStatus: "NOT_USED",
            securityUserId: securityUser?.id,
            securityUserName: securityUser?.name,
            remarks: v.error || "QR verification failed",
          }).catch(() => {});
          setResult({
            kind: v.code === "EXPIRED" || v.code === "CANCELLED" || v.code === "REJECTED" ? "blocked" : "error",
            title:
              v.code === "EXPIRED"
                ? "Gate pass expired"
                : v.code === "CANCELLED"
                  ? "Gate pass cancelled"
                  : v.code === "REJECTED"
                    ? "Gate pass rejected"
                    : "Invalid gate pass",
            message: v.error || "This gate pass could not be verified.",
            reason: v.error,
          });
          setPhase("result");
          return;
        }

        // Decide expected action from the pass state.
        const status = String(v.pass.status || "").toLowerCase();
        const action: GateAction = status === "exited" || status === "overdue" ? "ENTRY" : "EXIT";
        setPendingAction(action);

        if (mode === "qr") {
          await finalizeTransfer(action, v, null);
        } else {
          setPhase("face");
        }
      } finally {
        setBusy(false);
        processingRef.current = false;
      }
    },
    [busy, gateId, mode, securityUser?.id, securityUser?.name, finalizeTransfer]
  );

  return (
    <div className={`mx-auto w-full max-w-lg space-y-4 ${className}`}>
      {/* Header: mode + status */}
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-bold text-slate-900 dark:text-white">Gate Scanner</h2>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-bold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
          {navigator.onLine ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
          {navigator.onLine ? "Online" : "Offline"}
        </span>
      </div>

      {ready && !busy && students.length === 0 && mode !== "qr" && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs font-semibold text-amber-700 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
          <Fingerprint className="mr-1.5 inline h-4 w-4" />
          No student has enrolled a face yet. Face scanning will not work — use QR-only mode or enroll faces first.
        </div>
      )}

      {/* Phase: choose mode */}
      {phase === "mode" && (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {(
              [
                { key: "face_and_qr", label: "Face + QR", desc: "Full security", icon: ShieldCheck },
                { key: "qr", label: "QR only", desc: "Fast desk", icon: ScanLine },
                { key: "face_only", label: "Face only", desc: "Standalone", icon: Fingerprint },
              ] as const
            ).map((m) => (
              <button
                key={m.key}
                onClick={() => setMode(m.key)}
                className={`rounded-2xl border-2 bg-white p-4 text-left shadow-card transition dark:bg-slate-900 ${
                  mode === m.key
                    ? "border-indigo-500 dark:border-indigo-600"
                    : "border-slate-200 hover:border-indigo-300 dark:border-slate-800"
                }`}
              >
                <m.icon className={`h-6 w-6 ${mode === m.key ? "text-indigo-600" : "text-slate-400"}`} />
                <p className="mt-2 text-sm font-bold text-slate-900 dark:text-white">{m.label}</p>
                <p className="text-[11px] font-semibold text-slate-400">{m.desc}</p>
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 rounded-xl bg-indigo-50 p-3 text-xs font-semibold text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300">
            <SwitchCamera className="h-4 w-4 shrink-0" />
            {mode === "face_and_qr" && "Scan the pass QR, the student blinks once, then the transaction is recorded."}
            {mode === "qr" && "Scan the pass QR to record the transaction (no identity check)."}
            {mode === "face_only" && "Liveness + face match; can't be used for gate passes (needs a QR / pass)."}
          </div>

          <button
            onClick={() => {
              if (mode === "face_only") {
                setVerdict(null);
                setPendingAction(pendingAction || "EXIT");
                setPhase("face");
              } else {
                setPhase("qr");
              }
            }}
            className="w-full rounded-xl bg-indigo-600 px-4 py-3.5 text-sm font-bold text-white transition hover:bg-indigo-700"
          >
            {mode === "face_and_qr" ? "Start Face + QR scan" : mode === "qr" ? "Start QR scan" : "Start face scan"}
          </button>
        </>
      )}

      {/* Phase: QR */}
      {phase === "qr" && (
        <div className="space-y-3">
          {busy ? (
            <div className="flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white p-8 text-sm font-semibold text-slate-500 dark:border-slate-800 dark:bg-slate-900">
              <Loader2 className="h-5 w-5 animate-spin text-indigo-600" />
              Verifying QR…
            </div>
          ) : (
            <QRScanner
              onDecoded={(payload) => void handleQrDecoded(payload)}
              onFail={(msg) => {
                setResult({
                  kind: "error",
                  title: "Camera unavailable",
                  message: msg || "Unable to start the camera.",
                  reason: msg,
                });
                setPhase("result");
              }}
            />
          )}
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-semibold text-slate-400">{gateName}</p>
            <button
              onClick={() => setPhase("mode")}
              className="inline-flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-slate-700 dark:text-slate-400"
            >
              <RefreshCw className="h-3.5 w-3.5" /> Change mode
            </button>
          </div>
        </div>
      )}

      {/* Phase: face */}
      {phase === "face" && (
        <div className="space-y-3">
          {ready && !busy ? (
            <div className="space-y-2">
              <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/60">
                <p className="text-xs font-bold text-slate-700 dark:text-slate-200">
                  {pendingAction === "EXIT" ? "EXIT verification" : "ENTRY verification"} · {gateName}
                </p>
                <p className="mt-1 text-[11px] font-semibold text-slate-400">
                  {verdict?.student?.name ? `Pass holder: ${verdict.student.name} (${verdict.student.student_id || ""})` : "Face-only scan — look at the camera and blink once."}
                </p>
              </div>
              <LivenessCheck
                onVerified={handleFaceVerified}
                onFail={(msg) => {
                  setResult({
                    kind: "blocked",
                    title: "Liveness check failed",
                    message: msg || "Liveness could not be confirmed.",
                    studentName: verdict?.student?.name,
                    studentId: verdict?.student?.student_id,
                    gate: gateName,
                    action: pendingAction || "EXIT",
                    reason: msg,
                  });
                  setPhase("result");
                }}
                onCancel={() => setPhase("mode")}
              />
            </div>
          ) : (
            <div className="flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white p-8 text-sm font-semibold text-slate-500 dark:border-slate-800 dark:bg-slate-900">
              <Loader2 className="h-5 w-5 animate-spin text-indigo-600" />
              Loading…
            </div>
          )}
        </div>
      )}

      {/* Phase: processing */}
      {phase === "processing" && (
        <div className="flex items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-white p-10 dark:border-slate-800 dark:bg-slate-900">
          <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
          <p className="text-sm font-bold text-slate-600 dark:text-slate-300">Recording gate transaction…</p>
        </div>
      )}

      {/* Phase: result */}
      {phase === "result" && result && <VerificationResult result={result} onReset={reset} />}
    </div>
  );
};