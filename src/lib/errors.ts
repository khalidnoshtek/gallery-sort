export type ErrorCode =
  | "FS_NOT_FOUND"
  | "FS_PERMISSION"
  | "FS_TRAVERSAL"
  | "FS_CROSS_LIBRARY"
  | "DB_QUERY"
  | "DB_CONSTRAINT"
  | "AI_UNAVAILABLE"
  | "AI_TIMEOUT"
  | "AI_BAD_RESPONSE"
  | "SAFETY_VIOLATION"
  | "JOB_FAILED"
  | "INVALID_INPUT";

export class AppError extends Error {
  readonly code: ErrorCode;
  override readonly cause?: unknown;
  readonly details?: Record<string, unknown>;

  constructor(code: ErrorCode, message: string, opts?: { cause?: unknown; details?: Record<string, unknown> }) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.cause = opts?.cause;
    this.details = opts?.details;
  }
}

export class FsError extends AppError {
  constructor(code: Extract<ErrorCode, `FS_${string}`>, message: string, opts?: ConstructorParameters<typeof AppError>[2]) {
    super(code, message, opts);
    this.name = "FsError";
  }
}

export class SafetyError extends AppError {
  constructor(message: string, opts?: ConstructorParameters<typeof AppError>[2]) {
    super("SAFETY_VIOLATION", message, opts);
    this.name = "SafetyError";
  }
}

export class AiError extends AppError {
  constructor(code: Extract<ErrorCode, `AI_${string}`>, message: string, opts?: ConstructorParameters<typeof AppError>[2]) {
    super(code, message, opts);
    this.name = "AiError";
  }
}
