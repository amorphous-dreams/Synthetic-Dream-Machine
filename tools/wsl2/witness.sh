#!/usr/bin/env bash
# witness — read the WSL2 stand against lar:///ha.ka.ba/wsl2/setup. Writes nothing.
#
# Each row names the intent, the reading, and ok/drift. Exit 1 on any drift so CI or a
# pre-session hook can refuse to start agents on an unguarded VM.
set -uo pipefail
rc=0
# A hook's `env -i` carries no HOME; the venv row reads the passwd home rather than exiting on an unbound variable.
: "${HOME:=$(getent passwd "$(id -un)" | cut -d: -f6)}"
row() { # row <ok|drift> <intent> <reading>
  if [[ $1 == ok ]]; then printf '  \e[32m%-6s\e[0m %-44s %s\n' ok "$2" "$3"
  else printf '  \e[31m%-6s\e[0m %-44s %s\n' drift "$2" "$3"; rc=1; fi
}
gb() { awk -v kb="$1" 'BEGIN{printf "%.0f", kb/1048576}'; }

# A witness that is not on WSL2 has nothing true to say about the stand; a hook gating on it must not read that as green.
grep -q 'microsoft-standard' /proc/version || { echo "not WSL2 (a WSL 1 distro? from Windows: wsl --set-version <DistroName> 2)"; exit 1; }

mem_kb=$(awk '/MemTotal/{print $2}' /proc/meminfo); swap_kb=$(awk '/SwapTotal/{print $2}' /proc/meminfo)
# Windows binaries by absolute path: appendWindowsPath=false (our intent) takes them off $PATH.
# pwsh (PowerShell 7) is the runbook engine, read at its two install paths: the MSI's Program Files, or the MSIX's
# app-execution alias under the profile (winget installs the MSIX by default since 7.6.0). The host read goes
# through Windows PowerShell 5.1, which every Windows carries.
WIN_PROFILE=$(/mnt/c/Windows/System32/cmd.exe /c 'echo %LOCALAPPDATA%' 2>/dev/null | tr -d '\r')
PWSH_EXE="/mnt/c/Program Files/PowerShell/7/pwsh.exe"
[[ -x "$PWSH_EXE" ]] || PWSH_EXE="$(wslpath -u "${WIN_PROFILE:-C:\\nowhere}" 2>/dev/null)/Microsoft/WindowsApps/pwsh.exe"
PS_EXE=/mnt/c/Windows/System32/WindowsPowerShell/v1.0/powershell.exe
# The host read is bounded: a wedged interop must not hang a pre-session hook.
if [[ -x "$PWSH_EXE" ]]; then row ok "PowerShell 7 (pwsh) on the host" "$PWSH_EXE"
else row drift "PowerShell 7 (pwsh) on the host" "absent — winget install --id Microsoft.PowerShell; stand-windows.ps1 runs degraded under 5.1"; fi
host_kb=$(timeout 30 "$PS_EXE" -NoProfile -Command '[int64]((Get-CimInstance Win32_ComputerSystem).TotalPhysicalMemory/1KB)' 2>/dev/null | tr -d '\r' | cut -d. -f1)
if [[ "$host_kb" =~ ^[0-9]+$ ]]; then
  # intent: VM holds at most ~5/8 of the host (Windows keeps a quarter-plus) AND is not sitting at the default half.
  # MemTotal runs 1-3% under the configured ceiling, so "the default half" is a band of ±5% around host/2, never an equality.
  half_kb=$(( host_kb / 2 ))
  if (( mem_kb * 8 <= host_kb * 5 + host_kb / 20 )) && ! (( mem_kb > half_kb - half_kb / 20 && mem_kb < half_kb + half_kb / 20 )); then
    row ok "memory= set, not the default half" "$(gb "$mem_kb") GB of $(gb "$host_kb") GB host"
  else row drift "memory= set, not the default half" "$(gb "$mem_kb") GB of $(gb "$host_kb") GB host (default = half) — stand-windows.ps1 as the owning Windows account, then wsl --shutdown (a stand that reads already means the shutdown is still owed)"; fi
else row drift "memory= set, not the default half" "host RAM unreadable via $PS_EXE — is [interop] enabled=true?"; fi
if (( swap_kb <= 4300000 )); then
  row ok "swap= ≤ 4 GB" "$(gb "$swap_kb") GB"
else
  row drift "swap= ≤ 4 GB" "$(gb "$swap_kb") GB — buys the kernel time to thrash"
fi

s=$(systemctl is-active earlyoom 2>/dev/null)
if [[ $s == active ]]; then
  # cmdline is NUL-separated, so every argument ends in a space once translated: `-m 50` must not pass as `-m 5`.
  args=$(tr '\0' ' ' < /proc/"$(systemctl show -p MainPID --value earlyoom)"/cmdline 2>/dev/null)
  if [[ "$args" == *"-m 5 "* || "$args" == *"-m5 "* ]]; then
    row ok "earlyoom active, -m 5" "$args"
  else
    row drift "earlyoom active, -m 5" "running with: $args"
  fi
else row drift "earlyoom active" "$s"; fi

sw=$(sysctl -n vm.swappiness 2>/dev/null)
if (( ${sw:-999} <= 10 )); then row ok "vm.swappiness ≤ 10" "$sw"
else row drift "vm.swappiness ≤ 10" "${sw:-unreadable}"; fi

systemd_state=$(systemctl is-system-running 2>/dev/null)
if [[ "$systemd_state" =~ running|degraded ]]; then row ok "systemd running" "$systemd_state"
else row drift "systemd running" "off — /etc/wsl.conf [boot] systemd=true, then wsl --shutdown"; fi

n=$(echo "$PATH" | tr ':' '\n' | grep -c '^/mnt/')
if (( n <= 6 )); then row ok "Windows PATH entries ≤ 6" "$n"
else row drift "Windows PATH entries ≤ 6" "$n on \$PATH ride 9p — appendWindowsPath=false, then wsl --shutdown"; fi

root_fs=$(findmnt -no FSTYPE,OPTIONS / 2>/dev/null)
if [[ "$root_fs" == ext4* && "$root_fs" == *discard* ]]; then row ok "root ext4 + discard" "$root_fs"
else row drift "root ext4 + discard" "$root_fs"; fi

repo="$(cd "$(dirname "$0")/../.." && pwd)"
if [[ "$repo" == /mnt/* ]]; then row drift "repo on ext4, not /mnt" "$repo"
else row ok "repo on ext4, not /mnt" "$repo"; fi

if [[ -x "$HOME/.venv/bin/python" ]]; then row ok "$HOME/.venv present" "$("$HOME/.venv/bin/python" --version 2>&1)"
else row drift "$HOME/.venv present" "missing"; fi

# the container host for the lararium stack — lar:///ha.ka.ba/wsl2/containers rules rootful Engine + compose in the distro
cg=$(stat -fc %T /sys/fs/cgroup 2>/dev/null)
if [[ "$cg" == cgroup2fs ]]; then row ok "cgroup v2" "$cg"
else row drift "cgroup v2" "${cg:-unreadable} — rootful dockerd needs the unified hierarchy"; fi
if command -v docker >/dev/null 2>&1; then
  if cv=$(timeout 15 docker compose version 2>/dev/null); then row ok "docker compose plugin" "$cv"
  else row drift "docker compose plugin" "docker present, compose absent — sudo apt install docker-compose-v2 (archive docker.io) or docker-compose-plugin (Docker's repo docker-ce)"; fi
else row drift "docker compose plugin" "docker absent — see stand-linux.sh step 5b"; fi

exit $rc
