"use client";

import { useEffect, useState } from "react";
import { fmtCount } from "@/lib/lumen/data";
import { IconDrive, IconKeep, IconX } from "./icons";

const SCAN_FOLDERS = [
  "Samsung T7 SSD → DCIM/Camera",
  "Samsung T7 SSD → DCIM/100ANDRO",
  "Samsung T7 SSD → WhatsApp/Media/Images",
  "Samsung T7 SSD → Pictures/Screenshots",
  "Samsung T7 SSD → Downloads/old-phone-2021",
];

const FINDING_TEMPLATES = [
  "Reading EXIF for IMG_{n}.jpg",
  "Hashing IMG_{n}.jpg",
  "Computing pHash for IMG_{n}.jpg",
  "Embedding CLIP for IMG_{n}.jpg",
  "OCR on Screenshot_{n}.png",
  "Found duplicate group · 3 copies of beach-sunset",
  "Detected burst sequence · 7 frames",
  "Detected blurry photo IMG_{n}.jpg · quality 0.18",
  "Detected screenshot IMG_{n}.png",
  "Detected WhatsApp media IMG-{n}-WA.jpg",
  "New face cluster #14 · 12 photos",
  "Generated thumbnail IMG_{n}.jpg",
];

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="stat">
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
      {hint && <div className="stat-hint">{hint}</div>}
    </div>
  );
}

interface Props {
  onClose: () => void;
  onComplete: () => void;
}

export function ScanModal({ onClose, onComplete }: Props) {
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState("Reading folder structure…");
  const [findings, setFindings] = useState<Array<{ msg: string; id: number }>>([]);
  const [stats, setStats] = useState({ files: 0, dups: 0, blur: 0, screenshots: 0, embeds: 0 });

  useEffect(() => {
    let p = 0;
    let timer: ReturnType<typeof setTimeout>;
    let finished = false;
    const tick = () => {
      p = Math.min(100, p + 0.6 + Math.random() * 1.4);
      setProgress(p);
      if (p < 15) setPhase("Reading folder structure…");
      else if (p < 35) setPhase("Extracting EXIF & generating thumbnails…");
      else if (p < 60) setPhase("Computing perceptual hashes…");
      else if (p < 85) setPhase("Generating CLIP embeddings…");
      else if (p < 98) setPhase("Detecting duplicates & quality issues…");
      else setPhase("Finalizing index…");

      if (Math.random() > 0.35) {
        const tpl = FINDING_TEMPLATES[Math.floor(Math.random() * FINDING_TEMPLATES.length)]!;
        const n = 1000 + Math.floor(Math.random() * 9000);
        const msg = tpl.replace("{n}", String(n));
        setFindings((f) => [{ msg, id: Math.random() }, ...f].slice(0, 18));
      }

      setStats((s) => ({
        files: Math.min(87421, s.files + Math.floor(80 + Math.random() * 220)),
        dups: Math.min(412, s.dups + (Math.random() > 0.7 ? 1 : 0)),
        blur: Math.min(328, s.blur + (Math.random() > 0.85 ? 1 : 0)),
        screenshots: Math.min(1934, s.screenshots + (Math.random() > 0.7 ? Math.floor(Math.random() * 4) : 0)),
        embeds: Math.min(87421, s.embeds + Math.floor(60 + Math.random() * 180)),
      }));

      if (p < 100) {
        timer = setTimeout(tick, 80 + Math.random() * 160);
      } else if (!finished) {
        finished = true;
        setTimeout(() => onComplete(), 800);
      }
    };
    tick();
    return () => clearTimeout(timer);
  }, [onComplete]);

  const folderIdx = Math.min(SCAN_FOLDERS.length - 1, Math.floor(progress / 22));

  return (
    <div className="modal-veil" onClick={onClose}>
      <div className="modal scan-modal" onClick={(e) => e.stopPropagation()}>
        <header className="modal-head">
          <div>
            <div className="modal-eyebrow">Scan in progress · all local</div>
            <h2 className="modal-title">Indexing your library</h2>
          </div>
          <button className="modal-x" onClick={onClose}><IconX size={14} /></button>
        </header>

        <div className="scan-status">
          <div className="scan-folder">
            <IconDrive size={14} />
            <span>{SCAN_FOLDERS[folderIdx]}</span>
          </div>
          <div className="scan-bar-wrap">
            <div className="scan-bar" style={{ width: `${progress}%` }} />
          </div>
          <div className="scan-pct">
            <span className="scan-phase">{phase}</span>
            <span className="scan-pct-num">{progress.toFixed(1)}%</span>
          </div>
        </div>

        <div className="scan-stats">
          <Stat label="Files indexed" value={fmtCount(stats.files)} />
          <Stat label="Embeddings" value={fmtCount(stats.embeds)} />
          <Stat label="Duplicate groups" value={fmtCount(stats.dups)} />
          <Stat label="Screenshots" value={fmtCount(stats.screenshots)} />
          <Stat label="Low quality" value={fmtCount(stats.blur)} />
        </div>

        <div className="scan-log">
          <div className="scan-log-label">Live findings</div>
          <div className="scan-log-list">
            {findings.map((f) => (
              <div key={f.id} className="scan-log-row">
                <span className="scan-log-dot" />
                <span className="scan-log-msg">{f.msg}</span>
              </div>
            ))}
          </div>
        </div>

        <footer className="modal-foot">
          <div className="scan-safety">
            <IconKeep size={14} />
            <span>Read-only scan. Nothing will be modified until you confirm.</span>
          </div>
          <button className="btn ghost" onClick={onClose}>Run in background</button>
        </footer>
      </div>
    </div>
  );
}
