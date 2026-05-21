# Gallery Sort

> Privacy-first, local-first AI photo manager. No cloud. No auto-destruction. Built for chaotic 10k–100k+ photo libraries on SSDs and external drives.

Gallery Sort is a desktop-first app that helps you organize a lifetime of photos and videos. It finds duplicates, scores image quality, classifies media (including **transactional / ephemeral** shots like receipts, parking-spot photos, and QR codes), and proposes cleanup actions — **never executing one without your explicit confirmation, and always with undo.**

Everything runs on your machine. Models, indexes, thumbnails, decisions — all local.

[![CI](https://github.com/khalidnoshtek/gallery-sort/actions/workflows/ci.yml/badge.svg)](https://github.com/khalidnoshtek/gallery-sort/actions/workflows/ci.yml)

---

## Quick start

```bash
# 1. Install Node deps
pnpm install

# 2. Initialize the local database
pnpm db:setup

# 3. (Optional) set up the Python AI sidecar
pnpm ai:setup

# 4. Run dev (Next.js + AI sidecar concurrently)
pnpm dev
#    or, app only (AI features degrade gracefully):
pnpm dev:next
```

Open [http://localhost:3000](http://localhost:3000), point it at a folder, and start scanning.

The AI sidecar is **optional**. Without it, the app still scans, deduplicates, generates thumbnails, and runs heuristic classification. AI-driven categorization, OCR, quality scoring, and semantic search require the sidecar.

---

## Tests

The smoke suite walks a generated fixture library through the full pipeline (scan → hash → thumbnail → dedup → trash → undo) in under 2 seconds.

```bash
pnpm test          # alias for test:smoke
pnpm test:smoke    # node:test runner via tsx
```

CI runs typecheck + smoke + Python syntax on every push and PR. See [.github/workflows/ci.yml](.github/workflows/ci.yml).

---

## Docker / self-host

For home-server or LAN deployment:

```bash
# Set the sidecar token (creates one if absent)
export AI_SIDECAR_TOKEN=$(cat ~/.gallery-sort/sidecar.token 2>/dev/null || openssl rand -hex 32)
echo "$AI_SIDECAR_TOKEN" > ~/.gallery-sort/sidecar.token

# Build and run
docker compose up --build
```

The compose file binds both services to `127.0.0.1` only. Mount your library read-only via the commented `volumes:` line in [docker-compose.yml](./docker-compose.yml).

Desktop-first users should run via `pnpm dev` — no Docker required. A Tauri-packaged desktop binary lands in Phase 3 ([ROADMAP.md](./ROADMAP.md)).

---

## Safety promise

**No code outside [`src/lib/safe-ops/`](src/lib/safe-ops/) is allowed to delete, rename, or overwrite files in your library.** Every destructive operation:

1. Generates a **dry-run plan** you preview.
2. Moves files to a versioned **trash** (default 30-day retention) — never `unlink`.
3. Writes an **operation log** entry with a recovery manifest.
4. Supports **one-click undo** with byte-perfect restoration (verified by smoke test).

If the app crashes mid-operation, the next launch replays the log to detect inconsistency.

---

## Privacy promise

- No network egress for any media file. Ever.
- The AI sidecar binds to `127.0.0.1` only (Docker mode is loopback-mapped).
- No telemetry by default. Opt-in only, and strictly aggregated.
- Models are downloaded once and run locally (CPU or local GPU/Metal).

---

## What's in Phase 0 (this scaffold)

- Recursive folder scanner with EXIF + dimensions
- SHA-256 + perceptual hash (dHash 64-bit) computation
- Thumbnail generation (256px / 1024px webp)
- Exact + near-duplicate grouping
- Heuristic + AI classification (incl. **TRANSACTIONAL/EPHEMERAL** category)
- Safe-ops layer: trash + operation log + one-click undo
- Job queue (SQLite-backed) + worker pool (piscina)
- Gallery view (virtualized for 100k+ items)
- Duplicates / Cleanup / History views
- Python AI sidecar (FastAPI) with stub inference contract
- Docker images for app + sidecar
- GitHub Actions CI: typecheck + smoke + Python syntax

See [ROADMAP.md](./ROADMAP.md) for Phases 1–6 (real CLIP/OCR, memory grouping, semantic search, Tauri desktop, Capacitor Android, face clustering).

---

## Project structure

```
src/
  app/         Next.js App Router (UI + API routes)
  lib/         Business logic
    scanner/     walker, EXIF, heuristic classifier
    hash/        SHA-256, dHash (BigInt round-trips via hex)
    thumbnails/  sharp-driven webp generation
    dedup/       exact + near (BK-tree style window pruning)
    safe-ops/    plan / execute / undo — the destructive-op contract
    queue/       DB-backed job queue + handler registry
    ai/          loopback HTTP client for the sidecar
    fs/          adapter for Tauri/Capacitor portability
  workers/     piscina CPU worker entry points
  components/  UI components (Shadcn + custom)
  state/       Zustand stores
prisma/        Database schema + migrations
services/ai/   Python FastAPI AI sidecar
tests/         End-to-end smoke suite
scripts/       Setup, reset
```

---

## Tech

Next.js 15 · TypeScript · Tailwind · Shadcn · Zustand · Prisma · SQLite (`better-sqlite3`) · sharp · piscina · pino · FastAPI · open_clip · OpenCV · Tesseract

Planned wrappers: Tauri (desktop) · Capacitor (Android).

---

## Documentation

- [ARCHITECTURE.md](./ARCHITECTURE.md) — system design, tech decisions, data model, safety contract, threat model
- [ROADMAP.md](./ROADMAP.md) — phased delivery plan
- [services/ai/README.md](./services/ai/README.md) — sidecar setup & API
