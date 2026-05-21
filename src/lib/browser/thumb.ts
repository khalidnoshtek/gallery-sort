// Canvas-based thumbnail generation. 256-px max side, webp/jpeg encoded.

const TARGET = 256;

export async function makeThumb(blob: Blob): Promise<{ dataUrl: string; width: number; height: number } | null> {
  const bitmap = await createImageBitmap(blob).catch(() => null);
  if (!bitmap) return null;
  try {
    const aspect = bitmap.width / bitmap.height;
    const w = aspect >= 1 ? TARGET : Math.round(TARGET * aspect);
    const h = aspect >= 1 ? Math.round(TARGET / aspect) : TARGET;
    const canvas = new OffscreenCanvas(w, h);
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(bitmap, 0, 0, w, h);
    const out = await canvas.convertToBlob({ type: "image/webp", quality: 0.72 }).catch(async () => {
      // Some browsers don't support webp from OffscreenCanvas — fall back to jpeg.
      return canvas.convertToBlob({ type: "image/jpeg", quality: 0.78 });
    });
    if (!out) return null;
    const dataUrl = await blobToDataUrl(out);
    return { dataUrl, width: bitmap.width, height: bitmap.height };
  } finally {
    bitmap.close?.();
  }
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onerror = () => reject(fr.error);
    fr.onload = () => resolve(fr.result as string);
    fr.readAsDataURL(blob);
  });
}
