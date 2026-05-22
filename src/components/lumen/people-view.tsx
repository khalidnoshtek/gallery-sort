"use client";

import { useMemo, useState } from "react";
import { useLibraryStore } from "@/state/library-store";
import { clusterFaces } from "@/lib/browser/ai";
import { adaptPhoto } from "@/lib/lumen/adapter";
import { fmtCount } from "@/lib/lumen/data";
import type { BrowserMediaItem, FaceCluster } from "@/lib/browser/types";
import { PhotoCard } from "./photo-card";
import { IconFace, IconSparkle } from "./icons";

function buildClusters(items: BrowserMediaItem[]): FaceCluster[] {
  const refs: Array<{ itemId: string; faceIdx: number; descriptor: number[] }> = [];
  for (const it of items) {
    if (!it.faces || it.faces.length === 0) continue;
    it.faces.forEach((f, faceIdx) => {
      refs.push({ itemId: it.id, faceIdx, descriptor: f.descriptor });
    });
  }
  const raw = clusterFaces(refs);
  return raw.map((c, i) => {
    const itemIds = new Set(c.members.map((m) => m.itemId));
    return {
      id: `person-${i + 1}`,
      label: null,
      memberItemIds: [...itemIds],
      representativeItemId: c.representativeItemId,
      representativeFaceIdx: c.representativeFaceIdx,
      size: itemIds.size,
    };
  });
}

export function PeopleView() {
  const items = useLibraryStore((s) => s.items);
  const hasAnyFaces = useMemo(() => items.some((i) => i.faces && i.faces.length > 0), [items]);
  const clusters = useMemo(() => (hasAnyFaces ? buildClusters(items) : []), [items, hasAnyFaces]);
  const [activeId, setActiveId] = useState<string | null>(null);

  const itemsById = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);

  if (!hasAnyFaces) {
    return (
      <div className="view">
        <div className="trash-empty">
          <IconFace size={28} style={{ opacity: 0.3 }} />
          <h2>No people detected yet.</h2>
          <p>
            Run AI analysis to detect and cluster faces across your library. Lumen uses
            face-api locally — no images leave your machine.
          </p>
        </div>
      </div>
    );
  }

  if (clusters.length === 0) {
    return (
      <div className="view">
        <div className="trash-empty">
          <IconFace size={28} style={{ opacity: 0.3 }} />
          <h2>Faces detected, but no clusters yet.</h2>
          <p>Clusters form when two or more photos share a similar face. Try a larger library.</p>
        </div>
      </div>
    );
  }

  const active = activeId ? clusters.find((c) => c.id === activeId) : null;

  if (active) {
    const photos = active.memberItemIds
      .map((id) => itemsById.get(id))
      .filter((i): i is BrowserMediaItem => Boolean(i))
      .map(adaptPhoto);

    return (
      <div className="view">
        <header className="qv-head">
          <div>
            <div className="dup-eyebrow">Person cluster · {active.size} photos</div>
            <h2>{active.label ?? `Person ${active.id.split("-")[1] ?? ""}`}</h2>
            <p>{fmtCount(active.size)} photos · clustered by face similarity (L2 &lt; 0.55)</p>
          </div>
          <button className="btn ghost" onClick={() => setActiveId(null)}>← All people</button>
        </header>
        <div className="lib-grid uniform">
          {photos.map((p) => (
            <PhotoCard key={p.id} photo={p} selected={false} onToggle={() => {}} height={180} useMock={false} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="view">
      <header className="qv-head">
        <div>
          <h2>People</h2>
          <p>
            {clusters.length} face cluster{clusters.length === 1 ? "" : "s"} found · click any to see all photos
          </p>
        </div>
        <button className="btn ghost" disabled>
          <IconSparkle size={13} /> Locally clustered
        </button>
      </header>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 16 }}>
        {clusters.map((c) => {
          const repItem = itemsById.get(c.representativeItemId);
          const face = repItem?.faces?.[c.representativeFaceIdx];
          const thumb = repItem?.thumbDataUrl;
          return (
            <button
              key={c.id}
              onClick={() => setActiveId(c.id)}
              style={{
                background: "var(--surface)",
                border: "0.5px solid var(--border-soft)",
                borderRadius: 12,
                overflow: "hidden",
                cursor: "default",
                padding: 0,
                textAlign: "left",
                transition: "background 0.15s, border-color 0.15s",
              }}
            >
              <div style={{ aspectRatio: "1 / 1", position: "relative", overflow: "hidden", background: "var(--surface-2)" }}>
                {thumb && face ? (
                  <ZoomedFace src={thumb} face={face} repWidth={repItem?.width ?? 0} repHeight={repItem?.height ?? 0} />
                ) : (
                  <div style={{ display: "grid", placeItems: "center", height: "100%", color: "var(--muted)", fontSize: 11 }}>
                    {c.size}
                  </div>
                )}
              </div>
              <div style={{ padding: "12px 14px" }}>
                <div style={{ fontFamily: "var(--display)", fontSize: 14.5, fontWeight: 500, letterSpacing: "-0.018em" }}>
                  {c.label ?? `Person ${c.id.split("-")[1] ?? ""}`}
                </div>
                <div style={{ color: "var(--muted)", fontSize: 11.5, marginTop: 3, letterSpacing: "-0.005em" }}>
                  {fmtCount(c.size)} photo{c.size === 1 ? "" : "s"}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ZoomedFace({ src, face, repWidth, repHeight }: { src: string; face: { x: number; y: number; w: number; h: number }; repWidth: number; repHeight: number }) {
  if (!repWidth || !repHeight) {
    /* eslint-disable-next-line @next/next/no-img-element */
    return <img src={src} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />;
  }
  // Center on face: compute object-position so the face is centered, and
  // scale so the face takes ~60% of the tile.
  const targetSize = 0.6; // face occupies 60% of tile
  const faceFrac = Math.min(face.w / repWidth, face.h / repHeight) || 0.1;
  const scale = targetSize / faceFrac;
  const cx = (face.x + face.w / 2) / repWidth;
  const cy = (face.y + face.h / 2) / repHeight;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      style={{
        position: "absolute",
        left: "50%",
        top: "50%",
        width: `${scale * 100}%`,
        height: `${scale * 100}%`,
        objectFit: "cover",
        objectPosition: `${cx * 100}% ${cy * 100}%`,
        transform: `translate(${-cx * 100}%, ${-cy * 100}%)`,
      }}
    />
  );
}
