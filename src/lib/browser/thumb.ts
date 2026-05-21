// Canvas-based thumbnail generation. 256-px max side, webp/jpeg encoded.
// "FromBitmap" variant accepts a pre-decoded ImageBitmap so callers can
// share the decode between dhash + thumbnail (the per-image hot path).

const TARGET = 256;

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onerror = () => reject(fr.error);
    fr.onload = () => resolve(fr.result as string);
    fr.readAsDataURL(blob);
  });
}

export interface ThumbOut {
  dataUrl: string;
  width: number;  // original bitmap width
  height: number; // original bitmap height
}

export async function makeThumbFromBitmap(bitmap: ImageBitmap): Promise<ThumbOut | null> {
  const aspect = bitmap.width / bitmap.height;
  const w = aspect >= 1 ? TARGET : Math.round(TARGET * aspect);
  const h = aspect >= 1 ? Math.round(TARGET / aspect) : TARGET;
  const canvas = new OffscreenCanvas(w, h);
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(bitmap, 0, 0, w, h);
  const out = await canvas
    .convertToBlob({ type: "image/webp", quality: 0.7 })
    .catch(() => canvas.convertToBlob({ type: "image/jpeg", quality: 0.75 }));
  if (!out) return null;
  const dataUrl = await blobToDataUrl(out);
  return { dataUrl, width: bitmap.width, height: bitmap.height };
}

export async function makeThumb(blob: Blob): Promise<ThumbOut | null> {
  const bitmap = await createImageBitmap(blob).catch(() => null);
  if (!bitmap) return null;
  try {
    return await makeThumbFromBitmap(bitmap);
  } finally {
    bitmap.close?.();
  }
}
