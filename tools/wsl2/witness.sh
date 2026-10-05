#!/usr/bin/env bash
# witness — read the WSL2 stand against lar:///ha.ka.ba/wsl2/setup. Writes nothing.
#
# Each row names the intent, the reading, and ok/drift. Exit 1 on any drift so CI or a
# pre-session hook can refuse to start agents on an unguarded VM.
set -uo pipefail
rc=0
row() { # row <ok|drift> <intent> <reading>
  if [[ $1 == ok ]]; then printf '  \e[32m%-6s\e[0m %-44s %s\n' ok "$2" "$3"
  else printf '  \e[31m%-6s\e[0m %-44s %s\n' drift "$2" "$3"; rc=1; fi
}
gb() { awk -v kb="$1" 'BEGIN{printf "%.0f", kb/1048576}'; }

grep -qi microsoft /proc/version || { echo "not WSL2"; exit 0; }

mem_kb=$(awk '/MemTotal/{print $2}' /proc/meminfo); swap_kb=$(awk '/SwapTotal/{print $2}' /proc/meminfo)
# powershell.exe by absolute path: appendWindowsPath=false (our intent) takes it off $PATH
PS_EXE=$(command -v powershell.exe 2>/dev/null || echo /mnt/c/Windows/System32/WindowsPowerShell/v1.0/powershell.exe)
host_kb=$("$PS_EXE" -NoProfile -Command '[int64]((Get-CimInstance Win32_ComputerSystem).TotalPhysicalMemory/1KB)' 2>/dev/null | tr -d '\r' | cut -d. -f1)
if [[ "$host_kb" =~ ^[0-9]+$ ]]; then
  # intent: VM holds at most ~5/8 of the host (Windows keeps a quarter-plus) AND is not sitting at the default half.
  # MemTotal runs 1-3% under the configured ceiling, so "the default half" is a band of ±5% around host/2, never an equality.
  half_kb=$(( host_kb / 2 ))
  if (( mem_kb * 8 <= host_kb * 5 + host_kb / 20 )) && ! (( mem_kb > half_kb - half_kb / 20 && mem_kb < half_kb + half_kb / 20 )); then
    row ok "memory= set, not the default half" "$(gb "$mem_kb") GB of $(gb "$host_kb") GB host"
  else row drift "memory= set, not the default half" "$(gb "$mem_kb") GB of $(gb "$host_kb") GB host (default = half; .wslconfig waits on wsl --shutdown?)"; fi
else row drift "memory= set, not the default half" "host RAM unreadable via $PS_EXE — is [interop] enabled=true?"; fi
(( swap_kb <= 4300000 )) && row ok "swap= ≤ 4 GB" "$(gb $swap_kb) GB" || row drift "swap= ≤ 4 GB" "$(gb $swap_kb) GB — buys the kernel time to thrash"

if [[ "$(systemctl is-active earlyoom 2>/dev/null)" == active ]]; then
  args=$(tr '\0' ' ' < /proc/"$(systemctl show -p MainPID --value earlyoom)"/cmdline 2>/dev/null)
  [[ "$args" == *"-m 5"* || "$args" == *"-m5"* ]] && row ok "earlyoom active, -m 5" "$args" || row drift "earlyoom active, -m 5" "running with: $args"
else s=$(systemctl is-active earlyoom 2>/dev/null); row drift "earlyoom active" "${s:-not-installed}"; fi

sw=$(sysctl -n vm.swappiness 2>/dev/null); (( ${sw:-999} <= 10 )) && row ok "vm.swappiness ≤ 10" "$sw" || row drift "vm.swappiness ≤ 10" "${sw:-unreadable}"

[[ "$(systemctl is-system-running 2>/dev/null)" =~ running|degraded ]] && row ok "systemd running" "$(systemctl is-system-running)" || row drift "systemd running" "off — /etc/wsl.conf [boot] systemd=true, then wsl --shutdown"

n=$(echo "$PATH" | tr ':' '\n' | grep -c '^/mnt/'); (( n <= 6 )) && row ok "Windows PATH entries ≤ 6" "$n" || row drift "Windows PATH entries ≤ 6" "$n on \$PATH ride 9p — appendWindowsPath=false"

root_fs=$(findmnt -no FSTYPE,OPTIONS / 2>/dev/null); [[ "$root_fs" == ext4* && "$root_fs" == *discard* ]] && row ok "root ext4 + discard" "$root_fs" || row drift "root ext4 + discard" "$root_fs"

repo="$(cd "$(dirname "$0")/../.." && pwd)"; [[ "$repo" == /mnt/* ]] && row drift "repo on ext4, not /mnt" "$repo" || row ok "repo on ext4, not /mnt" "$repo"

[[ -x "$HOME/.venv/bin/python" ]] && row ok "~/.venv present" "$("$HOME/.venv/bin/python" --version 2>&1)" || row drift "~/.venv present" "missing"

exit $rc
