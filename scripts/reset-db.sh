#!/usr/bin/env bash
# DANGEROUS: wipes the local DB. The user's photos are NOT touched —
# this only resets Gallery Sort's index, thumbnails, trash, and op log.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

read -p "Wipe DB + thumbnails + trash? Your photo files are NOT touched. [y/N] " ok
[ "$ok" = "y" ] || { echo "aborted"; exit 0; }

rm -f prisma/dev.db prisma/dev.db-journal
HOME_DIR="${GALLERY_SORT_HOME:-$HOME/.gallery-sort}"
rm -rf "$HOME_DIR/thumbnails" "$HOME_DIR/trash"
pnpm prisma migrate reset --force
echo "Reset complete."
