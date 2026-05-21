"use client";

import { useState, type ComponentType } from "react";
import { PHOTOS, SUGGESTIONS, CLEANUP, DUP_GROUPS, EVENTS, fmtBytes, fmtCount } from "@/lib/lumen/data";
import {
  IconLibrary, IconClock, IconSparkle, IconSearch, IconBroom, IconDup,
  IconBlur, IconTrash, IconChevD, IconMountain, IconDrive, IconFolder,
  IconPlus, LumenMark,
} from "./icons";
import type { View } from "./types";

interface IconProps {
  size?: number;
}

interface SideItemProps {
  icon: ComponentType<IconProps>;
  label: string;
  active: boolean;
  count?: number | string;
  onClick: () => void;
  indent?: number;
}

function SideItem({ icon: Ic, label, active, count, onClick, indent = 0 }: SideItemProps) {
  return (
    <button
      onClick={onClick}
      className="side-item"
      data-active={active ? "1" : "0"}
      style={{ paddingLeft: 12 + indent * 14 }}
    >
      <span className="si-icon">
        <Ic size={15} />
      </span>
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
  selectedAlbum: string;
  setSelectedAlbum: (id: string) => void;
  onScan: () => void;
  realLibrary?: { name: string; count: number } | null;
}

export function Sidebar({ view, setView, selectedAlbum, setSelectedAlbum, onScan, realLibrary }: Props) {
  const [memOpen, setMemOpen] = useState(true);

  const libCount = realLibrary?.count ?? PHOTOS.length * 1024;
  const libSub = realLibrary ? realLibrary.name : "Local · 248 GB indexed";

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
          <div className="sb-sub">{libSub}</div>
        </div>
      </div>

      <div className="sb-section">
        <SideItem icon={IconLibrary} label="Library" active={view === "library"} count={fmtCount(libCount)} onClick={() => setView("library")} />
        <SideItem icon={IconClock} label="Timeline" active={view === "timeline"} onClick={() => setView("timeline")} />
        <SideItem icon={IconSparkle} label="AI Suggestions" active={view === "suggest"} count={SUGGESTIONS.length} onClick={() => setView("suggest")} />
        <SideItem icon={IconSearch} label="Search" active={view === "search"} onClick={() => setView("search")} />
      </div>

      <div className="sb-divider" />

      <div className="sb-section">
        <div className="sb-section-label">Cleanup</div>
        <SideItem icon={IconBroom} label="Dashboard" active={view === "cleanup"} count={fmtBytes(CLEANUP.reclaim)} onClick={() => setView("cleanup")} />
        <SideItem icon={IconDup} label="Duplicates" active={view === "dups"} count={DUP_GROUPS.length} onClick={() => setView("dups")} />
        <SideItem icon={IconBlur} label="Quality" active={view === "quality"} count={328} onClick={() => setView("quality")} />
        <SideItem icon={IconTrash} label="Trash" active={view === "trash"} count={0} onClick={() => setView("trash")} />
      </div>

      <div className="sb-divider" />

      <div className="sb-section">
        <button className="sb-section-row" onClick={() => setMemOpen(!memOpen)}>
          <IconChevD size={10} style={{ transform: memOpen ? "" : "rotate(-90deg)", transition: "transform .15s" }} />
          <span>Memories</span>
          <span className="si-count">{EVENTS.length}</span>
        </button>
        {memOpen && EVENTS.slice(0, 5).map((e) => (
          <SideItem
            key={e.id}
            icon={IconMountain}
            label={e.name}
            active={view === "event" && selectedAlbum === e.id}
            count={e.count}
            indent={1}
            onClick={() => { setView("event"); setSelectedAlbum(e.id); }}
          />
        ))}
      </div>

      <div className="sb-divider" />

      <div className="sb-section">
        <div className="sb-section-label">Sources</div>
        <SideItem icon={IconDrive} label="Samsung T7 SSD" active={false} count="248 GB" onClick={() => {}} />
        <SideItem icon={IconFolder} label="~/Pictures/Camera" active={false} count="3,124" onClick={() => {}} />
        <SideItem icon={IconFolder} label="~/Downloads" active={false} count="412" onClick={() => {}} />
      </div>

      <div className="sb-spacer" />

      <div className="sb-footer">
        <button className="sb-scan-btn" onClick={onScan}>
          <IconPlus size={14} />
          <span>Scan a new folder</span>
        </button>
        <div className="sb-privacy">
          <span className="dot-live" />
          <span>All processing local · No cloud sync</span>
        </div>
      </div>
    </aside>
  );
}
