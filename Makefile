.PHONY: help ollama-setup ollama-models dev-setup test mcp-smoke status

help:
	@echo "Targets:"
	@echo "  make ollama-setup   Configure Ollama service under WSL/systemd"
	@echo "  make ollama-models  Pull default local models"
	@echo "  make dev-setup      Install repo in editable dev mode"
	@echo "  make test           Run pytest"
	@echo "  make mcp-smoke      Smoke-test lararium MCP over stdio"
	@echo "  make status         Print environment status"

ollama-setup:
	./scripts/ollama-wsl-setup.sh

ollama-models:
	./scripts/ollama-models.sh

dev-setup:
	./scripts/dev-setup.sh

test:
	pytest

mcp-smoke:
	python scripts/mcp-smoke.py

status:
	./scripts/status.sh
