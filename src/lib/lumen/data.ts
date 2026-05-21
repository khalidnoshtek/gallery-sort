// Lumen mock library — ported from the design bundle's data.js.
// Replaced at runtime by real scan results when the user picks a folder.

export type PhotoCat = "photo" | "screenshot" | "meme" | "document" | "video" | "whatsapp";

export interface Photo {
  id: string;
  uid: string;
  url: string;
  urlSm: string;
  urlLg: string;
  cat: PhotoCat;
  filename: string;
  size: number;
  width: number;
  height: number;
  date: string;
  location: string;
  event: string | null;
  tags: string[];
  quality: number;
  aesthetic: number;
  blurry: boolean;
  dark: boolean;
  burst: boolean;
}

export interface DupMember {
  uid: string;
  filename: string;
  size: number;
  dims: [number, number];
  when: string;
  note: string;
  /** Optional explicit thumbnail URL (data: or http:). Falls back to UN(uid). */
  thumbUrl?: string;
}

export interface DupGroup {
  id: string;
  label: string;
  confidence: number;
  members: DupMember[];
}

export interface EventGroup {
  id: string;
  name: string;
  from: string;
  to: string;
  count: number;
  loc: string;
  cover: string;
}

export interface CleanupBucket {
  id: "dups" | "ws" | "shots" | "blur" | "burst" | "large";
  label: string;
  count: number;
  size: number;
  color: "lavender" | "amber" | "blue" | "rose" | "lime" | "violet";
  desc: string;
  confidence: number;
  recommended: string;
}

export interface CleanupSummary {
  totalScanned: number;
  driveTotal: number;
  driveUsed: number;
  photosUsed: number;
  reclaim: number;
  buckets: CleanupBucket[];
}

export interface Suggestion {
  id: string;
  title: string;
  body: string;
  primary: string;
  secondary: string;
  icon: "burst" | "shot" | "name" | "face" | "save";
  affected: number;
}

export const UN = (id: string, w = 480) =>
  `https://images.unsplash.com/photo-${id}?w=${w}&q=78&auto=format&fit=crop`;

const CURATED_IDS = [
  "1507525428034-b723cf961d3e",
  "1506905925346-21bda4d32df4",
  "1469854523086-cc02fe5d8800",
  "1464822759023-fed622ff2c3b",
  "1441974231531-c6227db76b6e",
  "1472214103451-9374bd1c798e",
  "1493558103817-58b2924bce98",
  "1518837695005-2083093ee35b",
  "1543466835-00a7907e9de1",
  "1514888286974-6c03e2ca1dba",
  "1583337130417-3346a1be7dee",
  "1504674900247-0877df9cc836",
  "1546069901-ba9599a7e63c",
  "1567620905732-2d1ec7ab7445",
  "1565299624946-b28f40a0ae38",
  "1494790108377-be9c29b29330",
  "1438761681033-6461ffad8d80",
  "1500648767791-00dcc994a43e",
  "1463453091185-61582044d556",
  "1480714378408-67cf0d13bc1b",
  "1449824913935-59a10b8d2000",
  "1502602898657-3e91760cbb34",
  "1488646953014-85cb44e25828",
  "1517649763962-0c623066013b",
  "1444723121867-7a241cacace9",
  "1542652694-40abf526446e",
];

const TAG_POOLS: Record<string, string[]> = {
  beach: ["beach", "sunset", "ocean", "sand", "waves"],
  mountain: ["mountains", "snow", "trek", "valley", "ridge"],
  food: ["food", "restaurant", "dinner", "breakfast", "coffee"],
  people: ["portrait", "people", "smile", "candid"],
  pet: ["dog", "cat", "pet", "puppy"],
  city: ["city", "skyline", "street", "night", "neon"],
  forest: ["forest", "tree", "green", "trail"],
  family: ["family", "indoor", "celebration"],
};
const POOL_NAMES = Object.keys(TAG_POOLS);

const LOCS = [
  { name: "Anjuna, Goa", event: "Goa Trip", date: "2024-02-22" },
  { name: "Palolem, Goa", event: "Goa Trip", date: "2024-02-23" },
  { name: "Manali, HP", event: "Himachal Trek", date: "2024-05-14" },
  { name: "Triund, HP", event: "Himachal Trek", date: "2024-05-15" },
  { name: "Solang, HP", event: "Himachal Trek", date: "2024-05-16" },
  { name: "Mumbai", event: "Date Night", date: "2024-08-03" },
  { name: "Pune", event: "Diwali 2023", date: "2023-11-12" },
  { name: "Pune", event: "Diwali 2023", date: "2023-11-13" },
  { name: "Lonavala", event: "Bike Ride", date: "2024-09-21" },
  { name: "Bali", event: "Bali '24", date: "2024-06-10" },
  { name: "Bali", event: "Bali '24", date: "2024-06-11" },
  { name: "Bali", event: "Bali '24", date: "2024-06-12" },
  { name: "Paris", event: "Europe '23", date: "2023-09-04" },
  { name: "Home", event: null, date: "2024-10-18" },
  { name: "Home", event: null, date: "2024-11-02" },
  { name: "Home", event: "Buddy", date: "2024-07-19" },
];

function buildPhotos(): Photo[] {
  const out: Photo[] = [];
  let seed = 1;
  const det = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
  const dpick = <T,>(arr: T[]) => arr[Math.floor(det() * arr.length)]!;

  CURATED_IDS.forEach((uid, i) => {
    const loc = dpick(LOCS);
    const pool = POOL_NAMES[i % POOL_NAMES.length]!;
    const tags = TAG_POOLS[pool]!.slice(0, 2 + Math.floor(det() * 2));
    const cat: PhotoCat =
      i > 4 && i % 11 === 0 ? "screenshot" :
      i > 4 && i % 17 === 0 ? "meme" :
      i > 4 && i % 23 === 0 ? "document" :
      i > 4 && i % 29 === 0 ? "video" :
      i > 4 && i % 13 === 0 ? "whatsapp" :
      "photo";
    const blurry = det() < 0.08;
    const dark = det() < 0.06;
    const burst = det() < 0.10;
    const quality = blurry ? 0.18 + det() * 0.2 : 0.62 + det() * 0.38;
    const aesthetic = dark ? 0.22 + det() * 0.2 : 0.40 + det() * 0.55;
    const dimsList: [number, number][] = [
      [4032, 3024], [4032, 3024], [3024, 4032], [1920, 1080], [4032, 3024],
    ];
    const dims = dimsList[i % 5]!;
    const sizeMult = cat === "screenshot" ? 0.0006 : cat === "video" ? 0.012 : 0.0015;
    const size = Math.round(dims[0] * dims[1] * sizeMult + det() * 200000);

    const id = `p${i + 1}`;
    const dateNum = loc.date.replace(/-/g, "");
    const filename =
      cat === "screenshot" ? `Screenshot_${dateNum}_${1100 + i}.png` :
      cat === "meme" ? `WhatsApp_Image_${dateNum}_${i}.jpg` :
      cat === "document" ? `IMG_${dateNum}_doc_${i}.jpg` :
      cat === "video" ? `VID_${dateNum}_${i}.mp4` :
      cat === "whatsapp" ? `IMG-${dateNum}-WA${String(i).padStart(4, "0")}.jpg` :
      `IMG_${dateNum}_${String((i * 7) % 100000).padStart(5, "0")}.jpg`;

    out.push({
      id,
      uid,
      url: `https://images.unsplash.com/photo-${uid}?w=520&q=78&auto=format&fit=crop`,
      urlSm: `https://images.unsplash.com/photo-${uid}?w=240&q=70&auto=format&fit=crop`,
      urlLg: `https://images.unsplash.com/photo-${uid}?w=1200&q=82&auto=format&fit=crop`,
      cat,
      filename,
      size,
      width: dims[0],
      height: dims[1],
      date: loc.date,
      location: loc.name,
      event: loc.event,
      tags,
      quality,
      aesthetic,
      blurry,
      dark,
      burst,
    });
  });
  return out;
}

export const PHOTOS: Photo[] = buildPhotos();

export const DUP_GROUPS: DupGroup[] = [
  {
    id: "dg1",
    label: "Beach sunset",
    confidence: 0.98,
    members: [
      { uid: "1507525428034-b723cf961d3e", filename: "IMG_20240222_193311.jpg", size: 4_812_300, dims: [4032, 3024], when: "2024-02-22 19:33", note: "Original" },
      { uid: "1507525428034-b723cf961d3e", filename: "IMG-20240222-WA0009.jpg", size: 312_400, dims: [1280, 960], when: "2024-02-23 09:11", note: "WhatsApp copy" },
      { uid: "1507525428034-b723cf961d3e", filename: "IMG_20240222_193311 (1).jpg", size: 4_811_900, dims: [4032, 3024], when: "2024-02-22 19:33", note: "Duplicate" },
    ],
  },
  {
    id: "dg2",
    label: "Triund ridge",
    confidence: 0.94,
    members: [
      { uid: "1506905925346-21bda4d32df4", filename: "IMG_20240515_071402.jpg", size: 5_230_100, dims: [4032, 3024], when: "2024-05-15 07:14", note: "Original" },
      { uid: "1506905925346-21bda4d32df4", filename: "IMG_20240515_071402-edit.jpg", size: 5_120_800, dims: [4032, 3024], when: "2024-05-15 07:31", note: "Slight crop" },
      { uid: "1506905925346-21bda4d32df4", filename: "Triund_2024.jpg", size: 412_300, dims: [1600, 1200], when: "2024-05-20 18:02", note: "Resized for share" },
      { uid: "1506905925346-21bda4d32df4", filename: "IMG-20240520-WA0012.jpg", size: 198_700, dims: [1280, 960], when: "2024-05-20 19:14", note: "WhatsApp copy" },
    ],
  },
  {
    id: "dg3",
    label: "Buddy on the rug",
    confidence: 0.91,
    members: [
      { uid: "1543466835-00a7907e9de1", filename: "IMG_20240719_154822.jpg", size: 3_840_200, dims: [4032, 3024], when: "2024-07-19 15:48", note: "Original" },
      { uid: "1543466835-00a7907e9de1", filename: "IMG_20240719_154823.jpg", size: 3_812_900, dims: [4032, 3024], when: "2024-07-19 15:48", note: "Burst frame" },
    ],
  },
  {
    id: "dg4",
    label: "Manali snowline",
    confidence: 0.86,
    members: [
      { uid: "1469854523086-cc02fe5d8800", filename: "IMG_20240514_104511.jpg", size: 4_120_300, dims: [4032, 3024], when: "2024-05-14 10:45", note: "Original" },
      { uid: "1469854523086-cc02fe5d8800", filename: "manali-2024-edited.jpg", size: 380_400, dims: [1800, 1350], when: "2024-05-14 22:01", note: "Edited copy" },
    ],
  },
];

export const EVENTS: EventGroup[] = [
  { id: "e1", name: "Goa Trip", from: "Feb 22, 2024", to: "Feb 25, 2024", count: 247, loc: "Goa", cover: "1507525428034-b723cf961d3e" },
  { id: "e2", name: "Himachal Trek", from: "May 14, 2024", to: "May 19, 2024", count: 412, loc: "Himachal Pradesh", cover: "1506905925346-21bda4d32df4" },
  { id: "e3", name: "Date Night", from: "Aug 3, 2024", to: "Aug 3, 2024", count: 28, loc: "Mumbai", cover: "1504674900247-0877df9cc836" },
  { id: "e4", name: "Diwali 2023", from: "Nov 12, 2023", to: "Nov 13, 2023", count: 184, loc: "Pune", cover: "1542652694-40abf526446e" },
  { id: "e5", name: "Bali '24", from: "Jun 10, 2024", to: "Jun 17, 2024", count: 638, loc: "Bali, Indonesia", cover: "1488646953014-85cb44e25828" },
  { id: "e6", name: "Bike Ride", from: "Sep 21, 2024", to: "Sep 21, 2024", count: 41, loc: "Lonavala", cover: "1517649763962-0c623066013b" },
  { id: "e7", name: "Europe '23", from: "Sep 4, 2023", to: "Sep 18, 2023", count: 1247, loc: "Paris · Rome · Lisbon", cover: "1502602898657-3e91760cbb34" },
  { id: "e8", name: "Buddy", from: "Mar 2023 — Now", to: "ongoing", count: 89, loc: "Home", cover: "1543466835-00a7907e9de1" },
];

export const CLEANUP: CleanupSummary = {
  totalScanned: 87421,
  driveTotal: 512 * 1024 ** 3,
  driveUsed: 389 * 1024 ** 3,
  photosUsed: 248 * 1024 ** 3,
  reclaim: 27.4 * 1024 ** 3,
  buckets: [
    { id: "dups", label: "Exact & visual duplicates", count: 1247, size: 14.2 * 1024 ** 3, color: "lavender", recommended: "review", desc: "Same photo saved multiple times. We picked the best copy of each.", confidence: 0.98 },
    { id: "ws", label: "WhatsApp junk", count: 3812, size: 4.7 * 1024 ** 3, color: "amber", recommended: "review", desc: "Forwarded memes, low-res copies, and chat thumbnails.", confidence: 0.92 },
    { id: "shots", label: "Screenshots & memes", count: 1934, size: 3.1 * 1024 ** 3, color: "blue", recommended: "review", desc: "Mostly older than 6 months. Search OCR text first.", confidence: 0.88 },
    { id: "blur", label: "Blurry & dark photos", count: 328, size: 1.8 * 1024 ** 3, color: "rose", recommended: "review", desc: "Pocket shots, missed focus, accidentally taken.", confidence: 0.81 },
    { id: "burst", label: "Burst sequences", count: 612, size: 2.4 * 1024 ** 3, color: "lime", recommended: "review", desc: "23 burst groups. We chose the sharpest frame of each.", confidence: 0.85 },
    { id: "large", label: "Large videos (>500 MB)", count: 18, size: 9.6 * 1024 ** 3, color: "violet", recommended: "review", desc: "Long clips you may want to archive or compress.", confidence: 0.70 },
  ],
};

export const SUGGESTIONS: Suggestion[] = [
  { id: "s1", title: "Keep the sharpest frame of 23 burst sequences", body: "612 photos · 2.4 GB · 96% confidence", primary: "Review burst groups", secondary: "Dismiss", icon: "burst", affected: 612 },
  { id: "s2", title: "Move 1,934 old screenshots to a Screenshots album", body: "3.1 GB · None opened in 6+ months", primary: "Create album", secondary: "Not now", icon: "shot", affected: 1934 },
  { id: "s3", title: "Auto-name 247 photos from Goa Trip", body: "goa-beach-sunset-feb-2024.jpg, +246 more", primary: "Preview names", secondary: "Edit template", icon: "name", affected: 247 },
  { id: "s4", title: "Group 89 photos of Buddy as a People album", body: "We detected one recurring face — name it?", primary: "Name this person", secondary: "Later", icon: "face", affected: 89 },
  { id: "s5", title: "Free up 14.2 GB by reviewing duplicates", body: "1,247 files across 412 duplicate groups", primary: "Open Cleanup", secondary: "Snooze a week", icon: "save", affected: 1247 },
];

export const SEMANTIC_RESULTS: Record<string, string[]> = {
  "beach sunset": ["1507525428034-b723cf961d3e", "1472214103451-9374bd1c798e", "1518837695005-2083093ee35b", "1493558103817-58b2924bce98"],
  "food in pune": ["1504674900247-0877df9cc836", "1546069901-ba9599a7e63c", "1565299624946-b28f40a0ae38", "1567620905732-2d1ec7ab7445"],
  "bike ride": ["1517649763962-0c623066013b"],
  "passport": [],
  "buddy": ["1543466835-00a7907e9de1", "1583337130417-3346a1be7dee"],
  "mountains": ["1469854523086-cc02fe5d8800", "1464822759023-fed622ff2c3b", "1506905925346-21bda4d32df4", "1493558103817-58b2924bce98", "1441974231531-c6227db76b6e", "1472214103451-9374bd1c798e"],
  "people": ["1500648767791-00dcc994a43e", "1494790108377-be9c29b29330", "1438761681033-6461ffad8d80", "1463453091185-61582044d556"],
};

export const SEARCH_SUGS = ["beach sunset", "mountains", "food in pune", "buddy", "bike ride", "people", "passport"];

// ─── Helpers ───────────────────────────────────────────────────────────

export const fmtBytes = (b: number): string => {
  if (b < 1024) return b + " B";
  if (b < 1024 ** 2) return (b / 1024).toFixed(1) + " KB";
  if (b < 1024 ** 3) return (b / 1024 ** 2).toFixed(1) + " MB";
  return (b / 1024 ** 3).toFixed(1) + " GB";
};

export const fmtCount = (n: number): string => n.toLocaleString("en-US");

export const monthOf = (d: string): string => {
  const date = new Date(d);
  return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
};
