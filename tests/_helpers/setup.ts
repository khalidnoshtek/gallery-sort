import { execSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync } from "node:fs";
import path from "node:path";
import os from "node:os";

export interface TestEnv {
  root: string;
  home: string;
  library: string;
  dbPath: string;
  cleanup: () => void;
}

const PROJECT_ROOT = path.resolve(__dirname, "../..");

export function setupTestEnv(): TestEnv {
  const root = mkdtempSync(path.join(os.tmpdir(), "gallery-sort-test-"));
  const home = path.join(root, "home");
  const library = path.join(root, "library");
  const dbPath = path.join(root, "test.db");
  mkdirSync(home, { recursive: true });
  mkdirSync(library, { recursive: true });

  process.env.GALLERY_SORT_HOME = home;
  process.env.DATABASE_URL = `file:${dbPath}`;
  process.env.LOG_LEVEL = "error";

  execSync(`node_modules/.bin/prisma db push --skip-generate --schema=prisma/schema.prisma`, {
    cwd: PROJECT_ROOT,
    env: { ...process.env, DATABASE_URL: `file:${dbPath}` },
    stdio: "pipe",
  });

  return {
    root,
    home,
    library,
    dbPath,
    cleanup: () => {
      try {
        rmSync(root, { recursive: true, force: true });
      } catch {}
    },
  };
}
