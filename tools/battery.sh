#!/usr/bin/env bash
# battery.sh <command...> — two heavy local batteries at a time on this box (mixed-model-swarm#/the-battery).
# A lane LEAD runs its batch battery through it; a walled Codex seat never does (the lock sits outside its write roots)
# and runs its single-file checks bare. CI stays the full verdict; the local battery reads only what a lane touched.
#
# The lock: LARES_BATTERY_LOCK, else <passwd home>/.lares-scratch/.battery.lock. NEVER $HOME: a lead runs under a scratch
# HOME, and a $HOME-relative lock would give each lead its own lock and serialize nothing.
#   battery.sh --lock-path    prints slot 1's lock path and exits.
#   battery.sh --lock-paths   prints every slot's lock path, one per line, and exits.
# TWO SLOTS (operator, 2026-11-25): slot 1 is the lock above, slot 2 sits beside it with `-2` before the `.lock` suffix
# (`.battery-2.lock`). A run takes the first free slot, so two heavy runs fly at once and a third waits for either.
# Exit 64: the lock cannot open (or flock failed); the command never runs unlocked. Otherwise the command's own exit code.
#
# THE FLOOR (mandate/floor-gate-1): these locks ARE the test floor's two slots. It re-enters per slot: a run already inside a
# held slot (an ancestor took that lock: tools/floor-lock.mjs reads the kernel's lock table) runs the command at once, since a
# second flock on a fresh descriptor would wait on itself forever. The heavy tools (provision-worktree, bench-gate, floor-run)
# refuse outside it; `node tools/floor-run.mjs -- <command>` takes it and meters the run's bytes.
set -uo pipefail
if [ -n "${LARES_BATTERY_LOCK:-}" ]; then
  case "$LARES_BATTERY_LOCK" in /*) ;; *) echo "battery: REFUSED, LARES_BATTERY_LOCK must be an absolute path (two working directories would pick two locks): $LARES_BATTERY_LOCK" >&2; exit 64;; esac
  LOCK=$LARES_BATTERY_LOCK
else
  PW_HOME=$(getent passwd "$(id -u)" | cut -d: -f6)
  [ -n "$PW_HOME" ] || { echo "battery: REFUSED, the passwd lookup for the lock's home failed; set an absolute LARES_BATTERY_LOCK" >&2; exit 64; }
  LOCK=$PW_HOME/.lares-scratch/.battery.lock
fi
SLOTS=2
slot_path() { # $1 = slot number
  if [ "$1" -eq 1 ]; then echo "$LOCK"
  else case "$LOCK" in *.lock) echo "${LOCK%.lock}-$1.lock";; *) echo "$LOCK-$1";; esac; fi
}
[ "${1:-}" = "--lock-path" ] && { echo "$LOCK"; exit 0; }
[ "${1:-}" = "--lock-paths" ] && { n=1; while [ "$n" -le "$SLOTS" ]; do slot_path "$n"; n=$((n+1)); done; exit 0; }
HERE=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
if command -v node >/dev/null 2>&1 && LARES_BATTERY_LOCK=$LOCK node "$HERE/floor-lock.mjs" --held >/dev/null 2>&1; then
  echo "battery: the floor already stands held by this run; running inside it" >&2
  "$@"; exit $?
fi
# Probe every slot's open first: an unopenable lock refuses at once and the command never runs unlocked.
n=1
while [ "$n" -le "$SLOTS" ]; do
  P=$(slot_path "$n")
  { exec 9>"$P"; } 2>/dev/null || { echo "battery: REFUSED, the lock $P cannot open here (a walled seat?); run single-file checks bare, and leave the battery to the lane lead" >&2; exit 64; }
  exec 9>&-
  n=$((n+1))
done
echo "battery: waiting for the box ($(date +%T))" >&2
# The first free slot wins; flock -n decides each take (the kernel's answer), the short sleep between passes only paces.
while :; do
  n=1
  while [ "$n" -le "$SLOTS" ]; do
    P=$(slot_path "$n")
    { exec 9>"$P"; } 2>/dev/null || { echo "battery: REFUSED, the lock $P cannot open here" >&2; exit 64; }
    if flock -n 9; then
      echo "battery: holding the box, slot $n ($(date +%T))" >&2
      "$@"; exit $?
    fi
    exec 9>&-
    n=$((n+1))
  done
  sleep 0.2
done
