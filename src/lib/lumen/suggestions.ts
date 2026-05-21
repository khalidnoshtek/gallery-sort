// Suggestion engine — generates actionable cleanup recommendations from
// real scan data. Every suggestion can be applied: clicking "Stage" adds
// the matching items to useLibraryStore's stagedForTrash set.

import type { BrowserDuplicateGroup, BrowserMediaItem } from "../browser/types";
import { isBlurry, isDark, isOverexposed } from "../browser/quality";

export type SuggestionIcon = "save" | "burst" | "shot" | "blur" | "wa" | "video" | "doc" | "tiny";

export interface RealSuggestion {
  id: string;
  icon: SuggestionIcon;
  title: string;
  body: string;
  /** ids of items this suggestion would stage for trash */
  itemIds: string[];
  /** total bytes that would be reclaimed */
  bytes: number;
  /** lower = higher priority */
  priority: number;
}

const MIN_THRESHOLD = 1; // show even single-item findings

export function buildSuggestions(
  items: BrowserMediaItem[],
  exact: BrowserDuplicateGroup[],
  near: BrowserDuplicateGroup[],
): RealSuggestion[] {
  const byId = new Map(items.map((it) => [it.id, it]));
  const sugs: RealSuggestion[] = [];

  // 1. Exact duplicates — keep best, trash rest
  if (exact.length > 0) {
    const trashIds: string[] = [];
    let bytes = 0;
    for (const g of exact) {
      for (const mid of g.memberIds) {
        if (mid === g.bestId) continue;
        trashIds.push(mid);
        const it = byId.get(mid);
        if (it) bytes += it.sizeBytes;
      }
    }
    if (trashIds.length >= MIN_THRESHOLD) {
      sugs.push({
        id: "dups-exact",
        icon: "save",
        title: `Remove ${trashIds.length} exact-duplicate cop${trashIds.length === 1 ? "y" : "ies"}`,
        body: `${exact.length} duplicate group${exact.length === 1 ? "" : "s"} · recover ${fmtBytes(bytes)}`,
        itemIds: trashIds,
        bytes,
        priority: 1,
      });
    }
  }

  // 2. Near duplicates — keep best of each cluster
  if (near.length > 0) {
    const trashIds: string[] = [];
    let bytes = 0;
    for (const g of near) {
      for (const mid of g.memberIds) {
        if (mid === g.bestId) continue;
        trashIds.push(mid);
        const it = byId.get(mid);
        if (it) bytes += it.sizeBytes;
      }
    }
    if (trashIds.length >= MIN_THRESHOLD) {
      sugs.push({
        id: "dups-near",
        icon: "burst",
        title: `Keep the best frame of ${near.length} near-duplicate cluster${near.length === 1 ? "" : "s"}`,
        body: `${trashIds.length} extra copies · recover ${fmtBytes(bytes)}`,
        itemIds: trashIds,
        bytes,
        priority: 2,
      });
    }
  }

  // 3. Blurry photos
  const blurry = items.filter((i) => i.qualityScore !== null && isBlurry(i.qualityScore) && i.kind === "IMAGE");
  if (blurry.length >= MIN_THRESHOLD) {
    const bytes = blurry.reduce((a, b) => a + b.sizeBytes, 0);
    sugs.push({
      id: "blurry",
      icon: "blur",
      title: `Review ${blurry.length} blurry photo${blurry.length === 1 ? "" : "s"}`,
      body: `Detected by Laplacian variance · ${fmtBytes(bytes)} total`,
      itemIds: blurry.map((b) => b.id),
      bytes,
      priority: 3,
    });
  }

  // 4. Dark / underexposed photos (likely pocket shots)
  const dark = items.filter((i) => i.brightness !== null && isDark(i.brightness) && i.kind === "IMAGE");
  if (dark.length >= MIN_THRESHOLD) {
    const bytes = dark.reduce((a, b) => a + b.sizeBytes, 0);
    sugs.push({
      id: "dark",
      icon: "blur",
      title: `Review ${dark.length} very dark photo${dark.length === 1 ? "" : "s"}`,
      body: `Often accidental pocket shots · ${fmtBytes(bytes)} total`,
      itemIds: dark.map((b) => b.id),
      bytes,
      priority: 4,
    });
  }

  // 5. Overexposed
  const blown = items.filter((i) => i.brightness !== null && isOverexposed(i.brightness) && i.kind === "IMAGE");
  if (blown.length >= MIN_THRESHOLD) {
    const bytes = blown.reduce((a, b) => a + b.sizeBytes, 0);
    sugs.push({
      id: "blown",
      icon: "blur",
      title: `Review ${blown.length} overexposed photo${blown.length === 1 ? "" : "s"}`,
      body: `Mostly white frames · ${fmtBytes(bytes)} total`,
      itemIds: blown.map((b) => b.id),
      bytes,
      priority: 5,
    });
  }

  // 6. Screenshots
  const screenshots = items.filter((i) => i.category === "SCREENSHOT");
  if (screenshots.length >= 3) {
    const bytes = screenshots.reduce((a, b) => a + b.sizeBytes, 0);
    sugs.push({
      id: "screenshots",
      icon: "shot",
      title: `${screenshots.length} screenshot${screenshots.length === 1 ? "" : "s"} found`,
      body: `Usually short-lived references · ${fmtBytes(bytes)} total`,
      itemIds: screenshots.map((b) => b.id),
      bytes,
      priority: 6,
    });
  }

  // 7. WhatsApp / messenger files
  const messenger = items.filter((i) => i.category === "WHATSAPP_FORWARD");
  if (messenger.length >= 3) {
    const bytes = messenger.reduce((a, b) => a + b.sizeBytes, 0);
    sugs.push({
      id: "messenger",
      icon: "wa",
      title: `${messenger.length} WhatsApp/messenger file${messenger.length === 1 ? "" : "s"}`,
      body: `Compressed forwards and chat thumbnails · ${fmtBytes(bytes)} total`,
      itemIds: messenger.map((b) => b.id),
      bytes,
      priority: 7,
    });
  }

  // 8. Documents / receipts / transactional
  const transactional = items.filter((i) =>
    ["DOCUMENT", "RECEIPT", "TRANSACTIONAL"].includes(i.category),
  );
  if (transactional.length >= 3) {
    const bytes = transactional.reduce((a, b) => a + b.sizeBytes, 0);
    sugs.push({
      id: "transactional",
      icon: "doc",
      title: `${transactional.length} ephemeral document${transactional.length === 1 ? "" : "s"}`,
      body: `Receipts, QR codes, parking spots, IDs · ${fmtBytes(bytes)} total`,
      itemIds: transactional.map((b) => b.id),
      bytes,
      priority: 8,
    });
  }

  // 9. Tiny / low-resolution images (likely shared/compressed)
  const tiny = items.filter(
    (i) => i.kind === "IMAGE" && i.width != null && i.width <= 800 && i.height != null && i.height <= 800,
  );
  if (tiny.length >= 5) {
    const bytes = tiny.reduce((a, b) => a + b.sizeBytes, 0);
    sugs.push({
      id: "tiny",
      icon: "tiny",
      title: `${tiny.length} low-resolution image${tiny.length === 1 ? "" : "s"}`,
      body: `≤800px on the long edge — typically shared/compressed · ${fmtBytes(bytes)}`,
      itemIds: tiny.map((b) => b.id),
      bytes,
      priority: 9,
    });
  }

  // 10. Large videos
  const bigVideos = items.filter((i) => i.kind === "VIDEO" && i.sizeBytes > 500 * 1024 * 1024);
  if (bigVideos.length > 0) {
    const bytes = bigVideos.reduce((a, b) => a + b.sizeBytes, 0);
    sugs.push({
      id: "bigvideo",
      icon: "video",
      title: `${bigVideos.length} large video${bigVideos.length === 1 ? "" : "s"} (>500 MB each)`,
      body: `Often safe to archive · ${fmtBytes(bytes)} total`,
      itemIds: bigVideos.map((b) => b.id),
      bytes,
      priority: 10,
    });
  }

  return sugs.sort((a, b) => a.priority - b.priority);
}

function fmtBytes(b: number): string {
  if (b < 1024) return b + " B";
  if (b < 1024 ** 2) return (b / 1024).toFixed(1) + " KB";
  if (b < 1024 ** 3) return (b / 1024 ** 2).toFixed(1) + " MB";
  return (b / 1024 ** 3).toFixed(1) + " GB";
}

// ─────────────────────────────────────────────────────────────────────
// Cleanup script generator
// ─────────────────────────────────────────────────────────────────────

export interface CleanupScriptOptions {
  paths: string[];
  trashDir?: string;
  libraryRoot?: string;
}

export function generateCleanupScript(opts: CleanupScriptOptions): string {
  const { paths, trashDir = "~/.lumen-trash", libraryRoot } = opts;
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const target = `${trashDir}/${ts}`;
  const escape = (p: string) => `"${p.replace(/"/g, '\\"')}"`;

  const lines = [
    "#!/usr/bin/env bash",
    "# Lumen cleanup script — generated " + new Date().toString(),
    "#",
    "# This moves the files Lumen flagged into a dated trash folder.",
    "# It does NOT delete them. To permanently remove later, just:",
    "#   rm -rf " + target,
    "#",
    "# Review the list below before running. Anything you remove from",
    "# this script will not be moved.",
    "#",
    `# Files staged: ${paths.length}`,
    libraryRoot ? `# Library root: ${libraryRoot}` : "",
    "set -euo pipefail",
    "",
    `TRASH=${escape(target)}`,
    `mkdir -p "$TRASH"`,
    "moved=0",
    "missing=0",
    "",
    ...paths.map((p) => {
      // Preserve relative-path structure inside the trash dir.
      // If the path is relative (no leading /), prefix with library root.
      const isAbs = p.startsWith("/");
      const abs = isAbs ? p : libraryRoot ? `${libraryRoot}/${p}` : p;
      const subPath = isAbs ? p.replace(/^\//, "") : p;
      const targetPath = `$TRASH/${subPath}`;
      return [
        `if [ -e ${escape(abs)} ]; then`,
        `  mkdir -p "$(dirname ${escape(targetPath)})"`,
        `  mv ${escape(abs)} ${escape(targetPath)}`,
        `  moved=$((moved+1))`,
        `else`,
        `  echo "missing: ${p}" >&2`,
        `  missing=$((missing+1))`,
        `fi`,
      ].join("\n");
    }),
    "",
    `echo "moved $moved files into $TRASH (missing: $missing)"`,
    "",
  ].filter(Boolean);
  return lines.join("\n");
}

export function downloadCleanupScript(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/x-shellscript" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
