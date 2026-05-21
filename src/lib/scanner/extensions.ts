export const IMAGE_EXTS = new Set([
  ".jpg", ".jpeg", ".png", ".webp", ".heic", ".heif",
  ".gif", ".bmp", ".tiff", ".tif", ".avif",
  ".dng", ".raw", ".cr2", ".cr3", ".nef", ".arw", ".rw2", ".orf", ".raf",
]);

export const VIDEO_EXTS = new Set([
  ".mp4", ".mov", ".m4v", ".avi", ".mkv", ".webm", ".3gp", ".mts", ".wmv",
]);

export function classifyExt(ext: string): "IMAGE" | "VIDEO" | "UNKNOWN" {
  const e = ext.toLowerCase();
  if (IMAGE_EXTS.has(e)) return "IMAGE";
  if (VIDEO_EXTS.has(e)) return "VIDEO";
  return "UNKNOWN";
}

export const IGNORE_DIRS = new Set([
  ".git", ".svn", ".hg",
  "node_modules", ".next", ".cache", ".thumbnails", ".trash",
  ".gallery-sort", ".gallery-sort-data",
  "@eaDir", "@Recycle", ".Trashes", ".Spotlight-V100", ".fseventsd",
  "System Volume Information", "$RECYCLE.BIN",
]);

export const IGNORE_FILE_PREFIXES = [".", "~$"];
