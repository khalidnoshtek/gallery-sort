// End-to-end smoke test for the Gallery Sort pipeline.
//
// Strategy: ONE big test that exercises the entire pipeline against a
// generated fixture library. High signal — if this passes, the foundation
// is wired correctly. Fast — sub-30s on CI.

import { test, before, after } from "node:test";
import assert from "node:assert/strict";

import { setupTestEnv, type TestEnv } from "./_helpers/setup";
import { generateFixtures, type FixtureResult } from "./_helpers/fixtures";

let env: TestEnv;
let fixtures: FixtureResult;

before(async () => {
  env = setupTestEnv();
  fixtures = await generateFixtures(env.library);
});

after(() => {
  env?.cleanup();
});

test("smoke: scan ingests every supported file", async () => {
  await import("../src/lib/fs");
  const { walk } = await import("../src/lib/scanner/walk");
  const { ingestBatch } = await import("../src/lib/scanner/ingest");
  const { rawDb } = await import("../src/lib/db/raw");

  const db = rawDb();
  db.prepare(`INSERT INTO Library (id, name, rootPath, createdAt, isActive) VALUES ('lib_test', 'Test', ?, ?, 1)`).run(
    env.library,
    new Date().toISOString(),
  );

  let count = 0;
  await walk(env.library, {
    onBatch: (batch) => {
      ingestBatch("lib_test", batch);
      count += batch.length;
    },
  });

  assert.equal(count, fixtures.paths.length, `walked ${count} files; expected ${fixtures.paths.length}`);
  const row = db.prepare(`SELECT COUNT(*) as n FROM MediaItem WHERE libraryId = 'lib_test'`).get() as { n: number };
  assert.equal(row.n, fixtures.paths.length);

  // Heuristic classifier: Screenshots/ folder should produce SCREENSHOT category
  const screenshotRows = db
    .prepare(`SELECT COUNT(*) as n FROM MediaItem WHERE category = 'SCREENSHOT'`)
    .get() as { n: number };
  assert.equal(screenshotRows.n, fixtures.byKind.screenshots.length, "screenshots not heuristically classified");
});

test("smoke: hashing is deterministic; identical bytes share sha256", async () => {
  const { computeAndStoreHashes } = await import("../src/lib/hash/compute");
  const { rawDb } = await import("../src/lib/db/raw");
  const db = rawDb();

  const items = db
    .prepare(`SELECT id, path, kind FROM MediaItem`)
    .all() as Array<{ id: string; path: string; kind: "IMAGE" | "VIDEO" | "UNKNOWN" }>;

  const n = await computeAndStoreHashes(items.map((i) => ({ mediaId: i.id, path: i.path, kind: i.kind })));
  assert.equal(n, items.length);

  // Distinct + duplicates: the 3 duplicate paths must share one sha256.
  const dupGroup = db
    .prepare(`SELECT COUNT(DISTINCT sha256) as distinctSha, COUNT(*) as total
                FROM MediaHash mh JOIN MediaItem mi ON mi.id = mh.mediaId
               WHERE mi.path LIKE '%photo_1%' AND mi.path NOT LIKE '%smaller%' AND mi.path NOT LIKE '%recompressed%'`)
    .get() as { distinctSha: number; total: number };
  assert.equal(dupGroup.total, 3, "expected 3 exact-duplicate rows (photo_1 + 2 copies)");
  assert.equal(dupGroup.distinctSha, 1, "exact dupes must share a single sha256");

  // dHash: near-duplicates should be close in Hamming distance to the original.
  const { hamming } = await import("../src/lib/hash/dhash");
  const { bigintFromHex } = await import("../src/lib/db/json");
  const rows = db
    .prepare(`SELECT mi.path, mh.dhash64Hex FROM MediaItem mi JOIN MediaHash mh ON mh.mediaId = mi.id
              WHERE mi.path LIKE '%photo_1%' OR mi.path LIKE '%smaller%' OR mi.path LIKE '%recompressed%'`)
    .all() as Array<{ path: string; dhash64Hex: string }>;
  const original = rows.find((r) => r.path.endsWith("photo_1.jpg"))!;
  const smaller = rows.find((r) => r.path.includes("smaller"))!;
  const recompressed = rows.find((r) => r.path.includes("recompressed"))!;
  assert.ok(
    hamming(bigintFromHex(original.dhash64Hex), bigintFromHex(smaller.dhash64Hex)) <= 6,
    "resized near-dup should have small Hamming distance",
  );
  assert.ok(
    hamming(bigintFromHex(original.dhash64Hex), bigintFromHex(recompressed.dhash64Hex)) <= 6,
    "recompressed near-dup should have small Hamming distance",
  );
});

test("smoke: thumbnails generate and are reasonable", async () => {
  const { generateAndStoreThumbnails } = await import("../src/lib/thumbnails/generate");
  const { rawDb } = await import("../src/lib/db/raw");
  const db = rawDb();

  const rows = db
    .prepare(`SELECT mi.id AS mediaId, mi.path, mh.sha256 FROM MediaItem mi JOIN MediaHash mh ON mh.mediaId = mi.id WHERE mi.kind = 'IMAGE'`)
    .all() as Array<{ mediaId: string; path: string; sha256: string }>;
  const n = await generateAndStoreThumbnails(rows);
  assert.equal(n, rows.length);

  const thumbs = db.prepare(`SELECT COUNT(*) as n FROM MediaThumbnail`).get() as { n: number };
  assert.equal(thumbs.n, rows.length * 2, "expected 2 thumbnail variants per image");

  const { promises: fsp } = await import("node:fs");
  const sample = db.prepare(`SELECT path FROM MediaThumbnail LIMIT 1`).get() as { path: string };
  const stat = await fsp.stat(sample.path);
  assert.ok(stat.size > 0, "thumbnail must be non-empty");
});

test("smoke: exact-duplicate detection groups correctly", async () => {
  const { rebuildExactDuplicates } = await import("../src/lib/dedup/exact");
  const result = rebuildExactDuplicates("lib_test");
  assert.equal(result.groups, 1, "expected exactly one exact-duplicate group (photo_1 + 2 copies)");
  assert.ok(result.bytesRecoverable > 0n);
});

test("smoke: near-duplicate detection groups correctly", async () => {
  const { rebuildNearDuplicates } = await import("../src/lib/dedup/near");
  const result = rebuildNearDuplicates("lib_test");
  assert.ok(result.groups >= 1, "expected at least one near-duplicate cluster");
});

test("smoke: safe-ops trash → undo is byte-perfect", async () => {
  const { plan, execute, undo } = await import("../src/lib/safe-ops");
  const { rawDb } = await import("../src/lib/db/raw");
  const { createHash } = await import("node:crypto");
  const { promises: fsp } = await import("node:fs");
  const db = rawDb();

  const victim = db
    .prepare(`SELECT mi.id, mi.path FROM MediaItem mi WHERE mi.path LIKE '%photo_1_copy_1%' LIMIT 1`)
    .get() as { id: string; path: string };
  const beforeBytes = await fsp.readFile(victim.path);
  const beforeSha = createHash("sha256").update(beforeBytes).digest("hex");

  const dryRun = await plan({ kind: "TRASH", mediaIds: [victim.id], reason: "smoke test" });
  assert.equal(dryRun.ops.length, 1);
  assert.equal(dryRun.ops[0]!.from, victim.path);
  assert.ok(dryRun.ops[0]!.to.includes("/trash/"));

  // Source still on disk after plan
  assert.ok(await fileExists(victim.path), "plan() must not move files");

  const exec = await execute(dryRun);
  assert.equal(exec.succeeded, 1);
  assert.equal(exec.failed, 0);
  assert.equal(await fileExists(victim.path), false, "execute should remove file from original path");

  // Soft-delete + trash entry
  const trashRow = db.prepare(`SELECT trashPath FROM TrashEntry WHERE operationId = ?`).get(exec.operationId) as { trashPath: string };
  assert.ok(await fileExists(trashRow.trashPath), "trash file must exist");

  const undoResult = await undo(exec.operationId);
  assert.equal(undoResult.restored, 1);
  assert.equal(undoResult.failed, 0);

  // Byte-perfect restore
  assert.ok(await fileExists(victim.path), "undo must restore file to original path");
  const afterBytes = await fsp.readFile(victim.path);
  const afterSha = createHash("sha256").update(afterBytes).digest("hex");
  assert.equal(afterSha, beforeSha, "restored file must be byte-identical to original");
});

test("smoke: planning rejects empty intent", async () => {
  const { plan } = await import("../src/lib/safe-ops");
  await assert.rejects(
    () => plan({ kind: "TRASH", mediaIds: [], reason: "empty" }),
    /empty TRASH/i,
  );
});

async function fileExists(p: string): Promise<boolean> {
  const { promises: fsp } = await import("node:fs");
  try {
    await fsp.access(p);
    return true;
  } catch {
    return false;
  }
}
