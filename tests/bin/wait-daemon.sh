#!/usr/bin/env bash
# Wait for a lares daemon log to report a live wiki.
set -euo pipefail

LOG="${1:?usage: wait-daemon.sh LOG [WIKI] [SECONDS]}"
WIKI="${2:-scratch}"
SECONDS_MAX="${3:-30}"

printf '  waiting for live'
for _ in $(seq 1 "$SECONDS_MAX"); do
  if grep -qE "live — wiki: $WIKI" "$LOG" 2>/dev/null; then
    echo ' ✓'
    exit 0
  fi
  printf '.'
  sleep 1
done

echo ''
echo "daemon did not reach live state for wiki=$WIKI" >&2
tail -40 "$LOG" 2>/dev/null >&2 || true
exit 1
