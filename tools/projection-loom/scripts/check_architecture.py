"""Static architecture check for the live alpha Projection Loom.

No geometry kernel imports are required. Keep the one OODA-HA helm, pure
phase-law validation, and downstream rendering/evidence ports independent.
Run it before model-dependent tests to catch accidental responsibility drift.
"""
from __future__ import annotations

import ast
from pathlib import Path


RETIRED = ('ooda.py', 'fractal-ooda-ha.py')
PURE_PORTS = {
    'phase_rules.py', 'selection.py', 'provenance_encoding.py',
    'evidence_receipts.py', 'review.py', 'gallery.py',
}
PHASE_IO_IMPORTS = {'os', 'pathlib', 'shutil', 'subprocess', 'socket', 'requests'}
PHASE_IO_METHODS = {
    'save', 'write', 'write_text', 'write_bytes', 'replace', 'unlink',
    'rename', 'mkdir', 'rmdir',
}


def _definitions(tree, kind, name):
    return [item for item in tree.body
            if isinstance(item, kind) and item.name == name]


def inspect_source_tree(root):
    """Return reproducible architecture violations; perform no writes."""
    package = Path(root) / 'projection_loom'
    errors = []
    if not package.is_dir():
        return [f'Projection Loom package missing: {package}']

    for retired in RETIRED:
        if (package / retired).exists():
            errors.append(f'Retired module still present: {retired}')
    for needed in ('fractal_ooda_ha.py', 'phase_rules.py',
                   'review.py', 'gallery.py', 'selection.py',
                   'provenance_encoding.py', 'evidence_receipts.py'):
        if not (package / needed).is_file():
            errors.append(f'Missing canonical alpha module: {needed}')

    runners, journals, phase_owners = [], [], []
    for path in sorted(package.glob('*.py')):
        try:
            tree = ast.parse(path.read_text(encoding='utf8'), filename=str(path))
        except (SyntaxError, UnicodeError) as exc:
            errors.append(f'Python source cannot be parsed: {path.name}: {exc}')
            continue

        if _definitions(tree, ast.FunctionDef, 'run_ooda_epochs'):
            runners.append(path.name)
        if _definitions(tree, ast.ClassDef, 'OODAJournal'):
            journals.append(path.name)

        for node in tree.body:
            if isinstance(node, (ast.Assign, ast.AnnAssign)):
                targets = node.targets if isinstance(node, ast.Assign) else [node.target]
                if any(isinstance(target, ast.Name) and target.id == 'PHASES'
                       for target in targets):
                    phase_owners.append(path.name)

        for node in ast.walk(tree):
            if isinstance(node, ast.Import):
                imported = [item.name for item in node.names]
            elif isinstance(node, ast.ImportFrom):
                imported = [node.module] if node.module else []
            else:
                imported = []

            for module in imported:
                if module in ('ooda', 'projection_loom.ooda',
                              'fractal-ooda-ha', 'projection_loom.fractal-ooda-ha'):
                    errors.append(f'Retired OODA import in {path.name}: {module}')
                if path.name in PURE_PORTS and module in (
                    'fractal_ooda_ha', 'projection_loom.fractal_ooda_ha'):
                    errors.append(
                        f'Renderer and pure policy cannot import the OODA helm: {path.name}')
                if (path.name == 'phase_rules.py' and
                    module.split('.')[0] in PHASE_IO_IMPORTS):
                    errors.append(f'Phase-law module cannot import {module}')
            if path.name == 'phase_rules.py' and isinstance(node, ast.Call):
                callee = node.func
                name = (callee.attr if isinstance(callee, ast.Attribute)
                        else callee.id if isinstance(callee, ast.Name) else '')
                if name in PHASE_IO_METHODS or name in ('open', 'exec', 'eval'):
                    errors.append(f'Phase-law module must not write: {name}')

    if runners != ['fractal_ooda_ha.py']:
        errors.append(f'More than one OODA-HA controller, or wrong entrypoint: {runners}')
    if journals != ['fractal_ooda_ha.py']:
        errors.append(f'OODA-HA journal must have one owner: {journals}')
    if phase_owners != ['phase_rules.py']:
        errors.append(f'Five-phase law must have one owner: {phase_owners}')

    return errors


def main():
    root = Path(__file__).resolve().parents[1]
    errors = inspect_source_tree(root)
    if errors:
        for error in errors:
            print('Architecture gate: ' + error)
        raise SystemExit(1)
    print('Architecture gate: one fractal OODA-HA helm, pure phase law, distinct ports')


if __name__ == '__main__':
    main()
