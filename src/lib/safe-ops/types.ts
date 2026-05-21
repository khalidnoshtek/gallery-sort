// The destructive-op contract. All side-effecting code in this directory
// MUST go through plan → execute → log, and MUST move to trash, never unlink.

export type SafeOpKind = "TRASH" | "RENAME" | "MOVE" | "RESTORE" | "PURGE_TRASH";

export interface IntentTrash {
  kind: "TRASH";
  mediaIds: string[];
  reason: string; // human readable, e.g. "duplicate of #abc"
}

export interface IntentRename {
  kind: "RENAME";
  renames: Array<{ mediaId: string; newName: string }>;
}

export interface IntentMove {
  kind: "MOVE";
  moves: Array<{ mediaId: string; destDir: string }>;
}

export type Intent = IntentTrash | IntentRename | IntentMove;

export interface PlannedOp {
  mediaId: string;
  from: string;
  to: string;
  sizeBytes: bigint;
  sha256: string | null;
  note: string;
}

export interface Plan {
  id: string;
  kind: SafeOpKind;
  summary: string;
  ops: PlannedOp[];
  totalBytes: bigint;
  warnings: string[];
  createdAt: string;
}

export interface ExecutionResult {
  operationId: string;
  succeeded: number;
  failed: number;
  warnings: string[];
}
