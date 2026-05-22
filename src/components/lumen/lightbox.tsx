"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLibraryStore } from "@/state/library-store";
import { fsHandles } from "@/lib/browser/handles";
import { fmtBytes, fmtCount } from "@/lib/lumen/data";
import type { BrowserMediaItem } from "@/lib/browser/types";
import {
  IconChevL, IconChevR, IconKeep, IconRestore, IconTrash, IconX,
} from "./icons";

interface Props {
  items: BrowserMediaItem[];
  startIndex: number;
  onClose: () => void;
}

// Cache full-res blob URLs by itemId.
// peek(id) returns synchronously if available (no microtask delay = no blink
// when navigating to an already-loaded neighbor).
function useImageUrlCache() {
  const cacheRef = useRef<Map<string, string>>(new Map());
  const inFlightRef = useRef<Map<string, Promise<string | null>>>(new Map());

  const peek = useCallback((id: string): string | undefined => {
    return cacheRef.current.get(id);
  }, []);

  const get = useCallback(async (item: BrowserMediaItem): Promise<string | null> => {
    const cached = cacheRef.current.get(item.id);
    if (cached) return cached;
    const inflight = inFlightRef.current.get(item.id);
    if (inflight) return inflight;
    const handle = fsHandles.get(item.id);
    if (!handle) {
      // No write-access handle — for images we can still show the embedded
      // thumbnail data URL; videos genuinely have no preview source available.
      return item.kind === "VIDEO" ? null : (item.thumbDataUrl ?? null);
    }
    const p = (async () => {
      try {
        const fh = await handle.parentDir.getFileHandle(handle.filename);
        const file = await fh.getFile();
        const url = URL.createObjectURL(file);
        cacheRef.current.set(item.id, url);
        return url;
      } catch {
        return item.kind === "VIDEO" ? null : (item.thumbDataUrl ?? null);
      } finally {
        inFlightRef.current.delete(item.id);
      }
    })();
    inFlightRef.current.set(item.id, p);
    return p;
  }, []);

  const clear = useCallback(() => {
    cacheRef.current.forEach((url) => {
      if (url.startsWith("blob:")) URL.revokeObjectURL(url);
    });
    cacheRef.current.clear();
    inFlightRef.current.clear();
  }, []);

  return { peek, get, clear };
}

export function Lightbox({ items, startIndex, onClose }: Props) {
  const [index, setIndex] = useState(Math.max(0, Math.min(startIndex, items.length - 1)));
  // url = "what we want the <img> to show right now".
  // null = nothing rendered yet (fresh open with no cached image).
  const [url, setUrl] = useState<string | null>(null);
  // `pending` is for the very first-load case only — used to show a "Loading…"
  // text. We never use it to dim or fade an existing image (that's what was
  // causing the blink during navigation).
  const [pending, setPending] = useState(true);
  const cache = useImageUrlCache();

  const staged = useLibraryStore((s) => s.stagedForTrash);
  const stageItems = useLibraryStore((s) => s.stageItems);
  const unstageItems = useLibraryStore((s) => s.unstageItems);

  const item = items[index];

  // Snap the URL synchronously if cached; otherwise fetch in the background
  // and update when ready. Critically: we don't blank or dim the previous
  // image while fetching — the browser keeps the previous decoded bitmap
  // on screen until the new one is ready, no flash.
  useEffect(() => {
    if (!item) return;
    let alive = true;

    const cached = cache.peek(item.id);
    if (cached) {
      setUrl(cached);
      setPending(false);
    } else {
      // Don't clear `url` — keep showing the previous image until the new
      // one resolves. Only set `pending` if we have nothing at all.
      if (url === null) setPending(true);
      cache.get(item).then((u) => {
        if (!alive) return;
        setUrl(u);
        setPending(false);
      });
    }

    // Prefetch neighbors so the next nav will be a cache hit.
    const next = items[index + 1];
    const prev = items[index - 1];
    if (next && !cache.peek(next.id)) cache.get(next);
    if (prev && !cache.peek(prev.id)) cache.get(prev);

    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item, index, items]);

  // Cleanup blob URLs on unmount
  useEffect(() => {
    return () => cache.clear();
  }, [cache]);

  const goNext = useCallback(() => {
    setIndex((i) => Math.min(items.length - 1, i + 1));
  }, [items.length]);
  const goPrev = useCallback(() => {
    setIndex((i) => Math.max(0, i - 1));
  }, []);

  const toggleStage = useCallback(() => {
    if (!item) return;
    if (staged.has(item.id)) unstageItems([item.id]);
    else stageItems([item.id]);
  }, [item, staged, stageItems, unstageItems]);

  const stageAndAdvance = useCallback(() => {
    if (!item) return;
    stageItems([item.id]);
    if (index < items.length - 1) goNext();
  }, [item, index, items.length, stageItems, goNext]);

  const keepAndAdvance = useCallback(() => {
    if (!item) return;
    unstageItems([item.id]);
    if (index < items.length - 1) goNext();
  }, [item, index, items.length, unstageItems, goNext]);

  // Keyboard. Note: Space is intentionally NOT bound so it stays available
  // for the native video play/pause behavior.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        goNext();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        goPrev();
      } else if (e.key.toLowerCase() === "k") {
        // Only intercept if not focused inside a control (e.g. video element)
        const tag = (e.target as HTMLElement | null)?.tagName;
        if (tag === "VIDEO" || tag === "INPUT") return;
        e.preventDefault();
        keepAndAdvance();
      } else if (e.key.toLowerCase() === "t" || e.key.toLowerCase() === "d") {
        const tag = (e.target as HTMLElement | null)?.tagName;
        if (tag === "VIDEO" || tag === "INPUT") return;
        e.preventDefault();
        stageAndAdvance();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [goNext, goPrev, onClose, keepAndAdvance, stageAndAdvance]);

  if (!item) return null;

  const isStaged = staged.has(item.id);
  const aspect = item.width && item.height ? item.width / item.height : null;
  const date = useMemo(() => new Date(item.lastModified).toLocaleString(), [item.lastModified]);

  return (
    <div
      onClick={onClose}
      style={{
        position: "absolute",
        inset: 0,
        background: "rgba(8,7,12,0.94)",
        backdropFilter: "blur(20px)",
        zIndex: 200,
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Top bar */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 14,
          padding: "16px 28px",
          borderBottom: "0.5px solid var(--border-soft)",
          background: "rgba(0,0,0,0.4)",
        }}
      >
        <button
          onClick={onClose}
          className="modal-x"
          aria-label="Close"
        >
          <IconX size={14} />
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: "var(--mono)", fontSize: 12.5, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {item.filename}
          </div>
          <div style={{ color: "var(--muted)", fontSize: 11, marginTop: 2, fontFamily: "var(--mono)" }}>
            {item.relativePath}
          </div>
        </div>
        <div style={{ color: "var(--muted)", fontSize: 11.5, fontFamily: "var(--mono)", letterSpacing: "-0.005em", textAlign: "right" }}>
          {fmtCount(index + 1)} / {fmtCount(items.length)}
        </div>
      </div>

      {/* Image */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          flex: 1,
          position: "relative",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 28,
          minHeight: 0,
        }}
      >
        {index > 0 && (
          <button
            onClick={(e) => { e.stopPropagation(); goPrev(); }}
            aria-label="Previous"
            style={{
              position: "absolute",
              left: 16,
              top: "50%",
              transform: "translateY(-50%)",
              width: 44,
              height: 44,
              borderRadius: "50%",
              background: "rgba(0,0,0,0.5)",
              border: "0.5px solid var(--border-soft)",
              color: "var(--text)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "default",
              backdropFilter: "blur(10px)",
              zIndex: 2,
            }}
          >
            <IconChevL size={18} />
          </button>
        )}
        {index < items.length - 1 && (
          <button
            onClick={(e) => { e.stopPropagation(); goNext(); }}
            aria-label="Next"
            style={{
              position: "absolute",
              right: 16,
              top: "50%",
              transform: "translateY(-50%)",
              width: 44,
              height: 44,
              borderRadius: "50%",
              background: "rgba(0,0,0,0.5)",
              border: "0.5px solid var(--border-soft)",
              color: "var(--text)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "default",
              backdropFilter: "blur(10px)",
              zIndex: 2,
            }}
          >
            <IconChevR size={18} />
          </button>
        )}
        {url ? (
          item.kind === "VIDEO" ? (
            <video
              // Re-mount the element when navigating between videos so the
              // source actually swaps and the previous video stops.
              key={item.id}
              src={url}
              controls
              autoPlay
              loop
              playsInline
              style={{
                maxWidth: "100%",
                maxHeight: "100%",
                userSelect: "none",
                borderRadius: 4,
                boxShadow: "0 30px 80px rgba(0,0,0,0.5)",
                background: "#000",
              }}
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={url}
              alt={item.filename}
              draggable={false}
              style={{
                maxWidth: "100%",
                maxHeight: "100%",
                objectFit: "contain",
                userSelect: "none",
                borderRadius: 4,
                boxShadow: "0 30px 80px rgba(0,0,0,0.5)",
                aspectRatio: aspect ?? undefined,
              }}
            />
          )
        ) : pending ? (
          <div style={{ color: "var(--muted)", fontSize: 13 }}>Loading…</div>
        ) : (
          <div style={{ color: "var(--muted)", fontSize: 13 }}>Preview unavailable</div>
        )}
        {isStaged && (
          <div style={{
            position: "absolute",
            top: 80,
            left: 28,
            background: "var(--danger)",
            color: "#1a0306",
            padding: "6px 12px",
            borderRadius: 6,
            fontSize: 11,
            fontWeight: 500,
            letterSpacing: "-0.005em",
            zIndex: 2,
          }}>
            STAGED FOR TRASH
          </div>
        )}
      </div>

      {/* Bottom bar */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 18,
          padding: "16px 28px",
          borderTop: "0.5px solid var(--border-soft)",
          background: "rgba(0,0,0,0.4)",
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", gap: 24, fontSize: 12, color: "var(--secondary)", letterSpacing: "-0.005em", flexWrap: "wrap" }}>
          <span><span style={{ color: "var(--muted)" }}>Size</span>{" "}<b style={{ color: "var(--text)", fontFamily: "var(--mono)", fontWeight: 400 }}>{fmtBytes(item.sizeBytes)}</b></span>
          {item.width && item.height && (
            <span><span style={{ color: "var(--muted)" }}>Dimensions</span>{" "}<b style={{ color: "var(--text)", fontFamily: "var(--mono)", fontWeight: 400 }}>{item.width}×{item.height}</b></span>
          )}
          <span><span style={{ color: "var(--muted)" }}>Modified</span>{" "}<b style={{ color: "var(--text)", fontFamily: "var(--mono)", fontWeight: 400 }}>{date}</b></span>
          {item.qualityScore !== null && (
            <span><span style={{ color: "var(--muted)" }}>Sharpness</span>{" "}<b style={{ color: "var(--text)", fontFamily: "var(--mono)", fontWeight: 400 }}>{Math.round(item.qualityScore)}</b></span>
          )}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {isStaged ? (
            <button className="btn ghost" onClick={toggleStage}>
              <IconRestore size={13} /> Unstage (K)
            </button>
          ) : (
            <button className="btn ghost" onClick={keepAndAdvance}>
              <IconKeep size={13} /> Keep (K)
            </button>
          )}
          <button
            className={isStaged ? "btn ghost" : "btn primary"}
            onClick={stageAndAdvance}
            style={isStaged ? {} : { background: "var(--danger)", color: "#1a0306" }}
          >
            <IconTrash size={13} /> Stage (T)
          </button>
        </div>
      </div>

      {/* Keyboard hint */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "absolute",
          bottom: 76,
          left: "50%",
          transform: "translateX(-50%)",
          fontSize: 10.5,
          color: "var(--muted)",
          letterSpacing: "-0.005em",
          background: "rgba(0,0,0,0.4)",
          padding: "4px 10px",
          borderRadius: 999,
          backdropFilter: "blur(8px)",
          fontFamily: "var(--mono)",
          pointerEvents: "none",
        }}
      >
        ← →  navigate  ·  K  keep  ·  T  trash  ·  ESC  close{item.kind === "VIDEO" ? "  ·  Space play/pause" : ""}
      </div>
    </div>
  );
}
