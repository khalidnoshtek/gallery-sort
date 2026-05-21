"use client";

import { useEffect, useMemo, useState } from "react";
import { useLibraryStore } from "@/state/library-store";
import { adaptPhotos, adaptDuplicates, computeCleanup, buildSemanticMap } from "@/lib/lumen/adapter";
import { buildSuggestions } from "@/lib/lumen/suggestions";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";
import { LibraryView } from "./library-view";
import { CleanupView } from "./cleanup-view";
import { DupView } from "./dup-view";
import { SearchView } from "./search-view";
import { SuggestView } from "./suggest-view";
import { TrashView } from "./trash-view";
import { ScanModal } from "./scan-modal";
import { EmptyState } from "./empty-state";
import type { GridStyle, View } from "./types";

export function LumenApp() {
  const [view, setView] = useState<View>("library");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");
  const [gridStyle, setGridStyle] = useState<GridStyle>("timeline");
  const [showScan, setShowScan] = useState(false);

  const summary = useLibraryStore((s) => s.summary);
  const realItems = useLibraryStore((s) => s.items);
  const realExact = useLibraryStore((s) => s.duplicatesExact);
  const realNear = useLibraryStore((s) => s.duplicatesNear);
  const staged = useLibraryStore((s) => s.stagedForTrash);
  const clearLibrary = useLibraryStore((s) => s.clear);

  const hasRealLibrary = realItems.length > 0;

  const activePhotos = useMemo(
    () => (hasRealLibrary ? adaptPhotos(realItems) : []),
    [hasRealLibrary, realItems],
  );

  const activeDupGroups = useMemo(
    () => (hasRealLibrary ? adaptDuplicates([...realExact, ...realNear], realItems) : []),
    [hasRealLibrary, realExact, realNear, realItems],
  );

  const activeCleanup = useMemo(
    () => (hasRealLibrary ? computeCleanup(realItems, realExact, realNear) : null),
    [hasRealLibrary, realItems, realExact, realNear],
  );

  const activeSemanticMap = useMemo(
    () => (hasRealLibrary ? buildSemanticMap(activePhotos) : {}),
    [hasRealLibrary, activePhotos],
  );

  const suggestionCount = useMemo(() => {
    if (!hasRealLibrary) return 0;
    return buildSuggestions(realItems, realExact, realNear).length;
  }, [hasRealLibrary, realItems, realExact, realNear]);

  const realLibraryInfo = hasRealLibrary && summary
    ? { name: summary.folderName, count: summary.itemCount }
    : null;

  useEffect(() => {
    const apply = () => {
      const pad = 28;
      const w = (window.innerWidth - pad * 2) / 1380;
      const h = (window.innerHeight - pad * 2) / 880;
      const scale = Math.min(1, w, h);
      document.documentElement.style.setProperty("--fit", scale.toFixed(4));
    };
    apply();
    window.addEventListener("resize", apply);
    return () => window.removeEventListener("resize", apply);
  }, []);

  useEffect(() => {
    if (query && view !== "search" && hasRealLibrary) setView("search");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  useEffect(() => {
    if (!hasRealLibrary && view !== "trash") setView("library");
  }, [hasRealLibrary, view]);

  const switchView = (v: View) => {
    if (v !== "search") setQuery("");
    setView(v);
    setSelected(new Set());
  };

  let body: React.ReactNode;

  if (!hasRealLibrary && view !== "trash") {
    body = <EmptyState onScan={() => setShowScan(true)} />;
  } else {
    switch (view) {
      case "library":
        body = (
          <LibraryView photos={activePhotos} selected={selected} setSelected={setSelected}
                       gridStyle={gridStyle} useMock={false} />
        );
        break;
      case "timeline":
        body = (
          <LibraryView photos={activePhotos} selected={selected} setSelected={setSelected}
                       gridStyle="timeline" useMock={false} />
        );
        break;
      case "cleanup":
        body = activeCleanup
          ? <CleanupView setView={switchView} cleanup={activeCleanup} />
          : null;
        break;
      case "dups":
        body = <DupView groups={activeDupGroups} />;
        break;
      case "search":
        body = (
          <SearchView query={query} setQuery={setQuery}
                      photos={activePhotos} semanticMap={activeSemanticMap}
                      gridStyle={gridStyle} useMock={false} />
        );
        break;
      case "suggest":
        body = <SuggestView setView={switchView} />;
        break;
      case "trash":
        body = <TrashView />;
        break;
      default:
        body = null;
    }
  }

  return (
    <div className="stage">
      <div className="win-fit">
        <div className="win">
          <Sidebar
            view={view}
            setView={switchView}
            onScan={() => setShowScan(true)}
            realLibrary={realLibraryInfo}
            onClearLibrary={hasRealLibrary ? clearLibrary : undefined}
            dupGroupCount={activeDupGroups.length}
            reclaimable={activeCleanup?.reclaim ?? 0}
            suggestionCount={suggestionCount}
            stagedCount={staged.size}
          />
          <div className="main">
            <Topbar
              view={view}
              gridStyle={gridStyle}
              setGridStyle={setGridStyle}
              onClearSel={() => setSelected(new Set())}
              selectedCount={selected.size}
              selectedIds={[...selected]}
              query={query}
              setQuery={setQuery}
              photoCount={activePhotos.length}
              dupGroupCount={activeDupGroups.length}
              reclaimable={activeCleanup?.reclaim ?? 0}
              isReal={hasRealLibrary}
            />
            <div className="content">{body}</div>
          </div>

          {showScan && (
            <ScanModal
              onClose={() => setShowScan(false)}
              onComplete={() => { setShowScan(false); switchView("suggest"); }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
