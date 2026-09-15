#!/usr/bin/env bash
# civic-witness — the ONE entry point for the DreamNet-as-civic-protocol e2e suite. Runs every
# containerized scenario family and reports a consolidated verdict. Each family stands real vessels in
# real containers and asserts a protocol invariant by exit code — the mechanism, never the metaphysics
# (GPA-linkability, PCS, and fork-legitimacy stay out of scope by design; see the civic-protocol matrix).
#
# Families:
#   crossing   (X1-X5 + anon floor)  the auth gate: admitted crosses + syncs both ways · anon denied →
#                                     founds own island · impostor forged-sig denied · wrong-audience denied.
#   burn       (X6)                   burning a Handle cuts NEW shared content forward-only; the floor persists.
#   membership (MA1)                  the admit swarm forms a roster across containers (roster 2/2).
#   kahu       (S1 civic-custody)     a public-infra kahu HOLDS a citizen's ciphertext yet CANNOT read it —
#                                     custody ⊥ materialization; Delivery-Service, never Auth-Root.
#   kahu-recov (S3 civic-custody)     a kahu HOLDS a citizen's recovery escrow share yet CANNOT recover
#                                     (become) them alone — the recovery quorum IS the impersonation quorum.
#
# Usage:  tools/civic-witness.sh
# The 3-hop mesh + partition family rides its own longer witness: tools/herm-mesh-partition.mjs.
# Meme:  lar:///ha.ka.ba/lares/api/pono/the-veil-ladder + cabal-realm + browser-crossing

set -u
PASS=0; FAIL=0; FAILED=""
ACTIVE_FILE=""
ARTIFACT_DIR="${ARTIFACT_DIR:-}"
if [ -n "$ARTIFACT_DIR" ]; then
  mkdir -p "$ARTIFACT_DIR"
  LOGDIR="$ARTIFACT_DIR/civic-families"
  mkdir -p "$LOGDIR"
else
  LOGDIR="$(mktemp -d)"
fi

capture_compose() {  # capture_compose <compose-file>
  [ -n "$ARTIFACT_DIR" ] || return 0
  local file="$1" name
  name="$(basename "$file" .yml)"
  {
    printf '\n── %s: compose state before teardown ──\n' "$file"
    docker compose -f "$file" ps
    docker compose -f "$file" logs --no-color
  } >>"$ARTIFACT_DIR/${name}.compose.log" 2>&1 || true
}

cleanup() {
  [ -n "$ACTIVE_FILE" ] || return 0
  capture_compose "$ACTIVE_FILE"
  docker compose -f "$ACTIVE_FILE" down -v >/dev/null 2>&1 || true
  ACTIVE_FILE=""
}
on_signal() { exit 130; }
trap cleanup EXIT
trap on_signal INT TERM

family() {  # family <name> <log> <command...>
  local name="$1" log="$2"; shift 2
  printf "── %-34s " "${name}"
  if "$@" >"${LOGDIR}/${log}.log" 2>&1; then
    echo "✓ GREEN"; PASS=$((PASS+1))
  else
    echo "✗ FAILED (exit $?)"; FAIL=$((FAIL+1)); FAILED="${FAILED} ${name}"
    grep -E "✗|FAIL|FATAL|Error" "${LOGDIR}/${log}.log" | grep -vE "TimeoutNegative" | tail -4 | sed 's/^/      /'
  fi
}

compose_scenario() {  # compose_scenario <file> <verdict-service> [ENV=val …]
  local file="$1" svc="$2"; shift 2
  ACTIVE_FILE="$file"
  env "$@" docker compose -f "$file" up --abort-on-container-exit --exit-code-from "$svc"
  local ec=$?
  cleanup
  return $ec
}

echo "═══════════════════════════════════════════════════════════════"
echo "  DREAMNET CIVIC-PROTOCOL e2e SUITE — real vessels, real wire"
echo "═══════════════════════════════════════════════════════════════"

# The crossing matrix is itself a 4-scenario witness; run it whole.
family "crossing matrix (X1-X5+anon)" crossing bash tools/crossing-witness.sh
family "burn forward-cut (X6)"        burn     compose_scenario docker-compose.burn.yml     burn-device
family "membership swarm (MA1)"       swarm    compose_scenario docker-compose.swarm-ws.yml founder
family "kahu civic-custody (S1)"      kahu     compose_scenario docker-compose.kahu.yml          kahu-node
family "kahu recovery-custody (S3)"   kaharec  compose_scenario docker-compose.kahu-recovery.yml kahu-rec-node

echo "═══════════════════════════════════════════════════════════════"
echo "  RESULT: ${PASS} families GREEN, ${FAIL} failed"
if [ "$FAIL" -ne 0 ]; then echo "  failed:${FAILED}"; echo "  logs: ${LOGDIR}"; exit 1; fi
echo "  ✓ the civic protocol holds at the wire — the pre-browser gate is GREEN"
echo "═══════════════════════════════════════════════════════════════"
