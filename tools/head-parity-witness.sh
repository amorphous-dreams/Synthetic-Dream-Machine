#!/usr/bin/env bash
# head-parity-witness — the shore's reading answers to TiddlyWiki's own parse tree.
set -uo pipefail
cd "$(dirname "$0")/.."
REPO="$PWD" node tools/head-parity.mjs
