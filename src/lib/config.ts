import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import fs from "node:fs";

const homeBase =
  process.env.GALLERY_SORT_HOME ?? path.join(os.homedir(), ".gallery-sort");

function ensureDir(p: string) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
  return p;
}

export const paths = {
  home: ensureDir(homeBase),
  thumbnails: ensureDir(path.join(homeBase, "thumbnails")),
  trash: ensureDir(path.join(homeBase, "trash")),
  logs: ensureDir(path.join(homeBase, "logs")),
  data: ensureDir(path.join(homeBase, "data")),
};

function readOrCreateToken(): string {
  if (process.env.AI_SIDECAR_TOKEN) return process.env.AI_SIDECAR_TOKEN;
  const tokenFile = path.join(paths.home, "sidecar.token");
  if (fs.existsSync(tokenFile)) return fs.readFileSync(tokenFile, "utf8").trim();
  const token = crypto.randomBytes(32).toString("hex");
  fs.writeFileSync(tokenFile, token, { mode: 0o600 });
  return token;
}

export const config = {
  paths,
  ai: {
    url: process.env.AI_SIDECAR_URL ?? "http://127.0.0.1:7860",
    token: readOrCreateToken(),
  },
  workers: {
    hashConcurrency: Number(process.env.WORKER_HASH_CONCURRENCY ?? 4),
    thumbConcurrency: Number(process.env.WORKER_THUMB_CONCURRENCY ?? 2),
    aiConcurrency: Number(process.env.WORKER_AI_CONCURRENCY ?? 1),
  },
  trash: {
    retentionDays: Number(process.env.TRASH_RETENTION_DAYS ?? 30),
  },
  telemetry: {
    enabled: process.env.TELEMETRY_OPT_IN === "1",
  },
  logLevel: process.env.LOG_LEVEL ?? "info",
} as const;

export type AppConfig = typeof config;
