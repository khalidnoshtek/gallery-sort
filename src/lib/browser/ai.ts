// In-browser AI — CLIP semantic search + face detection/clustering.
//
// Models are loaded lazily on first use and cached in the browser. CLIP
// fetches from the Hugging Face CDN; face-api fetches from jsdelivr. The
// first call to each costs ~50-150MB of download. After that, the model
// lives in the browser's IndexedDB / OPFS and load is ~100ms.

import type { FaceRecord } from "./types";

// ─────────────────────────────────────────────────────────────────────
// CLIP — image + text embeddings
// ─────────────────────────────────────────────────────────────────────

type Tensor = { data: Float32Array | Float64Array | number[] };
interface ClipModels {
  // We intentionally keep these as `unknown` — the transformers.js types
  // are large and re-export awkwardly; we only use the call surfaces.
  tokenizer: (input: string | string[], opts?: Record<string, unknown>) => unknown;
  textModel: (inputs: unknown) => Promise<{ text_embeds: Tensor }>;
  processor: (input: unknown) => Promise<unknown>;
  visionModel: (inputs: unknown) => Promise<{ image_embeds: Tensor }>;
  RawImage: { fromBlob: (b: Blob) => Promise<unknown> };
}

let clipState: ClipModels | null = null;
let clipLoading: Promise<void> | null = null;

const CLIP_MODEL = "Xenova/clip-vit-base-patch32";

export async function loadClip(onProgress?: (msg: string) => void): Promise<void> {
  if (clipState) return;
  if (clipLoading) return clipLoading;
  clipLoading = (async () => {
    onProgress?.("Downloading CLIP model (~150 MB, one-time)…");
    const mod = await import("@huggingface/transformers");
    // env config: use CDN cache, browser cache
    if (mod.env) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const env = mod.env as any;
      env.allowLocalModels = false;
      env.useBrowserCache = true;
    }
    const [tokenizer, textModel, processor, visionModel] = await Promise.all([
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (mod as any).AutoTokenizer.from_pretrained(CLIP_MODEL),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (mod as any).CLIPTextModelWithProjection.from_pretrained(CLIP_MODEL),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (mod as any).AutoProcessor.from_pretrained(CLIP_MODEL),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (mod as any).CLIPVisionModelWithProjection.from_pretrained(CLIP_MODEL),
    ]);
    clipState = {
      tokenizer,
      textModel,
      processor,
      visionModel,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      RawImage: (mod as any).RawImage,
    } as ClipModels;
    onProgress?.("CLIP ready.");
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
  const inputs = clipState.tokenizer(text, { padding: true, truncation: true });
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
  // Vectors are L2-normalized so cosine = dot product.
  let dot = 0;
  const L = Math.min(a.length, b.length);
  for (let i = 0; i < L; i++) dot += a[i]! * b[i]!;
  return dot;
}

// ─────────────────────────────────────────────────────────────────────
// face-api — detect + 128-d descriptor
// ─────────────────────────────────────────────────────────────────────

let faceLoaded = false;
let faceLoading: Promise<void> | null = null;
const FACE_MODEL_URL = "https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.15/model";

export async function loadFaceApi(onProgress?: (msg: string) => void): Promise<void> {
  if (faceLoaded) return;
  if (faceLoading) return faceLoading;
  faceLoading = (async () => {
    onProgress?.("Loading face detection model (~6 MB)…");
    const faceapi = await import("@vladmandic/face-api");
    await faceapi.nets.tinyFaceDetector.loadFromUri(FACE_MODEL_URL);
    await faceapi.nets.faceLandmark68Net.loadFromUri(FACE_MODEL_URL);
    await faceapi.nets.faceRecognitionNet.loadFromUri(FACE_MODEL_URL);
    faceLoaded = true;
    onProgress?.("Face model ready.");
  })();
  return faceLoading;
}

export async function detectFaces(bitmap: ImageBitmap): Promise<FaceRecord[]> {
  await loadFaceApi();
  const faceapi = await import("@vladmandic/face-api");

  // face-api wants an HTMLCanvasElement (or HTMLImageElement) — OffscreenCanvas
  // is not always accepted across versions. Render to a real <canvas>.
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
// Clustering — union-find with L2 distance threshold
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
  // largest clusters first
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
