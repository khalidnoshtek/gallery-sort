// Orchestrates AI analysis across all scanned items.

import { clipEncodeImage, detectFaces, loadClip, loadFaceApi, type AiLogger } from "./ai";
import type { BrowserMediaItem } from "./types";

export interface AiPatch {
  id: string;
  clipEmbedding: number[] | null;
  faces: BrowserMediaItem["faces"];
}

export interface AiOptions {
  items: BrowserMediaItem[];
  getFile: (id: string) => Promise<File | null>;
  doFaces?: boolean;
  onProgress?: (s: { scanned: number; total: number; phase: string; current: string | null; errors: number }) => void;
  onLog?: AiLogger;
  signal?: AbortSignal;
}

export async function runAiAnalysis(opts: AiOptions): Promise<AiPatch[]> {
  const log: AiLogger = opts.onLog ?? ((msg) => console.log("[lumen-ai]", msg));
  const targets = opts.items.filter((i) => i.kind === "IMAGE");
  const total = targets.length;
  const patches: AiPatch[] = [];
  const doFaces = opts.doFaces ?? true;
  let errors = 0;

  log(`Starting AI analysis on ${total} image(s)`);
  opts.onProgress?.({ scanned: 0, total, phase: "loading CLIP model", current: null, errors });
  await loadClip(log);
  if (doFaces) {
    opts.onProgress?.({ scanned: 0, total, phase: "loading face model", current: null, errors });
    await loadFaceApi(log);
  }

  const startedAt = performance.now();
  for (let i = 0; i < targets.length; i++) {
    if (opts.signal?.aborted) {
      log(`Cancelled at ${i}/${total}`);
      break;
    }
    const item = targets[i]!;
    opts.onProgress?.({ scanned: i, total, phase: "encoding", current: item.relativePath, errors });

    const file = await opts.getFile(item.id);
    if (!file) {
      log(`Skipping ${item.relativePath}: no file handle (was the folder picked read-only?)`, "warn");
      patches.push({ id: item.id, clipEmbedding: null, faces: [] });
      errors++;
      continue;
    }

    let clipEmbedding: number[] | null = null;
    let faces: BrowserMediaItem["faces"] = [];

    let bitmap: ImageBitmap | null = null;
    try {
      bitmap = await createImageBitmap(file).catch((e) => {
        log(`createImageBitmap failed for ${item.relativePath}: ${e}`, "warn");
        return null;
      });
      if (bitmap) {
        try {
          clipEmbedding = await clipEncodeImage(bitmap);
        } catch (err) {
          log(`CLIP encode failed for ${item.relativePath}: ${err}`, "warn");
          clipEmbedding = null;
          errors++;
        }
        if (doFaces) {
          try {
            faces = await detectFaces(bitmap);
            if (faces.length > 0 && i % 50 === 0) {
              log(`${item.relativePath}: detected ${faces.length} face(s)`);
            }
          } catch (err) {
            log(`Face detection failed for ${item.relativePath}: ${err}`, "warn");
            faces = [];
            errors++;
          }
        }
      } else {
        errors++;
      }
    } finally {
      bitmap?.close?.();
    }

    patches.push({ id: item.id, clipEmbedding, faces });

    if ((i & 1) === 0) await microyield();
    if (i % 50 === 0 && i > 0) {
      const rate = (i / ((performance.now() - startedAt) / 1000)).toFixed(2);
      log(`Progress: ${i}/${total} (${rate} img/s · ${errors} errors)`);
    }
  }

  const elapsed = ((performance.now() - startedAt) / 1000).toFixed(1);
  const embedded = patches.filter((p) => p.clipEmbedding !== null).length;
  const totalFaces = patches.reduce((a, p) => a + (p.faces?.length ?? 0), 0);
  log(`Done in ${elapsed}s · ${embedded} embeddings · ${totalFaces} faces · ${errors} errors`);

  opts.onProgress?.({ scanned: total, total, phase: "done", current: null, errors });
  return patches;
}

function microyield(): Promise<void> {
  return new Promise((r) => setTimeout(r, 0));
}
