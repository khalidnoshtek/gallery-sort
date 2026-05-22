"use client";

import { useEffect, useRef, useState } from "react";
import { useLibraryStore } from "@/state/library-store";
import { fsHandles } from "@/lib/browser/handles";
import { runAiAnalysis } from "@/lib/browser/ai-runner";
import { fmtCount } from "@/lib/lumen/data";
import { IconCheck, IconSparkle, IconX } from "./icons";

interface Props {
  onClose: () => void;
  onComplete: () => void;
}

type Phase = "idle" | "running" | "done" | "failed";

interface LogLine {
  msg: string;
  kind: "info" | "warn" | "error";
  ts: number;
}

export function AiModal({ onClose, onComplete }: Props) {
  const items = useLibraryStore((s) => s.items);
  const patchItems = useLibraryStore((s) => s.patchItems);

  const [phase, setPhase] = useState<Phase>("idle");
  const [progress, setProgress] = useState(0);
  const [statusLabel, setStatusLabel] = useState("Idle");
  const [current, setCurrent] = useState<string | null>(null);
  const [counts, setCounts] = useState({ scanned: 0, embedded: 0, faces: 0, errors: 0 });
  const [logs, setLogs] = useState<LogLine[]>([]);
  const abortRef = useRef<AbortController | null>(null);
  const logScrollRef = useRef<HTMLDivElement | null>(null);

  const targets = items.filter((i) => i.kind === "IMAGE");
  const hasWriteAccess = fsHandles.hasWriteAccess();
  const canRun = hasWriteAccess && targets.length > 0;

  const appendLog = (msg: string, kind: LogLine["kind"] = "info") => {
    setLogs((l) => [...l, { msg, kind, ts: Date.now() }].slice(-200));
  };

  useEffect(() => {
    if (logScrollRef.current) {
      logScrollRef.current.scrollTop = logScrollRef.current.scrollHeight;
    }
  }, [logs]);

  const run = async () => {
    if (!canRun) return;
    setPhase("running");
    setProgress(0);
    setLogs([]);
    setCounts({ scanned: 0, embedded: 0, faces: 0, errors: 0 });
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
          } catch (err) {
            appendLog(`File-handle access failed: ${err}`, "warn");
            return null;
          }
        },
        doFaces: true,
        signal: ctrl.signal,
        onLog: appendLog,
        onProgress: (p) => {
          const pct = p.total > 0 ? (p.scanned / p.total) * 100 : 0;
          setProgress(pct);
          setStatusLabel(p.phase);
          setCurrent(p.current);
          setCounts((c) => ({ ...c, scanned: p.scanned, errors: p.errors }));
        },
      });

      patchItems(patches);

      const embedded = patches.filter((p) => p.clipEmbedding !== null).length;
      const totalFaces = patches.reduce((a, p) => a + (p.faces?.length ?? 0), 0);
      const errors = patches.length - embedded;
      setCounts({ scanned: patches.length, embedded, faces: totalFaces, errors });
      setPhase(embedded > 0 ? "done" : "failed");
      if (embedded === 0) {
        appendLog("Analysis finished but produced 0 embeddings — see warnings above", "error");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      appendLog(`FATAL: ${msg}`, "error");
      setPhase("failed");
    } finally {
      abortRef.current = null;
    }
  };

  const cancel = () => abortRef.current?.abort();

  return (
    <div className="modal-veil" onClick={onClose}>
      <div className="modal scan-modal" onClick={(e) => e.stopPropagation()} style={{ width: 820 }}>
        <header className="modal-head">
          <div>
            <div className="modal-eyebrow">Local AI · models downloaded once, cached forever</div>
            <h2 className="modal-title">
              {phase === "idle" && "Enable semantic search & face grouping"}
              {phase === "running" && "Analyzing your library"}
              {phase === "done" && "Analysis complete"}
              {phase === "failed" && "Analysis failed — see log"}
            </h2>
          </div>
          <button className="modal-x" onClick={onClose}><IconX size={14} /></button>
        </header>

        {phase === "idle" && (
          <div className="scan-status">
            <p style={{ color: "var(--secondary)", fontSize: 13.5, margin: "4px 0 14px", lineHeight: 1.55 }}>
              Two open-source models, ~150 MB combined, downloaded once and cached in your browser.
              Every inference runs locally; nothing leaves your machine.
            </p>
            <ul style={{ color: "var(--muted)", fontSize: 12.5, lineHeight: 1.7, margin: "0 0 14px", paddingLeft: 18 }}>
              <li><strong style={{ color: "var(--text)" }}>CLIP ViT-B/32</strong> — semantic search</li>
              <li><strong style={{ color: "var(--text)" }}>face-api</strong> — detection + 128-d descriptors</li>
            </ul>
            <p style={{ color: "var(--muted)", fontSize: 11.5, marginBottom: 14, letterSpacing: "-0.005em" }}>
              On CPU: roughly 1-5 images/sec/core. {fmtCount(targets.length)} images ≈ 1-{Math.ceil(targets.length / 1)} minutes first run.
            </p>
            {!hasWriteAccess && (
              <p style={{ color: "var(--warn)", fontSize: 12, marginBottom: 10 }}>
                Folder was picked read-only — pick again with cleanup access first.
              </p>
            )}
          </div>
        )}

        {(phase === "running" || phase === "done" || phase === "failed") && (
          <div className="scan-status">
            <div className="scan-folder">
              <IconSparkle size={14} />
              <span>{statusLabel}{current ? ` · ${current.split("/").slice(-2).join("/")}` : ""}</span>
            </div>
            <div className="scan-bar-wrap">
              <div className="scan-bar" style={{ width: `${progress}%` }} />
            </div>
            <div className="scan-pct">
              <span className="scan-phase">{progress.toFixed(1)}% · {counts.scanned}/{targets.length}</span>
              <span className="scan-pct-num" style={{ color: counts.errors > 0 ? "var(--warn)" : "var(--text)" }}>
                {counts.errors > 0 ? `${counts.errors} errors` : "no errors"}
              </span>
            </div>
          </div>
        )}

        {(phase === "running" || phase === "done" || phase === "failed") && (
          <div className="scan-stats">
            <div className="stat">
              <div className="stat-value">{fmtCount(counts.scanned)}</div>
              <div className="stat-label">Processed</div>
            </div>
            <div className="stat">
              <div className="stat-value">{fmtCount(counts.embedded)}</div>
              <div className="stat-label">CLIP embeddings</div>
            </div>
            <div className="stat">
              <div className="stat-value">{fmtCount(counts.faces)}</div>
              <div className="stat-label">Faces</div>
            </div>
            <div className="stat">
              <div className="stat-value" style={{ color: counts.errors > 0 ? "var(--warn)" : "var(--text)" }}>
                {fmtCount(counts.errors)}
              </div>
              <div className="stat-label">Errors</div>
            </div>
            <div className="stat">
              <div className="stat-value">{Math.round(progress)}%</div>
              <div className="stat-label">Done</div>
            </div>
          </div>
        )}

        <div className="scan-log">
          <div className="scan-log-label">
            Live log {logs.length > 0 ? `· ${logs.length} entries` : ""}
          </div>
          <div className="scan-log-list" ref={logScrollRef} style={{ height: 200, maskImage: "none", WebkitMaskImage: "none" }}>
            {logs.length === 0 && (
              <div style={{ color: "var(--dim)", fontSize: 11, padding: "8px 0" }}>Waiting for analysis to start…</div>
            )}
            {logs.map((l, i) => (
              <div key={`${l.ts}-${i}`} className="scan-log-row">
                <span
                  className="scan-log-dot"
                  style={{
                    background:
                      l.kind === "error" ? "var(--danger)" :
                      l.kind === "warn" ? "var(--warn)" : "var(--good)",
                  }}
                />
                <span
                  className="scan-log-msg"
                  style={{
                    color: l.kind === "error" ? "var(--danger)" :
                           l.kind === "warn" ? "var(--warn)" : "var(--secondary)",
                  }}
                >{l.msg}</span>
              </div>
            ))}
          </div>
        </div>

        <footer className="modal-foot">
          <div className="scan-safety">
            <IconSparkle size={14} />
            <span>All inference local · no uploads · open DevTools → Network to verify</span>
          </div>
          {phase === "idle" && (
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn ghost" onClick={onClose}>Cancel</button>
              <button className="btn primary" onClick={run} disabled={!canRun}>Start analysis</button>
            </div>
          )}
          {phase === "running" && (
            <button className="btn ghost" onClick={cancel}>Cancel</button>
          )}
          {phase === "done" && (
            <button className="btn primary" onClick={onComplete}>
              <IconCheck size={13} /> Open People
            </button>
          )}
          {phase === "failed" && (
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn ghost" onClick={onClose}>Close</button>
              <button className="btn primary" onClick={run}>Retry</button>
            </div>
          )}
        </footer>
      </div>
    </div>
  );
}
