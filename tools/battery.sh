#!/usr/bin/env bash
# battery.sh <command...> — one heavy local battery at a time on this box (mixed-model-swarm#/the-battery).
# A lane LEAD runs its batch battery through it; a walled Codex seat never does (the lock sits outside its write roots)
# and runs its single-file checks bare. CI stays the full verdict; the local battery reads only what a lane touched.
#
# The lock: LARES_BATTERY_LOCK, else <passwd home>/.lares-scratch/.battery.lock. NEVER $HOME: a lead runs under a scratch
# HOME, and a $HOME-relative lock would give each lead its own lock and serialize nothing.
#   battery.sh --lock-path   prints the lock path and exits.
# Exit 64: the lock cannot open (or flock failed); the command never runs unlocked. Otherwise the command's own exit code.
set -uo pipefail
if [ -n "${LARES_BATTERY_LOCK:-}" ]; then
  LOCK=$LARES_BATTERY_LOCK
else
  PW_HOME=$(getent passwd "$(id -u)" | cut -d: -f6)
  LOCK=${PW_HOME:-/root}/.lares-scratch/.battery.lock
fi
[ "${1:-}" = "--lock-path" ] && { echo "$LOCK"; exit 0; }
exec 9>"$LOCK" 2>/dev/null || { echo "battery: REFUSED, the lock $LOCK cannot open here (a walled seat?); run single-file checks bare, and leave the battery to the lane lead" >&2; exit 64; }
echo "battery: waiting for the box ($(date +%T))" >&2
flock 9 || { echo "battery: REFUSED, flock failed on $LOCK" >&2; exit 64; }
echo "battery: holding the box ($(date +%T))" >&2
"$@"
