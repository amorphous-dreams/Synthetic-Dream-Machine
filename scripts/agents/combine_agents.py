#!/usr/bin/env python3
"""
Combine Lares prompt source files into generated deployment artifacts.

Source files:
  _agents/Lares_Preferences.md            — Core static layer (all platforms)
  _agents/Lares_VSCode_Operations.md      — Repo operations (Section B)
  _agents/platform/Lares_Copilot_Wrapper.md  — Copilot-specific additions
  _agents/workers/<slug>.md               — Worker Tasked Spirit definitions (5 files)

Outputs:
  AGENTS.md                               — Cross-platform root prompt (Sprint 1: keep while retiring)
  .github/copilot-instructions.md         — Copilot workspace instructions (Preferences + B + Wrapper)
  .github/agents/<slug>.agent.md          — Copilot worker agent files (5 files)

Future outputs (when source files exist):
  .codex/agents/lares.toml               — Codex coordinator agent
  .claude/CLAUDE.md                       — Claude project instructions

Usage:
  python3 scripts/agents/combine_agents.py                   # write all generated files
  python3 scripts/agents/combine_agents.py --check           # diff all outputs vs current
  python3 scripts/agents/combine_agents.py --platform copilot  # copilot outputs only
"""

import sys
import difflib
import pathlib

REPO = pathlib.Path(__file__).resolve().parents[2]

WORKER_SLUGS = ["worker", "engineer", "researcher", "agent-engineer", "assistant"]

# Markers for extracting sub-sections from source files
SECTION_B_MARKER = "## CLI Agent Context — VS Code / Repo Operations"
COPILOT_WRAPPER_MARKER = "## Copilot Platform — Worker Registry"

# Generated-file comment styles
MD_GENERATED_COMMENT = """\
<!-- Generated file. Do not edit directly.
     Edit source files in _agents/ then run: python3 scripts/agents/combine_agents.py -->\
"""

MD_WORKER_GENERATED_COMMENT_TMPL = """\
<!-- Generated file. Do not edit directly.
     Edit _agents/workers/{slug}.md
     then run: python3 scripts/agents/combine_agents.py -->
"""


# ---------------------------------------------------------------------------
# Builders
# ---------------------------------------------------------------------------

def _extract_section(content: str, marker: str, source_label: str) -> str:
    """Extract content starting from marker line to end of file."""
    pos = content.find(marker)
    if pos == -1:
        sys.exit(
            f"ERROR: Marker not found in {source_label}:\n  '{marker}'"
        )
    return content[pos:]


def build_agents_md(preferences: str, vscode_ops: str) -> str:
    """Build root AGENTS.md from Preferences + VSCode_Operations Section B."""
    section_b = _extract_section(vscode_ops, SECTION_B_MARKER, "Lares_VSCode_Operations.md")
    return (
        MD_GENERATED_COMMENT
        + "\n\n"
        + preferences.rstrip("\n")
        + "\n\n---\n\n"
        + section_b.rstrip("\n")
        + "\n"
    )


def build_copilot_instructions(preferences: str, vscode_ops: str, copilot_wrapper: str) -> str:
    """Build .github/copilot-instructions.md (Preferences + Section B + Copilot Wrapper)."""
    section_b = _extract_section(vscode_ops, SECTION_B_MARKER, "Lares_VSCode_Operations.md")
    wrapper_body = _extract_section(
        copilot_wrapper, COPILOT_WRAPPER_MARKER, "Lares_Copilot_Wrapper.md"
    )
    return (
        MD_GENERATED_COMMENT
        + "\n\n"
        + preferences.rstrip("\n")
        + "\n\n---\n\n"
        + section_b.rstrip("\n")
        + "\n\n---\n\n"
        + wrapper_body.rstrip("\n")
        + "\n"
    )


def build_worker_agent(slug: str, source: str) -> str:
    """Build .github/agents/<slug>.agent.md from worker source.

    Inserts a generated-file comment into the Markdown body (after the
    closing '---') rather than inside the YAML block, avoiding YAML parser
    issues with comment injection.
    """
    comment = MD_WORKER_GENERATED_COMMENT_TMPL.format(slug=slug)
    if source.startswith("---\n"):
        # Find the closing '---' of the frontmatter
        close = source.find("\n---\n", 3)
        if close != -1:
            frontmatter = source[: close + 5]   # up to and including '---\n'
            body = source[close + 5 :]           # everything after closing '---\n'
            return frontmatter + comment + body
    # Fallback: no frontmatter — prepend as markdown comment
    return comment + source


# ---------------------------------------------------------------------------
# Diff / check
# ---------------------------------------------------------------------------

def diff_output(label: str, current_path: pathlib.Path, generated: str) -> int:
    """Emit a compact unified diff. Returns 0 when files match, 1 otherwise."""
    if not current_path.exists():
        print(f"MISSING: {label} does not exist (run without --check to generate)")
        return 1
    current = current_path.read_text(encoding="utf-8")
    if current == generated:
        print(f"OK: {label}")
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


# ---------------------------------------------------------------------------
# Source loading
# ---------------------------------------------------------------------------

def load_sources(check_workers: bool = True) -> dict:
    """Load all required source files. Exits with error on missing required files."""
    paths = {
        "preferences": REPO / "_agents" / "Lares_Preferences.md",
        "vscode_ops": REPO / "_agents" / "Lares_VSCode_Operations.md",
        "copilot_wrapper": REPO / "_agents" / "platform" / "Lares_Copilot_Wrapper.md",
    }
    if check_workers:
        for slug in WORKER_SLUGS:
            paths[f"worker_{slug}"] = REPO / "_agents" / "workers" / f"{slug}.md"

    sources = {}
    missing = []
    for key, path in paths.items():
        if path.exists():
            sources[key] = path.read_text(encoding="utf-8")
        else:
            missing.append(str(path.relative_to(REPO)))

    if missing:
        sys.exit("ERROR: Missing required source files:\n" + "\n".join(f"  {p}" for p in missing))

    return sources


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    check_only = "--check" in sys.argv
    platform_filter = None
    if "--platform" in sys.argv:
        idx = sys.argv.index("--platform")
        if idx + 1 < len(sys.argv):
            platform_filter = sys.argv[idx + 1].lower()

    sources = load_sources()

    # Build all outputs
    outputs = {}

    if platform_filter is None or platform_filter == "all":
        outputs["AGENTS.md"] = (
            REPO / "AGENTS.md",
            build_agents_md(sources["preferences"], sources["vscode_ops"]),
        )

    if platform_filter is None or platform_filter in ("all", "copilot"):
        outputs[".github/copilot-instructions.md"] = (
            REPO / ".github" / "copilot-instructions.md",
            build_copilot_instructions(
                sources["preferences"],
                sources["vscode_ops"],
                sources["copilot_wrapper"],
            ),
        )
        for slug in WORKER_SLUGS:
            key = f".github/agents/{slug}.agent.md"
            outputs[key] = (
                REPO / ".github" / "agents" / f"{slug}.agent.md",
                build_worker_agent(slug, sources[f"worker_{slug}"]),
            )

    if check_only:
        exit_code = 0
        for label, (path, generated) in outputs.items():
            exit_code |= diff_output(label, path, generated)
        if exit_code:
            sys.exit(1)
        else:
            print(f"\nAll {len(outputs)} file(s) are in sync.")
    else:
        for label, (path, generated) in outputs.items():
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(generated, encoding="utf-8")
            char_count = len(generated)
            line_count = generated.count("\n")
            print(f"Wrote {label} — {char_count:,} chars, {line_count} lines")
        print(f"\nGenerated {len(outputs)} file(s).")


if __name__ == "__main__":
    main()
