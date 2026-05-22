"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { useLibraryStore } from "@/state/library-store";
import { PhotoCard } from "./photo-card";
import { Lightbox } from "./lightbox";
import { SortMenu } from "./sort-menu";
import { monthOf, type Photo, type PhotoCat } from "@/lib/lumen/data";
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

// Category filter — null means "no filter, show all"
type CatFilter = PhotoCat | "all";

const FILTERS: Array<{ key: CatFilter; label: string }> = [
  { key: "all", label: "All" },
  { key: "photo", label: "Photos" },
  { key: "screenshot", label: "Screenshots" },
  { key: "video", label: "Videos" },
  { key: "document", label: "Docs" },
  { key: "whatsapp", label: "WhatsApp" },
  { key: "meme", label: "Memes" },
];

export function LibraryView({ photos, selected, setSelected, gridStyle, useMock = false }: Props) {
  const items = useLibraryStore((s) => s.items);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("date-desc");
  const [catFilter, setCatFilter] = useState<CatFilter>("all");

  // Filter then sort
  const filteredPhotos = useMemo(() => {
    if (catFilter === "all") return photos;
    return photos.filter((p) => p.cat === catFilter);
  }, [photos, catFilter]);

  const sortedPhotos = useMemo(() => sortPhotos(filteredPhotos, sortKey), [filteredPhotos, sortKey]);

  const sortedItems = useMemo(() => {
    const byId = new Map(items.map((it) => [it.id, it]));
    return sortedPhotos.map((p) => byId.get(p.id)).filter((x): x is NonNullable<typeof x> => Boolean(x));
  }, [sortedPhotos, items]);

  // Per-category counts (against the full unfiltered list) for the chip labels
  const catCounts = useMemo(() => {
    const counts: Partial<Record<PhotoCat | "all", number>> = { all: photos.length };
    for (const p of photos) counts[p.cat] = (counts[p.cat] ?? 0) + 1;
    return counts;
  }, [photos]);

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
    return [...map.entries()].sort((a, b) => {
      const newestA = Math.max(...a[1].map((p) => new Date(p.date).getTime()));
      const newestB = Math.max(...b[1].map((p) => new Date(p.date).getTime()));
      return newestB - newestA;
    });
  }, [sortedPhotos]);

  const heightFor = (i: number) => {
    if (gridStyle === "uniform" || gridStyle === "timeline") return 220;
    const opts = [220, 280, 240, 320, 220, 300, 240, 280];
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

  const onCardClick = (photoId: string) => {
    const idx = sortedPhotos.findIndex((p) => p.id === photoId);
    if (idx >= 0) setLightboxIndex(idx);
  };

  const toolbar = (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        padding: "14px 28px",
        borderBottom: "0.5px solid var(--border-soft)",
        background: "var(--bg-2)",
        flexWrap: "wrap",
      }}
    >
      {/* Filter chips */}
      <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", minWidth: 0 }}>
        <span style={{ color: "var(--muted)", fontSize: 11, letterSpacing: "0.04em", textTransform: "uppercase", marginRight: 4 }}>
          Filter
        </span>
        {FILTERS.map((f) => {
          const count = catCounts[f.key] ?? 0;
          if (f.key !== "all" && count === 0) return null;
          const active = catFilter === f.key;
          return (
            <button
              key={f.key}
              onClick={() => setCatFilter(f.key)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "6px 11px",
                borderRadius: 999,
                background: active ? "var(--text)" : "rgba(255,255,255,0.025)",
                color: active ? "#0e0d10" : "var(--secondary)",
                border: active ? "0" : "0.5px solid var(--border-soft)",
                fontSize: 12,
                cursor: "default",
                letterSpacing: "-0.005em",
                transition: "background 0.12s, color 0.12s",
              }}
            >
              {f.label}
              <span
                style={{
                  fontFamily: "var(--mono)",
                  fontSize: 10.5,
                  opacity: 0.7,
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Sort */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
        <span style={{ color: "var(--muted)", fontSize: 11, letterSpacing: "0.04em", textTransform: "uppercase" }}>
          Sort
        </span>
        <SortMenu value={sortKey} onChange={setSortKey} />
      </div>
    </div>
  );

  // Empty state for filter that removed everything
  if (sortedPhotos.length === 0 && photos.length > 0) {
    return (
      <>
        {toolbar}
        <div className="lib-scroll">
          <div style={{ textAlign: "center", padding: 64, color: "var(--muted)" }}>
            <h3 style={{ fontFamily: "var(--display)", fontSize: 18, fontWeight: 500, color: "var(--text)", margin: 0 }}>
              No {FILTERS.find((f) => f.key === catFilter)?.label.toLowerCase() ?? "items"} to show
            </h3>
            <p style={{ marginTop: 8, fontSize: 13 }}>
              Try a different filter, or scan another folder.
            </p>
            <button
              onClick={() => setCatFilter("all")}
              className="btn ghost"
              style={{ marginTop: 16 }}
            >
              Show all
            </button>
          </div>
        </div>
      </>
    );
  }

  if (gridStyle === "timeline") {
    return (
      <>
        {toolbar}
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
                    height={220}
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
      {toolbar}
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

export { sortItems };
