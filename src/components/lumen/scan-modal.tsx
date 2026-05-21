"use client";

import { useRef, useState } from "react";
import { useLibraryStore } from "@/state/library-store";
import { scan as runScan, type ScanInput } from "@/lib/browser/scanner";
import { fsHandles, supportsFsAccess } from "@/lib/browser/handles";
import { fmtBytes, fmtCount } from "@/lib/lumen/data";
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

async function walkDirectory(
  dir: FileSystemDirectoryHandle,
  prefix = "",
): Promise<ScanInput[]> {
  const out: ScanInput[] = [];
  // @ts-expect-error entries() is on FileSystemDirectoryHandle but not always typed
  for await (const [name, entry] of dir.entries()) {
    const path = prefix ? `${prefix}/${name}` : name;
    if (entry.kind === "file") {
      const handle = entry as FileSystemFileHandle;
      const file = await handle.getFile();
      out.push({ file, relativePath: path, parentDirHandle: dir });
    } else if (entry.kind === "directory") {
      const sub = await walkDirectory(entry as FileSystemDirectoryHandle, path);
      out.push(...sub);
    }
  }
  return out;
}

function listToInputs(files: FileList | File[]): ScanInput[] {
  const out: ScanInput[] = [];
  for (let i = 0; i < (files as FileList).length; i++) {
    const f = (files as FileList)[i]!;
    out.push({ file: f, relativePath: (f as File & { webkitRelativePath?: string }).webkitRelativePath || f.name });
  }
  return out;
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
  const [writeMode, setWriteMode] = useState(false);
  const setStoreProgress = useLibraryStore((s) => s.setProgress);
  const setStoreResult = useLibraryStore((s) => s.setResult);

  const canWrite = supportsFsAccess();

  function pushFinding(msg: string) {
    setFindings((f) => [{ msg, id: Math.random() }, ...f].slice(0, 18));
  }

  async function runWithInputs(inputs: ScanInput[], topName: string, writeAccess: boolean) {
    setFolderName(topName);
    setWriteMode(writeAccess);
    setError(null);
    setPhase("scanning");
    setProgress(0);
    setFindings([]);
    setCounts({ files: 0, dups: 0, images: 0, videos: 0 });

    try {
      const result = await runScan({
        inputs,
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
          folderName: topName,
          itemCount: result.items.length,
          totalBytes: result.totalBytes,
          scannedAt: Date.now(),
        },
        result.items,
        result.duplicates.exact,
        result.duplicates.near,
        writeAccess,
      );
      setPhase("done");
    } catch (err) {
      setError(String(err));
      setPhase("pick");
    }
  }

  async function pickWithFsAccess() {
    fsHandles.clear();
    try {
      const handle = await window.showDirectoryPicker!({ mode: "readwrite", id: "lumen-library" });
      fsHandles.setRoot(handle);
      setError(null);
      // Walk before scanning so we have the input count for progress.
      setPhase("scanning");
      setPhaseLabel("Reading folder structure…");
      const inputs = await walkDirectory(handle);
      await runWithInputs(inputs, handle.name || "Selected folder", true);
    } catch (err) {
      if ((err as { name?: string }).name === "AbortError") {
        setPhase("pick");
        return;
      }
      setError(String(err));
      setPhase("pick");
    }
  }

  function pickFallback() {
    fileInputRef.current?.click();
  }

  async function handleFallbackFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    fsHandles.clear();
    const first = files[0] as File & { webkitRelativePath?: string };
    const top = first.webkitRelativePath?.split("/")[0] ?? "Selected folder";
    await runWithInputs(listToInputs(files), top, false);
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

        <input
          ref={fileInputRef}
          type="file"
          /* @ts-expect-error non-standard HTML attribute */
          webkitdirectory=""
          directory=""
          multiple
          style={{ display: "none" }}
          onChange={(e) => handleFallbackFiles(e.target.files)}
        />

        {phase === "pick" && (
          <>
            <div className="scan-status">
              <p style={{ color: "var(--secondary)", fontSize: 13.5, margin: "4px 0 18px", lineHeight: 1.55 }}>
                Lumen reads every image in the folder you pick — locally, in your browser. Nothing uploads.
              </p>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                {canWrite && (
                  <button className="btn primary" onClick={pickWithFsAccess} style={{ padding: "12px 18px" }}>
                    <IconFolder size={14} /> Choose folder (with cleanup access)
                  </button>
                )}
                <button className={canWrite ? "btn ghost" : "btn primary"} onClick={pickFallback} style={{ padding: "12px 18px" }}>
                  <IconFolder size={14} /> Choose folder (read only)
                </button>
              </div>
              {canWrite ? (
                <p style={{ color: "var(--muted)", fontSize: 11.5, marginTop: 12, letterSpacing: "-0.005em" }}>
                  &ldquo;With cleanup access&rdquo; lets Lumen actually move flagged files into a <code style={{ fontFamily: "var(--mono)" }}>.lumen-trash/</code> subfolder when you confirm.
                  &ldquo;Read only&rdquo; can analyze but only generate a script for you to run manually.
                </p>
              ) : (
                <p style={{ color: "var(--muted)", fontSize: 11.5, marginTop: 12 }}>
                  Your browser doesn&apos;t support direct file moves (try Chrome/Edge/Safari for that). You&apos;ll be able to analyze and download a cleanup script.
                </p>
              )}
              {error && (
                <p style={{ color: "var(--danger)", fontSize: 12, marginTop: 14 }}>{error}</p>
              )}
            </div>

            <div className="scan-stats">
              <Stat label="Hash" value="SHA-256" hint="Web Crypto" />
              <Stat label="Perceptual" value="dHash" hint="64-bit" />
              <Stat label="Blur" value="Laplacian" hint="variance" />
              <Stat label="Thumbnails" value="256-px" hint="webp" />
              <Stat label="Uploads" value="0" hint="Ever" />
            </div>

            <footer className="modal-foot">
              <div className="scan-safety">
                <IconKeep size={14} />
                <span>Read-only by default. Nothing on disk moves without explicit confirmation.</span>
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
              <div className="scan-log-label">{writeMode ? "Cleanup access: ON · you can move/delete from the app" : "Cleanup access: OFF · script-only mode"}</div>
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
                <span>Your library is in Lumen. Nothing was modified on disk.</span>
              </div>
              <button className="btn primary" onClick={onComplete}>Open AI suggestions</button>
            </footer>
          </>
        )}
      </div>
    </div>
  );
}
