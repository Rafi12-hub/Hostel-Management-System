// Face security helpers for the Smart Hostel Security module.
//
// Layers on top of the existing faceRecognition FRS:
//  1. Enrollment: captures N samples, rejects poor quality / multiple-face
//     frames, averages the 128-d descriptors into ONE stored template.
//  2. Liveness (blink) challenge: verifies a physically-present person by
//     requiring an eye close/open transition. Blinking alone never identifies a
//     student — face matching + a valid gate pass are still required.
//  3. Identity verification: matches a live descriptor against enrolled
//     templates and returns the student.
//
// Only the template/label is persisted — raw photographs are never stored.

import * as faceapi from "face-api.js";
import type { FaceLandmarks } from "face-api.js";
import { loadFaceModels, type FaceEncoding } from "@/lib/faceRecognition";

export type LivenessState =
  | "init"
  | "no_face"
  | "multiple_faces"
  | "face_detected"
  | "blink_prompt"
  | "blink_detected"
  | "verified"
  | "failed";

export interface FrameAnalysis {
  states: LivenessState;
  faceCount: number;
  goodQuality: boolean;
  eyeOpenRatio: number | null;
}

// ---------------------------------------------------------------------------
// Landmark / eye helpers
// ---------------------------------------------------------------------------

type FacePoint = { x: number; y: number };

export interface EyePoints {
  left: FacePoint[];
  right: FacePoint[];
}

/** Extract the two eye contours from a 68-point landmark set. */
export function eyePoints(landmarks: FaceLandmarks): EyePoints {
  const positions = landmarks.positions;
  const p = (idx: number) => positions[idx];
  const right = [
    p(36), p(37), p(38), p(39), p(40), p(41),
  ];
  const left = [
    p(42), p(43), p(44), p(45), p(46), p(47),
  ];
  return { left, right };
}

function dist(a: FacePoint, b: FacePoint): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/**
 * Eye Aspect Ratio (use both eyes). Higher = more open. A blink drops this
 * value sharply (typically below ~0.18-0.22).
 */
export function eyeAspectRatio(landmarks: FaceLandmarks): number {
  const { left, right } = eyePoints(landmarks);

  const earEye = (pts: FacePoint[]) => {
    const v1 = dist(pts[1], pts[5]);
    const v2 = dist(pts[2], pts[4]);
    const h = dist(pts[0], pts[3]);
    return h === 0 ? 0 : (v1 + v2) / (2 * h);
  };
  return (earEye(left) + earEye(right)) / 2;
}

/** A naive vertical-distance eye openness ratio (0 closed .. >1 open). */
export function eyeOpenRatio(landmarks: FaceLandmarks): number {
  const { left, right } = eyePoints(landmarks);
  const ratioEye = (pts: FacePoint[]) => {
    const v1 = dist(pts[1], pts[5]);
    const v2 = dist(pts[2], pts[4]);
    const h = dist(pts[0], pts[3]);
    return h === 0 ? 0 : (v1 + v2) / (2 * h);
  };
  return (ratioEye(left) + ratioEye(right)) / 2;
}

export const EYE_OPEN_THRESHOLD = 0.22;
export const EYE_CLOSE_THRESHOLD = 0.16;

// ---------------------------------------------------------------------------
// Blink state machine
// ---------------------------------------------------------------------------

export class BlinkDetector {
  private readonly requiredBlinks: number;
  private sawOpen = false;
  private blinkCount = 0;
  lastEar: number | null = null;

  constructor(requiredBlinks = 1) {
    this.requiredBlinks = requiredBlinks;
  }

  /** Feed one analysed frame; returns TRUE the moment a blink completes. */
  update(ear: number | null): boolean {
    this.lastEar = ear;
    if (ear === null) return false;
    if (ear >= EYE_OPEN_THRESHOLD) {
      this.sawOpen = true;
      return false;
    }
    if (ear <= EYE_CLOSE_THRESHOLD && this.sawOpen) {
      this.blinkCount += 1;
      this.sawOpen = false;
      return this.blinkCount >= this.requiredBlinks;
    }
    return false;
  }

  get count(): number {
    return this.blinkCount;
  }

  reset(): void {
    this.sawOpen = false;
    this.blinkCount = 0;
  }
}

// ---------------------------------------------------------------------------
// Frame analysis / quality checks
// ---------------------------------------------------------------------------

export interface QualityReport {
  ok: boolean;
  reasons: string[];
  faceCount: number;
  magnitude: number | null;
  brightness: number | null;
}

function brightnessOf(canvas: HTMLCanvasElement): number {
  try {
    const ctx = canvas.getContext("2d");
    if (!ctx) return 100;
    const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
    let sum = 0;
    for (let i = 0; i < data.length; i += 4) {
      sum += (data[i] + data[i + 1] + data[i + 2]) / 3;
    }
    return sum / (data.length / 4);
  } catch {
    return 100;
  }
}

/**
 * Analyse a snapshot for enrollment:
 *  - exactly one face
 *  - face large enough (min width)
 *  - image not too dark (< 40) or blown out (> 245)
 *  - reasonable sharpness (grayscale Laplacian variance approximation)
 */
export async function analyseSnapshot(canvas: HTMLCanvasElement): Promise<QualityReport> {
  await loadFaceModels();
  const results = await faceapi
    .detectAllFaces(canvas, new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.5 }))
    .withFaceLandmarks()
    .withFaceDescriptors();

  const reasons: string[] = [];
  const faceCount = results.length;
  if (faceCount === 0) reasons.push("No face detected.");
  if (faceCount > 1) reasons.push("Multiple faces detected. Please ensure only you are in the frame.");

  let magnitude: number | null = null;
  if (results.length === 1) {
    const box = results[0].box;
    if (box.width < 80) reasons.push("Face is too small. Move closer to the camera.");
    if (box.width > 420) reasons.push("Face is too close. Move back a little.");

    const gr = results[0].score;
    if (gr < 0.5) reasons.push("Low face confidence. Try better lighting.");
  }

  // Sharpness via Laplacian variance (grayscale).
  try {
    const ctx = canvas.getContext("2d");
    if (ctx) {
      const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const gray = new Float32Array(width * height);
      for (let i = 0, j = 0; i < data.length; i += 4, j++) {
        gray[j] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      }
      let sum = 0;
      for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
          const idx = y * width + x;
          const px = gray[idx];
          const lap = 4 * px - gray[idx - 1] - gray[idx + 1] - gray[idx - width] - gray[idx + width];
          sum += lap * lap;
        }
      }
      const n = (width - 2) * (height - 2);
      magnitude = n ? Math.sqrt(sum / n) : 0;
      if (magnitude < 6) reasons.push("Image is blurry. Hold still and try again.");
    }
  } catch {
    /* ignore — sharpness is advisory */
  }

  const brightness = brightnessOf(canvas);
  if (brightness < 40) reasons.push("Too dark. Move to better lighting.");
  if (brightness > 245) reasons.push("Too bright. Avoid direct light on your face.");

  return { ok: reasons.length === 0 && faceCount === 1, reasons, faceCount, magnitude, brightness };
}

// ---------------------------------------------------------------------------
// Enrollment (multi-sample + averaged template)
// ---------------------------------------------------------------------------

export interface EnrollOptions {
  samples?: number; // 0 = capture every supplied canvas
  minGoodSamples?: number;
  label?: string;
}

export interface Enrollment {
  label: string;
  encoding: number[]; // averaged 128-d template
  samples: number[][]; // the good descriptors used
  sampleCount: number;
  enrolled_at: string;
  quality?: QualityReport[];
}

async function descriptorFromCanvas(canvas: HTMLCanvasElement): Promise<number[] | null> {
  const result = await faceapi
    .detectSingleFace(canvas, new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.5 }))
    .withFaceLandmarks()
    .withFaceDescriptor();
  return result?.descriptor ? Array.from(result.descriptor) : null;
}

function averageVectors(vectors: number[][]): number[] {
  const n = vectors.length;
  if (n === 0) return [];
  const dim = vectors[0].length;
  const avg = new Array<number>(dim).fill(0);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < dim; j++) avg[j] += vectors[i][j];
  }
  for (let j = 0; j < dim; j++) avg[j] /= n;
  // L2-normalise so matching behaves like fresh face-api descriptors.
  let norm = 0;
  for (let j = 0; j < dim; j++) norm += avg[j] * avg[j];
  norm = Math.sqrt(norm) || 1;
  for (let j = 0; j < dim; j++) avg[j] /= norm;
  return avg;
}

/**
 * Enroll from one or more captured canvases. Rejects each bad sample
 * individually; only good-quality, exactly-one-face samples contribute to the
 * averaged template.
 */
export async function enrollFromSnapshots(
  canvases: HTMLCanvasElement[],
  opts: EnrollOptions = {}
): Promise<{ enrollment: Enrollment | null; rejected: QualityReport[]; good: number }> {
  await loadFaceModels();
  const label = opts.label || "student";
  const goodDescriptors: number[][] = [];
  const rejected: QualityReport[] = [];

  for (const canvas of canvases) {
    const report = await analyseSnapshot(canvas);
    if (!report.ok) {
      rejected.push(report);
      continue;
    }
    const desc = await descriptorFromCanvas(canvas);
    if (!desc) {
      rejected.push({ ok: false, reasons: ["Could not extract a descriptor."], faceCount: 1, magnitude: null, brightness: null });
      continue;
    }
    goodDescriptors.push(desc);
  }

  const good = goodDescriptors.length;
  const minGood = opts.minGoodSamples ?? 1;
  if (good === 0 || good < minGood) {
    return { enrollment: null, rejected, good };
  }

  const encoding = averageVectors(goodDescriptors);
  const enrollment: Enrollment = {
    label,
    encoding,
    samples: goodDescriptors,
    sampleCount: good,
    enrolled_at: new Date().toISOString(),
  };
  return { enrollment, rejected, good };
}

/** Single-descriptor enrollment (matches the existing FaceEncoding shape). */
export async function enrollFromSingleSnapshot(
  canvas: HTMLCanvasElement,
  label: string
): Promise<{ template: FaceEncoding; report: QualityReport } | null> {
  const report = await analyseSnapshot(canvas);
  if (!report.ok) return null;
  const desc = await descriptorFromCanvas(canvas);
  if (!desc) return null;
  return { template: { label, encoding: desc }, report };
}

// ---------------------------------------------------------------------------
// Identity verification
// ---------------------------------------------------------------------------

/** Build the enrolled-template list from Student records. */
export function enrolledTemplatesFrom(students: any[]): FaceEncoding[] {
  const out: FaceEncoding[] = [];
  for (const s of students) {
    const tpl = s.faceDescriptor || s.face_embedding;
    if (tpl && tpl.label && Array.isArray(tpl.encoding) && tpl.encoding.length > 0) {
      out.push({ label: tpl.label, encoding: tpl.encoding });
    }
  }
  return out;
}

export interface IdentityVerdict {
  ok: boolean;
  student?: any;
  distance?: number;
  similarity?: number;
  error?: string;
}

/**
 * Match a live descriptor against all enrolled students. Returns the best
 * student if closer than the recognition threshold.
 */
export async function verifyIdentity(
  liveDescriptor: number[],
  students: any[],
  threshold = 0.55
): Promise<IdentityVerdict> {
  const templates = enrolledTemplatesFrom(students);
  if (templates.length === 0) {
    return { ok: false, error: "No students are enrolled for face recognition yet." };
  }
  const { matchDescriptor } = await import("@/lib/faceRecognition");
  const match = await matchDescriptor(liveDescriptor, templates);
  if (!match) {
    return { ok: false, error: "Identity not matched. Please try again." };
  }
  if (match.distance > threshold) {
    return { ok: false, error: "Identity not matched. Please try again." };
  }
  const student = students.find((s: any) => {
    const tpl = s.faceDescriptor || s.face_embedding;
    return tpl && tpl.label === match.label;
  });
  if (!student) {
    return { ok: false, error: "Enrolled template has no linked student." };
  }
  const similarity = Math.max(0, Math.min(1, 1 - match.distance));
  return { ok: true, student, distance: match.distance, similarity };
}

export interface FaceScanVerdict {
  ok: boolean;
  code: "FACE_VERIFIED" | "NO_FACE" | "MULTIPLE_FACES" | "NO_MATCH" | "NO_ENROLLMENT" | "ERROR";
  student?: any;
  descriptor?: number[];
  similarity?: number;
  error?: string;
}

/**
 * End-to-end face gate scan against a live canvas snapshot:
 * detects exactly one face, extracts a descriptor and matches it.
 * Liveness (blink) is performed separately by the UI flow.
 */
export async function scanFaceAgainst(canvas: HTMLCanvasElement, students: any[]): Promise<FaceScanVerdict> {
  try {
    const report = await analyseSnapshot(canvas);
    if (report.faceCount === 0) {
      return { ok: false, code: "NO_FACE", error: "No face detected. Please position yourself in the frame." };
    }
    if (report.faceCount > 1) {
      return { ok: false, code: "MULTIPLE_FACES", error: "Multiple faces detected." };
    }
    if (!report.ok) {
      return { ok: false, code: "ERROR", error: report.reasons.join(" ") };
    }
    const descriptor = await descriptorFromCanvas(canvas);
    if (!descriptor) {
      return { ok: false, code: "ERROR", error: "Could not extract a face template." };
    }
    const verdict = await verifyIdentity(descriptor, students);
    if (!verdict.ok || !verdict.student) {
      return { ok: false, code: verdict.error?.includes("enrolled") ? "NO_ENROLLMENT" : "NO_MATCH", student: undefined, descriptor, error: verdict.error };
    }
    return { ok: true, code: "FACE_VERIFIED", student: verdict.student, descriptor, similarity: verdict.similarity };
  } catch (err: any) {
    return { ok: false, code: "ERROR", error: err?.message || "Face verification failed." };
  }
}

// ---------------------------------------------------------------------------
// Liveness challenge runner used by the scanner UI
// ---------------------------------------------------------------------------

export function runBlinkLiveness(earHistory: (number | null)[], requiredBlinks = 1): { passed: boolean; blinks: number } {
  const detector = new BlinkDetector(requiredBlinks);
  for (const ear of earHistory) {
    detector.update(ear);
  }
  return { passed: detector.count >= requiredBlinks, blinks: detector.count };
}