#!/usr/bin/env bash
# stand-linux — the Linux half of lar:///ha.ka.ba/wsl2/setup, idempotent by intent.
#
# Each step names what it INTENDS, reads what IS, and acts only on the difference. Run it twice
# and the second run reports every step `already`. Run it after a host change and only the drifted
# steps act. Nothing here touches Windows; stand-windows.ps1 carries that half.
#
# Needs sudo for steps 1-4. Pass --dry-run to see the plan with no writes.
#
# Steps: 1 /etc/wsl.conf · 2 earlyoom · 3 vm.swappiness · 4 (nothing further) · 5 ~/.venv · 6 witness
set -uo pipefail

DRY=0; [[ "${1:-}" == "--dry-run" ]] && DRY=1
SELF_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO="$(cd "$SELF_DIR/../.." && pwd)"

already() { printf '  \e[2m%-10s\e[0m %s\n' already "$1"; }
set_()    { printf '  \e[32m%-10s\e[0m %s\n' set "$1"; }
plan()    { printf '  \e[33m%-10s\e[0m %s\n' would-set "$1"; }
need()    { printf '  \e[31m%-10s\e[0m %s\n' needs-you "$1"; }
step()    { printf '\n\e[1m%s\e[0m\n' "$1"; }

# act <label> <cmd...> — run under sudo unless --dry-run
act() { local label="$1"; shift; if (( DRY )); then plan "$label"; else "$@" && set_ "$label"; fi; }

grep -qi microsoft /proc/version || { echo "not WSL2 — nothing to stand"; exit 0; }
if (( ! DRY )) && ! sudo -v; then echo "sudo required for steps 1-3; or re-run with --dry-run"; exit 1; fi

# ── 1 · /etc/wsl.conf ────────────────────────────────────────────────────────────────────────────
step "1 · /etc/wsl.conf — systemd on, Windows PATH off"
WSLCONF=/etc/wsl.conf
# want_ini <section> <key> <value>: set key under section, creating either, preserving the rest.
want_ini() {
  local sec="$1" key="$2" val="$3" cur
  cur=$(awk -v s="[$sec]" -v k="$key" '
    $0==s {in_s=1; next} /^\[/ {in_s=0}
    in_s && $1 ~ "^"k"[ =]" { sub(/^[^=]*=[ ]*/, ""); print; exit }' "$WSLCONF" 2>/dev/null)
  if [[ "$cur" == "$val" ]]; then already "[$sec] $key=$val"; return; fi
  act "[$sec] $key=$val (was '${cur:-unset}')" sudo python3 - "$WSLCONF" "$sec" "$key" "$val" <<'PY'
import sys, configparser, io
p, sec, key, val = sys.argv[1:]
c = configparser.ConfigParser(interpolation=None); c.optionxform = str
c.read(p)
if not c.has_section(sec): c.add_section(sec)
c[sec][key] = val
buf = io.StringIO(); c.write(buf, space_around_delimiters=False)
open(p, "w").write(buf.getvalue())
PY
}
want_ini boot systemd true
want_ini user default "$USER"
want_ini interop enabled true
want_ini interop appendWindowsPath false
RESTART_NEEDED=0
[[ "$(systemctl is-system-running 2>/dev/null)" =~ running|degraded ]] || RESTART_NEEDED=1
(( $(echo "$PATH" | tr ':' '\n' | grep -c '^/mnt/') > 6 )) && RESTART_NEEDED=1

# ── 2 · earlyoom ─────────────────────────────────────────────────────────────────────────────────
step "2 · earlyoom — kill the runaway before the kernel thrashes"
EARLYOOM_ARGS="-m 5 -s 50 -r 3600 --avoid '(^|/)(claude|codex|Xwayland|systemd)\$'"
if dpkg -s earlyoom >/dev/null 2>&1; then already "earlyoom installed"
else act "apt install earlyoom" sudo env DEBIAN_FRONTEND=noninteractive apt-get install -y -qq earlyoom; fi
if grep -qxF "EARLYOOM_ARGS=\"$EARLYOOM_ARGS\"" /etc/default/earlyoom 2>/dev/null; then already "/etc/default/earlyoom thresholds"
else act "/etc/default/earlyoom thresholds (-m 5 -s 50)" sudo bash -c "printf 'EARLYOOM_ARGS=\"%s\"\n' '$EARLYOOM_ARGS' > /etc/default/earlyoom && systemctl restart earlyoom 2>/dev/null || true"; fi
if [[ "$(systemctl is-enabled earlyoom 2>/dev/null)" == enabled && "$(systemctl is-active earlyoom 2>/dev/null)" == active ]]; then already "earlyoom enabled + active"
else act "systemctl enable --now earlyoom" sudo systemctl enable --now earlyoom; fi

# ── 3 · swappiness ───────────────────────────────────────────────────────────────────────────────
step "3 · vm.swappiness=10 — swap for emergencies only"
SYSCTL=/etc/sysctl.d/90-wsl-swap.conf
if [[ "$(sysctl -n vm.swappiness 2>/dev/null)" == 10 && -f $SYSCTL ]]; then already "vm.swappiness=10 ($SYSCTL)"
else act "vm.swappiness=10 via $SYSCTL" sudo bash -c "echo 'vm.swappiness=10' > $SYSCTL && sysctl -q --system"; fi

# ── 4 · the repo's one venv ──────────────────────────────────────────────────────────────────────
step "4 · ~/.venv — the one Python the sensorium and tree-sitter host share"
if [[ -x "$HOME/.venv/bin/python" ]]; then already "~/.venv present"
else act "python3 -m venv ~/.venv" python3 -m venv "$HOME/.venv"; fi
if [[ -f "$REPO/requirements.txt" ]]; then
  if (( DRY )); then plan "pip install -r requirements.txt"
  else "$HOME/.venv/bin/pip" install -q -r "$REPO/requirements.txt" && set_ "requirements.txt satisfied"; fi
fi

# ── 5 · what only Windows can do ─────────────────────────────────────────────────────────────────
step "5 · the Windows half"
WIN_USER=$(cmd.exe /c 'echo %USERNAME%' 2>/dev/null | tr -d '\r')
WSLCFG="/mnt/c/Users/${WIN_USER:-?}/.wslconfig"
if [[ -f "$WSLCFG" ]] && grep -q '^memory=' "$WSLCFG" && grep -q '^swap=' "$WSLCFG"; then already ".wslconfig carries memory= and swap="
else need "run tools/wsl2/stand-windows.ps1 in an elevated PowerShell (writes .wslconfig, Defender exclusions, sparse vhdx)"; fi
(( RESTART_NEEDED )) && need "wsl --shutdown from Windows, at a session boundary — /etc/wsl.conf changes wait on it"

# ── 6 · witness ──────────────────────────────────────────────────────────────────────────────────
step "6 · witness"
"$SELF_DIR/witness.sh"
