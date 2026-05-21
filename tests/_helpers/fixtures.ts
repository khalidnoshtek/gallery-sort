import path from "node:path";
import { promises as fsp } from "node:fs";
import sharp from "sharp";

// Generate test images at runtime — no binary fixtures committed.
// All images are deterministic given (seed, w, h).

export interface FixtureResult {
  paths: string[];
  byKind: {
    distinct: string[];      // visually distinct images
    duplicates: string[];    // exact byte copies of distinct[0]
    nearDuplicates: string[]; // recompressed/resized copies of distinct[0]
    screenshots: string[];   // named with Screenshot_*
  };
}

function svgGradient(seed: number, w: number, h: number): Buffer {
  const r = (seed * 53) % 255;
  const g = (seed * 97) % 255;
  const b = (seed * 31) % 255;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
    <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="rgb(${r},${g},${b})"/>
      <stop offset="100%" stop-color="rgb(${b},${r},${g})"/>
    </linearGradient></defs>
    <rect width="100%" height="100%" fill="url(#g)"/>
    <circle cx="${w / 2}" cy="${h / 2}" r="${Math.min(w, h) / 4}" fill="rgba(255,255,255,0.3)"/>
    <text x="50%" y="50%" font-size="${Math.min(w, h) / 6}" fill="white" text-anchor="middle" dy=".3em">${seed}</text>
  </svg>`;
  return Buffer.from(svg);
}

export async function generateFixtures(libraryDir: string): Promise<FixtureResult> {
  await fsp.mkdir(libraryDir, { recursive: true });
  const screenshotsDir = path.join(libraryDir, "Screenshots");
  await fsp.mkdir(screenshotsDir, { recursive: true });

  const result: FixtureResult = {
    paths: [],
    byKind: { distinct: [], duplicates: [], nearDuplicates: [], screenshots: [] },
  };

  // 5 distinct images
  for (let i = 1; i <= 5; i++) {
    const p = path.join(libraryDir, `photo_${i}.jpg`);
    await sharp(svgGradient(i, 800, 600)).jpeg({ quality: 90 }).toFile(p);
    result.paths.push(p);
    result.byKind.distinct.push(p);
  }

  // Exact duplicates of photo_1.jpg
  const original = result.byKind.distinct[0]!;
  const buf = await fsp.readFile(original);
  for (let i = 1; i <= 2; i++) {
    const p = path.join(libraryDir, `photo_1_copy_${i}.jpg`);
    await fsp.writeFile(p, buf);
    result.paths.push(p);
    result.byKind.duplicates.push(p);
  }

  // Near-duplicate of photo_1.jpg (resized/recompressed)
  const near1 = path.join(libraryDir, "photo_1_smaller.jpg");
  await sharp(original).resize(400, 300).jpeg({ quality: 70 }).toFile(near1);
  result.paths.push(near1);
  result.byKind.nearDuplicates.push(near1);

  const near2 = path.join(libraryDir, "photo_1_recompressed.jpg");
  await sharp(original).jpeg({ quality: 40 }).toFile(near2);
  result.paths.push(near2);
  result.byKind.nearDuplicates.push(near2);

  // Screenshots
  for (let i = 1; i <= 2; i++) {
    const p = path.join(screenshotsDir, `Screenshot_2024-05-${10 + i}.png`);
    await sharp(svgGradient(100 + i, 1170, 2532)).png().toFile(p);
    result.paths.push(p);
    result.byKind.screenshots.push(p);
  }

  return result;
}
