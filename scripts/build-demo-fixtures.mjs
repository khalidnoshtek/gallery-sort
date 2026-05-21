#!/usr/bin/env node
// Generates demo fixture thumbnails into public/demo/thumbs/.
// Runs at build time of the GitHub Pages demo. NOT committed; .gitignored.
//
// Determinism: every image is a function of (seed, label) so re-runs
// produce byte-identical outputs.

import sharp from "sharp";
import { mkdir, rm } from "node:fs/promises";
import path from "node:path";

const OUT_DIR = path.resolve(process.cwd(), "public/demo/thumbs");

function svgGradient(seed, w, h, label) {
  const r = (seed * 53) % 255;
  const g = (seed * 97) % 255;
  const b = (seed * 31) % 255;
  const r2 = (seed * 17) % 255;
  const g2 = (seed * 23) % 255;
  const b2 = (seed * 41) % 255;
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
    <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="rgb(${r},${g},${b})"/>
      <stop offset="100%" stop-color="rgb(${r2},${g2},${b2})"/>
    </linearGradient></defs>
    <rect width="100%" height="100%" fill="url(#g)"/>
    <circle cx="${w * 0.7}" cy="${h * 0.3}" r="${Math.min(w, h) / 5}" fill="rgba(255,255,255,0.25)"/>
    <circle cx="${w * 0.25}" cy="${h * 0.75}" r="${Math.min(w, h) / 8}" fill="rgba(0,0,0,0.18)"/>
    <text x="50%" y="50%" font-size="${Math.min(w, h) / 8}" font-family="system-ui, -apple-system, sans-serif" font-weight="600" fill="white" text-anchor="middle" dy=".3em" opacity="0.95">${label}</text>
  </svg>`);
}

const SEEDS = [
  { id: "beach-sunset", label: "Beach", category: "PHOTO" },
  { id: "mountain-vista", label: "Mountains", category: "PHOTO" },
  { id: "city-night", label: "City", category: "PHOTO" },
  { id: "family-dinner", label: "Family", category: "PHOTO" },
  { id: "dog-park", label: "Pet", category: "PHOTO" },
  { id: "selfie", label: "Self", category: "SELFIE" },
  { id: "receipt-coffee", label: "Receipt", category: "RECEIPT" },
  { id: "parking-spot", label: "P-12B", category: "TRANSACTIONAL" },
  { id: "qr-menu", label: "QR", category: "TRANSACTIONAL" },
  { id: "whiteboard-note", label: "Notes", category: "TRANSACTIONAL" },
  { id: "screenshot-chat", label: "SS", category: "SCREENSHOT" },
  { id: "screenshot-confirm", label: "Order", category: "SCREENSHOT" },
  { id: "meme-cat", label: "lol", category: "MEME" },
  { id: "whatsapp-fwd", label: "WA", category: "WHATSAPP_FORWARD" },
  { id: "doc-passport", label: "Doc", category: "DOCUMENT" },
  // Duplicate set: same id base
  { id: "beach-sunset-copy-1", label: "Beach", category: "PHOTO" },
  { id: "beach-sunset-copy-2", label: "Beach", category: "PHOTO" },
  // Near-duplicate set
  { id: "mountain-vista-small", label: "Mtns", category: "PHOTO" },
  { id: "mountain-vista-recompressed", label: "Mtns'", category: "PHOTO" },
];

await rm(OUT_DIR, { recursive: true, force: true });
await mkdir(OUT_DIR, { recursive: true });

let i = 1;
for (const s of SEEDS) {
  const seed = s.id.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const out = path.join(OUT_DIR, `${s.id}.webp`);
  await sharp(svgGradient(seed, 512, 512, s.label))
    .webp({ quality: 78 })
    .toFile(out);
  i++;
}

console.log(`Wrote ${i - 1} demo thumbnails to ${OUT_DIR}`);
