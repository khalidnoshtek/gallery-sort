// Demo dataset baked into the Pages build.
//
// When NEXT_PUBLIC_DEMO === "1", every page renders from this module instead
// of the SQLite DB. The shapes mirror what the real queries return so the
// rendering code is unchanged.

export const IS_DEMO = process.env.NEXT_PUBLIC_DEMO === "1";
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export interface DemoMediaItem {
  id: string;
  filename: string;
  ext: string;
  sizeBytes: string;
  width: number | null;
  height: number | null;
  thumbSlug: string;
  category: string;
  intent: string;
}

function thumbPath(slug: string): string {
  return `${BASE_PATH}/demo/thumbs/${slug}.webp`;
}

function bytes(s: number): string {
  return s.toString();
}

const ITEMS: Array<Omit<DemoMediaItem, "thumbSlug"> & { thumbSlug: string }> = [
  { id: "m1",  filename: "IMG_20240712_181402.jpg",                ext: ".jpg",  sizeBytes: bytes(4_280_000), width: 4032, height: 3024, thumbSlug: "beach-sunset",                category: "PHOTO",            intent: "KEEP_LONG_TERM" },
  { id: "m2",  filename: "IMG_20240803_093110.jpg",                ext: ".jpg",  sizeBytes: bytes(5_100_000), width: 4032, height: 3024, thumbSlug: "mountain-vista",              category: "PHOTO",            intent: "KEEP_LONG_TERM" },
  { id: "m3",  filename: "IMG_20240910_213355.jpg",                ext: ".jpg",  sizeBytes: bytes(3_690_000), width: 4032, height: 3024, thumbSlug: "city-night",                  category: "PHOTO",            intent: "KEEP_LONG_TERM" },
  { id: "m4",  filename: "IMG_20241201_193804.jpg",                ext: ".jpg",  sizeBytes: bytes(3_980_000), width: 4032, height: 3024, thumbSlug: "family-dinner",               category: "PHOTO",            intent: "KEEP_LONG_TERM" },
  { id: "m5",  filename: "IMG_20240514_173622.jpg",                ext: ".jpg",  sizeBytes: bytes(2_840_000), width: 4032, height: 3024, thumbSlug: "dog-park",                    category: "PHOTO",            intent: "KEEP_LONG_TERM" },
  { id: "m6",  filename: "IMG_20241105_094011.jpg",                ext: ".jpg",  sizeBytes: bytes(2_120_000), width: 3024, height: 4032, thumbSlug: "selfie",                      category: "SELFIE",           intent: "UNKNOWN" },
  { id: "m7",  filename: "IMG_20250108_142255.jpg",                ext: ".jpg",  sizeBytes: bytes(1_290_000), width: 3024, height: 4032, thumbSlug: "receipt-coffee",              category: "RECEIPT",          intent: "EPHEMERAL" },
  { id: "m8",  filename: "IMG_20250122_181701.jpg",                ext: ".jpg",  sizeBytes: bytes(1_100_000), width: 3024, height: 4032, thumbSlug: "parking-spot",                category: "TRANSACTIONAL",    intent: "EPHEMERAL" },
  { id: "m9",  filename: "IMG_20250201_134000.jpg",                ext: ".jpg",  sizeBytes: bytes(890_000),   width: 1170, height: 1170, thumbSlug: "qr-menu",                     category: "TRANSACTIONAL",    intent: "EPHEMERAL" },
  { id: "m10", filename: "IMG_20250218_115522.jpg",                ext: ".jpg",  sizeBytes: bytes(1_980_000), width: 4032, height: 3024, thumbSlug: "whiteboard-note",             category: "TRANSACTIONAL",    intent: "EPHEMERAL" },
  { id: "m11", filename: "Screenshot_2025-03-04-09-12-44.png",     ext: ".png",  sizeBytes: bytes(420_000),   width: 1170, height: 2532, thumbSlug: "screenshot-chat",             category: "SCREENSHOT",       intent: "EPHEMERAL" },
  { id: "m12", filename: "Screenshot_2025-03-08-14-02-17.png",     ext: ".png",  sizeBytes: bytes(380_000),   width: 1170, height: 2532, thumbSlug: "screenshot-confirm",          category: "SCREENSHOT",       intent: "EPHEMERAL" },
  { id: "m13", filename: "IMG-20250312-WA0014.jpg",                ext: ".jpg",  sizeBytes: bytes(190_000),   width: 1280, height: 960,  thumbSlug: "meme-cat",                    category: "MEME",             intent: "EPHEMERAL" },
  { id: "m14", filename: "IMG-20250318-WA0042.jpg",                ext: ".jpg",  sizeBytes: bytes(240_000),   width: 1280, height: 960,  thumbSlug: "whatsapp-fwd",                category: "WHATSAPP_FORWARD", intent: "EPHEMERAL" },
  { id: "m15", filename: "scan_passport_2024.pdf.jpg",             ext: ".jpg",  sizeBytes: bytes(1_540_000), width: 2480, height: 3508, thumbSlug: "doc-passport",                category: "DOCUMENT",         intent: "EPHEMERAL" },
  { id: "m16", filename: "IMG_20240712_181402 (copy).jpg",         ext: ".jpg",  sizeBytes: bytes(4_280_000), width: 4032, height: 3024, thumbSlug: "beach-sunset-copy-1",         category: "PHOTO",            intent: "KEEP_LONG_TERM" },
  { id: "m17", filename: "IMG_20240712_181402_BACKUP.jpg",         ext: ".jpg",  sizeBytes: bytes(4_280_000), width: 4032, height: 3024, thumbSlug: "beach-sunset-copy-2",         category: "PHOTO",            intent: "KEEP_LONG_TERM" },
  { id: "m18", filename: "IMG_20240803_093110_compressed.jpg",     ext: ".jpg",  sizeBytes: bytes(1_240_000), width: 1280, height: 960,  thumbSlug: "mountain-vista-small",        category: "PHOTO",            intent: "KEEP_LONG_TERM" },
  { id: "m19", filename: "IMG-20240803-WA0008.jpg",                ext: ".jpg",  sizeBytes: bytes(280_000),   width: 800,  height: 600,  thumbSlug: "mountain-vista-recompressed", category: "WHATSAPP_FORWARD", intent: "EPHEMERAL" },
];

export const demoItems: DemoMediaItem[] = ITEMS;

export function demoItemThumbUrl(item: DemoMediaItem): string {
  return thumbPath(item.thumbSlug);
}

export function demoStats() {
  const total = demoItems.reduce((acc, i) => acc + BigInt(i.sizeBytes), 0n);
  const byCategory = Object.entries(
    demoItems.reduce<Record<string, { n: number; bytes: bigint }>>((acc, i) => {
      acc[i.category] ??= { n: 0, bytes: 0n };
      acc[i.category]!.n++;
      acc[i.category]!.bytes += BigInt(i.sizeBytes);
      return acc;
    }, {}),
  )
    .map(([category, v]) => ({ category, n: v.n, bytes: v.bytes.toString() }))
    .sort((a, b) => b.n - a.n);

  return {
    totalItems: demoItems.length,
    totalBytes: total.toString(),
    byCategory,
    exactDupGroups: 1,
    exactDupBytes: (BigInt(demoItems[15]!.sizeBytes) + BigInt(demoItems[16]!.sizeBytes)).toString(),
    nearDupGroups: 1,
    unhashed: 0,
    unthumbed: 0,
    pendingJobs: 0,
  };
}

export function demoDuplicateGroups(kind: "EXACT" | "NEAR") {
  if (kind === "EXACT") {
    const members = [demoItems[0]!, demoItems[15]!, demoItems[16]!];
    const totalBytes = members.reduce((a, m) => a + BigInt(m.sizeBytes), 0n);
    return [
      {
        id: "dg_exact_1",
        kind: "EXACT",
        memberCount: 3,
        totalBytes: totalBytes.toString(),
        bestMediaId: members[0]!.id,
        bestPath: `/Volumes/SSD/Photos/DCIM/Camera/${members[0]!.filename}`,
        members: members.map((m, i) => ({
          mediaId: m.id,
          filename: m.filename,
          path: `/Volumes/SSD/Photos/${i === 0 ? "DCIM/Camera" : "WhatsApp/Sent"}/${m.filename}`,
          sizeBytes: m.sizeBytes,
          thumbSlug: m.thumbSlug,
          score: i === 0 ? 1.0 : 1.0,
          reason: i === 0 ? "best candidate" : "duplicate of best",
        })),
      },
    ];
  }
  const members = [demoItems[1]!, demoItems[17]!, demoItems[18]!];
  const totalBytes = members.reduce((a, m) => a + BigInt(m.sizeBytes), 0n);
  return [
    {
      id: "dg_near_1",
      kind: "NEAR",
      memberCount: 3,
      totalBytes: totalBytes.toString(),
      bestMediaId: members[0]!.id,
      bestPath: `/Volumes/SSD/Photos/DCIM/Camera/${members[0]!.filename}`,
      members: members.map((m, i) => ({
        mediaId: m.id,
        filename: m.filename,
        path: `/Volumes/SSD/Photos/${i === 0 ? "DCIM/Camera" : i === 1 ? "Downloads" : "WhatsApp/Media"}/${m.filename}`,
        sizeBytes: m.sizeBytes,
        thumbSlug: m.thumbSlug,
        score: i === 0 ? 1.0 : 0.93 - i * 0.05,
        reason: i === 0 ? "best of cluster" : `hamming=${2 + i}`,
      })),
    },
  ];
}

export function demoCleanupSignals() {
  const transactional = demoItems.filter((i) => i.intent === "EPHEMERAL");
  return {
    exact: { groups: 1, bytes: (BigInt(demoItems[15]!.sizeBytes) + BigInt(demoItems[16]!.sizeBytes)).toString() },
    near: { groups: 1, bytes: BigInt(demoItems[18]!.sizeBytes).toString() },
    screenshots: count(demoItems, (i) => i.category === "SCREENSHOT"),
    whatsapp: count(demoItems, (i) => i.category === "WHATSAPP_FORWARD"),
    transactional: count(transactional, () => true),
    blurry: { n: 0, bytes: "0" },
  };
}

export function demoOperations() {
  return [
    {
      id: "op_demo_1",
      kind: "TRASH",
      status: "COMPLETED",
      summary: "Move 2 file(s) to Trash · 8.2 MB",
      itemCount: 2,
      bytesAffected: (8_560_000).toString(),
      createdAt: new Date(Date.now() - 1000 * 60 * 32).toISOString(),
      finishedAt: new Date(Date.now() - 1000 * 60 * 32 + 2400).toISOString(),
      undoneAt: null,
    },
    {
      id: "op_demo_2",
      kind: "RENAME",
      status: "UNDONE",
      summary: "Rename 5 file(s)",
      itemCount: 5,
      bytesAffected: (15_400_000).toString(),
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 26).toISOString(),
      finishedAt: new Date(Date.now() - 1000 * 60 * 60 * 26 + 3800).toISOString(),
      undoneAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
    },
  ];
}

function count<T>(arr: T[], pred: (x: T) => boolean) {
  let n = 0;
  let bytes = 0n;
  for (const x of arr) {
    if (pred(x)) {
      n++;
      bytes += BigInt((x as unknown as { sizeBytes: string }).sizeBytes);
    }
  }
  return { n, bytes: bytes.toString() };
}
