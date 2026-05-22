"use client";

import { useMemo, useState } from "react";
import { useLibraryStore } from "@/state/library-store";
import { adaptPhoto } from "@/lib/lumen/adapter";
import { fmtBytes, fmtCount } from "@/lib/lumen/data";
import { sortItems, type SortKey } from "@/lib/lumen/sort";
import {
  IconArrowR, IconChevL, IconCheck, IconKeep, IconRestore, IconTrash,
} from "./icons";
import { PhotoThumb } from "./photo-card";
import { SortMenu } from "./sort-menu";
import { Lightbox } from "./lightbox";
import type { FocusContext } from "./types";

interface Props {
  ctx: FocusContext;
  onBack: () => void;
}

export function FocusView({ ctx, onBack }: Props) {
  const items = useLibraryStore((s) => s.items);
  const staged = useLibraryStore((s) => s.stagedForTrash);
  const stageItems = useLibraryStore((s) => s.stageItems);
  const unstageItems = useLibraryStore((s) => s.unstageItems);

  // Default to "largest first" — when triaging, big files matter most.
  const [sortKey, setSortKey] = useState<SortKey>("size-desc");
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const itemsById = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
  const subset = useMemo(() => {
    const raw = ctx.itemIds.map((id) => itemsById.get(id)).filter((i): i is NonNullable<typeof i> => Boolean(i));
    return sortItems(raw, sortKey);
  }, [ctx.itemIds, itemsById, sortKey]);

  const totalBytes = subset.reduce((a, b) => a + b.sizeBytes, 0);
  const stagedSubset = subset.filter((i) => staged.has(i.id));
  const stagedCount = stagedSubset.length;
  const stagedBytes = stagedSubset.reduce((a, b) => a + b.sizeBytes, 0);

  const stageAll = () => stageItems(subset.map((i) => i.id));
  const stageRemaining = () => stageItems(subset.filter((i) => !staged.has(i.id)).map((i) => i.id));
  const keepAll = () => unstageItems(subset.map((i) => i.id));
  const invert = () => {
    const toStage: string[] = [];
    const toUnstage: string[] = [];
    for (const it of subset) {
      if (staged.has(it.id)) toUnstage.push(it.id);
      else toStage.push(it.id);
    }
    if (toStage.length) stageItems(toStage);
    if (toUnstage.length) unstageItems(toUnstage);
  };

  return (
    <div className="view">
      <header className="qv-head" style={{ flexDirection: "column", alignItems: "flex-start", gap: 16 }}>
        <div style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
          <div>
            <button onClick={onBack} className="btn ghost" style={{ marginBottom: 12, padding: "6px 12px", fontSize: 12 }}>
              <IconChevL size={12} /> Back
            </button>
            <div className="dup-eyebrow">Review · per-photo decisions · click any to preview</div>
            <h2>{ctx.label}</h2>
            <p>
              {fmtCount(subset.length)} photo{subset.length === 1 ? "" : "s"} · {fmtBytes(totalBytes)} total
              {ctx.sublabel ? ` · ${ctx.sublabel}` : ""}
            </p>
          </div>
          <div style={{ display: "flex", gap: 8, flexShrink: 0, alignItems: "center" }}>
            <SortMenu value={sortKey} onChange={setSortKey} />
          </div>
        </div>

        {/* Bulk action bar */}
        <div style={{
          width: "100%",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "12px 14px",
          background: "var(--bg-2)",
          border: "0.5px solid var(--border-soft)",
          borderRadius: 10,
        }}>
          <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
            <span style={{ fontSize: 11.5, color: "var(--muted)", marginRight: 6 }}>Bulk:</span>
            <button className="btn-sm ghost" onClick={stageAll}>
              <IconCheck size={11} /> Select all for trash
            </button>
            <button className="btn-sm ghost" onClick={keepAll} disabled={stagedCount === 0}>
              <IconRestore size={11} /> Clear selection
            </button>
            <button className="btn-sm ghost" onClick={invert}>
              <IconRestore size={11} /> Invert
            </button>
            <button className="btn-sm ghost" onClick={stageRemaining} disabled={stagedCount === subset.length}>
              Stage remaining ({fmtCount(subset.length - stagedCount)})
            </button>
          </div>
          <div style={{ display: "flex", gap: 16, alignItems: "center", fontSize: 12.5 }}>
            <span style={{ color: "var(--muted)" }}>
              <strong style={{ color: "var(--text)", fontVariantNumeric: "tabular-nums" }}>{fmtCount(stagedCount)}</strong> of {fmtCount(subset.length)} staged
            </span>
            {stagedCount > 0 && (
              <span style={{ color: "var(--accent)", fontFamily: "var(--mono)", fontSize: 12, fontVariantNumeric: "tabular-nums" }}>
                {fmtBytes(stagedBytes)}
              </span>
            )}
          </div>
        </div>
      </header>

      <div className="lib-grid uniform">
        {subset.map((item, idx) => {
          const isStaged = staged.has(item.id);
          const photo = adaptPhoto(item);
          return (
            <div
              key={item.id}
              className="card"
              data-selected={isStaged ? "1" : "0"}
              style={{ height: "auto", aspectRatio: "1/1", opacity: isStaged ? 0.45 : 1, cursor: "zoom-in" }}
              onClick={(e) => {
                // Open lightbox only when clicking the image area, not the buttons.
                const target = e.target as HTMLElement;
                if (target.closest("button")) return;
                setLightboxIndex(idx);
              }}
            >
              <PhotoThumb photo={photo} useMock={false} />
              <div className="card-veil" style={{ opacity: 1 }} />
              <div style={{
                position: "absolute",
                left: 8, right: 8, bottom: 8,
                display: "flex", gap: 6,
                pointerEvents: "none",
              }}>
                <button
                  onClick={(e) => { e.stopPropagation(); unstageItems([item.id]); }}
                  data-on={!isStaged ? "1" : "0"}
                  className="dup-act"
                  style={{ pointerEvents: "auto", padding: 6, fontSize: 11 }}
                >
                  <IconKeep size={12} /> Keep
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); stageItems([item.id]); }}
                  data-on={isStaged ? "1" : "0"}
                  className="dup-act danger"
                  style={{ pointerEvents: "auto", padding: 6, fontSize: 11 }}
                >
                  <IconTrash size={12} /> Trash
                </button>
              </div>
              <div style={{
                position: "absolute",
                top: 8, left: 8, right: 8,
                display: "flex", justifyContent: "space-between", alignItems: "center",
                fontFamily: "var(--mono)", fontSize: 10,
                color: "rgba(255,255,255,0.9)",
                textShadow: "0 1px 2px rgba(0,0,0,0.6)",
              }}>
                <span style={{
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  maxWidth: "60%",
                }} title={item.relativePath}>
                  {item.filename}
                </span>
                <span style={{ background: "rgba(0,0,0,0.4)", padding: "2px 6px", borderRadius: 4 }}>
                  {fmtBytes(item.sizeBytes)}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {stagedCount > 0 && (
        <div style={{ marginTop: 24, padding: 18, borderRadius: 10, border: "0.5px solid var(--active-line)", background: "var(--active-bg)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <div style={{ fontFamily: "var(--display)", fontSize: 16, marginBottom: 4 }}>
                {fmtCount(stagedCount)} staged from this review · {fmtBytes(stagedBytes)}
              </div>
              <div style={{ color: "var(--muted)", fontSize: 12.5 }}>
                Open Trash to apply (move or delete on disk).
              </div>
            </div>
            <button className="btn primary" onClick={onBack}>
              Done <IconArrowR size={12} />
            </button>
          </div>
        </div>
      )}

      {lightboxIndex !== null && (
        <Lightbox
          items={subset}
          startIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />
      )}
    </div>
  );
}
