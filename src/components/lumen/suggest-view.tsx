"use client";

import { useState, type ComponentType } from "react";
import { SUGGESTIONS, fmtCount, type Suggestion } from "@/lib/lumen/data";
import {
  IconBurst, IconShot, IconWand, IconFace, IconBroom,
  IconSparkle, IconRefresh, IconCheck, IconArrowR,
} from "./icons";

const ICON_MAP: Record<Suggestion["icon"], ComponentType<{ size?: number }>> = {
  burst: IconBurst,
  shot: IconShot,
  name: IconWand,
  face: IconFace,
  save: IconBroom,
};

export function SuggestView() {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const list = SUGGESTIONS.filter((s) => !dismissed.has(s.id));

  return (
    <div className="view">
      <header className="sg-head">
        <div>
          <div className="sg-eyebrow">5 new suggestions · refreshed 4 min ago</div>
          <h2>What we&apos;d do — but won&apos;t, until you say so.</h2>
          <p>Conservative, reversible, and explained. Apply one or all.</p>
        </div>
        <div className="sg-head-actions">
          <button className="btn ghost"><IconRefresh size={13} /> Refresh</button>
          <button className="btn primary"><IconCheck size={13} /> Apply all safe</button>
        </div>
      </header>

      <div className="sg-list">
        {list.map((s) => {
          const Ic = ICON_MAP[s.icon] ?? IconSparkle;
          return (
            <article key={s.id} className="sg-card">
              <div className="sg-card-ic"><Ic size={22} /></div>
              <div>
                <h3>{s.title}</h3>
                <p>{s.body}</p>
                <div className="sg-card-actions">
                  <button
                    className="btn-sm ghost"
                    onClick={() => setDismissed((d) => new Set([...d, s.id]))}
                  >
                    {s.secondary}
                  </button>
                  <button className="btn-sm primary">
                    {s.primary} <IconArrowR size={11} />
                  </button>
                </div>
              </div>
              <div className="sg-card-aff">
                <div className="sg-aff-n">{fmtCount(s.affected)}</div>
                <div className="sg-aff-l">files</div>
              </div>
            </article>
          );
        })}
        {list.length === 0 && (
          <div className="sg-empty">
            <IconCheck size={24} style={{ color: "var(--accent)" }} />
            <p>You&apos;re all caught up. We&apos;ll surface new suggestions after the next scan.</p>
          </div>
        )}
      </div>
    </div>
  );
}
