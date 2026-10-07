#!/usr/bin/env bash
# stand-linux — Debian/Ubuntu WSL2 half of lar:///ha.ka.ba/wsl2/setup.
#
# Each step names what it intends, reads what is, and changes only drift. It never changes the
# Windows host, unregisters a distro, or chooses a Docker policy. `--with-project` is the explicit
# opt-in for the repository dependency install.
set -uo pipefail

DRY=0
WITH_PROJECT=0
for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY=1 ;;
    --with-project) WITH_PROJECT=1 ;;
    *) printf 'usage: %s [--dry-run] [--with-project]\n' "$0" >&2; exit 2 ;;
  esac
done
# Under `sudo ./stand-linux.sh` $USER reads root and $HOME reads /root: [user] default would name root
# and the venv would land in /root. The script calls sudo itself. A root shell that carries no SUDO_USER
# (`su -`, `wsl -u root`) would write the same wrong lines, so root passes only on a distro that holds
# no login user at all (a fresh install whose user step was skipped).
if (( EUID == 0 )) && { [[ -n "${SUDO_USER:-}" ]] || getent passwd | awk -F: '$3 >= 1000 && $3 < 60000 { found = 1 } END { exit !found }'; }; then
  printf 'run %s as the distro user, not as root; it asks for sudo on the steps that need it\n' "$0" >&2
  exit 2
fi
SELF_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO="$(cd "$SELF_DIR/../.." && pwd)"
WINDIR=/mnt/c/Windows
CMD_EXE=$(command -v cmd.exe 2>/dev/null || echo "$WINDIR/System32/cmd.exe")
PWSH_EXE=$(command -v pwsh.exe 2>/dev/null || { [[ -x "/mnt/c/Program Files/PowerShell/7/pwsh.exe" ]] && echo "/mnt/c/Program Files/PowerShell/7/pwsh.exe"; })

already() { printf '  \e[2m%-10s\e[0m %s\n' already "$1"; }
set_()    { printf '  \e[32m%-10s\e[0m %s\n' set "$1"; }
plan()    { printf '  \e[33m%-10s\e[0m %s\n' would-set "$1"; }
need()    { printf '  \e[31m%-10s\e[0m %s\n' needs-you "$1"; }
fail()    { printf '  \e[31m%-10s\e[0m %s\n' FAILED "$1"; }
step()    { printf '\n\e[1m%s\e[0m\n' "$1"; }
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
# set_line FILE PATTERN LINE: every line matching PATTERN (case-insensitive) becomes LINE, else LINE is appended;
# comments and other lines stay; the write lands on a temp file in the same directory and renames into place.
# Both editors share one read/write discipline: a symlink is followed so the target changes and the link
# stays; bytes outside UTF-8 round-trip untouched (surrogateescape); a leading BOM reads as nothing and
# does not come back; the temp file takes the original's mode and owner; a failure unlinks the temp.
set_line() { sudo python3 - "$@" <<'PY'
import os, re, sys, tempfile
p, pat, new = sys.argv[1:]
p = os.path.realpath(p)
enc = dict(encoding="utf-8", errors="surrogateescape")
try:
    with open(p, newline="", **enc) as f: lines = f.read().splitlines()
except FileNotFoundError:
    lines = []
if lines: lines[0] = lines[0].lstrip("﻿")
rx = re.compile(pat, re.I)
hits = [i for i, line in enumerate(lines) if rx.match(line)]
for i in hits: lines[i] = new
if not hits: lines.append(new)
fd, tmp = tempfile.mkstemp(dir=os.path.dirname(p) or ".", prefix=os.path.basename(p) + ".")
try:
    with os.fdopen(fd, "w", **enc) as f: f.write("\n".join(lines) + "\n"); f.flush(); os.fsync(f.fileno())
    try: st = os.stat(p); os.chmod(tmp, st.st_mode & 0o7777); os.chown(tmp, st.st_uid, st.st_gid)
    except FileNotFoundError: os.chmod(tmp, 0o644)
    os.replace(tmp, p)
except BaseException:
    os.unlink(tmp); raise
PY
}

if ! grep -qi microsoft /proc/version; then
  echo 'not WSL2 — nothing to stand'
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
for package in "${base_packages[@]}"; do dpkg -s "$package" >/dev/null 2>&1 || missing+=("$package"); done
if (( ${#missing[@]} == 0 )); then
  already 'base packages present'
else
  act "apt install ${missing[*]}" apt_install "${missing[@]}"
fi

step '2 · /etc/wsl.conf — systemd on, inherited Windows PATH off'
WSLCONF=/etc/wsl.conf
WSLCONF_CHANGED=0
# The read and the write agree on one grammar: section and key match case-insensitively, a trailing CR
# (a Windows editor's CRLF) reads as whitespace, a leading BOM (the same editor's) reads as nothing, and
# the first matching line answers. The write touches only the matching key lines (every duplicate, so no
# stale twin can win at WSL load) or inserts one line after the section's last non-blank line; every
# other line, comment included, stays as found.
want_ini() {
  local sec="$1" key="$2" val="$3" cur
  cur=$(awk -v s="$sec" -v k="$key" '
    NR == 1 { sub(/^\357\273\277/, "") }
    /^[ \t]*\[/ { in_s = (tolower($0) ~ "^[ \t]*\\[" tolower(s) "\\][ \t\r]*$") ; next }
    in_s && tolower($0) ~ "^[ \t]*" tolower(k) "[ \t]*=" { sub(/^[^=]*=[ \t]*/, ""); sub(/[ \t\r]+$/, ""); print; exit }' "$WSLCONF" 2>/dev/null)
  if [[ "$cur" == "$val" ]]; then already "[$sec] $key=$val"; return; fi
  WSLCONF_CHANGED=1
  act "[$sec] $key=$val (was '${cur:-unset}')" sudo python3 - "$WSLCONF" "$sec" "$key" "$val" <<'PY'
import os, re, sys, tempfile
p, sec, key, val = sys.argv[1:]
p = os.path.realpath(p)
enc = dict(encoding="utf-8", errors="surrogateescape")
try:
    with open(p, newline="", **enc) as f: lines = f.read().splitlines()
except FileNotFoundError:
    lines = []
if lines: lines[0] = lines[0].lstrip("﻿")
head = re.compile(r"^[ \t]*\[(.+?)\][ \t]*$")
kv = re.compile(r"^[ \t]*" + re.escape(key) + r"[ \t]*=", re.I)
in_s = False; hits = []; first = -1; last = -1
for i, line in enumerate(lines):
    m = head.match(line)
    if m:
        in_s = m.group(1).strip().lower() == sec.lower()
        if in_s and first < 0: first = i
        continue
    if in_s:
        if kv.match(line): hits.append(i)
        if line.strip(): last = i
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
}
want_ini boot systemd true
# `id -un` names the account the kernel runs this shell as; $USER is an inherited string any profile may reset.
want_ini user default "$(id -un)"
want_ini interop enabled true
want_ini interop appendWindowsPath false
RESTART_NEEDED=$WSLCONF_CHANGED
[[ "$(systemctl is-system-running 2>/dev/null)" =~ running|degraded ]] || RESTART_NEEDED=1
(( $(echo "$PATH" | tr ':' '\n' | grep -c '^/mnt/') > 6 )) && RESTART_NEEDED=1

step '3 · earlyoom — keep a runaway process from freezing the VM'
EARLYOOM_ARGS="-m 5 -s 50 -r 3600 --avoid '(^|/)(claude|codex|Xwayland|systemd)\$'"
if dpkg -s earlyoom >/dev/null 2>&1; then already 'earlyoom installed'
else act 'apt install earlyoom' apt_install earlyoom; fi
EARLYOOM_LINE="EARLYOOM_ARGS=\"$EARLYOOM_ARGS\""
# The package conffile carries the operator-facing examples as comments; only the EARLYOOM_ARGS line changes.
earlyoom_apply() { set_line /etc/default/earlyoom '^[ \t]*EARLYOOM_ARGS[ \t]*=' "$EARLYOOM_LINE" && sudo systemctl restart earlyoom; }
# The file alone does not prove the thresholds: a restart that failed after the write leaves the daemon on
# the old line, so an active daemon must also show `-m 5` on its command line before the step reads already.
earlyoom_live_ok() {
  [[ "$(systemctl is-active earlyoom 2>/dev/null)" == active ]] || return 0
  tr '\0' ' ' < /proc/"$(systemctl show -p MainPID --value earlyoom 2>/dev/null)"/cmdline 2>/dev/null | grep -q -- '-m 5 '
}
if grep -qxF "$EARLYOOM_LINE" /etc/default/earlyoom 2>/dev/null && earlyoom_live_ok; then
  already '/etc/default/earlyoom thresholds'
else
  act '/etc/default/earlyoom thresholds (-m 5 -s 50)' earlyoom_apply
fi
if [[ "$(systemctl is-enabled earlyoom 2>/dev/null)" == enabled && "$(systemctl is-active earlyoom 2>/dev/null)" == active ]]; then
  already 'earlyoom enabled + active'
else act 'systemctl enable --now earlyoom' sudo systemctl enable --now earlyoom; fi

step '4 · vm.swappiness=10 — reserve swap for a short recovery window'
SYSCTL=/etc/sysctl.d/90-wsl-swap.conf
SYSCTL_LINE='vm.swappiness=10'
swappiness=$(sysctl -n vm.swappiness 2>/dev/null)
if [[ "$swappiness" == 10 && -f "$SYSCTL" ]]; then
  already "vm.swappiness=10 ($SYSCTL)"
elif grep -qxF "$SYSCTL_LINE" "$SYSCTL" 2>/dev/null; then
  # Our file is in place and still loses: a later sysctl.d file or /etc/sysctl.conf names another value. A rewrite would change nothing.
  need "vm.swappiness reads ${swappiness:-unreadable} though $SYSCTL asks for 10; find the override:  grep -rn swappiness /etc/sysctl.conf /etc/sysctl.d /run/sysctl.d /usr/lib/sysctl.d"
else
  # The path travels as an argument, never inside the shell text.
  act "vm.swappiness=10 via $SYSCTL" sudo sh -c 'printf "%s\n" "$1" > "$2" && sysctl -q --system' _ "$SYSCTL_LINE" "$SYSCTL"
fi

step '5 · Node and pnpm — repository toolchain'
node_major=0
if command -v node >/dev/null 2>&1; then node_major=$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0); fi
if [[ "$node_major" =~ ^[0-9]+$ ]] && (( node_major >= 24 )); then
  already "node $(node --version)"
else
  # Ubuntu's apt nodejs lags far behind 24; Microsoft's WSL guide recommends nvm (per-user, no sudo, no third-party apt repo).
  need 'install Node.js 24 via nvm (Microsoft WSL guidance), then open a new terminal and re-run:'
  need '  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.8/install.sh | bash'
  need '  source ~/.nvm/nvm.sh && nvm install 24 && nvm alias default 24'
fi
if command -v corepack >/dev/null 2>&1; then
  if command -v pnpm >/dev/null 2>&1; then
    # The corepack shim fetches pnpm on its first run; a read (and a dry run) must not reach the network.
    pnpm_ver=$(COREPACK_ENABLE_NETWORK=0 COREPACK_ENABLE_DOWNLOAD_PROMPT=0 pnpm --version 2>/dev/null </dev/null) || pnpm_ver='corepack shim; the first pnpm command downloads pnpm 10 (engines ask >=9)'
    already "pnpm $pnpm_ver"
  else act 'corepack enable (exposes pnpm)' corepack enable; fi
else
  need 'Corepack is absent; Node 24 bundles it (Node 25+ dropped it) - stay on 24, or run: npm install -g corepack && corepack enable'
fi

step '5b · Docker Engine — the lararium kit runs in a container behind this distro'
DOCKER_SOCK=/var/run/docker.sock
if command -v docker >/dev/null 2>&1; then
  # `docker info` blocks on a dead Docker Desktop proxy socket; bound the read.
  if timeout 15 docker info >/dev/null 2>&1; then already "docker $(docker --version | sed 's/,.*//') reachable"
  elif [[ -S "$DOCKER_SOCK" && ! -w "$DOCKER_SOCK" ]]; then
    if getent group docker | grep -qw "${USER:-$(id -un)}"; then need 'the docker group joined after this shell started: open a new terminal and re-run'
    else need 'the daemon refuses this user:  sudo usermod -aG docker "$USER"  then open a new terminal and re-run'; fi
  elif [[ "$(systemctl is-active docker 2>/dev/null)" == active ]]; then need "docker runs but $DOCKER_SOCK did not answer in 15 s; read: journalctl -u docker -n 20"
  elif dpkg -s docker.io >/dev/null 2>&1; then need 'docker.io is installed but its daemon sleeps:  sudo systemctl enable --now docker   (needs systemd=true; run wsl --shutdown first when step 2 changed /etc/wsl.conf)'
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

step '7 · project dependencies — explicit opt-in'
if (( WITH_PROJECT )); then
  if command -v pnpm >/dev/null 2>&1; then act 'pnpm install --frozen-lockfile' pnpm --dir "$REPO" install --frozen-lockfile
  else need 'pnpm is required before --with-project can install workspace dependencies'; fi
else
  already 'project dependency install skipped (pass --with-project to run it)'
fi

step '8 · Windows half'
WIN_PROFILE=$("$CMD_EXE" /c 'echo %USERPROFILE%' 2>/dev/null | tr -d '\r')
WSLCFG=$(wslpath -u "${WIN_PROFILE:-C:\\nowhere}" 2>/dev/null)/.wslconfig
if [[ -f "$WSLCFG" ]] && grep -qE '^[[:space:]]*memory[[:space:]]*=' "$WSLCFG" && grep -qE '^[[:space:]]*swap[[:space:]]*=' "$WSLCFG"; then
  already ".wslconfig carries memory= and swap= ($WSLCFG - belongs to this Windows account only)"
else
  need 'run tools/wsl2/stand-windows.ps1 in PowerShell as the Windows account that owns this distro (writes only the owned WSL resource keys and inventories distros)'
fi
if [[ -n "$PWSH_EXE" ]]; then already "PowerShell 7 at $PWSH_EXE (the runbook engine for stand-windows.ps1)"
else need 'install PowerShell 7 on Windows: winget install --id Microsoft.PowerShell --source winget   (stand-windows.ps1 degrades to Windows PowerShell 5.1 without it)'; fi
(( RESTART_NEEDED )) && need 'run wsl --shutdown from Windows at a session boundary — /etc/wsl.conf changes wait on it'

step '9 · witness'
"$SELF_DIR/witness.sh"
