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
CHARTER=$($COMPOSE exec -T lararium-a $LARES nexus seal export --no-json)
WORK=$(mktemp -d)
printf '%s' "$CHARTER" > "$WORK/a-charter.mem"

# refused <label> <door> <output>: a join step that did not land names its door and the tail of what it said, and the
# witness stops there.
refused() {
  echo "✗ $1 did not join A's Nexus: $2 refused" >&2
  printf '%s\n' "$3" | tail -4 | sed 's/^/    /' >&2
  exit 1
}

# join <label> <runner…>: the runner runs the CLI where the place stands (a container's exec, or the host reader's own).
# Each door's answer is read before the next door opens, so a refusal names the door that refused.
join() {
  local label="$1"; shift
  local out cf nym sig
  if [ "$label" != "host-reader" ]; then
    printf '%s' "$CHARTER" | $COMPOSE exec -T "$label" sh -c 'cat > /tmp/a-charter.mem' || refused "$label" "the charter copy" ""
    out=$("$@" nexus seal import /tmp/a-charter.mem --json 2>&1) || refused "$label" "nexus seal import" "$out"
  else
    out=$("$@" nexus seal import "$WORK/a-charter.mem" --json 2>&1) || refused "$label" "nexus seal import" "$out"
  fi
  # A --json answer is the door's stdout alone; its log lines ride stderr and stay out of the files A and the place read.
  cf=$("$@" nexus carry-for --json 2>"$WORK/carry-for-$label.err") || refused "$label" "nexus carry-for" "$cf$(cat "$WORK/carry-for-$label.err")"
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
for herm in herm-source herm-relay herm-relay-2; do join "$herm" $COMPOSE exec -T "$herm" $LARES; done
join host-reader $LARES

exec node "$(dirname "$0")/herm-mesh-witness.mjs"
