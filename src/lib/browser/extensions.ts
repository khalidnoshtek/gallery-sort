export const IMAGE_EXTS = new Set([
  ".jpg", ".jpeg", ".png", ".webp", ".gif", ".bmp", ".avif",
  ".heic", ".heif", ".tiff", ".tif",
]);

export const VIDEO_EXTS = new Set([
  ".mp4", ".mov", ".m4v", ".webm", ".mkv", ".avi", ".3gp",
]);

// Browsers can decode these formats via <img> / canvas (for thumbs/dhash).
// Others get a file-kind icon instead.
export const DECODABLE_IMAGE_EXTS = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif", ".bmp", ".avif"]);

export function classifyExt(ext: string): "IMAGE" | "VIDEO" | "UNKNOWN" {
  const e = ext.toLowerCase();
  if (IMAGE_EXTS.has(e)) return "IMAGE";
  if (VIDEO_EXTS.has(e)) return "VIDEO";
  return "UNKNOWN";
}

export function extOf(filename: string): string {
  const i = filename.lastIndexOf(".");
  return i >= 0 ? filename.slice(i).toLowerCase() : "";
}
