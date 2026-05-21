"use client";

import { useState } from "react";
import type { Photo } from "@/lib/lumen/data";
import { IconCheck, IconShot, IconVideo } from "./icons";

function hashHue(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return Math.abs(h) % 360;
}

export function MockTile({ photo }: { photo: Photo }) {
  const hue = hashHue(photo.id);
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
        <span>{(photo.filename.split(".").pop() || "FILE").toUpperCase()}</span>
        <span>{(photo.size / 1024).toFixed(0)}K</span>
      </div>
      <div style={{ alignSelf: "center", textAlign: "center", lineHeight: 1.4 }}>
        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.7)" }}>{photo.filename.split(".")[0]}</div>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <span>{photo.date}</span>
        <span>{photo.cat.toUpperCase()}</span>
      </div>
    </div>
  );
}

export function PhotoThumb({ photo, useMock = false }: { photo: Photo; useMock?: boolean }) {
  const [failed, setFailed] = useState(false);
  if (useMock || failed || !photo.url || photo.cat === "video") {
    return <MockTile photo={photo} />;
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={photo.urlSm}
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

interface CardProps {
  photo: Photo;
  selected: boolean;
  onToggle: (id: string) => void;
  height?: number | string;
  useMock?: boolean;
}

export function PhotoCard({ photo, selected, onToggle, height, useMock }: CardProps) {
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
          <span className="badge"><IconVideo size={11} /></span>
        )}
        {photo.cat === "screenshot" && (
          <span className="badge"><IconShot size={11} /></span>
        )}
      </div>
    </div>
  );
}
