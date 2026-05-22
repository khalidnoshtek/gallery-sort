// Suggestion engine — generates actionable cleanup recommendations from
// real scan data. Now uses percentile-based thresholds so that a "clean"
// camera folder still surfaces its weakest 5% as candidates — you can
// always Dismiss what you don't want.

import type { BrowserDuplicateGroup, BrowserMediaItem } from "../browser/types";
import { quantileItems } from "./diagnostics";

export type SuggestionIcon = "save" | "burst" | "shot" | "blur" | "wa" | "video" | "doc" | "tiny" | "dark";

export interface RealSuggestion {
  id: string;
  icon: SuggestionIcon;
  title: string;
  body: string;
  itemIds: string[];
  bytes: number;
  priority: number;
}

const fmtBytes = (b: number): string => {
  if (b < 1024) return b + " B";
  if (b < 1024 ** 2) return (b / 1024).toFixed(1) + " KB";
  if (b < 1024 ** 3) return (b / 1024 ** 2).toFixed(1) + " MB";
  return (b / 1024 ** 3).toFixed(1) + " GB";
};

export function buildSuggestions(
  items: BrowserMediaItem[],
  exact: BrowserDuplicateGroup[],
  near: BrowserDuplicateGroup[],
): RealSuggestion[] {
  const byId = new Map(items.map((it) => [it.id, it]));
  const sugs: RealSuggestion[] = [];

  // 1. Exact duplicates — keep best of each group
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
    if (trashIds.length > 0) {
      sugs.push({
        id: "dups-exact",
        icon: "save",
        title: `Remove ${trashIds.length} exact-duplicate cop${trashIds.length === 1 ? "y" : "ies"}`,
        body: `${exact.length} duplicate group${exact.length === 1 ? "" : "s"} found by SHA-256 · recover ${fmtBytes(bytes)}`,
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
    if (trashIds.length > 0) {
      sugs.push({
        id: "dups-near",
        icon: "burst",
        title: `Keep best frame of ${near.length} near-duplicate cluster${near.length === 1 ? "" : "s"}`,
        body: `${trashIds.length} extra copies found by perceptual hash · recover ${fmtBytes(bytes)}`,
        itemIds: trashIds,
        bytes,
        priority: 2,
      });
    }
  }

  // 3. Worst-quality 5% (always surfaced even if absolute scores look OK)
  const blurry = quantileItems(items.filter((i) => i.kind === "IMAGE"), (i) => i.qualityScore, 0.05, "low");
  if (blurry.length > 0) {
    const bytes = blurry.reduce((a, b) => a + b.sizeBytes, 0);
    sugs.push({
      id: "blurry",
      icon: "blur",
      title: `Review ${blurry.length} least-sharp photo${blurry.length === 1 ? "" : "s"}`,
      body: `Bottom 5% by Laplacian variance · ${fmtBytes(bytes)} · likely blurry or out of focus`,
      itemIds: blurry.map((b) => b.id),
      bytes,
      priority: 3,
    });
  }

  // 4. Darkest 5% (underexposed candidates)
  const dark = quantileItems(items.filter((i) => i.kind === "IMAGE"), (i) => i.brightness, 0.05, "low");
  if (dark.length > 0) {
    const bytes = dark.reduce((a, b) => a + b.sizeBytes, 0);
    sugs.push({
      id: "dark",
      icon: "dark",
      title: `Review ${dark.length} darkest photo${dark.length === 1 ? "" : "s"}`,
      body: `Bottom 5% by mean luma · ${fmtBytes(bytes)} · likely underexposed or accidental pocket shots`,
      itemIds: dark.map((b) => b.id),
      bytes,
      priority: 4,
    });
  }

  // 5. Brightest 2% (overexposed candidates)
  const blown = quantileItems(items.filter((i) => i.kind === "IMAGE"), (i) => i.brightness, 0.02, "high");
  if (blown.length > 0) {
    const bytes = blown.reduce((a, b) => a + b.sizeBytes, 0);
    sugs.push({
      id: "blown",
      icon: "dark",
      title: `Review ${blown.length} overexposed photo${blown.length === 1 ? "" : "s"}`,
      body: `Top 2% brightness · ${fmtBytes(bytes)} · mostly white frames`,
      itemIds: blown.map((b) => b.id),
      bytes,
      priority: 5,
    });
  }

  // 6. Screenshots
  const screenshots = items.filter((i) => i.category === "SCREENSHOT");
  if (screenshots.length > 0) {
    const bytes = screenshots.reduce((a, b) => a + b.sizeBytes, 0);
    sugs.push({
      id: "screenshots",
      icon: "shot",
      title: `${screenshots.length} screenshot${screenshots.length === 1 ? "" : "s"} detected`,
      body: `Matched filename pattern (Screenshot_*, /Screenshots/) · ${fmtBytes(bytes)}`,
      itemIds: screenshots.map((b) => b.id),
      bytes,
      priority: 6,
    });
  }

  // 7. WhatsApp / messenger files
  const messenger = items.filter((i) => i.category === "WHATSAPP_FORWARD");
  if (messenger.length > 0) {
    const bytes = messenger.reduce((a, b) => a + b.sizeBytes, 0);
    sugs.push({
      id: "messenger",
      icon: "wa",
      title: `${messenger.length} WhatsApp/messenger file${messenger.length === 1 ? "" : "s"}`,
      body: `Matched IMG-YYYYMMDD-WA* or /WhatsApp/Media/ path · ${fmtBytes(bytes)}`,
      itemIds: messenger.map((b) => b.id),
      bytes,
      priority: 7,
    });
  }

  // 8. Documents / receipts / transactional
  const transactional = items.filter((i) =>
    ["DOCUMENT", "RECEIPT", "TRANSACTIONAL"].includes(i.category),
  );
  if (transactional.length > 0) {
    const bytes = transactional.reduce((a, b) => a + b.sizeBytes, 0);
    sugs.push({
      id: "transactional",
      icon: "doc",
      title: `${transactional.length} ephemeral document${transactional.length === 1 ? "" : "s"}`,
      body: `Receipts, QR codes, parking spots, IDs · ${fmtBytes(bytes)}`,
      itemIds: transactional.map((b) => b.id),
      bytes,
      priority: 8,
    });
  }

  // 9. Tiny / low-resolution images
  const tiny = items.filter(
    (i) => i.kind === "IMAGE" && i.width != null && i.width <= 800 && i.height != null && i.height <= 800,
  );
  if (tiny.length >= 3) {
    const bytes = tiny.reduce((a, b) => a + b.sizeBytes, 0);
    sugs.push({
      id: "tiny",
      icon: "tiny",
      title: `${tiny.length} low-resolution image${tiny.length === 1 ? "" : "s"}`,
      body: `≤800px on the long edge · ${fmtBytes(bytes)} · typically shared/compressed copies`,
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
      body: `Often safe to archive or compress · ${fmtBytes(bytes)} total`,
      itemIds: bigVideos.map((b) => b.id),
      bytes,
      priority: 10,
    });
  }

  return sugs.sort((a, b) => a.priority - b.priority);
}

// ─────────────────────────────────────────────────────────────────────
// Cleanup script generator (unchanged — used for browsers without FS access)
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
    "set -euo pipefail",
    "",
    `TRASH=${escape(target)}`,
    `mkdir -p "$TRASH"`,
    "moved=0",
    "missing=0",
    "",
    ...paths.map((p) => {
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
  ];
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
