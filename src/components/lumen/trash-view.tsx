"use client";

import { useMemo, useState } from "react";
import { useLibraryStore } from "@/state/library-store";
import { fmtBytes, fmtCount } from "@/lib/lumen/data";
import { downloadCleanupScript, generateCleanupScript } from "@/lib/lumen/suggestions";
import { adaptPhoto } from "@/lib/lumen/adapter";
import { PhotoCard } from "./photo-card";
import { IconArrowR, IconCheck, IconRestore, IconTrash } from "./icons";

export function TrashView() {
  const items = useLibraryStore((s) => s.items);
  const staged = useLibraryStore((s) => s.stagedForTrash);
  const summary = useLibraryStore((s) => s.summary);
  const unstageItems = useLibraryStore((s) => s.unstageItems);
  const clearStaging = useLibraryStore((s) => s.clearStaging);

  const stagedItems = useMemo(
    () => items.filter((it) => staged.has(it.id)),
    [items, staged],
  );
  const stagedPhotos = useMemo(() => stagedItems.map(adaptPhoto), [stagedItems]);

  const totalBytes = stagedItems.reduce((a, b) => a + b.sizeBytes, 0);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [exported, setExported] = useState(false);

  const onApply = () => {
    if (stagedItems.length === 0) return;
    const script = generateCleanupScript({
      paths: stagedItems.map((it) => it.relativePath),
      libraryRoot: summary ? `~/path/to/${summary.folderName}` : undefined,
    });
    const ts = new Date().toISOString().replace(/[:.]/g, "-").replace(/T/, "_").slice(0, 19);
    downloadCleanupScript(`lumen-cleanup-${ts}.sh`, script);
    setExported(true);
  };

  if (stagedItems.length === 0) {
    return (
      <div className="view">
        <div className="trash-empty">
          <IconTrash size={28} style={{ opacity: 0.3 }} />
          <h2>Nothing staged.</h2>
          <p>
            Open <strong style={{ color: "var(--text)" }}>AI Suggestions</strong> or the <strong style={{ color: "var(--text)" }}>Duplicates</strong> view to
            stage files for cleanup. Staging is reversible — nothing leaves disk until you download and run the script.
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

  return (
    <div className="view">
      <header className="qv-head">
        <div>
          <h2>{fmtCount(stagedItems.length)} file{stagedItems.length === 1 ? "" : "s"} staged</h2>
          <p>
            Total {fmtBytes(totalBytes)}. Review what you&apos;ve queued for cleanup, then download
            the script to move them into <code style={{ fontFamily: "var(--mono)", background: "rgba(255,255,255,0.04)", padding: "1px 5px", borderRadius: 3 }}>~/.lumen-trash/</code>.
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn ghost" onClick={clearStaging}>
            <IconRestore size={13} /> Restore all
          </button>
          <button className="btn primary" onClick={onApply}>
            <IconCheck size={13} /> Download cleanup script
          </button>
        </div>
      </header>

      {exported && (
        <div style={{ marginBottom: 24, padding: 18, borderRadius: 10, border: "0.5px solid var(--active-line)", background: "var(--active-bg)", fontSize: 13, lineHeight: 1.6 }}>
          <strong style={{ display: "block", marginBottom: 6, color: "var(--text)" }}>Script downloaded.</strong>
          <div style={{ color: "var(--secondary)" }}>
            Open Terminal, navigate to your downloads, and run:
            <pre style={{ marginTop: 8, fontFamily: "var(--mono)", fontSize: 12, color: "var(--text)", background: "rgba(0,0,0,0.3)", padding: "10px 12px", borderRadius: 6, overflow: "auto" }}>
              chmod +x lumen-cleanup-*.sh{"\n"}./lumen-cleanup-*.sh
            </pre>
            <span style={{ display: "block", marginTop: 8, color: "var(--muted)", fontSize: 12 }}>
              The script edits one variable (LIBRARY_ROOT) at the top — fill in your actual folder path before running.
              Files move into a dated subfolder of <code>~/.lumen-trash/</code>. Nothing is deleted.
            </span>
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
          <div className="safe-tag"><IconArrowR size={14} /> What the script does</div>
          <p>Moves each staged file into <code style={{ fontFamily: "var(--mono)", fontSize: 11.5 }}>~/.lumen-trash/&lt;timestamp&gt;/</code> preserving folder structure.
             Nothing is permanently deleted. To get rid of the trash later, just <code style={{ fontFamily: "var(--mono)", fontSize: 11.5 }}>rm -rf ~/.lumen-trash</code>.</p>
        </div>
        <div className="safe-row">
          <div className="safe-tag"><IconRestore size={14} /> Reversible until you run it</div>
          <p>Until you run the script, nothing has been touched. You can restore individual files or clear the whole staging set above.</p>
        </div>
      </div>
    </div>
  );
}
