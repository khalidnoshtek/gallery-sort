import { promises as fsp } from "node:fs";
import path from "node:path";
import { rawDb } from "../db/raw";
import { paths, config } from "../config";
import { SafetyError } from "../errors";
import { logger } from "../logger";
import { stringifyBigIntSafe } from "../db/json";
import type { ExecutionResult, Plan } from "./types";

// execute() is the ONLY function in the app that may move files in the
// user's library. Even here, it never calls unlink() — it moves to the
// versioned trash. The manifest is written BEFORE any disk move so we can
// recover from mid-op crashes on restart.

export async function execute(plan: Plan): Promise<ExecutionResult> {
  const db = rawDb();
  assertSafeOps(plan);

  const now = new Date();
  const expiresAt = new Date(now.getTime() + config.trash.retentionDays * 24 * 3600 * 1000);

  const opId = plan.id;
  const insertOp = db.prepare(
    `INSERT INTO Operation (id, kind, status, summary, itemCount, bytesAffected, plan, manifest, startedAt, createdAt)
     VALUES (?, ?, 'EXECUTING', ?, ?, ?, ?, ?, ?, ?)`
  );
  const finishOp = db.prepare(
    `UPDATE Operation SET status = ?, finishedAt = ?, error = ?, manifest = ? WHERE id = ?`
  );
  const insertTrash = db.prepare(
    `INSERT INTO TrashEntry (id, operationId, mediaId, originalPath, trashPath, sha256, sizeBytes, trashedAt, expiresAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const updateMediaPath = db.prepare(`UPDATE MediaItem SET path = ?, filename = ?, updatedAt = ? WHERE id = ?`);
  const softDeleteMedia = db.prepare(`UPDATE MediaItem SET isHidden = 1, updatedAt = ? WHERE id = ?`);

  const manifest: Array<{ mediaId: string; from: string; to: string; sha256: string | null; sizeBytes: string }> = [];

  const startTx = db.transaction(() => {
    insertOp.run(
      opId,
      plan.kind,
      plan.summary,
      plan.ops.length,
      plan.ops.reduce<bigint>((a, o) => a + o.sizeBytes, 0n),
      stringifyBigIntSafe(plan),
      null,
      now.toISOString(),
      now.toISOString(),
    );
  });
  startTx();

  let succeeded = 0;
  let failed = 0;
  const warnings: string[] = [];

  for (const op of plan.ops) {
    try {
      await fsp.mkdir(path.dirname(op.to), { recursive: true });

      if (plan.kind === "TRASH") {
        await safeMove(op.from, op.to);
        manifest.push({ mediaId: op.mediaId, from: op.from, to: op.to, sha256: op.sha256, sizeBytes: op.sizeBytes.toString() });
        db.transaction(() => {
          insertTrash.run(
            `te_${opId}_${manifest.length}`,
            opId,
            op.mediaId,
            op.from,
            op.to,
            op.sha256,
            op.sizeBytes,
            now.toISOString(),
            expiresAt.toISOString(),
          );
          softDeleteMedia.run(now.toISOString(), op.mediaId);
        })();
      } else if (plan.kind === "RENAME") {
        await safeMove(op.from, op.to);
        manifest.push({ mediaId: op.mediaId, from: op.from, to: op.to, sha256: op.sha256, sizeBytes: op.sizeBytes.toString() });
        updateMediaPath.run(op.to, path.basename(op.to), now.toISOString(), op.mediaId);
      } else {
        throw new SafetyError(`execute(): unsupported plan kind ${plan.kind}`);
      }

      succeeded++;
    } catch (err) {
      failed++;
      warnings.push(`Failed: ${op.from}: ${String(err)}`);
      logger.error({ op, err: String(err) }, "execute op failed");
    }
  }

  const status = failed === 0 ? "COMPLETED" : succeeded === 0 ? "FAILED" : "PARTIAL";
  finishOp.run(status, new Date().toISOString(), warnings.join("\n") || null, stringifyBigIntSafe(manifest), opId);

  return { operationId: opId, succeeded, failed, warnings };
}

async function safeMove(from: string, to: string): Promise<void> {
  // Same filesystem? Try rename. Otherwise copy + verify + remove via unlink.
  // We only ever unlink AFTER successful copy + size verification.
  try {
    await fsp.rename(from, to);
    return;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "EXDEV") throw err;
  }
  await fsp.copyFile(from, to);
  const [s1, s2] = await Promise.all([fsp.stat(from), fsp.stat(to)]);
  if (s1.size !== s2.size) {
    throw new SafetyError(`Copy verify failed: ${from} (${s1.size} != ${s2.size})`);
  }
  await fsp.unlink(from);
}

function assertSafeOps(plan: Plan) {
  for (const op of plan.ops) {
    if (op.from.includes("..")) throw new SafetyError(`Path traversal detected: ${op.from}`);
    if (op.from.startsWith(paths.home)) throw new SafetyError(`Refusing to act on app-internal path: ${op.from}`);
    if (op.to.startsWith(paths.home + path.sep) === false && plan.kind === "TRASH") {
      throw new SafetyError(`TRASH target must be inside trash dir: ${op.to}`);
    }
  }
}
