# Gallery Sort AI Sidecar

FastAPI service, loopback-only (127.0.0.1). Talks to the Node backend over HTTP with a per-machine bearer token.

## Phase 0 (this scaffold)

Stub endpoints that satisfy the contract so the Node side wires up cleanly:
- `POST /classify` → deterministic label + category + intent from filename hints
- `POST /embed` → 512-d stub vectors (sha256-derived, normalized)
- `POST /embed/text` → same shape, for queries
- `POST /ocr` → empty text
- `POST /quality` → mid-range scores
- `GET /health` → `{ ok, models, busy }`

## Phase 1 — real inference

Switch on by:
1. Uncommenting the ML deps in `requirements.txt`.
2. Updating each router's `*` function to call the real model.

Recommended models:
- **CLIP**: `open_clip` `ViT-B-32` `laion2b_s34b_b79k` — best CPU quality/size.
- **OCR**: `tesseract 5` via `pytesseract`. Preprocess with PIL (deskew + threshold).
- **Quality**: OpenCV `cv2.Laplacian(gray, cv2.CV_64F).var()` for blur; histogram split for exposure.

Models live under `~/.gallery-sort/models/`. They are downloaded once and never re-downloaded.

## Run standalone (debugging)

```bash
cd services/ai
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
.venv/bin/uvicorn main:app --host 127.0.0.1 --port 7860 --reload
```

The token is read from `$AI_SIDECAR_TOKEN` or `~/.gallery-sort/sidecar.token`. The Node side creates the token file on first launch.

## Security

- The server refuses any non-loopback client.
- The token is a 32-byte secret per machine, stored with `0600` permissions.
- The sidecar never opens outbound connections except for the one-time model download (Phase 1).
