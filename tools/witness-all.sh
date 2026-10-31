#!/usr/bin/env bash
# witness-all — run every witness, then report. Never short-circuit.
#
# Chaining them with `&&` would let a red in the first HIDE the second entirely, so a long-standing
# failure anywhere would quietly shrink the check to nothing — the same silence these witnesses exist to
# break. Each runs, each reports, and the exit is the worst of them.
#
# ── THE ROSTER IS GLOBBED, AND ITS EXCLUSIONS ARE NAMED ─────────────────────────────────────────
# A hand-kept list of witnesses cannot notice a witness it was never told about. Measured: this file
# named nineteen while `tools/` held twenty-five, and one of the six left out — mesh-coverage — needs
# nothing but a shell and had simply never been added, so it ran in no gate at all. A new witness now
# enrols itself by existing; leaving one out is a DECLARED act with its reason beside it.
set -uo pipefail
cd "$(dirname "$0")/.." || exit 1

# Witnesses that stand real containers or drive a real browser. They are entry points of their own
# (`tools/civic-witness.sh`, `tools/browser-weld-witness.sh`) because they need a runtime this script
# must not assume — not because they matter less.
declare -A HELD_OUT=(
  [civic-witness]="stands containerized vessels — run it directly"
  [harbor-walk-witness]="stands a docker vessel"
  [crossing-witness]="stands a docker-compose crossing matrix"
  [herm-mesh-witness]="stands the docker-compose relay mesh"
  [herm-mesh-roll-witness]="stands the docker-compose relay mesh and rolls A's charter between its joins"
  [mesh-scenarios]="stands the docker-compose mesh on the product image, scenario by scenario — needs docker"
  [browser-weld-witness]="drives a real browser against a standing web surface"
  [tree-clean-witness]="the e2e set runs through the CI shards; a local run stages vessels and reads any write into the tracked tree as red"
  [witness-all]="this script"
)

# Witnesses in the default roster that still stand docker compose services or a container image. `--static` leaves
# them to CI and the train, which carry docker, and runs every other witness; a bare run stays whole.
declare -A DOCKER=(
  [household-https-witness]="stands the compose issuer and terminator with a Pebble test authority on the product image — needs docker"
  [household-resolver-witness]="stands the compose records check and resolver — needs docker"
)

# Witnesses heavy enough to run in a CI cell of their own (`tools/ci-cells.mjs` names the cell of each). A bare run
# still runs them all; `--except-apart` leaves them to their cells, and `--only <name>` runs exactly one of them.
APART=(contract-witness)

mode=all
static=0
only=""
list=0
while [ "$#" -gt 0 ]; do
  case "$1" in
    --list) list=1 ;;
    --except-apart) mode=except ;;
    --static) static=1 ;;
    --only) mode=only; only="${2:-}"; shift ;;
    *) echo "witness-all: unknown argument $1" >&2; exit 2 ;;
  esac
  shift
done
is_apart() { local a; for a in "${APART[@]}"; do [ "$a" = "$1" ] && return 0; done; return 1; }
if [ "$mode" = only ] && ! is_apart "$only"; then
  echo "witness-all: --only names '$only', which is no apart witness (${APART[*]})" >&2
  exit 2
fi

status=0
held=()
apart_skipped=()
docker_skipped=()
order=()
declare -A exit_of=()
declare -A seen=()
for path in tools/*witness*.sh; do
  w="$(basename "$path" .sh)"
  seen[$w]=1
  if [ -n "${HELD_OUT[$w]:-}" ]; then held+=("$w — ${HELD_OUT[$w]}"); continue; fi
  if [ "$static" -eq 1 ] && [ -n "${DOCKER[$w]:-}" ]; then docker_skipped+=("$w — ${DOCKER[$w]}"); continue; fi
  case "$mode" in
    except) is_apart "$w" && { apart_skipped+=("$w"); continue; } ;;
    only) [ "$w" = "$only" ] || continue ;;
  esac
  if [ "$list" -eq 1 ]; then echo "$w"; continue; fi
  echo "── $w ──"
  "$path"
  rc=$?
  order+=("$w")
  exit_of[$w]=$rc
  [ "$rc" -gt "$status" ] && status="$rc"
done
# AN ENTRY POINT OUTSIDE THE GLOB IS STILL NAMED. `mesh-scenarios` carries no "witness" in its name, so
# the glob never sees it; a held-out declared here but never listed would be a silent omission wearing
# a declaration. Every declared hold-out that stands as a file is reported, glob or no glob.
for w in "${!HELD_OUT[@]}"; do
  [ -n "${seen[$w]:-}" ] && continue
  [ -f "tools/$w.sh" ] && held+=("$w — ${HELD_OUT[$w]}")
done

[ "$list" -eq 1 ] && exit 0

if [ "$mode" = except ] && [ "${#apart_skipped[@]}" -gt 0 ]; then
  echo "── run apart, in cells of their own ──"
  printf '  %s\n' "${apart_skipped[@]}"
fi

if [ "${#docker_skipped[@]}" -gt 0 ]; then
  echo "── docker witnesses left to CI and the train (--static) ──"
  printf '  %s\n' "${docker_skipped[@]}"
fi

if [ "$mode" != only ] && [ "${#held[@]}" -gt 0 ]; then
  echo "── held out of this run ──"
  printf '  %s\n' "${held[@]}"
fi

# THE VERDICT TABLE IS THE COUNTABLE SURFACE. A reader who wants to know how many reds stand should
# never have to scroll a transcript to find out — this table is the one place that count lives,
# one line per witness that ran, each line reporting the exit code the witness itself returned.
echo "── verdict ──"
for w in "${order[@]}"; do
  rc="${exit_of[$w]}"
  if [ "$rc" -eq 0 ]; then verdict="ok "; else verdict="RED"; fi
  printf '  %-28s %s  exit %s\n' "$w" "$verdict" "$rc"
done

[ "$status" -eq 0 ] && echo "witness-all: every witness clean"
exit "$status"
