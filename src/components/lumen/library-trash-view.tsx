"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  browseTrash, readTrashEntryFile, restoreTrashEntries, purgeTrashEntries, purgeAllTrash,
  type TrashEntry,
} from "@/lib/browser/fs-ops";
import { fsHandles, supportsFsAccess } from "@/lib/browser/handles";
import { fmtBytes, fmtCount } from "@/lib/lumen/data";
import {
  IconRefresh, IconRestore, IconTrash, IconCheck,
} from "./icons";

export function LibraryTrashView() {
  const [entries, setEntries] = useState<TrashEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [thumbs, setThumbs] = useState<Map<string, string>>(new Map());
  const [pending, setPending] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const hasRoot = fsHandles.hasWriteAccess();

  const refresh = useCallback(async () => {
    if (!hasRoot) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const list = await browseTrash();
      setEntries(list);
      setSelected(new Set());
      // Lazily generate previews for the first N entries
      const previewLimit = 30;
      for (let i = 0; i < Math.min(previewLimit, list.length); i++) {
        const e = list[i]!;
        if (!/\.(jpe?g|png|webp|gif|bmp|avif)$/i.test(e.filename)) continue;
        const file = await readTrashEntryFile(e);
        if (!file) continue;
        const url = URL.createObjectURL(file);
        setThumbs((m) => {
          const next = new Map(m);
          next.set(e.id, url);
          return next;
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [hasRoot]);

  useEffect(() => {
    refresh();
    return () => {
      // revoke object URLs on unmount
      thumbs.forEach((u) => URL.revokeObjectURL(u));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refresh]);

  const grouped = useMemo(() => {
    const map = new Map<string, TrashEntry[]>();
    for (const e of entries) {
      if (!map.has(e.bucket)) map.set(e.bucket, []);
      map.get(e.bucket)!.push(e);
    }
    return [...map.entries()];
  }, [entries]);

  const totalBytes = entries.reduce((a, e) => a + e.sizeBytes, 0);
  const selectedEntries = entries.filter((e) => selected.has(e.id));
  const selectedBytes = selectedEntries.reduce((a, e) => a + e.sizeBytes, 0);

  const toggleAll = () => {
    if (selected.size === entries.length) setSelected(new Set());
    else setSelected(new Set(entries.map((e) => e.id)));
  };
  const toggleBucket = (bucket: string) => {
    const ids = entries.filter((e) => e.bucket === bucket).map((e) => e.id);
    const allSelected = ids.every((id) => selected.has(id));
    setSelected((s) => {
      const next = new Set(s);
      ids.forEach((id) => (allSelected ? next.delete(id) : next.add(id)));
      return next;
    });
  };

  const doRestore = async (subset: TrashEntry[]) => {
    if (subset.length === 0) return;
    setPending("restore");
    setStatus(null);
    const result = await restoreTrashEntries(subset);
    setStatus(`Restored ${result.ok.length}${result.failed.length > 0 ? `, ${result.failed.length} failed` : ""}.`);
    setPending(null);
    await refresh();
  };

  const doPurge = async (subset: TrashEntry[]) => {
    if (subset.length === 0) return;
    if (!window.confirm(`Permanently delete ${subset.length} file${subset.length === 1 ? "" : "s"} from the trash? This cannot be undone.`)) return;
    setPending("purge");
    setStatus(null);
    const result = await purgeTrashEntries(subset);
    setStatus(`Purged ${result.ok.length}${result.failed.length > 0 ? `, ${result.failed.length} failed` : ""}.`);
    setPending(null);
    await refresh();
  };

  const doPurgeAll = async () => {
    if (!window.confirm("Permanently delete the entire .lumen-trash folder? This cannot be undone.")) return;
    setPending("purge-all");
    setStatus(null);
    const r = await purgeAllTrash();
    if (r.ok) setStatus("Trash folder removed.");
    else setStatus(`Failed: ${r.reason}`);
    setPending(null);
    await refresh();
  };

  if (!supportsFsAccess() || !hasRoot) {
    return (
      <div className="view">
        <div className="trash-empty">
          <IconTrash size={28} style={{ opacity: 0.3 }} />
          <h2>Cleanup access not granted</h2>
          <p>
            Pick a folder with &quot;cleanup access&quot; when scanning to enable the in-app trash browser.
            Currently your folder is read-only.
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="view">
        <div className="trash-empty">
          <IconRefresh size={28} style={{ opacity: 0.3 }} />
          <h2>Reading .lumen-trash…</h2>
          <p>Walking the trash folder. This is fast — usually under a second.</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="view">
        <div className="trash-empty">
          <IconTrash size={28} style={{ color: "var(--danger)", opacity: 0.6 }} />
          <h2>Couldn&apos;t read the trash</h2>
          <p style={{ color: "var(--danger)" }}>{error}</p>
          <button className="btn ghost" onClick={refresh} style={{ marginTop: 12 }}>
            <IconRefresh size={13} /> Retry
          </button>
        </div>
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="view">
        <div className="trash-empty">
          <IconTrash size={28} style={{ opacity: 0.3 }} />
          <h2>Library trash is empty.</h2>
          <p>
            Files you move from <strong style={{ color: "var(--text)" }}>Staged for trash</strong>{" "}
            land here. Restore or purge them anytime.
          </p>
          <button className="btn ghost" onClick={refresh} style={{ marginTop: 12 }}>
            <IconRefresh size={13} /> Refresh
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="view">
      <header className="qv-head" style={{ flexDirection: "column", alignItems: "flex-start", gap: 16 }}>
        <div style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
          <div>
            <h2>Library trash</h2>
            <p>
              {fmtCount(entries.length)} file{entries.length === 1 ? "" : "s"} · {fmtBytes(totalBytes)} ·{" "}
              {grouped.length} cleanup session{grouped.length === 1 ? "" : "s"}
            </p>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn ghost" onClick={refresh} disabled={pending !== null}>
              <IconRefresh size={13} /> Refresh
            </button>
            <button
              className="btn ghost"
              onClick={doPurgeAll}
              disabled={pending !== null}
              style={{ color: "var(--danger)", borderColor: "rgba(220,80,80,0.25)" }}
            >
              <IconTrash size={13} /> Purge all
            </button>
          </div>
        </div>

        {/* bulk bar */}
        <div style={{
          width: "100%",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "12px 14px",
          background: "var(--bg-2)",
          border: "0.5px solid var(--border-soft)",
          borderRadius: 10,
        }}>
          <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
            <span style={{ fontSize: 11.5, color: "var(--muted)", marginRight: 6 }}>Bulk:</span>
            <button className="btn-sm ghost" onClick={toggleAll}>
              {selected.size === entries.length ? "Deselect all" : "Select all"}
            </button>
            <button className="btn-sm ghost" onClick={() => doRestore(selectedEntries)} disabled={pending !== null || selectedEntries.length === 0}>
              <IconRestore size={11} /> Restore selected
            </button>
            <button
              className="btn-sm ghost"
              onClick={() => doPurge(selectedEntries)}
              disabled={pending !== null || selectedEntries.length === 0}
              style={{ color: "var(--danger)" }}
            >
              <IconTrash size={11} /> Purge selected
            </button>
          </div>
          <div style={{ fontSize: 12.5, color: "var(--muted)" }}>
            <strong style={{ color: "var(--text)" }}>{fmtCount(selected.size)}</strong> of {fmtCount(entries.length)} selected
            {selected.size > 0 && (
              <span style={{ marginLeft: 12, color: "var(--accent)", fontFamily: "var(--mono)" }}>
                {fmtBytes(selectedBytes)}
              </span>
            )}
          </div>
        </div>

        {status && (
          <div style={{ width: "100%", padding: 14, borderRadius: 8, background: "var(--active-bg)", color: "var(--secondary)", fontSize: 12.5 }}>
            {status}
          </div>
        )}
      </header>

      {grouped.map(([bucket, bucketEntries]) => {
        const bucketBytes = bucketEntries.reduce((a, e) => a + e.sizeBytes, 0);
        const dateLabel = new Date(bucket.replace(/-(\d{2})-(\d{2})$/, ":$1:$2")).toLocaleString();
        return (
          <section key={bucket} style={{ marginBottom: 36 }}>
            <div style={{
              display: "flex",
              alignItems: "baseline",
              justifyContent: "space-between",
              padding: "10px 0",
              borderBottom: "0.5px solid var(--border-soft)",
              marginBottom: 14,
            }}>
              <div>
                <div style={{ fontFamily: "var(--display)", fontSize: 16, letterSpacing: "-0.018em", fontWeight: 500 }}>
                  {Number.isNaN(new Date(bucket).getTime()) ? bucket : dateLabel}
                </div>
                <div style={{ color: "var(--muted)", fontSize: 11.5, marginTop: 2, fontFamily: "var(--mono)" }}>
                  .lumen-trash/{bucket} · {bucketEntries.length} files · {fmtBytes(bucketBytes)}
                </div>
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <button className="btn-sm ghost" onClick={() => toggleBucket(bucket)}>
                  {bucketEntries.every((e) => selected.has(e.id)) ? "Deselect" : "Select"}
                </button>
                <button className="btn-sm ghost" onClick={() => doRestore(bucketEntries)} disabled={pending !== null}>
                  <IconRestore size={11} /> Restore session
                </button>
                <button
                  className="btn-sm ghost"
                  onClick={() => doPurge(bucketEntries)}
                  disabled={pending !== null}
                  style={{ color: "var(--danger)" }}
                >
                  <IconTrash size={11} /> Purge session
                </button>
              </div>
            </div>

            <div className="lib-grid uniform">
              {bucketEntries.map((e) => {
                const isSel = selected.has(e.id);
                const thumb = thumbs.get(e.id);
                const isImage = /\.(jpe?g|png|webp|gif|bmp|avif)$/i.test(e.filename);
                return (
                  <div
                    key={e.id}
                    className="card"
                    data-selected={isSel ? "1" : "0"}
                    style={{ height: "auto", aspectRatio: "1/1", cursor: "default" }}
                    onClick={() => {
                      setSelected((s) => {
                        const next = new Set(s);
                        if (next.has(e.id)) next.delete(e.id);
                        else next.add(e.id);
                        return next;
                      });
                    }}
                  >
                    {thumb ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={thumb}
                        alt={e.filename}
                        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
                      />
                    ) : (
                      <div style={{
                        position: "absolute",
                        inset: 0,
                        background: "var(--surface)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexDirection: "column",
                        gap: 6,
                        fontFamily: "var(--mono)",
                        fontSize: 10,
                        color: "var(--muted)",
                        padding: 12,
                      }}>
                        <span>{isImage ? "loading…" : (e.filename.split(".").pop() || "file").toUpperCase()}</span>
                      </div>
                    )}
                    <div className="card-veil" style={{ opacity: 1 }} />
                    <div style={{
                      position: "absolute",
                      top: 8, left: 8, right: 8,
                      display: "flex", justifyContent: "space-between", alignItems: "center",
                      fontFamily: "var(--mono)", fontSize: 10,
                      color: "rgba(255,255,255,0.9)",
                      textShadow: "0 1px 2px rgba(0,0,0,0.6)",
                      pointerEvents: "none",
                    }}>
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "65%" }} title={e.relativePath}>
                        {e.filename}
                      </span>
                      <span style={{ background: "rgba(0,0,0,0.4)", padding: "2px 6px", borderRadius: 4 }}>
                        {fmtBytes(e.sizeBytes)}
                      </span>
                    </div>
                    <div style={{
                      position: "absolute", left: 8, right: 8, bottom: 8,
                      display: "flex", gap: 6, pointerEvents: "none",
                    }}>
                      <button
                        onClick={(ev) => { ev.stopPropagation(); doRestore([e]); }}
                        className="dup-act"
                        style={{ pointerEvents: "auto", padding: 6, fontSize: 11 }}
                        disabled={pending !== null}
                      >
                        <IconRestore size={12} /> Restore
                      </button>
                      <button
                        onClick={(ev) => { ev.stopPropagation(); doPurge([e]); }}
                        className="dup-act danger"
                        style={{ pointerEvents: "auto", padding: 6, fontSize: 11 }}
                        disabled={pending !== null}
                      >
                        <IconTrash size={12} /> Purge
                      </button>
                    </div>
                    {isSel && (
                      <div style={{
                        position: "absolute",
                        top: 8,
                        left: 8,
                        width: 18,
                        height: 18,
                        borderRadius: "50%",
                        background: "var(--accent)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "#0e0d10",
                      }}>
                        <IconCheck size={11} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}

      <div className="cleanup-safe" style={{ marginTop: 12 }}>
        <div className="safe-row">
          <div className="safe-tag"><IconRestore size={14} /> Restore</div>
          <p>
            Puts the file back at its original path in the library. Lumen verifies the bytes are identical before
            removing it from <code style={{ fontFamily: "var(--mono)", fontSize: 11.5 }}>.lumen-trash</code>.
          </p>
        </div>
        <div className="safe-row">
          <div className="safe-tag"><IconTrash size={14} /> Purge</div>
          <p>
            Removes the file from <code style={{ fontFamily: "var(--mono)", fontSize: 11.5 }}>.lumen-trash</code> permanently.
            This cannot be undone from Lumen — files go straight to the OS.
          </p>
        </div>
      </div>
    </div>
  );
}
