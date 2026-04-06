#!/usr/bin/env python3
"""
Combine Lares prompt source files into generated deployment artifacts.

Source files:
  _agents/Lares_Preferences.md               — Core static layer (all platforms)
  _agents/Lares_VSCode_Operations.md         — Repo operations (Section B)
  _agents/platform/Lares_Copilot_Wrapper.md  — Copilot-specific additions
  _agents/platform/Lares_Claude_Wrapper.md   — Claude-specific additions
  _agents/workers/<slug>.md                  — Worker Tasked Spirit definitions (5 files)

Outputs:
  .github/copilot-instructions.md            — Copilot workspace instructions (Preferences + B + Wrapper)
  .github/agents/<slug>.agent.md             — Copilot worker agent files (5 files)
  .claude/CLAUDE.md                          — Claude project instructions (Preferences + B + Wrapper)
  .claude/agents/<slug>.md                   — Claude worker agent files (5 files)

Outputs (Codex):
  AGENTS.md                                  — Root prompt (Preferences + B + Codex Wrapper)
  .codex/config.toml                         — Codex config (instruction size limit + agent threads)
  .codex/agents/<slug>.toml                  — Codex worker agent files (5 files, TOML format)

Usage:
  python3 scripts/agents/combine_agents.py                   # write all generated files
  python3 scripts/agents/combine_agents.py --check           # diff all outputs vs current
  python3 scripts/agents/combine_agents.py --platform copilot  # copilot outputs only
  python3 scripts/agents/combine_agents.py --platform claude   # claude outputs only
  python3 scripts/agents/combine_agents.py --platform codex    # codex outputs only (incl. AGENTS.md)
"""

import sys
import difflib
import pathlib

REPO = pathlib.Path(__file__).resolve().parents[2]

WORKER_SLUGS = ["worker", "engineer", "researcher", "agent-engineer", "assistant"]

# Markers for extracting sub-sections from source files
SECTION_B_MARKER = "## CLI Agent Context — VS Code / Repo Operations"
COPILOT_WRAPPER_MARKER = "## Copilot Platform — Worker Registry"
CLAUDE_WRAPPER_MARKER = "## Claude Platform — Worker Registry"
CODEX_WRAPPER_MARKER = "## Codex Platform — Worker Registry"

# Template for TOML generated-file notices (Codex worker files)
TOML_WORKER_GENERATED_COMMENT_TMPL = (
    "# Generated file. Do not edit directly.\n"
    "# Edit _agents/workers/{slug}.md\n"
    "# then run: python3 scripts/agents/combine_agents.py\n"
)

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


def _parse_frontmatter_field(source: str, field: str) -> str | None:
    """Extract a named YAML frontmatter field value (single-line, quoted or unquoted)."""
    import re
    if not source.startswith("---"):
        return None
    end = source.find("\n---", 3)
    if end == -1:
        return None
    block = source[3:end]
    match = re.search(rf'^{re.escape(field)}:\s*["\']?(.*?)["\']?\s*$', block, re.MULTILINE)
    return match.group(1).strip().strip('"\'') if match else None


def _strip_frontmatter(source: str) -> tuple[str, str]:
    """Return (frontmatter_block, body) where frontmatter_block includes delimiters."""
    if source.startswith("---\n"):
        close = source.find("\n---\n", 3)
        if close != -1:
            return source[: close + 5], source[close + 5 :]
    return "", source


def build_worker_agent(slug: str, source: str) -> str:
    """Build .github/agents/<slug>.agent.md from worker source.

    Emits only Copilot-native frontmatter fields (name, description, tools,
    user-invocable). Cross-platform fields (tools_claude, model_claude,
    permissionMode_claude, sandbox_mode_codex) are stripped.

    Inserts a generated-file comment into the Markdown body (after the
    closing '---') rather than inside the YAML block, avoiding YAML parser
    issues with comment injection.
    """
    import re

    comment = MD_WORKER_GENERATED_COMMENT_TMPL.format(slug=slug)
    frontmatter_block, body = _strip_frontmatter(source)
    if not frontmatter_block:
        return comment + source

    fm_text = frontmatter_block[4:-5]  # strip leading '---\n' and trailing '\n---\n'

    def get_field(fname: str) -> str | None:
        m = re.search(rf'^{re.escape(fname)}:\s*(.*?)\s*$', fm_text, re.MULTILINE)
        return m.group(1).strip() if m else None

    # Copilot-native fields only — strip cross-platform noise
    name_val = get_field("name") or f'"{slug}"'
    description = get_field("description") or '""'
    tools = get_field("tools")
    user_invocable = get_field("user-invocable")

    fm_lines = ["---"]
    fm_lines.append(f"name: {name_val}")
    fm_lines.append(f"description: {description}")
    if tools:
        fm_lines.append(f"tools: {tools}")
    if user_invocable is not None:
        fm_lines.append(f"user-invocable: {user_invocable}")
    fm_lines.append("---")
    clean_frontmatter = "\n".join(fm_lines) + "\n"

    return clean_frontmatter + comment + body


def build_claude_instructions(
    preferences: str, vscode_ops: str, claude_wrapper: str
) -> str:
    """Build .claude/CLAUDE.md (Preferences + Section B + Claude Wrapper).

    HTML comments in CLAUDE.md are stripped from context by Claude Code before
    injection — safe to use for generated-file notices without burning tokens.
    """
    section_b = _extract_section(vscode_ops, SECTION_B_MARKER, "Lares_VSCode_Operations.md")
    wrapper_body = _extract_section(
        claude_wrapper, CLAUDE_WRAPPER_MARKER, "Lares_Claude_Wrapper.md"
    )
    # Use HTML comment — Claude Code strips these from context; won't burn tokens
    html_notice = (
        "<!-- Generated file. Do not edit directly.\n"
        "     Edit source files in _agents/ then run: "
        "python3 scripts/agents/combine_agents.py -->"
    )
    return (
        html_notice
        + "\n\n"
        + preferences.rstrip("\n")
        + "\n\n---\n\n"
        + section_b.rstrip("\n")
        + "\n\n---\n\n"
        + wrapper_body.rstrip("\n")
        + "\n"
    )


def build_claude_worker(slug: str, source: str) -> str:
    """Build .claude/agents/<slug>.md from worker source.

    Claude Code subagents use the same YAML-frontmatter format as Copilot.
    Platform-specific fields (tools_claude, model_claude, permissionMode_claude)
    are extracted from the source frontmatter and emitted as standard Claude
    fields (tools, model, permissionMode). Copilot-only fields are stripped.

    HTML comment notice goes into the body — Claude Code strips it from context.
    """
    import re

    frontmatter_block, body = _strip_frontmatter(source)
    if not frontmatter_block:
        # No frontmatter — emit body only with notice
        notice = (
            f"<!-- Generated file. Do not edit directly.\n"
            f"     Edit _agents/workers/{slug}.md\n"
            f"     then run: python3 scripts/agents/combine_agents.py -->\n"
        )
        return notice + source

    # Parse fields we need from frontmatter
    fm_text = frontmatter_block[4:-5]  # strip leading '---\n' and trailing '\n---\n'

    def get_field(name: str) -> str | None:
        m = re.search(rf'^{re.escape(name)}:\s*["\']?(.*?)["\']?\s*$', fm_text, re.MULTILINE)
        return m.group(1).strip().strip('"\' ') if m else None

    name = get_field("name") or slug
    description = get_field("description") or ""
    tools_claude = get_field("tools_claude")
    model_claude = get_field("model_claude")
    permission_mode = get_field("permissionMode_claude")

    # Build clean Claude frontmatter
    fm_lines = ["---"]
    fm_lines.append(f'name: {slug}')
    # Emit description as a block scalar to handle any quoting cleanly
    safe_desc = description.replace('"', "'")
    fm_lines.append(f'description: "{safe_desc}"')
    if tools_claude:
        fm_lines.append(f"tools: {tools_claude}")
    if model_claude:
        fm_lines.append(f"model: {model_claude}")
    if permission_mode:
        fm_lines.append(f"permissionMode: {permission_mode}")
    fm_lines.append("---")
    clean_frontmatter = "\n".join(fm_lines) + "\n"

    notice = (
        f"<!-- Generated file. Do not edit directly.\n"
        f"     Edit _agents/workers/{slug}.md\n"
        f"     then run: python3 scripts/agents/combine_agents.py -->\n"
    )
    return clean_frontmatter + notice + body


def build_agents_md_codex(preferences: str, vscode_ops: str, codex_wrapper: str) -> str:
    """Build root AGENTS.md from Preferences + VSCode_Operations Section B + Codex Wrapper.

    Re-enables AGENTS.md generation for Codex, which reads the root AGENTS.md
    as its coordinator instruction source.
    """
    section_b = _extract_section(vscode_ops, SECTION_B_MARKER, "Lares_VSCode_Operations.md")
    wrapper_body = _extract_section(
        codex_wrapper, CODEX_WRAPPER_MARKER, "Lares_Codex_Wrapper.md"
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


def build_codex_worker(slug: str, source: str) -> str:
    """Build .codex/agents/<slug>.toml from worker source.

    Emits TOML format: name, description, sandbox_mode, developer_instructions
    (the body markdown as a TOML triple-quoted multi-line basic string).
    The sandbox_mode_codex frontmatter field maps to Codex's sandbox_mode.
    """
    import re

    frontmatter_block, body = _strip_frontmatter(source)
    comment = TOML_WORKER_GENERATED_COMMENT_TMPL.format(slug=slug)

    if not frontmatter_block:
        name = slug
        description = slug
        sandbox_mode = "read-only"
    else:
        fm_text = frontmatter_block[4:-5]

        def get_field(fname: str) -> str | None:
            m = re.search(rf'^{re.escape(fname)}:\s*["\']?(.*?)["\']?\s*$', fm_text, re.MULTILINE)
            return m.group(1).strip().strip('"\'  ') if m else None

        name = get_field("name") or slug
        description = get_field("description") or slug
        sandbox_mode = get_field("sandbox_mode_codex") or "read-only"

    # In TOML multi-line basic strings, """ terminates the block.
    # Replace with the sequence ""\" which TOML parses as three literal " chars.
    safe_body = body.replace('"""', '""\\"')
    # Escape backslashes and double-quotes in the single-line description field.
    safe_description = description.replace("\\", "\\\\").replace('"', '\\"')

    lines = [
        comment,
        f'name = "{name}"',
        f'description = "{safe_description}"',
        f'sandbox_mode = "{sandbox_mode}"',
        'developer_instructions = """',
        safe_body.rstrip("\n"),
        '"""',
        "",
    ]
    return "\n".join(lines)


def build_codex_config() -> str:
    """Build .codex/config.toml with instruction size and agent thread limits."""
    return (
        "# Generated file. Do not edit directly.\n"
        "# Edit scripts/agents/combine_agents.py to change config values.\n"
        "# Run: python3 scripts/agents/combine_agents.py\n"
        "\n"
        "[project]\n"
        "project_doc_max_bytes = 131072\n"
        "\n"
        "[agents]\n"
        "max_threads = 6\n"
    )


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
        "claude_wrapper": REPO / "_agents" / "platform" / "Lares_Claude_Wrapper.md",
        "codex_wrapper": REPO / "_agents" / "platform" / "Lares_Codex_Wrapper.md",
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

    if platform_filter is None or platform_filter in ("all", "codex"):
        outputs["AGENTS.md"] = (
            REPO / "AGENTS.md",
            build_agents_md_codex(
                sources["preferences"],
                sources["vscode_ops"],
                sources["codex_wrapper"],
            ),
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

    if platform_filter is None or platform_filter in ("all", "claude"):
        outputs[".claude/CLAUDE.md"] = (
            REPO / ".claude" / "CLAUDE.md",
            build_claude_instructions(
                sources["preferences"],
                sources["vscode_ops"],
                sources["claude_wrapper"],
            ),
        )
        for slug in WORKER_SLUGS:
            key = f".claude/agents/{slug}.md"
            outputs[key] = (
                REPO / ".claude" / "agents" / f"{slug}.md",
                build_claude_worker(slug, sources[f"worker_{slug}"]),
            )

    if platform_filter is None or platform_filter in ("all", "codex"):
        outputs[".codex/config.toml"] = (
            REPO / ".codex" / "config.toml",
            build_codex_config(),
        )
        for slug in WORKER_SLUGS:
            key = f".codex/agents/{slug}.toml"
            outputs[key] = (
                REPO / ".codex" / "agents" / f"{slug}.toml",
                build_codex_worker(slug, sources[f"worker_{slug}"]),
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
