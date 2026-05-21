import path from "node:path";
import { fs } from "../fs";
import { IGNORE_DIRS, IGNORE_FILE_PREFIXES, classifyExt } from "./extensions";
import { logger } from "../logger";

export interface FoundFile {
  path: string;
  filename: string;
  ext: string;
  kind: "IMAGE" | "VIDEO" | "UNKNOWN";
  size: number;
  mtime: Date;
  ctime: Date;
  inode?: number;
}

export interface WalkOptions {
  onBatch: (batch: FoundFile[]) => Promise<void> | void;
  batchSize?: number;
  signal?: AbortSignal;
  onProgress?: (state: { scanned: number; matched: number; currentDir: string }) => void;
}

export async function walk(root: string, opts: WalkOptions): Promise<{ matched: number; scanned: number }> {
  const batchSize = opts.batchSize ?? 200;
  const buf: FoundFile[] = [];
  let matched = 0;
  let scanned = 0;

  const adapter = fs();

  const stack: string[] = [path.resolve(root)];
  while (stack.length > 0) {
    if (opts.signal?.aborted) break;
    const dir = stack.pop()!;
    let entries;
    try {
      entries = await adapter.readDir(dir);
    } catch (err) {
      logger.warn({ dir, err: String(err) }, "skipping unreadable dir");
      continue;
    }
    opts.onProgress?.({ scanned, matched, currentDir: dir });

    for (const e of entries) {
      scanned++;
      if (e.isDirectory) {
        if (IGNORE_DIRS.has(e.name)) continue;
        if (e.isSymbolicLink) continue; // avoid loops
        stack.push(e.path);
        continue;
      }
      if (!e.isFile) continue;
      if (IGNORE_FILE_PREFIXES.some((p) => e.name.startsWith(p))) continue;

      const ext = path.extname(e.name);
      const kind = classifyExt(ext);
      if (kind === "UNKNOWN") continue;

      let stat;
      try {
        stat = await adapter.stat(e.path);
      } catch {
        continue;
      }
      if (!stat.isFile) continue;

      matched++;
      buf.push({
        path: e.path,
        filename: e.name,
        ext,
        kind,
        size: stat.size,
        mtime: stat.mtime,
        ctime: stat.ctime,
        inode: stat.inode,
      });
      if (buf.length >= batchSize) {
        await opts.onBatch(buf.splice(0, buf.length));
      }
    }
  }

  if (buf.length > 0) await opts.onBatch(buf);
  return { matched, scanned };
}
