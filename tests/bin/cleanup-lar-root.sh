#!/usr/bin/env bash
# Clean the isolated test lararium root. Never use this against the repo root.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
LAR_ROOT="${LAR_ROOT:-$REPO_ROOT/tests}"

if [[ "$LAR_ROOT" == "$REPO_ROOT" || "$LAR_ROOT" == "/" || -z "$LAR_ROOT" ]]; then
  echo "Refusing unsafe LAR_ROOT: $LAR_ROOT" >&2
  exit 2
fi

mkdir -p "$LAR_ROOT"
rm -rf "$LAR_ROOT/.lararium" "$LAR_ROOT/wikis" "$LAR_ROOT/packages" "$LAR_ROOT/results"
mkdir -p "$LAR_ROOT/results"
