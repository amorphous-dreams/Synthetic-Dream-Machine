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
apt_install() { sudo env DEBIAN_FRONTEND=noninteractive sh -c 'apt-get update -qq && apt-get install -y -qq "$@"' _ "$@"; }

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
want_ini() {
  local sec="$1" key="$2" val="$3" cur
  cur=$(awk -v s="$sec" -v k="$key" '
    /^[ \t]*\[/ { in_s = ($0 ~ "^[ \t]*\\[" s "\\][ \t]*$") ; next }
    in_s && $0 ~ "^[ \t]*" k "[ \t]*=" { sub(/^[^=]*=[ \t]*/, ""); sub(/[ \t]+$/, ""); print; exit }' "$WSLCONF" 2>/dev/null)
  if [[ "$cur" == "$val" ]]; then already "[$sec] $key=$val"; return; fi
  WSLCONF_CHANGED=1
  act "[$sec] $key=$val (was '${cur:-unset}')" sudo python3 - "$WSLCONF" "$sec" "$key" "$val" <<'PY'
import configparser, io, sys
p, sec, key, val = sys.argv[1:]
c = configparser.ConfigParser(interpolation=None, strict=False); c.optionxform = str
try:
    with open(p) as f: c.read_string("".join(line.lstrip() for line in f))
except FileNotFoundError:
    pass
except configparser.MissingSectionHeaderError:
    sys.exit(f"{p} carries keys before any [section]; move them into a section, then re-run")
if not c.has_section(sec): c.add_section(sec)
c[sec][key] = val
out = io.StringIO(); c.write(out, space_around_delimiters=False)
open(p, "w").write(out.getvalue())
PY
}
want_ini boot systemd true
want_ini user default "${USER:-$(id -un)}"
want_ini interop enabled true
want_ini interop appendWindowsPath false
RESTART_NEEDED=$WSLCONF_CHANGED
[[ "$(systemctl is-system-running 2>/dev/null)" =~ running|degraded ]] || RESTART_NEEDED=1
(( $(echo "$PATH" | tr ':' '\n' | grep -c '^/mnt/') > 6 )) && RESTART_NEEDED=1

step '3 · earlyoom — keep a runaway process from freezing the VM'
EARLYOOM_ARGS="-m 5 -s 50 -r 3600 --avoid '(^|/)(claude|codex|Xwayland|systemd)\$'"
if dpkg -s earlyoom >/dev/null 2>&1; then already 'earlyoom installed'
else act 'apt install earlyoom' apt_install earlyoom; fi
if grep -qxF "EARLYOOM_ARGS=\"$EARLYOOM_ARGS\"" /etc/default/earlyoom 2>/dev/null; then
  already '/etc/default/earlyoom thresholds'
else
  # The inner shell receives $1 deliberately; it avoids evaluating the configured regex in this shell.
  # shellcheck disable=SC2016
  act '/etc/default/earlyoom thresholds (-m 5 -s 50)' sudo bash -c 'printf "EARLYOOM_ARGS=\"%s\"\n" "$1" > /etc/default/earlyoom && systemctl restart earlyoom' _ "$EARLYOOM_ARGS"
fi
if [[ "$(systemctl is-enabled earlyoom 2>/dev/null)" == enabled && "$(systemctl is-active earlyoom 2>/dev/null)" == active ]]; then
  already 'earlyoom enabled + active'
else act 'systemctl enable --now earlyoom' sudo systemctl enable --now earlyoom; fi

step '4 · vm.swappiness=10 — reserve swap for a short recovery window'
SYSCTL=/etc/sysctl.d/90-wsl-swap.conf
if [[ "$(sysctl -n vm.swappiness 2>/dev/null)" == 10 && -f "$SYSCTL" ]]; then
  already "vm.swappiness=10 ($SYSCTL)"
else act "vm.swappiness=10 via $SYSCTL" sudo bash -c "printf '%s\\n' 'vm.swappiness=10' > '$SYSCTL' && sysctl -q --system"; fi

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
if [[ -x "$HOME/.venv/bin/python" ]]; then already "$HOME/.venv present"
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
