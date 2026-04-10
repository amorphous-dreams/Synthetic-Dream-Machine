#!/usr/bin/env python3
"""Generate Agent Skills-compatible layout from lares/modules/** structure.

Reads each module's MODULE.md YAML frontmatter and phase files, then
outputs an Agent Skills-compliant directory tree at .claude/skills/ and
always-on rules at .claude/rules/. Also generates a thin CLAUDE.md at
the workspace root that @-imports AGENTS.md.

This is the native Claude Code loading path. No monolith assembly needed.

Layout produced:
    .claude/
        skills/
            uri-schema/
                SKILL.md           ← Agent Skills entrypoint (MODULE.md body + refs)
                references/
                    CONTEXT.md     ← observe phase (loaded on demand)
                    ARCHITECTURE.md← orient phase (loaded on demand)
                    PROCEDURES.md  ← act phase (loaded on demand)
                    VERIFICATION.md← assess phase (loaded on demand)
                    URI_SCHEMA.md  ← flat spec for uri-schema (module-specific extras)
            micro-trace/
                SKILL.md
                references/
                    ...
            sigilization/
                SKILL.md
                references/
                    ...
            talk-story/
                SKILL.md
                references/
                    ...
        rules/
            uri-schema.md          ← decide/CONVENTIONS.md (always-on)
            micro-trace.md
            sigilization.md
            talk-story.md

Agent Skills spec: https://agentskills.io/specification
  - name: max 64 chars, lowercase letters/numbers/hyphens
  - description: max 1024 chars, non-empty
  - metadata: arbitrary key-value (holds our lares fields)

Usage:
    python3 builds/scripts/generate_skills.py [--modules-dir DIR] [--out-dir DIR]
    python3 builds/scripts/generate_skills.py --dry-run
    python3 builds/scripts/generate_skills.py --clean       # remove .claude/skills + rules

Options:
    --modules-dir DIR   Module source dir (default: lares/modules/)
    --out-dir DIR       Output dir for .claude/ tree (default: .claude/)
    --dry-run           Print what would be written without writing
    --clean             Remove .claude/skills/ and .claude/rules/ and exit
    --no-rules          Skip generating .claude/rules/ (always-on conventions)
    --no-claude-md      Skip generating CLAUDE.md at workspace root

Exit code: 0 = success, 1 = error.
"""

import argparse
import shutil
import sys
from pathlib import Path

try:
    import yaml
except ImportError:
    yaml = None

# ---------------------------------------------------------------------------
# Agent Skills frontmatter spec constraints
# ---------------------------------------------------------------------------

SKILLS_SPEC_VER = "1.0"

# Phase → references/ filename mapping
PHASE_REFS = {
    'observe': ('observe/CONTEXT.md', 'CONTEXT.md'),
    'orient':  ('orient/ARCHITECTURE.md', 'ARCHITECTURE.md'),
    'act':     ('act/PROCEDURES.md', 'PROCEDURES.md'),
    'assess':  ('assess/VERIFICATION.md', 'VERIFICATION.md'),
}

# Always-on phase (→ .claude/rules/)
DECIDE_PHASE = ('decide/CONVENTIONS.md', 'CONVENTIONS.md')

# Module-specific extra files to copy into references/ (keyed by module name)
MODULE_EXTRAS: dict[str, list[str]] = {
    'uri-schema': ['URI_SCHEMA.md'],
}


# ---------------------------------------------------------------------------
# YAML frontmatter parsing (same logic as combine_modules.py)
# ---------------------------------------------------------------------------

def extract_frontmatter(text: str) -> tuple[dict, str]:
    """Extract YAML frontmatter from module markdown. Returns (meta, body)."""
    lines = text.splitlines(keepends=True)

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

    meta: dict = {}
    body_start = 0

    # Handle ```yaml ... ``` wrapped frontmatter
    if lines and lines[0].strip() in ('```yaml', '``` yaml'):
        end = None
        for i, line in enumerate(lines[1:], start=1):
            if line.strip() in ('```', '```\n'):
                end = i
                break
        if end is not None:
            yaml_src = ''.join(lines[1:end])
            if yaml:
                try:
                    meta = yaml.safe_load(yaml_src) or {}
                except Exception:
                    pass
            body_start = end + 1

    # Handle --- ... --- fenced frontmatter
    elif lines and lines[0].strip() == '---':
        end = None
        for i, line in enumerate(lines[1:], start=1):
            if line.strip() == '---':
                end = i
                break
        if end is not None:
            yaml_src = ''.join(lines[1:end])
            if yaml:
                try:
                    meta = yaml.safe_load(yaml_src) or {}
                except Exception:
                    pass
            body_start = end + 1

    body = ''.join(lines[body_start:]).lstrip('\n')
    return meta, body


# ---------------------------------------------------------------------------
# Module discovery (same topo-sort as combine_modules.py)
# ---------------------------------------------------------------------------

def discover_modules(modules_dir: Path) -> list[dict]:
    """Find and parse all MODULE.md files in dependency order."""
    modules = []
    for module_md in sorted(modules_dir.glob('*/MODULE.md')):
        module_dir = module_md.parent
        text = module_md.read_text(encoding='utf-8')
        meta, body = extract_frontmatter(text)
        modules.append({
            'name': meta.get('name', module_dir.name),
            'description': meta.get('description', meta.get('trigger', '')).strip(),
            'dependencies': meta.get('dependencies', []) or [],
            'confidence': str(meta.get('confidence', '')),
            'meta_raw': meta,
            'body': body,
            'dir': module_dir,
        })

    # Topological sort by dependencies
    return topo_sort(modules)


def topo_sort(modules: list[dict]) -> list[dict]:
    """Return modules in dependency-first order."""
    by_name = {m['name']: m for m in modules}
    visited: set[str] = set()
    result: list[dict] = []

    def visit(name: str) -> None:
        if name in visited:
            return
        visited.add(name)
        mod = by_name.get(name)
        if mod is None:
            return
        for dep in mod['dependencies']:
            if dep.startswith('['):
                continue  # skip list-style artifacts
            visit(dep)
        result.append(mod)

    for m in modules:
        visit(m['name'])
    return result


# ---------------------------------------------------------------------------
# SKILL.md generation
# ---------------------------------------------------------------------------

def build_skill_md(mod: dict, has_refs: list[str], has_extras: list[str]) -> str:
    """Produce Agent Skills-compliant SKILL.md content for a module."""
    name = mod['name']
    raw_desc = mod['description']
    # Flatten multiline YAML block scalars
    desc = ' '.join(raw_desc.split())
    # Truncate to 1024 chars (spec limit)
    if len(desc) > 1024:
        desc = desc[:1021] + '...'

    # Build metadata block from lares-specific fields
    meta_fields = {}
    if mod['confidence']:
        meta_fields['confidence'] = mod['confidence']
    deps = [d for d in mod['dependencies'] if not d.startswith('[')]
    if deps:
        meta_fields['lares-dependencies'] = ' '.join(deps)
    if mod['meta_raw'].get('delegated-to'):
        delegated = mod['meta_raw']['delegated-to']
        if isinstance(delegated, dict):
            meta_fields['lares-delegates-to'] = ' '.join(delegated.keys())

    # Compose frontmatter
    fm_lines = ['---', f'name: {name}', f'description: "{desc}"']
    if meta_fields:
        fm_lines.append('metadata:')
        for k, v in meta_fields.items():
            fm_lines.append(f'  {k}: "{v}"')
    fm_lines.append('---')
    fm = '\n'.join(fm_lines)

    # Body: module description then a phase index linking to references/
    body_lines = [
        f'# {name}',
        '',
        mod['body'].strip(),
    ]

    if has_refs or has_extras:
        body_lines += ['', '## Supporting Files', '']
        body_lines.append('Load these files when performing tasks in this module:')
        body_lines.append('')
        phase_map = {
            'CONTEXT.md':       'Observe — design state, what is settled, what remains open',
            'ARCHITECTURE.md':  'Orient — architectural decisions and rationale',
            'PROCEDURES.md':    'Act — emission and execution procedures',
            'VERIFICATION.md':  'Assess — verification criteria and violation catalogue',
        }
        for ref in sorted(has_refs):
            label = phase_map.get(ref, ref)
            body_lines.append(f'- [references/{ref}](references/{ref}) — {label}')
        for extra in sorted(has_extras):
            body_lines.append(f'- [references/{extra}](references/{extra}) — flat specification reference')

    return fm + '\n\n' + '\n'.join(body_lines) + '\n'


# ---------------------------------------------------------------------------
# Rule file generation (.claude/rules/)
# ---------------------------------------------------------------------------

def build_rule_md(mod: dict, conventions_text: str) -> str:
    """Wrap decide/CONVENTIONS.md as a .claude/rules/ file."""
    name = mod['name']
    header = (
        f'---\n'
        f'description: "Always-on conventions for {name} — normative rules and invariants."\n'
        f'---\n\n'
    )
    return header + conventions_text


# ---------------------------------------------------------------------------
# CLAUDE.md generation
# ---------------------------------------------------------------------------

CLAUDE_MD_TEMPLATE = """\
# Lares Node — Claude Code Entry

<!-- This file is generated by builds/scripts/generate_skills.py -->
<!-- Edit source files in lares/modules/ and re-run make setup-claude-code -->

@AGENTS.md

## Claude Code–specific additions

Skills are in `.claude/skills/`. Always-on module conventions are in `.claude/rules/`.
The URI_SCHEMA.md flat spec is referenced from `.claude/skills/uri-schema/references/URI_SCHEMA.md`.

Use Plan mode for structural changes under `lares/`.
"""


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--modules-dir', default='lares/modules/', metavar='DIR')
    ap.add_argument('--out-dir', default='.claude/', metavar='DIR')
    ap.add_argument('--dry-run', action='store_true')
    ap.add_argument('--clean', action='store_true')
    ap.add_argument('--no-rules', action='store_true')
    ap.add_argument('--no-claude-md', action='store_true')
    args = ap.parse_args()

    repo_root = Path.cwd()
    modules_dir = repo_root / args.modules_dir
    out_dir = repo_root / args.out_dir
    skills_dir = out_dir / 'skills'
    rules_dir = out_dir / 'rules'

    if not modules_dir.exists():
        print(f'ERROR: modules dir not found: {modules_dir}', file=sys.stderr)
        return 1

    if args.clean:
        for d in [skills_dir, rules_dir]:
            if d.exists():
                if args.dry_run:
                    print(f'[dry-run] would remove: {d}')
                else:
                    shutil.rmtree(d)
                    print(f'Removed: {d}')
        return 0

    if yaml is None:
        print('WARNING: PyYAML not installed — frontmatter parsing may fail', file=sys.stderr)

    modules = discover_modules(modules_dir)
    if not modules:
        print('ERROR: no modules found', file=sys.stderr)
        return 1

    written: list[str] = []

    for mod in modules:
        name = mod['name']
        mod_dir = mod['dir']
        skill_out = skills_dir / name
        refs_out = skill_out / 'references'

        # --- Collect references (observe, orient, act, assess) ---
        has_refs: list[str] = []
        ref_contents: dict[str, str] = {}
        for phase, (src_rel, dest_name) in PHASE_REFS.items():
            src = mod_dir / src_rel
            if src.exists():
                ref_contents[dest_name] = src.read_text(encoding='utf-8')
                has_refs.append(dest_name)

        # --- Collect module-specific extras (e.g. URI_SCHEMA.md) ---
        has_extras: list[str] = []
        extra_contents: dict[str, str] = {}
        for extra_name in MODULE_EXTRAS.get(name, []):
            src = mod_dir / extra_name
            if src.exists():
                extra_contents[extra_name] = src.read_text(encoding='utf-8')
                has_extras.append(extra_name)

        # --- Generate SKILL.md ---
        skill_md = build_skill_md(mod, has_refs, has_extras)

        if args.dry_run:
            print(f'[dry-run] would write: {skill_out}/SKILL.md ({len(skill_md)} chars)')
            for fn in has_refs:
                print(f'[dry-run] would write: {refs_out}/{fn}')
            for fn in has_extras:
                print(f'[dry-run] would write: {refs_out}/{fn}')
        else:
            skill_out.mkdir(parents=True, exist_ok=True)
            skill_md_path = skill_out / 'SKILL.md'
            skill_md_path.write_text(skill_md, encoding='utf-8')
            written.append(str(skill_md_path.relative_to(repo_root)))

            if has_refs or has_extras:
                refs_out.mkdir(parents=True, exist_ok=True)
                for fn, content in ref_contents.items():
                    p = refs_out / fn
                    p.write_text(content, encoding='utf-8')
                    written.append(str(p.relative_to(repo_root)))
                for fn, content in extra_contents.items():
                    p = refs_out / fn
                    p.write_text(content, encoding='utf-8')
                    written.append(str(p.relative_to(repo_root)))

        # --- Generate always-on rule (decide phase) ---
        if not args.no_rules:
            decide_src = mod_dir / DECIDE_PHASE[0]
            if decide_src.exists():
                rule_text = build_rule_md(mod, decide_src.read_text(encoding='utf-8'))
                rule_path = rules_dir / f'{name}.md'
                if args.dry_run:
                    print(f'[dry-run] would write: {rule_path} ({len(rule_text)} chars)')
                else:
                    rules_dir.mkdir(parents=True, exist_ok=True)
                    rule_path.write_text(rule_text, encoding='utf-8')
                    written.append(str(rule_path.relative_to(repo_root)))

    # --- Generate CLAUDE.md ---
    if not args.no_claude_md:
        claude_md_path = repo_root / 'CLAUDE.md'
        if args.dry_run:
            print(f'[dry-run] would write: CLAUDE.md')
        else:
            claude_md_path.write_text(CLAUDE_MD_TEMPLATE, encoding='utf-8')
            written.append('CLAUDE.md')

    if not args.dry_run:
        print(f'Generated {len(written)} files:')
        for f in written:
            print(f'  {f}')
    return 0


if __name__ == '__main__':
    sys.exit(main())
