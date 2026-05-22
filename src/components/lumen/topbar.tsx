"use client";

import { useLibraryStore } from "@/state/library-store";
import { fmtBytes, fmtCount } from "@/lib/lumen/data";
import {
  IconSearch, IconMasonry, IconGrid, IconRefresh,
  IconX, IconTrash,
} from "./icons";
import type { GridStyle, View } from "./types";

interface Props {
  view: View;
  gridStyle: GridStyle;
  setGridStyle: (g: GridStyle) => void;
  onClearSel: () => void;
  selectedCount: number;
  selectedIds: string[];
  query: string;
  setQuery: (q: string) => void;
  photoCount: number;
  dupGroupCount: number;
  reclaimable: number;
  isReal: boolean;
}

const TITLES: Record<View, string> = {
  library: "Library",
  timeline: "By month",
  cleanup: "Cleanup",
  dups: "Duplicates",
  trash: "Staged for trash",
  "library-trash": "Library trash",
  search: "Search",
  suggest: "AI Suggestions",
  people: "People",
  focus: "Review",
};

export function Topbar({
  view, gridStyle, setGridStyle, onClearSel, selectedCount, selectedIds, query, setQuery,
  photoCount, dupGroupCount, reclaimable, isReal,
}: Props) {
  const stageItems = useLibraryStore((s) => s.stageItems);

  const subForView = () => {
    if (!isReal) return null;
    if (view === "library") return `${fmtCount(photoCount)} items indexed`;
    if (view === "timeline") return "Grouped by file modified date";
    if (view === "cleanup") return reclaimable > 0 ? `${fmtBytes(reclaimable)} reclaimable` : "Nothing to clean up";
    if (view === "dups") return `${dupGroupCount} group${dupGroupCount === 1 ? "" : "s"}`;
    return null;
  };
  const sub = subForView();

  const moveToTrash = () => {
    if (selectedIds.length === 0) return;
    stageItems(selectedIds);
    onClearSel();
  };

  // Grid switcher: only shown in views where it makes sense, and never includes
  // the "timeline" option (that's the "By month" view, accessed from the sidebar).
  const showGridSwitcher = view === "library" || view === "search";

  return (
    <header className="topbar">
      <div className="tb-left">
        <h1 className="tb-title">{TITLES[view] || "Lumen"}</h1>
        {sub && <span className="tb-sub">{sub}</span>}
      </div>

      <div className="tb-search">
        <IconSearch size={14} />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={isReal ? "Search filename, path, or AI semantic" : "Scan a folder to enable search"}
          disabled={!isReal}
        />
        <kbd>⌘K</kbd>
      </div>

      <div className="tb-tools">
        {showGridSwitcher && (
          <div className="seg">
            <button
              data-on={gridStyle === "masonry" ? "1" : "0"}
              onClick={() => setGridStyle("masonry")}
              title="Masonry"
            >
              <IconMasonry size={14} />
            </button>
            <button
              data-on={gridStyle === "uniform" ? "1" : "0"}
              onClick={() => setGridStyle("uniform")}
              title="Uniform grid"
            >
              <IconGrid size={14} />
            </button>
          </div>
        )}
        <button className="tb-btn ghost" title="Rescan"><IconRefresh size={15} /></button>
      </div>

      {selectedCount > 0 && (
        <div className="sel-bar">
          <button className="sel-x" onClick={onClearSel}><IconX size={13} /></button>
          <span className="sel-count">{selectedCount} selected</span>
          <div className="sel-actions">
            <button className="sel-act danger" onClick={moveToTrash}>
              <IconTrash size={13} /> Stage for trash
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
