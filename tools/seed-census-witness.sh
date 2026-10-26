#!/usr/bin/env bash
# seed-census-witness — exact raw vessel seed consumers and K15 debts in packages/*/src.
set -uo pipefail
cd "$(dirname "$0")/.."
node tools/seed-census.mjs
