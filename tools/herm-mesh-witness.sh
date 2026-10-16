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
# AN EXPLICIT NEXUS OPENS THE HERM RELAY (house ruling "Routes at the cutover"). A herm stands a floor gate only
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

# join <label> <runner…>: the runner runs the CLI where the place stands (a container's exec, or the host reader's own).
join() {
  local label="$1"; shift
  local cf nym sig
  if [ "$label" = "host-reader" ]; then "$@" nexus seal import "$WORK/a-charter.mem" --json >/dev/null
  else printf '%s' "$CHARTER" | $COMPOSE exec -T "$label" sh -c 'cat > /tmp/a-charter.mem' && "$@" nexus seal import /tmp/a-charter.mem --json >/dev/null; fi
  cf=$("$@" nexus carry-for --json)
  nym=$(printf '%s' "$cf" | grep -oE '"nym":"[a-f0-9]{64}"' | head -1 | cut -d'"' -f4)
  sig=$(printf '%s' "$cf" | grep -oE '"carrierSig":"[a-f0-9]+"' | head -1 | cut -d'"' -f4)
  printf '%s' "$cf" | $COMPOSE exec -T lararium-a sh -c "cat > /tmp/carry-for-$label.json"
  $COMPOSE exec -T lararium-a $LARES nexus carry "$nym" --carrier "$sig" --floor-pin "/tmp/carry-for-$label.json" --json > "$WORK/bundle-$label.json"
  if [ "$label" = "host-reader" ]; then "$@" nexus carry-take "$WORK/bundle-$label.json" --json >/dev/null
  else $COMPOSE exec -T "$label" sh -c 'cat > /tmp/carry-bundle.json' < "$WORK/bundle-$label.json" && "$@" nexus carry-take /tmp/carry-bundle.json --json >/dev/null; fi
  echo "  joined A's Nexus: $label (${nym:0:16}…)"
}
for herm in herm-source herm-relay herm-relay-2; do join "$herm" $COMPOSE exec -T "$herm" $LARES; done
join host-reader $LARES

exec node "$(dirname "$0")/herm-mesh-witness.mjs"
