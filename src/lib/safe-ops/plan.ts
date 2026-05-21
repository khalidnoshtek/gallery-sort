import path from "node:path";
import { promises as fsp } from "node:fs";
import { createHash } from "node:crypto";
import { rawDb } from "../db/raw";
import { paths } from "../config";
import { SafetyError } from "../errors";
import type { Intent, Plan, PlannedOp } from "./types";

// plan() is pure-ish — it queries the DB but DOES NOT touch the user's
// filesystem in any destructive way. It produces a snapshot that the UI
// shows the user before any byte is moved.

function newPlanId(): string {
  return "op_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function trashTargetFor(operationId: string, srcPath: string): string {
  const slug = createHash("sha1").update(srcPath).digest("hex").slice(0, 16);
  return path.join(paths.trash, operationId, slug, path.basename(srcPath));
}

export async function plan(intent: Intent): Promise<Plan> {
  const db = rawDb();
  const id = newPlanId();
  const warnings: string[] = [];
  const ops: PlannedOp[] = [];

  if (intent.kind === "TRASH") {
    if (intent.mediaIds.length === 0) {
      throw new SafetyError("Refusing to plan an empty TRASH op");
    }
    const placeholders = intent.mediaIds.map(() => "?").join(",");
    const rows = db
      .prepare(
        `SELECT mi.id, mi.path, mi.sizeBytes, mh.sha256
           FROM MediaItem mi
           LEFT JOIN MediaHash mh ON mh.mediaId = mi.id
          WHERE mi.id IN (${placeholders})`
      )
      .all(...intent.mediaIds) as Array<{ id: string; path: string; sizeBytes: bigint; sha256: string | null }>;

    if (rows.length !== intent.mediaIds.length) {
      warnings.push(`${intent.mediaIds.length - rows.length} requested item(s) no longer exist in the DB`);
    }

    for (const r of rows) {
      const exists = await fileExists(r.path);
      if (!exists) {
        warnings.push(`Source no longer on disk: ${r.path}`);
        continue;
      }
      ops.push({
        mediaId: r.id,
        from: r.path,
        to: trashTargetFor(id, r.path),
        sizeBytes: BigInt(r.sizeBytes),
        sha256: r.sha256,
        note: intent.reason,
      });
    }

    const totalBytes = ops.reduce<bigint>((acc, o) => acc + o.sizeBytes, 0n);
    return {
      id,
      kind: "TRASH",
      summary: `Move ${ops.length} file(s) to Trash · ${humanBytes(totalBytes)}`,
      ops,
      totalBytes,
      warnings,
      createdAt: new Date().toISOString(),
    };
  }

  if (intent.kind === "RENAME") {
    if (intent.renames.length === 0) {
      throw new SafetyError("Refusing to plan an empty RENAME op");
    }
    const placeholders = intent.renames.map(() => "?").join(",");
    const ids = intent.renames.map((r) => r.mediaId);
    const rows = db
      .prepare(
        `SELECT mi.id, mi.path, mi.sizeBytes, mh.sha256
           FROM MediaItem mi
           LEFT JOIN MediaHash mh ON mh.mediaId = mi.id
          WHERE mi.id IN (${placeholders})`
      )
      .all(...ids) as Array<{ id: string; path: string; sizeBytes: bigint; sha256: string | null }>;

    const byId = new Map(rows.map((r) => [r.id, r]));
    const targetSet = new Set<string>();

    for (const rn of intent.renames) {
      const src = byId.get(rn.mediaId);
      if (!src) {
        warnings.push(`Unknown media: ${rn.mediaId}`);
        continue;
      }
      const dir = path.dirname(src.path);
      let target = path.join(dir, rn.newName);
      if (targetSet.has(target) || (await fileExists(target))) {
        const orig = target;
        target = await dedupName(target);
        warnings.push(`Collision: ${orig} → ${target}`);
      }
      targetSet.add(target);
      ops.push({
        mediaId: src.id,
        from: src.path,
        to: target,
        sizeBytes: BigInt(src.sizeBytes),
        sha256: src.sha256,
        note: "rename",
      });
    }

    return {
      id,
      kind: "RENAME",
      summary: `Rename ${ops.length} file(s)`,
      ops,
      totalBytes: ops.reduce<bigint>((a, o) => a + o.sizeBytes, 0n),
      warnings,
      createdAt: new Date().toISOString(),
    };
  }

  if (intent.kind === "MOVE") {
    throw new SafetyError("MOVE planning not yet implemented in scaffold");
  }

  throw new SafetyError(`Unknown intent: ${(intent as { kind: string }).kind}`);
}

async function fileExists(p: string): Promise<boolean> {
  try {
    await fsp.access(p);
    return true;
  } catch {
    return false;
  }
}

async function dedupName(target: string): Promise<string> {
  const dir = path.dirname(target);
  const ext = path.extname(target);
  const base = path.basename(target, ext);
  for (let i = 1; i < 1000; i++) {
    const candidate = path.join(dir, `${base} (${i})${ext}`);
    if (!(await fileExists(candidate))) return candidate;
  }
  throw new SafetyError(`Could not find a non-colliding name for ${target}`);
}

function humanBytes(n: bigint): string {
  const v = Number(n);
  const units = ["B", "KB", "MB", "GB", "TB"];
  let i = 0;
  let val = v;
  while (val >= 1024 && i < units.length - 1) {
    val /= 1024;
    i++;
  }
  return `${val.toFixed(val >= 100 || i === 0 ? 0 : 1)} ${units[i]}`;
}
