#!/usr/bin/env bash
set -euo pipefail

echo "== Repo =="
git rev-parse --show-toplevel 2>/dev/null || true
git status --short 2>/dev/null || true
git submodule status 2>/dev/null || true

echo
echo "== Python =="
command -v python || true
python --version || true
echo "VIRTUAL_ENV=${VIRTUAL_ENV:-}"

echo
echo "== Package =="
python - <<'PY' || true
import importlib.util

for name in ["lares"]:
    spec = importlib.util.find_spec(name)
    print(f"{name}: {spec.origin if spec else 'NOT FOUND'}")
PY

echo
echo "== Ollama =="
command -v ollama || true
ollama -v 2>/dev/null || true
ollama list 2>/dev/null || true

echo
echo "== Ollama service =="
systemctl is-enabled ollama 2>/dev/null || true
systemctl is-active ollama 2>/dev/null || true
systemctl status ollama --no-pager --lines=10 2>/dev/null || true

echo
echo "== VS Code Insiders =="
command -v code-insiders || true
code-insiders --version 2>/dev/null || true
