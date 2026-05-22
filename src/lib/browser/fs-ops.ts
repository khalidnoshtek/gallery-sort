// Destructive filesystem operations + the in-app trash browser.

import { fsHandles } from "./handles";
import type { BrowserMediaItem } from "./types";

export interface OpResult {
  ok: string[];
  failed: Array<{ id: string; reason: string }>;
  trashFolder?: string;
}

async function ensurePermission(handle: FileSystemDirectoryHandle): Promise<boolean> {
  if (!handle.queryPermission || !handle.requestPermission) return true;
  const current = await handle.queryPermission({ mode: "readwrite" });
  if (current === "granted") return true;
  const requested = await handle.requestPermission({ mode: "readwrite" });
  return requested === "granted";
}

async function uniqueFilename(dir: FileSystemDirectoryHandle, name: string): Promise<string> {
  let candidate = name;
  let i = 1;
  while (true) {
    try {
      await dir.getFileHandle(candidate);
      const dot = name.lastIndexOf(".");
      const base = dot > 0 ? name.slice(0, dot) : name;
      const ext = dot > 0 ? name.slice(dot) : "";
      candidate = `${base} (${i})${ext}`;
      i++;
    } catch {
      return candidate;
    }
  }
}

async function getOrCreateDir(root: FileSystemDirectoryHandle, parts: string[]): Promise<FileSystemDirectoryHandle> {
  let cur = root;
  for (const part of parts) {
    if (!part) continue;
    cur = await cur.getDirectoryHandle(part, { create: true });
  }
  return cur;
}

const TRASH_ROOT_NAME = ".lumen-trash";

// ─────────────────────────────────────────────────────────────────────
// Move staged items into .lumen-trash/<timestamp>/<relativePath>
// Preserves the original folder structure inside the dated bucket so
// restore can put each file back exactly where it came from.
// ─────────────────────────────────────────────────────────────────────

export async function moveToLibraryTrash(items: BrowserMediaItem[]): Promise<OpResult> {
  const root = fsHandles.getRoot();
  if (!root) {
    return { ok: [], failed: items.map((i) => ({ id: i.id, reason: "no library root handle" })) };
  }
  const granted = await ensurePermission(root);
  if (!granted) {
    return { ok: [], failed: items.map((i) => ({ id: i.id, reason: "write permission denied" })) };
  }

  const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const trashRoot = await root.getDirectoryHandle(TRASH_ROOT_NAME, { create: true });
  const trashDated = await trashRoot.getDirectoryHandle(ts, { create: true });

  const ok: string[] = [];
  const failed: OpResult["failed"] = [];

  for (const item of items) {
    const h = fsHandles.get(item.id);
    if (!h) {
      failed.push({ id: item.id, reason: "no file handle" });
      continue;
    }
    try {
      const srcHandle = await h.parentDir.getFileHandle(h.filename);
      const file = await srcHandle.getFile();

      // Mirror the relative path of the original inside the trash bucket.
      // e.g. "Photos/2024/foo.jpg" → ".lumen-trash/<ts>/Photos/2024/foo.jpg"
      const segments = item.relativePath.split("/").filter(Boolean);
      const filename = segments.pop()!;
      const dst = segments.length > 0 ? await getOrCreateDir(trashDated, segments) : trashDated;
      const targetName = await uniqueFilename(dst, filename);
      const dstHandle = await dst.getFileHandle(targetName, { create: true });
      const writable = await dstHandle.createWritable();
      await writable.write(file);
      await writable.close();

      // Verify
      const verify = await dstHandle.getFile();
      if (verify.size !== file.size) {
        await dst.removeEntry(targetName).catch(() => {});
        throw new Error(`verify failed (${verify.size} != ${file.size})`);
      }

      await h.parentDir.removeEntry(h.filename);
      ok.push(item.id);
    } catch (err) {
      failed.push({ id: item.id, reason: err instanceof Error ? err.message : String(err) });
    }
  }

  return { ok, failed, trashFolder: `${TRASH_ROOT_NAME}/${ts}` };
}

export async function deletePermanently(items: BrowserMediaItem[]): Promise<OpResult> {
  const root = fsHandles.getRoot();
  if (root) {
    const granted = await ensurePermission(root);
    if (!granted) {
      return { ok: [], failed: items.map((i) => ({ id: i.id, reason: "write permission denied" })) };
    }
  }
  const ok: string[] = [];
  const failed: OpResult["failed"] = [];
  for (const item of items) {
    const h = fsHandles.get(item.id);
    if (!h) {
      failed.push({ id: item.id, reason: "no file handle" });
      continue;
    }
    try {
      await h.parentDir.removeEntry(h.filename);
      ok.push(item.id);
    } catch (err) {
      failed.push({ id: item.id, reason: err instanceof Error ? err.message : String(err) });
    }
  }
  return { ok, failed };
}

// ─────────────────────────────────────────────────────────────────────
// In-app trash browser — walk .lumen-trash/<ts>/<relativePath>
// ─────────────────────────────────────────────────────────────────────

export interface TrashEntry {
  /** Stable key for React lists */
  id: string;
  /** "<ts>" — the dated bucket */
  bucket: string;
  /** Full relative path inside the dated bucket — also the original path */
  relativePath: string;
  /** Filename only */
  filename: string;
  sizeBytes: number;
  lastModified: number;
  /** Where this file's bytes live now */
  parentDirHandle: FileSystemDirectoryHandle;
  /** Bucket root, for restoring (we need to climb back to library root) */
  bucketHandle: FileSystemDirectoryHandle;
}

export async function browseTrash(): Promise<TrashEntry[]> {
  const root = fsHandles.getRoot();
  if (!root) return [];
  let trashRoot: FileSystemDirectoryHandle;
  try {
    trashRoot = await root.getDirectoryHandle(TRASH_ROOT_NAME);
  } catch {
    return []; // no trash folder yet
  }

  const entries: TrashEntry[] = [];

  // For each dated bucket
  // @ts-expect-error entries() not always typed
  for await (const [bucketName, bucketHandle] of trashRoot.entries()) {
    if ((bucketHandle as FileSystemHandle).kind !== "directory") continue;
    const bucket = bucketHandle as FileSystemDirectoryHandle;
    await walkBucket(bucket, bucket, bucketName, "", entries);
  }

  // Newest bucket first
  entries.sort((a, b) => {
    if (a.bucket !== b.bucket) return a.bucket < b.bucket ? 1 : -1;
    return a.relativePath.localeCompare(b.relativePath);
  });

  return entries;
}

async function walkBucket(
  bucketRoot: FileSystemDirectoryHandle,
  current: FileSystemDirectoryHandle,
  bucketName: string,
  prefix: string,
  out: TrashEntry[],
): Promise<void> {
  // @ts-expect-error
  for await (const [name, entry] of current.entries()) {
    const path = prefix ? `${prefix}/${name}` : name;
    if (entry.kind === "file") {
      try {
        const file = await (entry as FileSystemFileHandle).getFile();
        out.push({
          id: `${bucketName}::${path}`,
          bucket: bucketName,
          relativePath: path,
          filename: name,
          sizeBytes: file.size,
          lastModified: file.lastModified,
          parentDirHandle: current,
          bucketHandle: bucketRoot,
        });
      } catch {
        // skip unreadable
      }
    } else if (entry.kind === "directory") {
      await walkBucket(bucketRoot, entry as FileSystemDirectoryHandle, bucketName, path, out);
    }
  }
}

export async function readTrashEntryFile(entry: TrashEntry): Promise<File | null> {
  try {
    const fh = await entry.parentDirHandle.getFileHandle(entry.filename);
    return await fh.getFile();
  } catch {
    return null;
  }
}

export interface TrashOpResult {
  ok: string[];
  failed: Array<{ id: string; reason: string }>;
}

/** Move trash entries back to their original locations. */
export async function restoreTrashEntries(entries: TrashEntry[]): Promise<TrashOpResult> {
  const root = fsHandles.getRoot();
  if (!root) {
    return { ok: [], failed: entries.map((e) => ({ id: e.id, reason: "no library root handle" })) };
  }
  const granted = await ensurePermission(root);
  if (!granted) {
    return { ok: [], failed: entries.map((e) => ({ id: e.id, reason: "write permission denied" })) };
  }

  const ok: string[] = [];
  const failed: TrashOpResult["failed"] = [];

  for (const entry of entries) {
    try {
      // Read from trash
      const srcHandle = await entry.parentDirHandle.getFileHandle(entry.filename);
      const file = await srcHandle.getFile();

      // Reconstruct the destination directory chain under the library root
      const segments = entry.relativePath.split("/").filter(Boolean);
      const filename = segments.pop()!;
      const dst = segments.length > 0 ? await getOrCreateDir(root, segments) : root;

      // Don't clobber existing files
      const targetName = await uniqueFilename(dst, filename);
      const dstHandle = await dst.getFileHandle(targetName, { create: true });
      const writable = await dstHandle.createWritable();
      await writable.write(file);
      await writable.close();

      // Verify
      const verify = await dstHandle.getFile();
      if (verify.size !== file.size) {
        await dst.removeEntry(targetName).catch(() => {});
        throw new Error(`verify failed`);
      }

      // Remove from trash
      await entry.parentDirHandle.removeEntry(entry.filename);
      ok.push(entry.id);
    } catch (err) {
      failed.push({ id: entry.id, reason: err instanceof Error ? err.message : String(err) });
    }
  }

  return { ok, failed };
}

/** Permanently delete trash entries (drops them from disk). */
export async function purgeTrashEntries(entries: TrashEntry[]): Promise<TrashOpResult> {
  const root = fsHandles.getRoot();
  if (root) {
    const granted = await ensurePermission(root);
    if (!granted) {
      return { ok: [], failed: entries.map((e) => ({ id: e.id, reason: "write permission denied" })) };
    }
  }
  const ok: string[] = [];
  const failed: TrashOpResult["failed"] = [];
  for (const entry of entries) {
    try {
      await entry.parentDirHandle.removeEntry(entry.filename);
      ok.push(entry.id);
    } catch (err) {
      failed.push({ id: entry.id, reason: err instanceof Error ? err.message : String(err) });
    }
  }
  return { ok, failed };
}

/** Purge ALL of .lumen-trash. Best-effort recursive removal. */
export async function purgeAllTrash(): Promise<{ ok: boolean; reason?: string }> {
  const root = fsHandles.getRoot();
  if (!root) return { ok: false, reason: "no library root handle" };
  const granted = await ensurePermission(root);
  if (!granted) return { ok: false, reason: "write permission denied" };
  try {
    await root.removeEntry(TRASH_ROOT_NAME, { recursive: true });
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : String(err) };
  }
}
