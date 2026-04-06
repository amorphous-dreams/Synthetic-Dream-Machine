#!/usr/bin/env python3
"""
Verify alignment of Lares agent infrastructure across platforms.

Checks:
  1. All expected worker source files exist in _agents/workers/
  2. All expected generated artifacts exist across all 3 platforms
  3. Generated artifacts match what combine_agents.py would produce from sources
  4. Worker slugs are consistent across all active platforms
  5. Each worker has a keyword-rich description field (basic quality gate)
  6. Lares_Kernel.md is under the 8,000 Unicode character hard limit
  7. Version strings in Kernel and root AGENTS.md match Preferences (canonical source)

Usage:
  python3 scripts/agents/verify_alignment.py           # full report, exits 1 on failures
  python3 scripts/agents/verify_alignment.py --brief   # summary only
"""

import sys
import re
import pathlib

REPO = pathlib.Path(__file__).resolve().parents[2]

WORKER_SLUGS = ["worker", "engineer", "researcher", "agent-engineer", "assistant"]

# Platform configurations: {platform_name: {slug: generated_path}}
PLATFORMS = {
    "copilot": {
        slug: REPO / ".github" / "agents" / f"{slug}.agent.md"
        for slug in WORKER_SLUGS
    },
    "claude": {
        slug: REPO / ".claude" / "agents" / f"{slug}.md"
        for slug in WORKER_SLUGS
    },
    "codex": {
        slug: REPO / ".codex" / "agents" / f"{slug}.toml"
        for slug in WORKER_SLUGS
    },
}

WORKER_INSTRUCTIONS_LABEL = ".github/copilot-instructions.md"
WORKER_INSTRUCTIONS_PATH = REPO / ".github" / "copilot-instructions.md"

CLAUDE_INSTRUCTIONS_LABEL = ".claude/CLAUDE.md"
CLAUDE_INSTRUCTIONS_PATH = REPO / ".claude" / "CLAUDE.md"

AGENTS_MD_LABEL = "AGENTS.md"
AGENTS_MD_PATH = REPO / "AGENTS.md"

CODEX_CONFIG_LABEL = ".codex/config.toml"
CODEX_CONFIG_PATH = REPO / ".codex" / "config.toml"

# Minimum description length to pass the quality gate (characters)
DESCRIPTION_MIN_LEN = 80

# Required description keywords — at least one phrase per worker must appear
REQUIRED_KEYWORDS = {
    "worker": ["analysis", "synthesis", "audit", "extraction"],
    "engineer": ["shell", "command", "script", "terminal", "build"],
    "researcher": ["web", "browse", "external", "canon", "fetch"],
    "agent-engineer": ["agent", "prompt", "platform", "sync", "infrastructure"],
    "assistant": ["worldbuilding", "lore", "BECMI", "mechanics", "content"],
}

# Lares_Kernel.md hard size limit (Unicode characters — mirrors `wc -m`)
KERNEL_PATH = REPO / "_agents" / "Lares_Kernel.md"
KERNEL_SIZE_LIMIT = 8000

# Preferences — canonical version source (all other files pin to this)
PREFERENCES_PATH = REPO / "_agents" / "Lares_Preferences.md"


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _parse_frontmatter_description(content: str) -> str | None:
    """Extract description value from YAML frontmatter (first --- block)."""
    if not content.startswith("---"):
        return None
    end = content.find("\n---", 3)
    if end == -1:
        return None
    frontmatter = content[3:end]
    # Handle multi-line description (quoted or unquoted)
    match = re.search(r'^description:\s*["\']?(.*?)["\']?\s*$', frontmatter, re.MULTILINE)
    if match:
        return match.group(1).strip().strip('"\'')
    return None


def _load_worker_source(slug: str) -> str | None:
    path = REPO / "_agents" / "workers" / f"{slug}.md"
    if path.exists():
        return path.read_text(encoding="utf-8")
    return None


def _load_generated(path: pathlib.Path) -> str | None:
    if path.exists():
        return path.read_text(encoding="utf-8")
    return None


def _build_worker_agent(slug: str, source: str) -> str:
    """Mirror of combine_agents.build_worker_agent — kept in sync manually."""
    comment = (
        f"<!-- Generated file. Do not edit directly.\n"
        f"     Edit _agents/workers/{slug}.md\n"
        f"     then run: python3 scripts/agents/combine_agents.py -->\n"
    )
    if source.startswith("---\n"):
        close = source.find("\n---\n", 3)
        if close != -1:
            frontmatter = source[: close + 5]
            body = source[close + 5 :]
            return frontmatter + comment + body
    return comment + source


def _build_claude_worker(slug: str, source: str) -> str:
    """Mirror of combine_agents.build_claude_worker — kept in sync manually."""
    def _strip_fm(src: str) -> tuple[str, str]:
        if src.startswith("---\n"):
            close = src.find("\n---\n", 3)
            if close != -1:
                return src[: close + 5], src[close + 5 :]
        return "", src

    frontmatter_block, body = _strip_fm(source)
    notice = (
        f"<!-- Generated file. Do not edit directly.\n"
        f"     Edit _agents/workers/{slug}.md\n"
        f"     then run: python3 scripts/agents/combine_agents.py -->\n"
    )
    if not frontmatter_block:
        return notice + source

    fm_text = frontmatter_block[4:-5]

    def get_field(name: str) -> str | None:
        m = re.search(rf'^{re.escape(name)}:\s*["\']?(.*?)["\']?\s*$', fm_text, re.MULTILINE)
        return m.group(1).strip().strip('"\' ') if m else None

    description = get_field("description") or ""
    tools_claude = get_field("tools_claude")
    model_claude = get_field("model_claude")
    permission_mode = get_field("permissionMode_claude")

    fm_lines = ["---"]
    fm_lines.append(f'name: {slug}')
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
    return clean_frontmatter + notice + body


def _build_codex_worker(slug: str, source: str) -> str:
    """Mirror of combine_agents.build_codex_worker — kept in sync manually."""
    def _strip_fm(src: str) -> tuple[str, str]:
        if src.startswith("---\n"):
            close = src.find("\n---\n", 3)
            if close != -1:
                return src[: close + 5], src[close + 5 :]
        return "", src

    frontmatter_block, body = _strip_fm(source)
    comment = (
        f"# Generated file. Do not edit directly.\n"
        f"# Edit _agents/workers/{slug}.md\n"
        f"# then run: python3 scripts/agents/combine_agents.py\n"
    )

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

    safe_body = body.replace('"""', '""\\"')
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


# ---------------------------------------------------------------------------
# Checks
# ---------------------------------------------------------------------------

class CheckResult:
    def __init__(self) -> None:
        self.passes: list[str] = []
        self.failures: list[str] = []
        self.warnings: list[str] = []

    def ok(self, msg: str) -> None:
        self.passes.append(msg)

    def fail(self, msg: str) -> None:
        self.failures.append(msg)

    def warn(self, msg: str) -> None:
        self.warnings.append(msg)

    @property
    def clean(self) -> bool:
        return len(self.failures) == 0


def check_sources_exist(r: CheckResult) -> None:
    """Check 1: all worker source files exist."""
    for slug in WORKER_SLUGS:
        path = REPO / "_agents" / "workers" / f"{slug}.md"
        if path.exists():
            r.ok(f"Source exists: _agents/workers/{slug}.md")
        else:
            r.fail(f"Missing source: _agents/workers/{slug}.md")


def check_copilot_instructions_exists(r: CheckResult) -> None:
    """Check 2: .github/copilot-instructions.md exists."""
    if WORKER_INSTRUCTIONS_PATH.exists():
        r.ok(f"Generated exists: {WORKER_INSTRUCTIONS_LABEL}")
    else:
        r.fail(f"Missing generated: {WORKER_INSTRUCTIONS_LABEL}  (run combine_agents.py)")


def check_claude_instructions_exists(r: CheckResult) -> None:
    """Check 2b: .claude/CLAUDE.md exists."""
    if CLAUDE_INSTRUCTIONS_PATH.exists():
        r.ok(f"Generated exists: {CLAUDE_INSTRUCTIONS_LABEL}")
    else:
        r.fail(f"Missing generated: {CLAUDE_INSTRUCTIONS_LABEL}  (run combine_agents.py)")


def check_agents_md_exists(r: CheckResult) -> None:
    """Check 2c: root AGENTS.md exists (generated for Codex)."""
    if AGENTS_MD_PATH.exists():
        r.ok(f"Generated exists: {AGENTS_MD_LABEL}")
    else:
        r.fail(f"Missing generated: {AGENTS_MD_LABEL}  (run combine_agents.py)")


def check_codex_config_exists(r: CheckResult) -> None:
    """Check 2d: .codex/config.toml exists."""
    if CODEX_CONFIG_PATH.exists():
        r.ok(f"Generated exists: {CODEX_CONFIG_LABEL}")
    else:
        r.fail(f"Missing generated: {CODEX_CONFIG_LABEL}  (run combine_agents.py)")


def check_generated_artifacts_exist(r: CheckResult) -> None:
    """Check 3: all generated agent files exist."""
    for platform, agents in PLATFORMS.items():
        for slug, path in agents.items():
            rel = path.relative_to(REPO)
            if path.exists():
                r.ok(f"Generated exists: {rel}")
            else:
                r.fail(f"Missing generated: {rel}  (run combine_agents.py)")


def check_generated_content_sync(r: CheckResult) -> None:
    """Check 4: generated worker files match expected output from sources."""
    for slug in WORKER_SLUGS:
        source = _load_worker_source(slug)
        if source is None:
            r.warn(f"Skipping sync check for {slug}: source missing")
            continue
        builders = {
            "copilot": _build_worker_agent,
            "claude": _build_claude_worker,
            "codex": _build_codex_worker,
        }
        for platform, agents in PLATFORMS.items():
            builder = builders.get(platform)
            if builder is None:
                continue
            expected = builder(slug, source)
            path = agents[slug]
            actual = _load_generated(path)
            if actual is None:
                r.warn(f"Skipping sync check for {slug} ({platform}): generated file missing")
                continue
            if actual == expected:
                r.ok(f"Content in sync: {path.relative_to(REPO)}")
            else:
                r.fail(
                    f"Content drift: {path.relative_to(REPO)}\n"
                    f"    Source: _agents/workers/{slug}.md\n"
                    f"    Fix: python3 scripts/agents/combine_agents.py"
                )


def check_cross_platform_slug_consistency(r: CheckResult) -> None:
    """Check 5: same worker slugs exist across all active platforms."""
    active_platforms = {
        name: agents
        for name, agents in PLATFORMS.items()
        if any(path.exists() for path in agents.values())
    }
    if len(active_platforms) < 2:
        r.warn("Cross-platform slug check: only one platform active (skipped)")
        return
    platform_slugs = {
        name: {slug for slug, path in agents.items() if path.exists()}
        for name, agents in active_platforms.items()
    }
    platform_names = list(platform_slugs.keys())
    for i, name_a in enumerate(platform_names):
        for name_b in platform_names[i + 1:]:
            a_slugs = platform_slugs[name_a]
            b_slugs = platform_slugs[name_b]
            only_a = a_slugs - b_slugs
            only_b = b_slugs - a_slugs
            if not only_a and not only_b:
                r.ok(f"Slug parity: {name_a} == {name_b}")
            else:
                if only_a:
                    r.fail(f"Slug drift: {name_a} has {only_a} not in {name_b}")
                if only_b:
                    r.fail(f"Slug drift: {name_b} has {only_b} not in {name_a}")


def check_description_quality(r: CheckResult) -> None:
    """Check 6: each worker description field is keyword-rich."""
    for slug in WORKER_SLUGS:
        source = _load_worker_source(slug)
        if source is None:
            continue
        desc = _parse_frontmatter_description(source)
        if desc is None:
            r.fail(f"No description field: _agents/workers/{slug}.md")
            continue
        if len(desc) < DESCRIPTION_MIN_LEN:
            r.fail(
                f"Description too short ({len(desc)} chars, min {DESCRIPTION_MIN_LEN}): "
                f"_agents/workers/{slug}.md"
            )
            continue
        required = REQUIRED_KEYWORDS.get(slug, [])
        desc_lower = desc.lower()
        found = [kw for kw in required if kw.lower() in desc_lower]
        if found:
            r.ok(f"Description quality OK: {slug} (keywords: {', '.join(found)})")
        else:
            r.warn(
                f"Description missing expected keywords for {slug}: "
                f"{required}  (description: {desc[:80]}...)"
            )


def check_kernel_size(r: CheckResult) -> None:
    """Check 6: Lares_Kernel.md is under the 8,000 Unicode character hard limit."""
    if not KERNEL_PATH.exists():
        r.fail("Missing: _agents/Lares_Kernel.md (cannot check kernel size)")
        return
    char_count = len(KERNEL_PATH.read_text(encoding="utf-8"))
    if char_count < KERNEL_SIZE_LIMIT:
        r.ok(f"Kernel size OK: {char_count} chars (limit {KERNEL_SIZE_LIMIT})")
    else:
        r.fail(
            f"Kernel too large: {char_count} chars (limit {KERNEL_SIZE_LIMIT})\n"
            f"    Compress _agents/Lares_Kernel.md before committing"
        )


def check_version_alignment(r: CheckResult) -> None:
    """Check 7: version string in Preferences matches root AGENTS.md and Kernel."""
    if not PREFERENCES_PATH.exists():
        r.fail("Missing: _agents/Lares_Preferences.md (cannot check version alignment)")
        return
    prefs_text = PREFERENCES_PATH.read_text(encoding="utf-8")
    version_match = re.search(r"Version:\s*([\d]+\.[\d]+)", prefs_text)
    if not version_match:
        r.warn("Version string not found in _agents/Lares_Preferences.md (skipping version check)")
        return
    prefs_version = version_match.group(1)

    # Check root AGENTS.md
    if not AGENTS_MD_PATH.exists():
        r.fail(f"Version check skipped for {AGENTS_MD_LABEL}: file missing")
    else:
        agents_text = AGENTS_MD_PATH.read_text(encoding="utf-8")
        if re.search(rf"Version:\s*{re.escape(prefs_version)}\b", agents_text):
            r.ok(f"Version aligned: {AGENTS_MD_LABEL} matches Preferences v{prefs_version}")
        else:
            r.fail(
                f"Version mismatch: {AGENTS_MD_LABEL} does not contain Version: {prefs_version}\n"
                f"    Expected: Version: {prefs_version}  (from _agents/Lares_Preferences.md)\n"
                f"    Fix: run python3 scripts/agents/combine_agents.py"
            )

    # Check Kernel
    if not KERNEL_PATH.exists():
        r.fail("Version check skipped for Lares_Kernel.md: file missing")
    else:
        kernel_text = KERNEL_PATH.read_text(encoding="utf-8")
        if re.search(rf"Version:\s*{re.escape(prefs_version)}\b", kernel_text):
            r.ok(f"Version aligned: Lares_Kernel.md matches Preferences v{prefs_version}")
        else:
            r.fail(
                f"Version mismatch: _agents/Lares_Kernel.md does not contain Version: {prefs_version}\n"
                f"    Expected: Version: {prefs_version}  (from _agents/Lares_Preferences.md)\n"
                f"    Fix: update _agents/Lares_Kernel.md version header"
            )


# ---------------------------------------------------------------------------
# Report
# ---------------------------------------------------------------------------

def run_all_checks(brief: bool = False) -> CheckResult:
    r = CheckResult()
    check_sources_exist(r)
    check_copilot_instructions_exists(r)
    check_claude_instructions_exists(r)
    check_agents_md_exists(r)
    check_codex_config_exists(r)
    check_generated_artifacts_exist(r)
    check_generated_content_sync(r)
    check_cross_platform_slug_consistency(r)
    check_description_quality(r)
    check_kernel_size(r)
    check_version_alignment(r)
    return r


def print_report(r: CheckResult, brief: bool = False) -> None:
    total = len(r.passes) + len(r.failures) + len(r.warnings)
    if not brief:
        for msg in r.passes:
            print(f"  OK  {msg}")
        for msg in r.warnings:
            print(f" WARN {msg}")
    for msg in r.failures:
        print(f" FAIL {msg}")

    print()
    summary_parts = [f"{len(r.passes)} passed"]
    if r.warnings:
        summary_parts.append(f"{len(r.warnings)} warnings")
    if r.failures:
        summary_parts.append(f"{len(r.failures)} FAILED")
    status = "CLEAN" if r.clean else "REGRESSION DETECTED"
    print(f"Lares alignment: {status} — {', '.join(summary_parts)} ({total} checks)")


def main() -> None:
    brief = "--brief" in sys.argv
    r = run_all_checks(brief=brief)
    print_report(r, brief=brief)
    if not r.clean:
        sys.exit(1)


if __name__ == "__main__":
    main()
