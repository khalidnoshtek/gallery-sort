#!/usr/bin/env bash
# Build the static Pages demo. Idempotent.
#
# What it does:
#   1. Removes the API directory (static export can't have route handlers)
#   2. Rewrites `dynamic = "force-dynamic"` → `"force-static"` in pages
#   3. Generates the demo fixture thumbnails into public/demo/thumbs/
#   4. Runs `next build` with NEXT_OUTPUT_EXPORT=1
#   5. Restores the API directory and undoes the sed
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

BASE_PATH="${NEXT_PUBLIC_BASE_PATH:-/gallery-sort}"
BACKUP_DIR="$(mktemp -d)"

cleanup() {
  if [ -d "$BACKUP_DIR/api" ] && [ ! -d src/app/api ]; then
    mv "$BACKUP_DIR/api" src/app/api
  fi
  # Revert the sed
  find src/app -name "page.tsx" -exec sed -i.bak 's/dynamic = "force-static"/dynamic = "force-dynamic"/g' {} \; 2>/dev/null || true
  find src/app -name "*.bak" -delete 2>/dev/null || true
  rm -rf "$BACKUP_DIR"
}
trap cleanup EXIT

echo "→ Generating demo fixture thumbnails…"
node scripts/build-demo-fixtures.mjs

echo "→ Stashing src/app/api…"
mv src/app/api "$BACKUP_DIR/api"

echo "→ Rewriting page dynamic config for static export…"
find src/app -name "page.tsx" -exec sed -i.bak 's/dynamic = "force-dynamic"/dynamic = "force-static"/g' {} \;
find src/app -name "*.bak" -delete

echo "→ Building static export (NEXT_PUBLIC_BASE_PATH=$BASE_PATH)…"
NEXT_OUTPUT_EXPORT=1 \
NEXT_PUBLIC_DEMO=1 \
NEXT_PUBLIC_BASE_PATH="$BASE_PATH" \
NEXT_TELEMETRY_DISABLED=1 \
  node_modules/.bin/next build

# Pages serves from a path-prefixed location. Next will have placed the
# static files into out/ — that's the deploy artifact.
echo "→ Done. Static site at out/"
ls -la out/ | head -10

# GitHub Pages requires a .nojekyll to serve _next/ assets.
touch out/.nojekyll
