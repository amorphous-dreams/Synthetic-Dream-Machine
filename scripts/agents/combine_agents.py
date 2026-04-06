#!/usr/bin/env python3
"""
Combine Lares prompt source files into generated deployment artifacts.

Sprint S2 introduces manifest-driven package rendering for root instruction
artifacts while preserving the existing cross-platform worker generation path.

Primary inputs:
  builds/manifests/*.json      — package manifests
  builds/modules/*.json        — module metadata sidecars
  _agents/...                  — authored source modules
  _agents/workers/*.md         — worker source files

Primary outputs:
  AGENTS.md
  .github/copilot-instructions.md
  .claude/CLAUDE.md
  .codex/config.toml
  builds/rendered/browser/Lares_Kernel.browser.md
  builds/verification/<target>/{lock.json,checksums.txt,report.json}
  .github/agents/*.agent.md
  .claude/agents/*.md
  .codex/agents/*.toml

Usage:
  python3 scripts/agents/combine_agents.py
  python3 scripts/agents/combine_agents.py --check
  python3 scripts/agents/combine_agents.py --target codex-root
  python3 scripts/agents/combine_agents.py --platform claude
  python3 scripts/agents/combine_agents.py --list-targets
"""

from __future__ import annotations

import argparse
import difflib
import hashlib
import json
import pathlib
import sys
from dataclasses import dataclass
from typing import Any

REPO = pathlib.Path(__file__).resolve().parents[2]
BUILD_ROOT = REPO / "builds"
MANIFESTS_DIR = BUILD_ROOT / "manifests"
MODULES_DIR = BUILD_ROOT / "modules"
VERIFICATION_DIR = BUILD_ROOT / "verification"

WORKER_SLUGS = ["worker", "engineer", "researcher", "agent-engineer", "assistant"]

WORKER_PLATFORM_OUTPUTS = {
    "copilot": lambda slug: REPO / ".github" / "agents" / f"{slug}.agent.md",
    "claude": lambda slug: REPO / ".claude" / "agents" / f"{slug}.md",
    "codex": lambda slug: REPO / ".codex" / "agents" / f"{slug}.toml",
}


@dataclass(frozen=True)
class ModuleSpec:
    module_id: str
    source_path: str
    module_class: str
    default_targets: tuple[str, ...]
    browser_safe: bool
    repo_safe: bool
    ordering: dict[str, Any]
    metadata_path: pathlib.Path


@dataclass(frozen=True)
class ManifestSpec:
    manifest_path: pathlib.Path
    data: dict[str, Any]

    @property
    def package_id(self) -> str:
        return self.data["package_id"]

    @property
    def target_platform(self) -> str:
        return self.data["target_platform"]

    @property
    def budget_bytes(self) -> int | None:
        budget = self.data.get("budget", {})
        return budget.get("max_bytes")


def sha256_text(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def json_dump(data: Any) -> str:
    return json.dumps(data, indent=2, sort_keys=True, ensure_ascii=True) + "\n"


def relative(path: pathlib.Path) -> str:
    return str(path.relative_to(REPO))


def load_json(path: pathlib.Path) -> dict[str, Any]:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        sys.exit(f"ERROR: Invalid JSON in {relative(path)}: {exc}")


def validate_module_data(path: pathlib.Path, data: dict[str, Any]) -> ModuleSpec:
    required = {
        "module_id",
        "source_path",
        "class",
        "default_targets",
        "browser_safe",
        "repo_safe",
        "ordering",
    }
    missing = sorted(required - data.keys())
    if missing:
        sys.exit(f"ERROR: Module metadata {relative(path)} missing keys: {', '.join(missing)}")

    return ModuleSpec(
        module_id=data["module_id"],
        source_path=data["source_path"],
        module_class=data["class"],
        default_targets=tuple(data["default_targets"]),
        browser_safe=bool(data["browser_safe"]),
        repo_safe=bool(data["repo_safe"]),
        ordering=dict(data["ordering"]),
        metadata_path=path,
    )


def load_modules() -> dict[str, ModuleSpec]:
    modules: dict[str, ModuleSpec] = {}
    if not MODULES_DIR.exists():
        sys.exit(f"ERROR: Missing module metadata directory: {relative(MODULES_DIR)}")

    for path in sorted(MODULES_DIR.glob("*.json")):
        data = load_json(path)
        spec = validate_module_data(path, data)
        if spec.module_id in modules:
            sys.exit(
                f"ERROR: Duplicate module_id '{spec.module_id}' in "
                f"{relative(path)} and {relative(modules[spec.module_id].metadata_path)}"
            )
        source_path = REPO / spec.source_path
        if not source_path.exists():
            sys.exit(
                f"ERROR: Module source for '{spec.module_id}' does not exist: "
                f"{spec.source_path}"
            )
        modules[spec.module_id] = spec
    return modules


def validate_manifest(path: pathlib.Path, data: dict[str, Any], modules: dict[str, ModuleSpec]) -> ManifestSpec:
    required = {
        "manifest_version",
        "package_id",
        "build_profile",
        "target_platform",
        "target_class",
        "renderer_version",
        "sources",
        "outputs",
        "verification",
    }
    missing = sorted(required - data.keys())
    if missing:
        sys.exit(f"ERROR: Manifest {relative(path)} missing keys: {', '.join(missing)}")
    if data["manifest_version"] != 1:
        sys.exit(
            f"ERROR: Unsupported manifest_version in {relative(path)}: "
            f"{data['manifest_version']} (expected 1)"
        )
    if not isinstance(data["sources"], list) or not data["sources"]:
        sys.exit(f"ERROR: Manifest {relative(path)} must declare at least one source")
    if not isinstance(data["outputs"], list) or not data["outputs"]:
        sys.exit(f"ERROR: Manifest {relative(path)} must declare at least one output")

    for source in data["sources"]:
        module_id = source.get("module_id")
        if module_id not in modules:
            sys.exit(
                f"ERROR: Manifest {relative(path)} references unknown module_id '{module_id}'"
            )

    return ManifestSpec(manifest_path=path, data=data)


def load_manifests(modules: dict[str, ModuleSpec]) -> dict[str, ManifestSpec]:
    manifests: dict[str, ManifestSpec] = {}
    if not MANIFESTS_DIR.exists():
        sys.exit(f"ERROR: Missing manifests directory: {relative(MANIFESTS_DIR)}")

    for path in sorted(MANIFESTS_DIR.glob("*.json")):
        spec = validate_manifest(path, load_json(path), modules)
        if spec.package_id in manifests:
            sys.exit(
                f"ERROR: Duplicate package_id '{spec.package_id}' in "
                f"{relative(path)} and {relative(manifests[spec.package_id].manifest_path)}"
            )
        manifests[spec.package_id] = spec
    return manifests


def _extract_section(content: str, marker: str, source_label: str) -> str:
    pos = content.find(marker)
    if pos == -1:
        sys.exit(f"ERROR: Marker not found in {source_label}:\n  '{marker}'")
    return content[pos:]


def _extract_between_markers(
    content: str,
    start_marker: str,
    end_marker: str,
    source_label: str,
) -> str:
    start = content.find(start_marker)
    if start == -1:
        sys.exit(f"ERROR: Start marker not found in {source_label}:\n  '{start_marker}'")
    end = content.find(end_marker, start)
    if end == -1:
        sys.exit(f"ERROR: End marker not found in {source_label}:\n  '{end_marker}'")
    if end <= start:
        sys.exit(
            f"ERROR: Invalid marker order in {source_label}:\n"
            f"  start='{start_marker}'\n"
            f"  end='{end_marker}'"
        )
    return content[start:end]


def _strip_frontmatter(source: str) -> tuple[str, str]:
    if source.startswith("---\n"):
        close = source.find("\n---\n", 3)
        if close != -1:
            return source[: close + 5], source[close + 5 :]
    return "", source


def resolve_module_content(
    modules: dict[str, ModuleSpec],
    source_entry: dict[str, Any],
) -> dict[str, Any]:
    module = modules[source_entry["module_id"]]
    source_path = REPO / module.source_path
    raw = source_path.read_text(encoding="utf-8")
    transform = source_entry.get("transform", {"type": "full"})
    transform_type = transform.get("type", "full")

    if transform_type == "full":
        rendered = raw
    elif transform_type == "extract_from_marker":
        rendered = _extract_section(raw, transform["marker"], module.source_path)
    elif transform_type == "extract_between_markers":
        rendered = _extract_between_markers(
            raw,
            transform["start_marker"],
            transform["end_marker"],
            module.source_path,
        )
    else:
        sys.exit(
            f"ERROR: Unsupported transform '{transform_type}' in "
            f"{source_entry['module_id']}"
        )

    return {
        "module": module,
        "content": rendered.rstrip("\n"),
        "source_sha256": sha256_text(raw),
        "transform": transform,
        "rendered_sha256": sha256_text(rendered.rstrip("\n") + "\n"),
    }


def build_manifest_comment(manifest: ManifestSpec, resolved_sources: list[dict[str, Any]]) -> str:
    modules_line = ", ".join(item["module"].module_id for item in resolved_sources)
    command = f"python3 scripts/agents/combine_agents.py --target {manifest.package_id}"
    return (
        "<!-- Generated file. Do not edit directly.\n"
        f"     Manifest: {relative(manifest.manifest_path)}\n"
        f"     Modules: {modules_line}\n"
        f"     Run: {command}\n"
        "-->"
    )


def build_markdown_bundle(manifest: ManifestSpec, resolved_sources: list[dict[str, Any]]) -> str:
    comment = build_manifest_comment(manifest, resolved_sources)
    body = "\n\n---\n\n".join(item["content"] for item in resolved_sources)
    return comment + "\n\n" + body + "\n"


def build_markdown_single_source(manifest: ManifestSpec, resolved_sources: list[dict[str, Any]]) -> str:
    if len(resolved_sources) != 1:
        sys.exit(f"ERROR: Manifest {manifest.package_id} expects exactly one source for single_source")
    return build_manifest_comment(manifest, resolved_sources) + "\n\n" + resolved_sources[0]["content"] + "\n"


def build_codex_config(manifest: ManifestSpec) -> str:
    config = manifest.data.get("codex_config", {})
    project_doc_max_bytes = config.get("project_doc_max_bytes", manifest.budget_bytes or 131072)
    max_threads = config.get("max_threads", 6)
    return (
        "# Generated file. Do not edit directly.\n"
        f"# Manifest: {relative(manifest.manifest_path)}\n"
        f"# Run: python3 scripts/agents/combine_agents.py --target {manifest.package_id}\n"
        "\n"
        "[project]\n"
        f"project_doc_max_bytes = {project_doc_max_bytes}\n"
        "\n"
        "[agents]\n"
        f"max_threads = {max_threads}\n"
    )


def render_manifest_outputs(
    manifest: ManifestSpec,
    modules: dict[str, ModuleSpec],
) -> tuple[dict[str, tuple[pathlib.Path, str]], list[dict[str, Any]]]:
    resolved_sources = [resolve_module_content(modules, entry) for entry in manifest.data["sources"]]
    outputs: dict[str, tuple[pathlib.Path, str]] = {}

    for output in manifest.data["outputs"]:
        path = REPO / output["path"]
        kind = output["kind"]
        if kind == "markdown_bundle":
            rendered = build_markdown_bundle(manifest, resolved_sources)
        elif kind == "single_source_markdown":
            rendered = build_markdown_single_source(manifest, resolved_sources)
        elif kind == "codex_config":
            rendered = build_codex_config(manifest)
        else:
            sys.exit(f"ERROR: Unsupported output kind '{kind}' in {manifest.package_id}")

        max_bytes = output.get("max_bytes", manifest.budget_bytes)
        byte_count = len(rendered.encode("utf-8"))
        if max_bytes is not None and byte_count > max_bytes:
            sys.exit(
                f"ERROR: Budget exceeded for {output['path']} in {manifest.package_id}: "
                f"{byte_count} bytes > {max_bytes} bytes"
            )
        outputs[output["path"]] = (path, rendered)

    verification_outputs = build_verification_outputs(manifest, resolved_sources, outputs)
    outputs.update(verification_outputs)
    return outputs, resolved_sources


def build_verification_outputs(
    manifest: ManifestSpec,
    resolved_sources: list[dict[str, Any]],
    outputs: dict[str, tuple[pathlib.Path, str]],
) -> dict[str, tuple[pathlib.Path, str]]:
    package_dir = VERIFICATION_DIR / manifest.package_id
    manifest_rel = relative(manifest.manifest_path)

    output_records = []
    for rel_path, (_, text) in sorted(outputs.items()):
        output_records.append(
            {
                "path": rel_path,
                "bytes": len(text.encode("utf-8")),
                "sha256": sha256_text(text),
            }
        )

    source_records = []
    for item in resolved_sources:
        source_records.append(
            {
                "module_id": item["module"].module_id,
                "source_path": item["module"].source_path,
                "source_sha256": item["source_sha256"],
                "rendered_sha256": item["rendered_sha256"],
                "transform": item["transform"],
                "metadata_path": relative(item["module"].metadata_path),
            }
        )

    lock_data = {
        "package_id": manifest.package_id,
        "manifest_path": manifest_rel,
        "manifest_sha256": sha256_text(manifest.manifest_path.read_text(encoding="utf-8")),
        "renderer_version": manifest.data["renderer_version"],
        "sources": source_records,
        "outputs": output_records,
    }
    report_data = {
        "package_id": manifest.package_id,
        "target_platform": manifest.target_platform,
        "target_class": manifest.data["target_class"],
        "build_profile": manifest.data["build_profile"],
        "budget": manifest.data.get("budget", {}),
        "governance_integration_points": [
            "Future roster/CODEOWNERS enforcement should protect builds/manifests/",
            "Future Admin governance should review module metadata changes under builds/modules/",
            "Prompt-side Admin binding remains out of scope for this deterministic build MVP",
        ],
        "outputs": output_records,
    }
    checksums_lines = [
        f"{record['sha256']}  {record['path']}" for record in output_records
    ]
    checksums_text = "\n".join(checksums_lines) + "\n"

    return {
        relative(package_dir / "lock.json"): (package_dir / "lock.json", json_dump(lock_data)),
        relative(package_dir / "report.json"): (package_dir / "report.json", json_dump(report_data)),
        relative(package_dir / "checksums.txt"): (package_dir / "checksums.txt", checksums_text),
    }


def _parse_frontmatter_field(source: str, field: str) -> str | None:
    import re

    if not source.startswith("---"):
        return None
    end = source.find("\n---", 3)
    if end == -1:
        return None
    block = source[3:end]
    match = re.search(rf'^{re.escape(field)}:\s*["\']?(.*?)["\']?\s*$', block, re.MULTILINE)
    return match.group(1).strip().strip('"\'') if match else None


def build_worker_agent(slug: str, source: str) -> str:
    import re

    comment = (
        "<!-- Generated file. Do not edit directly.\n"
        f"     Edit _agents/workers/{slug}.md\n"
        "     then run: python3 scripts/agents/combine_agents.py -->\n"
    )
    frontmatter_block, body = _strip_frontmatter(source)
    if not frontmatter_block:
        return comment + source

    fm_text = frontmatter_block[4:-5]

    def get_field(fname: str) -> str | None:
        match = re.search(rf'^{re.escape(fname)}:\s*(.*?)\s*$', fm_text, re.MULTILINE)
        return match.group(1).strip() if match else None

    name_val = get_field("name") or f'"{slug}"'
    description = get_field("description") or '""'
    tools = get_field("tools")
    user_invocable = get_field("user-invocable")

    fm_lines = ["---", f"name: {name_val}", f"description: {description}"]
    if tools:
        fm_lines.append(f"tools: {tools}")
    if user_invocable is not None:
        fm_lines.append(f"user-invocable: {user_invocable}")
    fm_lines.append("---")
    clean_frontmatter = "\n".join(fm_lines) + "\n"
    return clean_frontmatter + comment + body


def build_claude_worker(slug: str, source: str) -> str:
    import re

    frontmatter_block, body = _strip_frontmatter(source)
    notice = (
        "<!-- Generated file. Do not edit directly.\n"
        f"     Edit _agents/workers/{slug}.md\n"
        "     then run: python3 scripts/agents/combine_agents.py -->\n"
    )
    if not frontmatter_block:
        return notice + source

    fm_text = frontmatter_block[4:-5]

    def get_field(name: str) -> str | None:
        match = re.search(rf'^{re.escape(name)}:\s*["\']?(.*?)["\']?\s*$', fm_text, re.MULTILINE)
        return match.group(1).strip().strip('"\' ') if match else None

    description = get_field("description") or ""
    tools_claude = get_field("tools_claude")
    model_claude = get_field("model_claude")
    permission_mode = get_field("permissionMode_claude")

    fm_lines = ["---", f"name: {slug}", f'description: "{description.replace(chr(34), chr(39))}"']
    if tools_claude:
        fm_lines.append(f"tools: {tools_claude}")
    if model_claude:
        fm_lines.append(f"model: {model_claude}")
    if permission_mode:
        fm_lines.append(f"permissionMode: {permission_mode}")
    fm_lines.append("---")
    clean_frontmatter = "\n".join(fm_lines) + "\n"
    return clean_frontmatter + notice + body


def build_codex_worker(slug: str, source: str) -> str:
    import re

    frontmatter_block, body = _strip_frontmatter(source)
    comment = (
        "# Generated file. Do not edit directly.\n"
        f"# Edit _agents/workers/{slug}.md\n"
        "# then run: python3 scripts/agents/combine_agents.py\n"
    )

    if not frontmatter_block:
        name = slug
        description = slug
        sandbox_mode = "read-only"
    else:
        fm_text = frontmatter_block[4:-5]

        def get_field(fname: str) -> str | None:
            match = re.search(rf'^{re.escape(fname)}:\s*["\']?(.*?)["\']?\s*$', fm_text, re.MULTILINE)
            return match.group(1).strip().strip('"\'  ') if match else None

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


def load_worker_sources() -> dict[str, str]:
    sources: dict[str, str] = {}
    missing = []
    for slug in WORKER_SLUGS:
        path = REPO / "_agents" / "workers" / f"{slug}.md"
        if path.exists():
            sources[slug] = path.read_text(encoding="utf-8")
        else:
            missing.append(relative(path))
    if missing:
        sys.exit("ERROR: Missing required worker source files:\n" + "\n".join(f"  {p}" for p in missing))
    return sources


def build_worker_outputs(platforms: set[str]) -> dict[str, tuple[pathlib.Path, str]]:
    worker_sources = load_worker_sources()
    outputs: dict[str, tuple[pathlib.Path, str]] = {}

    for platform in sorted(platforms):
        if platform == "copilot":
            builder = build_worker_agent
            suffix = ".agent.md"
        elif platform == "claude":
            builder = build_claude_worker
            suffix = ".md"
        elif platform == "codex":
            builder = build_codex_worker
            suffix = ".toml"
        else:
            continue

        for slug in WORKER_SLUGS:
            path = WORKER_PLATFORM_OUTPUTS[platform](slug)
            rel_path = relative(path)
            outputs[rel_path] = (path, builder(slug, worker_sources[slug]))
    return outputs


def diff_output(label: str, current_path: pathlib.Path, generated: str) -> int:
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


def collect_outputs(
    manifests: dict[str, ManifestSpec],
    modules: dict[str, ModuleSpec],
    selected_targets: list[str],
) -> dict[str, tuple[pathlib.Path, str]]:
    outputs: dict[str, tuple[pathlib.Path, str]] = {}
    worker_platforms: set[str] = set()

    for target in selected_targets:
        manifest = manifests[target]
        manifest_outputs, _ = render_manifest_outputs(manifest, modules)
        outputs.update(manifest_outputs)
        if manifest.target_platform in WORKER_PLATFORM_OUTPUTS:
            worker_platforms.add(manifest.target_platform)

    outputs.update(build_worker_outputs(worker_platforms))
    return outputs


def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Render Lares build artifacts from manifests.")
    parser.add_argument("--check", action="store_true", help="Diff generated outputs instead of writing them")
    parser.add_argument("--platform", choices=["all", "copilot", "claude", "codex", "browser"])
    parser.add_argument("--target", action="append", default=[], help="Build one or more manifest package_id values")
    parser.add_argument("--list-targets", action="store_true", help="List available manifest targets and exit")
    return parser.parse_args(argv)


def resolve_selected_targets(
    manifests: dict[str, ManifestSpec],
    args: argparse.Namespace,
) -> list[str]:
    if args.target:
        unknown = [target for target in args.target if target not in manifests]
        if unknown:
            sys.exit(f"ERROR: Unknown target(s): {', '.join(sorted(unknown))}")
        return sorted(dict.fromkeys(args.target))

    if args.platform and args.platform != "all":
        return sorted(
            manifest.package_id
            for manifest in manifests.values()
            if manifest.target_platform == args.platform
        )

    return sorted(manifests.keys())


def main(argv: list[str] | None = None) -> None:
    args = parse_args(argv or sys.argv[1:])
    modules = load_modules()
    manifests = load_manifests(modules)

    if args.list_targets:
        for package_id in sorted(manifests):
            manifest = manifests[package_id]
            print(f"{package_id}\t{manifest.target_platform}\t{relative(manifest.manifest_path)}")
        return

    selected_targets = resolve_selected_targets(manifests, args)
    outputs = collect_outputs(manifests, modules, selected_targets)

    if args.check:
        exit_code = 0
        for label, (path, generated) in outputs.items():
            exit_code |= diff_output(label, path, generated)
        if exit_code:
            sys.exit(1)
        print(f"\nAll {len(outputs)} file(s) are in sync.")
        return

    for label, (path, generated) in outputs.items():
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(generated, encoding="utf-8")
        char_count = len(generated)
        line_count = generated.count("\n")
        print(f"Wrote {label} — {char_count:,} chars, {line_count} lines")

    print(f"\nGenerated {len(outputs)} file(s) from {len(selected_targets)} manifest target(s).")


if __name__ == "__main__":
    main()
