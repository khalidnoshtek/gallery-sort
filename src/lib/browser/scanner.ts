// Browser scanner pipeline — lane-parallel + decode-once.
//
// Two ingest paths:
//   1. <input webkitdirectory> → FileList (read-only, all browsers)
//   2. window.showDirectoryPicker → walks the FileSystemDirectoryHandle
//      to produce both File objects AND file handles for later moves/
//      deletes. (Chromium / Safari 16+.)

import { classifyExt, DECODABLE_IMAGE_EXTS, extOf } from "./extensions";
import { sha256OfBlob, computeDHashFromBitmap, hamming } from "./hash";
import { makeThumbFromBitmap } from "./thumb";
import { computeQualityFromBitmap } from "./quality";
import { classifyByPath } from "./classify";
import { fsHandles } from "./handles";
import type { BrowserDuplicateGroup, BrowserMediaItem, ScanProgress } from "./types";

const HAMMING_THRESHOLD = 6;
const NEAR_WINDOW = 64;
const PROGRESS_HZ = 20;
const PROGRESS_INTERVAL_MS = 1000 / PROGRESS_HZ;

export interface ScanInput {
  file: File;
  relativePath: string;
  /** Parent directory handle — present only when picked via showDirectoryPicker. */
  parentDirHandle?: FileSystemDirectoryHandle;
}

export interface ScanOptions {
  inputs: ScanInput[];
  onProgress?: (p: ScanProgress) => void;
  signal?: AbortSignal;
  thumbnailLimitBytes?: number;
  concurrency?: number;
}

export interface ScanResult {
  items: BrowserMediaItem[];
  duplicates: { exact: BrowserDuplicateGroup[]; near: BrowserDuplicateGroup[] };
  totalBytes: number;
}

function id(): string {
  return "m_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8);
}

async function processInput(
  input: ScanInput,
  thumbCap: number,
): Promise<BrowserMediaItem | null> {
  const f = input.file;
  const ext = extOf(f.name);
  const kind = classifyExt(ext);
  const relativePath = input.relativePath;
  const isImage = kind === "IMAGE" && DECODABLE_IMAGE_EXTS.has(ext);
  const allowVisual = isImage && f.size <= thumbCap;

  let sha: string;
  let dhash = "0000000000000000";
  let thumbDataUrl: string | null = null;
  let width: number | null = null;
  let height: number | null = null;
  let qualityScore: number | null = null;
  let brightness: number | null = null;
  let colorVariance: number | null = null;

  if (allowVisual) {
    const [shaResult, bitmap] = await Promise.all([
      sha256OfBlob(f).catch(() => ""),
      createImageBitmap(f).catch(() => null),
    ]);
    sha = shaResult;
    if (bitmap) {
      width = bitmap.width;
      height = bitmap.height;
      dhash = computeDHashFromBitmap(bitmap);
      const quality = computeQualityFromBitmap(bitmap);
      if (quality) {
        qualityScore = quality.blurScore;
        brightness = quality.brightness;
        colorVariance = quality.colorVariance;
      }
      const t = await makeThumbFromBitmap(bitmap).catch(() => null);
      if (t) thumbDataUrl = t.dataUrl;
      bitmap.close?.();
    }
  } else {
    sha = await sha256OfBlob(f).catch(() => "");
  }

  if (!sha) return null;

  const cls = classifyByPath(relativePath);
  const itemId = id();

  // Store the file handle for later trash/delete operations.
  if (input.parentDirHandle) {
    fsHandles.setFile(itemId, input.parentDirHandle, f.name);
  }

  return {
    id: itemId,
    relativePath,
    filename: f.name,
    ext,
    mimeType: f.type || "",
    sizeBytes: f.size,
    lastModified: f.lastModified,
    kind,
    width,
    height,
    sha256: sha,
    dhash,
    thumbDataUrl,
    category: cls.category,
    intent: cls.intent,
    categoryConfidence: cls.confidence,
    qualityScore,
    brightness,
    colorVariance,
    clipEmbedding: null,
    faces: null,
  };
}

export async function scan(opts: ScanOptions): Promise<ScanResult> {
  const inputs = opts.inputs.filter((i) => classifyExt(extOf(i.file.name)) !== "UNKNOWN");

  const startedAt = performance.now();
  const total = inputs.length;
  const thumbCap = opts.thumbnailLimitBytes ?? 50 * 1024 * 1024;
  const cpuCount = typeof navigator !== "undefined" ? navigator.hardwareConcurrency ?? 4 : 4;
  const lanes = Math.max(2, Math.min(opts.concurrency ?? cpuCount * 2, 12));

  let lastEmit = 0;
  const emit = (phase: ScanProgress["phase"], scanned: number, current: string | null, force = false) => {
    const now = performance.now();
    if (!force && now - lastEmit < PROGRESS_INTERVAL_MS) return;
    lastEmit = now;
    opts.onProgress?.({
      phase,
      scanned,
      total,
      current,
      startedAt,
      elapsedMs: now - startedAt,
    });
  };

  emit("enumerating", 0, null, true);

  const items = new Array<BrowserMediaItem | null>(inputs.length).fill(null);
  let scanned = 0;
  let nextIdx = 0;

  const runLane = async () => {
    while (true) {
      if (opts.signal?.aborted) return;
      const idx = nextIdx++;
      if (idx >= inputs.length) return;
      const inp = inputs[idx]!;
      items[idx] = await processInput(inp, thumbCap);
      scanned++;
      emit("hashing", scanned, inp.relativePath);
    }
  };

  await Promise.all(Array.from({ length: lanes }, () => runLane()));

  emit("dedup", total, null, true);
  const final = items.filter((x): x is BrowserMediaItem => x !== null);
  const duplicates = buildDuplicateGroups(final);

  emit("done", total, null, true);
  const totalBytes = final.reduce((acc, it) => acc + it.sizeBytes, 0);
  return { items: final, duplicates, totalBytes };
}

function buildDuplicateGroups(items: BrowserMediaItem[]): {
  exact: BrowserDuplicateGroup[];
  near: BrowserDuplicateGroup[];
} {
  const byHash = new Map<string, BrowserMediaItem[]>();
  for (const it of items) {
    if (!byHash.has(it.sha256)) byHash.set(it.sha256, []);
    byHash.get(it.sha256)!.push(it);
  }
  const exact: BrowserDuplicateGroup[] = [];
  for (const [, members] of byHash) {
    if (members.length < 2) continue;
    const best = pickBest(members);
    const totalBytes = members.reduce((a, m) => a + m.sizeBytes, 0);
    exact.push({
      id: "dg_e_" + members[0]!.sha256.slice(0, 12),
      kind: "EXACT",
      memberIds: members.map((m) => m.id),
      bestId: best.id,
      totalBytes,
      recoverableBytes: totalBytes - best.sizeBytes,
    });
  }

  const imageItems = items.filter((i) => i.kind === "IMAGE" && i.dhash !== "0000000000000000");
  const sorted = [...imageItems].sort((a, b) => (a.dhash < b.dhash ? -1 : a.dhash > b.dhash ? 1 : 0));
  const parent = new Map<string, string>();
  const find = (x: string): string => {
    let p = parent.get(x) ?? x;
    while (p !== (parent.get(p) ?? p)) p = parent.get(p) ?? p;
    parent.set(x, p);
    return p;
  };
  const union = (a: string, b: string) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent.set(ra, rb);
  };
  for (let i = 0; i < sorted.length; i++) {
    const a = sorted[i]!;
    for (let j = i + 1; j < Math.min(sorted.length, i + NEAR_WINDOW); j++) {
      const b = sorted[j]!;
      if (a.sha256 === b.sha256) continue;
      const d = hamming(a.dhash, b.dhash);
      if (d <= HAMMING_THRESHOLD) union(a.id, b.id);
    }
  }
  const clusters = new Map<string, BrowserMediaItem[]>();
  for (const it of sorted) {
    const root = find(it.id);
    if (!clusters.has(root)) clusters.set(root, []);
    clusters.get(root)!.push(it);
  }
  const near: BrowserDuplicateGroup[] = [];
  for (const cluster of clusters.values()) {
    if (cluster.length < 2) continue;
    const allSameSha = cluster.every((c) => c.sha256 === cluster[0]!.sha256);
    if (allSameSha) continue;
    const best = pickBest(cluster);
    const totalBytes = cluster.reduce((a, m) => a + m.sizeBytes, 0);
    near.push({
      id: "dg_n_" + best.id.slice(2, 12),
      kind: "NEAR",
      memberIds: cluster.map((m) => m.id),
      bestId: best.id,
      totalBytes,
      recoverableBytes: totalBytes - best.sizeBytes,
    });
  }

  return { exact, near };
}

function pickBest(members: BrowserMediaItem[]): BrowserMediaItem {
  return [...members]
    .map((m) => ({
      m,
      score:
        (m.width && m.height ? m.width * m.height : 0) +
        m.sizeBytes * 0.0001 +
        (m.relativePath.match(/DCIM|Camera/i) ? 1_000_000 : 0) -
        (m.relativePath.match(/WhatsApp|Sent|Copy/i) ? 500_000 : 0),
    }))
    .sort((a, b) => b.score - a.score)[0]!.m;
}
