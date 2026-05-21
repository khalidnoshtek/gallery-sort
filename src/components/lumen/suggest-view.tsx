"use client";

import { useMemo, useState, type ComponentType } from "react";
import { useLibraryStore } from "@/state/library-store";
import { buildSuggestions, type RealSuggestion, type SuggestionIcon } from "@/lib/lumen/suggestions";
import { fmtBytes, fmtCount } from "@/lib/lumen/data";
import {
  IconBroom, IconBurst, IconBlur, IconShot, IconWA, IconVideo,
  IconFile, IconCheck, IconRefresh, IconArrowR, IconSparkle, IconRestore,
} from "./icons";

const ICON_MAP: Record<SuggestionIcon, ComponentType<{ size?: number }>> = {
  save: IconBroom,
  burst: IconBurst,
  blur: IconBlur,
  shot: IconShot,
  wa: IconWA,
  video: IconVideo,
  doc: IconFile,
  tiny: IconFile,
};

interface Props {
  setView: (v: "trash") => void;
}

export function SuggestView({ setView }: Props) {
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

  const stagedFromAll = visible.reduce(
    (a, s) => a + s.itemIds.filter((id) => staged.has(id)).length,
    0,
  );
  const totalPossibleBytes = visible.reduce((a, s) => a + s.bytes, 0);

  const applyAllSafe = () => {
    const safeSugs = visible.filter((s) => s.id === "dups-exact" || s.id === "dups-near");
    const ids = safeSugs.flatMap((s) => s.itemIds);
    if (ids.length > 0) stageItems(ids);
  };

  return (
    <div className="view">
      <header className="sg-head">
        <div>
          <div className="sg-eyebrow">
            {visible.length} suggestion{visible.length === 1 ? "" : "s"} · computed locally from your scan
          </div>
          <h2>What to clean up — your call on each.</h2>
          <p>
            Recover up to <strong style={{ color: "var(--text)" }}>{fmtBytes(totalPossibleBytes)}</strong> across {fmtCount(visible.reduce((a, s) => a + s.itemIds.length, 0))} files.
            Staging is reversible — nothing leaves disk until you download and run the cleanup script.
          </p>
        </div>
        <div className="sg-head-actions">
          <button className="btn ghost" onClick={() => setDismissed(new Set())}>
            <IconRefresh size={13} /> Reset
          </button>
          <button className="btn primary" onClick={applyAllSafe} disabled={visible.length === 0}>
            <IconCheck size={13} /> Stage all safe
          </button>
        </div>
      </header>

      {visible.length === 0 ? (
        <div className="sg-empty">
          <IconSparkle size={26} style={{ color: "var(--good)" }} />
          <p>Nothing flagged. Your library is already clean — no duplicates, no obvious junk.</p>
        </div>
      ) : (
        <>
          <div className="sg-list">
            {visible.map((s) => (
              <SuggestionCard
                key={s.id}
                suggestion={s}
                stagedCount={s.itemIds.filter((id) => staged.has(id)).length}
                onStage={() => stageItems(s.itemIds)}
                onUnstage={() => unstageItems(s.itemIds)}
                onDismiss={() => setDismissed((d) => new Set([...d, s.id]))}
              />
            ))}
          </div>

          {stagedFromAll > 0 && (
            <div style={{ marginTop: 32, display: "flex", justifyContent: "space-between", alignItems: "center", padding: 22, borderRadius: 12, border: "0.5px solid var(--border-soft)", background: "var(--bg-2)" }}>
              <div>
                <div style={{ fontFamily: "var(--display)", fontSize: 18, letterSpacing: "-0.022em", marginBottom: 4 }}>
                  {fmtCount(staged.size)} file{staged.size === 1 ? "" : "s"} staged for cleanup
                </div>
                <div style={{ color: "var(--muted)", fontSize: 12.5 }}>
                  Review them in Trash. Nothing is deleted until you download and run the script.
                </div>
              </div>
              <button className="btn primary" onClick={() => setView("trash")}>
                Review staged <IconArrowR size={13} />
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
  onStage: () => void;
  onUnstage: () => void;
  onDismiss: () => void;
}

function SuggestionCard({ suggestion, stagedCount, onStage, onUnstage, onDismiss }: CardProps) {
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
          {isFullyStaged ? (
            <button className="btn-sm ghost" onClick={onUnstage}>
              <IconRestore size={12} /> Unstage all
            </button>
          ) : (
            <>
              <button className="btn-sm ghost" onClick={onDismiss}>Dismiss</button>
              <button className="btn-sm primary" onClick={onStage}>
                {isPartiallyStaged
                  ? `Stage remaining ${suggestion.itemIds.length - stagedCount}`
                  : `Stage ${fmtCount(suggestion.itemIds.length)}`}
                {" "}<IconArrowR size={11} />
              </button>
            </>
          )}
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
