// Side-effect import — registers handlers and (optionally) starts the runner.
// Imported by API routes that need the queue alive.

import "../fs"; // ensure FS adapter is bound first
import "./handlers";
import { startRunner } from "./queue";
import { config } from "../config";

let _started = false;
export function ensureRunnerStarted() {
  if (_started) return;
  _started = true;
  startRunner({ concurrency: Math.max(config.workers.hashConcurrency, 4) });
}
