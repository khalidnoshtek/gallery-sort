#!/usr/bin/env bash
# Gallery Sort — one-shot dev setup.
# Idempotent. Re-run any time.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

cyan() { printf "\033[36m%s\033[0m\n" "$*"; }
green() { printf "\033[32m%s\033[0m\n" "$*"; }
warn() { printf "\033[33m%s\033[0m\n" "$*"; }

# ── prerequisites ─────────────────────────────────────────────────────
command -v node >/dev/null || { echo "Node.js >= 20 required."; exit 1; }
command -v pnpm >/dev/null || { echo "pnpm required (npm i -g pnpm)."; exit 1; }
command -v python3 >/dev/null || warn "python3 missing — sidecar will not run, but core app will."

# ── env ───────────────────────────────────────────────────────────────
if [ ! -f .env ]; then
  cp .env.example .env
  green "Created .env from .env.example"
fi

# ── node deps ─────────────────────────────────────────────────────────
cyan "Installing Node deps…"
pnpm install

# ── prisma ────────────────────────────────────────────────────────────
cyan "Generating Prisma client + migrating DB…"
pnpm prisma generate
pnpm prisma migrate dev --name init || pnpm prisma db push

# ── python sidecar ────────────────────────────────────────────────────
if command -v python3 >/dev/null; then
  cyan "Setting up Python sidecar venv…"
  cd services/ai
  python3 -m venv .venv
  .venv/bin/pip install --quiet --upgrade pip
  .venv/bin/pip install --quiet -r requirements.txt
  cd "$ROOT"
  green "Sidecar ready."
fi

green "Done. Run: pnpm dev"
