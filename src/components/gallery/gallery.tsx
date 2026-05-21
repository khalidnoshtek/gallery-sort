"use client";

import { useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { IS_DEMO, BASE_PATH } from "@/lib/demo/data";

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

const COLS = 6;
const CELL = 180;
const GAP = 6;

export function Gallery({ items }: { items: Item[] }) {
  const parentRef = useRef<HTMLDivElement | null>(null);
  const rowCount = Math.ceil(items.length / COLS);

  const rowVirtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => parentRef.current,
    estimateSize: () => CELL + GAP,
    overscan: 4,
  });

  return (
    <div ref={parentRef} className="h-[calc(100vh-10rem)] overflow-auto p-3">
      <div style={{ height: rowVirtualizer.getTotalSize(), position: "relative", width: "100%" }}>
        {rowVirtualizer.getVirtualItems().map((virtualRow) => {
          const start = virtualRow.index * COLS;
          const row = items.slice(start, start + COLS);
          return (
            <div
              key={virtualRow.key}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                transform: `translateY(${virtualRow.start}px)`,
                display: "grid",
                gridTemplateColumns: `repeat(${COLS}, 1fr)`,
                gap: GAP,
              }}
            >
              {row.map((it) => (
                <Cell key={it.id} item={it} />
              ))}
            </div>
          );
        })}
      </div>
      {items.length === 0 && (
        <div className="grid h-full place-items-center text-sm text-muted-foreground">
          Library is empty. Scan a folder to populate.
        </div>
      )}
    </div>
  );
}

function thumbSrc(item: Item): string | null {
  if (IS_DEMO) {
    return item.thumbSlug ? `${BASE_PATH}/demo/thumbs/${item.thumbSlug}.webp` : null;
  }
  return item.thumbId ? `/api/media/${item.id}/thumbnail` : null;
}

function Cell({ item }: { item: Item }) {
  const src = thumbSrc(item);
  return (
    <div className="group relative aspect-square overflow-hidden rounded-md bg-secondary/50">
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={item.filename}
          loading="lazy"
          decoding="async"
          className="size-full object-cover transition group-hover:scale-[1.02]"
        />
      ) : (
        <div className="grid size-full place-items-center text-xs text-muted-foreground">
          <span>{item.ext.replace(".", "").toUpperCase()}</span>
        </div>
      )}
      <div className="absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/70 to-transparent px-2 py-1 text-[10px] text-white opacity-0 transition group-hover:opacity-100">
        {item.filename}
      </div>
      {item.intent === "EPHEMERAL" && (
        <span className="absolute right-1 top-1 rounded bg-amber-400/90 px-1 py-0.5 text-[9px] font-medium uppercase text-black">
          ephemeral
        </span>
      )}
    </div>
  );
}
