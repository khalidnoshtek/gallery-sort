"use client";

import { useState } from "react";
import type { Photo } from "@/lib/lumen/data";
import { IconBlur, IconBurst, IconCheck, IconFlash, IconShot, IconVideo } from "./icons";

function hashHue(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return Math.abs(h) % 360;
}

export function MockTile({ photo }: { photo: Photo }) {
  const hue = hashHue(photo.id);
  const labels: Record<string, [string, string]> = {
    photo: ["IMG", photo.location || "—"],
    screenshot: ["SHOT", "PNG"],
    meme: ["MEME", "WA"],
    document: ["DOC", photo.location || "—"],
    video: ["VID", photo.location || "—"],
    whatsapp: ["WA", photo.location || "—"],
  };
  const [k1, k2] = labels[photo.cat] || ["IMG", "—"];
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        background: `repeating-linear-gradient(45deg, oklch(0.22 0.02 ${hue}) 0 6px, oklch(0.20 0.02 ${hue}) 6px 12px)`,
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: 10,
        fontFamily: "var(--mono)",
        fontSize: 9.5,
        color: "rgba(255,255,255,0.55)",
        letterSpacing: 0.4,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <span>{k1}</span>
        <span>{(photo.size / 1024).toFixed(0)}K</span>
      </div>
      <div style={{ alignSelf: "center", textAlign: "center", lineHeight: 1.4 }}>
        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.7)" }}>{photo.filename.split(".")[0]}</div>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <span>{photo.date}</span>
        <span>{k2}</span>
      </div>
    </div>
  );
}

export function PhotoThumb({ photo, useMock = false, large = false }: { photo: Photo; useMock?: boolean; large?: boolean }) {
  const [failed, setFailed] = useState(false);
  if (useMock || failed || ["screenshot", "meme", "document", "whatsapp"].includes(photo.cat)) {
    return <MockTile photo={photo} />;
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={large ? photo.url : photo.urlSm}
      alt=""
      loading="lazy"
      draggable={false}
      onError={() => setFailed(true)}
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        objectFit: "cover",
        userSelect: "none",
      }}
    />
  );
}

function ConfidenceChip({ score, label }: { score: number; label?: string }) {
  const col = score >= 0.7 ? "var(--accent)" : "var(--muted)";
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        fontFamily: "var(--mono)",
        fontSize: 9.5,
        letterSpacing: 0.4,
        padding: "2px 6px",
        borderRadius: 4,
        background: "rgba(0,0,0,0.55)",
        color: col,
        backdropFilter: "blur(8px)",
      }}
    >
      {label || `${Math.round(score * 100)}%`}
    </span>
  );
}

interface CardProps {
  photo: Photo;
  selected: boolean;
  onToggle: (id: string) => void;
  height?: number | string;
  showConfidence?: boolean;
  useMock?: boolean;
}

export function PhotoCard({ photo, selected, onToggle, height, showConfidence, useMock }: CardProps) {
  const issues: Array<{ icon: typeof IconBlur; label: string }> = [];
  if (photo.blurry) issues.push({ icon: IconBlur, label: "Blurry" });
  if (photo.dark) issues.push({ icon: IconFlash, label: "Dark" });
  if (photo.burst) issues.push({ icon: IconBurst, label: "Burst" });

  return (
    <div className="card" data-selected={selected ? "1" : "0"} data-photoid={photo.id} style={{ height }}>
      <PhotoThumb photo={photo} useMock={useMock} />
      <div className="card-veil" />
      <button
        className="card-check"
        onClick={(e) => {
          e.stopPropagation();
          onToggle(photo.id);
        }}
      >
        {selected ? <IconCheck size={11} /> : null}
      </button>

      <div className="card-meta">
        {photo.cat === "video" && (
          <span className="badge">
            <IconVideo size={11} /> 0:42
          </span>
        )}
        {photo.cat === "screenshot" && (
          <span className="badge">
            <IconShot size={11} />
          </span>
        )}
        {issues.length > 0 && showConfidence && (() => {
          const I = issues[0]!.icon;
          return (
            <span className="badge warn">
              <I size={11} /> {issues[0]!.label}
            </span>
          );
        })()}
      </div>

      {showConfidence && photo.cat === "photo" && (
        <div className="card-foot">
          <ConfidenceChip score={photo.quality} label={`Q ${(photo.quality * 100).toFixed(0)}`} />
          {photo.aesthetic > 0.75 && <ConfidenceChip score={photo.aesthetic} label="✦" />}
        </div>
      )}
    </div>
  );
}
