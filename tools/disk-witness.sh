#!/usr/bin/env bash
# disk-witness — read the disk beneath the house, then let tools/disk-guard.mjs judge it.
#
# The WSL VHD never shrinks and Linux `df /` cannot see the C: drive under it fill; the house filled C: twice. This witness
# prints what the guard weighs (C: free, the VHD file's size when the Windows side is readable, the built and Codex worktree
# counts, prunable records) and reads RED only under the guard's own limits (LARES_DISK_MIN_C_GB, LARES_DISK_MIN_ROOT_GB,
# LARES_DISK_MAX_WORKTREES, LARES_DISK_MAX_CODEX). Self-test: tools/disk-witness.test.mjs.
#
# On CI there is no /mnt/c, so the C: check skips by name; the runner's own `/` is a shared image with no VHD beneath it, so the
# `/` floor drops to zero there and the line says so.
set -uo pipefail
cd "$(dirname "$0")/.."

echo "── disk ──"
df -h / /mnt/c 2>/dev/null || df -h /

shopt -s nullglob
vhds=(/mnt/c/Users/*/AppData/Local/wsl/*/ext4.vhdx)
if [ "${#vhds[@]}" -eq 0 ]; then
  echo "VHD size: not visible (no readable ext4.vhdx under /mnt/c)"
else
  for v in "${vhds[@]}"; do
    bytes="$(stat -c %s "$v" 2>/dev/null || true)"
    if [ -n "$bytes" ]; then echo "VHD size: $((bytes / 1073741824))G ($bytes bytes) — $v"; else echo "VHD size: unreadable — $v"; fi
  done
fi

if [ -n "${CI:-}" ] && [ -z "${LARES_DISK_MIN_ROOT_GB:-}" ]; then
  export LARES_DISK_MIN_ROOT_GB=0
  echo "/ floor: 0G on CI (a runner's / carries no VHD beneath it)"
fi

node tools/disk-guard.mjs
