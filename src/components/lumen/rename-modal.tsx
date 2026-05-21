"use client";

import { useState } from "react";
import { IconArrowR, IconKeep, IconX } from "./icons";
import { PhotoThumb } from "./photo-card";
import type { Photo } from "@/lib/lumen/data";

const SLUG_BANK = [
  "goa-beach-sunset", "triund-ridge-trek", "buddy-on-rug", "manali-snowline",
  "anjuna-coastline", "diwali-family", "bali-rice-fields", "lonavala-bike-ride",
  "pune-street", "europe-paris-eiffel", "date-night-mumbai", "kasol-river",
];

function applyTemplate(tpl: string, photo: Photo, idx: number): string {
  const date = new Date(photo.date);
  const slug = SLUG_BANK[idx % SLUG_BANK.length]!;
  const place = (photo.location || "home").toLowerCase().replace(/[, ]+/g, "-");
  const evt = (photo.event || "untitled").toLowerCase().replace(/[, ']+/g, "-");
  const subject = photo.tags?.[0] || "scene";
  const yr = date.getFullYear();
  const mo = date.toLocaleString("en-US", { month: "short" }).toLowerCase();
  return tpl
    .replace("{slug}", slug)
    .replace("{place}", place)
    .replace("{event}", evt)
    .replace("{subject}", subject)
    .replace("{year}", String(yr))
    .replace("{month}", mo)
    .replace("{date}", photo.date)
    .replace("{n}", String(idx + 1).padStart(3, "0"));
}

const PRESETS = [
  { id: "smart", label: "Smart name", tpl: "{slug}-{month}-{year}" },
  { id: "event", label: "Event-Date", tpl: "{event}-{date}-{n}" },
  { id: "place", label: "Place-Subject", tpl: "{place}-{subject}-{n}" },
  { id: "datey", label: "Date only", tpl: "{date}-{n}" },
];

const TOKENS = ["{slug}", "{event}", "{place}", "{subject}", "{date}", "{month}", "{year}", "{n}"];

interface Props {
  photos: Photo[];
  onClose: () => void;
  useMock?: boolean;
}

export function RenameModal({ photos, onClose, useMock = false }: Props) {
  const [tpl, setTpl] = useState("{slug}-{month}-{year}");
  const [preset, setPreset] = useState("smart");
  const samples = photos.slice(0, 12);

  const choose = (p: typeof PRESETS[number]) => {
    setPreset(p.id);
    setTpl(p.tpl);
  };

  return (
    <div className="modal-veil" onClick={onClose}>
      <div className="modal rename-modal" onClick={(e) => e.stopPropagation()}>
        <header className="modal-head">
          <div>
            <div className="modal-eyebrow">Batch rename · {photos.length} files</div>
            <h2 className="modal-title">AI-generate filenames</h2>
          </div>
          <button className="modal-x" onClick={onClose}><IconX size={14} /></button>
        </header>

        <div className="rn-presets">
          {PRESETS.map((p) => (
            <button
              key={p.id}
              className="rn-preset"
              data-on={preset === p.id ? "1" : "0"}
              onClick={() => choose(p)}
            >
              <div className="rn-preset-label">{p.label}</div>
              <div className="rn-preset-tpl">{p.tpl}</div>
            </button>
          ))}
        </div>

        <div className="rn-tpl-row">
          <label className="rn-lbl">Template</label>
          <input className="rn-tpl-input" value={tpl} onChange={(e) => setTpl(e.target.value)} />
          <div className="rn-tokens">
            {TOKENS.map((t) => (
              <button key={t} onClick={() => setTpl(tpl + t)}>{t}</button>
            ))}
          </div>
        </div>

        <div className="rn-preview">
          <div className="rn-preview-head">
            <span>Old name</span>
            <IconArrowR size={14} />
            <span>New name</span>
          </div>
          {samples.map((p, i) => {
            const newName = applyTemplate(tpl, p, i) + "." + p.filename.split(".").pop();
            return (
              <div key={p.id} className="rn-row">
                <div className="rn-thumb">
                  <PhotoThumb photo={p} useMock={useMock} />
                </div>
                <div className="rn-old">{p.filename}</div>
                <IconArrowR size={13} style={{ opacity: 0.35 }} />
                <div className="rn-new">{newName}</div>
              </div>
            );
          })}
          {photos.length > 12 && (
            <div className="rn-more">+{photos.length - 12} more files…</div>
          )}
        </div>

        <footer className="modal-foot">
          <div className="scan-safety">
            <IconKeep size={14} />
            <span>Originals are preserved. You can undo any time from Operation History.</span>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn ghost" onClick={onClose}>Cancel</button>
            <button className="btn primary" onClick={onClose}>Rename {photos.length} files</button>
          </div>
        </footer>
      </div>
    </div>
  );
}
