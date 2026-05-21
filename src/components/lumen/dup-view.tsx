"use client";

import { useEffect, useState } from "react";
import { DUP_GROUPS, UN, fmtBytes } from "@/lib/lumen/data";
import { IconKeep, IconSparkle, IconStar, IconTrash } from "./icons";

type Action = "keep" | "trash";

export function DupView() {
  const [groupId, setGroupId] = useState(DUP_GROUPS[0]!.id);
  const group = DUP_GROUPS.find((g) => g.id === groupId)!;
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

  return (
    <div className="view-dups">
      <aside className="dup-list">
        <div className="dup-list-head">
          <span>{DUP_GROUPS.length} groups</span>
          <span>{fmtBytes(14.2 * 1024 ** 3)} savings</span>
        </div>
        {DUP_GROUPS.map((g) => {
          const sample = g.members[0]!;
          return (
            <button
              key={g.id}
              className="dup-list-item"
              data-on={g.id === groupId ? "1" : "0"}
              onClick={() => setGroupId(g.id)}
            >
              <div className="dl-thumb">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={UN(sample.uid, 120)} alt="" />
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
            return (
              <article key={m.filename} className="dup-tile" data-action={actions[m.filename]}>
                <div className="dup-tile-img">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={UN(m.uid, 600)} alt="" draggable={false} />
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
