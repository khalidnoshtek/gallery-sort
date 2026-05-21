"use client";

import { EVENTS, PHOTOS, UN, fmtCount } from "@/lib/lumen/data";
import { PhotoCard } from "./photo-card";
import type { GridStyle } from "./types";

interface Props {
  albumId: string;
  gridStyle: GridStyle;
  useMock?: boolean;
  showConfidence?: boolean;
}

export function EventView({ albumId, gridStyle, useMock = false, showConfidence = true }: Props) {
  const e = EVENTS.find((x) => x.id === albumId) || EVENTS[0]!;
  const photos = PHOTOS.filter((p) => p.event === e.name);

  return (
    <div className="view">
      <header className="ev-hero" style={{ backgroundImage: `url(${UN(e.cover, 1400)})` }}>
        <div className="ev-veil" />
        <div className="ev-meta">
          <div className="ev-eyebrow">Memory · auto-detected by time + location + visual clustering</div>
          <h2>{e.name}</h2>
          <p>{e.from} — {e.to} · {e.loc} · {fmtCount(e.count)} photos</p>
        </div>
      </header>
      <div className={`lib-grid ${gridStyle === "timeline" ? "uniform" : gridStyle}`}>
        {photos.slice(0, 30).map((p, i) => (
          <PhotoCard
            key={p.id}
            photo={p}
            selected={false}
            onToggle={() => {}}
            height={gridStyle === "uniform" ? 180 : [180, 220, 200, 260, 180, 240, 200, 220][i % 8]}
            showConfidence={showConfidence}
            useMock={useMock}
          />
        ))}
      </div>
    </div>
  );
}
