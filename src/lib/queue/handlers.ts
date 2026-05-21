import { registerHandler } from "./queue";
import { rawDb } from "../db/raw";
import { walk } from "../scanner/walk";
import { ingestBatch } from "../scanner/ingest";
import { applyExifBatch } from "../scanner/exif";
import { computeAndStoreHashes } from "../hash/compute";
import { generateAndStoreThumbnails } from "../thumbnails/generate";
import { rebuildExactDuplicates } from "../dedup/exact";
import { rebuildNearDuplicates } from "../dedup/near";
import { enqueue } from "./queue";
import { logger } from "../logger";

// ─── scan.enumerate ────────────────────────────────────────────────────
registerHandler<{ libraryId: string; root: string }>("scan.enumerate", async (payload) => {
  const { libraryId, root } = payload;
  const db = rawDb();
  let inserted = 0;

  await walk(root, {
    batchSize: 200,
    onBatch: async (batch) => {
      const r = ingestBatch(libraryId, batch);
      inserted += r.inserted;
    },
  });

  db.prepare(`UPDATE Library SET lastScanAt = ?, itemCount = (SELECT COUNT(*) FROM MediaItem WHERE libraryId = ?) WHERE id = ?`).run(
    new Date().toISOString(),
    libraryId,
    libraryId,
  );

  logger.info({ libraryId, root, inserted }, "scan.enumerate done");

  // Chain follow-ups: hash and EXIF can run independently.
  const unhashed = db
    .prepare(`SELECT id, path, kind FROM MediaItem WHERE libraryId = ? AND isHashed = 0 LIMIT 5000`)
    .all(libraryId) as Array<{ id: string; path: string; kind: "IMAGE" | "VIDEO" | "UNKNOWN" }>;

  for (let i = 0; i < unhashed.length; i += 50) {
    enqueue("hash.compute", { items: unhashed.slice(i, i + 50) });
  }

  const noExif = db
    .prepare(
      `SELECT mi.id, mi.path FROM MediaItem mi
        LEFT JOIN MediaExif e ON e.mediaId = mi.id
       WHERE mi.libraryId = ? AND e.mediaId IS NULL AND mi.kind = 'IMAGE'
       LIMIT 5000`
    )
    .all(libraryId) as Array<{ id: string; path: string }>;

  for (let i = 0; i < noExif.length; i += 25) {
    enqueue("scan.metadata", { items: noExif.slice(i, i + 25) });
  }
});

// ─── scan.metadata (EXIF + dimensions) ─────────────────────────────────
registerHandler<{ items: Array<{ id: string; path: string }> }>("scan.metadata", async (payload) => {
  await applyExifBatch(payload.items);
});

// ─── hash.compute ──────────────────────────────────────────────────────
registerHandler<{ items: Array<{ mediaId: string; path: string; kind: "IMAGE" | "VIDEO" | "UNKNOWN" }> }>(
  "hash.compute",
  async (payload) => {
    const items = payload.items.map((i) => ({ mediaId: i.mediaId ?? (i as unknown as { id: string }).id, path: i.path, kind: i.kind }));
    await computeAndStoreHashes(items);

    const db = rawDb();
    const hashed = db
      .prepare(
        `SELECT mi.id AS mediaId, mi.path AS path, mh.sha256 AS sha
           FROM MediaItem mi JOIN MediaHash mh ON mh.mediaId = mi.id
          WHERE mi.id IN (${items.map(() => "?").join(",")}) AND mi.isThumbed = 0`
      )
      .all(...items.map((i) => i.mediaId)) as Array<{ mediaId: string; path: string; sha: string }>;

    if (hashed.length > 0) {
      for (let i = 0; i < hashed.length; i += 20) {
        enqueue("thumb.generate", { items: hashed.slice(i, i + 20).map((h) => ({ mediaId: h.mediaId, path: h.path, sha256: h.sha })) });
      }
    }
  },
);

// ─── thumb.generate ────────────────────────────────────────────────────
registerHandler<{ items: Array<{ mediaId: string; path: string; sha256: string }> }>("thumb.generate", async (payload) => {
  await generateAndStoreThumbnails(payload.items);
});

// ─── dedup.recompute ───────────────────────────────────────────────────
registerHandler<{ libraryId?: string }>("dedup.recompute", async (payload) => {
  rebuildExactDuplicates(payload.libraryId);
  rebuildNearDuplicates(payload.libraryId);
});

// ─── ai.* — call the Python sidecar (stubbed for MVP) ─────────────────
// Implementations live in src/lib/ai/ and call the FastAPI sidecar.
// We register no-op handlers here so unrelated jobs don't crash the runner
// when the sidecar is offline. Real implementations land in Phase 1.
registerHandler("ai.classify", async () => { /* phase 1 */ });
registerHandler("ai.embed", async () => { /* phase 1 */ });
registerHandler("ai.ocr", async () => { /* phase 1 */ });
registerHandler("ai.quality", async () => { /* phase 1 */ });
