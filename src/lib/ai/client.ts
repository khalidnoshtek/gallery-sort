import { config } from "../config";
import { AiError } from "../errors";
import { logger } from "../logger";

// Loopback-only HTTP client for the Python AI sidecar.
// Gracefully degrades: if the sidecar is offline, returns null instead of
// throwing for non-critical calls so the rest of the pipeline keeps moving.

const HEADERS = {
  "Content-Type": "application/json",
  Authorization: `Bearer ${config.ai.token}`,
};

async function call<T>(pathName: string, body: unknown, opts: { timeoutMs?: number } = {}): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 30_000);
  try {
    const res = await fetch(`${config.ai.url}${pathName}`, {
      method: "POST",
      headers: HEADERS,
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    if (!res.ok) throw new AiError("AI_BAD_RESPONSE", `${pathName} → ${res.status}`);
    return (await res.json()) as T;
  } catch (err) {
    if (err instanceof AiError) throw err;
    if ((err as { name?: string }).name === "AbortError") throw new AiError("AI_TIMEOUT", `${pathName} timed out`);
    throw new AiError("AI_UNAVAILABLE", `${pathName}: ${String(err)}`, { cause: err });
  } finally {
    clearTimeout(timer);
  }
}

export async function aiHealth(): Promise<{ ok: boolean; busy?: boolean; models?: string[] }> {
  try {
    const res = await fetch(`${config.ai.url}/health`, { headers: HEADERS });
    if (!res.ok) return { ok: false };
    return (await res.json()) as { ok: boolean; busy?: boolean; models?: string[] };
  } catch (err) {
    logger.debug({ err: String(err) }, "ai sidecar unreachable");
    return { ok: false };
  }
}

export interface ClassifyRequest {
  items: Array<{ id: string; imagePath: string }>;
  labelSet?: string;
}

export interface ClassifyResponse {
  results: Array<{
    id: string;
    topLabel: string;
    topScore: number;
    tags: Array<{ label: string; score: number }>;
    category: string;
    intent: "KEEP_LONG_TERM" | "EPHEMERAL" | "UNKNOWN";
  }>;
}

export function aiClassify(req: ClassifyRequest): Promise<ClassifyResponse> {
  return call("/classify", req);
}

export interface EmbedRequest {
  items: Array<{ id: string; imagePath: string }>;
}

export interface EmbedResponse {
  model: string;
  dim: number;
  results: Array<{ id: string; vector: number[] }>;
}

export function aiEmbed(req: EmbedRequest): Promise<EmbedResponse> {
  return call("/embed", req);
}

export interface OcrRequest {
  items: Array<{ id: string; imagePath: string }>;
  language?: string;
}

export interface OcrResponse {
  results: Array<{ id: string; text: string; language: string | null; chars: number }>;
}

export function aiOcr(req: OcrRequest): Promise<OcrResponse> {
  return call("/ocr", req);
}

export interface QualityRequest {
  items: Array<{ id: string; imagePath: string }>;
}

export interface QualityResponse {
  results: Array<{
    id: string;
    blurScore: number;
    exposureScore: number;
    brightness: number;
    isBlurry: boolean;
    isDark: boolean;
    isOverexposed: boolean;
  }>;
}

export function aiQuality(req: QualityRequest): Promise<QualityResponse> {
  return call("/quality", req);
}

export interface TextEmbedRequest {
  query: string;
}

export interface TextEmbedResponse {
  model: string;
  dim: number;
  vector: number[];
}

export function aiTextEmbed(req: TextEmbedRequest): Promise<TextEmbedResponse> {
  return call("/embed/text", req);
}
