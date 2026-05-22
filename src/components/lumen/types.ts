export type View = "library" | "timeline" | "cleanup" | "dups" | "search" | "suggest" | "people" | "trash" | "focus";

export type GridStyle = "masonry" | "uniform" | "timeline";

export interface FocusContext {
  /** Where the user came from — set this view when they click Back */
  source: View;
  /** Headline shown at the top of the focus view */
  label: string;
  /** Optional subhead with extra context */
  sublabel?: string;
  /** Item ids to display */
  itemIds: string[];
}
