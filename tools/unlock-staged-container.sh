#!/bin/sh
# unlock-staged-container — open a STAGED vessel's key inside its standing container, through the test door.
#
#   unlock-staged-container.sh <container> [<root inside the container>]     (root defaults to /state)
#
# EVERY BOOT RESTS AT THE FLOOR holding no vessel key, and only a terminal opens one (`lares vault unlock`; no
# flag, env var or pipe carries a credential). A container harness holds no terminal, so it opens a vessel it
# STAGED through the test door: `tools/unlock-test-custody.mjs` sends the unlock frame under the published test
# route, and refuses by name any root that carries no scratch marker (`tools/test-scratch-marker.mjs` writes it
# at stage time). So this reaches only a vessel a harness staged and founded under the test route.
#
# The product image carries no test door, and the unlock frame travels the verb socket inside the container's
# own /tmp. So the door's three files ride into the standing container's filesystem by `docker cp` (a restart
# keeps them; a second copy lands on the first), and the door runs there by `docker exec`. No mount changes, and
# no container receives the Docker socket.
#
# Prints the daemon's answer (one JSON line) on stdout. Exit: the door's own code (0 the key opened or already
# stood open · 1 the daemon answered otherwise · 2 no marker or bad usage · 3 no daemon answers).
set -eu

HERE=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
[ "$#" -ge 1 ] && [ "$#" -le 2 ] && [ -n "$1" ] || { echo "usage: tools/unlock-staged-container.sh <container> [<root inside the container>]" >&2; exit 2; }
CONTAINER=$1
STATE=${2:-/state}

DOOR=$(mktemp -d "${TMPDIR:-/tmp}/staged-unlock.XXXXXX")
trap 'rm -rf -- "$DOOR"' EXIT HUP INT TERM
mkdir "$DOOR/tools"
cp "$HERE/unlock-test-custody.mjs" "$HERE/test-scratch-marker.mjs" "$HERE/test-custody-route.mjs" "$DOOR/tools/"
docker cp "$DOOR/tools" "$CONTAINER:/app/" >/dev/null
docker exec "$CONTAINER" node tools/unlock-test-custody.mjs "$STATE"
