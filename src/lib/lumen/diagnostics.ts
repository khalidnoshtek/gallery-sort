// Diagnostics — surfaces "what was checked and what was found" so the user
// can tell algorithm-ran-found-nothing apart from algorithm-failed.

import type { BrowserDuplicateGroup, BrowserMediaItem } from "../browser/types";

export interface Diagnostics {
  totalFiles: number;
  totalImages: number;
  totalVideos: number;
  hashed: number;
  withDhash: number;
  exactDupGroups: number;
  exactDupFiles: number;
  nearDupGroups: number;
  nearDupFiles: number;
  withQuality: number;
  blurryCount: number;
  darkCount: number;
  brightCount: number;
  classified: Record<string, number>;
  pathMatches: {
    screenshots: number;
    whatsapp: number;
    transactional: number;
  };
  ai: {
    embedded: number;
    withFaces: number;
    totalFaces: number;
  };
}

export function computeDiagnostics(
  items: BrowserMediaItem[],
  exact: BrowserDuplicateGroup[],
  near: BrowserDuplicateGroup[],
): Diagnostics {
  const images = items.filter((i) => i.kind === "IMAGE");
  const videos = items.filter((i) => i.kind === "VIDEO");
  const hashed = items.filter((i) => i.sha256).length;
  const withDhash = items.filter((i) => i.dhash && i.dhash !== "0000000000000000").length;
  const withQuality = items.filter((i) => i.qualityScore !== null).length;

  const blurry = quantileItems(items, (i) => i.qualityScore, 0.05, "low");
  const dark = quantileItems(items, (i) => i.brightness, 0.05, "low");
  const bright = quantileItems(items, (i) => i.brightness, 0.98, "high");

  const classified: Record<string, number> = {};
  for (const i of items) {
    classified[i.category] = (classified[i.category] ?? 0) + 1;
  }

  return {
    totalFiles: items.length,
    totalImages: images.length,
    totalVideos: videos.length,
    hashed,
    withDhash,
    exactDupGroups: exact.length,
    exactDupFiles: exact.reduce((a, g) => a + g.memberIds.length, 0),
    nearDupGroups: near.length,
    nearDupFiles: near.reduce((a, g) => a + g.memberIds.length, 0),
    withQuality,
    blurryCount: blurry.length,
    darkCount: dark.length,
    brightCount: bright.length,
    classified,
    pathMatches: {
      screenshots: classified.SCREENSHOT ?? 0,
      whatsapp: classified.WHATSAPP_FORWARD ?? 0,
      transactional:
        (classified.TRANSACTIONAL ?? 0) +
        (classified.RECEIPT ?? 0) +
        (classified.DOCUMENT ?? 0),
    },
    ai: {
      embedded: items.filter((i) => i.clipEmbedding && i.clipEmbedding.length > 0).length,
      withFaces: items.filter((i) => i.faces && i.faces.length > 0).length,
      totalFaces: items.reduce((a, i) => a + (i.faces?.length ?? 0), 0),
    },
  };
}

/**
 * Returns the items in the worst (or best) `quantile` fraction by the given
 * accessor. Skips items where the accessor returns null. Always returns at
 * least 3 items if there's enough data — useful for "show me the worst even
 * if it's not absolutely terrible".
 */
export function quantileItems<T extends { id: string }>(
  items: T[],
  pick: (it: T) => number | null,
  quantile: number,
  side: "low" | "high",
): T[] {
  const withVal: Array<{ item: T; v: number }> = [];
  for (const it of items) {
    const v = pick(it);
    if (v == null || !Number.isFinite(v)) continue;
    withVal.push({ item: it, v });
  }
  if (withVal.length === 0) return [];
  withVal.sort((a, b) => (side === "low" ? a.v - b.v : b.v - a.v));
  const targetCount = Math.max(3, Math.ceil(withVal.length * quantile));
  return withVal.slice(0, Math.min(targetCount, withVal.length)).map((x) => x.item);
}
