#!/usr/bin/env bash
# stand-linux — the Linux half of lar:///ha.ka.ba/wsl2/setup, idempotent by intent.
#
# Each step names what it INTENDS, reads what IS, and acts only on the difference. Run it twice
# and the second run reports every step `already`. Run it after a host change and only the drifted
# steps act. Nothing here touches Windows; stand-windows.ps1 carries that half.
#
# Needs sudo for steps 1-3. Pass --dry-run to see the plan with no writes.
#
# Steps: 1 /etc/wsl.conf · 2 earlyoom · 3 vm.swappiness · 4 ~/.venv · 5 the Windows half · 6 witness
set -uo pipefail

DRY=0; [[ "${1:-}" == "--dry-run" ]] && DRY=1
SELF_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO="$(cd "$SELF_DIR/../.." && pwd)"
# Windows binaries by absolute path: with appendWindowsPath=false (our intent) they leave $PATH.
WINDIR=/mnt/c/Windows
CMD_EXE=$(command -v cmd.exe 2>/dev/null || echo "$WINDIR/System32/cmd.exe")

already() { printf '  \e[2m%-10s\e[0m %s\n' already "$1"; }
set_()    { printf '  \e[32m%-10s\e[0m %s\n' set "$1"; }
plan()    { printf '  \e[33m%-10s\e[0m %s\n' would-set "$1"; }
need()    { printf '  \e[31m%-10s\e[0m %s\n' needs-you "$1"; }
fail()    { printf '  \e[31m%-10s\e[0m %s\n' FAILED "$1"; }
step()    { printf '\n\e[1m%s\e[0m\n' "$1"; }

# act <label> <cmd...> — plan under --dry-run, else run (callers pass sudo where a step needs it)
act() { local label="$1"; shift; if (( DRY )); then plan "$label"; else "$@" && set_ "$label" || fail "$label"; fi; }

grep -qi microsoft /proc/version || { echo "not WSL2 — nothing to stand"; exit 0; }
if (( ! DRY )) && ! sudo -v; then echo "sudo required for steps 1-3; or re-run with --dry-run"; exit 1; fi

# ── 1 · /etc/wsl.conf ────────────────────────────────────────────────────────────────────────────
step "1 · /etc/wsl.conf — systemd on, Windows PATH off"
WSLCONF=/etc/wsl.conf
WSLCONF_CHANGED=0
# want_ini <section> <key> <value>: set key under section, creating either, preserving the rest.
# The read tolerates `key = value` and trailing blanks; the write (configparser) normalises to
# `key=value` and drops comments — acceptable for a four-key file, and the second run reads it back.
want_ini() {
  local sec="$1" key="$2" val="$3" cur
  cur=$(awk -v s="$sec" -v k="$key" '
    /^[ \t]*\[/ { in_s = ($0 ~ "^[ \t]*\\[" s "\\][ \t]*$") ; next }
    in_s && $0 ~ "^[ \t]*" k "[ \t]*=" { sub(/^[^=]*=[ \t]*/, ""); sub(/[ \t]+$/, ""); print; exit }' "$WSLCONF" 2>/dev/null)
  if [[ "$cur" == "$val" ]]; then already "[$sec] $key=$val"; return; fi
  WSLCONF_CHANGED=1
  act "[$sec] $key=$val (was '${cur:-unset}')" sudo python3 - "$WSLCONF" "$sec" "$key" "$val" <<'PY'
import sys, configparser, io
p, sec, key, val = sys.argv[1:]
c = configparser.ConfigParser(interpolation=None, strict=False); c.optionxform = str
try:  # lstrip: configparser reads an indented line as a continuation of the value above it
    with open(p) as f: c.read_string("".join(l.lstrip() for l in f))
except FileNotFoundError:
    pass
except configparser.MissingSectionHeaderError:
    sys.exit(f"{p} carries keys before any [section] — WSL ignores them; move them by hand, then re-run")
if not c.has_section(sec): c.add_section(sec)
c[sec][key] = val
buf = io.StringIO(); c.write(buf, space_around_delimiters=False)
open(p, "w").write(buf.getvalue())
PY
}
want_ini boot systemd true
want_ini user default "${USER:-$(id -un)}"
want_ini interop enabled true
want_ini interop appendWindowsPath false
# a restart is owed when systemd is not yet PID 1, when the Windows PATH still rides in, or when we just wrote
RESTART_NEEDED=$WSLCONF_CHANGED
[[ "$(systemctl is-system-running 2>/dev/null)" =~ running|degraded ]] || RESTART_NEEDED=1
(( $(echo "$PATH" | tr ':' '\n' | grep -c '^/mnt/') > 6 )) && RESTART_NEEDED=1

# ── 2 · earlyoom ─────────────────────────────────────────────────────────────────────────────────
step "2 · earlyoom — kill the runaway before the kernel thrashes"
EARLYOOM_ARGS="-m 5 -s 50 -r 3600 --avoid '(^|/)(claude|codex|Xwayland|systemd)\$'"
if dpkg -s earlyoom >/dev/null 2>&1; then already "earlyoom installed"
else act "apt install earlyoom" sudo env DEBIAN_FRONTEND=noninteractive apt-get install -y -qq earlyoom; fi
if grep -qxF "EARLYOOM_ARGS=\"$EARLYOOM_ARGS\"" /etc/default/earlyoom 2>/dev/null; then already "/etc/default/earlyoom thresholds"
else # the value carries single quotes, so it rides in as $1 — never interpolated into the inner shell's text
  act "/etc/default/earlyoom thresholds (-m 5 -s 50)" sudo bash -c 'printf "EARLYOOM_ARGS=\"%s\"\n" "$1" > /etc/default/earlyoom && { systemctl restart earlyoom 2>/dev/null || true; }' _ "$EARLYOOM_ARGS"; fi
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
  # the venv remembers which requirements.txt it last satisfied, so an unchanged file reads `already`
  REQ_SUM=$(sha256sum "$REPO/requirements.txt" | cut -d' ' -f1); REQ_MARK="$HOME/.venv/.requirements.sha256"
  if [[ -x "$HOME/.venv/bin/pip" && "$(cat "$REQ_MARK" 2>/dev/null)" == "$REQ_SUM" ]]; then already "requirements.txt satisfied"
  elif (( DRY )); then plan "pip install -r requirements.txt"
  else "$HOME/.venv/bin/pip" install -q -r "$REPO/requirements.txt" && echo "$REQ_SUM" > "$REQ_MARK" && set_ "requirements.txt satisfied" || fail "pip install -r requirements.txt"; fi
fi

# ── 5 · what only Windows can do ─────────────────────────────────────────────────────────────────
step "5 · the Windows half"
# %USERPROFILE% rather than C:\Users\%USERNAME%: the profile folder can sit on another drive or carry a truncated name
WIN_PROFILE=$("$CMD_EXE" /c 'echo %USERPROFILE%' 2>/dev/null | tr -d '\r')
WSLCFG=$(wslpath -u "${WIN_PROFILE:-C:\\nowhere}" 2>/dev/null)/.wslconfig
if [[ -f "$WSLCFG" ]] && grep -qE '^[[:space:]]*memory[[:space:]]*=' "$WSLCFG" && grep -qE '^[[:space:]]*swap[[:space:]]*=' "$WSLCFG"; then already ".wslconfig carries memory= and swap="
else need "run tools/wsl2/stand-windows.ps1 in an elevated PowerShell (writes .wslconfig, Defender exclusions, sparse vhdx)"; fi
(( RESTART_NEEDED )) && need "wsl --shutdown from Windows, at a session boundary — /etc/wsl.conf changes wait on it"

# ── 6 · witness ──────────────────────────────────────────────────────────────────────────────────
step "6 · witness"
"$SELF_DIR/witness.sh"
