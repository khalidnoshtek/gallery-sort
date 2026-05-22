"use client";

import { useMemo } from "react";
import { useLibraryStore } from "@/state/library-store";
import { clusterFaces } from "@/lib/browser/ai";
import { fmtCount } from "@/lib/lumen/data";
import type { BrowserMediaItem, FaceCluster } from "@/lib/browser/types";
import { IconFace, IconSparkle } from "./icons";
import type { FocusContext } from "./types";

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

interface Props {
  openFocus: (ctx: FocusContext) => void;
  onRunAi: () => void;
}

export function PeopleView({ openFocus, onRunAi }: Props) {
  const items = useLibraryStore((s) => s.items);
  const totalFaces = useMemo(() => items.reduce((a, i) => a + (i.faces?.length ?? 0), 0), [items]);
  const clusters = useMemo(() => (totalFaces > 0 ? buildClusters(items) : []), [items, totalFaces]);
  const itemsById = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);

  // Singletons (faces detected but no cluster) — collect for visibility
  const clusteredIds = useMemo(() => new Set(clusters.flatMap((c) => c.memberItemIds)), [clusters]);
  const singletonItems = useMemo(
    () => items.filter((i) => (i.faces?.length ?? 0) > 0 && !clusteredIds.has(i.id)),
    [items, clusteredIds],
  );

  if (items.length === 0) {
    return (
      <div className="view">
        <div className="trash-empty">
          <IconFace size={28} style={{ opacity: 0.3 }} />
          <h2>No library yet.</h2>
          <p>Scan a folder to begin.</p>
        </div>
      </div>
    );
  }

  if (totalFaces === 0) {
    return (
      <div className="view">
        <div className="trash-empty">
          <IconFace size={28} style={{ opacity: 0.3 }} />
          <h2>No faces detected yet.</h2>
          <p>
            Run AI analysis to detect and cluster faces. Lumen uses face-api locally — no images
            ever leave your machine.
          </p>
          <button className="btn primary" onClick={onRunAi} style={{ marginTop: 16 }}>
            <IconSparkle size={13} /> Enable AI analysis
          </button>
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
            {fmtCount(totalFaces)} face{totalFaces === 1 ? "" : "s"} found · {clusters.length} cluster{clusters.length === 1 ? "" : "s"}
            {singletonItems.length > 0 && ` · ${singletonItems.length} solo face${singletonItems.length === 1 ? "" : "s"}`}
            {" "}· grouped by L2 distance &lt; 0.55
          </p>
        </div>
        <button className="btn ghost" onClick={onRunAi}>
          <IconSparkle size={13} /> Re-run AI
        </button>
      </header>

      {clusters.length === 0 ? (
        <div className="sg-empty">
          <IconFace size={26} style={{ opacity: 0.4 }} />
          <p>
            Faces were detected ({totalFaces}) but no two were similar enough to form a cluster.
            Either your library has people in mostly one-off photos, or the face detector picked up
            partial / side-angle faces that don&apos;t match well.
          </p>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 16, marginBottom: 32 }}>
          {clusters.map((c) => {
            const repItem = itemsById.get(c.representativeItemId);
            const face = repItem?.faces?.[c.representativeFaceIdx];
            const thumb = repItem?.thumbDataUrl;
            return (
              <button
                key={c.id}
                onClick={() =>
                  openFocus({
                    source: "people",
                    label: c.label ?? `Person ${c.id.split("-")[1] ?? ""}`,
                    sublabel: `${fmtCount(c.size)} photo${c.size === 1 ? "" : "s"} clustered by face`,
                    itemIds: c.memberItemIds,
                  })
                }
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
      )}

      {singletonItems.length > 0 && (
        <section>
          <div className="section-head">
            <h3>Solo faces</h3>
            <span>{singletonItems.length} photo{singletonItems.length === 1 ? "" : "s"} · faces that didn&apos;t cluster</span>
          </div>
          <button
            onClick={() =>
              openFocus({
                source: "people",
                label: "Solo faces",
                sublabel: "Faces that didn't match any cluster",
                itemIds: singletonItems.map((i) => i.id),
              })
            }
            className="btn ghost"
            style={{ marginTop: 8 }}
          >
            Review {singletonItems.length}
          </button>
        </section>
      )}
    </div>
  );
}

function ZoomedFace({
  src,
  face,
  repWidth,
  repHeight,
}: {
  src: string;
  face: { x: number; y: number; w: number; h: number };
  repWidth: number;
  repHeight: number;
}) {
  if (!repWidth || !repHeight) {
    /* eslint-disable-next-line @next/next/no-img-element */
    return <img src={src} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />;
  }
  const targetSize = 0.6;
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
