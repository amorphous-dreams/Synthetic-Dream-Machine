#!/usr/bin/env bash
# battery.sh [--budget-gb <n>] <command...> — a heavy local battery on this box, admitted by measured headroom
# (mixed-model-swarm#/the-battery). A lane LEAD runs its batch battery through it; a walled Codex seat never does (the lock
# sits outside its write roots) and runs its single-file checks bare. CI stays the full verdict; the local battery reads only
# what a lane touched.
#
# The door: LARES_BATTERY_LOCK, else <passwd home>/.lares-scratch/.battery.lock. NEVER $HOME: a lead runs under a scratch
# HOME, and a $HOME-relative door would give each lead its own floor and admit past the shared bytes.
#   battery.sh --lock-path    prints the door's path and exits.
#   battery.sh --floor-dir    prints the floor's directory (`.floor` beside the door) and exits.
# THE HEADROOM (the disk's write churn crashed the host twice; that measured hazard sets the only limit): no count of runs
# stands. A run takes the door, and `node tools/floor-run.mjs --admit` reads C: free bytes against the disk floor (less every
# live run's unspent budget and this run's own, `--budget-gb`, 4 by default) and the load against the cores; it answers once
# the readings admit and writes this run's reservation (`.floor/run-<pid>.json`); the run takes its own lock
# (`.floor/run-<pid>.lock`, keyed by this shell's pid) and gives the door back. The door serialises only the admission read,
# never the runs: every admitted run flies at once. Without node no reading stands, so the run admits unread (the floor-run
# meter needs node too).
# Exit 64: the door or the floor cannot open (or flock failed); the command never runs unlocked. Otherwise the command's own
# exit code.
#
# THE FLOOR (mandate/floor-gate-1): a run's own lock IS its place on the floor. It re-enters: a run already inside a held run
# (an ancestor took a run lock: tools/floor-lock.mjs reads the kernel's lock table) runs the command at once, since a second
# take would wait on the door its own ancestor's admission may still hold and read that ancestor as a neighbour. The heavy
# tools (provision-worktree, bench-gate, floor-run) refuse outside it; `node tools/floor-run.mjs -- <command>` takes it and
# meters the run's bytes.
set -uo pipefail
if [ -n "${LARES_BATTERY_LOCK:-}" ]; then
  case "$LARES_BATTERY_LOCK" in /*) ;; *) echo "battery: REFUSED, LARES_BATTERY_LOCK must be an absolute path (two working directories would pick two locks): $LARES_BATTERY_LOCK" >&2; exit 64;; esac
  LOCK=$LARES_BATTERY_LOCK
else
  PW_HOME=$(getent passwd "$(id -u)" | cut -d: -f6)
  [ -n "$PW_HOME" ] || { echo "battery: REFUSED, the passwd lookup for the lock's home failed; set an absolute LARES_BATTERY_LOCK" >&2; exit 64; }
  LOCK=$PW_HOME/.lares-scratch/.battery.lock
fi
FLOOR=$(dirname -- "$LOCK")/.floor
[ "${1:-}" = "--lock-path" ] && { echo "$LOCK"; exit 0; }
[ "${1:-}" = "--floor-dir" ] && { echo "$FLOOR"; exit 0; }
BUDGET_GB=4
if [ "${1:-}" = "--budget-gb" ]; then
  [ -n "${2:-}" ] || { echo "battery: --budget-gb wants a value" >&2; exit 2; }
  BUDGET_GB=$2; shift 2
fi
HERE=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
if command -v node >/dev/null 2>&1 && LARES_BATTERY_LOCK=$LOCK node "$HERE/floor-lock.mjs" --held >/dev/null 2>&1; then
  echo "battery: the floor already stands held by this run; running inside it" >&2
  "$@"; exit $?
fi
# Probe the door and the floor first: an unopenable one refuses at once and the command never runs unlocked.
{ exec 8>"$LOCK"; } 2>/dev/null || { echo "battery: REFUSED, the lock $LOCK cannot open here (a walled seat?); run single-file checks bare, and leave the battery to the lane lead" >&2; exit 64; }
RUN_LOCK=$FLOOR/run-$$.lock
mkdir -p -- "$FLOOR" 2>/dev/null && { exec 9>"$RUN_LOCK"; } 2>/dev/null || { echo "battery: REFUSED, the floor $FLOOR cannot open here" >&2; exit 64; }
trap 'rm -f -- "$RUN_LOCK" "$FLOOR/run-$$.json"' EXIT
echo "battery: waiting for headroom ($(date +%T))" >&2
# The door: one admission read at a time (flock decides, the kernel's answer). floor-run --admit holds it while the readings
# refuse (its pace only spaces the reads; each reading decides) and answers once they admit.
flock 8 || { echo "battery: REFUSED, flock on $LOCK failed" >&2; exit 64; }
if command -v node >/dev/null 2>&1; then
  node "$HERE/floor-run.mjs" --admit "$FLOOR" "$$" "$BUDGET_GB" || { echo "battery: REFUSED, the headroom read failed" >&2; exit 64; }
fi
flock -n 9 || { echo "battery: REFUSED, flock on $RUN_LOCK failed" >&2; exit 64; }
exec 8>&-
echo "battery: holding the box, run $$ ($(date +%T))" >&2
"$@"; exit $?
