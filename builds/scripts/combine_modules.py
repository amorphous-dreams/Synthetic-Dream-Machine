#!/usr/bin/env python3
"""Module assembler — combines lares/modules/** into platform-specific prompt artifacts.

Reads MODULE.md YAML frontmatter from each module directory, follows the
phase-map declared there, and assembles content in dependency order for
the requested platform target. Output is a single markdown file suitable
for ingestion by the target platform.

Platform targets:
    claude-code     AGENTS.md at workspace root (Claude Code / Codex)
    vscode          .github/instructions/lares-combined.instructions.md
    claude-ai       builds/output/lares-claude-ai.md
    chatgpt         builds/output/lares-chatgpt.md

Phase selection per platform tier:
    claude-code     All phases (full module graph — largest context window)
    vscode          MODULE.md + decide/CONVENTIONS.md only
    claude-ai       MODULE.md + orient + decide (Extended context tier)
    chatgpt         MODULE.md only (Quick tier — token budget constrained)

Usage:
    python3 builds/scripts/combine_modules.py --target claude-code [--out PATH]
    python3 builds/scripts/combine_modules.py --target vscode
    python3 builds/scripts/combine_modules.py --list-modules

Options:
    --target PLATFORM   Platform target (see above)
    --out PATH          Override output path (default per platform)
    --modules-dir DIR   Module source dir (default: lares/modules/)
    --list-modules      Print available modules and exit
    --dry-run           Print assembled content to stdout instead of writing

Exit code: 0 = assembled successfully, 1 = error.
"""

import argparse
import sys
from pathlib import Path

try:
    import yaml
except ImportError:
    yaml = None


# ---------------------------------------------------------------------------
# Platform tier configuration
# ---------------------------------------------------------------------------

PLATFORMS = {
    'claude-code': {
        'phases': ['MODULE.md', 'observe', 'orient', 'decide', 'act', 'assess'],
        'default_out': 'builds/output/lares-claude-code.md',
        'description': 'Claude Code / Codex — full module graph',
        'token_budget': 33000,
    },
    'vscode': {
        'phases': ['MODULE.md', 'decide'],
        'default_out': 'builds/output/lares-vscode.md',
        'description': 'VSCode Copilot — conventions only',
        'token_budget': 7900,
    },
    'claude-ai': {
        'phases': ['MODULE.md', 'orient', 'decide'],
        'default_out': 'builds/output/lares-claude-ai.md',
        'description': 'Claude.ai — Extended context tier',
        'token_budget': 20000,
    },
    'chatgpt': {
        'phases': ['MODULE.md'],
        'default_out': 'builds/output/lares-chatgpt.md',
        'description': 'ChatGPT — Quick tier (token-constrained)',
        'token_budget': 1400,
    },
}

# Phase file names within each module directory
PHASE_FILES = {
    'observe': 'observe/CONTEXT.md',
    'orient': 'orient/ARCHITECTURE.md',
    'decide': 'decide/CONVENTIONS.md',
    'act': 'act/PROCEDURES.md',
    'assess': 'assess/VERIFICATION.md',
}


# ---------------------------------------------------------------------------
# YAML frontmatter parsing
# ---------------------------------------------------------------------------

def extract_frontmatter(text: str) -> tuple[dict, str]:
    """Extract YAML frontmatter and remaining body from markdown text.

    Supports frontmatter wrapped in either:
        ---\\n...\\n---
        ```yaml\\n---\\n...\\n---\\n```
    Skips leading HTML comment lines (<!-- ... -->) before the frontmatter block.
    Returns (metadata_dict, body_text).
    """
    lines = text.splitlines(keepends=True)
    meta: dict = {}
    body_start = 0

    # Skip leading HTML comment lines, blank lines, and H1/H2 headings
    start = 0
    for i, line in enumerate(lines):
        stripped = line.strip()
        if stripped.startswith('<!--') and stripped.endswith('-->'):
            start = i + 1
        elif stripped == '':
            start = i + 1
        elif stripped.startswith('#') and not stripped.startswith('```'):
            start = i + 1  # skip heading lines before yaml block
        else:
            break

    lines = lines[start:]

    # Handle ```yaml ... ``` wrapped frontmatter (our module format)
    if lines and lines[0].strip() in ('```yaml', '``` yaml'):
        end = None
        for i, line in enumerate(lines[1:], start=1):
            if line.strip() == '```':
                end = i
                break
        if end is not None:
            yaml_block = ''.join(lines[1:end])
            # Strip inner --- markers if present
            yaml_block = yaml_block.strip().lstrip('---').rstrip('---').strip()
            if yaml is not None:
                try:
                    meta = yaml.safe_load(yaml_block) or {}
                except Exception:
                    meta = {}
            body_start = end + 1
            return meta, ''.join(lines[body_start:])

    # Handle standard --- frontmatter
    if lines and lines[0].strip() == '---':
        end = None
        for i, line in enumerate(lines[1:], start=1):
            if line.strip() == '---':
                end = i
                break
        if end is not None:
            yaml_block = ''.join(lines[1:end])
            if yaml is not None:
                try:
                    meta = yaml.safe_load(yaml_block) or {}
                except Exception:
                    meta = {}
            body_start = end + 1
            return meta, ''.join(lines[body_start:])

    return meta, text


# ---------------------------------------------------------------------------
# Module discovery and ordering
# ---------------------------------------------------------------------------

def discover_modules(modules_dir: Path) -> list[dict]:
    """Walk modules_dir, return list of module descriptor dicts in dep order."""
    raw: list[dict] = []
    for module_md in sorted(modules_dir.glob('*/MODULE.md')):
        module_dir = module_md.parent
        text = module_md.read_text(encoding='utf-8')
        meta, body = extract_frontmatter(text)
        raw.append({
            'name': meta.get('name', module_dir.name),
            'description': meta.get('description', ''),
            'dependencies': meta.get('dependencies', []) or [],
            'confidence': meta.get('confidence', 'S:0.65'),
            'trigger': meta.get('trigger', ''),
            'dir': module_dir,
            'body': body.strip(),
        })

    # Topological sort by dependencies
    return topo_sort(raw)


def topo_sort(modules: list[dict]) -> list[dict]:
    """Sort modules so dependencies come before dependents."""
    by_name = {m['name']: m for m in modules}
    visited: set[str] = set()
    result: list[dict] = []

    def visit(name: str):
        if name in visited:
            return
        visited.add(name)
        mod = by_name.get(name)
        if mod is None:
            return
        for dep in (mod.get('dependencies') or []):
            visit(dep)
        result.append(mod)

    for mod in modules:
        visit(mod['name'])

    return result


# ---------------------------------------------------------------------------
# Content assembly
# ---------------------------------------------------------------------------

def assemble_module(mod: dict, phases: list[str]) -> str:
    """Return assembled markdown for one module given the phase selection."""
    sections: list[str] = []
    sections.append(f'<!-- MODULE: {mod["name"]} [{mod["confidence"]}] -->')

    for phase in phases:
        if phase == 'MODULE.md':
            # Use the already-extracted body
            if mod['body']:
                sections.append(mod['body'])
        else:
            phase_rel = PHASE_FILES.get(phase)
            if phase_rel is None:
                continue
            phase_path = mod['dir'] / phase_rel
            if phase_path.exists():
                content = phase_path.read_text(encoding='utf-8').strip()
                sections.append(content)

    return '\n\n'.join(sections)


def build_header(target: str) -> str:
    """Build the assembled file header."""
    cfg = PLATFORMS[target]
    return (
        f'<!-- lares:combined — platform:{target} —'
        f' budget:{cfg["token_budget"]}B —'
        f' generated by builds/scripts/combine_modules.py -->\n'
        f'# Lares Module Assembly — {cfg["description"]}\n'
        f'\n'
        f'> Auto-assembled from `lares/modules/`. Do not edit directly.\n'
        f'> Source: `builds/scripts/combine_modules.py --target {target}`\n'
    )


def approx_tokens(text: str) -> int:
    """Rough token estimate: ~4 chars per token."""
    return len(text) // 4


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument('--target', choices=list(PLATFORMS.keys()), help='Platform target')
    p.add_argument('--out', help='Override output file path')
    p.add_argument('--modules-dir', default='lares/modules', help='Module source directory')
    p.add_argument('--list-modules', action='store_true', help='List available modules and exit')
    p.add_argument('--dry-run', action='store_true', help='Print to stdout instead of writing file')
    return p.parse_args()


def main() -> int:
    args = parse_args()
    modules_dir = Path(args.modules_dir)

    if not modules_dir.is_dir():
        print(f'Error: modules directory not found: {modules_dir}', file=sys.stderr)
        return 1

    modules = discover_modules(modules_dir)

    if args.list_modules:
        print(f'Modules in {modules_dir} (dependency order):')
        for mod in modules:
            deps = ', '.join(mod['dependencies']) if mod['dependencies'] else 'none'
            conf = str(mod['confidence'])
            print(f'  {mod["name"]:20s}  [{conf:8s}]  deps: {deps}')
        print(f'Available targets: {", ".join(PLATFORMS.keys())}', file=sys.stderr)
        return 1

    cfg = PLATFORMS[args.target]
    phases = cfg['phases']

    # Assemble
    parts = [build_header(args.target)]
    for mod in modules:
        assembled = assemble_module(mod, phases)
        if assembled.strip():
            parts.append(assembled)
            parts.append('\n---\n')

    output = '\n'.join(parts)
    token_est = approx_tokens(output)
    budget = cfg['token_budget']
    over = token_est > budget

    if args.dry_run:
        print(output)
        print(f'\n<!-- approx {token_est} tokens — budget {budget}B'
              f' {"OVER BUDGET" if over else "within budget"} -->')
        return 1 if over else 0

    out_path = Path(args.out) if args.out else Path(cfg['default_out'])
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(output, encoding='utf-8')

    status = 'OVER BUDGET' if over else 'within budget'
    print(f'Assembled → {out_path}')
    print(f'  {token_est} tokens estimated — budget {budget}B — {status}')
    if over:
        print(f'  WARNING: output exceeds platform token budget by ~{token_est - budget} tokens')
        return 1
    return 0


if __name__ == '__main__':
    sys.exit(main())
