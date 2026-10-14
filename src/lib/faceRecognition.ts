import * as faceapi from "face-api.js";
import type { DetectResult, LabeledFaceDescriptors } from "face-api.js";

/**
 * Client-side Face Recognition Service (FRS).
 *
 * Uses face-api.js (TensorFlow.js) running fully in the browser:
 *  - tiny_face_detector  -> locate faces
 *  - face_landmark_68    -> align faces
 *  - face_recognition    -> produce a 128-d descriptor per face
 *
 * Student enrollment stores a 128-d descriptor on the Student record
 * (`faceDescriptor`.label + `.encoding`). Live scans are matched against all
 * enrolled descriptors with an Euclidean distance threshold to identify the
 * correct student.
 */

export const MODEL_URI = "/models";

export const MATCH_THRESHOLD = 0.55;

let modelsLoaded = false;
let loadPromise: Promise<void> | null = null;

/** Load all recognition models exactly once (idempotent). */
export async function loadFaceModels(): Promise<void> {
  if (modelsLoaded) return;
  if (loadPromise) return loadPromise;
  loadPromise = (async () => {
    await Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URI),
      faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URI),
      faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URI),
    ]);
    modelsLoaded = true;
  })();
  return loadPromise;
}

export interface FaceEncoding {
  label: string;
  encoding: number[];
}

/** Extract the 128-d descriptor from an element (img / video / canvas / input). */
export async function extractDescriptor(
  input: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement | HTMLInputElement
): Promise<number[] | null> {
  await loadFaceModels();
  const result = await faceapi
    .detectSingleFace(input, new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.5 }))
    .withFaceLandmarks()
    .withFaceDescriptor();
  if (!result || !result.descriptor) return null;
  return Array.from(result.descriptor);
}

/** Detect every face in an image and return their boxed/video annotations. */
export async function detectAllFaces(
  input: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement
): Promise<DetectResult[]> {
  await loadFaceModels();
  return faceapi
    .detectAllFaces(input, new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.5 }))
    .withFaceLandmarks()
    .withFaceDescriptors();
}

/**
 * Enroll (or re-enroll) a face: extract a descriptor from the given element
 * and return a serializable { label, encoding } to persist on a student record.
 */
export async function enrollFace(
  input: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement,
  label: string
): Promise<FaceEncoding | null> {
  const descriptor = await extractDescriptor(input);
  if (!descriptor) return null;
  return { label, encoding: descriptor };
}

export interface MatchResult {
  label: string;
  distance: number;
}

/**
 * Match a live descriptor against a set of enrolled FaceEncodings and return
 * the best match that is closer than the threshold, or null if nobody matches.
 */
export async function matchDescriptor(
  descriptor: number[],
  enrolled: FaceEncoding[]
): Promise<MatchResult | null> {
  if (enrolled.length === 0) return null;
  await loadFaceModels();
  const labeled: LabeledFaceDescriptors[] = enrolled.map((e) => {
    return new faceapi.LabeledFaceDescriptors(e.label, [
      new Float32Array(e.encoding),
    ]);
  });
  const matcher = new faceapi.FaceMatcher(labeled, MATCH_THRESHOLD);
  const best = matcher.findBestMatch(new Float32Array(descriptor));
  if (!best || best.label === "unknown" || best.distance > MATCH_THRESHOLD) return null;
  return { label: best.label, distance: best.distance };
}

/** Compute the similarity confidence (0..1) from a match distance. */
export function similarity(distance: number): number {
  return Math.max(0, Math.min(1, 1 - distance));
}
