// In-browser media item.

import type { MediaCategory, MediaIntent } from "../db/enums";

export interface FaceRecord {
  x: number;
  y: number;
  w: number;
  h: number;
  descriptor: number[]; // 128-d face-api descriptor
}

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
  dhash: string;
  thumbDataUrl: string | null;
  category: MediaCategory;
  intent: MediaIntent;
  categoryConfidence: number;

  qualityScore: number | null;
  brightness: number | null;
  /** Spread of RGB pixel values across the image. Low = monochrome / blank /
   * accidental black-frame photo. High = colorful real-world scene. */
  colorVariance: number | null;

  // AI — populated by the optional analysis phase.
  clipEmbedding: number[] | null;   // 512-d CLIP image embedding (normalized)
  faces: FaceRecord[] | null;        // face-api detections; empty array = analyzed, no faces
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
  phase: "idle" | "enumerating" | "hashing" | "thumbnails" | "dedup" | "ai" | "done";
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

export interface FaceCluster {
  id: string;
  label: string | null;
  memberItemIds: string[];
  representativeItemId: string;
  representativeFaceIdx: number;
  size: number;
}
