"use client";

import { PhotoCard } from "./photo-card";
import { IconBlur, IconCheck, IconFlash } from "./icons";
import type { Photo } from "@/lib/lumen/data";

interface Props {
  photos: Photo[];
  useMock?: boolean;
}

export function QualityView({ photos, useMock = false }: Props) {
  const issues = photos.filter((p) => p.blurry || p.dark);
  const buckets = [
    { label: "Blurry", items: issues.filter((p) => p.blurry), icon: IconBlur },
    { label: "Too dark", items: issues.filter((p) => p.dark && !p.blurry), icon: IconFlash },
  ];

  return (
    <div className="view">
      <header className="qv-head">
        <div>
          <h2>Quality review</h2>
          <p>
            {issues.length > 0
              ? `${issues.length} photos flagged. Confidence is on by default.`
              : "No quality issues detected — blur/exposure scoring runs in the desktop build."}
          </p>
        </div>
        <button className="btn primary"><IconCheck size={13} /> Keep best of each burst</button>
      </header>

      {buckets.map((b) => (
        <section key={b.label} className="qv-section">
          <header>
            <b.icon size={14} />
            <h3>{b.label}</h3>
            <span>{b.items.length} photos</span>
          </header>
          {b.items.length > 0 ? (
            <div className="lib-grid uniform">
              {b.items.slice(0, 12).map((p) => (
                <PhotoCard
                  key={p.id}
                  photo={p}
                  selected={false}
                  onToggle={() => {}}
                  height={180}
                  showConfidence
                  useMock={useMock}
                />
              ))}
            </div>
          ) : (
            <div style={{ color: "var(--muted)", fontSize: 12.5, padding: "16px 0" }}>
              Nothing flagged in this bucket.
            </div>
          )}
        </section>
      ))}
    </div>
  );
}
