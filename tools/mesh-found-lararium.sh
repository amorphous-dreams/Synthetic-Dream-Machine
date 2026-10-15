#!/usr/bin/env bash
# mesh-found-lararium — found an isolated Lararium through the product image.
# Usage: tools/mesh-found-lararium.sh <state-directory>
set -euo pipefail
DIR="${1:?usage: mesh-found-lararium.sh <dir>}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
case "$DIR" in /*) ;; *) DIR="$ROOT/$DIR" ;; esac
mkdir -p "$DIR"

# One product image, named by digest, serves every container of this run.
LARES_HARNESS_IMAGE="$(tools/harness-image.sh --resolve)" || exit $?
export LARES_HARNESS_IMAGE

docker run --rm --user "$(id -u):$(id -g)" --tmpfs /tmp:mode=1777 \
  --mount "type=bind,source=$DIR,target=/state" \
  --mount "type=bind,source=$ROOT/tools,target=/app/tools,readonly" \
  --env LAR_ROOT=/state --env LAR_STAGE_DIR=/state \
  --entrypoint sh "$LARES_HARNESS_IMAGE" -ec \
  'node tools/test-scratch-marker.mjs /state && node tools/seed-test-custody.mjs /state && node packages/lares-cli/dist/src/bin/lares.js vessel found --skip-build'

echo "[found] ✓ product image founded a Lararium at $DIR"
