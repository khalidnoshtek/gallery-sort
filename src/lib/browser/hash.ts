// Browser-side hashing. SHA-256 via Web Crypto; dHash via canvas + 8×8 grayscale.
//
// The "fromBitmap" variant lets callers decode an image ONCE and reuse the
// ImageBitmap for both dhash and thumbnail — that's ~2x faster than calling
// createImageBitmap separately for each.

const toHex = (buf: ArrayBuffer) =>
  [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");

export async function sha256OfBlob(blob: Blob): Promise<string> {
  const buf = await blob.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return toHex(digest);
}

export function computeDHashFromBitmap(bitmap: ImageBitmap): string {
  const W = 9;
  const H = 8;
  const canvas = new OffscreenCanvas(W, H);
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return "0000000000000000";
  ctx.drawImage(bitmap, 0, 0, W, H);
  const data = ctx.getImageData(0, 0, W, H).data;
  const gray = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) {
    const r = data[i * 4]!;
    const g = data[i * 4 + 1]!;
    const b = data[i * 4 + 2]!;
    gray[i] = Math.round(0.2126 * r + 0.7152 * g + 0.0722 * b);
  }
  let bits = 0n;
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const left = gray[row * W + col]!;
      const right = gray[row * W + col + 1]!;
      bits = (bits << 1n) | (left < right ? 1n : 0n);
    }
  }
  return bits.toString(16).padStart(16, "0");
}

export async function dhashOfBlob(blob: Blob): Promise<string> {
  const bitmap = await createImageBitmap(blob).catch(() => null);
  if (!bitmap) return "0000000000000000";
  try {
    return computeDHashFromBitmap(bitmap);
  } finally {
    bitmap.close?.();
  }
}

export function hamming(aHex: string, bHex: string): number {
  const a = BigInt("0x" + aHex);
  const b = BigInt("0x" + bHex);
  let x = a ^ b;
  let count = 0;
  while (x !== 0n) {
    x &= x - 1n;
    count++;
  }
  return count;
}
