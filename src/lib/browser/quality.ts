// Quality scoring — runs on the decoded thumbnail (not the full-resolution
// image) so it's fast. Pure math, no ML.
//
// blurScore: variance of Laplacian on grayscale. Higher = sharper.
// brightness: mean luma 0..1. Used for dark / overexposed detection.
// colorVariance: average per-channel variance of RGB. Low values =
//   monochrome / blank / accidental black-frame photos (a wall, the inside
//   of a pocket, a finger over the lens). High = real-world content.

export interface QualityScores {
  blurScore: number;
  brightness: number;
  colorVariance: number;
}

export function computeQualityFromBitmap(bitmap: ImageBitmap): QualityScores | null {
  const W = 128;
  const H = 128;
  const N = W * H;
  const canvas = new OffscreenCanvas(W, H);
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(bitmap, 0, 0, W, H);
  const data = ctx.getImageData(0, 0, W, H).data;

  // Single pass: grayscale, channel sums, luma sum.
  const gray = new Float32Array(N);
  let sumR = 0, sumG = 0, sumB = 0, sumLuma = 0;
  for (let i = 0; i < N; i++) {
    const r = data[i * 4]!;
    const g = data[i * 4 + 1]!;
    const b = data[i * 4 + 2]!;
    sumR += r;
    sumG += g;
    sumB += b;
    const y = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    gray[i] = y;
    sumLuma += y;
  }
  const brightness = sumLuma / N;
  const meanR = sumR / N;
  const meanG = sumG / N;
  const meanB = sumB / N;

  // Second pass: color variance per channel, plus the Laplacian.
  let varR = 0, varG = 0, varB = 0;
  for (let i = 0; i < N; i++) {
    const r = data[i * 4]!;
    const g = data[i * 4 + 1]!;
    const b = data[i * 4 + 2]!;
    varR += (r - meanR) * (r - meanR);
    varG += (g - meanG) * (g - meanG);
    varB += (b - meanB) * (b - meanB);
  }
  // Average per-channel variance — typical real photo: 1000–6000+,
  // mostly-blank photo: 50–300, near-perfectly uniform: < 50.
  const colorVariance = (varR + varG + varB) / (3 * N);

  // Laplacian variance (blur score). Skip a 1-pixel border.
  let sumLap = 0;
  let sumSqLap = 0;
  let countLap = 0;
  for (let y = 1; y < H - 1; y++) {
    for (let x = 1; x < W - 1; x++) {
      const i = y * W + x;
      const lap =
        gray[i - W]! +
        gray[i + W]! +
        gray[i - 1]! +
        gray[i + 1]! -
        4 * gray[i]!;
      sumLap += lap;
      sumSqLap += lap * lap;
      countLap++;
    }
  }
  const meanLap = sumLap / countLap;
  const blurScore = (sumSqLap / countLap - meanLap * meanLap) * 1_000_000;

  return { blurScore, brightness, colorVariance };
}

export function isBlurry(blurScore: number): boolean {
  return blurScore < 30;
}

export function isDark(brightness: number): boolean {
  return brightness < 0.18;
}

export function isOverexposed(brightness: number): boolean {
  return brightness > 0.92;
}

/** A near-blank / near-monochrome photo. Walls, lens-covered, accidental. */
export function isBlank(colorVariance: number): boolean {
  return colorVariance < 200;
}
