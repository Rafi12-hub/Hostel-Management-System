declare module "face-api.js" {
  export const nets: {
    ssdMobilenetv1: {
      loadFromUri(uri: string): Promise<void>;
      loadFromDisk(path: string): Promise<void>;
      load(weightsOrUrl?: any): Promise<void>;
    };
    tinyFaceDetector: {
      loadFromUri(uri: string): Promise<void>;
      loadFromDisk(path: string): Promise<void>;
    };
    faceLandmark68Net: {
      loadFromUri(uri: string): Promise<void>;
      loadFromDisk(path: string): Promise<void>;
    };
    faceRecognitionNet: {
      loadFromUri(uri: string): Promise<void>;
      loadFromDisk(path: string): Promise<void>;
    };
  };

  export interface FaceDetection {
    box: {
      x: number;
      y: number;
      width: number;
      height: number;
    };
    score: number;
  }

  export interface FaceLandmarks {
    positions: Array<{ x: number; y: number }>;
  }

  export interface WithFaceLandmarks<T> extends FaceDetection {
    landmarks: FaceLandmarks;
  }

  export interface WithFaceDescriptor<T> extends WithFaceLandmarks<T> {
    descriptor: Float32Array;
  }

  export type DetectResult = WithFaceDescriptor<FaceDetection>;

  export interface TinyFaceDetectorOptionsInput {
    inputSize?: number;
    scoreThreshold?: number;
  }

  export class TinyFaceDetectorOptions {
    constructor(options?: TinyFaceDetectorOptionsInput);
  }

  export interface FaceMatcherResult {
    label: string;
    distance: number;
  }

  export class LabeledFaceDescriptors {
    constructor(label: string, descriptors: Array<Float32Array | number[]>);
  }

  export class FaceMatcher {
    constructor(
      labeledDescriptors: LabeledFaceDescriptors[],
      distanceThreshold?: number
    );
    findBestMatch(descriptor: Float32Array | number[]): FaceMatcherResult;
  }

  export function detectSingleFace(
    input: any,
    options?: TinyFaceDetectorOptions
  ): {
    withFaceLandmarks(): {
      withFaceDescriptor(): Promise<DetectResult | undefined>;
    };
  };

  export function detectAllFaces(
    input: any,
    options?: TinyFaceDetectorOptions
  ): {
    withFaceLandmarks(): {
      withFaceDescriptors(): Promise<DetectResult[]>;
    };
  };

  export function computeFaceDescriptor(
    input: any
  ): Promise<Float32Array | undefined>;

  export function euclideanDistance(
    a: ArrayLike<number>,
    b: ArrayLike<number>
  ): number;

  export const utils: {
    toNetInput(inputs: any[]): any;
  };
}
