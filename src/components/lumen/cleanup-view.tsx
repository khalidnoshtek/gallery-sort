"use client";

import { fmtBytes, fmtCount, type CleanupBucket, type CleanupSummary } from "@/lib/lumen/data";
import {
  IconBroom, IconDrive, IconDup, IconWA, IconShot, IconBlur, IconBurst, IconVideo,
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

function BucketCard({ bucket, onOpen }: { bucket: CleanupBucket; onOpen: () => void }) {
  const c = BUCKET_COLORS[bucket.color]!;
  const Ic = BUCKET_ICONS[bucket.id] ?? IconFile;
  return (
    <button className="bucket" onClick={onOpen} disabled={bucket.count === 0} style={{ opacity: bucket.count === 0 ? 0.45 : 1 }}>
      <div className="bucket-icon" style={{ background: c.bg, color: c.fg }}>
        <Ic size={22} />
      </div>
      <div>
        <div className="bucket-top">
          <h3 className="bucket-label">{bucket.label}</h3>
        </div>
        <p className="bucket-desc">{bucket.desc}</p>
        <div className="bucket-stats">
          <span className="bucket-count">{fmtCount(bucket.count)} files</span>
          <span className="bucket-dot">·</span>
          <span className="bucket-save" style={{ color: c.fg }}>{fmtBytes(bucket.size)}</span>
        </div>
      </div>
      {bucket.count > 0 && (
        <div className="bucket-cta">
          <span>Review</span>
          <IconArrowR size={13} />
        </div>
      )}
    </button>
  );
}

function StorageBar({ buckets, total }: { buckets: CleanupBucket[]; total: number }) {
  if (total <= 0) {
    return <div style={{ height: 8, background: "rgba(255,255,255,0.04)", borderRadius: 999 }} />;
  }
  return (
    <div className="storage-bar">
      <div className="sbar-track">
        {buckets.filter((b) => b.size > 0).map((b) => {
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
        {buckets.filter((b) => b.size > 0).map((b) => {
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

interface Props {
  setView: (v: View) => void;
  cleanup: CleanupSummary;
}

export function CleanupView({ setView, cleanup }: Props) {
  const buckets = cleanup.buckets;
  const total = buckets.reduce((a, b) => a + b.size, 0);
  const photoBytes = cleanup.photosUsed;
  const reclaimGb = cleanup.reclaim / 1024 ** 3;
  const reclaimMb = cleanup.reclaim / 1024 ** 2;
  const showAsGb = reclaimGb >= 1;
  const heroNum = showAsGb
    ? (reclaimGb >= 100 ? reclaimGb.toFixed(0) : reclaimGb.toFixed(1))
    : (reclaimMb >= 100 ? reclaimMb.toFixed(0) : reclaimMb.toFixed(1));
  const heroUnit = showAsGb ? "GB" : "MB";

  const populatedBuckets = buckets.filter((b) => b.count > 0);
  const hasAnything = populatedBuckets.length > 0;

  return (
    <div className="view">
      <section className="cleanup-hero">
        <div>
          <div className="ch-eyebrow">{fmtCount(cleanup.totalScanned)} files indexed in this session</div>
          <h2 className="ch-headline">
            <span className="ch-num">{heroNum}</span>
            <span className="ch-unit">{heroUnit}</span>
            <span className="ch-tag">reclaimable</span>
          </h2>
          <p className="ch-sub">
            {hasAnything ? (
              <>
                Across <strong>{populatedBuckets.length} categor{populatedBuckets.length === 1 ? "y" : "ies"}</strong>.
                The web build is analysis-only — open the desktop app to actually move files. Everything you
                see is computed locally; nothing was uploaded.
              </>
            ) : (
              <>
                Nothing flagged. Your library is already clean — no exact or near-duplicates, no obvious
                screenshot/messenger junk.
              </>
            )}
          </p>
          {hasAnything && (
            <div className="ch-actions">
              <button className="btn primary" onClick={() => setView("dups")}>
                <IconBroom size={14} /> Review duplicates
              </button>
            </div>
          )}
        </div>

        <div className="ch-right">
          <div className="ch-disk">
            <div className="ch-disk-label">
              <IconDrive size={14} />
              <span>Library size</span>
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
                  strokeDasharray={`${Math.min(314, (cleanup.reclaim / Math.max(1, photoBytes)) * 314)} 314`}
                  strokeLinecap="round"
                  transform="rotate(-90 60 60)"
                />
              </svg>
              <div className="ch-disk-center">
                <div className="ch-disk-used">{fmtBytes(photoBytes)}</div>
                <div className="ch-disk-of">{fmtCount(cleanup.totalScanned)} files</div>
              </div>
            </div>
            <div className="ch-disk-meta">
              <div><span className="ch-dot photos" />Total<b>{fmtBytes(photoBytes)}</b></div>
              <div><span className="ch-dot other" />Reclaim<b>{fmtBytes(cleanup.reclaim)}</b></div>
              <div><span className="ch-dot free" />Dup groups<b>{fmtCount((buckets.find((b) => b.id === "dups")?.count ?? 0))}</b></div>
            </div>
          </div>
        </div>
      </section>

      {total > 0 && (
        <section className="cleanup-storage">
          <div className="section-head">
            <h3>By category</h3>
            <span>Tap any bucket to review</span>
          </div>
          <StorageBar buckets={buckets} total={total} />
        </section>
      )}

      <section className="cleanup-buckets">
        {buckets.map((b) => (
          <BucketCard
            key={b.id}
            bucket={b}
            onOpen={() => (b.id === "dups" || b.id === "burst" ? setView("dups") : undefined)}
          />
        ))}
      </section>

      <section className="cleanup-safe">
        <div className="safe-row">
          <div className="safe-tag"><IconKeep size={14} /> Privacy-first</div>
          <p>Hashes, thumbnails and metadata stay in your browser — never uploaded. Open DevTools → Network during a scan to verify.</p>
        </div>
        <div className="safe-row">
          <div className="safe-tag"><IconRestore size={14} /> Read-only on the web</div>
          <p>Lumen on the web analyses; it can&apos;t move or delete files. For actual cleanup, run the desktop build (see the repo README).</p>
        </div>
      </section>
    </div>
  );
}
