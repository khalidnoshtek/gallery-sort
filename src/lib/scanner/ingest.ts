import { rawDb } from "../db/raw";
import { heuristicClassify } from "./heuristic-classify";
import { logger } from "../logger";
import type { FoundFile } from "./walk";

// Batched insert path. We bypass Prisma for scan ingestion: per-row async
// overhead matters at 100k+ items. Prisma stays in charge of schema/migrations.

const INSERT_SQL = `
INSERT INTO MediaItem (
  id, libraryId, path, filename, ext, sizeBytes, mtime, ctime, inode,
  kind, isScanned, category, categoryConfidence, intent, createdAt, updatedAt
) VALUES (
  @id, @libraryId, @path, @filename, @ext, @sizeBytes, @mtime, @ctime, @inode,
  @kind, 1, @category, @categoryConfidence, @intent, @now, @now
)
ON CONFLICT(path) DO UPDATE SET
  sizeBytes = excluded.sizeBytes,
  mtime = excluded.mtime,
  updatedAt = excluded.updatedAt
`;

function cuid(): string {
  // Minimal cuid-like id; Prisma's @default(cuid()) is used everywhere else,
  // but we generate one here for the raw path.
  return "c" + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

export interface IngestResult {
  inserted: number;
  updated: number;
}

export function ingestBatch(libraryId: string, batch: FoundFile[]): IngestResult {
  const db = rawDb();
  const stmt = db.prepare(INSERT_SQL);
  const now = new Date().toISOString();

  const insertMany = db.transaction((files: FoundFile[]) => {
    let inserted = 0;
    for (const f of files) {
      const cls = heuristicClassify(f.path, f.filename, f.ext);
      stmt.run({
        id: cuid(),
        libraryId,
        path: f.path,
        filename: f.filename,
        ext: f.ext.toLowerCase(),
        sizeBytes: BigInt(f.size),
        mtime: f.mtime.toISOString(),
        ctime: f.ctime.toISOString(),
        inode: f.inode ? BigInt(f.inode) : null,
        kind: f.kind,
        category: cls.category,
        categoryConfidence: cls.confidence,
        intent: cls.intent,
        now,
      });
      inserted++;
    }
    return inserted;
  });

  const total = insertMany(batch);
  logger.debug({ libraryId, total }, "ingested batch");
  return { inserted: total, updated: 0 };
}
