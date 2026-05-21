# Gallery Sort — Roadmap

Phased delivery. Each phase is shippable. We do not start phase N+1 until phase N's "Definition of Done" is met.

---

## Phase 0 — Foundation (this scaffold)
**Goal:** A developer can `pnpm i && pnpm dev`, scan a folder, see thumbnails, find exact duplicates, and undo a delete.

Included (in this initial scaffold):
- Project scaffold (Next.js 15, TS, Tailwind, Shadcn)
- Prisma schema covering MVP + future hooks
- DB-backed job queue + piscina worker pool
- Folder scanner (recursive, batched)
- EXIF + dimensions extraction
- SHA-256 + dHash computation
- Thumbnail generation (256px, 1024px webp)
- Heuristic classifier (filename/path patterns)
- Exact-duplicate grouping
- Safe-ops layer: trash + operation log + undo
- Gallery view (virtualized)
- Duplicates view (group cards)
- Cleanup dashboard (counts + storage savings)
- Python AI sidecar skeleton (stub endpoints)
- Setup scripts, env, README

**Definition of Done:** scan a folder of 10k images on an M-series Mac in <3 min; duplicates show; delete-with-undo works; nothing in the user's library is touched without an OperationLog row.

---

## Phase 1 — MVP (4-6 weeks of focused work)
**Goal:** First usable product. Real cleanup value on real libraries.

- [ ] AI classification (wire up CLIP zero-shot)
- [ ] Transactional / ephemeral detection (CLIP + OCR for receipts, QR codes, whiteboards)
- [ ] Blur / exposure quality scoring (Laplacian + histogram via sidecar)
- [ ] Near-duplicate grouping via dHash + BK-tree
- [ ] "Keep best" recommendation engine
- [ ] Cleanup dashboard with real recommendations and storage projections
- [ ] Dry-run preview UI for every destructive action
- [ ] Trash view + restore UI
- [ ] Operation history view + one-click rollback
- [ ] Settings: library management, trash retention, AI on/off
- [ ] Polish: dark mode, keyboard shortcuts, drag-select, animations

**Definition of Done:** A user with a chaotic 30k-image library can, in <30 min, recover >10GB of storage with high confidence and zero data loss.

---

## Phase 2 — Search & memories
**Goal:** Find anything. Relive any moment.

- [ ] Global search: lexical (fts5) + semantic (CLIP) with RRF
- [ ] OCR over screenshots, documents, receipts
- [ ] Event/memory clustering (time + location + visual)
- [ ] Timeline view
- [ ] Auto-generated albums
- [ ] Map view (offline tiles)
- [ ] AI rename with template editor + collision preview

**Definition of Done:** "beach sunset" returns relevant photos in <500ms on a 50k-item library. Trips auto-group with >80% precision on user evaluation.

---

## Phase 3 — Desktop packaging (Tauri)
**Goal:** A real app, double-click to launch.

- [ ] FS adapter Tauri impl
- [ ] Sidecar shipped as bundled binary (PyInstaller or Rust port of critical paths)
- [ ] Code signing (macOS, Windows)
- [ ] Auto-updates (Tauri updater)
- [ ] Native dialogs / drag-drop
- [ ] System tray for background scanning
- [ ] First-run onboarding

**Definition of Done:** A non-technical user installs the .dmg, picks a folder, and is in the gallery within 60 seconds.

---

## Phase 4 — People & places
**Goal:** The hard AI features. Privately.

- [ ] Face detection (RetinaFace or similar, ONNX, local)
- [ ] Face clustering (no remote PII)
- [ ] Person album creation
- [ ] User-applied person labels
- [ ] Reverse geocoding (offline)
- [ ] Object/scene tagging exposed in UI
- [ ] AI chat with photos ("show me selfies from Goa in 2024")

**Definition of Done:** Face clustering achieves >90% recall, >85% precision on a 5k-photo family library. Zero data leaves the device.

---

## Phase 5 — Android (Capacitor)
**Goal:** Phone-first sort.

- [ ] Capacitor shell + filesystem adapter
- [ ] ONNX runtime (mobile) for CLIP + quality models
- [ ] Camera roll integration
- [ ] Background scan service (Android)
- [ ] LAN pairing with desktop instance
- [ ] Differential sync (no central server)

---

## Phase 6 — Advanced
- [ ] Encrypted vault (private albums behind a passphrase)
- [ ] AI slideshow / highlight reel generator
- [ ] Voice search ("hey, show me photos from last summer")
- [ ] Plug-in surface for community classifiers (e.g. medical scans, sports analysis)
- [ ] Optional opt-in cloud backup (E2E encrypted, user holds keys)

---

## Future: monetization (when product is loved, not before)

1. **Free tier** — full local features for libraries up to N items.
2. **One-time license** — unlimited library size, lifetime updates. *(Preferred — single payment respects privacy ethos.)*
3. **Pro features** — AI rename templates, slideshow generator, encrypted vault, voice search.
4. **Family pack** — license for up to 5 devices.
5. **Optional cloud backup add-on** — pay for storage; E2EE; user holds the keys.

Explicitly rejected: ads, data sale, subscription fatigue. The product's premise is "your photos are yours" — the monetization must reinforce that.
