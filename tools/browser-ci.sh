#!/bin/sh
# browser-ci — the HOST driver for docker-compose.browser-ci.yml (a node plus a disposable Playwright runner).
#
#   browser-ci.sh up                  build, seed through the test door, stand the node, light one synthetic face
#                                     (`persona new 0`), restart so the vessel stands as a Lararium, wait healthy
#   browser-ci.sh admit <joinee-key>  `lares device-admit --joinee-key …` inside the node; prints the carriage line
#   browser-ci.sh ingest <path>       copy a repo carrier (bags/<bag>/<w.w.w>/…) into the scratch workspace volume and
#                                     `lares ingest --source … --to <bag uri> --apply --yes` (default bag lar:///ha.ka.ba/bags/lares; BROWSER_CI_BAG overrides)
#   browser-ci.sh qa <cmd…>           run <cmd> in the disposable Chromium runner (repo at /repo, node at http://lares:4321)
#   browser-ci.sh down                remove containers, network AND the scratch volumes
#
# The host script alone touches Docker. No container receives the Docker socket; the qa runner cannot issue an
# admit. BROWSER_CI_PORT (default 5401) publishes the node on loopback; BROWSER_CI_PROJECT names the compose
# project (default lares-browser-ci). Face names are synthetic.
set -eu

HERE=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
ROOT=$(dirname -- "$HERE")
FILE="${BROWSER_CI_COMPOSE_FILE:-$ROOT/docker-compose.browser-ci.yml}"
FACE="${BROWSER_CI_FACE:-ci-face}"
CLI="packages/lares-cli/bin/lares.mjs"

die() { printf 'browser-ci: %s\n' "$*" >&2; exit 2; }
compose() { docker compose ${BROWSER_CI_PROJECT:+-p "$BROWSER_CI_PROJECT"} -f "$FILE" "$@"; }
lares() { compose exec -T lares node "$CLI" "$@"; }

[ "$#" -gt 0 ] || die "usage: browser-ci.sh up|admit|ingest|qa|down"
verb=$1; shift

case "$verb" in
  up)
    compose build lares
    compose --profile seed run --rm seed
    compose up -d lares
    compose up -d --wait lares
    lares persona new 0 --name "$FACE"
    compose restart lares
    compose up -d --wait lares ;;
  admit)
    [ "$#" -eq 1 ] || die "admit wants one joinee key"
    lares device-admit --joinee-key "$1" ;;
  ingest)
    [ "$#" -eq 1 ] || die "ingest wants one path inside the repo"
    case "$1" in /*|*..*) die "ingest path stays relative to the repo, without .." ;; esac
    [ -f "$ROOT/$1" ] || die "no carrier at $1"
    # The target bag is one the vessel holds admin on; carrier URIs derive from the path, not from this bag.
    BAG=${BROWSER_CI_BAG:-lar:///ha.ka.ba/bags/lares}
    cid=$(compose ps -q lares)
    [ -n "$cid" ] || die "the node does not stand; run up first"
    # `docker cp` into the named workspace volume's mount: the node reads /workspace/<path>.
    docker exec "$cid" mkdir -p "/workspace/$(dirname -- "$1")"
    docker cp "$ROOT/$1" "$cid:/workspace/$1"
    lares ingest --source "/workspace/$1" --to "$BAG" --apply --yes ;;
  qa)
    [ "$#" -gt 0 ] || die "qa wants a command"
    compose --profile qa run --rm -T qa "$@" ;;
  down)
    compose --profile seed --profile qa down -v --remove-orphans "$@" ;;
  *) die "unknown verb $verb" ;;
esac
