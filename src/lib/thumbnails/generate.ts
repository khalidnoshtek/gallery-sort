import sharp from "sharp";
import path from "node:path";
import { promises as fsp } from "node:fs";
import { paths } from "../config";
import { rawDb } from "../db/raw";
import { logger } from "../logger";

// Thumbnails are content-addressed by the source file's sha256.
// Renaming the source doesn't invalidate; deletion does.

const VARIANTS: Array<{ name: "thumb256" | "thumb1024"; size: number; quality: number }> = [
  { name: "thumb256", size: 256, quality: 72 },
  { name: "thumb1024", size: 1024, quality: 80 },
];

function thumbDir(sha: string): string {
  return path.join(paths.thumbnails, sha.slice(0, 2), sha.slice(2, 4));
}

function thumbPath(sha: string, variant: string): string {
  return path.join(thumbDir(sha), `${sha}.${variant}.webp`);
}

export interface ThumbJobInput {
  mediaId: string;
  path: string;
  sha256: string;
}

export async function generateAndStoreThumbnails(items: ThumbJobInput[]): Promise<number> {
  const db = rawDb();
  const upsertThumb = db.prepare(
    `INSERT INTO MediaThumbnail (id, mediaId, variant, path, width, height, bytes, format, createdAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'webp', ?)
     ON CONFLICT(mediaId, variant) DO UPDATE SET
       path = excluded.path, width = excluded.width, height = excluded.height,
       bytes = excluded.bytes, createdAt = excluded.createdAt`
  );
  const markThumbed = db.prepare(`UPDATE MediaItem SET isThumbed = 1 WHERE id = ?`);
  const now = new Date().toISOString();

  let n = 0;
  for (const item of items) {
    try {
      await fsp.mkdir(thumbDir(item.sha256), { recursive: true });
      for (const v of VARIANTS) {
        const out = thumbPath(item.sha256, v.name);
        try {
          await fsp.stat(out);
          // cache hit; still ensure DB row exists below
        } catch {
          await sharp(item.path)
            .rotate()
            .resize(v.size, v.size, { fit: "inside", withoutEnlargement: true })
            .webp({ quality: v.quality, effort: 4 })
            .toFile(out);
        }
        const meta = await sharp(out).metadata();
        const stat = await fsp.stat(out);
        upsertThumb.run(
          `tn_${item.mediaId}_${v.name}`,
          item.mediaId,
          v.name,
          out,
          meta.width ?? 0,
          meta.height ?? 0,
          stat.size,
          now,
        );
      }
      markThumbed.run(item.mediaId);
      n++;
    } catch (err) {
      logger.warn({ mediaId: item.mediaId, err: String(err) }, "thumb failed");
    }
  }
  return n;
}

export function thumbnailFilePath(sha256: string, variant: "thumb256" | "thumb1024"): string {
  return thumbPath(sha256, variant);
}
