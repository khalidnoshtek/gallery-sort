// In-browser media item. Distinct from the Prisma MediaItem (server) — the
// browser version holds File handles + base64 thumbnails in memory / IndexedDB.

import type { MediaCategory, MediaIntent } from "../db/enums";

export interface BrowserMediaItem {
  id: string;
  relativePath: string;
  filename: string;
  ext: string;
  mimeType: string;
  sizeBytes: number;
  lastModified: number;
  kind: "IMAGE" | "VIDEO" | "UNKNOWN";
  width: number | null;
  height: number | null;
  sha256: string;
  dhash: string; // 16-char hex
  thumbDataUrl: string | null;
  category: MediaCategory;
  intent: MediaIntent;
  categoryConfidence: number;
}

export interface BrowserDuplicateGroup {
  id: string;
  kind: "EXACT" | "NEAR";
  memberIds: string[];
  bestId: string;
  totalBytes: number;
  recoverableBytes: number;
}

export interface ScanProgress {
  phase: "idle" | "enumerating" | "hashing" | "thumbnails" | "dedup" | "done";
  scanned: number;
  total: number;
  current: string | null;
  startedAt: number;
  elapsedMs: number;
}

export interface BrowserLibrarySummary {
  folderName: string;
  itemCount: number;
  totalBytes: number;
  scannedAt: number;
}
