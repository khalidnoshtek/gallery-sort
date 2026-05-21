"use client";

import { useMemo, useState } from "react";
import { useLibraryStore } from "@/state/library-store";
import { fmtBytes, fmtCount } from "@/lib/lumen/data";
import { downloadCleanupScript, generateCleanupScript } from "@/lib/lumen/suggestions";
import { adaptPhoto } from "@/lib/lumen/adapter";
import { moveToLibraryTrash, deletePermanently } from "@/lib/browser/fs-ops";
import { PhotoCard } from "./photo-card";
import { IconArrowR, IconCheck, IconRestore, IconTrash } from "./icons";

type Pending = "move" | "delete" | "script" | null;

export function TrashView() {
  const items = useLibraryStore((s) => s.items);
  const staged = useLibraryStore((s) => s.stagedForTrash);
  const summary = useLibraryStore((s) => s.summary);
  const hasWriteAccess = useLibraryStore((s) => s.hasWriteAccess);
  const unstageItems = useLibraryStore((s) => s.unstageItems);
  const removeItems = useLibraryStore((s) => s.removeItems);
  const clearStaging = useLibraryStore((s) => s.clearStaging);

  const stagedItems = useMemo(
    () => items.filter((it) => staged.has(it.id)),
    [items, staged],
  );
  const stagedPhotos = useMemo(() => stagedItems.map(adaptPhoto), [stagedItems]);
  const totalBytes = stagedItems.reduce((a, b) => a + b.sizeBytes, 0);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, setPending] = useState<Pending>(null);
  const [result, setResult] = useState<{ kind: "move" | "delete" | "script"; ok: number; failed: number; folder?: string } | null>(null);

  if (stagedItems.length === 0) {
    return (
      <div className="view">
        <div className="trash-empty">
          <IconTrash size={28} style={{ opacity: 0.3 }} />
          <h2>Nothing staged.</h2>
          <p>
            Open <strong style={{ color: "var(--text)" }}>AI Suggestions</strong> or the <strong style={{ color: "var(--text)" }}>Duplicates</strong> view to
            stage files. Staging is reversible — nothing leaves disk until you confirm here.
          </p>
        </div>
      </div>
    );
  }

  const restoreSelected = () => {
    if (selected.size === 0) return;
    unstageItems([...selected]);
    setSelected(new Set());
  };

  const doMoveToTrashFolder = async () => {
    setPending("move");
    setResult(null);
    const res = await moveToLibraryTrash(stagedItems);
    if (res.ok.length > 0) removeItems(res.ok);
    setResult({ kind: "move", ok: res.ok.length, failed: res.failed.length, folder: res.trashFolder });
    setPending(null);
  };

  const doDeletePermanently = async () => {
    const ok = window.confirm(
      `Permanently delete ${stagedItems.length} file${stagedItems.length === 1 ? "" : "s"}? ` +
      `This cannot be undone from Lumen — the files will be gone from disk.`,
    );
    if (!ok) return;
    setPending("delete");
    setResult(null);
    const res = await deletePermanently(stagedItems);
    if (res.ok.length > 0) removeItems(res.ok);
    setResult({ kind: "delete", ok: res.ok.length, failed: res.failed.length });
    setPending(null);
  };

  const doDownloadScript = () => {
    setPending("script");
    const script = generateCleanupScript({
      paths: stagedItems.map((it) => it.relativePath),
      libraryRoot: summary ? `~/path/to/${summary.folderName}` : undefined,
    });
    const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    downloadCleanupScript(`lumen-cleanup-${ts}.sh`, script);
    setResult({ kind: "script", ok: stagedItems.length, failed: 0 });
    setPending(null);
  };

  return (
    <div className="view">
      <header className="qv-head">
        <div>
          <h2>{fmtCount(stagedItems.length)} file{stagedItems.length === 1 ? "" : "s"} staged</h2>
          <p>
            Total {fmtBytes(totalBytes)}.
            {hasWriteAccess
              ? " Move them into a .lumen-trash folder inside your library, or delete permanently."
              : " Your folder was picked read-only — download a cleanup script to run manually."}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button className="btn ghost" onClick={clearStaging} disabled={pending !== null}>
            <IconRestore size={13} /> Restore all
          </button>
          {hasWriteAccess ? (
            <>
              <button className="btn ghost" onClick={doDownloadScript} disabled={pending !== null}>
                Download script
              </button>
              <button className="btn ghost" style={{ color: "var(--danger)", borderColor: "rgba(220,80,80,0.25)" }} onClick={doDeletePermanently} disabled={pending !== null}>
                <IconTrash size={13} /> {pending === "delete" ? "Deleting…" : "Delete permanently"}
              </button>
              <button className="btn primary" onClick={doMoveToTrashFolder} disabled={pending !== null}>
                <IconCheck size={13} /> {pending === "move" ? "Moving…" : "Move to .lumen-trash"}
              </button>
            </>
          ) : (
            <button className="btn primary" onClick={doDownloadScript} disabled={pending !== null}>
              <IconCheck size={13} /> Download cleanup script
            </button>
          )}
        </div>
      </header>

      {result && (
        <div style={{
          marginBottom: 24, padding: 18, borderRadius: 10,
          border: `0.5px solid ${result.failed > 0 ? "rgba(220,80,80,0.25)" : "var(--active-line)"}`,
          background: result.failed > 0 ? "rgba(220,80,80,0.06)" : "var(--active-bg)",
          fontSize: 13, lineHeight: 1.6,
        }}>
          <strong style={{ display: "block", marginBottom: 6, color: "var(--text)" }}>
            {result.kind === "move" && (
              result.failed === 0
                ? `Moved ${result.ok} file${result.ok === 1 ? "" : "s"} to ${result.folder}.`
                : `Moved ${result.ok}, ${result.failed} failed.`
            )}
            {result.kind === "delete" && (
              result.failed === 0
                ? `Deleted ${result.ok} file${result.ok === 1 ? "" : "s"} permanently.`
                : `Deleted ${result.ok}, ${result.failed} failed.`
            )}
            {result.kind === "script" && `Cleanup script downloaded (${result.ok} files).`}
          </strong>
          <div style={{ color: "var(--secondary)" }}>
            {result.kind === "move" && (
              <>
                Files are in <code style={{ fontFamily: "var(--mono)", background: "rgba(255,255,255,0.04)", padding: "1px 5px", borderRadius: 3 }}>{result.folder}</code> inside your library.
                Restore them from Finder, or permanently remove later with <code style={{ fontFamily: "var(--mono)", fontSize: 11.5 }}>rm -rf</code>.
              </>
            )}
            {result.kind === "script" && (
              <>
                In Terminal: <code style={{ fontFamily: "var(--mono)", fontSize: 12, background: "rgba(0,0,0,0.3)", padding: "1px 5px", borderRadius: 3 }}>chmod +x lumen-cleanup-*.sh &amp;&amp; ./lumen-cleanup-*.sh</code>.
              </>
            )}
          </div>
        </div>
      )}

      {selected.size > 0 && (
        <div style={{ marginBottom: 16, display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 12.5, color: "var(--secondary)" }}>{selected.size} selected</span>
          <button className="btn-sm ghost" onClick={restoreSelected}>
            <IconRestore size={12} /> Restore selected
          </button>
        </div>
      )}

      <div className="lib-grid uniform">
        {stagedPhotos.map((p) => (
          <PhotoCard
            key={p.id}
            photo={p}
            selected={selected.has(p.id)}
            onToggle={(id) => {
              setSelected((s) => {
                const next = new Set(s);
                if (next.has(id)) next.delete(id);
                else next.add(id);
                return next;
              });
            }}
            height={180}
            useMock={false}
          />
        ))}
      </div>

      <div className="cleanup-safe" style={{ marginTop: 32 }}>
        <div className="safe-row">
          <div className="safe-tag"><IconArrowR size={14} /> Move to .lumen-trash</div>
          <p>
            Creates <code style={{ fontFamily: "var(--mono)", fontSize: 11.5 }}>.lumen-trash/&lt;timestamp&gt;/</code> inside your picked folder
            and moves files into it. Restorable from Finder. Delete the folder later when you&apos;re sure.
          </p>
        </div>
        <div className="safe-row">
          <div className="safe-tag"><IconTrash size={14} /> Delete permanently</div>
          <p>
            Calls the browser&apos;s file delete directly. There is no undo — make sure your staging set is right
            before confirming the dialog.
          </p>
        </div>
      </div>
    </div>
  );
}
