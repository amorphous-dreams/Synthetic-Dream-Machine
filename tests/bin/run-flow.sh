#!/usr/bin/env bash
# Top-level flow runner for isolated integration ceremonies.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$REPO_ROOT"

FLOW="${1:-all}"
export LAR_ROOT="${LAR_ROOT:-$REPO_ROOT/tests}"

case "$FLOW" in
  all|tw5|tw5-sync)
    bash tests/lararium-tw5/sync/sync-decompose-promote.sh both
    ;;
  tw5-decompose)
    bash tests/lararium-tw5/sync/sync-decompose-promote.sh decompose
    ;;
  tw5-promote)
    bash tests/lararium-tw5/sync/sync-decompose-promote.sh promote
    ;;
  clean)
    bash tests/bin/cleanup-lar-root.sh
    ;;
  *)
    cat >&2 <<USAGE
Unknown flow: $FLOW

Usage:
  tests/bin/run-flow.sh all
  tests/bin/run-flow.sh tw5-decompose
  tests/bin/run-flow.sh tw5-promote
  tests/bin/run-flow.sh clean
USAGE
    exit 2
    ;;
esac
