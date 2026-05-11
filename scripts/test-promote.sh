#!/usr/bin/env bash
# test-promote.sh — full reset + sync + promote test cycle for the-lares-protocols.
# Usage: ./scripts/test-promote.sh [--wiki TestWiki]

set -euo pipefail
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WIKI="${1:-TestWiki}"

cd "$REPO_ROOT"

echo "=== build ==="
pnpm --filter @lararium/tw5 run build:plugin
pnpm -r build

echo "=== kill any running daemon ==="
pkill -9 -f "tsx.*main.ts" 2>/dev/null || true
fuser -k 8080/tcp 2>/dev/null || true
sleep 1

echo "=== lares reset ==="
node_modules/.bin/lares reset --force

echo "=== copy test meme into wikis/$WIKI ==="
mkdir -p "wikis/$WIKI/memes/docs/lares"
cp the-lares-protocols.md "wikis/$WIKI/memes/docs/lares/the-lares-protocols.md"

echo "=== start daemon (wiki: $WIKI) ==="
LOGFILE="/tmp/lares-test-promote.log"
node_modules/.bin/lares serve --wiki "$WIKI" > "$LOGFILE" 2>&1 &
DAEMON_PID=$!
echo "daemon PID: $DAEMON_PID  log: $LOGFILE"

# Wait for daemon to reach live
for i in $(seq 1 20); do
  sleep 1
  grep -q "live — wiki: $WIKI" "$LOGFILE" 2>/dev/null && break
  echo -n "."
done
echo ""
grep "live — wiki" "$LOGFILE" || { echo "ERROR: daemon did not start"; kill $DAEMON_PID; exit 1; }

echo "=== lares wiki sync $WIKI ==="
node_modules/.bin/lares wiki sync "$WIKI"

echo "=== lares promote ==="
node_modules/.bin/lares promote lar:///ha.ka.ba/docs/lares/the-lares-protocols \
  --to lar:///ha.ka.ba/@lares --yes

echo "=== waiting for disk projector ==="
sleep 4

PARENT="packages/lares/memes/docs/lares/the-lares-protocols.md"
CHILD_DIR="packages/lares/memes/docs/lares/the-lares-protocols"

echo ""
echo "=== verify parent ==="
if [ -f "$PARENT" ]; then
  echo "parent exists ✓"
  # Check iam fences
  LINE4="$(sed -n '4p' "$PARENT")"
  if echo "$LINE4" | grep -q '```toml iam'; then
    echo "iam fences (triple backtick) ✓"
  else
    echo "FAIL: iam fences broken — line 4: $LINE4"
  fi
  # Check prologue
  LINE1="$(head -1 "$PARENT")"
  if echo "$LINE1" | grep -q '!DOCTYPE'; then
    echo "prologue ✓"
  else
    echo "FAIL: prologue missing — line 1: $LINE1"
  fi
else
  echo "FAIL: parent not found"
fi

echo ""
echo "=== verify children ==="
PASS=0; FAIL=0
for f in "$CHILD_DIR"/*.md; do
  [ -f "$f" ] || continue
  FNAME="$(basename "$f")"
  FIRSTLINE="$(head -1 "$f")"
  if echo "$FIRSTLINE" | grep -q '!DOCTYPE'; then
    echo "  $FNAME prologue ✓"
    PASS=$((PASS+1))
  else
    echo "  $FNAME FAIL — first line: $FIRSTLINE"
    FAIL=$((FAIL+1))
  fi
done
echo "  children: $PASS pass, $FAIL fail"

echo ""
echo "=== verify wiki files cleaned (stale mirror) ==="
WIKI_PARENT="wikis/$WIKI/memes/docs/lares/the-lares-protocols.md"
if [ ! -f "$WIKI_PARENT" ]; then
  echo "wiki parent cleaned ✓"
else
  echo "FAIL: wiki parent still exists at $WIKI_PARENT"
fi

echo ""
echo "=== full parent file head ==="
head -30 "$PARENT" 2>/dev/null || echo "(no parent)"

echo ""
echo "=== done — daemon still running (PID $DAEMON_PID) ==="
echo "    kill with: kill $DAEMON_PID"
