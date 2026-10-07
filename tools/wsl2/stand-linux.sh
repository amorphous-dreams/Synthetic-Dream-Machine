#!/usr/bin/env bash
# stand-linux — Debian/Ubuntu WSL2 half of lar:///ha.ka.ba/wsl2/setup.
#
# Each step names what it intends, reads what is, and changes only drift. It never changes the
# Windows host, unregisters a distro, chooses a Docker policy, or installs the repository's own
# dependencies — `pnpm install` stays the operator's line.
#
# Exit 1 on any FAILED step or on witness drift. Under --dry-run no step can FAIL, so the exit carries the
# witness alone: a hook that gates on the VM's state runs witness.sh; a would-set here does not fail the exit.
set -uo pipefail

DRY=0
for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY=1 ;;
    *) printf 'usage: %s [--dry-run]\n' "$0" >&2; exit 2 ;;
  esac
done
# As root, `id -un` reads root and $HOME reads /root: [user] default would name root and the venv would
# land in /root. The script calls sudo itself.
if (( EUID == 0 )); then
  printf 'run %s as the distro user, not as root; it asks for sudo on the steps that need it\n' "$0" >&2
  exit 2
fi
SELF_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO="$(cd "$SELF_DIR/../.." && pwd)"
# A hook's `env -i` carries no HOME; the venv lands in the passwd home, never in an unbound-variable exit.
: "${HOME:=$(getent passwd "$(id -un)" | cut -d: -f6)}"

FAILED_N=0
already() { printf '  \e[2m%-10s\e[0m %s\n' already "$1"; }
set_()    { printf '  \e[32m%-10s\e[0m %s\n' set "$1"; }
plan()    { printf '  \e[33m%-10s\e[0m %s\n' would-set "$1"; }
need()    { printf '  \e[31m%-10s\e[0m %s\n' needs-you "$1"; }
fail()    { printf '  \e[31m%-10s\e[0m %s\n' FAILED "$1"; FAILED_N=$(( FAILED_N + 1 )); }
step()    { printf '\n\e[1m%s\e[0m\n' "$1"; }
# `dpkg -s` answers 0 for a package dpkg merely remembers (removed with its conffiles kept, or left
# half-installed by an interrupted apt), so a gone package would read present. Only `installed` counts.
pkg_installed() { [[ "$(dpkg-query -W -f='${db:Status-Status}' "$1" 2>/dev/null)" == installed ]]; }
act() {
  local label="$1"; shift
  if (( DRY )); then
    plan "$label"
  elif "$@"; then
    set_ "$label"
  else
    fail "$label"
  fi
}
# A fresh distro carries no package lists; `apt-get install` alone answers "Unable to locate package".
# `--no-remove` aborts instead of letting `-y` consent to a removal the resolver proposes.
apt_install() { sudo env DEBIAN_FRONTEND=noninteractive sh -c 'apt-get update -qq && apt-get install -y -qq --no-remove "$@"' _ "$@"; }
# own_file FILE CONTENT: a file this stand owns whole lands as CONTENT plus a newline. The read beside it
# compares the whole content, so a torn write reads as drift on the next run. The path travels as an
# argument, never inside the shell text.
own_file() { sudo sh -c 'mkdir -p "${1%/*}" && printf "%s\n" "$2" > "$1"' _ "$1" "$2"; }

if ! grep -q 'microsoft-standard' /proc/version; then
  echo 'not WSL2 — nothing to stand (a WSL 1 distro? from Windows: wsl --set-version <DistroName> 2)'
  exit 0
fi
if ! command -v apt-get >/dev/null; then
  echo 'this Linux stand currently supports an apt-based WSL distro; install the equivalent packages for this distro, then re-run the read-only witness'
  exit 2
fi
if (( ! DRY )) && ! sudo -v; then
  echo 'sudo is required for Linux host steps; re-run with --dry-run to inspect the plan'
  exit 1
fi

step '1 · base Linux tools — source, venv, and native package builds'
base_packages=(ca-certificates curl git python3 python3-venv build-essential)
missing=()
for package in "${base_packages[@]}"; do pkg_installed "$package" || missing+=("$package"); done
if (( ${#missing[@]} == 0 )); then
  already 'base packages present'
else
  act "apt install ${missing[*]}" apt_install "${missing[@]}"
fi

step '2 · /etc/wsl.conf — systemd on, inherited Windows PATH off'
WSLCONF=/etc/wsl.conf
WSLCONF_CHANGED=0
# WSL reads /etc/wsl.conf alone (no drop-in directory), so the stand edits the shared file in place under
# one grammar for the read and the write: section and key match case-insensitively; any line opening with
# `[` ends the section (`[boot] # note` and `[ boot ]` open no section); lines split on LF with an optional
# CR before it; a leading BOM reads as nothing and does not come back; bytes outside UTF-8 round-trip
# untouched. `read` prints every value the key carries and answers 0 only when all of them equal the
# intent: a stale twin under a satisfied first line could win at WSL load. `write` replaces every matching
# key line or inserts one after the section's last non-blank line; every other line, comment included,
# stays. A symlink is followed so the target changes and the link stays; the temp file takes the original's
# mode and owner; a failure unlinks the temp.
INI_PY=$(cat <<'PY'
import os, re, sys, tempfile
p, sec, key, val, mode = sys.argv[1:]
p = os.path.realpath(p)
enc = dict(encoding="utf-8", errors="surrogateescape")
try:
    with open(p, newline="", **enc) as f: lines = re.split(r"\r?\n", f.read())
except FileNotFoundError:
    lines = []
if lines and lines[-1] == "": lines.pop()
if lines: lines[0] = lines[0].lstrip("﻿")
opener = re.compile(r"^[ \t]*\[")
head = re.compile(r"^[ \t]*\[" + re.escape(sec) + r"\][ \t]*$", re.I)
kv = re.compile(r"^[ \t]*" + re.escape(key) + r"[ \t]*=", re.I)
in_s = False; hits = []; first = -1; last = -1
for i, line in enumerate(lines):
    if opener.match(line):
        in_s = bool(head.match(line))
        if in_s and first < 0: first = i
        continue
    if in_s:
        if kv.match(line): hits.append(i)
        if line.strip(): last = i
if mode == "read":
    haves = [lines[i].split("=", 1)[1].strip(" \t") for i in hits]
    print(", ".join(haves) or "unset")
    sys.exit(0 if haves and all(h == val for h in haves) else 1)
new = f"{key}={val}"
if hits:
    for i in hits: lines[i] = new
elif first >= 0:
    lines.insert((last if last > first else first) + 1, new)
else:
    if lines and lines[-1].strip(): lines.append("")
    lines += [f"[{sec}]", new]
fd, tmp = tempfile.mkstemp(dir=os.path.dirname(p) or ".", prefix=os.path.basename(p) + ".")
try:
    with os.fdopen(fd, "w", **enc) as f: f.write("\n".join(lines) + "\n"); f.flush(); os.fsync(f.fileno())
    try: st = os.stat(p); os.chmod(tmp, st.st_mode & 0o7777); os.chown(tmp, st.st_uid, st.st_gid)
    except FileNotFoundError: os.chmod(tmp, 0o644)
    os.replace(tmp, p)
except BaseException:
    os.unlink(tmp); raise
PY
)
want_ini() {
  local sec="$1" key="$2" val="$3" was
  if was=$(python3 -c "$INI_PY" "$WSLCONF" "$sec" "$key" "$val" read); then already "[$sec] $key=$val"; return; fi
  WSLCONF_CHANGED=1
  act "[$sec] $key=$val (was '$was')" sudo python3 -c "$INI_PY" "$WSLCONF" "$sec" "$key" "$val" write
}
if [[ -r "$WSLCONF" || ! -e "$WSLCONF" ]]; then
  want_ini boot systemd true
  # `id -un` names the account the kernel runs this shell as; $USER is an inherited string any profile may reset.
  # A [user] default that already names another account is a login choice this stand does not reassign.
  me=$(id -un)
  cur_default=$(python3 -c "$INI_PY" "$WSLCONF" user default "$me" read)
  if [[ "$cur_default" != unset && "$cur_default" != "$me" ]]; then
    need "[user] default=$cur_default names another account; this stand does not reassign the login user — run as $cur_default, or change [user] default by hand"
  else
    want_ini user default "$me"
  fi
  want_ini interop enabled true
  want_ini interop appendWindowsPath false
else
  need "$WSLCONF is not readable by $(id -un); the stand reads it unprivileged — chmod 644, then re-run"
fi

step '3 · earlyoom — keep a runaway process from freezing the VM'
if pkg_installed earlyoom; then already 'earlyoom installed'
else act 'apt install earlyoom' apt_install earlyoom; fi
# The thresholds ride a systemd drop-in this stand owns whole; the package's /etc/default/earlyoom and its
# operator-facing comments stay as shipped. $EARLYOOM_ARGS stays first so that file's other flags still
# count; earlyoom takes the last -m and -s it sees.
EARLYOOM_DROPIN=/etc/systemd/system/earlyoom.service.d/wsl.conf
EARLYOOM_UNIT="[Service]
ExecStart=
ExecStart=/usr/bin/earlyoom \$EARLYOOM_ARGS -m 5 -s 50 --avoid '(^|/)(claude|codex|Xwayland|systemd)\$'"
earlyoom_apply() { own_file "$EARLYOOM_DROPIN" "$EARLYOOM_UNIT" && sudo systemctl daemon-reload && sudo systemctl restart earlyoom; }
# The file alone does not prove the thresholds: a restart that failed after the write leaves the daemon on
# the old line, so an active daemon must also show `-m 5` on its command line before the step reads already.
earlyoom_live_ok() {
  [[ "$earlyoom_active" == active ]] || return 0
  tr '\0' ' ' < /proc/"$(systemctl show -p MainPID --value earlyoom 2>/dev/null)"/cmdline 2>/dev/null | grep -q -- '-m 5 '
}
# Without systemd as PID 1 (/run/systemd/system absent: the first run before step 2's wsl --shutdown) every
# systemctl call answers "has not been booted with systemd" and both actions would read FAILED for a wait
# only the operator can end.
if [[ ! -d /run/systemd/system ]]; then
  need 'systemd is not running this distro yet: wsl --shutdown from Windows, then re-run — the earlyoom service and its thresholds wait on it'
else
  earlyoom_active=$(systemctl is-active earlyoom 2>/dev/null)
  if [[ "$(cat "$EARLYOOM_DROPIN" 2>/dev/null)" == "$EARLYOOM_UNIT" ]]; then
    if earlyoom_live_ok; then
      already "earlyoom thresholds ($EARLYOOM_DROPIN)"
    # Our drop-in is in place and the daemon still runs the old line: one restart; a line that still lacks
    # -m 5 names a later-sorting drop-in that overrides ExecStart, which a rewrite of ours would never change.
    elif (( DRY )); then
      plan 'systemctl restart earlyoom (drop-in in place, running line lacks -m 5)'
    elif sudo systemctl daemon-reload && sudo systemctl restart earlyoom && earlyoom_live_ok; then
      set_ 'earlyoom thresholds (restarted)'
    else
      need "the drop-in is in place but earlyoom still runs without -m 5; a later drop-in overrides ExecStart:  systemctl cat earlyoom"
    fi
  else
    act "earlyoom thresholds (-m 5 -s 50) via $EARLYOOM_DROPIN" earlyoom_apply
  fi
  if [[ "$(systemctl is-enabled earlyoom 2>/dev/null)" == enabled && "$earlyoom_active" == active ]]; then
    already 'earlyoom enabled + active'
  else act 'systemctl enable --now earlyoom' sudo systemctl enable --now earlyoom; fi
fi

step '4 · vm.swappiness=10 — reserve swap for a short recovery window'
SYSCTL=/etc/sysctl.d/90-wsl-swap.conf
SYSCTL_LINE='vm.swappiness=10'
# The file is written only when its content differs; the re-apply runs either way, since without systemd
# nothing applies sysctl.d at boot. A dry run cannot re-apply, so it plans rather than sending the operator
# after an override that may not exist; a live value that still differs after the apply names one.
sysctl_apply() {
  { [[ "$(cat "$SYSCTL" 2>/dev/null)" == "$SYSCTL_LINE" ]] || own_file "$SYSCTL" "$SYSCTL_LINE"; } && sudo sysctl -q --system >/dev/null 2>&1
}
if [[ "$(sysctl -n vm.swappiness 2>/dev/null)" == 10 && "$(cat "$SYSCTL" 2>/dev/null)" == "$SYSCTL_LINE" ]]; then
  already "vm.swappiness=10 ($SYSCTL)"
else
  act "vm.swappiness=10 via $SYSCTL" sysctl_apply
  if (( ! DRY )) && [[ "$(sysctl -n vm.swappiness 2>/dev/null)" != 10 ]]; then
    need "vm.swappiness still reads $(sysctl -n vm.swappiness 2>/dev/null || echo unreadable) though $SYSCTL asks for 10; find the override:  grep -rn swappiness /etc/sysctl.conf /etc/sysctl.d /run/sysctl.d /usr/lib/sysctl.d"
  fi
fi

step '5 · Node and pnpm — repository toolchain'
node_major=$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null)
nvm_unloaded=0
if [[ "$node_major" =~ ^[0-9]+$ ]] && (( node_major >= 24 )); then
  already "node $(node --version)"
elif [[ -z "$node_major" && -s "${NVM_DIR:-$HOME/.nvm}/nvm.sh" ]]; then
  # A hook or non-login shell carries no nvm PATH, so node reads absent on a machine that has it; the stand
  # stays a reader of the shell it was given rather than sourcing nvm.sh itself.
  nvm_unloaded=1
  need "nvm is installed (${NVM_DIR:-$HOME/.nvm}) but this shell did not load it: re-run from a login shell, or one that sourced ~/.nvm/nvm.sh, with Node 24 as nvm's default"
else
  # Ubuntu's apt nodejs lags far behind 24; Microsoft's WSL guide recommends nvm (per-user, no sudo, no third-party apt repo).
  need 'Node 24+ does not answer here; install it via nvm (Microsoft WSL guidance):'
  need '  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.8/install.sh | bash'
  need '  source ~/.nvm/nvm.sh && nvm install 24 && nvm alias default 24, then open a new terminal and re-run'
fi
if command -v corepack >/dev/null 2>&1; then
  if command -v pnpm >/dev/null 2>&1; then
    # The corepack shim fetches pnpm on its first run; a read (and a dry run) must not reach the network.
    pnpm_ver=$(COREPACK_ENABLE_NETWORK=0 COREPACK_ENABLE_DOWNLOAD_PROMPT=0 pnpm --version 2>/dev/null </dev/null) || pnpm_ver='via corepack shim (fetched on first use)'
    already "pnpm $pnpm_ver"
  else act 'corepack enable (exposes pnpm)' corepack enable; fi
elif (( ! nvm_unloaded )); then
  need 'Corepack is absent; Node 24 bundles it (Node 25+ dropped it) - stay on 24, or run: npm install -g corepack && corepack enable'
fi

step '5b · Docker Engine — the lararium kit runs in a container behind this distro'
DOCKER_SOCK=/var/run/docker.sock
if command -v docker >/dev/null 2>&1; then
  # `docker info` blocks on a dead Docker Desktop proxy socket; bound the read.
  if timeout 15 docker info >/dev/null 2>&1; then already "docker $(docker --version | sed 's/,.*//') reachable"
  elif [[ -S "$DOCKER_SOCK" && ! -w "$DOCKER_SOCK" ]]; then
    need 'the daemon refuses this user:  sudo usermod -aG docker "$USER"  (a no-op if already a member) then open a new terminal and re-run'
  elif [[ "$(systemctl is-active docker 2>/dev/null)" == active ]]; then need "docker runs but $DOCKER_SOCK did not answer in 15 s; read: journalctl -u docker -n 20"
  elif pkg_installed docker.io || pkg_installed docker-ce; then need 'docker.io is installed but its daemon sleeps:  sudo systemctl enable --now docker   (needs systemd=true; run wsl --shutdown first when step 2 changed /etc/wsl.conf)'
  else need 'docker here is Docker Desktop'"'"'s integration and Desktop is not running: start Docker Desktop, or install the in-distro engine:  sudo apt update && sudo apt install docker.io docker-compose-v2 && sudo usermod -aG docker "$USER"'; fi
else
  need 'install Docker Engine from Ubuntu (works on Windows Home, no Docker Desktop):  sudo apt update && sudo apt install docker.io docker-compose-v2 && sudo usermod -aG docker "$USER"  then open a new terminal and re-run'
fi

step '6 · ~/.venv — one Python environment for sensorium and tree-sitter host'
# pip lands last in venv creation, so python-without-pip marks a torn venv; `python3 -m venv` on that
# directory re-provisions it in place.
if [[ -x "$HOME/.venv/bin/python" && -x "$HOME/.venv/bin/pip" ]]; then already "$HOME/.venv present"
else act 'python3 -m venv ~/.venv' python3 -m venv "$HOME/.venv"; fi
if [[ -f "$REPO/requirements.txt" ]]; then
  # The digest covers every file the manifest `-r`-includes, so an edit to an included list repairs
  # the venv exactly as an edit to the root one does.
  mapfile -t REQ_FILES < <(sed -n 's/^-r[[:space:]]*//p' "$REPO/requirements.txt")
  REQ_SUM=$( { cat "$REPO/requirements.txt"; for f in "${REQ_FILES[@]}"; do cat "$REPO/$f"; done; } | sha256sum | cut -d' ' -f1)
  REQ_MARK="$HOME/.venv/.requirements.sha256"
  if [[ -x "$HOME/.venv/bin/pip" && "$(cat "$REQ_MARK" 2>/dev/null)" == "$REQ_SUM" ]]; then
    already 'requirements.txt satisfied'
  elif (( DRY )); then plan 'pip install -r requirements.txt'
  elif "$HOME/.venv/bin/pip" install -q -r "$REPO/requirements.txt"; then
    echo "$REQ_SUM" > "$REQ_MARK"
    set_ 'requirements.txt satisfied'
  else
    fail 'pip install -r requirements.txt'
  fi
fi

step '7 · witness'
# The Windows half (memory=, swap=, pwsh) reads through the witness alone.
if (( WSLCONF_CHANGED )); then
  if (( DRY )); then plan 'wsl --shutdown after the write'
  else need 'run wsl --shutdown from Windows at a session boundary — /etc/wsl.conf changes wait on it'; fi
fi
bash "$SELF_DIR/witness.sh"; witness_rc=$?
(( FAILED_N )) && { printf '\n%d step(s) FAILED above\n' "$FAILED_N" >&2; exit 1; }
exit $witness_rc
