"use client";

import { type ComponentType } from "react";
import { useLibraryStore } from "@/state/library-store";
import { fmtBytes, fmtCount } from "@/lib/lumen/data";
import {
  IconLibrary, IconClock, IconSearch, IconBroom, IconDup, IconSparkle, IconFace,
  IconTrash, IconFolder, IconPlus, IconRestore, LumenMark,
} from "./icons";
import type { View } from "./types";

interface IconProps { size?: number; }

interface SideItemProps {
  icon: ComponentType<IconProps>;
  label: string;
  active: boolean;
  count?: number | string;
  onClick: () => void;
  disabled?: boolean;
}

function SideItem({ icon: Ic, label, active, count, onClick, disabled }: SideItemProps) {
  return (
    <button
      onClick={disabled ? undefined : onClick}
      className="side-item"
      data-active={active ? "1" : "0"}
      style={{ opacity: disabled ? 0.35 : 1 }}
    >
      <span className="si-icon"><Ic size={15} /></span>
      <span className="si-label">{label}</span>
      {count != null && (
        <span className="si-count">{typeof count === "number" ? fmtCount(count) : count}</span>
      )}
    </button>
  );
}

interface Props {
  view: View;
  setView: (v: View) => void;
  onScan: () => void;
  onRunAi: () => void;
  realLibrary: { name: string; count: number } | null;
  onClearLibrary?: () => void;
  dupGroupCount: number;
  reclaimable: number;
  suggestionCount: number;
  stagedCount: number;
}

export function Sidebar({
  view, setView, onScan, onRunAi, realLibrary, onClearLibrary,
  dupGroupCount, reclaimable, suggestionCount, stagedCount,
}: Props) {
  const items = useLibraryStore((s) => s.items);
  const hasLib = realLibrary !== null;
  const hasClip = items.some((i) => i.clipEmbedding && i.clipEmbedding.length > 0);
  const peopleCount = items.reduce((a, i) => a + (i.faces?.length ?? 0), 0);

  return (
    <aside className="sidebar">
      <div className="sb-header">
        <div className="sb-traffic">
          <span className="tl tl-r" />
          <span className="tl tl-y" />
          <span className="tl tl-g" />
        </div>
      </div>

      <div className="sb-brand">
        <div className="sb-mark"><LumenMark size={22} /></div>
        <div>
          <div className="sb-name">Lumen</div>
          <div className="sb-sub">
            {hasLib ? `Local · ${fmtCount(realLibrary.count)} items` : "Local · no library yet"}
          </div>
        </div>
      </div>

      <div className="sb-section">
        <SideItem icon={IconLibrary} label="Library" active={view === "library"} count={hasLib ? fmtCount(realLibrary.count) : "—"} onClick={() => setView("library")} disabled={!hasLib} />
        <SideItem icon={IconClock} label="Timeline" active={view === "timeline"} onClick={() => setView("timeline")} disabled={!hasLib} />
        <SideItem icon={IconSparkle} label="AI Suggestions" active={view === "suggest"} count={hasLib ? suggestionCount : "—"} onClick={() => setView("suggest")} disabled={!hasLib} />
        <SideItem icon={IconSearch} label="Search" active={view === "search"} count={hasClip ? "semantic" : undefined} onClick={() => setView("search")} disabled={!hasLib} />
        <SideItem icon={IconFace} label="People" active={view === "people"} count={peopleCount > 0 ? "AI" : "—"} onClick={() => setView("people")} disabled={!hasLib || peopleCount === 0} />
      </div>

      <div className="sb-divider" />

      <div className="sb-section">
        <div className="sb-section-label">Cleanup</div>
        <SideItem icon={IconBroom} label="Dashboard" active={view === "cleanup"} count={hasLib && reclaimable > 0 ? fmtBytes(reclaimable) : "—"} onClick={() => setView("cleanup")} disabled={!hasLib} />
        <SideItem icon={IconDup} label="Duplicates" active={view === "dups"} count={dupGroupCount} onClick={() => setView("dups")} disabled={!hasLib} />
        <SideItem icon={IconTrash} label="Staged for trash" active={view === "trash"} count={stagedCount} onClick={() => setView("trash")} />
      </div>

      {hasLib && (
        <>
          <div className="sb-divider" />
          <div className="sb-section">
            <div className="sb-section-label">Source</div>
            <SideItem icon={IconFolder} label={realLibrary.name} active={false} count={fmtCount(realLibrary.count)} onClick={() => {}} />
          </div>
        </>
      )}

      <div className="sb-spacer" />

      <div className="sb-footer">
        {hasLib && !hasClip && (
          <button
            onClick={onRunAi}
            className="sb-scan-btn"
            style={{ background: "transparent", color: "var(--text)", border: "0.5px solid var(--accent)" }}
          >
            <IconSparkle size={14} />
            <span>Enable AI analysis</span>
          </button>
        )}
        <button className="sb-scan-btn" onClick={onScan}>
          <IconPlus size={14} />
          <span>{hasLib ? "Scan another folder" : "Scan a folder"}</span>
        </button>
        {hasLib && onClearLibrary && (
          <button
            onClick={onClearLibrary}
            className="side-item"
            style={{ padding: "8px 12px", color: "var(--muted)", fontSize: 11.5 }}
          >
            <span className="si-icon"><IconRestore size={13} /></span>
            <span>Clear library</span>
          </button>
        )}
        <div className="sb-privacy">
          <span className="dot-live" />
          <span>All processing local · No uploads</span>
        </div>
      </div>
    </aside>
  );
}
