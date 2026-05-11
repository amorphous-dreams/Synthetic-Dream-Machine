#!/usr/bin/env bash
# tests/lararium-tw5/sync/sync-decompose-promote.sh
#
# Two idempotent integration flows for lararium-tw5 sync + decompose.
#
# Flow 1 (decompose): reset → serve → wiki init → copy meme → sync --debug → observe
# Flow 2 (promote):   flow 1 setup → promote to @lares → verify packages/ disk output
#
# Usage:
#   ./tests/lararium-tw5/sync/sync-decompose-promote.sh [--wiki WIKI] [decompose|promote|both]
#   Defaults: wiki=scratch, flow=decompose

set -euo pipefail
REPO_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
cd "$REPO_ROOT"

WIKI="scratch"
FLOW="decompose"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --wiki) WIKI="$2"; shift 2 ;;
    decompose|promote|both) FLOW="$1"; shift ;;
    *) echo "Unknown arg: $1"; exit 1 ;;
  esac
done

SOURCE_MEME="tests/src/the-lares-protocols.md"
MEME_SLUG="the-lares-protocols"
WIKI_MEME_DIR="wikis/$WIKI/memes/docs/lares"
WIKI_MEME="$WIKI_MEME_DIR/$MEME_SLUG.md"
RUNS_DIR="tests/runs/wikis/$WIKI/memes/docs/lares"
EXPECTED_DIR="tests/expected/wikis/$WIKI/memes/docs/lares"
LAR_URI="lar:///ha.ka.ba/docs/lares/$MEME_SLUG"
CANON_PARENT="packages/lares/memes/docs/lares/$MEME_SLUG.md"
CANON_CHILD_DIR="packages/lares/memes/docs/lares/$MEME_SLUG"
LARES="node_modules/.bin/lares"
DAEMON_PID=""
DAEMON_LOG=""

# --------------------------------------------------------------------------
# Helpers
# --------------------------------------------------------------------------

die() { echo "ERROR: $*"; [ -n "$DAEMON_PID" ] && kill "$DAEMON_PID" 2>/dev/null; exit 1; }

start_daemon() {
  DAEMON_LOG="/tmp/lares-test-$WIKI.log"
  $LARES serve --wiki "$WIKI" > "$DAEMON_LOG" 2>&1 &
  DAEMON_PID=$!
  echo "  daemon PID=$DAEMON_PID  log=$DAEMON_LOG"
  echo -n "  waiting for live"
  for i in $(seq 1 25); do
    sleep 1
    grep -qE "live — wiki: $WIKI" "$DAEMON_LOG" 2>/dev/null && { echo " ✓"; return 0; }
    echo -n "."
  done
  echo ""
  die "daemon did not reach live state — tail: $(tail -5 "$DAEMON_LOG")"
}

stop_daemon() {
  [ -n "$DAEMON_PID" ] && { kill "$DAEMON_PID" 2>/dev/null; wait "$DAEMON_PID" 2>/dev/null || true; }
  DAEMON_PID=""
}

pass() { echo "  ✓ $*"; }
fail() { echo "  ✗ FAIL: $*"; FAILURES=$((FAILURES+1)); }
FAILURES=0

# --------------------------------------------------------------------------
# Setup: reset + serve + wiki init + copy meme
# --------------------------------------------------------------------------

setup() {
  echo ""
  echo "=== reset ==="
  pkill -9 -f "tsx.*main.ts" 2>/dev/null || true
  fuser -k 8080/tcp 2>/dev/null || true
  sleep 1
  $LARES reset --force

  echo ""
  echo "=== serve ==="
  start_daemon

  echo ""
  echo "=== wiki init $WIKI ==="
  $LARES wiki init "$WIKI"

  echo ""
  echo "=== copy test meme ==="
  mkdir -p "$WIKI_MEME_DIR"
  cp "$SOURCE_MEME" "$WIKI_MEME"
  echo "  $SOURCE_MEME → $WIKI_MEME"
}

# --------------------------------------------------------------------------
# Flow 1 — decompose
# sync --debug, then inspect daemon log for decompose evidence
# --------------------------------------------------------------------------

flow_decompose() {
  echo ""
  echo "╔══════════════════════════════════════╗"
  echo "║  FLOW 1: sync → decompose            ║"
  echo "╚══════════════════════════════════════╝"

  echo ""
  echo "=== lares wiki sync $WIKI --debug ==="
  $LARES wiki sync "$WIKI" --debug

  echo ""
  echo "=== observe ==="
  echo "--- daemon log (last 40 lines) ---"
  tail -40 "$DAEMON_LOG"

  echo ""
  echo "=== capture run output ==="
  rm -rf "$RUNS_DIR"
  mkdir -p "$RUNS_DIR"
  # copy only .md files (skip .json)
  find "$WIKI_MEME_DIR" -name '*.md' | while read -r f; do
    rel="${f#$WIKI_MEME_DIR/}"
    dest="$RUNS_DIR/$rel"
    mkdir -p "$(dirname "$dest")"
    cp "$f" "$dest"
  done
  pass "copied output to $RUNS_DIR"

  echo ""
  echo "=== diff: runs vs expected ==="
  if diff -r --unified=3 "$EXPECTED_DIR" "$RUNS_DIR"; then
    pass "output matches expected"
  else
    fail "diff detected — see above"
  fi
}

# --------------------------------------------------------------------------
# Flow 2 — promote
# After flow_decompose setup, promote and verify packages/ disk output
# --------------------------------------------------------------------------

flow_promote() {
  echo ""
  echo "╔══════════════════════════════════════╗"
  echo "║  FLOW 2: sync → promote → verify     ║"
  echo "╚══════════════════════════════════════╝"

  echo ""
  echo "=== lares wiki sync $WIKI --debug ==="
  $LARES wiki sync "$WIKI" --debug

  echo ""
  echo "=== lares promote ==="
  $LARES promote "$LAR_URI" --to lar:///ha.ka.ba/@lares --yes

  echo "--- waiting for disk projector (4 s) ---"
  sleep 4

  echo ""
  echo "=== verify $CANON_PARENT ==="
  if [ -f "$CANON_PARENT" ]; then
    pass "parent file exists"
    head -1 "$CANON_PARENT" | grep -q '!DOCTYPE' \
      && pass "prologue present" || fail "prologue missing (line 1: $(head -1 "$CANON_PARENT"))"
    sed -n '4p' "$CANON_PARENT" | grep -q '```toml iam' \
      && pass "iam fence present" || fail "iam fence broken (line 4: $(sed -n '4p' "$CANON_PARENT"))"
  else
    fail "parent not found at $CANON_PARENT"
  fi

  echo ""
  echo "=== verify children at $CANON_CHILD_DIR/ ==="
  local cp=0 cf=0
  for f in "$CANON_CHILD_DIR"/*.md; do
    [ -f "$f" ] || continue
    head -1 "$f" | grep -q '!DOCTYPE' \
      && { echo "    ✓ $(basename "$f")"; cp=$((cp+1)); } \
      || { echo "    ✗ $(basename "$f") — first line: $(head -1 "$f")"; cf=$((cf+1)); }
  done
  [ $cp -gt 0 ] && [ $cf -eq 0 ] && pass "$cp children with prologues" \
    || fail "$cf children missing prologue (found $cp ok)"

  echo ""
  echo "=== promote log tail ==="
  tail -20 "$DAEMON_LOG"
}

# --------------------------------------------------------------------------
# Run
# --------------------------------------------------------------------------

setup

case "$FLOW" in
  decompose)
    flow_decompose
    ;;
  promote)
    flow_promote
    ;;
  both)
    flow_decompose
    echo ""
    echo "--- re-drop meme for flow 2 ---"
    cp "$SOURCE_MEME" "$WIKI_MEME"
    flow_promote
    ;;
esac

stop_daemon

echo ""
echo "══════════════════════════════════════"
[ "$FAILURES" -eq 0 ] && echo "  ALL CHECKS PASSED" || echo "  $FAILURES CHECK(S) FAILED"
echo "══════════════════════════════════════"
[ "$FAILURES" -eq 0 ]
#
