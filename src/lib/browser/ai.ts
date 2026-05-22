// In-browser AI — CLIP semantic search + face detection/clustering.

import type { FaceRecord } from "./types";

// ─────────────────────────────────────────────────────────────────────
// CLIP
// ─────────────────────────────────────────────────────────────────────

type Tensor = { data: Float32Array | Float64Array | number[] };
interface ClipModels {
  tokenizer: (input: string | string[], opts?: Record<string, unknown>) => unknown;
  textModel: (inputs: unknown) => Promise<{ text_embeds: Tensor }>;
  processor: (input: unknown) => Promise<unknown>;
  visionModel: (inputs: unknown) => Promise<{ image_embeds: Tensor }>;
  RawImage: { fromBlob: (b: Blob) => Promise<unknown> };
}

let clipState: ClipModels | null = null;
let clipLoading: Promise<void> | null = null;

const CLIP_MODEL = "Xenova/clip-vit-base-patch32";

export type AiLogger = (msg: string, kind?: "info" | "warn" | "error") => void;

const consoleLogger: AiLogger = (msg, kind = "info") => {
  const prefix = "[lumen-ai]";
  if (kind === "error") console.error(prefix, msg);
  else if (kind === "warn") console.warn(prefix, msg);
  else console.log(prefix, msg);
};

export async function loadClip(log: AiLogger = consoleLogger): Promise<void> {
  if (clipState) {
    log("CLIP already loaded");
    return;
  }
  if (clipLoading) {
    log("CLIP load already in progress, waiting…");
    return clipLoading;
  }
  clipLoading = (async () => {
    try {
      log("Importing @huggingface/transformers (this can take a moment first time)…");
      const mod = await import("@huggingface/transformers");
      log(`transformers imported. exports: ${Object.keys(mod).slice(0, 8).join(", ")}…`);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const env = (mod as any).env;
      if (env) {
        env.allowLocalModels = false;
        env.useBrowserCache = true;
      }
      log(`Downloading ${CLIP_MODEL} (~150 MB total, cached after)…`);
      const start = performance.now();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const M = mod as any;
      const tokenizer = await M.AutoTokenizer.from_pretrained(CLIP_MODEL);
      log("✓ Tokenizer loaded");
      const processor = await M.AutoProcessor.from_pretrained(CLIP_MODEL);
      log("✓ Processor loaded");
      const textModel = await M.CLIPTextModelWithProjection.from_pretrained(CLIP_MODEL);
      log("✓ Text encoder loaded");
      const visionModel = await M.CLIPVisionModelWithProjection.from_pretrained(CLIP_MODEL);
      log("✓ Vision encoder loaded");
      clipState = {
        tokenizer,
        textModel,
        processor,
        visionModel,
        RawImage: M.RawImage,
      } as ClipModels;
      log(`CLIP ready in ${((performance.now() - start) / 1000).toFixed(1)}s`);
    } catch (err) {
      clipLoading = null;
      const msg = err instanceof Error ? err.message : String(err);
      log(`CLIP load FAILED: ${msg}`, "error");
      throw err;
    }
  })();
  return clipLoading;
}

export async function clipEncodeImage(bitmap: ImageBitmap): Promise<number[]> {
  await loadClip();
  if (!clipState) throw new Error("CLIP not loaded");
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no 2d ctx");
  ctx.drawImage(bitmap, 0, 0);
  const blob = await canvas.convertToBlob();
  const rawImage = await clipState.RawImage.fromBlob(blob);
  const inputs = await clipState.processor(rawImage);
  const { image_embeds } = await clipState.visionModel(inputs);
  return l2Normalize(Array.from(image_embeds.data) as number[]);
}

export async function clipEncodeText(text: string): Promise<number[]> {
  await loadClip();
  if (!clipState) throw new Error("CLIP not loaded");
  // The tokenizer expects an array of strings for the text path
  const inputs = clipState.tokenizer([text], { padding: true, truncation: true });
  const { text_embeds } = await clipState.textModel(inputs);
  return l2Normalize(Array.from(text_embeds.data) as number[]);
}

function l2Normalize(v: number[]): number[] {
  let s = 0;
  for (const x of v) s += x * x;
  const n = Math.sqrt(s) || 1;
  return v.map((x) => x / n);
}

export function cosineSim(a: number[], b: number[]): number {
  let dot = 0;
  const L = Math.min(a.length, b.length);
  for (let i = 0; i < L; i++) dot += a[i]! * b[i]!;
  return dot;
}

// ─────────────────────────────────────────────────────────────────────
// face-api
// ─────────────────────────────────────────────────────────────────────

let faceLoaded = false;
let faceLoading: Promise<void> | null = null;
const FACE_MODEL_URL = "https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.15/model";

export async function loadFaceApi(log: AiLogger = consoleLogger): Promise<void> {
  if (faceLoaded) {
    log("face-api already loaded");
    return;
  }
  if (faceLoading) {
    log("face-api load in progress, waiting…");
    return faceLoading;
  }
  faceLoading = (async () => {
    try {
      log("Importing @vladmandic/face-api…");
      const faceapi = await import("@vladmandic/face-api");
      log(`Downloading face models from jsdelivr CDN…`);
      await faceapi.nets.tinyFaceDetector.loadFromUri(FACE_MODEL_URL);
      log("✓ Tiny face detector loaded");
      await faceapi.nets.faceLandmark68Net.loadFromUri(FACE_MODEL_URL);
      log("✓ Face landmarks loaded");
      await faceapi.nets.faceRecognitionNet.loadFromUri(FACE_MODEL_URL);
      log("✓ Face recognition loaded");
      faceLoaded = true;
      log("face-api ready");
    } catch (err) {
      faceLoading = null;
      const msg = err instanceof Error ? err.message : String(err);
      log(`face-api load FAILED: ${msg}`, "error");
      throw err;
    }
  })();
  return faceLoading;
}

export async function detectFaces(bitmap: ImageBitmap): Promise<FaceRecord[]> {
  await loadFaceApi();
  const faceapi = await import("@vladmandic/face-api");

  const c = document.createElement("canvas");
  c.width = bitmap.width;
  c.height = bitmap.height;
  const ctx = c.getContext("2d");
  if (!ctx) return [];
  ctx.drawImage(bitmap, 0, 0);

  const results = await faceapi
    .detectAllFaces(c, new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.5 }))
    .withFaceLandmarks()
    .withFaceDescriptors();

  return results.map((r) => ({
    x: Math.round(r.detection.box.x),
    y: Math.round(r.detection.box.y),
    w: Math.round(r.detection.box.width),
    h: Math.round(r.detection.box.height),
    descriptor: Array.from(r.descriptor),
  }));
}

// ─────────────────────────────────────────────────────────────────────
// Face clustering
// ─────────────────────────────────────────────────────────────────────

interface FaceRef {
  itemId: string;
  faceIdx: number;
  descriptor: number[];
}

export interface RawCluster {
  representativeItemId: string;
  representativeFaceIdx: number;
  members: Array<{ itemId: string; faceIdx: number }>;
}

const FACE_EPS = 0.55;

export function clusterFaces(faces: FaceRef[]): RawCluster[] {
  const n = faces.length;
  if (n === 0) return [];
  const parent = new Int32Array(n);
  for (let i = 0; i < n; i++) parent[i] = i;
  const find = (x: number): number => {
    while (parent[x] !== x) {
      parent[x] = parent[parent[x]!]!;
      x = parent[x]!;
    }
    return x;
  };
  const union = (a: number, b: number) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent[ra] = rb;
  };

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const d = l2(faces[i]!.descriptor, faces[j]!.descriptor);
      if (d < FACE_EPS) union(i, j);
    }
  }

  const groups = new Map<number, number[]>();
  for (let i = 0; i < n; i++) {
    const r = find(i);
    if (!groups.has(r)) groups.set(r, []);
    groups.get(r)!.push(i);
  }

  const clusters: RawCluster[] = [];
  for (const [, idxs] of groups) {
    if (idxs.length < 2) continue;
    const first = faces[idxs[0]!]!;
    clusters.push({
      representativeItemId: first.itemId,
      representativeFaceIdx: first.faceIdx,
      members: idxs.map((i) => ({ itemId: faces[i]!.itemId, faceIdx: faces[i]!.faceIdx })),
    });
  }
  clusters.sort((a, b) => b.members.length - a.members.length);
  return clusters;
}

function l2(a: number[], b: number[]): number {
  let s = 0;
  const L = Math.min(a.length, b.length);
  for (let i = 0; i < L; i++) {
    const d = a[i]! - b[i]!;
    s += d * d;
  }
  return Math.sqrt(s);
}
