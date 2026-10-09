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
# snapshot, reads the dials). Needs node + the host-built dist the harness already requires for `up`.
#
# Usage: node tools/mesh-pins.mjs --up herm-source herm-relay herm-relay-2   (each wave boots against the pins
#        the earlier wave founded; a bare `compose up` stands peers that knock with no pin and never dial)
#        export LAR_ROOT=$(mktemp -d) && node packages/lares-cli/bin/lares.mjs vessel found --skip-build
#        ./tools/herm-mesh-witness.sh
set -euo pipefail
exec node "$(dirname "$0")/herm-mesh-witness.mjs"
