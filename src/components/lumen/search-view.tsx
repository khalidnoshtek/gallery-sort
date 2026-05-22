"use client";

import { useEffect, useState } from "react";
import { PhotoCard } from "./photo-card";
import { IconFace, IconHash, IconSearch, IconSparkle, IconX } from "./icons";
import { SEARCH_SUGS, type Photo } from "@/lib/lumen/data";
import { adaptPhoto } from "@/lib/lumen/adapter";
import { clipEncodeText, cosineSim } from "@/lib/browser/ai";
import { useLibraryStore } from "@/state/library-store";
import type { GridStyle } from "./types";

interface Props {
  query: string;
  setQuery: (q: string) => void;
  gridStyle: GridStyle;
  useMock?: boolean;
  photos: Photo[];
  semanticMap: Record<string, string[]>;
}

export function SearchView({ query, setQuery, gridStyle, useMock = false, photos, semanticMap }: Props) {
  const items = useLibraryStore((s) => s.items);
  const hasClip = items.some((i) => i.clipEmbedding && i.clipEmbedding.length > 0);

  const q = query.toLowerCase().trim();
  const [clipResults, setClipResults] = useState<Photo[]>([]);
  const [clipState, setClipState] = useState<"idle" | "encoding" | "done" | "error">("idle");

  useEffect(() => {
    if (!q || !hasClip) {
      setClipResults([]);
      setClipState("idle");
      return;
    }
    let alive = true;
    setClipState("encoding");
    (async () => {
      try {
        const textVec = await clipEncodeText(q);
        if (!alive) return;
        const ranked = items
          .filter((i) => i.clipEmbedding && i.clipEmbedding.length > 0)
          .map((i) => ({ item: i, score: cosineSim(textVec, i.clipEmbedding!) }))
          .sort((a, b) => b.score - a.score)
          .slice(0, 60)
          .filter((x) => x.score > 0.15);
        const adapted = ranked.map((x) => adaptPhoto(x.item));
        setClipResults(adapted);
        setClipState("done");
      } catch {
        if (!alive) return;
        setClipState("error");
      }
    })();
    return () => {
      alive = false;
    };
  }, [q, hasClip, items]);

  // Fallback (no CLIP) — filename + path token match
  let results: Photo[] = [];
  if (q) {
    if (hasClip && clipResults.length > 0) {
      results = clipResults;
    } else {
      const hits = semanticMap[q];
      if (hits && hits.length > 0) {
        results = hits
          .map((uid) => photos.find((p) => p.uid === uid))
          .filter((p): p is Photo => Boolean(p));
      } else {
        results = photos.filter((p) =>
          p.filename.toLowerCase().includes(q) ||
          p.tags.some((t) => t.includes(q)) ||
          p.location.toLowerCase().includes(q) ||
          (p.event || "").toLowerCase().includes(q),
        );
      }
    }
  }

  return (
    <div className="view">
      {!q ? (
        <div className="search-hero">
          <div className="sh-eyebrow">
            {hasClip ? "Semantic search · CLIP ViT-B/32 · local" : "Filename + path search · enable AI for semantic"}
          </div>
          <h2 className="sh-headline">Find any moment in your library.</h2>
          <p className="sh-sub">
            {hasClip
              ? <>Try natural language — Lumen searches by what&apos;s <em>in</em> the photo.</>
              : <>Without AI: matches filename, location, tags. Run AI analysis to enable semantic search.</>}
          </p>
          <div className="sh-sugs">
            {SEARCH_SUGS.map((s) => (
              <button key={s} className="sh-sug" onClick={() => setQuery(s)}>
                <IconSearch size={12} /> {s}
              </button>
            ))}
          </div>
          <div className="sh-explain">
            <div className="sh-card">
              <IconHash size={16} style={{ color: "var(--accent)" }} />
              <div>
                <h4>Filename, EXIF</h4>
                <p>&quot;passport&quot;, &quot;screenshot 2024&quot;</p>
              </div>
            </div>
            <div className="sh-card">
              <IconFace size={16} style={{ color: "var(--accent)" }} />
              <div>
                <h4>People (after AI)</h4>
                <p>Open the People view for face clusters</p>
              </div>
            </div>
            <div className="sh-card">
              <IconSparkle size={16} style={{ color: "var(--accent)" }} />
              <div>
                <h4>Semantic (after AI)</h4>
                <p>&quot;beach sunset&quot;, &quot;food&quot;, &quot;mountains&quot;</p>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="search-results">
          <div className="sr-head">
            <div>
              <h3 className="sr-q">&quot;{q}&quot;</h3>
              <p className="sr-meta">
                {clipState === "encoding" ? "Encoding query…" :
                 hasClip && clipResults.length > 0 ? `${results.length} matches · ranked by CLIP cosine` :
                 `${results.length} matches`}
              </p>
            </div>
            <button className="btn ghost" onClick={() => setQuery("")}>
              <IconX size={13} /> Clear
            </button>
          </div>
          {clipState === "encoding" ? (
            <div className="sr-empty">
              <IconSparkle size={24} style={{ opacity: 0.5 }} />
              <p>Encoding your query…</p>
            </div>
          ) : results.length === 0 ? (
            <div className="sr-empty">
              <IconSearch size={24} style={{ opacity: 0.3 }} />
              <p>No matches yet. Try a broader query, or scan more folders.</p>
            </div>
          ) : (
            <div className={`lib-grid ${gridStyle === "timeline" ? "uniform" : gridStyle}`}>
              {results.map((p, i) => (
                <PhotoCard
                  key={p.id}
                  photo={p}
                  selected={false}
                  onToggle={() => {}}
                  height={gridStyle === "uniform" ? 180 : [180, 220, 200, 260, 180, 240, 200, 220][i % 8]}
                  useMock={useMock}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
