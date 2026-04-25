#!/usr/bin/env bash
set -euo pipefail

log() { printf '[dev-setup] %s\n' "$*"; }

if [ -z "${VIRTUAL_ENV:-}" ]; then
  log "ERROR: no active virtualenv."
  log "Run:"
  log "  python3 -m venv .venv"
  log "  source .venv/bin/activate"
  exit 1
fi

if [ ! -f pyproject.toml ]; then
  log "ERROR: run this from the repo root."
  exit 1
fi

log "Python: $(python --version)"
log "Venv: $VIRTUAL_ENV"

if [ -f .gitmodules ]; then
  log "Syncing git submodules"
  git submodule sync --recursive
  git submodule update --init --recursive
fi

log "Upgrading packaging tools"
python -m pip install --upgrade pip setuptools

# Do not force-upgrade wheel on Debian/Ubuntu venvs.
# Some venvs inherit an apt-seeded wheel package without pip RECORD metadata,
# which makes `pip install --upgrade wheel` fail.
python -m pip show wheel >/dev/null 2>&1 || python -m pip install wheel

log "Installing package in editable dev mode"
python -m pip install -e '.[dev]'

log "Checking imports"
python - <<'PY'
import importlib.util

for name in ["lares"]:
    spec = importlib.util.find_spec(name)
    if spec is None:
        raise SystemExit(f"missing import: {name}")
    print(f"ok import: {name} -> {spec.origin}")
PY

log "Done."
