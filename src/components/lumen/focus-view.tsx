"use client";

import { useMemo, useState } from "react";
import { useLibraryStore } from "@/state/library-store";
import { adaptPhoto } from "@/lib/lumen/adapter";
import { fmtBytes, fmtCount } from "@/lib/lumen/data";
import { IconArrowR, IconChevL, IconKeep, IconRestore, IconTrash } from "./icons";
import { PhotoThumb } from "./photo-card";
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

  const itemsById = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
  const subset = useMemo(
    () => ctx.itemIds.map((id) => itemsById.get(id)).filter((i): i is NonNullable<typeof i> => Boolean(i)),
    [ctx.itemIds, itemsById],
  );

  const totalBytes = subset.reduce((a, b) => a + b.sizeBytes, 0);
  const stagedCount = subset.filter((i) => staged.has(i.id)).length;
  const stagedBytes = subset.filter((i) => staged.has(i.id)).reduce((a, b) => a + b.sizeBytes, 0);

  const stageAll = () => stageItems(subset.filter((i) => !staged.has(i.id)).map((i) => i.id));
  const keepAll = () => unstageItems(subset.map((i) => i.id));

  return (
    <div className="view">
      <header className="qv-head">
        <div>
          <button onClick={onBack} className="btn ghost" style={{ marginBottom: 12, padding: "6px 12px", fontSize: 12 }}>
            <IconChevL size={12} /> Back
          </button>
          <div className="dup-eyebrow">Review · per-photo decisions</div>
          <h2>{ctx.label}</h2>
          <p>
            {fmtCount(subset.length)} photo{subset.length === 1 ? "" : "s"} · {fmtBytes(totalBytes)} total
            {ctx.sublabel ? ` · ${ctx.sublabel}` : ""}
            {stagedCount > 0 && (
              <> · <strong style={{ color: "var(--accent)" }}>{stagedCount} staged ({fmtBytes(stagedBytes)})</strong></>
            )}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn ghost" onClick={keepAll} disabled={stagedCount === 0}>
            <IconRestore size={13} /> Keep all
          </button>
          <button className="btn primary" onClick={stageAll} disabled={stagedCount === subset.length}>
            <IconTrash size={13} /> Stage remaining ({fmtCount(subset.length - stagedCount)})
          </button>
        </div>
      </header>

      <div className="lib-grid uniform">
        {subset.map((item) => {
          const isStaged = staged.has(item.id);
          const photo = adaptPhoto(item);
          return (
            <div
              key={item.id}
              className="card"
              data-selected={isStaged ? "1" : "0"}
              style={{ height: "auto", aspectRatio: "1/1", opacity: isStaged ? 0.5 : 1 }}
            >
              <PhotoThumb photo={photo} useMock={false} />
              <div className="card-veil" style={{ opacity: 1 }} />
              <div
                style={{
                  position: "absolute",
                  left: 8,
                  right: 8,
                  bottom: 8,
                  display: "flex",
                  gap: 6,
                  pointerEvents: "none",
                }}
              >
                <button
                  onClick={() => unstageItems([item.id])}
                  data-on={!isStaged ? "1" : "0"}
                  className="dup-act"
                  style={{ pointerEvents: "auto", padding: 6, fontSize: 11 }}
                >
                  <IconKeep size={12} /> Keep
                </button>
                <button
                  onClick={() => stageItems([item.id])}
                  data-on={isStaged ? "1" : "0"}
                  className="dup-act danger"
                  style={{ pointerEvents: "auto", padding: 6, fontSize: 11 }}
                >
                  <IconTrash size={12} /> Trash
                </button>
              </div>
              <div
                style={{
                  position: "absolute",
                  top: 8,
                  left: 8,
                  right: 8,
                  fontFamily: "var(--mono)",
                  fontSize: 10,
                  color: "rgba(255,255,255,0.85)",
                  textShadow: "0 1px 2px rgba(0,0,0,0.5)",
                  overflow: "hidden",
                  whiteSpace: "nowrap",
                  textOverflow: "ellipsis",
                }}
                title={item.relativePath}
              >
                {item.filename}
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
                {fmtCount(stagedCount)} staged from this review
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
    </div>
  );
}
