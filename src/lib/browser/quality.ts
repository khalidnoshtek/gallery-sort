// Quality scoring — runs on the decoded thumbnail (not the full-resolution
// image) so it's fast. Pure math, no ML.
//
// blurScore: variance of Laplacian — the classic blur metric.
//   1. convert to grayscale
//   2. apply 3×3 Laplacian kernel
//   3. variance of the result
// Higher variance = more high-frequency detail = sharper image.
//
// brightness: mean luma 0..1. Used to flag dark / overexposed pocket shots.

export interface QualityScores {
  blurScore: number;   // variance of Laplacian (typical range 0..1000+)
  brightness: number;  // mean luma 0..1
}

export function computeQualityFromBitmap(bitmap: ImageBitmap): QualityScores | null {
  // Downsample to a fixed size — variance scales with image dimensions, so
  // using a constant size makes thresholds portable across photo sizes.
  const W = 128;
  const H = 128;
  const canvas = new OffscreenCanvas(W, H);
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(bitmap, 0, 0, W, H);
  const data = ctx.getImageData(0, 0, W, H).data;

  // Pre-compute grayscale (Rec. 709 luma).
  const gray = new Float32Array(W * H);
  let sumLuma = 0;
  for (let i = 0; i < W * H; i++) {
    const r = data[i * 4]!;
    const g = data[i * 4 + 1]!;
    const b = data[i * 4 + 2]!;
    const y = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    gray[i] = y;
    sumLuma += y;
  }
  const brightness = sumLuma / (W * H);

  // 3x3 Laplacian kernel:  0  1  0
  //                        1 -4  1
  //                        0  1  0
  // Skip the 1-pixel border. Compute mean + variance of the response.
  let sum = 0;
  let sumSq = 0;
  let count = 0;
  for (let y = 1; y < H - 1; y++) {
    for (let x = 1; x < W - 1; x++) {
      const i = y * W + x;
      const lap =
        gray[i - W]! +
        gray[i + W]! +
        gray[i - 1]! +
        gray[i + 1]! -
        4 * gray[i]!;
      sum += lap;
      sumSq += lap * lap;
      count++;
    }
  }
  const mean = sum / count;
  // Multiply by 1e6 so the score lands in a human-readable 0..2000+ range.
  // (Luma values are 0..1, so the raw variance is tiny.)
  const variance = (sumSq / count - mean * mean) * 1_000_000;

  return { blurScore: variance, brightness };
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
