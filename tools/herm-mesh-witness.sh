#!/usr/bin/env bash
# herm-mesh-witness — the live witness for docker-compose.mesh.yml: confirm the source Herm's announced
# dial (lar:///ha.ka.ba/@oracle/node/alpha) crossed the relay chain, served at each hop's content-addressed
# snapshot.
#
#   source (LAR_SEED=alpha) → relay-1 (pulls source) → relay-2 (pulls relay-1, transitive)
#
# This delegates to the DECODING witness (herm-mesh-witness.mjs): the read-face serves an Automerge-saved
# snapshot (compressed binary), so a plaintext grep of the raw bytes can never match a bearing — it decodes
# through the same client a peer uses (verifies the pointer signature, matches the hash, Automerge.loads the
# snapshot, reads the dials). The product image is selected once by digest for the mesh.
#
# AN EXPLICIT NEXUS OPENS THE HERM RELAY (the shut-routes house ruling, stable-founding-road #/rulings). A herm stands a floor gate only
# at a Nexus whose quorum counted its `carry`, and a reader files a herm's floor pin only off a board that counts it.
# So lararium-a (which seats the founding kahu) stands too, and before the read every herm AND the host reader join
# A's Nexus by hand: `nexus carry-for` on the place, `nexus carry --floor-pin` on A, `nexus carry-take` on the place.
#
# Usage: node tools/mesh-pins.mjs --up herm-source herm-relay herm-relay-2 lararium-a   (each wave boots against the
#        pins the earlier wave founded; a bare `compose up` stands peers that knock with no pin and never dial)
#        export LAR_ROOT=$(mktemp -d) && node tools/test-scratch-marker.mjs "$LAR_ROOT" && node tools/seed-test-custody.mjs "$LAR_ROOT" \
#          && git ls-files -z genesis/ | xargs -0 -I{} cp --parents "{}" "$LAR_ROOT"/ \
#          && node packages/lares-cli/bin/lares.mjs vessel found --skip-build
#        ./tools/herm-mesh-witness.sh
set -euo pipefail
cd "$(dirname "$0")/.."
# One product image, named by digest, serves every container of this run.
LARES_HARNESS_IMAGE="$(tools/harness-image.sh --resolve)" || exit $?
export LARES_HARNESS_IMAGE
COMPOSE="docker compose -f docker-compose.mesh.yml"
LARES="node packages/lares-cli/dist/src/bin/lares.js"
WORK=$(mktemp -d)
CHARTER=""
BOOT_WAIT_SECONDS=600

# refused <label> <door> <output>: a join step that did not land names its door and the tail of what it said, and the
# witness stops there.
refused() {
  echo "✗ $1 did not join A's Nexus: $2 refused" >&2
  printf '%s\n' "$3" | tail -4 | sed 's/^/    /' >&2
  exit 1
}

# This bound serves the witness's own liveness and decides nothing about the product.
# A's staged boot can roll its seed charter before serving; join only after that product boot line lands.
await_a_boot() {
  if ! (set +o pipefail; timeout "${BOOT_WAIT_SECONDS}s" $COMPOSE logs --follow --no-color lararium-a 2>&1 | grep -m 1 -F '[boot] serving…' >/dev/null); then
    refused "lararium-a" "boot line within ${BOOT_WAIT_SECONDS}s" "$($COMPOSE logs --tail 20 --no-color lararium-a 2>&1)"
  fi
}

# join <label> <runner…>: the runner runs the CLI where the place stands (a container's exec, or the host reader's own).
# Each door's answer is read before the next door opens, so a refusal names the door that refused.
join() {
  local label="$1"; shift
  local out cf nym sig
  # A's charter epoch moves with every carry it signs, so each join reads the charter A stands on now.
  CHARTER=$($COMPOSE exec -T lararium-a $LARES nexus seal export --no-json 2>/dev/null) || refused "$label" "A's nexus seal export" "$CHARTER"
  printf '%s' "$CHARTER" > "$WORK/a-charter.mem"
  if [ "$label" != "host-reader" ]; then
    printf '%s' "$CHARTER" | $COMPOSE exec -T "$label" sh -c 'cat > /tmp/a-charter.mem' || refused "$label" "the charter copy" ""
    out=$("$@" nexus seal import /tmp/a-charter.mem --json 2>&1) || refused "$label" "nexus seal import" "$out"
  elif [ "${HERM_MESH_ROLL:-0}" = 1 ]; then
    # The reader joins twice across the roll. A's charter is a partner's to it, so it lands beside the
    # reader's primary, where the second import moves forward along its seal lineage.
    out=$("$@" nexus seal import --carry "$WORK/a-charter.mem" --json 2>&1) || refused "$label" "nexus seal import --carry" "$out"
    carried=$(printf '%s' "$out" | grep -oE '"aid":"[^"]+"' | head -1 | cut -d'"' -f4)
    [ -n "$carried" ] || refused "$label" "nexus seal import --carry (no aid)" "$out"
  else
    out=$("$@" nexus seal import "$WORK/a-charter.mem" --json 2>&1) || refused "$label" "nexus seal import" "$out"
  fi
  local at=()
  if [ "$label" = "host-reader" ] && [ -n "${carried:-}" ]; then at=(--nexus "$carried"); fi
  # A --json answer is the door's stdout alone; its log lines ride stderr and stay out of the files A and the place read.
  cf=$("$@" nexus carry-for "${at[@]}" --json 2>"$WORK/carry-for-$label.err") || refused "$label" "nexus carry-for" "$cf$(cat "$WORK/carry-for-$label.err")"
  nym=$(printf '%s' "$cf" | grep -oE '"nym":"[a-f0-9]{64}"' | head -1 | cut -d'"' -f4 || true)
  sig=$(printf '%s' "$cf" | grep -oE '"carrierSig":"[a-f0-9]+"' | head -1 | cut -d'"' -f4 || true)
  [ -n "$nym" ] && [ -n "$sig" ] || refused "$label" "nexus carry-for (no nym and carrier seal)" "$cf"
  printf '%s' "$cf" | $COMPOSE exec -T lararium-a sh -c "cat > /tmp/carry-for-$label.json" || refused "$label" "the carry-for copy to A" ""
  $COMPOSE exec -T lararium-a $LARES nexus carry "$nym" --carrier "$sig" --floor-pin "/tmp/carry-for-$label.json" --json > "$WORK/bundle-$label.json" 2>"$WORK/bundle-$label.err" \
    || refused "$label" "A's nexus carry" "$(cat "$WORK/bundle-$label.json" "$WORK/bundle-$label.err")"
  if [ "$label" = "host-reader" ]; then out=$("$@" nexus carry-take "$WORK/bundle-$label.json" --json 2>&1) || refused "$label" "nexus carry-take" "$out"
  else
    $COMPOSE exec -T "$label" sh -c 'cat > /tmp/carry-bundle.json' < "$WORK/bundle-$label.json" || refused "$label" "the bundle copy" ""
    out=$("$@" nexus carry-take /tmp/carry-bundle.json --json 2>&1) || refused "$label" "nexus carry-take" "$out"
  fi
  echo "  joined A's Nexus: $label (${nym:0:16}…)"
}
await_a_boot
join herm-source $COMPOSE exec -T herm-source $LARES
join herm-relay $COMPOSE exec -T herm-relay $LARES
if [ "${HERM_MESH_ROLL:-0}" = 1 ]; then
  # Keep this reader's opening-epoch arm for the forged control; join it again at the opened head below.
  join host-reader $LARES
  cp "$WORK/bundle-host-reader.json" "$WORK/opening-reader-bundle.json"
  before=$($COMPOSE exec -T lararium-a $LARES nexus seal show --json 2>/dev/null \
    | grep -oE '"sealEpochCid":"(nexus|epoch)-[0-9a-f]{64}"' | head -1 | cut -d'"' -f4)
  card=$($COMPOSE logs --no-color lararium-a 2>&1 | grep -oE 'staged seed card: [0-9a-f-]+' | tail -1 | cut -d' ' -f4)
  [ -n "$before" ] && [ -n "$card" ] || refused "lararium-a" "opening head and staged seed card" "$before"
  # The card enters the staged test root's own rite. Its code never prints in the witness log.
  out=$($COMPOSE exec -T lararium-a $LARES nexus seal rotate --cold-key "$card" --threshold 1 --json 2>&1) \
    || refused "lararium-a" "nexus seal rotate" "$out"
  unset card
  after=$(printf '%s' "$out" | grep -oE '"sealEpochCid":"(nexus|epoch)-[0-9a-f]{64}"' | head -1 | cut -d'"' -f4)
  [ -n "$after" ] && [ "$after" != "$before" ] || refused "lararium-a" "head move" "$out"
  echo "  A's product rite rolled ${before:0:18}… → ${after:0:18}…"
fi
if [ "${HERM_MESH_ROLL:-0}" = 1 ]; then relay2_since=$(date -u +%Y-%m-%dT%H:%M:%SZ); fi
join herm-relay-2 $COMPOSE exec -T herm-relay-2 $LARES
join host-reader $LARES
if [ "${HERM_MESH_ROLL:-0}" = 1 ]; then
  # The relay's own merge event pins the crossing; the verified reader then takes one reading.
  if ! (set +o pipefail; timeout 120s $COMPOSE logs --follow --no-color --since "$relay2_since" herm-relay-2 2>&1 \
    | grep -m 1 -F '[carriage] carriage: merged' >/dev/null); then
    refused "herm-relay-2" "carriage merge within 120s" "$($COMPOSE logs --tail 20 --no-color herm-relay-2 2>&1)"
  fi
  WITNESS_ATTEMPTS=1 node "$(dirname "$0")/herm-mesh-witness.mjs"
else
  node "$(dirname "$0")/herm-mesh-witness.mjs"
fi
if [ "${HERM_MESH_ROLL:-0}" = 1 ]; then
  for herm in herm-source herm-relay herm-relay-2; do
    logs=$($COMPOSE logs --no-color "$herm" 2>&1)
    if printf '%s\n' "$logs" | grep -E '\[carriage\].*place-contract-unheld' >/dev/null; then
      refused "$herm" "carriage gate across the roll" "$(printf '%s\n' "$logs" | grep -E '\[carriage\].*place-contract-unheld')"
    fi
  done
  before_silence=$($COMPOSE logs --no-color herm-relay-2 2>&1 | grep -Ec '\[lar-gate\].*fell silent: place-contract-(unheld|refused)' || true)
  node tools/herm-mesh-forged-anchor.mjs "$WORK/opening-reader-bundle.json" "${HERM_RELAY_2_PUBLISHER:-}" \
    || refused "host-reader" "forged anchor probe" "the probe did not hear silence"
  # The floor gate logs its own refusal; only a named place-contract silence passes this control.
  logs=$($COMPOSE logs --no-color herm-relay-2 2>&1)
  after_silence=$(printf '%s\n' "$logs" | grep -Ec '\[lar-gate\].*fell silent: place-contract-(unheld|refused)' || true)
  [ "$after_silence" -gt "$before_silence" ] \
    || refused "herm-relay-2" "named forged-anchor silence" "$logs"
  echo "✓ FORGED ANCHOR: relay-2's floor gate fell silent by place-contract name"
fi
