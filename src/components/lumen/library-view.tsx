"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { PhotoCard } from "./photo-card";
import { monthOf, type Photo } from "@/lib/lumen/data";
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
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [drag, setDrag] = useState<DragState | null>(null);

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
    photos.forEach((p) => {
      const key = monthOf(p.date);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(p);
    });
    return [...map.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [photos]);

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

  if (gridStyle === "timeline") {
    return (
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
                <PhotoCard key={p.id} photo={p} selected={selected.has(p.id)} onToggle={toggle} height={180} useMock={useMock} />
              ))}
            </div>
          </section>
        ))}
        {dragRect}
      </div>
    );
  }

  return (
    <div ref={containerRef} className="lib-scroll" onMouseDown={onMouseDown}>
      <div className={`lib-grid ${gridStyle}`}>
        {photos.map((p, i) => (
          <PhotoCard key={p.id} photo={p} selected={selected.has(p.id)} onToggle={toggle} height={heightFor(i)} useMock={useMock} />
        ))}
      </div>
      {dragRect}
    </div>
  );
}
