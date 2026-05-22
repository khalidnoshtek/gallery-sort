"use client";

import { useRef, useState } from "react";
import { useLibraryStore } from "@/state/library-store";
import { fsHandles } from "@/lib/browser/handles";
import { runAiAnalysis } from "@/lib/browser/ai-runner";
import { fmtCount } from "@/lib/lumen/data";
import { IconCheck, IconSparkle, IconX } from "./icons";

interface Props {
  onClose: () => void;
  onComplete: () => void;
}

export function AiModal({ onClose, onComplete }: Props) {
  const items = useLibraryStore((s) => s.items);
  const patchItems = useLibraryStore((s) => s.patchItems);

  const [phase, setPhase] = useState<"idle" | "running" | "done">("idle");
  const [progress, setProgress] = useState(0);
  const [statusLabel, setStatusLabel] = useState("Idle");
  const [current, setCurrent] = useState<string | null>(null);
  const [stats, setStats] = useState({ scanned: 0, embedded: 0, faces: 0 });
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const targets = items.filter((i) => i.kind === "IMAGE");
  const hasWriteAccess = fsHandles.hasWriteAccess();
  const canRun = hasWriteAccess && targets.length > 0;

  const run = async () => {
    if (!canRun) return;
    setPhase("running");
    setError(null);
    setProgress(0);
    setStats({ scanned: 0, embedded: 0, faces: 0 });
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    try {
      const patches = await runAiAnalysis({
        items,
        getFile: async (id) => {
          const h = fsHandles.get(id);
          if (!h) return null;
          try {
            const fh = await h.parentDir.getFileHandle(h.filename);
            return await fh.getFile();
          } catch {
            return null;
          }
        },
        doFaces: true,
        signal: ctrl.signal,
        onProgress: (p) => {
          const pct = p.total > 0 ? (p.scanned / p.total) * 100 : 0;
          setProgress(pct);
          setStatusLabel(p.phase);
          setCurrent(p.current);
        },
      });

      // Batch-apply patches to the store
      patchItems(patches);

      const embedded = patches.filter((p) => p.clipEmbedding !== null).length;
      const totalFaces = patches.reduce((a, p) => a + (p.faces?.length ?? 0), 0);
      setStats({ scanned: patches.length, embedded, faces: totalFaces });
      setPhase("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setPhase("idle");
    } finally {
      abortRef.current = null;
    }
  };

  const cancel = () => {
    abortRef.current?.abort();
  };

  return (
    <div className="modal-veil" onClick={onClose}>
      <div className="modal scan-modal" onClick={(e) => e.stopPropagation()}>
        <header className="modal-head">
          <div>
            <div className="modal-eyebrow">Local AI analysis · models downloaded once</div>
            <h2 className="modal-title">
              {phase === "idle" && "Enable semantic search & face grouping"}
              {phase === "running" && "Analyzing your library"}
              {phase === "done" && "Analysis complete"}
            </h2>
          </div>
          <button className="modal-x" onClick={onClose}><IconX size={14} /></button>
        </header>

        {phase === "idle" && (
          <>
            <div className="scan-status">
              <p style={{ color: "var(--secondary)", fontSize: 13.5, margin: "4px 0 18px", lineHeight: 1.55 }}>
                Lumen will download two open-source models (~150 MB combined, one-time, cached
                forever) and run them on each image — locally, in your browser. No image data
                ever leaves your machine.
              </p>
              <ul style={{ color: "var(--muted)", fontSize: 12.5, lineHeight: 1.7, margin: 0, paddingLeft: 18 }}>
                <li><strong style={{ color: "var(--text)" }}>CLIP</strong> (ViT-B/32) — semantic search by what&apos;s <em>in</em> the photo</li>
                <li><strong style={{ color: "var(--text)" }}>face-api</strong> — face detection + 128-d descriptors → People view</li>
              </ul>
              <p style={{ color: "var(--muted)", fontSize: 11.5, marginTop: 14, letterSpacing: "-0.005em" }}>
                Encoding speed: roughly 1-5 images / second per CPU core. {fmtCount(targets.length)} images ≈{" "}
                {Math.ceil(targets.length / 4 / 60)}-{Math.ceil(targets.length / 1)} minutes on first run.
              </p>
              {!hasWriteAccess && (
                <p style={{ color: "var(--warn)", fontSize: 12, marginTop: 14 }}>
                  Your folder was picked read-only — pick again with cleanup access for AI analysis.
                </p>
              )}
              {error && (
                <p style={{ color: "var(--danger)", fontSize: 12, marginTop: 14 }}>{error}</p>
              )}
            </div>
            <footer className="modal-foot">
              <div className="scan-safety">
                <IconSparkle size={14} />
                <span>All inference local · no uploads</span>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="btn ghost" onClick={onClose}>Cancel</button>
                <button className="btn primary" onClick={run} disabled={!canRun}>
                  Start analysis
                </button>
              </div>
            </footer>
          </>
        )}

        {phase === "running" && (
          <>
            <div className="scan-status">
              <div className="scan-folder">
                <IconSparkle size={14} />
                <span>{statusLabel}{current ? ` · ${current.split("/").slice(-2).join("/")}` : ""}</span>
              </div>
              <div className="scan-bar-wrap">
                <div className="scan-bar" style={{ width: `${progress}%` }} />
              </div>
              <div className="scan-pct">
                <span className="scan-phase">Encoding {Math.round(progress)}%</span>
                <span className="scan-pct-num">{progress.toFixed(1)}%</span>
              </div>
            </div>
            <footer className="modal-foot">
              <div className="scan-safety">
                <IconSparkle size={14} />
                <span>This can take a few minutes the first time. Models cache for next visit.</span>
              </div>
              <button className="btn ghost" onClick={cancel}>Cancel</button>
            </footer>
          </>
        )}

        {phase === "done" && (
          <>
            <div className="scan-status">
              <div className="scan-bar-wrap">
                <div className="scan-bar" style={{ width: `100%` }} />
              </div>
              <div className="scan-pct">
                <span className="scan-phase">Analysis complete</span>
                <span className="scan-pct-num">100%</span>
              </div>
            </div>
            <div className="scan-stats">
              <div className="stat">
                <div className="stat-value">{fmtCount(stats.scanned)}</div>
                <div className="stat-label">Images analyzed</div>
              </div>
              <div className="stat">
                <div className="stat-value">{fmtCount(stats.embedded)}</div>
                <div className="stat-label">CLIP embeddings</div>
              </div>
              <div className="stat">
                <div className="stat-value">{fmtCount(stats.faces)}</div>
                <div className="stat-label">Faces detected</div>
              </div>
              <div className="stat">
                <div className="stat-value">✓</div>
                <div className="stat-label">Search now semantic</div>
              </div>
              <div className="stat">
                <div className="stat-value">✓</div>
                <div className="stat-label">People view available</div>
              </div>
            </div>
            <footer className="modal-foot">
              <div className="scan-safety">
                <IconCheck size={14} />
                <span>Try the People view, or search like &quot;beach sunset&quot;.</span>
              </div>
              <button className="btn primary" onClick={onComplete}>Open People</button>
            </footer>
          </>
        )}
      </div>
    </div>
  );
}
