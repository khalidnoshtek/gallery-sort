import { exiftool } from "exiftool-vendored";
import { rawDb } from "../db/raw";
import { logger } from "../logger";

export interface ExifResult {
  width?: number;
  height?: number;
  takenAt?: Date;
  make?: string;
  model?: string;
  lens?: string;
  iso?: number;
  fNumber?: number;
  exposureTime?: number;
  focalLength?: number;
  orientation?: number;
  gpsLat?: number;
  gpsLon?: number;
  gpsAlt?: number;
  raw: Record<string, unknown>;
}

export async function readExif(path: string): Promise<ExifResult | null> {
  try {
    const t = await exiftool.read(path);
    const taken =
      (t.DateTimeOriginal as { toDate?: () => Date } | string | undefined)?.toString?.() ??
      undefined;
    let takenAt: Date | undefined;
    if (taken) {
      const d = new Date(taken.replace(/^(\d{4}):(\d{2}):(\d{2})/, "$1-$2-$3"));
      if (!Number.isNaN(d.getTime())) takenAt = d;
    }

    return {
      width: t.ImageWidth as number | undefined,
      height: t.ImageHeight as number | undefined,
      takenAt,
      make: t.Make as string | undefined,
      model: t.Model as string | undefined,
      lens: t.LensModel as string | undefined,
      iso: t.ISO as number | undefined,
      fNumber: t.FNumber as number | undefined,
      exposureTime: t.ExposureTime as number | undefined,
      focalLength: t.FocalLength as number | undefined,
      orientation: t.Orientation as number | undefined,
      gpsLat: t.GPSLatitude as number | undefined,
      gpsLon: t.GPSLongitude as number | undefined,
      gpsAlt: t.GPSAltitude as number | undefined,
      raw: t as unknown as Record<string, unknown>,
    };
  } catch (err) {
    logger.warn({ path, err: String(err) }, "exif read failed");
    return null;
  }
}

export async function applyExifBatch(items: Array<{ id: string; path: string }>): Promise<number> {
  const db = rawDb();
  const updateMedia = db.prepare(
    `UPDATE MediaItem SET width = ?, height = ?, takenAt = ? WHERE id = ?`
  );
  const insertExif = db.prepare(
    `INSERT OR REPLACE INTO MediaExif
       (mediaId, make, model, lens, iso, fNumber, exposureTime, focalLength, orientation, gpsLat, gpsLon, gpsAlt, rawJson)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );

  let processed = 0;
  for (const item of items) {
    const exif = await readExif(item.path);
    if (!exif) continue;
    const tx = db.transaction(() => {
      updateMedia.run(
        exif.width ?? null,
        exif.height ?? null,
        exif.takenAt?.toISOString() ?? null,
        item.id,
      );
      insertExif.run(
        item.id,
        exif.make ?? null,
        exif.model ?? null,
        exif.lens ?? null,
        exif.iso ?? null,
        exif.fNumber ?? null,
        exif.exposureTime ?? null,
        exif.focalLength ?? null,
        exif.orientation ?? null,
        exif.gpsLat ?? null,
        exif.gpsLon ?? null,
        exif.gpsAlt ?? null,
        JSON.stringify(exif.raw),
      );
    });
    tx();
    processed++;
  }
  return processed;
}
