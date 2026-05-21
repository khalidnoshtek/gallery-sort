import { Gallery } from "@/components/gallery/gallery";
import { DemoBanner } from "@/components/layout/demo-banner";
import { IS_DEMO, demoItems } from "@/lib/demo/data";

export const dynamic = "force-dynamic";

interface Item {
  id: string;
  filename: string;
  ext: string;
  sizeBytes: string;
  width: number | null;
  height: number | null;
  thumbId: string | null;
  thumbSlug?: string;
  category: string;
  intent: string;
}

function getPage(): Item[] {
  if (IS_DEMO) {
    return demoItems.map((i) => ({
      id: i.id,
      filename: i.filename,
      ext: i.ext,
      sizeBytes: i.sizeBytes,
      width: i.width,
      height: i.height,
      thumbId: i.thumbSlug,
      thumbSlug: i.thumbSlug,
      category: i.category,
      intent: i.intent,
    }));
  }
  const { rawDb } = require("@/lib/db/raw") as typeof import("@/lib/db/raw");
  const db = rawDb();
  const rows = db
    .prepare(
      `SELECT mi.id, mi.filename, mi.ext, mi.sizeBytes, mi.width, mi.height, mi.category, mi.intent,
              t.id AS thumbId
         FROM MediaItem mi
         LEFT JOIN MediaThumbnail t ON t.mediaId = mi.id AND t.variant = 'thumb256'
        WHERE mi.isHidden = 0
        ORDER BY mi.id DESC
        LIMIT 500`
    )
    .all() as Array<Omit<Item, "sizeBytes"> & { sizeBytes: bigint }>;
  return rows.map((r) => ({ ...r, sizeBytes: r.sizeBytes.toString() }));
}

export default function LibraryPage() {
  let items: Item[] = [];
  try {
    items = getPage();
  } catch {}

  return (
    <div className="h-full">
      <div className="border-b px-8 py-4">
        <h1 className="text-xl font-semibold">Library</h1>
        <p className="text-xs text-muted-foreground">{items.length.toLocaleString()} item(s) shown · click to inspect</p>
      </div>
      <div className="px-8 pt-4"><DemoBanner /></div>
      <Gallery items={items} />
    </div>
  );
}
