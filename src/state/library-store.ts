"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { BrowserDuplicateGroup, BrowserLibrarySummary, BrowserMediaItem, ScanProgress } from "@/lib/browser/types";

interface LibraryState {
  summary: BrowserLibrarySummary | null;
  items: BrowserMediaItem[];
  duplicatesExact: BrowserDuplicateGroup[];
  duplicatesNear: BrowserDuplicateGroup[];
  progress: ScanProgress | null;
  hydrated: boolean;
  setProgress: (p: ScanProgress | null) => void;
  setResult: (summary: BrowserLibrarySummary, items: BrowserMediaItem[], exact: BrowserDuplicateGroup[], near: BrowserDuplicateGroup[]) => void;
  clear: () => void;
}

const initial = {
  summary: null,
  items: [],
  duplicatesExact: [],
  duplicatesNear: [],
  progress: null,
  hydrated: false,
};

export const useLibraryStore = create<LibraryState>()(
  persist(
    (set) => ({
      ...initial,
      setProgress: (p) => set({ progress: p }),
      setResult: (summary, items, exact, near) =>
        set({ summary, items, duplicatesExact: exact, duplicatesNear: near, progress: null }),
      clear: () => set({ ...initial, hydrated: true }),
    }),
    {
      name: "gallery-sort-library",
      version: 1,
      storage: createJSONStorage(() => (typeof window !== "undefined" ? window.localStorage : (undefined as unknown as Storage))),
      // Don't persist thumbDataUrls — they're huge. Strip them out.
      partialize: (state) => ({
        summary: state.summary,
        duplicatesExact: state.duplicatesExact,
        duplicatesNear: state.duplicatesNear,
        items: state.items.map((i) => ({ ...i, thumbDataUrl: null })),
      }),
      onRehydrateStorage: () => (state) => {
        if (state) state.hydrated = true;
      },
    },
  ),
);

export function libraryIsEmpty(state: Pick<LibraryState, "items">): boolean {
  return state.items.length === 0;
}
