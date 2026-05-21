// Bridges the browser scanner output (BrowserMediaItem, BrowserDuplicateGroup)
// to the shapes the Lumen views consume (Photo, DupGroup, CleanupSummary).
// Pure functions — no React, no I/O.

import type { BrowserDuplicateGroup, BrowserMediaItem } from "../browser/types";
import type { Photo, PhotoCat, DupGroup, DupMember, CleanupSummary, CleanupBucket } from "./data";

function catFor(item: BrowserMediaItem): PhotoCat {
  if (item.kind === "VIDEO") return "video";
  switch (item.category) {
    case "SCREENSHOT": return "screenshot";
    case "MEME": return "meme";
    case "DOCUMENT":
    case "RECEIPT":
    case "TRANSACTIONAL":
      return "document";
    case "WHATSAPP_FORWARD": return "whatsapp";
    default: return "photo";
  }
}

function isoDate(ms: number): string {
  const d = new Date(ms);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

const PLACEHOLDER_DATA_URL =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240"><rect width="100%" height="100%" fill="#1f1d2a"/></svg>`,
  );

export function adaptPhoto(item: BrowserMediaItem): Photo {
  const url = item.thumbDataUrl ?? PLACEHOLDER_DATA_URL;
  return {
    id: item.id,
    uid: item.sha256.slice(0, 16),
    url,
    urlSm: url,
    urlLg: url,
    cat: catFor(item),
    filename: item.filename,
    size: item.sizeBytes,
    width: item.width ?? 0,
    height: item.height ?? 0,
    date: isoDate(item.lastModified),
    location: "",
    event: null,
    tags: [],
    quality: 0.7,
    aesthetic: 0.6,
    blurry: false,
    dark: false,
    burst: false,
  };
}

export function adaptPhotos(items: BrowserMediaItem[]): Photo[] {
  return items.map(adaptPhoto);
}

export function adaptDuplicates(
  groups: BrowserDuplicateGroup[],
  items: BrowserMediaItem[],
): DupGroup[] {
  const byId = new Map(items.map((it) => [it.id, it]));
  return groups.map((g, idx) => {
    const members: DupMember[] = g.memberIds
      .map((id) => byId.get(id))
      .filter((it): it is BrowserMediaItem => Boolean(it))
      .map((it) => ({
        uid: it.sha256.slice(0, 16),
        filename: it.filename,
        size: it.sizeBytes,
        dims: [it.width ?? 0, it.height ?? 0] as [number, number],
        when: new Date(it.lastModified).toLocaleString("en-US", {
          year: "numeric", month: "2-digit", day: "2-digit",
          hour: "2-digit", minute: "2-digit", hour12: false,
        }).replace(",", ""),
        note: it.id === g.bestId ? "Best candidate" : g.kind === "EXACT" ? "Byte-identical" : "Near duplicate",
        thumbUrl: it.thumbDataUrl ?? PLACEHOLDER_DATA_URL,
      }));
    return {
      id: `dg_real_${idx}`,
      label: deriveGroupLabel(members),
      confidence: g.kind === "EXACT" ? 1 : 0.9,
      members,
    };
  });
}

function deriveGroupLabel(members: DupMember[]): string {
  const first = members[0]?.filename ?? "Group";
  return first.replace(/\.[^.]+$/, "").replace(/[_-]/g, " ").slice(0, 36);
}

export function computeCleanup(
  items: BrowserMediaItem[],
  exact: BrowserDuplicateGroup[],
  near: BrowserDuplicateGroup[],
): CleanupSummary {
  const sum = (arr: BrowserMediaItem[]) => arr.reduce((a, b) => a + b.sizeBytes, 0);
  const countOf = (pred: (i: BrowserMediaItem) => boolean) => {
    const matched = items.filter(pred);
    return { count: matched.length, size: sum(matched) };
  };

  const exactBytes = exact.reduce((a, g) => a + g.recoverableBytes, 0);
  const nearBytes = near.reduce((a, g) => a + g.recoverableBytes, 0);

  const screenshots = countOf((i) => i.category === "SCREENSHOT");
  const whatsapp = countOf((i) => i.category === "WHATSAPP_FORWARD");
  const docs = countOf((i) => ["DOCUMENT", "RECEIPT", "TRANSACTIONAL"].includes(i.category));
  const videos = countOf((i) => i.kind === "VIDEO" && i.sizeBytes > 500 * 1024 * 1024);

  const buckets: CleanupBucket[] = [
    {
      id: "dups",
      label: "Exact & visual duplicates",
      count: exact.reduce((a, g) => a + g.memberIds.length, 0) + near.reduce((a, g) => a + g.memberIds.length, 0),
      size: exactBytes + nearBytes,
      color: "lavender",
      desc: "Same photo saved multiple times. We picked the best copy of each.",
      confidence: 0.98,
      recommended: "review",
    },
    {
      id: "ws",
      label: "WhatsApp & messenger media",
      count: whatsapp.count,
      size: whatsapp.size,
      color: "amber",
      desc: "Forwarded memes, low-res copies, and chat thumbnails.",
      confidence: 0.85,
      recommended: "review",
    },
    {
      id: "shots",
      label: "Screenshots",
      count: screenshots.count,
      size: screenshots.size,
      color: "blue",
      desc: "Captured for a moment in time — most are older than what they referenced.",
      confidence: 0.92,
      recommended: "review",
    },
    {
      id: "blur",
      label: "Documents & receipts",
      count: docs.count,
      size: docs.size,
      color: "rose",
      desc: "Ephemeral by intent — receipts, parking spots, IDs, QR codes.",
      confidence: 0.8,
      recommended: "review",
    },
    {
      id: "burst",
      label: "Near duplicates",
      count: near.reduce((a, g) => a + g.memberIds.length, 0),
      size: nearBytes,
      color: "lime",
      desc: `${near.length} near-duplicate cluster(s) — resizes, recompresses, slight crops.`,
      confidence: 0.85,
      recommended: "review",
    },
    {
      id: "large",
      label: "Large videos (>500 MB)",
      count: videos.count,
      size: videos.size,
      color: "violet",
      desc: "Long clips you may want to archive or compress.",
      confidence: 0.7,
      recommended: "review",
    },
  ];

  return {
    totalScanned: items.length,
    driveTotal: 0,
    driveUsed: 0,
    photosUsed: sum(items),
    reclaim: exactBytes + nearBytes + whatsapp.size,
    buckets,
  };
}

// Cheap "semantic" search over real items: filename + path tokens.
export function buildSemanticMap(photos: Photo[]): Record<string, string[]> {
  const map: Record<string, Set<string>> = {};
  for (const p of photos) {
    const tokens = p.filename.toLowerCase().replace(/\.[^.]+$/, "").split(/[\s_\-./]+/).filter((t) => t.length >= 3);
    for (const tok of tokens) {
      if (!map[tok]) map[tok] = new Set();
      map[tok]!.add(p.uid);
    }
  }
  const out: Record<string, string[]> = {};
  for (const [k, v] of Object.entries(map)) out[k] = [...v];
  return out;
}
