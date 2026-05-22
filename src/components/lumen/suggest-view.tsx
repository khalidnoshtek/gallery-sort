"use client";

import { useMemo, useState, type ComponentType } from "react";
import { useLibraryStore } from "@/state/library-store";
import { buildSuggestions, type RealSuggestion, type SuggestionIcon } from "@/lib/lumen/suggestions";
import { fmtBytes, fmtCount } from "@/lib/lumen/data";
import {
  IconBroom, IconBurst, IconBlur, IconShot, IconWA, IconVideo,
  IconFile, IconCheck, IconRefresh, IconArrowR, IconSparkle, IconRestore, IconFlash,
} from "./icons";
import { DiagnosticsPanel } from "./diagnostics-panel";
import type { FocusContext } from "./types";

const ICON_MAP: Record<SuggestionIcon, ComponentType<{ size?: number }>> = {
  save: IconBroom,
  burst: IconBurst,
  blur: IconBlur,
  dark: IconFlash,
  shot: IconShot,
  wa: IconWA,
  video: IconVideo,
  doc: IconFile,
  tiny: IconFile,
};

interface Props {
  goToTrash: () => void;
  openFocus: (ctx: FocusContext) => void;
}

export function SuggestView({ goToTrash, openFocus }: Props) {
  const items = useLibraryStore((s) => s.items);
  const exact = useLibraryStore((s) => s.duplicatesExact);
  const near = useLibraryStore((s) => s.duplicatesNear);
  const staged = useLibraryStore((s) => s.stagedForTrash);
  const stageItems = useLibraryStore((s) => s.stageItems);
  const unstageItems = useLibraryStore((s) => s.unstageItems);

  const suggestions = useMemo(
    () => buildSuggestions(items, exact, near),
    [items, exact, near],
  );

  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const visible = suggestions.filter((s) => !dismissed.has(s.id));

  const totalPossibleBytes = visible.reduce((a, s) => a + s.bytes, 0);

  const applyAllSafe = () => {
    const safeSugs = visible.filter((s) => s.id === "dups-exact" || s.id === "dups-near");
    const ids = safeSugs.flatMap((s) => s.itemIds);
    if (ids.length > 0) stageItems(ids);
  };

  const review = (s: RealSuggestion) => {
    openFocus({
      source: "suggest",
      label: s.title,
      sublabel: s.body,
      itemIds: s.itemIds,
    });
  };

  return (
    <div className="view">
      <header className="sg-head">
        <div>
          <div className="sg-eyebrow">
            {visible.length > 0
              ? `${visible.length} actionable suggestion${visible.length === 1 ? "" : "s"} · computed locally from your scan`
              : "No actionable suggestions yet · expand diagnostics below"}
          </div>
          <h2>What to clean up — your call on each.</h2>
          <p>
            {visible.length > 0 ? (
              <>
                Up to <strong style={{ color: "var(--text)" }}>{fmtBytes(totalPossibleBytes)}</strong> reclaimable across {fmtCount(visible.reduce((a, s) => a + s.itemIds.length, 0))} files.
                Click <strong style={{ color: "var(--text)" }}>Review</strong> on any card to keep/trash photos one by one,
                or <strong style={{ color: "var(--text)" }}>Stage all</strong> to add the whole bucket to Trash.
              </>
            ) : (
              <>Your library is already in pretty good shape — no duplicates, no obvious junk. Check the diagnostics below to see what was checked.</>
            )}
          </p>
        </div>
        <div className="sg-head-actions">
          <button className="btn ghost" onClick={() => setDismissed(new Set())}>
            <IconRefresh size={13} /> Reset
          </button>
          <button className="btn primary" onClick={applyAllSafe} disabled={!visible.some(s => s.id.startsWith("dups"))}>
            <IconCheck size={13} /> Stage all duplicates
          </button>
        </div>
      </header>

      <DiagnosticsPanel />

      {visible.length === 0 ? (
        <div className="sg-empty">
          <IconSparkle size={26} style={{ color: "var(--good)" }} />
          <p>Nothing flagged. Check the diagnostics above to see what was actually computed.</p>
        </div>
      ) : (
        <>
          <div className="sg-list">
            {visible.map((s) => (
              <SuggestionCard
                key={s.id}
                suggestion={s}
                stagedCount={s.itemIds.filter((id) => staged.has(id)).length}
                onReview={() => review(s)}
                onStageAll={() => stageItems(s.itemIds)}
                onUnstage={() => unstageItems(s.itemIds)}
                onDismiss={() => setDismissed((d) => new Set([...d, s.id]))}
              />
            ))}
          </div>

          {staged.size > 0 && (
            <div style={{ marginTop: 32, display: "flex", justifyContent: "space-between", alignItems: "center", padding: 22, borderRadius: 12, border: "0.5px solid var(--border-soft)", background: "var(--bg-2)" }}>
              <div>
                <div style={{ fontFamily: "var(--display)", fontSize: 18, letterSpacing: "-0.022em", marginBottom: 4 }}>
                  {fmtCount(staged.size)} file{staged.size === 1 ? "" : "s"} staged for cleanup
                </div>
                <div style={{ color: "var(--muted)", fontSize: 12.5 }}>
                  Apply (move or delete) from the Trash view.
                </div>
              </div>
              <button className="btn primary" onClick={goToTrash}>
                Open Trash <IconArrowR size={13} />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

interface CardProps {
  suggestion: RealSuggestion;
  stagedCount: number;
  onReview: () => void;
  onStageAll: () => void;
  onUnstage: () => void;
  onDismiss: () => void;
}

function SuggestionCard({ suggestion, stagedCount, onReview, onStageAll, onUnstage, onDismiss }: CardProps) {
  const Ic = ICON_MAP[suggestion.icon] ?? IconSparkle;
  const isFullyStaged = stagedCount === suggestion.itemIds.length && stagedCount > 0;
  const isPartiallyStaged = stagedCount > 0 && !isFullyStaged;

  return (
    <article className="sg-card">
      <div className="sg-card-ic"><Ic size={22} /></div>
      <div>
        <h3>{suggestion.title}</h3>
        <p>{suggestion.body}</p>
        <div className="sg-card-actions">
          <button className="btn-sm ghost" onClick={onReview}>
            Review {suggestion.itemIds.length} <IconArrowR size={11} />
          </button>
          {isFullyStaged ? (
            <button className="btn-sm primary" onClick={onUnstage}>
              <IconRestore size={12} /> Unstage all
            </button>
          ) : (
            <button className="btn-sm primary" onClick={onStageAll}>
              {isPartiallyStaged
                ? `Stage remaining ${suggestion.itemIds.length - stagedCount}`
                : `Stage all`}
            </button>
          )}
          <button className="btn-sm ghost" onClick={onDismiss} style={{ marginLeft: "auto" }}>Dismiss</button>
        </div>
      </div>
      <div className="sg-card-aff">
        <div className="sg-aff-n">{fmtCount(suggestion.itemIds.length)}</div>
        <div className="sg-aff-l">files</div>
        {stagedCount > 0 && (
          <div style={{ marginTop: 6, fontSize: 10.5, color: "var(--accent)", fontVariantNumeric: "tabular-nums" }}>
            {stagedCount} staged
          </div>
        )}
      </div>
    </article>
  );
}
