"use client";

import { create } from "zustand";
import type { BrowserDuplicateGroup, BrowserLibrarySummary, BrowserMediaItem, ScanProgress } from "@/lib/browser/types";

interface LibraryState {
  summary: BrowserLibrarySummary | null;
  items: BrowserMediaItem[];
  duplicatesExact: BrowserDuplicateGroup[];
  duplicatesNear: BrowserDuplicateGroup[];
  progress: ScanProgress | null;
  setProgress: (p: ScanProgress | null) => void;
  setResult: (
    summary: BrowserLibrarySummary,
    items: BrowserMediaItem[],
    exact: BrowserDuplicateGroup[],
    near: BrowserDuplicateGroup[],
  ) => void;
  clear: () => void;
}

// In-session only. Base64 thumbnails would blow past localStorage limits,
// and persisting metadata without thumbnails leaves you with broken images
// after reload. Fresh scan per session is the contract.

export const useLibraryStore = create<LibraryState>((set) => ({
  summary: null,
  items: [],
  duplicatesExact: [],
  duplicatesNear: [],
  progress: null,
  setProgress: (p) => set({ progress: p }),
  setResult: (summary, items, exact, near) =>
    set({ summary, items, duplicatesExact: exact, duplicatesNear: near, progress: null }),
  clear: () =>
    set({
      summary: null,
      items: [],
      duplicatesExact: [],
      duplicatesNear: [],
      progress: null,
    }),
}));
