#!/usr/bin/env bash
# browser-weld-witness — stand the web surface, drive a REAL browser, follow an edit toward the node's disk.
#
# ── WHY IT STANDS ALONE ─────────────────────────────────────────────────────────────────────────
# `lararium-browser`'s suite already runs in Chromium, but every vector there is package-scoped: it
# proves an organ. This proves a WELD, and a weld spans the browser's DOM and the node's filesystem —
# two sides no package-scoped suite can hold at once. It also boots a dev server, so it belongs
# outside `pnpm -r test` for the same reason the e2e harness does.
#
# ── ONE VECTOR, ONE FAILURE ─────────────────────────────────────────────────────────────────────
# The driver isolates each seam and names it. A combined "the edit reached disk" assertion would fail
# ambiguously — it reports that the weld broke and not where, which is the diagnosis this exists for.
# `gap` is not `FAILED`: a gap says a leg is unwired or the surface offered no target; a FAILED says a
# wired leg did not carry. Only FAILED sets the exit code.
#
# Usage:  tools/browser-weld-witness.sh
set -uo pipefail
cd "$(dirname "$0")/.."

PORT="${WELD_PORT:-5173}"
READY_ATTEMPTS="${WELD_READY_ATTEMPTS:-60}"
READY_INTERVAL="${WELD_READY_INTERVAL:-0.5}"
READY_SETTLE_SECONDS="${WELD_READY_SETTLE_SECONDS:-0.2}"
ARTIFACT_DIR="${ARTIFACT_DIR:-}"
if [ -n "$ARTIFACT_DIR" ]; then
  case "$ARTIFACT_DIR" in
    /*) ;;
    *) ARTIFACT_DIR="$(pwd)/$ARTIFACT_DIR" ;;
  esac
  mkdir -p "$ARTIFACT_DIR"
  LOG="$ARTIFACT_DIR/vite.log"
else
  LOG="$(mktemp -t weld-vite-XXXXXX.log)"
fi
VITE_PID=""

cleanup() {
  if [ -n "$VITE_PID" ]; then
    # `setsid` below makes this process group ours. Kill the whole Vite/npx tree
    # without reaching the runner's own shells or an unrelated server on $PORT.
    kill -TERM -- "-$VITE_PID" 2>/dev/null || true
    wait "$VITE_PID" 2>/dev/null || true
  fi
  [ -n "$ARTIFACT_DIR" ] || rm -f "$LOG"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

echo "browser-weld: standing the web surface on :$PORT"
# Keep the session leader as $VITE_PID, not the launcher subshell. `npx` may
# leave a Vite child behind, and a PID-only cleanup would then leak the server.
(
  cd packages/lararium-web
  exec setsid npx vite --port "$PORT" --strictPort
) >"$LOG" 2>&1 &
VITE_PID=$!

vite_announced_local_url() {
  grep -F "Local:" "$LOG" | grep -F "http://localhost:$PORT/" >/dev/null
}

web_answers() {
  curl -sf --connect-timeout 1 --max-time 2 "http://localhost:$PORT/" >/dev/null 2>&1
}

# Wait for the server to ANSWER, never for a fixed sleep — a fixed sleep reports a slow machine as a
# broken one, and this house has already paid for that lesson in a readiness race.
ready=0
server_exited=0
for _ in $(seq 1 "$READY_ATTEMPTS"); do
  if ! kill -0 "$VITE_PID" 2>/dev/null; then
    server_exited=1
    break
  fi
  # An unrelated server can answer this port. Require Vite's own startup
  # announcement from our log before probing the port at all.
  if vite_announced_local_url && web_answers; then
    # The child can die just after either proof, so accept only the pair while
    # the Vite session leader still lives.
    sleep "$READY_SETTLE_SECONDS"
    if kill -0 "$VITE_PID" 2>/dev/null && vite_announced_local_url; then
      ready=1
      break
    fi
    server_exited=1
    break
  fi
  sleep "$READY_INTERVAL"
done
if [ "$ready" -ne 1 ]; then
  if [ "$server_exited" -eq 1 ]; then
    echo "browser-weld: web process exited before readiness on :$PORT — vite log follows"
  else
    echo "browser-weld: the web surface never answered on :$PORT — vite log follows"
  fi
  tail -12 "$LOG"
  exit 1
fi

status=0
# L-Prime receipt boundary: run both drivers and aggregate only after both exits are visible.
echo "browser-weld: starting Weld driver"
if [ -n "$ARTIFACT_DIR" ]; then
  # L-Prime artifact boundary: keep Weld's receipt separate from Vite's log.
  WELD_WEB_URL="http://localhost:$PORT" node tools/browser-weld/weld.mjs 2>&1 | tee "$ARTIFACT_DIR/weld.log"
  weld_pipeline=(${PIPESTATUS[@]})
  weld_status="${weld_pipeline[0]}"
else
  WELD_WEB_URL="http://localhost:$PORT" node tools/browser-weld/weld.mjs
  weld_status=$?
fi
echo "browser-weld: Weld driver exited $weld_status"

echo "browser-weld: starting C4 leaf driver"
if [ -n "$ARTIFACT_DIR" ]; then
  # L-Prime artifact boundary: keep C4's receipt separate from Weld's log.
  WELD_WEB_URL="http://localhost:$PORT" node tools/browser-weld/leaf-continuity.mjs 2>&1 | tee "$ARTIFACT_DIR/c4.log"
  c4_pipeline=(${PIPESTATUS[@]})
  c4_status="${c4_pipeline[0]}"
else
  WELD_WEB_URL="http://localhost:$PORT" node tools/browser-weld/leaf-continuity.mjs
  c4_status=$?
fi
echo "browser-weld: C4 leaf driver exited $c4_status"

if [ "$weld_status" -ne 0 ] || [ "$c4_status" -ne 0 ]; then
  status=1
fi
exit "$status"
