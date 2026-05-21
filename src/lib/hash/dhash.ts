import sharp from "sharp";

// 64-bit dHash: resize to 9x8 grayscale, compare adjacent horizontal pixels.
// Tolerant of resize/recompression; cheaper than pHash; widely used in practice.

export async function dhashOfPath(path: string): Promise<bigint> {
  const { data } = await sharp(path)
    .grayscale()
    .resize(9, 8, { fit: "fill", kernel: "lanczos3" })
    .raw()
    .toBuffer({ resolveWithObject: true });

  let hash = 0n;
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const left = data[row * 9 + col]!;
      const right = data[row * 9 + col + 1]!;
      hash = (hash << 1n) | (left < right ? 1n : 0n);
    }
  }
  return hash;
}

export function hamming(a: bigint, b: bigint): number {
  let x = a ^ b;
  let count = 0;
  while (x !== 0n) {
    x &= x - 1n;
    count++;
  }
  return count;
}
