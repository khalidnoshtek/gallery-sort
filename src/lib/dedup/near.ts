import { rawDb } from "../db/raw";
import { hamming } from "../hash/dhash";
import { bigintFromHex } from "../db/json";
import { logger } from "../logger";

const HAMMING_THRESHOLD = 6;

interface Row {
  id: string;
  sha: string;
  dhash: bigint;
  size: bigint;
  path: string;
  width: number | null;
  height: number | null;
}

export function rebuildNearDuplicates(libraryId?: string) {
  const db = rawDb();
  const libraryFilter = libraryId ? "AND mi.libraryId = ?" : "";
  const params: unknown[] = libraryId ? [libraryId] : [];

  const raw = db
    .prepare(
      `SELECT mi.id AS id, mh.sha256 AS sha, mh.dhash64Hex AS dhashHex, mi.sizeBytes AS size,
              mi.path AS path, mi.width AS width, mi.height AS height
         FROM MediaHash mh
         JOIN MediaItem mi ON mi.id = mh.mediaId
        WHERE mi.kind = 'IMAGE' AND mh.dhash64Hex != '0000000000000000' ${libraryFilter}
        ORDER BY mh.dhash64Hex`
    )
    .all(...params) as Array<{ id: string; sha: string; dhashHex: string; size: bigint; path: string; width: number | null; height: number | null }>;

  const rows: Row[] = raw.map((r) => ({
    id: r.id,
    sha: r.sha,
    dhash: bigintFromHex(r.dhashHex),
    size: BigInt(r.size),
    path: r.path,
    width: r.width,
    height: r.height,
  }));

  const clear = db.transaction(() => {
    db.prepare(`DELETE FROM DuplicateMember WHERE groupId IN (SELECT id FROM DuplicateGroup WHERE kind = 'NEAR')`).run();
    db.prepare(`DELETE FROM DuplicateGroup WHERE kind = 'NEAR'`).run();
  });
  clear();

  const parent = new Map<string, string>();
  const find = (x: string): string => {
    let p = parent.get(x) ?? x;
    while (p !== (parent.get(p) ?? p)) p = parent.get(p) ?? p;
    parent.set(x, p);
    return p;
  };
  const union = (a: string, b: string) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent.set(ra, rb);
  };

  const WINDOW = 64;
  for (let i = 0; i < rows.length; i++) {
    const a = rows[i]!;
    for (let j = i + 1; j < Math.min(rows.length, i + WINDOW); j++) {
      const b = rows[j]!;
      if (a.sha === b.sha) continue;
      const d = hamming(a.dhash, b.dhash);
      if (d <= HAMMING_THRESHOLD) union(a.id, b.id);
    }
  }

  const clusters = new Map<string, Row[]>();
  for (const row of rows) {
    const root = find(row.id);
    if (!clusters.has(root)) clusters.set(root, []);
    clusters.get(root)!.push(row);
  }

  const insertGroup = db.prepare(
    `INSERT INTO DuplicateGroup (id, kind, memberCount, totalBytes, bestMediaId, createdAt)
     VALUES (?, 'NEAR', ?, ?, ?, ?)`
  );
  const insertMember = db.prepare(
    `INSERT INTO DuplicateMember (groupId, mediaId, score, reason) VALUES (?, ?, ?, ?)`
  );

  const now = new Date().toISOString();
  let groups = 0;
  let members = 0;
  let bytesRecoverable = 0n;

  const ingest = db.transaction(() => {
    let i = 0;
    for (const cluster of clusters.values()) {
      if (cluster.length < 2) continue;
      const best = pickBestNear(cluster);
      const totalBytes = cluster.reduce<bigint>((acc, m) => acc + BigInt(m.size), 0n);
      const groupId = `ng_${i++}_${best.id.slice(-8)}`;
      insertGroup.run(groupId, cluster.length, totalBytes, best.id, now);
      for (const m of cluster) {
        const d = hamming(m.dhash, best.dhash);
        const score = 1 - d / 64;
        insertMember.run(groupId, m.id, score, m.id === best.id ? "best of cluster" : `hamming=${d}`);
      }
      groups++;
      members += cluster.length;
      bytesRecoverable += totalBytes - BigInt(best.size);
    }
  });
  ingest();

  logger.info({ groups, members, bytesRecoverable: bytesRecoverable.toString() }, "near dedup rebuilt");
  return { groups, members, bytesRecoverable };
}

function pickBestNear(cluster: Row[]): Row {
  return [...cluster]
    .map((m) => ({
      m,
      score:
        (m.width && m.height ? m.width * m.height : 0) +
        Number(m.size) * 0.0001 +
        (m.path.match(/DCIM|Camera/i) ? 1_000_000 : 0) -
        (m.path.match(/WhatsApp|Sent|Copy/i) ? 500_000 : 0),
    }))
    .sort((a, b) => b.score - a.score)[0]!.m;
}
