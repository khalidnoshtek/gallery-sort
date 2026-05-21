"use client";

import { useEffect, useMemo, useState } from "react";
import { useLibraryStore } from "@/state/library-store";
import { UN, fmtBytes, type DupGroup } from "@/lib/lumen/data";
import { IconDup, IconKeep, IconSparkle, IconStar, IconTrash } from "./icons";

type Action = "keep" | "trash";

interface Props {
  groups: DupGroup[];
}

export function DupView({ groups }: Props) {
  // Build map filename → mediaId, so we can stage via the Zustand store.
  const items = useLibraryStore((s) => s.items);
  const staged = useLibraryStore((s) => s.stagedForTrash);
  const stageItems = useLibraryStore((s) => s.stageItems);
  const unstageItems = useLibraryStore((s) => s.unstageItems);

  // Map "filename in the group" → "real media item id" for staging.
  // Both DupGroup and BrowserMediaItem carry the same filename for items
  // adapted from the same scan. For mock data this is just visual.
  const filenameToId = useMemo(() => {
    const m = new Map<string, string>();
    items.forEach((it) => m.set(it.filename, it.id));
    return m;
  }, [items]);

  if (groups.length === 0) {
    return (
      <div className="view" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div className="trash-empty">
          <IconDup size={28} style={{ opacity: 0.3 }} />
          <h2>No duplicates yet.</h2>
          <p>
            Lumen didn&apos;t find any byte-identical or near-duplicate images in this library. If you expected
            some, try a folder with multiple versions of the same shot, or with WhatsApp/Sent copies alongside originals.
          </p>
        </div>
      </div>
    );
  }

  const [groupId, setGroupId] = useState(groups[0]!.id);
  const group = groups.find((g) => g.id === groupId) ?? groups[0]!;

  const recommended = group.members.reduce((best, m) => (m.size > best.size ? m : best), group.members[0]!);

  const initActions = (): Record<string, Action> => {
    const a: Record<string, Action> = {};
    group.members.forEach((m) => {
      const itemId = filenameToId.get(m.filename);
      if (itemId && staged.has(itemId)) a[m.filename] = "trash";
      else a[m.filename] = m === recommended ? "keep" : "trash";
    });
    return a;
  };
  const [actions, setActions] = useState<Record<string, Action>>(initActions);

  useEffect(() => {
    setActions(initActions());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId, group, recommended, staged]);

  const totalSavings = group.members
    .filter((m) => actions[m.filename] === "trash")
    .reduce((a, m) => a + m.size, 0);

  const apply = () => {
    const toStage: string[] = [];
    const toUnstage: string[] = [];
    group.members.forEach((m) => {
      const itemId = filenameToId.get(m.filename);
      if (!itemId) return;
      if (actions[m.filename] === "trash") toStage.push(itemId);
      else toUnstage.push(itemId);
    });
    if (toStage.length) stageItems(toStage);
    if (toUnstage.length) unstageItems(toUnstage);

    // Auto-advance to next group with at least one unstaged member.
    const i = groups.findIndex((g) => g.id === groupId);
    const next = groups.slice(i + 1).find((g) =>
      g.members.some((m) => {
        const id = filenameToId.get(m.filename);
        return id && !staged.has(id);
      }),
    );
    if (next) setGroupId(next.id);
  };

  const totalAllBytes = groups.reduce((a, g) => a + g.members.reduce((b, m) => b + m.size, 0), 0);

  return (
    <div className="view-dups">
      <aside className="dup-list">
        <div className="dup-list-head">
          <span>{groups.length} groups</span>
          <span>{fmtBytes(totalAllBytes)} total</span>
        </div>
        {groups.map((g) => {
          const sample = g.members[0]!;
          const thumb = sample.thumbUrl ?? UN(sample.uid, 120);
          return (
            <button
              key={g.id}
              className="dup-list-item"
              data-on={g.id === groupId ? "1" : "0"}
              onClick={() => setGroupId(g.id)}
            >
              <div className="dl-thumb">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={thumb} alt="" />
                <span className="dl-count">{g.members.length}</span>
              </div>
              <div>
                <div className="dl-label">{g.label}</div>
                <div className="dl-sub">
                  {g.members.length} copies · {fmtBytes(g.members.reduce((a, m) => a + m.size, 0))}
                </div>
                <div className="dl-conf">
                  <div className="dl-conf-bar"><div style={{ width: `${g.confidence * 100}%` }} /></div>
                  <span>{Math.round(g.confidence * 100)}%</span>
                </div>
              </div>
            </button>
          );
        })}
      </aside>

      <section className="dup-main">
        <header className="dup-head">
          <div>
            <div className="dup-eyebrow">{g.kindLabel(group)} · {Math.round(group.confidence * 100)}% match</div>
            <h2>{group.label}</h2>
            <p className="dup-sub">
              {group.members.length} files · keep <strong>{Object.values(actions).filter((a) => a === "keep").length}</strong>, trash <strong>{Object.values(actions).filter((a) => a === "trash").length}</strong> — save <strong style={{ color: "var(--accent)" }}>{fmtBytes(totalSavings)}</strong>
            </p>
          </div>
          <div className="dup-head-acts">
            <button className="btn ghost" onClick={apply}>
              <IconTrash size={13} /> Stage trashed files
            </button>
          </div>
        </header>

        <div className="dup-compare">
          {group.members.map((m) => {
            const isKeep = actions[m.filename] === "keep";
            const isTrash = actions[m.filename] === "trash";
            const isRec = m === recommended;
            const thumb = m.thumbUrl ?? UN(m.uid, 600);
            return (
              <article key={m.filename} className="dup-tile" data-action={actions[m.filename]}>
                <div className="dup-tile-img">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={thumb} alt="" draggable={false} />
                  {isRec && (
                    <span className="dup-rec-flag"><IconStar size={11} /> Recommended keep</span>
                  )}
                </div>
                <div className="dup-tile-body">
                  <div className="dup-tile-name" title={m.filename}>{m.filename}</div>
                  <div className="dup-tile-grid">
                    <div><span>Size</span><b>{fmtBytes(m.size)}</b></div>
                    <div><span>Resolution</span><b>{m.dims[0]}×{m.dims[1]}</b></div>
                    <div><span>Captured</span><b>{m.when}</b></div>
                    <div><span>Notes</span><b>{m.note}</b></div>
                  </div>
                  <div className="dup-tile-actions">
                    <button
                      className="dup-act"
                      data-on={isKeep ? "1" : "0"}
                      onClick={() => setActions((a) => ({ ...a, [m.filename]: "keep" }))}
                    >
                      <IconKeep size={13} /> Keep
                    </button>
                    <button
                      className="dup-act danger"
                      data-on={isTrash ? "1" : "0"}
                      onClick={() => setActions((a) => ({ ...a, [m.filename]: "trash" }))}
                    >
                      <IconTrash size={13} /> Trash
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>

        <footer className="dup-foot">
          <div className="dup-foot-rule">
            <IconSparkle size={14} />
            <span>Rule: highest resolution wins; ties broken by file size and folder (DCIM beats WhatsApp/Sent).</span>
          </div>
          <div className="dup-foot-keys">
            <kbd>K</kbd> keep · <kbd>D</kbd> trash · <kbd>→</kbd> next group
          </div>
        </footer>
      </section>
    </div>
  );
}

const g = {
  kindLabel: (group: DupGroup): string => {
    const id = group.id;
    if (id.startsWith("dg_e") || id.startsWith("dg_real")) return "Exact match";
    if (id.startsWith("dg_n")) return "Near duplicate";
    return "Duplicate group";
  },
};
