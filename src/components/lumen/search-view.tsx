"use client";

import { PhotoCard } from "./photo-card";
import { IconFace, IconHash, IconSearch, IconSparkle, IconX } from "./icons";
import { PHOTOS, SEARCH_SUGS, SEMANTIC_RESULTS } from "@/lib/lumen/data";
import type { GridStyle } from "./types";

interface Props {
  query: string;
  setQuery: (q: string) => void;
  gridStyle: GridStyle;
  useMock?: boolean;
  showConfidence?: boolean;
}

export function SearchView({ query, setQuery, gridStyle, useMock = false, showConfidence = true }: Props) {
  const q = query.toLowerCase().trim();
  const hits = SEMANTIC_RESULTS[q] || [];
  const matched = hits
    .map((uid) => PHOTOS.find((p) => p.uid === uid && p.cat === "photo"))
    .filter((p): p is NonNullable<typeof p> => Boolean(p));
  const fallback = !SEMANTIC_RESULTS[q] && q
    ? PHOTOS.filter((p) =>
        p.cat === "photo" && (
          p.tags.some((t) => t.includes(q)) ||
          p.location.toLowerCase().includes(q) ||
          (p.event || "").toLowerCase().includes(q)
        ),
      )
    : [];
  const results = matched.length ? matched : fallback;

  return (
    <div className="view">
      {!q ? (
        <div className="search-hero">
          <div className="sh-eyebrow">Local semantic search · CLIP + OCR + EXIF</div>
          <h2 className="sh-headline">Find any moment in your library.</h2>
          <p className="sh-sub">
            Try natural language — Lumen searches by what&apos;s <em>in</em> the photo, not just the filename.
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
                <h4>By filename, EXIF, OCR text</h4>
                <p>&quot;passport&quot;, &quot;screenshot 2024&quot;, &quot;ISO 800&quot;</p>
              </div>
            </div>
            <div className="sh-card">
              <IconFace size={16} style={{ color: "var(--accent)" }} />
              <div>
                <h4>By people, places, objects</h4>
                <p>&quot;buddy on the beach&quot;, &quot;mom at diwali&quot;</p>
              </div>
            </div>
            <div className="sh-card">
              <IconSparkle size={16} style={{ color: "var(--accent)" }} />
              <div>
                <h4>By semantic meaning</h4>
                <p>&quot;cozy evenings&quot;, &quot;wide open landscapes&quot;</p>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="search-results">
          <div className="sr-head">
            <div>
              <h3 className="sr-q">&quot;{q}&quot;</h3>
              <p className="sr-meta">{results.length} matches · ranked by CLIP cosine similarity</p>
            </div>
            <button className="btn ghost" onClick={() => setQuery("")}>
              <IconX size={13} /> Clear
            </button>
          </div>
          {results.length === 0 ? (
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
                  showConfidence={showConfidence}
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
