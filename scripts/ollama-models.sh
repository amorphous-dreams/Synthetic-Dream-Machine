#!/usr/bin/env bash
set -euo pipefail

DEFAULT_MODELS=(qwen3.6:27b qwen3-coder-next)
if [ "$#" -gt 0 ]; then
  MODELS=("$@")
else
  MODELS=("${DEFAULT_MODELS[@]}")
fi

log() { printf '[ollama-models] %s\n' "$*"; }

if ! command -v ollama >/dev/null 2>&1; then
  log "ERROR: ollama not found. Run scripts/ollama-wsl-setup.sh first."
  exit 1
fi

if ! ollama list >/dev/null 2>&1; then
  log "ERROR: Ollama daemon not responding."
  log "Try: sudo systemctl restart ollama"
  exit 1
fi

for model in "${MODELS[@]}"; do
  if ollama list | awk 'NR > 1 {print $1}' | grep -qx "$model"; then
    log "Already pulled: $model"
  else
    log "Pulling: $model"
    ollama pull "$model"
  fi
done

log "Installed models:"
ollama list
