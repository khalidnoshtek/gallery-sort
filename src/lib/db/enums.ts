// "Enum-like" string literal types. SQLite doesn't support native enums in
// Prisma, so we enforce values with TS literal unions instead. Keep these
// in sync with prisma/schema.prisma (the schema documents the same set in
// comments above each affected column).

export const MEDIA_KINDS = ["IMAGE", "VIDEO", "UNKNOWN"] as const;
export type MediaKind = (typeof MEDIA_KINDS)[number];

export const MEDIA_CATEGORIES = [
  "PHOTO",
  "VIDEO",
  "SCREENSHOT",
  "MEME",
  "DOCUMENT",
  "RECEIPT",
  "SELFIE",
  "WHATSAPP_FORWARD",
  "TRANSACTIONAL",
  "OTHER",
] as const;
export type MediaCategory = (typeof MEDIA_CATEGORIES)[number];

export const MEDIA_INTENTS = ["KEEP_LONG_TERM", "EPHEMERAL", "UNKNOWN"] as const;
export type MediaIntent = (typeof MEDIA_INTENTS)[number];

export const DUPLICATE_KINDS = ["EXACT", "NEAR", "SIMILAR"] as const;
export type DuplicateKind = (typeof DUPLICATE_KINDS)[number];

export const JOB_STATUSES = ["PENDING", "RUNNING", "DONE", "FAILED", "CANCELLED"] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];

export const OPERATION_KINDS = ["TRASH", "RENAME", "MOVE", "RESTORE", "PURGE_TRASH"] as const;
export type OperationKind = (typeof OPERATION_KINDS)[number];

export const OPERATION_STATUSES = [
  "PLANNED",
  "EXECUTING",
  "COMPLETED",
  "PARTIAL",
  "FAILED",
  "UNDONE",
] as const;
export type OperationStatus = (typeof OPERATION_STATUSES)[number];
