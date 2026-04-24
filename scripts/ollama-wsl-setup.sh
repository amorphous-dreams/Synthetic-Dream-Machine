#!/usr/bin/env bash
set -euo pipefail

MODEL_DIR="${OLLAMA_MODEL_DIR:-/mnt/d/ollama/models}"
OLLAMA_HOST_VALUE="${OLLAMA_HOST_VALUE:-127.0.0.1:11434}"

log() { printf '[ollama-wsl-setup] %s\n' "$*"; }

if ! grep -qi microsoft /proc/version 2>/dev/null; then
  log "WARNING: this does not look like WSL. Continuing anyway."
fi

sudo apt-get update
sudo apt-get install -y curl ca-certificates zstd

if ! grep -qs 'systemd=true' /etc/wsl.conf 2>/dev/null; then
  log "Enabling systemd in /etc/wsl.conf"
  sudo tee -a /etc/wsl.conf >/dev/null <<'WSLCONF'

[boot]
systemd=true
WSLCONF
  log "systemd was enabled. Run this from PowerShell, then reopen WSL and rerun this script:"
  log "  wsl.exe --shutdown"
  exit 0
fi

if ! command -v ollama >/dev/null 2>&1; then
  log "Installing Ollama"
  curl -fsSL https://ollama.com/install.sh | sh
else
  log "Ollama already installed: $(ollama -v 2>&1 || true)"
fi

if ! command -v systemctl >/dev/null 2>&1; then
  log "ERROR: systemctl not available. Reopen WSL after wsl.exe --shutdown."
  exit 1
fi

if ! systemctl is-system-running >/dev/null 2>&1; then
  log "WARNING: systemd is not fully running yet:"
  systemctl is-system-running || true
fi

log "Creating model directory: $MODEL_DIR"
sudo mkdir -p "$MODEL_DIR"

if id ollama >/dev/null 2>&1; then
  sudo chown -R ollama:ollama "$MODEL_DIR" 2>/dev/null || true
fi
sudo chmod -R u+rwX,g+rwX "$MODEL_DIR" || true

log "Writing systemd override"
sudo mkdir -p /etc/systemd/system/ollama.service.d
sudo tee /etc/systemd/system/ollama.service.d/override.conf >/dev/null <<SERVICECONF
[Service]
Environment="OLLAMA_MODELS=$MODEL_DIR"
Environment="OLLAMA_HOST=$OLLAMA_HOST_VALUE"
SERVICECONF

sudo systemctl daemon-reload
sudo systemctl enable --now ollama
sudo systemctl restart ollama

log "Ollama service status"
systemctl is-enabled ollama
systemctl status ollama --no-pager --lines=20 || true

log "CLI check"
ollama -v
ollama list || true

log "Done."
