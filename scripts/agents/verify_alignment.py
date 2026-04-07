#!/usr/bin/env python3
"""
Verify alignment of Lares agent infrastructure across manifests and outputs.

Checks:
  1. Manifest and module metadata exist and load cleanly
  2. All expected generated package outputs and worker artifacts exist
  3. Generated artifacts match what combine_agents.py would produce
  4. Worker slugs remain consistent across generated platforms
  5. Each worker has a keyword-rich description field
  6. Lares_Kernel.md remains under the browser-safe size limit
  7. Version strings in Kernel and root AGENTS.md match Preferences
"""

from __future__ import annotations

import pathlib
import re
import sys

import combine_agents as builder

REPO = pathlib.Path(__file__).resolve().parents[2]
WORKER_SLUGS = builder.WORKER_SLUGS
KERNEL_PATH = REPO / "builds" / "agents" / "Lares_Kernel.md"
KERNEL_SIZE_LIMIT = 8192
PREFERENCES_PATH = REPO / "builds" / "agents" / "Lares_Preferences.md"

DESCRIPTION_MIN_LEN = 80
REQUIRED_KEYWORDS = {
    "worker": ["analysis", "synthesis", "audit", "extraction"],
    "engineer": ["shell", "command", "script", "terminal", "build"],
    "researcher": ["web", "browse", "external", "canon", "fetch"],
    "agent-engineer": ["agent", "prompt", "platform", "sync", "infrastructure"],
    "assistant": ["worldbuilding", "lore", "BECMI", "mechanics", "content"],
}


class CheckResult:
    def __init__(self) -> None:
        self.passes: list[str] = []
        self.failures: list[str] = []
        self.warnings: list[str] = []

    @property
    def clean(self) -> bool:
        return not self.failures

    def ok(self, msg: str) -> None:
        self.passes.append(msg)

    def fail(self, msg: str) -> None:
        self.failures.append(msg)

    def warn(self, msg: str) -> None:
        self.warnings.append(msg)


def _load_worker_source(slug: str) -> str | None:
    path = REPO / "builds" / "agents" / "workers" / f"{slug}.md"
    return path.read_text(encoding="utf-8") if path.exists() else None


def _parse_frontmatter_description(content: str) -> str | None:
    if not content.startswith("---"):
        return None
    end = content.find("\n---", 3)
    if end == -1:
        return None
    frontmatter = content[3:end]
    match = re.search(r'^description:\s*["\']?(.*?)["\']?\s*$', frontmatter, re.MULTILINE)
    if match:
        return match.group(1).strip().strip('"\'')
    return None


def check_build_metadata_loads(r: CheckResult) -> tuple[dict[str, builder.ModuleSpec], dict[str, builder.ManifestSpec]] | None:
    try:
        modules = builder.load_modules()
        manifests = builder.load_manifests(modules)
    except SystemExit as exc:
        r.fail(str(exc))
        return None

    r.ok(f"Loaded module metadata: {len(modules)} sidecar file(s)")
    r.ok(f"Loaded manifests: {len(manifests)} target(s)")
    return modules, manifests


def check_generated_outputs(r: CheckResult, manifests: dict[str, builder.ManifestSpec], modules: dict[str, builder.ModuleSpec]) -> None:
    outputs = builder.collect_outputs(manifests, modules, sorted(manifests.keys()))
    for label, (path, generated) in outputs.items():
        if not path.exists():
            r.fail(f"Missing generated: {label}  (run python3 scripts/agents/combine_agents.py)")
            continue
        actual = path.read_text(encoding="utf-8")
        if actual == generated:
            r.ok(f"Content in sync: {label}")
        else:
            r.fail(f"Content drift: {label}  (run python3 scripts/agents/combine_agents.py)")


def check_cross_platform_slug_consistency(r: CheckResult) -> None:
    platform_paths = {
        "copilot": {slug: builder.WORKER_PLATFORM_OUTPUTS["copilot"](slug) for slug in WORKER_SLUGS},
        "claude": {slug: builder.WORKER_PLATFORM_OUTPUTS["claude"](slug) for slug in WORKER_SLUGS},
        "codex": {slug: builder.WORKER_PLATFORM_OUTPUTS["codex"](slug) for slug in WORKER_SLUGS},
    }
    active_platforms = {
        name: {slug for slug, path in paths.items() if path.exists()}
        for name, paths in platform_paths.items()
        if any(path.exists() for path in paths.values())
    }
    if len(active_platforms) < 2:
        r.warn("Cross-platform slug check skipped: fewer than two active worker platforms")
        return

    names = list(active_platforms)
    for idx, left in enumerate(names):
        for right in names[idx + 1 :]:
            only_left = active_platforms[left] - active_platforms[right]
            only_right = active_platforms[right] - active_platforms[left]
            if not only_left and not only_right:
                r.ok(f"Slug parity: {left} == {right}")
            else:
                if only_left:
                    r.fail(f"Slug drift: {left} has {sorted(only_left)} not in {right}")
                if only_right:
                    r.fail(f"Slug drift: {right} has {sorted(only_right)} not in {left}")


def check_description_quality(r: CheckResult) -> None:
    for slug in WORKER_SLUGS:
        source = _load_worker_source(slug)
        if source is None:
            r.fail(f"Missing source: builds/agents/workers/{slug}.md")
            continue
        desc = _parse_frontmatter_description(source)
        if desc is None:
            r.fail(f"No description field: builds/agents/workers/{slug}.md")
            continue
        if len(desc) < DESCRIPTION_MIN_LEN:
            r.fail(
                f"Description too short ({len(desc)} chars, min {DESCRIPTION_MIN_LEN}): "
                f"builds/agents/workers/{slug}.md"
            )
            continue
        found = [kw for kw in REQUIRED_KEYWORDS.get(slug, []) if kw.lower() in desc.lower()]
        if found:
            r.ok(f"Description quality OK: {slug} (keywords: {', '.join(found)})")
        else:
            r.warn(f"Description missing expected keywords for {slug}: {REQUIRED_KEYWORDS.get(slug, [])}")


def check_kernel_size(r: CheckResult) -> None:
    if not KERNEL_PATH.exists():
        r.fail("Missing: builds/agents/Lares_Kernel.md")
        return
    char_count = len(KERNEL_PATH.read_text(encoding="utf-8"))
    if char_count < KERNEL_SIZE_LIMIT:
        r.ok(f"Kernel size OK: {char_count} chars (limit {KERNEL_SIZE_LIMIT})")
    else:
        r.fail(f"Kernel too large: {char_count} chars (limit {KERNEL_SIZE_LIMIT})")


def check_version_alignment(r: CheckResult) -> None:
    if not PREFERENCES_PATH.exists():
        r.fail("Missing: builds/agents/Lares_Preferences.md")
        return
    prefs_text = PREFERENCES_PATH.read_text(encoding="utf-8")
    version_match = re.search(r"Version:\s*([\d]+\.[\d]+)", prefs_text)
    if not version_match:
        r.warn("Version string not found in builds/agents/Lares_Preferences.md")
        return

    prefs_version = version_match.group(1)
    for rel_path in ["AGENTS.md", "builds/agents/Lares_Kernel.md"]:
        path = REPO / rel_path
        if not path.exists():
            r.fail(f"Version check skipped for {rel_path}: file missing")
            continue
        text = path.read_text(encoding="utf-8")
        if re.search(rf"Version:\s*{re.escape(prefs_version)}\b", text):
            r.ok(f"Version aligned: {rel_path} matches Preferences v{prefs_version}")
        else:
            r.fail(f"Version mismatch: {rel_path} does not contain Version: {prefs_version}")


def run_all_checks() -> CheckResult:
    result = CheckResult()
    loaded = check_build_metadata_loads(result)
    if loaded is not None:
        modules, manifests = loaded
        check_generated_outputs(result, manifests, modules)
    check_cross_platform_slug_consistency(result)
    check_description_quality(result)
    check_kernel_size(result)
    check_version_alignment(result)
    return result


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
    summary = [f"{len(r.passes)} passed"]
    if r.warnings:
        summary.append(f"{len(r.warnings)} warnings")
    if r.failures:
        summary.append(f"{len(r.failures)} FAILED")
    status = "CLEAN" if r.clean else "REGRESSION DETECTED"
    print(f"Lares alignment: {status} — {', '.join(summary)} ({total} checks)")


def main() -> None:
    brief = "--brief" in sys.argv
    result = run_all_checks()
    print_report(result, brief=brief)
    if not result.clean:
        sys.exit(1)


if __name__ == "__main__":
    main()
