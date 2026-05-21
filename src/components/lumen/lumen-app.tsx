"use client";

import { useEffect, useMemo, useState } from "react";
import { useLibraryStore } from "@/state/library-store";
import { PHOTOS, DUP_GROUPS, CLEANUP, SEMANTIC_RESULTS } from "@/lib/lumen/data";
import { adaptPhotos, adaptDuplicates, computeCleanup, buildSemanticMap } from "@/lib/lumen/adapter";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";
import { LibraryView } from "./library-view";
import { CleanupView } from "./cleanup-view";
import { DupView } from "./dup-view";
import { SearchView } from "./search-view";
import { SuggestView } from "./suggest-view";
import { QualityView } from "./quality-view";
import { TrashView } from "./trash-view";
import { EventView } from "./event-view";
import { ScanModal } from "./scan-modal";
import { RenameModal } from "./rename-modal";
import type { GridStyle, View } from "./types";

export function LumenApp() {
  const [view, setView] = useState<View>("library");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [selectedAlbum, setSelectedAlbum] = useState("e1");
  const [query, setQuery] = useState("");
  const [gridStyle, setGridStyle] = useState<GridStyle>("timeline");
  const [showScan, setShowScan] = useState(false);
  const [showRename, setShowRename] = useState(false);

  const summary = useLibraryStore((s) => s.summary);
  const realItems = useLibraryStore((s) => s.items);
  const realExact = useLibraryStore((s) => s.duplicatesExact);
  const realNear = useLibraryStore((s) => s.duplicatesNear);
  const clearLibrary = useLibraryStore((s) => s.clear);

  const hasRealLibrary = realItems.length > 0;

  // Active dataset — real if scanned, mock otherwise. The Lumen views never
  // know which one they're showing; they just render whatever they get.
  const activePhotos = useMemo(
    () => (hasRealLibrary ? adaptPhotos(realItems) : PHOTOS),
    [hasRealLibrary, realItems],
  );

  const activeDupGroups = useMemo(
    () => (hasRealLibrary ? adaptDuplicates([...realExact, ...realNear], realItems) : DUP_GROUPS),
    [hasRealLibrary, realExact, realNear, realItems],
  );

  const activeCleanup = useMemo(
    () => (hasRealLibrary ? computeCleanup(realItems, realExact, realNear) : CLEANUP),
    [hasRealLibrary, realItems, realExact, realNear],
  );

  const activeSemanticMap = useMemo(
    () => (hasRealLibrary ? buildSemanticMap(activePhotos) : SEMANTIC_RESULTS),
    [hasRealLibrary, activePhotos],
  );

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
    if (query && view !== "search") setView("search");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const switchView = (v: View) => {
    if (v !== "search") setQuery("");
    setView(v);
    setSelected(new Set());
  };

  const selectedPhotos = activePhotos.filter((p) => selected.has(p.id));

  let body: React.ReactNode;
  switch (view) {
    case "library":
      body = (
        <LibraryView photos={activePhotos} selected={selected} setSelected={setSelected}
                     gridStyle={gridStyle} showConfidence useMock={false} />
      );
      break;
    case "timeline":
      body = (
        <LibraryView photos={activePhotos} selected={selected} setSelected={setSelected}
                     gridStyle="timeline" showConfidence useMock={false} />
      );
      break;
    case "cleanup":
      body = <CleanupView setView={switchView} showConfidence cleanup={activeCleanup} hasRealLibrary={hasRealLibrary} />;
      break;
    case "dups":
      body = <DupView groups={activeDupGroups} />;
      break;
    case "search":
      body = (
        <SearchView query={query} setQuery={setQuery}
                    photos={activePhotos} semanticMap={activeSemanticMap}
                    gridStyle={gridStyle} useMock={false} showConfidence />
      );
      break;
    case "suggest":
      body = <SuggestView />;
      break;
    case "quality":
      body = <QualityView photos={activePhotos} useMock={false} />;
      break;
    case "trash":
      body = <TrashView />;
      break;
    case "event":
      body = <EventView albumId={selectedAlbum} gridStyle={gridStyle} useMock={false} showConfidence />;
      break;
    default:
      body = null;
  }

  return (
    <div className="stage">
      <div className="win-fit">
        <div className="win">
          <Sidebar
            view={view}
            setView={switchView}
            selectedAlbum={selectedAlbum}
            setSelectedAlbum={setSelectedAlbum}
            onScan={() => setShowScan(true)}
            realLibrary={realLibraryInfo}
            onClearLibrary={hasRealLibrary ? clearLibrary : undefined}
            dupGroupCount={activeDupGroups.length}
            reclaimable={activeCleanup.reclaim}
          />
          <div className="main">
            <Topbar
              view={view}
              gridStyle={gridStyle}
              setGridStyle={setGridStyle}
              onRename={() => selected.size && setShowRename(true)}
              onClearSel={() => setSelected(new Set())}
              selectedCount={selected.size}
              query={query}
              setQuery={setQuery}
              photoCount={activePhotos.length}
              dupGroupCount={activeDupGroups.length}
              reclaimable={activeCleanup.reclaim}
              isReal={hasRealLibrary}
            />
            <div className="content">{body}</div>
          </div>

          {showScan && (
            <ScanModal
              onClose={() => setShowScan(false)}
              onComplete={() => { setShowScan(false); switchView("library"); }}
            />
          )}
          {showRename && (
            <RenameModal
              photos={selectedPhotos.length ? selectedPhotos : activePhotos.slice(0, 12)}
              onClose={() => setShowRename(false)}
              useMock={false}
            />
          )}
        </div>
      </div>
    </div>
  );
}
