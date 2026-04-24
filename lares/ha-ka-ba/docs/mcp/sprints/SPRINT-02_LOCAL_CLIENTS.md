# Sprint: SPRINT-02 — Local Client Surfaces

Window: **2026-05-17 -> 2026-05-30**
Goal: surface resources, prompts, and tools locally and wire first client integrations.

## Planned stories

- `MCP-STORY-202`
- `MCP-STORY-203`
- `MCP-STORY-401`
- `MCP-STORY-402`

## Exit markers

- hydration prompts exposed (`lares/lararium_mcp/prompts.py`, 6 prompts: boot_minimal, hydrate_full, boot_receipt, resolve_uri, read_carrier, compare_hydration) ✓
- prompt naming aligned to `lararium-` dash convention, matching tool naming ✓ (55 tests pass)
- read-only tool façade exposed (`lares/lararium_mcp/tools.py`) ✓
- `.mcp.json` wired for Claude Code local/project scope ✓
- `SUBMODULE_ADAPTER_INTERFACE.md` committed, adapter contract defined ✓
- VS Code Copilot path documented (`MCP-STORY-401`) ✓
- Codex config documented (`MCP-STORY-403`) ✓

Additional work landed this sprint beyond planned stories:
- `MCP-STORY-204` submodule adapter layer contract closed
- `MCP-STORY-403` Codex local config closed
- all story files reconciled with backlog truth (Status fields corrected)

Sprint-02 closed.
