#!/usr/bin/env bash
# engine-retention-witness — the automerge engine this workspace pins lets a loaded document's buffers go, and it writes
# the stock engine's bytes.
#
# ── WHY A WITNESS ───────────────────────────────────────────────────────────────────────────────
# The workspace runs ONE automerge engine for node, browser and keyhive (the override in pnpm-workspace.yaml), and that
# override names a vendored build carrying a one-line fix to the upstream engine (third-party/automerge/README.md). A lock
# regenerated against the npm registry, or an override edited back by hand, would hand every vessel the stock engine
# again, and nothing in a suite would say so until a loaded canon document climbed past a gigabyte of wasm memory.
# This reads the pin, its sha256, the retention and the byte format through the engine the workspace actually resolves
# (tools/engine-retention-witness.mjs).
#
# Usage:  tools/engine-retention-witness.sh          (exits non-zero on any reading at fault)
set -uo pipefail
cd "$(dirname "$0")/.." || exit 1
exec node tools/engine-retention-witness.mjs "$@"
