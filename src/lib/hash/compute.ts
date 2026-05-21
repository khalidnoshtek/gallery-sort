import { sha256OfPath } from "./sha256";
import { dhashOfPath } from "./dhash";
import { rawDb } from "../db/raw";
import { logger } from "../logger";
import { hexFromBigint } from "../db/json";

export interface HashJobInput {
  mediaId: string;
  path: string;
  kind: "IMAGE" | "VIDEO" | "UNKNOWN";
}

export async function computeAndStoreHashes(items: HashJobInput[]): Promise<number> {
  const db = rawDb();
  const upsert = db.prepare(
    `INSERT INTO MediaHash (mediaId, sha256, dhash64Hex, computedAt)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(mediaId) DO UPDATE SET
       sha256 = excluded.sha256, dhash64Hex = excluded.dhash64Hex`
  );
  const markHashed = db.prepare(`UPDATE MediaItem SET isHashed = 1 WHERE id = ?`);
  const now = new Date().toISOString();

  let n = 0;
  for (const item of items) {
    try {
      const sha = await sha256OfPath(item.path);
      let dhash = 0n;
      if (item.kind === "IMAGE") {
        try {
          dhash = await dhashOfPath(item.path);
        } catch (err) {
          logger.warn({ path: item.path, err: String(err) }, "dhash failed; skipping");
        }
      }
      const tx = db.transaction(() => {
        upsert.run(item.mediaId, sha, hexFromBigint(dhash), now);
        markHashed.run(item.mediaId);
      });
      tx();
      n++;
    } catch (err) {
      logger.warn({ mediaId: item.mediaId, err: String(err) }, "hash failed");
    }
  }
  return n;
}
