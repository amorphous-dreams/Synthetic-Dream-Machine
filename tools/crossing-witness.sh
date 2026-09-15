#!/usr/bin/env bash
# crossing-witness — the civic-protocol CROSSING matrix across a real container boundary. Runs each
# scenario through docker-compose.crossing.yml (a real DaemonAuthGate daemon + a browser-shaped leaf),
# asserting the gate does the RIGHT thing: crosses the admitted, denies the rest, and lets a denied
# anon still stand whole on its own floor. The client's EXIT CODE is the verdict (0 = correct).
#
#   admitted    (X1/X5)  an admitted leaf crosses + syncs the doc both ways.
#   anon        (X2/A1)  a valid-but-ungranted leaf is denied, then founds its own island standalone.
#   impostor    (X3)     a leaf that signs with the wrong seed (forged proof) is denied.
#   wrong-bind  (X4)     a leaf binding the wrong audience is denied.
#
# Usage:  tools/crossing-witness.sh
# Meme:   lar:///ha.ka.ba/lares/api/pono/the-veil-ladder + browser-crossing

set -u
DOCKER_BIN="${DOCKER_BIN:-docker}"
ARTIFACT_DIR="${ARTIFACT_DIR:-}"
if [ -n "$ARTIFACT_DIR" ]; then mkdir -p "$ARTIFACT_DIR"; fi
PASS=0; FAIL=0; FAILED=""
ACTIVE_ROLE=""

compose() { "$DOCKER_BIN" compose -f docker-compose.crossing.yml "$@"; }

capture_compose() {  # capture_compose <scenario>
  [ -n "$ARTIFACT_DIR" ] || return 0
  {
    printf '\n── crossing %s: compose state before teardown ──\n' "$1"
    compose ps
    compose logs --no-color
  } >>"$ARTIFACT_DIR/crossing-$1.compose.log" 2>&1 || true
}

cleanup() {
  [ -n "$ACTIVE_ROLE" ] || return 0
  capture_compose "$ACTIVE_ROLE"
  compose down -v >/dev/null 2>&1 || true
  ACTIVE_ROLE=""
}
on_signal() { exit 130; }
trap cleanup EXIT
trap on_signal INT TERM

run() {  # run <role> <admit-policy>
  local role="$1" admit="$2" raw_log ec tee_ec
  local -a statuses
  ACTIVE_ROLE="$role"
  echo "── scenario: ${role} (admit=${admit}) ─────────────────────────────"
  # The handshake rides a named volume that `down -v` (below) wipes between scenarios — no host cleanup.
  # Keep raw Compose output too: grep intentionally hides image-pull and setup failures from stdout.
  raw_log="/dev/null"
  [ -n "$ARTIFACT_DIR" ] && raw_log="$ARTIFACT_DIR/crossing-$role.up.log"
  LAR_CROSS_ROLE="$role" LAR_CROSSING_ADMIT="$admit" \
    compose up --abort-on-container-exit --exit-code-from crossing-client \
    2>&1 | tee "$raw_log" | grep -E "crossing-(client|daemon).*(✓|✗|CROSSING|DENIED|denied|admit policy|SECURITY|WHOLE)"
  statuses=("${PIPESTATUS[@]}")
  # Grep may find no concise line. Compose and tee must still decide the matrix verdict.
  ec="${statuses[0]}"
  tee_ec="${statuses[1]}"
  [ "$ec" -eq 0 ] && [ "$tee_ec" -ne 0 ] && ec="$tee_ec"
  cleanup
  if [ "$ec" -eq 0 ]; then echo "   ✓ ${role} — the gate did the right thing"; PASS=$((PASS+1));
  else echo "   ✗ ${role} — exit ${ec}"; FAIL=$((FAIL+1)); FAILED="${FAILED} ${role}"; fi
  echo
}

echo "═══ CROSSING MATRIX — the civic-protocol gate, across containers ═══"
run admitted   from-file
run anon       none
run impostor   from-file
run wrong-bind from-file

echo "═══ RESULT: ${PASS} passed, ${FAIL} failed ═══"
if [ "$FAIL" -ne 0 ]; then echo "   failed:${FAILED}"; exit 1; fi
echo "   ✓ the crossing contract holds at the wire — pre-browser gate GREEN"
