#!/usr/bin/env python3
"""
Combine Lares prompt source files into root AGENTS.md.

Source files:
  _agents/Lares_Preferences.md      — Section A (identity, epistemology, voice architecture)
  _agents/Lares_VSCode_Operations.md — Section B (VS Code / repo operations)

Output:
  AGENTS.md — generated; do not edit directly

Usage:
  python3 scripts/agents/combine_agents.py          # write AGENTS.md
  python3 scripts/agents/combine_agents.py --check  # diff output vs current AGENTS.md
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


def main() -> None:
    check_only = "--check" in sys.argv

    preferences_path = REPO / "_agents" / "Lares_Preferences.md"
    vscode_ops_path = REPO / "_agents" / "Lares_VSCode_Operations.md"
    agents_path = REPO / "AGENTS.md"

    preferences = preferences_path.read_text(encoding="utf-8")
    vscode_ops = vscode_ops_path.read_text(encoding="utf-8")

    output = build_output(preferences, vscode_ops)

    if check_only:
        current = agents_path.read_text(encoding="utf-8")
        if output == current:
            print("OK: generated output matches current AGENTS.md exactly")
        else:
            diff = list(
                difflib.unified_diff(
                    current.splitlines(keepends=True),
                    output.splitlines(keepends=True),
                    fromfile="AGENTS.md (current)",
                    tofile="AGENTS.md (generated)",
                    n=3,
                )
            )
            sys.stdout.writelines(diff[:100])
            if len(diff) > 100:
                print(f"\n... ({len(diff) - 100} more diff lines)")
            sys.exit(1)
    else:
        agents_path.write_text(output, encoding="utf-8")
        char_count = len(output)
        line_count = output.count("\n")
        print(f"Wrote AGENTS.md — {char_count:,} chars, {line_count} lines")


if __name__ == "__main__":
    main()
