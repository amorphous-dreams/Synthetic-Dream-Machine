# Lares Build Pipeline — Makefile
#
# Assembles Lares module documentation into platform-specific prompt
# artifacts and validates URI compliance across the module graph.
#
# Targets:
#   verify         Run URI compliance validator across all module files
#   audit          Run E-Prime audit across all module files
#   check          verify + audit (full quality pass)
#   build-cc       Assemble for Claude Code target (largest, full graph)
#   build-vscode   Assemble for VSCode Copilot target (conventions only)
#   build-claude   Assemble for Claude.ai target (orient + decide)
#   build-chatgpt  Assemble for ChatGPT target (MODULE.md only)
#   build-all      All four platform targets
#   list-modules   List discovered modules in dependency order
#   clean          Remove builds/output/
#   help           Print this help

PYTHON    := python3
SCRIPTS   := builds/scripts
MODULES   := lares/modules
OUTPUT    := builds/output

VERIFY    := $(PYTHON) $(SCRIPTS)/verify_uri.py
AUDIT     := $(PYTHON) $(SCRIPTS)/eprime_audit.py
COMBINE   := $(PYTHON) $(SCRIPTS)/combine_modules.py --modules-dir $(MODULES)

# Source files — used for dependency tracking
MODULE_SOURCES := $(shell find $(MODULES) -name '*.md' 2>/dev/null)

.PHONY: verify audit check build-cc build-vscode build-claude build-chatgpt \
        build-all list-modules clean help

# ---------------------------------------------------------------------------
# Validation
# ---------------------------------------------------------------------------

## verify: URI compliance check across all module files
verify:
	@echo "==> URI compliance check (lares/modules/)"
	@$(VERIFY) $(MODULES)/ && echo "  PASS" || (echo "  FAIL"; exit 1)
	@echo "==> URI compliance check (lares/signal/)"
	@$(VERIFY) lares/signal/ && echo "  PASS" || (echo "  FAIL"; exit 1)
	@echo "==> URI compliance check (lares/scrum/)"
	@$(VERIFY) lares/scrum/ && echo "  PASS" || (echo "  FAIL"; exit 1)

## audit: E-Prime audit across module files
audit:
	@echo "==> E-Prime audit (lares/modules/)"
	@find $(MODULES) -name '*.md' | sort | xargs $(AUDIT)

## check: Full quality pass — verify + audit
check: verify audit

# ---------------------------------------------------------------------------
# Assembly
# ---------------------------------------------------------------------------

## build-cc: Assemble for Claude Code (full module graph)
build-cc: $(MODULE_SOURCES)
	@echo "==> Assembling claude-code target"
	@mkdir -p $(OUTPUT)
	@$(COMBINE) --target claude-code --out $(OUTPUT)/lares-claude-code.md

## build-vscode: Assemble for VSCode Copilot (conventions only)
build-vscode: $(MODULE_SOURCES)
	@echo "==> Assembling vscode target"
	@mkdir -p $(OUTPUT)
	@$(COMBINE) --target vscode --out $(OUTPUT)/lares-vscode.md

## build-claude: Assemble for Claude.ai (orient + decide)
build-claude: $(MODULE_SOURCES)
	@echo "==> Assembling claude-ai target"
	@mkdir -p $(OUTPUT)
	@$(COMBINE) --target claude-ai --out $(OUTPUT)/lares-claude-ai.md

## build-chatgpt: Assemble for ChatGPT Quick tier (MODULE.md only)
build-chatgpt: $(MODULE_SOURCES)
	@echo "==> Assembling chatgpt target"
	@mkdir -p $(OUTPUT)
	@$(COMBINE) --target chatgpt --out $(OUTPUT)/lares-chatgpt.md

## build-all: All four platform targets
build-all: build-cc build-vscode build-claude build-chatgpt
	@echo "==> All platform targets assembled to $(OUTPUT)/"

## list-modules: List modules in dependency order
list-modules:
	@$(COMBINE) --list-modules

# ---------------------------------------------------------------------------
# Housekeeping
# ---------------------------------------------------------------------------

## clean: Remove generated output
clean:
	@echo "==> Removing $(OUTPUT)/"
	@rm -rf $(OUTPUT)

## help: Print available targets
help:
	@echo "Lares build pipeline."
	@echo ""
	@grep -E '^## ' $(MAKEFILE_LIST) | sed 's/## /  make /'
