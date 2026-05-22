export type View = "library" | "timeline" | "cleanup" | "dups" | "search" | "suggest" | "people" | "trash" | "library-trash" | "focus";

export type GridStyle = "masonry" | "uniform" | "timeline";

export interface FocusContext {
  source: View;
  label: string;
  sublabel?: string;
  itemIds: string[];
}
