// Sort options for photo lists. Centralized so Library, Focus, and any
// future view use the same vocabulary.

import type { BrowserMediaItem } from "../browser/types";

export type SortKey = "date-desc" | "date-asc" | "size-desc" | "size-asc" | "name-asc";

export interface SortOption {
  key: SortKey;
  label: string;
  short: string;
}

export const SORT_OPTIONS: SortOption[] = [
  { key: "date-desc", label: "Newest first", short: "Newest" },
  { key: "date-asc", label: "Oldest first", short: "Oldest" },
  { key: "size-desc", label: "Largest first", short: "Largest" },
  { key: "size-asc", label: "Smallest first", short: "Smallest" },
  { key: "name-asc", label: "Filename A→Z", short: "A→Z" },
];

export function sortItems<T extends Pick<BrowserMediaItem, "lastModified" | "sizeBytes" | "filename">>(
  items: T[],
  key: SortKey,
): T[] {
  const arr = [...items];
  switch (key) {
    case "date-desc":
      return arr.sort((a, b) => b.lastModified - a.lastModified);
    case "date-asc":
      return arr.sort((a, b) => a.lastModified - b.lastModified);
    case "size-desc":
      return arr.sort((a, b) => b.sizeBytes - a.sizeBytes);
    case "size-asc":
      return arr.sort((a, b) => a.sizeBytes - b.sizeBytes);
    case "name-asc":
      return arr.sort((a, b) => a.filename.localeCompare(b.filename, undefined, { sensitivity: "base", numeric: true }));
  }
}

export function sortPhotos<T extends { date: string; size: number; filename: string; lastModified?: number }>(
  items: T[],
  key: SortKey,
): T[] {
  const arr = [...items];
  const dateOf = (i: T) => i.lastModified ?? new Date(i.date).getTime();
  switch (key) {
    case "date-desc":
      return arr.sort((a, b) => dateOf(b) - dateOf(a));
    case "date-asc":
      return arr.sort((a, b) => dateOf(a) - dateOf(b));
    case "size-desc":
      return arr.sort((a, b) => b.size - a.size);
    case "size-asc":
      return arr.sort((a, b) => a.size - b.size);
    case "name-asc":
      return arr.sort((a, b) => a.filename.localeCompare(b.filename, undefined, { sensitivity: "base", numeric: true }));
  }
}
