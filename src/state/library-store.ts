"use client";

import { create } from "zustand";
import type { BrowserDuplicateGroup, BrowserLibrarySummary, BrowserMediaItem, ScanProgress } from "@/lib/browser/types";

interface LibraryState {
  summary: BrowserLibrarySummary | null;
  items: BrowserMediaItem[];
  duplicatesExact: BrowserDuplicateGroup[];
  duplicatesNear: BrowserDuplicateGroup[];
  progress: ScanProgress | null;

  // Staging — items the user has decided to remove. The browser never
  // actually deletes; we generate a shell script the user runs locally.
  stagedForTrash: Set<string>;

  setProgress: (p: ScanProgress | null) => void;
  setResult: (
    summary: BrowserLibrarySummary,
    items: BrowserMediaItem[],
    exact: BrowserDuplicateGroup[],
    near: BrowserDuplicateGroup[],
  ) => void;
  stageItems: (ids: string[]) => void;
  unstageItems: (ids: string[]) => void;
  clearStaging: () => void;
  clear: () => void;
}

export const useLibraryStore = create<LibraryState>((set) => ({
  summary: null,
  items: [],
  duplicatesExact: [],
  duplicatesNear: [],
  progress: null,
  stagedForTrash: new Set(),

  setProgress: (p) => set({ progress: p }),
  setResult: (summary, items, exact, near) =>
    set({
      summary,
      items,
      duplicatesExact: exact,
      duplicatesNear: near,
      progress: null,
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
  clear: () =>
    set({
      summary: null,
      items: [],
      duplicatesExact: [],
      duplicatesNear: [],
      progress: null,
      stagedForTrash: new Set(),
    }),
}));
