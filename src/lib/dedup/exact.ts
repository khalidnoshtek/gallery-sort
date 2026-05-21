import { rawDb } from "../db/raw";
import { logger } from "../logger";

// Exact-duplicate detection: GROUP BY sha256 having count > 1.
// Rebuilds DuplicateGroup rows for EXACT kind. Cheap; runs to completion.

export interface ExactDedupResult {
  groups: number;
  members: number;
  bytesRecoverable: bigint;
}

export function rebuildExactDuplicates(libraryId?: string): ExactDedupResult {
  const db = rawDb();
  const libraryFilter = libraryId ? "AND mi.libraryId = ?" : "";
  const params = libraryId ? [libraryId] : [];

  const dups = db
    .prepare(
      `SELECT mh.sha256 AS sha256, COUNT(*) AS n
         FROM MediaHash mh
         JOIN MediaItem mi ON mi.id = mh.mediaId
        WHERE 1=1 ${libraryFilter}
        GROUP BY mh.sha256
        HAVING COUNT(*) > 1`
    )
    .all(...params) as Array<{ sha256: string; n: number }>;

  const clear = db.transaction(() => {
    db.prepare(
      `DELETE FROM DuplicateMember WHERE groupId IN
       (SELECT id FROM DuplicateGroup WHERE kind = 'EXACT')`
    ).run();
    db.prepare(`DELETE FROM DuplicateGroup WHERE kind = 'EXACT'`).run();
  });
  clear();

  const insertGroup = db.prepare(
    `INSERT INTO DuplicateGroup (id, kind, memberCount, totalBytes, bestMediaId, createdAt)
     VALUES (?, 'EXACT', ?, ?, ?, ?)`
  );
  const insertMember = db.prepare(
    `INSERT INTO DuplicateMember (groupId, mediaId, score, reason) VALUES (?, ?, 1.0, ?)`
  );

  const now = new Date().toISOString();
  let groupCount = 0;
  let memberCount = 0;
  let bytesRecoverable = 0n;

  const ingest = db.transaction(() => {
    for (const d of dups) {
      const members = db
        .prepare(
          `SELECT mi.id AS id, mi.path AS path, mi.sizeBytes AS sizeBytes, mi.width AS width, mi.height AS height
             FROM MediaHash mh
             JOIN MediaItem mi ON mi.id = mh.mediaId
            WHERE mh.sha256 = ?
            ORDER BY mi.sizeBytes DESC, mi.id ASC`
        )
        .all(d.sha256) as Array<{ id: string; path: string; sizeBytes: bigint; width: number | null; height: number | null }>;

      if (members.length < 2) continue;
      const groupId = `dg_${d.sha256.slice(0, 16)}`;
      const totalBytes = members.reduce<bigint>((acc, m) => acc + BigInt(m.sizeBytes), 0n);
      const best = pickBest(members);

      insertGroup.run(groupId, members.length, totalBytes, best.id, now);
      for (const m of members) {
        const reason = m.id === best.id ? "best candidate" : "duplicate of best";
        insertMember.run(groupId, m.id, reason);
      }

      groupCount++;
      memberCount += members.length;
      bytesRecoverable += totalBytes - BigInt(best.sizeBytes);
    }
  });
  ingest();

  logger.info({ groupCount, memberCount, bytesRecoverable: bytesRecoverable.toString() }, "exact dedup rebuilt");
  return { groups: groupCount, members: memberCount, bytesRecoverable };
}

function pickBest(members: Array<{ id: string; path: string; sizeBytes: bigint; width: number | null; height: number | null }>) {
  return [...members]
    .map((m) => ({
      m,
      score:
        (m.width && m.height ? m.width * m.height : 0) * 1.0 +
        Number(m.sizeBytes) * 0.0001 +
        (m.path.match(/DCIM|Camera/i) ? 1_000_000 : 0) -
        (m.path.match(/WhatsApp|Sent|Copy/i) ? 500_000 : 0),
    }))
    .sort((a, b) => b.score - a.score)[0]!.m;
}
