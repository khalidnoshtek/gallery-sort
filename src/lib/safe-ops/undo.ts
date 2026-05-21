import { promises as fsp } from "node:fs";
import path from "node:path";
import { rawDb } from "../db/raw";
import { SafetyError } from "../errors";
import { logger } from "../logger";

interface ManifestEntry {
  mediaId: string;
  from: string;
  to: string;
  sha256: string | null;
  sizeBytes: string;
}

export interface UndoResult {
  restored: number;
  failed: number;
  warnings: string[];
}

export async function undo(operationId: string): Promise<UndoResult> {
  const db = rawDb();
  const op = db.prepare(`SELECT * FROM Operation WHERE id = ?`).get(operationId) as
    | { id: string; kind: string; status: string; manifest: string | null }
    | undefined;

  if (!op) throw new SafetyError(`Unknown operation: ${operationId}`);
  if (op.status === "UNDONE") throw new SafetyError(`Operation already undone: ${operationId}`);
  if (!op.manifest) throw new SafetyError(`Operation has no manifest, cannot undo: ${operationId}`);

  const manifest = JSON.parse(op.manifest) as ManifestEntry[];
  const warnings: string[] = [];
  let restored = 0;
  let failed = 0;

  const markRestored = db.prepare(`UPDATE TrashEntry SET restoredAt = ? WHERE operationId = ? AND mediaId = ?`);
  const restoreMedia = db.prepare(`UPDATE MediaItem SET isHidden = 0, path = ?, filename = ?, updatedAt = ? WHERE id = ?`);
  const renameMedia = db.prepare(`UPDATE MediaItem SET path = ?, filename = ?, updatedAt = ? WHERE id = ?`);
  const now = new Date().toISOString();

  for (const entry of manifest) {
    try {
      const exists = await fileExists(entry.to);
      if (!exists) {
        warnings.push(`File already gone from trash: ${entry.to}`);
        failed++;
        continue;
      }
      await fsp.mkdir(path.dirname(entry.from), { recursive: true });
      if (await fileExists(entry.from)) {
        warnings.push(`Original path is occupied, skipping restore: ${entry.from}`);
        failed++;
        continue;
      }
      await fsp.rename(entry.to, entry.from).catch(async (err) => {
        if ((err as NodeJS.ErrnoException).code === "EXDEV") {
          await fsp.copyFile(entry.to, entry.from);
          await fsp.unlink(entry.to);
        } else throw err;
      });

      if (op.kind === "TRASH") {
        markRestored.run(now, operationId, entry.mediaId);
        restoreMedia.run(entry.from, path.basename(entry.from), now, entry.mediaId);
      } else if (op.kind === "RENAME") {
        renameMedia.run(entry.from, path.basename(entry.from), now, entry.mediaId);
      }
      restored++;
    } catch (err) {
      failed++;
      warnings.push(`Failed to restore ${entry.to}: ${String(err)}`);
      logger.error({ entry, err: String(err) }, "undo failed for entry");
    }
  }

  db.prepare(`UPDATE Operation SET status = 'UNDONE', undoneAt = ? WHERE id = ?`).run(now, operationId);
  return { restored, failed, warnings };
}

async function fileExists(p: string): Promise<boolean> {
  try {
    await fsp.access(p);
    return true;
  } catch {
    return false;
  }
}
