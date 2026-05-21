"use client";

import { useRef, useState } from "react";
import { useLibraryStore } from "@/state/library-store";
import { scan as runScan } from "@/lib/browser/scanner";
import { fmtCount, fmtBytes } from "@/lib/lumen/data";
import { IconCheck, IconDrive, IconFolder, IconKeep, IconX } from "./icons";

type Phase = "pick" | "scanning" | "done";

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
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [phase, setPhase] = useState<Phase>("pick");
  const [progress, setProgress] = useState(0);
  const [phaseLabel, setPhaseLabel] = useState("Reading folder structure…");
  const [currentPath, setCurrentPath] = useState<string | null>(null);
  const [findings, setFindings] = useState<Array<{ msg: string; id: number }>>([]);
  const [counts, setCounts] = useState({ files: 0, dups: 0, images: 0, videos: 0 });
  const [folderName, setFolderName] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const setStoreProgress = useLibraryStore((s) => s.setProgress);
  const setStoreResult = useLibraryStore((s) => s.setResult);

  function pushFinding(msg: string) {
    setFindings((f) => [{ msg, id: Math.random() }, ...f].slice(0, 18));
  }

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const first = files[0] as File & { webkitRelativePath?: string };
    const top = first.webkitRelativePath?.split("/")[0] ?? "Selected folder";
    setFolderName(top);
    setError(null);
    setPhase("scanning");
    setProgress(0);
    setFindings([]);
    setCounts({ files: 0, dups: 0, images: 0, videos: 0 });

    try {
      const result = await runScan({
        files,
        onProgress: (p) => {
          setStoreProgress(p);
          const pct = p.total > 0 ? (p.scanned / p.total) * 100 : 0;
          setProgress(pct);
          setCurrentPath(p.current);
          if (p.phase === "enumerating") setPhaseLabel("Reading folder structure…");
          else if (p.phase === "hashing") setPhaseLabel("Hashing & generating thumbnails…");
          else if (p.phase === "dedup") setPhaseLabel("Detecting duplicates…");
          else if (p.phase === "done") setPhaseLabel("Finalizing index…");
          if (p.current && Math.random() < 0.18) {
            const name = p.current.split("/").pop() ?? p.current;
            pushFinding(`Hashing ${name}`);
          }
        },
      });

      // Stream image/video counts in batches at the end (cheap enough).
      const images = result.items.filter((i) => i.kind === "IMAGE").length;
      const videos = result.items.filter((i) => i.kind === "VIDEO").length;
      setCounts({
        files: result.items.length,
        dups: result.duplicates.exact.length + result.duplicates.near.length,
        images,
        videos,
      });

      for (const g of result.duplicates.exact) {
        pushFinding(`Found exact-duplicate group · ${g.memberIds.length} copies`);
      }
      for (const g of result.duplicates.near.slice(0, 3)) {
        pushFinding(`Found near-duplicate cluster · ${g.memberIds.length} variants`);
      }

      setStoreResult(
        {
          folderName: top,
          itemCount: result.items.length,
          totalBytes: result.totalBytes,
          scannedAt: Date.now(),
        },
        result.items,
        result.duplicates.exact,
        result.duplicates.near,
      );
      setPhase("done");
    } catch (err) {
      setError(String(err));
      setPhase("pick");
    }
  }

  function pickFolder() {
    fileInputRef.current?.click();
  }

  return (
    <div className="modal-veil" onClick={onClose}>
      <div className="modal scan-modal" onClick={(e) => e.stopPropagation()}>
        <header className="modal-head">
          <div>
            <div className="modal-eyebrow">
              {phase === "pick" && "Pick a folder · all local"}
              {phase === "scanning" && "Scan in progress · all local"}
              {phase === "done" && "Scan complete · all local"}
            </div>
            <h2 className="modal-title">
              {phase === "pick" && "Choose your photo library"}
              {phase === "scanning" && "Indexing your library"}
              {phase === "done" && "Library indexed"}
            </h2>
          </div>
          <button className="modal-x" onClick={onClose}><IconX size={14} /></button>
        </header>

        {/* Hidden picker — supports any browser via webkitdirectory */}
        <input
          ref={fileInputRef}
          type="file"
          /* @ts-expect-error non-standard HTML attribute */
          webkitdirectory=""
          directory=""
          multiple
          style={{ display: "none" }}
          onChange={(e) => handleFiles(e.target.files)}
        />

        {phase === "pick" && (
          <>
            <div className="scan-status">
              <p style={{ color: "var(--secondary)", fontSize: 13.5, margin: "4px 0 18px", lineHeight: 1.55 }}>
                Lumen reads every image in the folder you pick — locally, in your browser. Nothing is uploaded.
                Files aren&apos;t moved or modified.
              </p>
              <button className="btn primary" onClick={pickFolder} style={{ padding: "12px 18px" }}>
                <IconFolder size={14} /> Choose folder
              </button>
              {error && (
                <p style={{ color: "var(--danger)", fontSize: 12, marginTop: 14 }}>{error}</p>
              )}
            </div>

            <div className="scan-stats">
              <Stat label="Method" value="SHA-256" hint="Web Crypto" />
              <Stat label="Perceptual" value="dHash" hint="64-bit" />
              <Stat label="Thumbnails" value="webp" hint="256px" />
              <Stat label="Storage" value="Memory" hint="Per session" />
              <Stat label="Uploads" value="0" hint="Ever" />
            </div>

            <div className="scan-log">
              <div className="scan-log-label">What gets indexed</div>
              <div className="scan-log-list">
                {[
                  "Filenames, sizes, dimensions",
                  "SHA-256 of every file (exact-duplicate detection)",
                  "Perceptual dHash of every image (resize/recompress detection)",
                  "256-px webp thumbnail per image (canvas-rendered, in-memory)",
                  "Heuristic category by path: screenshots, WhatsApp, transactional",
                ].map((m) => (
                  <div key={m} className="scan-log-row">
                    <span className="scan-log-dot" />
                    <span className="scan-log-msg">{m}</span>
                  </div>
                ))}
              </div>
            </div>

            <footer className="modal-foot">
              <div className="scan-safety">
                <IconKeep size={14} />
                <span>Read-only. Nothing on disk is moved or modified.</span>
              </div>
              <button className="btn ghost" onClick={onClose}>Maybe later</button>
            </footer>
          </>
        )}

        {phase === "scanning" && (
          <>
            <div className="scan-status">
              <div className="scan-folder">
                <IconDrive size={14} />
                <span>{folderName} {currentPath ? `→ ${currentPath.split("/").slice(-2).join("/")}` : ""}</span>
              </div>
              <div className="scan-bar-wrap">
                <div className="scan-bar" style={{ width: `${progress}%` }} />
              </div>
              <div className="scan-pct">
                <span className="scan-phase">{phaseLabel}</span>
                <span className="scan-pct-num">{progress.toFixed(1)}%</span>
              </div>
            </div>

            <div className="scan-stats">
              <Stat label="Files scanned" value={fmtCount(counts.files)} />
              <Stat label="Images" value={fmtCount(counts.images)} />
              <Stat label="Videos" value={fmtCount(counts.videos)} />
              <Stat label="Dup groups" value={fmtCount(counts.dups)} />
              <Stat label="Uploads" value="0" hint="Local only" />
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
          </>
        )}

        {phase === "done" && (
          <>
            <div className="scan-status">
              <div className="scan-folder">
                <IconDrive size={14} />
                <span>{folderName}</span>
              </div>
              <div className="scan-bar-wrap">
                <div className="scan-bar" style={{ width: `100%` }} />
              </div>
              <div className="scan-pct">
                <span className="scan-phase">Done · {fmtCount(counts.files)} files indexed</span>
                <span className="scan-pct-num">100%</span>
              </div>
            </div>

            <div className="scan-stats">
              <Stat label="Files indexed" value={fmtCount(counts.files)} />
              <Stat label="Images" value={fmtCount(counts.images)} />
              <Stat label="Videos" value={fmtCount(counts.videos)} />
              <Stat label="Duplicates" value={fmtCount(counts.dups)} hint="groups" />
              <Stat
                label="Total size"
                value={fmtBytes(useLibraryStore.getState().summary?.totalBytes ?? 0)}
              />
            </div>

            <div className="scan-log">
              <div className="scan-log-label">Highlights</div>
              <div className="scan-log-list">
                {findings.slice(0, 8).map((f) => (
                  <div key={f.id} className="scan-log-row">
                    <span className="scan-log-dot" />
                    <span className="scan-log-msg">{f.msg}</span>
                  </div>
                ))}
              </div>
            </div>

            <footer className="modal-foot">
              <div className="scan-safety">
                <IconCheck size={14} />
                <span>Your library is now in Lumen. Nothing was modified on disk.</span>
              </div>
              <button className="btn primary" onClick={onComplete}>Open library</button>
            </footer>
          </>
        )}
      </div>
    </div>
  );
}
