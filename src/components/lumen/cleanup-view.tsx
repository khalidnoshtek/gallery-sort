"use client";

import { CLEANUP, fmtBytes, fmtCount, type CleanupBucket } from "@/lib/lumen/data";
import {
  IconBroom, IconSparkle, IconDrive, IconDup, IconWA, IconShot, IconBlur, IconBurst, IconVideo,
  IconFile, IconArrowR, IconKeep, IconRestore,
} from "./icons";
import type { View } from "./types";
import type { ComponentType } from "react";

const BUCKET_COLORS: Record<string, { fg: string; bg: string }> = {
  lavender: { fg: "oklch(0.82 0.08 295)", bg: "oklch(0.82 0.08 295 / 0.12)" },
  amber: { fg: "oklch(0.86 0.09 78)", bg: "oklch(0.86 0.09 78 / 0.12)" },
  blue: { fg: "oklch(0.82 0.07 230)", bg: "oklch(0.82 0.07 230 / 0.12)" },
  rose: { fg: "oklch(0.80 0.09 22)", bg: "oklch(0.80 0.09 22 / 0.12)" },
  lime: { fg: "oklch(0.86 0.08 145)", bg: "oklch(0.86 0.08 145 / 0.12)" },
  violet: { fg: "oklch(0.75 0.09 290)", bg: "oklch(0.75 0.09 290 / 0.12)" },
};

const BUCKET_ICONS: Record<CleanupBucket["id"], ComponentType<{ size?: number }>> = {
  dups: IconDup,
  ws: IconWA,
  shots: IconShot,
  blur: IconBlur,
  burst: IconBurst,
  large: IconVideo,
};

function BucketCard({ bucket, onOpen, showConfidence }: { bucket: CleanupBucket; onOpen: () => void; showConfidence?: boolean }) {
  const c = BUCKET_COLORS[bucket.color]!;
  const Ic = BUCKET_ICONS[bucket.id] ?? IconFile;
  return (
    <button className="bucket" onClick={onOpen}>
      <div className="bucket-icon" style={{ background: c.bg, color: c.fg }}>
        <Ic size={22} />
      </div>
      <div>
        <div className="bucket-top">
          <h3 className="bucket-label">{bucket.label}</h3>
          {showConfidence && (
            <span className="bucket-conf" style={{ color: c.fg }}>{Math.round(bucket.confidence * 100)}% conf.</span>
          )}
        </div>
        <p className="bucket-desc">{bucket.desc}</p>
        <div className="bucket-stats">
          <span className="bucket-count">{fmtCount(bucket.count)} files</span>
          <span className="bucket-dot">·</span>
          <span className="bucket-save" style={{ color: c.fg }}>{fmtBytes(bucket.size)}</span>
        </div>
      </div>
      <div className="bucket-cta">
        <span>Review</span>
        <IconArrowR size={13} />
      </div>
    </button>
  );
}

function StorageBar({ buckets, total }: { buckets: CleanupBucket[]; total: number }) {
  return (
    <div className="storage-bar">
      <div className="sbar-track">
        {buckets.map((b) => {
          const w = (b.size / total) * 100;
          const c = BUCKET_COLORS[b.color]!;
          return (
            <div
              key={b.id}
              className="sbar-seg"
              style={{ width: `${w}%`, background: c.fg, opacity: 0.85 }}
              title={`${b.label} · ${fmtBytes(b.size)}`}
            />
          );
        })}
      </div>
      <div className="sbar-legend">
        {buckets.map((b) => {
          const c = BUCKET_COLORS[b.color]!;
          return (
            <div key={b.id} className="sbar-leg-item">
              <span className="sbar-leg-dot" style={{ background: c.fg }} />
              <span className="sbar-leg-label">{b.label}</span>
              <span className="sbar-leg-size">{fmtBytes(b.size)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Heatmap() {
  const rows = 4;
  const cols = 18;
  const cells: number[] = [];
  let seed = 7;
  for (let i = 0; i < rows * cols; i++) {
    seed = (seed * 9301 + 49297) % 233280;
    const r = seed / 233280;
    cells.push(0.06 + r * 0.55);
  }
  return (
    <div className="heatmap">
      <div className="heatmap-grid" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
        {cells.map((intensity, i) => (
          <div key={i} className="heat-cell" style={{ background: `rgba(244,242,239,${intensity})` }} />
        ))}
      </div>
      <div className="heatmap-axis">
        <span>Jul &apos;23</span>
        <span>Jan &apos;24</span>
        <span>Jul &apos;24</span>
        <span>Now</span>
      </div>
    </div>
  );
}

interface Props {
  setView: (v: View) => void;
  showConfidence?: boolean;
}

export function CleanupView({ setView, showConfidence = true }: Props) {
  const total = CLEANUP.buckets.reduce((a, b) => a + b.size, 0);

  const recs = [
    { id: "r1", text: "Move 1,247 WhatsApp images older than 1 year to a separate album. Free ~3.8 GB.", primary: "Apply", icon: IconWA },
    { id: "r2", text: "Keep the sharpest frame of 23 burst sequences. Trash 589 near-duplicates.", primary: "Review", icon: IconBurst },
    { id: "r3", text: "Compress 18 large videos (>500 MB) — projected savings 6.2 GB, no quality loss.", primary: "Preview", icon: IconVideo },
  ];

  const usedFraction = CLEANUP.driveUsed / CLEANUP.driveTotal;
  const circumference = 2 * Math.PI * 50;

  return (
    <div className="view">
      <section className="cleanup-hero">
        <div>
          <div className="ch-eyebrow">Last scanned 4 minutes ago · 87,421 files</div>
          <h2 className="ch-headline">
            <span className="ch-num">27.4</span>
            <span className="ch-unit">GB</span>
            <span className="ch-tag">reclaimable</span>
          </h2>
          <p className="ch-sub">
            Across <strong>{CLEANUP.buckets.length} categories</strong>. Every file is staged, never deleted —
            review each bucket and confirm before anything moves.
          </p>
          <div className="ch-actions">
            <button className="btn primary" onClick={() => setView("dups")}>
              <IconBroom size={14} /> Start cleanup review
            </button>
            <button className="btn ghost">
              <IconSparkle size={14} /> Apply all AI recommendations
            </button>
          </div>
        </div>

        <div className="ch-right">
          <div className="ch-disk">
            <div className="ch-disk-label">
              <IconDrive size={14} />
              <span>Samsung T7 SSD · 512 GB</span>
            </div>
            <div className="ch-disk-ring">
              <svg viewBox="0 0 120 120">
                <circle cx="60" cy="60" r="50" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="10" />
                <circle
                  cx="60"
                  cy="60"
                  r="50"
                  fill="none"
                  stroke="var(--accent)"
                  strokeWidth="10"
                  strokeDasharray={`${usedFraction * circumference} ${circumference}`}
                  strokeLinecap="round"
                  transform="rotate(-90 60 60)"
                />
              </svg>
              <div className="ch-disk-center">
                <div className="ch-disk-used">389 GB</div>
                <div className="ch-disk-of">of 512 GB</div>
              </div>
            </div>
            <div className="ch-disk-meta">
              <div><span className="ch-dot photos" />Photos<b>248 GB</b></div>
              <div><span className="ch-dot other" />Other<b>141 GB</b></div>
              <div><span className="ch-dot free" />Free<b>123 GB</b></div>
            </div>
          </div>
        </div>
      </section>

      <section className="cleanup-storage">
        <div className="section-head">
          <h3>By category</h3>
          <span>Tap any to review and stage actions</span>
        </div>
        <StorageBar buckets={CLEANUP.buckets} total={total} />
      </section>

      <section className="cleanup-buckets">
        {CLEANUP.buckets.map((b) => (
          <BucketCard
            key={b.id}
            bucket={b}
            showConfidence={showConfidence}
            onOpen={() => (b.id === "dups" ? setView("dups") : undefined)}
          />
        ))}
      </section>

      <section className="cleanup-recs">
        <div className="section-head">
          <h3>Smart recommendations</h3>
          <span>Conservative defaults · everything is dry-run first</span>
        </div>
        <div className="recs-list">
          {recs.map((r) => (
            <article key={r.id} className="rec">
              <div className="rec-ic"><r.icon size={18} /></div>
              <div className="rec-body">{r.text}</div>
              <div className="rec-actions">
                <button className="btn-sm ghost">Dismiss</button>
                <button className="btn-sm primary">{r.primary}</button>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="cleanup-heat">
        <div className="section-head">
          <h3>Storage growth over time</h3>
          <span>Brighter cells = more bytes added</span>
        </div>
        <Heatmap />
      </section>

      <section className="cleanup-safe">
        <div className="safe-row">
          <div className="safe-tag"><IconKeep size={14} /> Privacy-first</div>
          <p>Nothing leaves your machine. Embeddings, hashes and OCR text are stored locally in <code>~/.lumen/index.sqlite</code>.</p>
        </div>
        <div className="safe-row">
          <div className="safe-tag"><IconRestore size={14} /> Always reversible</div>
          <p>Every destructive action goes into a recoverable Trash for 30 days. <a>Operation history</a></p>
        </div>
      </section>
    </div>
  );
}
