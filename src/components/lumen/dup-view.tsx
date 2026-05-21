"use client";

import { useEffect, useState } from "react";
import { UN, fmtBytes, type DupGroup } from "@/lib/lumen/data";
import { IconDup, IconKeep, IconSparkle, IconStar, IconTrash } from "./icons";

type Action = "keep" | "trash";

interface Props {
  groups: DupGroup[];
}

export function DupView({ groups }: Props) {
  if (groups.length === 0) {
    return (
      <div className="view" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div className="trash-empty">
          <IconDup size={28} style={{ opacity: 0.3 }} />
          <h2>No duplicates yet.</h2>
          <p>
            Scan a folder to find byte-identical and near-duplicate images. Lumen groups them and
            picks the best copy to keep.
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
    group.members.forEach((m) => { a[m.filename] = m === recommended ? "keep" : "trash"; });
    return a;
  };
  const [actions, setActions] = useState<Record<string, Action>>(initActions);

  useEffect(() => {
    const a: Record<string, Action> = {};
    group.members.forEach((m) => { a[m.filename] = m === recommended ? "keep" : "trash"; });
    setActions(a);
  }, [groupId, group, recommended]);

  const totalSavings = group.members
    .filter((m) => actions[m.filename] === "trash")
    .reduce((a, m) => a + m.size, 0);

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
            <div className="dup-eyebrow">Duplicate group · {Math.round(group.confidence * 100)}% match</div>
            <h2>{group.label}</h2>
            <p className="dup-sub">
              {group.members.length} files · keep <strong>{Object.values(actions).filter((a) => a === "keep").length}</strong>, trash <strong>{Object.values(actions).filter((a) => a === "trash").length}</strong> — saving <strong style={{ color: "var(--accent)" }}>{fmtBytes(totalSavings)}</strong>
            </p>
          </div>
          <div className="dup-head-acts">
            <button className="btn ghost">Skip group</button>
            <button className="btn primary">Apply (stage to Trash)</button>
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
            <span>Rule: prefer highest resolution, prefer non-compressed, prefer earliest timestamp.</span>
          </div>
          <div className="dup-foot-keys">
            <kbd>K</kbd> keep · <kbd>D</kbd> trash · <kbd>→</kbd> next group
          </div>
        </footer>
      </section>
    </div>
  );
}
