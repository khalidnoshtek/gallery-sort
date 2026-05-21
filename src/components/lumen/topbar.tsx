"use client";

import { PHOTOS, CLEANUP, DUP_GROUPS, fmtBytes, fmtCount } from "@/lib/lumen/data";
import {
  IconSearch, IconMasonry, IconGrid, IconList, IconRefresh, IconSettings,
  IconX, IconWand, IconStar, IconFolder, IconTrash,
} from "./icons";
import type { GridStyle, View } from "./types";

interface Props {
  view: View;
  gridStyle: GridStyle;
  setGridStyle: (g: GridStyle) => void;
  onRename: () => void;
  selectedCount: number;
  onClearSel: () => void;
  query: string;
  setQuery: (q: string) => void;
}

const TITLES: Record<View, string> = {
  library: "Library",
  timeline: "Timeline",
  cleanup: "Cleanup",
  dups: "Duplicates",
  quality: "Quality review",
  trash: "Trash",
  suggest: "AI Suggestions",
  search: "Search",
  event: "Memory",
};

export function Topbar({ view, gridStyle, setGridStyle, onRename, selectedCount, onClearSel, query, setQuery }: Props) {
  return (
    <header className="topbar">
      <div className="tb-left">
        <h1 className="tb-title">{TITLES[view] || "Lumen"}</h1>
        {view === "library" && <span className="tb-sub">All photos · {fmtCount(PHOTOS.length * 1024)} items</span>}
        {view === "cleanup" && <span className="tb-sub">{fmtBytes(CLEANUP.reclaim)} reclaimable across {CLEANUP.buckets.length} categories</span>}
        {view === "dups" && <span className="tb-sub">{DUP_GROUPS.length} groups · {fmtBytes(14.2 * 1024 ** 3)} potential savings</span>}
      </div>

      <div className="tb-search">
        <IconSearch size={14} />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search photos, faces, places, OCR text…"
        />
        <kbd>⌘K</kbd>
      </div>

      <div className="tb-tools">
        {(view === "library" || view === "event" || view === "search") && (
          <div className="seg">
            <button data-on={gridStyle === "masonry" ? "1" : "0"} onClick={() => setGridStyle("masonry")} title="Masonry"><IconMasonry size={14} /></button>
            <button data-on={gridStyle === "uniform" ? "1" : "0"} onClick={() => setGridStyle("uniform")} title="Uniform grid"><IconGrid size={14} /></button>
            <button data-on={gridStyle === "timeline" ? "1" : "0"} onClick={() => setGridStyle("timeline")} title="Timeline"><IconList size={14} /></button>
          </div>
        )}
        <button className="tb-btn ghost" title="Refresh"><IconRefresh size={15} /></button>
        <button className="tb-btn ghost" title="Settings"><IconSettings size={15} /></button>
      </div>

      {selectedCount > 0 && (
        <div className="sel-bar">
          <button className="sel-x" onClick={onClearSel}><IconX size={13} /></button>
          <span className="sel-count">{selectedCount} selected</span>
          <div className="sel-actions">
            <button className="sel-act" onClick={onRename}><IconWand size={13} /> Batch rename</button>
            <button className="sel-act"><IconStar size={13} /> Favorite</button>
            <button className="sel-act"><IconFolder size={13} /> Move to album</button>
            <button className="sel-act danger"><IconTrash size={13} /> Move to Trash</button>
          </div>
        </div>
      )}
    </header>
  );
}
