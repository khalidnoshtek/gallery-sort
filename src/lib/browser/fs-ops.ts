// Destructive filesystem operations — the ones the user explicitly
// confirms. Uses the File System Access API directory handles cached in
// the registry. Two flavors:
//
//   moveToLibraryTrash — creates .lumen-trash/<date>/ inside the library
//     root and moves staged files there. Recoverable: the user can
//     restore from that folder in Finder.
//
//   deletePermanently — calls parentDir.removeEntry(name) on each file.
//     Irreversible. Wrapped in confirmation in the UI.

import { fsHandles } from "./handles";
import type { BrowserMediaItem } from "./types";

export interface OpResult {
  ok: string[];      // item ids successfully processed
  failed: Array<{ id: string; reason: string }>;
  trashFolder?: string;
}

async function ensurePermission(handle: FileSystemDirectoryHandle): Promise<boolean> {
  if (!handle.queryPermission || !handle.requestPermission) return true; // older Chromium
  const current = await handle.queryPermission({ mode: "readwrite" });
  if (current === "granted") return true;
  const requested = await handle.requestPermission({ mode: "readwrite" });
  return requested === "granted";
}

async function uniqueFilename(dir: FileSystemDirectoryHandle, name: string): Promise<string> {
  // Don't clobber an existing entry in the trash dir (e.g., two files of
  // the same name from different subfolders).
  let candidate = name;
  let i = 1;
  while (true) {
    try {
      // getFileHandle without { create: true } throws if not found.
      await dir.getFileHandle(candidate);
      // Exists → make a new candidate.
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
  const trashRoot = await root.getDirectoryHandle(".lumen-trash", { create: true });
  const trashDated = await trashRoot.getDirectoryHandle(ts, { create: true });

  const ok: string[] = [];
  const failed: OpResult["failed"] = [];

  for (const item of items) {
    const h = fsHandles.get(item.id);
    if (!h) {
      failed.push({ id: item.id, reason: "no file handle (rescan with read-write picker)" });
      continue;
    }
    try {
      // Read source bytes
      const srcHandle = await h.parentDir.getFileHandle(h.filename);
      const file = await srcHandle.getFile();

      // Write into the trash subfolder under a non-colliding name
      const targetName = await uniqueFilename(trashDated, h.filename);
      const dstHandle = await trashDated.getFileHandle(targetName, { create: true });
      const writable = await dstHandle.createWritable();
      await writable.write(file);
      await writable.close();

      // Verify size matches; if not, clean up the partial write and abort this item.
      const verify = await dstHandle.getFile();
      if (verify.size !== file.size) {
        await trashDated.removeEntry(targetName).catch(() => {});
        throw new Error(`verify failed (${verify.size} != ${file.size})`);
      }

      // Remove the original
      await h.parentDir.removeEntry(h.filename);
      ok.push(item.id);
    } catch (err) {
      failed.push({ id: item.id, reason: err instanceof Error ? err.message : String(err) });
    }
  }

  return { ok, failed, trashFolder: `.lumen-trash/${ts}` };
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
