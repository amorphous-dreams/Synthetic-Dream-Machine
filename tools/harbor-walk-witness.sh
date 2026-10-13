#!/bin/sh
# harbor-walk-witness — the container vessel's first walk, through the host shim alone (tools/lares-container.sh).
#
#   LEG 1  the door before `up`: found → persona new → persona wear → up → unlock. The vessel boots once and rests
#          at the floor holding no key; the unlock composes it in place as a Lararium wearing the face, with its
#          working layer attached, and the workspace mount receives a projected carrier.
#   LEG 2  a face lit after `up`: found → up → unlock (a faceless vessel stands as a herm) → persona new. The shim
#          reads the CLI's standing verdict and restarts the vessel itself; no restart gets typed. The restart
#          returns the vessel to the floor, and a second unlock composes the Lararium.
#   CONTROL  a reading verb after the lift restarts nothing; a sovereign verb at the floor refuses and names
#            `lares vault unlock`.
#
# Each leg founds through the TEST door on its own `mktemp` state directory (tools/test-scratch-marker.mjs, then
# tools/seed-test-custody.mjs, mounted read-only into a one-shot container of the image; the image itself carries
# neither tool). EVERY BOOT RESTS AT THE FLOOR, and only a terminal opens a vessel key; the witness holds none, so
# it opens each standing boot through the same test door (tools/unlock-staged-container.sh: the door's files ride
# into the standing container, and the unlock frame goes out under the published test route; the door refuses
# any root without the scratch marker). The witness removes only the containers of its own compose project and
# the directories it made.
#
#   HARBOR_PROJECT  compose project name (default lares-harbor-walk)
#   HARBOR_PORT     loopback port the vessel publishes (default 5460; 5400-5499)
#   HARBOR_IMAGE    the product image (default lares-surface:local; built when the tag stands absent)
set -eu

HERE=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
ROOT=$(dirname -- "$HERE")
PROJECT=${HARBOR_PROJECT:-lares-harbor-walk}
PORT=${HARBOR_PORT:-5460}
IMAGE=${HARBOR_IMAGE:-lares-surface:local}
FILE="$ROOT/docker-compose.surface.yml"
FAILURES=0
SCRATCH_STATE=""
SCRATCH_WORKSPACE=""

case "$PORT" in 54[0-9][0-9]) ;; *) printf 'harbor-walk-witness: port %s lies outside 5400-5499\n' "$PORT" >&2; exit 2 ;; esac

LARES_UID=$(id -u); LARES_GID=$(id -g)
export COMPOSE_PROJECT_NAME="$PROJECT" LARES_PORT="$PORT" LARES_IMAGE="$IMAGE" LARES_UID LARES_GID

compose() { docker compose -f "$FILE" "$@"; }
lares() { "$ROOT/tools/lares-container.sh" "$@"; }

drop_scratch() {
  compose down --remove-orphans >/dev/null 2>&1 || :
  [ -z "$SCRATCH_STATE" ] || rm -rf -- "$SCRATCH_STATE"
  [ -z "$SCRATCH_WORKSPACE" ] || rm -rf -- "$SCRATCH_WORKSPACE"
  SCRATCH_STATE=""; SCRATCH_WORKSPACE=""
}
trap drop_scratch EXIT HUP INT TERM

# A fresh state and workspace, staged through the test door.
new_scratch() {
  SCRATCH_STATE=$(mktemp -d "${TMPDIR:-/tmp}/harbor-state.XXXXXX")
  SCRATCH_WORKSPACE=$(mktemp -d "${TMPDIR:-/tmp}/harbor-workspace.XXXXXX")
  export LARES_STATE="$SCRATCH_STATE" LARES_WORKSPACE="$SCRATCH_WORKSPACE"
  docker run --rm --name "$PROJECT-seed" --user "$LARES_UID:$LARES_GID" \
    -v "$LARES_STATE:/state" -v "$ROOT/tools:/app/tools:ro" --tmpfs /tmp:mode=1777 \
    --entrypoint sh "$IMAGE" -ec \
    'node tools/test-scratch-marker.mjs /state && node tools/seed-test-custody.mjs /state'
}

# Open the standing vessel's key through the test door and print the daemon's answer.
unlock_staged() { "$ROOT/tools/unlock-staged-container.sh" "$(compose ps -q lares)"; }

result() {
  label=$1; shift
  if "$@"; then printf 'PASS %s\n' "$label"
  else printf 'FAIL %s\n' "$label"; FAILURES=$((FAILURES + 1)); fi
}
contains() { printf '%s' "$1" | grep -q -- "$2"; }
not_contains() { ! contains "$1" "$2"; }
started_at() { docker inspect -f '{{.State.StartedAt}}' "$(compose ps -q lares)"; }
# The log of the vessel's CURRENT boot alone: an earlier boot's lines never answer for this one.
boot_log() { docker logs --since "$(started_at)" "$(compose ps -q lares)" 2>&1; }

if [ -n "$(compose ps -a -q 2>/dev/null)" ]; then
  printf 'harbor-walk-witness: project %s already stands; pick another HARBOR_PROJECT\n' "$PROJECT" >&2; exit 2
fi
if ! docker image inspect "$IMAGE" >/dev/null 2>&1; then
  docker build -f "$ROOT/Dockerfile" --target serve -t "$IMAGE" "$ROOT"
fi

# The scanners prove themselves on a known positive before any leg trusts them.
contains 'live — wiki: lares' 'live — wiki:' || { printf 'harbor-walk-witness: the contains scanner matches nothing\n' >&2; exit 2; }
not_contains 'live — wiki-less wayfarer' 'live — wiki:' || { printf 'harbor-walk-witness: the not_contains scanner misreads\n' >&2; exit 2; }

printf '── leg 1: a face before up\n'
new_scratch
lares found
lares persona new 0 --name ci-face
lares persona wear 0
lares up
floor=$(boot_log)
refused=$(lares persona list --json 2>&1 || :)
result 'leg 1: the boot rests at the floor holding no key'      contains "$floor" 'stands holding no vessel key'
result 'leg 1: the floor composes no Lararium'                  not_contains "$floor" 'live — wiki:'
result 'control: a sovereign verb at the floor names the unlock' contains "$refused" 'lares vault unlock'
before=$(started_at)
opened=$(unlock_staged 2>&1 || :)
result 'leg 1: the unlock opens the key onto a hearth'          contains "$opened" '"standing":"hearth"'
personas=$(lares persona list --json)
log=$(boot_log)
result 'leg 1: the vessel wears face zero'                      contains "$personas" '"active":0'
result 'leg 1: the unlocked boot stands as a Lararium'          contains "$log" 'live — wiki:'
result 'leg 1: the working layer attaches'                      contains "$log" 'working layer attached'
result 'leg 1: the unlock restarted no container'               test "$before" = "$(started_at)"
result 'leg 1: the engine restarted nothing'                    test "$(docker inspect -f '{{.RestartCount}}' "$(compose ps -q lares)")" = 0
# A carrier ingested into a canon bag projects under the workspace mount.
mkdir -p "$SCRATCH_WORKSPACE/wikis/inbox/ha.ka.ba/lares/docs"
sed -e 's#ha.ka.ba/lares/docs/stable-founding-road#ha.ka.ba/lares/docs/harbor-walk-probe#g' -e 's#docs/stable-founding-road.mem#docs/harbor-walk-probe.mem#' \
  "$ROOT/bags/lares/ha.ka.ba/lares/docs/stable-founding-road.mem" > "$SCRATCH_WORKSPACE/wikis/inbox/ha.ka.ba/lares/docs/harbor-walk-probe.mem"
lares meme normalize /workspace/wikis/inbox/ha.ka.ba/lares/docs/harbor-walk-probe.mem >/dev/null
lares ingest --source /workspace/wikis/inbox/ha.ka.ba/lares/docs/harbor-walk-probe.mem --to lar:///ha.ka.ba/bags/lares --apply --yes >/dev/null
projected="$SCRATCH_WORKSPACE/bags/lares/ha.ka.ba/lares/docs/harbor-walk-probe.mem"
tries=0
while [ ! -f "$projected" ] && [ "$tries" -lt 30 ]; do sleep 1; tries=$((tries + 1)); done   # the bound only bounds the wait
result 'leg 1: a canon ingest projects under /workspace/bags'   test -f "$projected"
got=$(lares meme get lar:///ha.ka.ba/lares/docs/harbor-walk-probe --recipe lares 2>&1 || :)
result "leg 1: the wiki's recipe resolves the carrier"          contains "$got" '"ok":true'
drop_scratch

printf '── leg 2: a face after up\n'
new_scratch
lares found
lares up
opened=$(unlock_staged 2>&1 || :)
log=$(boot_log)
result 'leg 2: the faceless unlock opens the key onto a herm'   contains "$opened" '"standing":"herm"'
result 'leg 2: the faceless vessel stands as a herm'            contains "$log" 'live — wiki-less wayfarer'
result 'leg 2: the faceless vessel composes no Lararium'        not_contains "$log" 'live — wiki:'
before=$(started_at)
lares persona new 0 --name ci-face
after=$(started_at)
result 'leg 2: the shim restarted the vessel by itself'         test "$before" != "$after"
result 'leg 2: the restart returns the vessel to the floor'     contains "$(boot_log)" 'stands holding no vessel key'
opened=$(unlock_staged 2>&1 || :)
log=$(boot_log)
result 'leg 2: the second unlock opens the key onto a hearth'   contains "$opened" '"standing":"hearth"'
result 'leg 2: the lifted boot stands as a Lararium'            contains "$log" 'live — wiki:'
# A vessel that first booted at the waking floor still attaches its working layer once a face lifts it: a save
# through the daemon wiki lands in the working layer, never in the daemon's canon bag.
result 'leg 2: the working layer attaches after the lift'       contains "$log" 'working layer attached'
result 'leg 2: no working-layer attach refusal'              not_contains "$log" 'WorkingLayerAttachRefusal'
anchor=$(lares meme list --recipe default --json 2>&1 || :)
result 'leg 2: the daemon wiki writes into its working layer'   contains "$anchor" 'wikis/daemon/working'
before=$(started_at)
lares persona list --json >/dev/null
result 'control: a reading verb restarts nothing'               test "$before" = "$(started_at)"
drop_scratch

if [ "$FAILURES" -ne 0 ]; then printf 'FAIL harbor walk: %s assertion(s) failed\n' "$FAILURES"; exit 1; fi
printf 'PASS harbor walk: every assertion held\n'
