"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { useLibraryStore } from "@/state/library-store";
import { PhotoCard } from "./photo-card";
import { Lightbox } from "./lightbox";
import { SortMenu } from "./sort-menu";
import { monthOf, type Photo } from "@/lib/lumen/data";
import { sortItems, sortPhotos, type SortKey } from "@/lib/lumen/sort";
import type { GridStyle } from "./types";

function rectsOverlap(a: { left: number; right: number; top: number; bottom: number }, b: typeof a) {
  return !(a.right < b.left || a.left > b.right || a.bottom < b.top || a.top > b.bottom);
}

interface Props {
  photos: Photo[];
  selected: Set<string>;
  setSelected: Dispatch<SetStateAction<Set<string>>>;
  gridStyle: GridStyle;
  useMock?: boolean;
}

interface DragState {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  additive: boolean;
  start: Set<string>;
}

export function LibraryView({ photos, selected, setSelected, gridStyle, useMock = false }: Props) {
  const items = useLibraryStore((s) => s.items);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>(gridStyle === "timeline" ? "date-desc" : "date-desc");

  // Build a sorted version of `photos` for display. For timeline, the
  // "sortKey" decides ordering within each month section.
  const sortedPhotos = useMemo(() => sortPhotos(photos, sortKey), [photos, sortKey]);

  // Sorted real items in the same order as sortedPhotos — used by the lightbox.
  const sortedItems = useMemo(() => {
    const byId = new Map(items.map((it) => [it.id, it]));
    const out = sortedPhotos.map((p) => byId.get(p.id)).filter((x): x is NonNullable<typeof x> => Boolean(x));
    return out;
  }, [sortedPhotos, items]);

  const toggle = useCallback(
    (id: string) => {
      setSelected((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
    },
    [setSelected],
  );

  const onMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.closest(".card-check") || target.closest(".card")) return;
    const el = containerRef.current;
    if (!el) return;
    const c = el.getBoundingClientRect();
    const x = e.clientX - c.left;
    const y = e.clientY - c.top + el.scrollTop;
    setDrag({ x0: x, y0: y, x1: x, y1: y, additive: e.shiftKey || e.metaKey, start: new Set(selected) });
  };

  useEffect(() => {
    if (!drag) return;
    const move = (e: MouseEvent) => {
      const el = containerRef.current;
      if (!el) return;
      const c = el.getBoundingClientRect();
      const x1 = e.clientX - c.left;
      const y1 = e.clientY - c.top + el.scrollTop;
      setDrag((d) => (d ? { ...d, x1, y1 } : d));
      const rect = {
        left: Math.min(drag.x0, x1),
        right: Math.max(drag.x0, x1),
        top: Math.min(drag.y0, y1),
        bottom: Math.max(drag.y0, y1),
      };
      const cards = el.querySelectorAll<HTMLDivElement>(".card");
      const nowSel = new Set<string>(drag.additive ? drag.start : []);
      cards.forEach((cardEl) => {
        const r = cardEl.getBoundingClientRect();
        const rr = {
          left: r.left - c.left,
          right: r.right - c.left,
          top: r.top - c.top + el.scrollTop,
          bottom: r.bottom - c.top + el.scrollTop,
        };
        if (rectsOverlap(rect, rr)) {
          const id = cardEl.dataset.photoid;
          if (id) nowSel.add(id);
        }
      });
      setSelected(nowSel);
    };
    const up = () => setDrag(null);
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
    return () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    };
  }, [drag, setSelected]);

  const groups = useMemo(() => {
    const map = new Map<string, Photo[]>();
    sortedPhotos.forEach((p) => {
      const key = monthOf(p.date);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(p);
    });
    // Sort month buckets by recency of their newest item (regardless of inside-sort).
    return [...map.entries()].sort((a, b) => {
      const newestA = Math.max(...a[1].map((p) => new Date(p.date).getTime()));
      const newestB = Math.max(...b[1].map((p) => new Date(p.date).getTime()));
      return newestB - newestA;
    });
  }, [sortedPhotos]);

  const heightFor = (i: number) => {
    if (gridStyle === "uniform" || gridStyle === "timeline") return 180;
    const opts = [160, 220, 200, 260, 180, 240, 200, 220];
    return opts[i % opts.length]!;
  };

  const dragRect = drag && (
    <div
      className="drag-rect"
      style={{
        left: Math.min(drag.x0, drag.x1),
        top: Math.min(drag.y0, drag.y1),
        width: Math.abs(drag.x1 - drag.x0),
        height: Math.abs(drag.y1 - drag.y0),
      }}
    />
  );

  // Click handler that decides between drag-select (no-op) and lightbox.
  const onCardClick = (photoId: string) => {
    const idx = sortedPhotos.findIndex((p) => p.id === photoId);
    if (idx >= 0) setLightboxIndex(idx);
  };

  const sortBar = (
    <div style={{
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      padding: "10px 28px 0",
      gap: 10,
    }}>
      <span style={{ color: "var(--muted)", fontSize: 11.5, letterSpacing: "-0.005em" }}>
        {sortedPhotos.length.toLocaleString()} photo{sortedPhotos.length === 1 ? "" : "s"}
      </span>
      <SortMenu value={sortKey} onChange={setSortKey} />
    </div>
  );

  if (gridStyle === "timeline") {
    return (
      <>
        {sortBar}
        <div ref={containerRef} className="lib-scroll" onMouseDown={onMouseDown}>
          {groups.map(([month, items]) => (
            <section key={month} className="tl-section">
              <header className="tl-head">
                <div>
                  <div className="tl-month">{month}</div>
                  <div className="tl-sub">{items.length} photo{items.length === 1 ? "" : "s"}</div>
                </div>
              </header>
              <div className="lib-grid uniform">
                {items.map((p) => (
                  <ClickableCard
                    key={p.id}
                    photo={p}
                    selected={selected.has(p.id)}
                    onToggle={toggle}
                    onOpen={() => onCardClick(p.id)}
                    height={180}
                    useMock={useMock}
                  />
                ))}
              </div>
            </section>
          ))}
          {dragRect}
        </div>
        {lightboxIndex !== null && (
          <Lightbox
            items={sortedItems}
            startIndex={lightboxIndex}
            onClose={() => setLightboxIndex(null)}
          />
        )}
      </>
    );
  }

  return (
    <>
      {sortBar}
      <div ref={containerRef} className="lib-scroll" onMouseDown={onMouseDown}>
        <div className={`lib-grid ${gridStyle}`}>
          {sortedPhotos.map((p, i) => (
            <ClickableCard
              key={p.id}
              photo={p}
              selected={selected.has(p.id)}
              onToggle={toggle}
              onOpen={() => onCardClick(p.id)}
              height={heightFor(i)}
              useMock={useMock}
            />
          ))}
        </div>
        {dragRect}
      </div>
      {lightboxIndex !== null && (
        <Lightbox
          items={sortedItems}
          startIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />
      )}
    </>
  );
}

function ClickableCard({
  photo,
  selected,
  onToggle,
  onOpen,
  height,
  useMock,
}: {
  photo: Photo;
  selected: boolean;
  onToggle: (id: string) => void;
  onOpen: () => void;
  height: number;
  useMock: boolean;
}) {
  // Wrap the existing PhotoCard with a click handler that opens the lightbox
  // when the user clicks the image area (not the check button).
  return (
    <div
      onClick={(e) => {
        const target = e.target as HTMLElement;
        if (target.closest(".card-check")) return;
        onOpen();
      }}
      style={{ cursor: "zoom-in" }}
    >
      <PhotoCard
        photo={photo}
        selected={selected}
        onToggle={onToggle}
        height={height}
        useMock={useMock}
      />
    </div>
  );
}

// Re-export sortItems for callers (LumenApp uses it for the focus view sort)
export { sortItems };
