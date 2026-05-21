"use client";

import { create } from "zustand";
import type { BrowserDuplicateGroup, BrowserLibrarySummary, BrowserMediaItem, ScanProgress } from "@/lib/browser/types";

interface LibraryState {
  summary: BrowserLibrarySummary | null;
  items: BrowserMediaItem[];
  duplicatesExact: BrowserDuplicateGroup[];
  duplicatesNear: BrowserDuplicateGroup[];
  progress: ScanProgress | null;
  hasWriteAccess: boolean;

  stagedForTrash: Set<string>;

  setProgress: (p: ScanProgress | null) => void;
  setResult: (
    summary: BrowserLibrarySummary,
    items: BrowserMediaItem[],
    exact: BrowserDuplicateGroup[],
    near: BrowserDuplicateGroup[],
    hasWriteAccess: boolean,
  ) => void;
  stageItems: (ids: string[]) => void;
  unstageItems: (ids: string[]) => void;
  clearStaging: () => void;
  removeItems: (ids: string[]) => void;
  /** Patch fields on existing items (e.g. add CLIP embeddings, face data). */
  patchItems: (patches: Array<{ id: string } & Partial<BrowserMediaItem>>) => void;
  clear: () => void;
}

export const useLibraryStore = create<LibraryState>((set) => ({
  summary: null,
  items: [],
  duplicatesExact: [],
  duplicatesNear: [],
  progress: null,
  hasWriteAccess: false,
  stagedForTrash: new Set(),

  setProgress: (p) => set({ progress: p }),
  setResult: (summary, items, exact, near, hasWriteAccess) =>
    set({
      summary,
      items,
      duplicatesExact: exact,
      duplicatesNear: near,
      progress: null,
      hasWriteAccess,
      stagedForTrash: new Set(),
    }),
  stageItems: (ids) =>
    set((s) => {
      const next = new Set(s.stagedForTrash);
      ids.forEach((id) => next.add(id));
      return { stagedForTrash: next };
    }),
  unstageItems: (ids) =>
    set((s) => {
      const next = new Set(s.stagedForTrash);
      ids.forEach((id) => next.delete(id));
      return { stagedForTrash: next };
    }),
  clearStaging: () => set({ stagedForTrash: new Set() }),
  removeItems: (ids) =>
    set((s) => {
      const idSet = new Set(ids);
      const newItems = s.items.filter((i) => !idSet.has(i.id));
      const stayedIds = new Set(newItems.map((i) => i.id));
      const filterGroup = (g: BrowserDuplicateGroup): BrowserDuplicateGroup | null => {
        const surviving = g.memberIds.filter((m) => stayedIds.has(m));
        if (surviving.length < 2) return null;
        return {
          ...g,
          memberIds: surviving,
          bestId: surviving.includes(g.bestId) ? g.bestId : surviving[0]!,
        };
      };
      const newStaged = new Set<string>();
      s.stagedForTrash.forEach((id) => {
        if (!idSet.has(id)) newStaged.add(id);
      });
      return {
        items: newItems,
        duplicatesExact: s.duplicatesExact.map(filterGroup).filter((g): g is BrowserDuplicateGroup => g !== null),
        duplicatesNear: s.duplicatesNear.map(filterGroup).filter((g): g is BrowserDuplicateGroup => g !== null),
        stagedForTrash: newStaged,
        summary: s.summary ? { ...s.summary, itemCount: newItems.length } : null,
      };
    }),
  patchItems: (patches) =>
    set((s) => {
      if (patches.length === 0) return s;
      const map = new Map(patches.map((p) => [p.id, p]));
      const newItems = s.items.map((it) => {
        const p = map.get(it.id);
        return p ? { ...it, ...p } : it;
      });
      return { items: newItems };
    }),
  clear: () =>
    set({
      summary: null,
      items: [],
      duplicatesExact: [],
      duplicatesNear: [],
      progress: null,
      hasWriteAccess: false,
      stagedForTrash: new Set(),
    }),
}));
