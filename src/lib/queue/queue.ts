import { rawDb } from "../db/raw";
import { logger } from "../logger";
import type { JobType, JobHandler } from "./types";

// DB-backed durable job queue. SQLite, WAL mode; one process consumes.
// Priority + scheduledAt sorting; per-job attempt/maxAttempts; exponential backoff.

interface JobRow {
  id: string;
  type: string;
  payload: string;
  status: string;
  attempts: number;
  maxAttempts: number;
  priority: number;
  scheduledAt: string;
}

export function enqueue<T = unknown>(type: JobType, payload: T, opts: { priority?: number; parentId?: string; delayMs?: number } = {}): string {
  const db = rawDb();
  const id = `j_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  const scheduledAt = new Date(Date.now() + (opts.delayMs ?? 0)).toISOString();
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO Job (id, type, payload, status, priority, attempts, maxAttempts, parentId, scheduledAt, createdAt)
     VALUES (?, ?, ?, 'PENDING', ?, 0, 3, ?, ?, ?)`
  ).run(id, type, JSON.stringify(payload), opts.priority ?? 0, opts.parentId ?? null, scheduledAt, now);
  return id;
}

export function claimNext(types?: JobType[]): JobRow | null {
  const db = rawDb();
  const typeFilter = types && types.length > 0 ? `AND type IN (${types.map(() => "?").join(",")})` : "";
  const params: unknown[] = types ?? [];

  const tx = db.transaction(() => {
    const row = db
      .prepare(
        `SELECT id, type, payload, status, attempts, maxAttempts, priority, scheduledAt
           FROM Job
          WHERE status = 'PENDING' AND scheduledAt <= ? ${typeFilter}
          ORDER BY priority DESC, scheduledAt ASC
          LIMIT 1`
      )
      .get(new Date().toISOString(), ...params) as JobRow | undefined;
    if (!row) return null;
    const updated = db
      .prepare(`UPDATE Job SET status = 'RUNNING', startedAt = ?, attempts = attempts + 1 WHERE id = ? AND status = 'PENDING'`)
      .run(new Date().toISOString(), row.id);
    if (updated.changes === 0) return null;
    return row;
  });
  return tx() ?? null;
}

export function complete(jobId: string) {
  const db = rawDb();
  db.prepare(`UPDATE Job SET status = 'DONE', finishedAt = ?, lastError = NULL WHERE id = ?`).run(new Date().toISOString(), jobId);
}

export function fail(jobId: string, error: string) {
  const db = rawDb();
  const row = db.prepare(`SELECT attempts, maxAttempts FROM Job WHERE id = ?`).get(jobId) as
    | { attempts: number; maxAttempts: number }
    | undefined;
  if (!row) return;
  if (row.attempts >= row.maxAttempts) {
    db.prepare(`UPDATE Job SET status = 'FAILED', finishedAt = ?, lastError = ? WHERE id = ?`).run(new Date().toISOString(), error, jobId);
  } else {
    const backoff = Math.min(60_000, 1000 * Math.pow(2, row.attempts));
    db.prepare(`UPDATE Job SET status = 'PENDING', scheduledAt = ?, lastError = ? WHERE id = ?`).run(
      new Date(Date.now() + backoff).toISOString(),
      error,
      jobId,
    );
  }
}

export function listJobs(opts: { status?: string; type?: JobType; limit?: number } = {}) {
  const db = rawDb();
  const where: string[] = [];
  const params: unknown[] = [];
  if (opts.status) {
    where.push("status = ?");
    params.push(opts.status);
  }
  if (opts.type) {
    where.push("type = ?");
    params.push(opts.type);
  }
  const sql = `SELECT * FROM Job ${where.length ? "WHERE " + where.join(" AND ") : ""} ORDER BY createdAt DESC LIMIT ?`;
  params.push(opts.limit ?? 100);
  return db.prepare(sql).all(...params);
}

export function queueStats() {
  const db = rawDb();
  return db
    .prepare(`SELECT status, type, COUNT(*) as n FROM Job GROUP BY status, type`)
    .all() as Array<{ status: string; type: string; n: number }>;
}

// ─── Runner ────────────────────────────────────────────────────────────

const handlers = new Map<JobType, JobHandler<unknown>>();

export function registerHandler<T>(type: JobType, handler: JobHandler<T>) {
  handlers.set(type, handler as JobHandler<unknown>);
}

interface RunnerState {
  running: boolean;
  abort: AbortController;
  inflight: number;
}

const state: RunnerState = {
  running: false,
  abort: new AbortController(),
  inflight: 0,
};

export async function startRunner(opts: { concurrency?: number } = {}) {
  if (state.running) return;
  state.running = true;
  state.abort = new AbortController();
  const concurrency = opts.concurrency ?? 4;
  logger.info({ concurrency }, "job runner started");

  const tick = async () => {
    if (!state.running) return;
    while (state.inflight < concurrency) {
      const job = claimNext();
      if (!job) break;
      state.inflight++;
      void runJob(job).finally(() => {
        state.inflight--;
      });
    }
    setTimeout(tick, 250);
  };
  tick();
}

export function stopRunner() {
  state.running = false;
  state.abort.abort();
}

async function runJob(job: JobRow) {
  const handler = handlers.get(job.type as JobType);
  if (!handler) {
    logger.error({ jobId: job.id, type: job.type }, "no handler for job type");
    fail(job.id, `no handler for ${job.type}`);
    return;
  }
  try {
    const payload = JSON.parse(job.payload);
    await handler(payload, { jobId: job.id, signal: state.abort.signal });
    complete(job.id);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.warn({ jobId: job.id, type: job.type, err: msg }, "job failed");
    fail(job.id, msg);
  }
}
