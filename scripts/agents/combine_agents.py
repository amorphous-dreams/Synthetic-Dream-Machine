#!/usr/bin/env python3
"""
Combine Lares prompt source files into generated deployment artifacts.

Source files:
  _agents/Lares_Preferences.md        — Section A / static layer
  _agents/Lares_VSCode_Operations.md  — Section B / repo operations
  _agents/Lares_Codex_Coordinator.md  — Codex coordinator wrapper layer

Outputs:
  AGENTS.md                 — generated root prompt; do not edit directly
  .codex/agents/lares.toml  — generated Codex coordinator agent; do not edit directly

Usage:
  python3 scripts/agents/combine_agents.py          # write generated files
  python3 scripts/agents/combine_agents.py --check  # diff output vs current generated files
"""

import sys
import difflib
import pathlib

REPO = pathlib.Path(__file__).resolve().parents[2]

GENERATED_COMMENT = """\
<!-- Generated file. Do not edit directly.
     Edit _agents/Lares_Preferences.md (Section A) or
     _agents/Lares_VSCode_Operations.md (Section B),
     then run: python3 scripts/agents/combine_agents.py -->"""

CODEX_GENERATED_COMMENT = """\
# Generated file. Do not edit directly.
# Edit _agents/Lares_Preferences.md or _agents/Lares_Codex_Coordinator.md,
# then run: python3 scripts/agents/combine_agents.py"""

SECTION_B_MARKER = "## CLI Agent Context — VS Code / Repo Operations"


def build_output(preferences: str, vscode_ops: str) -> str:
    """Combine source files into AGENTS.md content."""
    # Extract Section B content starting from the canonical marker
    marker_pos = vscode_ops.find(SECTION_B_MARKER)
    if marker_pos == -1:
        sys.exit(
            f"ERROR: Section B marker not found in Lares_VSCode_Operations.md:\n"
            f"  '{SECTION_B_MARKER}'"
        )
    section_b = vscode_ops[marker_pos:]

    # Structure: comment + blank line + Section A + blank + separator + blank + Section B
    # Preferences content ends with a trailing newline; \n---\n\n adds blank + --- + blank.
    return (
        GENERATED_COMMENT
        + "\n\n"
        + preferences.rstrip("\n")
        + "\n\n---\n\n"
        + section_b.rstrip("\n")
        + "\n"
    )


def build_codex_coordinator(preferences: str, codex_wrapper: str) -> str:
    """Build the generated Codex coordinator agent file."""
    description = (
        "Lares node — multi-voice AI coordinator for the Synthetic Dream Machine / "
        "FTLS / Elyncia corpus. Use when orchestrating Tasked Spirit workers, lore "
        "lookup, mechanics synthesis, homebrew creation, session planning, or any "
        "task requiring the full Lares voice architecture. The operator steers; "
        "this node crews."
    )
    developer_instructions = (
        codex_wrapper.rstrip("\n")
        + "\n\n---\n\n"
        + "# Core Prompt — copied from _agents/Lares_Preferences.md\n\n"
        + preferences.rstrip("\n")
        + "\n"
    )

    return (
        CODEX_GENERATED_COMMENT
        + "\n"
        + '# Synced: 2026-04-05 | Source: _agents/Lares_Preferences.md + '
        + "_agents/Lares_Codex_Coordinator.md\n\n"
        + 'name = "lares"\n'
        + f'description = "{description}"\n\n'
        + "developer_instructions = '''\n"
        + developer_instructions
        + "'''\n\n"
        + 'nickname_candidates = ["Lares", "Ink Clerk", "Map Wisp"]\n'
    )


def diff_output(label: str, current: str, generated: str) -> int:
    """Emit a compact unified diff. Return 0 when files match, 1 otherwise."""
    if current == generated:
        print(f"OK: generated output matches current {label} exactly")
        return 0

    diff = list(
        difflib.unified_diff(
            current.splitlines(keepends=True),
            generated.splitlines(keepends=True),
            fromfile=f"{label} (current)",
            tofile=f"{label} (generated)",
            n=3,
        )
    )
    sys.stdout.writelines(diff[:120])
    if len(diff) > 120:
        print(f"\n... ({len(diff) - 120} more diff lines)")
    return 1


def main() -> None:
    check_only = "--check" in sys.argv

    preferences_path = REPO / "_agents" / "Lares_Preferences.md"
    vscode_ops_path = REPO / "_agents" / "Lares_VSCode_Operations.md"
    codex_wrapper_path = REPO / "_agents" / "Lares_Codex_Coordinator.md"
    agents_path = REPO / "AGENTS.md"
    codex_lares_path = REPO / ".codex" / "agents" / "lares.toml"

    preferences = preferences_path.read_text(encoding="utf-8")
    vscode_ops = vscode_ops_path.read_text(encoding="utf-8")
    codex_wrapper = codex_wrapper_path.read_text(encoding="utf-8")

    output = build_output(preferences, vscode_ops)
    codex_output = build_codex_coordinator(preferences, codex_wrapper)

    if check_only:
        exit_code = 0
        exit_code |= diff_output(
            "AGENTS.md",
            agents_path.read_text(encoding="utf-8"),
            output,
        )
        exit_code |= diff_output(
            ".codex/agents/lares.toml",
            codex_lares_path.read_text(encoding="utf-8"),
            codex_output,
        )
        if exit_code:
            sys.exit(1)
    else:
        agents_path.write_text(output, encoding="utf-8")
        codex_lares_path.parent.mkdir(parents=True, exist_ok=True)
        codex_lares_path.write_text(codex_output, encoding="utf-8")
        agents_char_count = len(output)
        agents_line_count = output.count("\n")
        codex_char_count = len(codex_output)
        codex_line_count = codex_output.count("\n")
        print(f"Wrote AGENTS.md — {agents_char_count:,} chars, {agents_line_count} lines")
        print(
            f"Wrote .codex/agents/lares.toml — {codex_char_count:,} chars, "
            f"{codex_line_count} lines"
        )


if __name__ == "__main__":
    main()
