// Orchestrates AI analysis across all scanned items. Lane-parallel where
// safe (CLIP is single-instance; we serialize). Reports progress.

import { clipEncodeImage, detectFaces, loadClip, loadFaceApi } from "./ai";
import type { BrowserMediaItem } from "./types";

interface InputItem {
  id: string;
  file?: File; // present when picked via showDirectoryPicker — we have the handle
  thumbDataUrl: string | null;
}

export interface AiPatch {
  id: string;
  clipEmbedding: number[] | null;
  faces: BrowserMediaItem["faces"];
}

export interface AiOptions {
  items: BrowserMediaItem[];
  getFile: (id: string) => Promise<File | null>;
  doFaces?: boolean;
  onProgress?: (s: { scanned: number; total: number; phase: string; current: string | null }) => void;
  signal?: AbortSignal;
}

export async function runAiAnalysis(opts: AiOptions): Promise<AiPatch[]> {
  const targets = opts.items.filter((i) => i.kind === "IMAGE");
  const total = targets.length;
  const patches: AiPatch[] = [];
  const doFaces = opts.doFaces ?? true;

  opts.onProgress?.({ scanned: 0, total, phase: "loading-clip", current: null });
  await loadClip((msg) => opts.onProgress?.({ scanned: 0, total, phase: msg, current: null }));
  if (doFaces) {
    opts.onProgress?.({ scanned: 0, total, phase: "loading-face", current: null });
    await loadFaceApi((msg) => opts.onProgress?.({ scanned: 0, total, phase: msg, current: null }));
  }

  for (let i = 0; i < targets.length; i++) {
    if (opts.signal?.aborted) break;
    const item = targets[i]!;
    opts.onProgress?.({ scanned: i, total, phase: "embedding", current: item.relativePath });

    const file = await opts.getFile(item.id);
    if (!file) {
      patches.push({ id: item.id, clipEmbedding: null, faces: [] });
      continue;
    }

    let clipEmbedding: number[] | null = null;
    let faces: BrowserMediaItem["faces"] = [];

    let bitmap: ImageBitmap | null = null;
    try {
      bitmap = await createImageBitmap(file).catch(() => null);
      if (bitmap) {
        try {
          clipEmbedding = await clipEncodeImage(bitmap);
        } catch {
          clipEmbedding = null;
        }
        if (doFaces) {
          try {
            faces = await detectFaces(bitmap);
          } catch {
            faces = [];
          }
        }
      }
    } finally {
      bitmap?.close?.();
    }

    patches.push({ id: item.id, clipEmbedding, faces });

    // Yield to the event loop so the UI stays responsive.
    if ((i & 1) === 0) await microyield();
  }

  opts.onProgress?.({ scanned: total, total, phase: "done", current: null });
  return patches;
}

function microyield(): Promise<void> {
  return new Promise((r) => setTimeout(r, 0));
}
