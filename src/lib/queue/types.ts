export type JobType =
  | "scan.enumerate"
  | "scan.metadata"
  | "hash.compute"
  | "thumb.generate"
  | "dedup.recompute"
  | "ai.classify"
  | "ai.embed"
  | "ai.ocr"
  | "ai.quality";

export interface JobHandlerCtx {
  jobId: string;
  signal: AbortSignal;
}

export type JobHandler<T = unknown> = (payload: T, ctx: JobHandlerCtx) => Promise<void>;
