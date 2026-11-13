#!/usr/bin/env bash
# seed-census-witness — exact place seed, renamed handoff, and public place-key receipts in packages/*/src.
set -uo pipefail
cd "$(dirname "$0")/.."
node tools/seed-census.mjs
