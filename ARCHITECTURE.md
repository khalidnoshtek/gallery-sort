# Gallery Sort — Architecture

> Privacy-first, local-first AI photo manager. No cloud. No auto-destruction. Built to scale to 100k+ images on consumer hardware.

---

## 1. Architectural pillars

Four pillars, in priority order. Every design decision must satisfy them in this order:

1. **Safety** — the user must never lose a file by accident. All destructive ops are reversible.
2. **Privacy** — zero network egress for media. Models run locally. Telemetry is opt-in and anonymized.
3. **Portability** — the same core logic runs in: dev browser (Next.js dev), packaged desktop (Tauri), and Android (Capacitor). FS and process access live behind adapters.
4. **Performance** — never block the UI thread. Heavy work is queued and parallelized. Indexing is incremental.

If two pillars conflict, the higher one wins. Example: a faster algorithm that requires uploading to a cloud GPU is rejected — privacy wins over performance.

---

## 2. System overview

```
┌──────────────────────────────────────────────────────────────────────┐
│                          CLIENT (Browser/Tauri)                       │
│  Next.js 15 App Router  ·  Shadcn/Tailwind  ·  Zustand  ·  Framer    │
│  Views: Gallery · Duplicates · Cleanup · Search · Timeline · Albums  │
└────────────────────────┬─────────────────────────────────────────────┘
                         │ HTTP (loopback only) / Tauri invoke
┌────────────────────────▼─────────────────────────────────────────────┐
│                      NODE BACKEND (Next API routes)                   │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────────┐ ┌──────────┐ │
│  │  Services   │  │  Repository  │  │  Safe-ops      │ │  Queue   │ │
│  │  (use-case) │  │  (Prisma)    │  │  trash/oplog   │ │  (DB)    │ │
│  └─────────────┘  └──────┬───────┘  └────────────────┘ └────┬─────┘ │
│                          │                                  │       │
│  ┌───────────────────────▼─────────┐   ┌────────────────────▼─────┐ │
│  │  SQLite (better-sqlite3)        │   │  Worker pool (piscina)   │ │
│  │  WAL mode · fts5 · vec ext      │   │  hash · thumb · scan     │ │
│  └─────────────────────────────────┘   └────────┬─────────────────┘ │
│                                                 │                   │
│  FS adapter (node) ─── EXIF (exiftool) ─── sharp (image ops)        │
└────────────────────────┬────────────────────────┴───────────────────┘
                         │ HTTP (loopback) — JSON + raw bytes
┌────────────────────────▼─────────────────────────────────────────────┐
│              PYTHON AI SIDECAR (FastAPI, localhost only)              │
│  CLIP embeddings · OCR (tesseract) · blur/exposure · zero-shot tags  │
│  open_clip · opencv · pytesseract · onnxruntime (CPU/Metal/CUDA)     │
└──────────────────────────────────────────────────────────────────────┘
```

Three processes by default: Next.js (UI + API), the worker pool (in-process via `piscina`), and the Python sidecar. The sidecar is optional — without it, the app degrades to heuristic-only classification and skips AI features rather than erroring.

---

## 3. Tech decisions, with reasoning

| Concern | Choice | Why this, not the alternatives |
| --- | --- | --- |
| UI framework | Next.js 15 (App Router) | RSC for fast initial paint of large libraries; same code base works in Tauri (`next export` static + Tauri shell). Better DX than raw Vite for this scope. |
| Styling | Tailwind + Shadcn | Shadcn = owned source, not a black-box dep. Critical for theming a media-heavy UI without bloat. |
| State | Zustand | Minimal boilerplate; no Provider; trivially mockable in workers. Redux/Jotai overkill here. |
| ORM | Prisma + SQLite | SQLite is the only sane local DB for a desktop app (single file, no daemon). Prisma gives types + migrations. **Driver: `better-sqlite3`** (sync, blazing fast, no async overhead per row — critical when iterating 100k rows). |
| Queue | Custom DB-backed job table + `piscina` worker pool | BullMQ requires Redis (violates "no daemon" rule). DB-backed jobs survive restarts and don't need extra services. `piscina` is the gold standard for CPU-bound Node work. |
| Image ops | `sharp` (libvips) | 10-30x faster than ImageMagick; native; SIMD. Thumbnails, pHash, resize all go through sharp. |
| EXIF | `exiftool-vendored` | Bundles the perl tool, supports every camera format, handles edge cases (HEIC, raw, sidecars). |
| Hashing | SHA-256 (exact) + dHash 64-bit (perceptual) | dHash beats aHash for resized/recompressed images and is cheaper than pHash. Implementation in pure sharp ops — no extra dep. |
| AI runtime | Python sidecar (FastAPI) | ONNX-in-Node exists but the ecosystem for CLIP/OCR/quality is Python-first. A loopback HTTP boundary is cheap and keeps the JS process responsive. Also makes the AI layer swappable (whisper, llama.cpp, etc.). |
| CLIP | `open_clip` ViT-B/32 (laion2b) | Best quality/size tradeoff for CPU. ONNX-exportable for the future. |
| OCR | Tesseract via `pytesseract` | Free, offline, multilingual. For receipts/IDs/whiteboards specifically. |
| Blur/exposure | OpenCV — variance of Laplacian + histogram | Cheap, deterministic, well-known. No model needed. |
| Virtualized grid | `@tanstack/react-virtual` | Renders 100k cells smoothly. Headless — works with any layout (masonry, square grid). |
| Logging | `pino` | Structured JSON logs, fast. Pretty-print in dev. |
| Process orchestration | `concurrently` in dev, `pm2` or Tauri-managed in prod | No K8s, no Docker required to *run* (only to develop the sidecar if user prefers). |
| Future desktop wrapper | Tauri 2 | Smaller binaries than Electron; Rust core; works with Next.js static export. |
| Future Android | Capacitor 6 | Better filesystem access than React Native for our use case. |

### Key non-choices (explicitly rejected)
- **No Electron** — heavy, slow startup, large binaries. Tauri wins.
- **No Redis/Postgres** — violates "no daemon" rule for a consumer app.
- **No remote AI** — privacy pillar.
- **No `fs-extra`** — modern node has everything we need; one less dep to audit.

---

## 4. Data model (SQLite via Prisma)

See `prisma/schema.prisma` for the source of truth. Conceptual overview:

```
Library             — one per scanned root (SSD/folder)
  └── MediaItem     — every file the scanner finds
        ├── MediaHash         (sha256, dhash64 — unique partial idx)
        ├── MediaExif         (extracted EXIF)
        ├── MediaQuality      (blur, exposure, score)
        ├── MediaClassification (category, intent, confidence, tags[])
        ├── MediaEmbedding    (CLIP vector — stored as BLOB, 512×float32)
        ├── MediaOcr          (full text, language)
        └── MediaThumbnail    (path on disk, size variant)

DuplicateGroup      — clusters of MediaItems linked by sha256 or dhash proximity
EventGroup          — time/location/visual clusters → trips, weddings, etc.
Album               — user-created collections
JobQueue            — durable jobs: { type, payload, status, attempts }
OperationLog        — every destructive action ever taken
TrashEntry          — soft-deleted items with restore path + manifest
Setting             — key/value app config
```

### MediaItem.category enum
`PHOTO | VIDEO | SCREENSHOT | MEME | DOCUMENT | RECEIPT | SELFIE | WHATSAPP_FORWARD | TRANSACTIONAL | OTHER`

`TRANSACTIONAL` is a first-class category for **photos captured for temporary use** — parking-spot reminders, whiteboard snapshots, QR codes shot to scan later, "I'll buy this later" product shelves, document/ID photos taken for a single transaction. These are surfaced prominently in the Cleanup view because their useful life is measured in days, not years.

### MediaItem.intent enum
`KEEP_LONG_TERM | EPHEMERAL | UNKNOWN`

Intent is orthogonal to category. A photo of a child *might* be transactional (shoe size for a return) or long-term (birthday). The classifier produces a confidence pair; the user can override and the override sticks (`user_intent_locked` flag).

### Indexes that matter
- `MediaHash(sha256) UNIQUE` — instant exact-dup detection
- `MediaHash(dhash64)` — sorted scan + hamming-window pass for near-dup
- `MediaItem(libraryId, takenAt)` — timeline view
- `MediaItem(category, intent)` — cleanup view
- SQLite `fts5` virtual table over filename + OCR text + classification tags — global search

---

## 5. Worker & job architecture

### Two layers
1. **Job queue (durable, DB-backed)** — coarse-grained, restart-survivable units of work: "scan this folder", "compute duplicates for library X". Lives in `JobQueue` table. State machine: `pending → running → done | failed | cancelled`. Each job has `attempts` and `last_error`.
2. **Worker pool (in-process, `piscina`)** — fine-grained, CPU-bound tasks: "hash this file", "make thumbnails for this batch". Not durable; if the process dies, the parent job re-enqueues.

### Job types (MVP)
- `scan.enumerate` — walk a path, insert MediaItem rows (no hashing yet)
- `scan.metadata` — batch EXIF + dimensions
- `hash.compute` — SHA-256 + dHash for a batch
- `thumb.generate` — produce 256px + 1024px webp thumbs
- `dedup.recompute` — rebuild DuplicateGroup table
- `ai.classify` — call sidecar `/classify` with thumbnails
- `ai.embed` — call sidecar `/embed`
- `ai.ocr` — call sidecar `/ocr` (only on candidates: screenshots, documents, transactional)
- `ai.quality` — call sidecar `/quality`

### Backpressure
- Job runner has a fixed concurrency per type (e.g. 4 hash workers, 2 thumb workers, 1 ai.* at a time).
- The sidecar exposes `/health` with a busy flag; AI jobs back off if it's saturated.
- The UI subscribes to a Server-Sent Events stream (`/api/jobs/stream`) for progress.

### Why not BullMQ?
BullMQ requires Redis. A consumer running this on a MacBook should not need to install Redis. A DB-backed queue using SQLite WAL mode handles our throughput trivially (<10k jobs/sec target, we need <100/sec).

---

## 6. Safety: the destructive-op contract

**No code outside `src/lib/safe-ops/` may call `fs.unlink`, `fs.rename`, `fs.rm`, `fs.cp` with `force`, or `sharp().toFile(originalPath)`.** This is enforced socially (PR review) and statically (an ESLint rule, see `eslint.config.mjs`).

### The contract
Every destructive action goes through this pipeline:

```
intent → plan (dry-run) → user confirms → execute → log → (optional) undo
```

1. **`plan(intent: Intent): Plan`** — pure function. Returns `{ ops: Op[], summary, warnings }`. Does not touch disk.
2. **UI renders the plan** — file list, byte savings, recovery info. User clicks Confirm.
3. **`execute(plan): OperationLogEntry`** — transactionally:
   - For each `op`, move target to `~/.gallery-sort/trash/<op-id>/<original-path-hash>/<filename>` (preserving relative path).
   - Write a recovery manifest: `{ from, to, sha256, timestamp }`.
   - Insert one `OperationLog` row with the full plan, the manifest, and a `signed_at` timestamp.
4. **`undo(opId): void`** — reads the manifest, moves files back, marks the OperationLog row as `undone`.
5. **Trash retention** — default 30 days, configurable. After retention, a background job *prompts the user* before purging.

There is no "skip dry-run" flag. Even bulk rename goes through plan → execute.

### Filesystem safety extras
- Refuse to operate on paths outside the configured Libraries (no `..` escape).
- Refuse to operate on paths inside `~/.gallery-sort/`.
- Cross-filesystem moves use copy+verify+delete, not atomic rename.

---

## 7. Folder structure

```
gallery-sort/
├── ARCHITECTURE.md           ← you are here
├── ROADMAP.md
├── README.md
├── package.json
├── tsconfig.json
├── next.config.ts
├── tailwind.config.ts
├── postcss.config.mjs
├── eslint.config.mjs
├── components.json           ← shadcn config
├── .env.example
├── .nvmrc
├── .gitignore
├── prisma/
│   ├── schema.prisma
│   └── migrations/
├── scripts/
│   ├── setup.sh              ← one-shot install
│   ├── dev.sh                ← run Next + sidecar concurrently
│   └── reset-db.sh
├── services/
│   └── ai/                   ← Python FastAPI sidecar
│       ├── pyproject.toml
│       ├── main.py
│       ├── routers/
│       │   ├── embed.py
│       │   ├── classify.py
│       │   ├── ocr.py
│       │   └── quality.py
│       └── README.md
└── src/
    ├── app/                  ← Next.js App Router
    │   ├── layout.tsx
    │   ├── page.tsx          ← dashboard
    │   ├── library/page.tsx  ← gallery
    │   ├── duplicates/page.tsx
    │   ├── cleanup/page.tsx
    │   ├── search/page.tsx
    │   ├── operations/page.tsx
    │   └── api/
    │       ├── scan/route.ts
    │       ├── media/route.ts
    │       ├── media/[id]/thumbnail/route.ts
    │       ├── duplicates/route.ts
    │       ├── ops/route.ts
    │       ├── ops/[id]/undo/route.ts
    │       ├── jobs/stream/route.ts
    │       └── trash/[id]/restore/route.ts
    ├── components/
    │   ├── ui/               ← shadcn primitives
    │   ├── layout/
    │   └── gallery/
    ├── lib/
    │   ├── db/               ← Prisma client singleton
    │   ├── fs/               ← FS adapter (Tauri-ready)
    │   ├── scanner/          ← walker, EXIF, heuristic classifier
    │   ├── hash/             ← sha256, dhash, hamming
    │   ├── thumbnails/
    │   ├── dedup/
    │   ├── safe-ops/         ← THE ONLY PLACE THAT TOUCHES DESTRUCTIVELY
    │   ├── queue/            ← DB job queue + piscina pool
    │   ├── ai/               ← sidecar HTTP client
    │   ├── search/           ← fts5 + vector
    │   ├── config.ts
    │   ├── logger.ts
    │   └── errors.ts
    ├── workers/              ← piscina worker entry points
    │   ├── hash.worker.ts
    │   └── thumbnail.worker.ts
    └── state/                ← Zustand stores
        ├── scan-store.ts
        └── selection-store.ts
```

---

## 8. Duplicate detection pipeline

Three tiers, run in order, each cheaper to compute than the next is expensive:

1. **Exact (SHA-256)** — `GROUP BY sha256 HAVING COUNT(*) > 1`. 100% confidence. Zero false positives. Runs in <1s for 100k rows.
2. **Visual near-dup (dHash + Hamming distance ≤ 6)** — finds resized, recompressed, cropped-slightly versions. Uses BK-tree built once in memory (cheap for 100k 64-bit hashes), queried per row.
3. **Semantic similar (CLIP cosine ≥ 0.92)** — finds "5 photos of the same subject, different angles". Only runs after embeddings are computed. Used for "burst shot dedup" and "keep best of N".

### Group → keep recommendation
The "recommended keep" file scores by:
- resolution (higher = better)
- file size (larger = better, all else equal — proxies for less compression)
- EXIF presence (originals usually have it; copies often don't)
- aesthetic score from quality model (if available)
- path depth (originals near `DCIM/` beat files in `Sent/` or `WhatsApp/`)

Returns a confidence-weighted recommendation. **The user must confirm.** No auto-delete.

---

## 9. Classification & "transactional" detection

Heuristic layer (fast, deterministic, runs at scan time):

| Signal | Inference |
| --- | --- |
| Filename matches `Screenshot_*`, `Screen Shot *` | category=SCREENSHOT |
| Path contains `WhatsApp/Media` | category=WHATSAPP_FORWARD (often) |
| Path contains `DCIM/Camera` and EXIF has Make/Model | category=PHOTO, intent=KEEP_LONG_TERM (default) |
| Filename matches `IMG_*` with no EXIF | category=PHOTO, intent=UNKNOWN |
| Aspect ratio matches device screen | screenshot signal |
| Front-camera EXIF | selfie signal |
| Video > 60s of static frames | likely accidental record |

AI layer (Python sidecar, slow, runs in background):

- **CLIP zero-shot** against a curated label set: `["a screenshot of a chat message", "a photo of a receipt", "a parking lot ticket", "a whiteboard with handwriting", "a QR code", "a national ID card", "a product on a store shelf", "a wedding photo", "a beach landscape", "food on a plate", "a pet", "a meme image", ...]`. Top-1 label seeds the category.
- **OCR** runs *only* when CLIP suggests a text-heavy class. If OCR text matches receipt patterns (TOTAL, GST, amounts), category=RECEIPT, intent=EPHEMERAL.
- **Intent inference**:
  - `EPHEMERAL` if category ∈ {RECEIPT, TRANSACTIONAL, SCREENSHOT-of-QR, SCREENSHOT-of-confirmation}
  - `KEEP_LONG_TERM` if category ∈ {PHOTO with people-faces, MEMORY-event}, or `is_favorite`, or part of an EventGroup with >5 photos
  - `UNKNOWN` otherwise

Label confidence < threshold → category=OTHER, intent=UNKNOWN. The UI surfaces these in a "Help us classify" section for low-friction manual labelling.

---

## 10. AI rename (designed, deferred for MVP)

Template-driven. Templates use tokens resolved from MediaItem fields:

```
{date:YYYY-MM-DD}-{event|location|subject}-{seq}.{ext}
```

Resolution sources:
- `date` — EXIF DateTimeOriginal → falls back to file mtime
- `location` — reverse-geocoded from GPS (offline reverse geocoder, e.g. `node-geonames`)
- `event` — EventGroup label
- `subject` — top CLIP label or OCR-derived (e.g. receipt vendor)

Pre-execution: **always** runs through dry-run with a collision-resolution preview. Renames go through the safe-ops trash-and-rename pattern so undo works.

---

## 11. Memory / event grouping (designed, deferred for MVP)

Tier 1: **time-clustering** — DBSCAN over `takenAt` with eps=12h; clusters of ≥3 photos become events.

Tier 2: **location-refinement** — split a time cluster if median GPS distance > 50km; merge two clusters if they're <2 days apart and same city.

Tier 3: **visual-coherence** — drop outliers whose CLIP embedding cosine to the cluster centroid is <0.5.

Naming: take the top-3 CLIP labels in the cluster + the city name + the date range.

---

## 12. Search

Two parallel indexes:

- **Lexical (SQLite fts5)** — filename, OCR text, classification tags. Powers "passport", "boarding pass", "receipt total".
- **Semantic (CLIP embeddings, cosine)** — powers "beach sunset", "food in pune", "bike ride". Stored as BLOB; brute-force scan with SIMD for <50k items, or `sqlite-vec` extension for larger libraries.

Both run in parallel; results are reciprocal-rank-fused. The UI shows a single ranked list.

---

## 13. Performance posture for 100k+ libraries

- **No `await fs.stat` in a `for` loop.** All filesystem enumeration uses `readdir` with `withFileTypes` and batches stat calls.
- **`better-sqlite3` for hot paths.** Prisma for migrations/typed access; raw `better-sqlite3` for batch inserts during scan (Prisma's per-row async cost is real at 100k).
- **Thumbnails are streamed, not buffered.** `sharp(input).resize(...).webp().pipe(writeStream)`.
- **Thumbnail cache by content hash, not file path.** Renaming a file doesn't invalidate its thumbnail.
- **Virtualized grid + intersection observer.** Only visible cells fetch thumbnails. Thumbnail requests are de-duplicated client-side.
- **Indexed pagination, never `OFFSET`.** Cursor-based: `WHERE id > :lastId LIMIT 200`.
- **PRAGMAs at boot:** `journal_mode=WAL`, `synchronous=NORMAL`, `temp_store=MEMORY`, `mmap_size=268435456`, `cache_size=-65536`.
- **Job batches.** Hash 50 files per job, not 1, to amortize worker spin-up.

Target on an M2 MacBook Air with SSD library:
- Initial scan + EXIF + hash + thumbs: **~5,000 items/min**
- Duplicate detection (post-hash): **<3s for 100k items**
- AI classification: **~300 items/min** (CPU-only CLIP ViT-B/32)
- UI gallery scroll: **60fps** with 100k items

---

## 14. Portability strategy (Tauri + Capacitor)

Everything that touches the OS goes through one of three adapters:

| Concern | Interface | Node impl | Tauri impl | Capacitor impl |
| --- | --- | --- | --- | --- |
| Filesystem | `FsAdapter` | `node:fs/promises` | `@tauri-apps/plugin-fs` | `@capacitor/filesystem` |
| Native dialogs | `DialogAdapter` | (web `<input>`) | `@tauri-apps/plugin-dialog` | `@capacitor/dialog` + custom picker |
| Shell exec | `ProcAdapter` | `child_process` | `@tauri-apps/plugin-shell` | (no-op; sidecar runs as separate binary) |

UI code imports the adapter via `lib/fs` — at runtime, the entry point picks the impl based on `process.env.PLATFORM` (`node` | `tauri` | `capacitor`). All business logic is platform-agnostic.

For Tauri: `next export` → static bundle → loaded by the Tauri webview. API routes get replaced by Tauri commands (Rust ↔ TS via `invoke`). The job queue & SQLite live in the Rust side, accessed via SQL commands or a Rust-side Prisma equivalent (Diesel).

For Capacitor (Android): same static bundle. The Python sidecar is replaced by an on-device ONNX runtime (`onnxruntime-android`). The CLIP model and tesseract data ship as app assets.

This is why the architecture rejects: `child_process` outside `lib/fs`, dynamic SQL outside repos, and any direct `window`/`document` access in non-UI code.

---

## 15. Logging, errors, observability

- **`pino` for structured logs**, JSON to stdout in prod, pretty in dev. One log per significant op with `{ jobId, mediaId, durationMs }`.
- **Typed errors.** `AppError` base with subtypes: `FsError`, `DbError`, `AiError`, `SafetyError`. Each carries a stable `code` for UI messaging.
- **Sentry, optional, off by default.** If enabled, scrubs all file paths (replaces with `<library>/<filename hash>`).
- **No telemetry by default.** Opt-in. Strictly aggregated (counts of operations, never file content).

---

## 16. Threat model (brief)

| Threat | Mitigation |
| --- | --- |
| Malicious image (libpng/libvips RCE) | `sharp` is sandboxed in a worker, kept up to date. Scanner timeouts per file. |
| Path traversal | Refuse paths outside configured Libraries. Refuse symlinks crossing library boundary. |
| Disk full during op | Pre-flight check; fail before any move. |
| Power loss mid-op | All destructive ops are write-ahead logged in OperationLog before disk move. On restart, replay the log to detect inconsistency. |
| Sidecar compromised | Sidecar runs on `127.0.0.1` only, with a per-launch shared secret in `Authorization` header. |
| User runs as root | Detect and warn; refuse `--allow-root` unless flagged. |

---

## 17. Out of scope (today)

- Cloud sync. Will be opt-in, E2E-encrypted, in a much later phase.
- Multi-user. Single-user desktop app.
- Editing photos. We sort, we don't edit.
- Mobile-first UX. Desktop-first; mobile is a port, not the primary target.
