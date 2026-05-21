// Browser scanner pipeline.
//
// Given a list of File objects (from <input webkitdirectory>), this:
//  1. Filters to images + videos by extension
//  2. Computes SHA-256 for every file
//  3. Generates a thumbnail (images only)
//  4. Computes dHash (images only)
//  5. Heuristically classifies by path/filename
//  6. Builds exact + near duplicate groups
//
// Progress is reported via a callback so the UI can render a live status.

import { classifyExt, DECODABLE_IMAGE_EXTS, extOf } from "./extensions";
import { sha256OfBlob, dhashOfBlob, hamming } from "./hash";
import { makeThumb } from "./thumb";
import { classifyByPath } from "./classify";
import type { BrowserDuplicateGroup, BrowserMediaItem, ScanProgress } from "./types";

const HAMMING_THRESHOLD = 6;
const NEAR_WINDOW = 64;

interface InputFile extends File {
  webkitRelativePath: string;
}

export interface ScanOptions {
  files: FileList | File[];
  onProgress?: (p: ScanProgress) => void;
  signal?: AbortSignal;
  thumbnailLimitBytes?: number; // skip thumbnail for files larger than this; default 50 MB
}

export interface ScanResult {
  items: BrowserMediaItem[];
  duplicates: { exact: BrowserDuplicateGroup[]; near: BrowserDuplicateGroup[] };
  totalBytes: number;
}

function id(): string {
  return "m_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8);
}

export async function scan(opts: ScanOptions): Promise<ScanResult> {
  const allFiles: InputFile[] = Array.from(opts.files as FileList).filter((f): f is InputFile => {
    const ext = extOf(f.name);
    return classifyExt(ext) !== "UNKNOWN";
  });

  const startedAt = performance.now();
  const total = allFiles.length;
  const thumbCap = opts.thumbnailLimitBytes ?? 50 * 1024 * 1024;

  const emit = (phase: ScanProgress["phase"], scanned: number, current: string | null) => {
    opts.onProgress?.({
      phase,
      scanned,
      total,
      current,
      startedAt,
      elapsedMs: performance.now() - startedAt,
    });
  };

  emit("enumerating", 0, null);
  await microyield();

  const items: BrowserMediaItem[] = [];

  for (let i = 0; i < allFiles.length; i++) {
    if (opts.signal?.aborted) break;
    const f = allFiles[i]!;
    const ext = extOf(f.name);
    const kind = classifyExt(ext);
    const relativePath = f.webkitRelativePath || f.name;

    emit("hashing", i, relativePath);

    const sha = await sha256OfBlob(f).catch(() => "");
    if (!sha) {
      continue;
    }

    let dhash = "0000000000000000";
    let thumb: Awaited<ReturnType<typeof makeThumb>> = null;
    if (kind === "IMAGE" && DECODABLE_IMAGE_EXTS.has(ext) && f.size <= thumbCap) {
      dhash = await dhashOfBlob(f).catch(() => "0000000000000000");
      thumb = await makeThumb(f).catch(() => null);
    }

    const cls = classifyByPath(relativePath);

    items.push({
      id: id(),
      relativePath,
      filename: f.name,
      ext,
      mimeType: f.type || "",
      sizeBytes: f.size,
      lastModified: f.lastModified,
      kind,
      width: thumb?.width ?? null,
      height: thumb?.height ?? null,
      sha256: sha,
      dhash,
      thumbDataUrl: thumb?.dataUrl ?? null,
      category: cls.category,
      intent: cls.intent,
      categoryConfidence: cls.confidence,
    });

    if ((i & 7) === 0) await microyield();
  }

  emit("dedup", total, null);
  await microyield();
  const duplicates = buildDuplicateGroups(items);

  emit("done", total, null);
  const totalBytes = items.reduce((acc, it) => acc + it.sizeBytes, 0);
  return { items, duplicates, totalBytes };
}

function buildDuplicateGroups(items: BrowserMediaItem[]): { exact: BrowserDuplicateGroup[]; near: BrowserDuplicateGroup[] } {
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
    // Skip if it's just an exact-dup group already represented above.
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

function microyield(): Promise<void> {
  return new Promise((r) => setTimeout(r, 0));
}
