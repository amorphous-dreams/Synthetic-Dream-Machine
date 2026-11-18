#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
scratch="$(mktemp -d "${TMPDIR:-/tmp}/lares-dogfood-proof.XXXXXX")"
trap 'rm -rf "$scratch"' EXIT
mkdir -p "$scratch/home" "$scratch/stages" "$scratch/root"
export HOME="$scratch/home"
export LAR_ROOT="$scratch/root"
export LAR_STAGE_DIR="$scratch/stages"

cd "$repo_root"
pnpm --filter @lares/harness exec vitest run --config vitest.config.ts \
  e2e/kahua-founding-stage.test.ts \
  e2e/dogfood-memory-restand.test.ts \
  e2e/mcp-seat-binds-the-hearth.test.ts \
  e2e/outbound-bridge.e2e.test.ts

node --test tools/compose-surface-root.test.mjs tools/lares-container.test.mjs tools/container-founding-seat.test.mjs
