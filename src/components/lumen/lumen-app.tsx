"use client";

import { useEffect, useState } from "react";
import { PHOTOS } from "@/lib/lumen/data";
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

  // Fit the fixed 1380×880 design to the viewport — scale-as-a-unit.
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

  // Selecting query auto-switches to search
  useEffect(() => {
    if (query && view !== "search") setView("search");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const switchView = (v: View) => {
    if (v !== "search") setQuery("");
    setView(v);
    setSelected(new Set());
  };

  const selectedPhotos = PHOTOS.filter((p) => selected.has(p.id));

  let body: React.ReactNode;
  switch (view) {
    case "library":
      body = (
        <LibraryView photos={PHOTOS} selected={selected} setSelected={setSelected}
                     gridStyle={gridStyle} showConfidence useMock={false} />
      );
      break;
    case "timeline":
      body = (
        <LibraryView photos={PHOTOS} selected={selected} setSelected={setSelected}
                     gridStyle="timeline" showConfidence useMock={false} />
      );
      break;
    case "cleanup":
      body = <CleanupView setView={switchView} showConfidence />;
      break;
    case "dups":
      body = <DupView />;
      break;
    case "search":
      body = <SearchView query={query} setQuery={setQuery}
                         gridStyle={gridStyle} useMock={false} showConfidence />;
      break;
    case "suggest":
      body = <SuggestView />;
      break;
    case "quality":
      body = <QualityView useMock={false} />;
      break;
    case "trash":
      body = <TrashView />;
      break;
    case "event":
      body = <EventView albumId={selectedAlbum} gridStyle={gridStyle}
                        useMock={false} showConfidence />;
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
            />
            <div className="content">{body}</div>
          </div>

          {showScan && (
            <ScanModal
              onClose={() => setShowScan(false)}
              onComplete={() => setShowScan(false)}
            />
          )}
          {showRename && (
            <RenameModal
              photos={selectedPhotos.length ? selectedPhotos : PHOTOS.slice(0, 12)}
              onClose={() => setShowRename(false)}
              useMock={false}
            />
          )}
        </div>
      </div>
    </div>
  );
}
