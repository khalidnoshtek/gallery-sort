import { rawDb } from "@/lib/db/raw";
import { Gallery } from "@/components/gallery/gallery";

export const dynamic = "force-dynamic";

interface Item {
  id: string;
  filename: string;
  ext: string;
  sizeBytes: string;
  width: number | null;
  height: number | null;
  thumbId: string | null;
  category: string;
  intent: string;
}

function getPage(limit = 500, cursor: string | null = null): Item[] {
  const db = rawDb();
  const where = cursor ? `AND mi.id < ?` : ``;
  const params: unknown[] = cursor ? [cursor] : [];
  const rows = db
    .prepare(
      `SELECT mi.id, mi.filename, mi.ext, mi.sizeBytes, mi.width, mi.height, mi.category, mi.intent,
              t.id AS thumbId
         FROM MediaItem mi
         LEFT JOIN MediaThumbnail t ON t.mediaId = mi.id AND t.variant = 'thumb256'
        WHERE mi.isHidden = 0 ${where}
        ORDER BY mi.id DESC
        LIMIT ?`
    )
    .all(...params, limit) as Array<Omit<Item, "sizeBytes"> & { sizeBytes: bigint }>;
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
      <Gallery items={items} />
    </div>
  );
}
