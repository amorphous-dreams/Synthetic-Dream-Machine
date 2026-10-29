"""Deterministic live source ownership census for the Hephaestus roadmap.

Static imports name only visible Python dependencies; dynamic import, command
dispatch, native CAD subprocess and editor host interactions need additional
human inspection. This report is evidence for future rewrite decisions, not an
automatic migration plan.
"""
from __future__ import annotations

import argparse
import ast
from hashlib import sha256
import json
from pathlib import Path

FOCUS = {
    "location_stack": ("RETAIN", "sole source/frame admission and inventory; geometry and causal authority outside"),
    "intent_seed": ("RETAIN", "immutable typed seeds, intent contracts and identity; no independent inventory constructor"),
    "seed_adapters": ("RETAIN", "source decoding and authored growth offers; delegates inventory admission"),
    "generalized_campaign": ("RETAIN", "single-helm subject-neutral campaign execution and replay; no source ledger"),
    "developmental": ("EXTRACT", "native growth and inherited site logic; replace unstable site addressing"),
    "solid": ("RETAIN", "strict native OpenCascade/CadQuery geometry and independent audits"),
    "fractal_ooda_ha": ("RETAIN", "sole five-phase decision helm, operator controls and journals"),
    "cli": ("RETAIN", "one command surface including semantic ground, native scenes and evidence"),
}
NEW = {
    "relational_ground": "single typed causal event/semantic identity owner",
    "scene_usd": "portable OpenUSD and independently verified native STEP evidence",
    "scene_variants": "separate candidate alternatives through USD variant sets",
    "incremental_graph": "pure dependency-sensitive rebuild plans",
    "editor_proposals": "typed actor-attributed editor proposals, conflict and CAD regeneration",
    "regulative_growth": "bounded native site responsiveness under single OODA-HA journal",
    "hephaestus_crucible": "held-out cross-representation adversarial witness",
    "location_workspace": "single native/source/causal OODA-HA location boundary",
    "native_support": "exact STEP bearing-contact witness, not load certification",
    "source_registration": "independently measured camera reprojection evidence",
    "matched_registered_trial": "paired and repeated source-blind native experiments",
    "hephaestus_holistic": "held-out source-to-STEP-to-USD native crucible",
}



def _read_consumer_imports(path, package_names):
    """AST-backed consumers across scripts, tests, experiments and Blender."""
    result = set()
    unresolved = []
    tree = ast.parse(path.read_text(encoding="utf8"), filename=str(path))
    for node in ast.walk(tree):
        names = []
        if isinstance(node, ast.Import):
            names = [x.name for x in node.names]
        elif isinstance(node, ast.ImportFrom):
            if node.module == "projection_loom":
                names = ["projection_loom." + x.name for x in node.names]
            elif node.module and node.module.startswith("projection_loom."):
                names = [node.module]
        for name in names:
            if name.startswith("projection_loom."):
                module = name.split(".")[1]
                if module in package_names:
                    result.add(module)
        if isinstance(node, ast.Call):
            fn = node.func
            # Both importlib.import_module(...) and the directly imported
            # from-import form are executable, not merely textual references.
            dynamic = ((isinstance(fn, ast.Attribute) and fn.attr == "import_module")
                       or (isinstance(fn, ast.Name) and fn.id in (
                           "__import__", "import_module")))
            if dynamic:
                if node.args and isinstance(node.args[0], ast.Constant):
                    name = node.args[0].value
                    if isinstance(name, str) and name.startswith("projection_loom."):
                        module = name.split(".")[1]
                        if module in package_names:
                            result.add(module)
                else:
                    unresolved.append(node.lineno)
    return sorted(result), sorted(set(unresolved))


def executable_consumers(root, names):
    """Outside-package callers and workflows. No deletion inference from absence."""
    root = Path(root)
    report = {"scope": "AST-static + literal-dynamic + workflow-command-strings",
              "unresolved_dynamic_calls": [],
              "unparsed_consumers": [],
              "python": {},
              "workflows": {},
              "retirement_authority": "operator-only; absence of static evidence is not deletion approval"}
    for directory in ("scripts", "tests", "experiments", "blender"):
        folder = root / directory
        if not folder.exists():
            continue
        for path in sorted(folder.rglob("*.py")):
            relative = str(path.relative_to(root))
            try:
                imports, unresolved = _read_consumer_imports(path, names)
            except (SyntaxError, UnicodeError):
                report["unparsed_consumers"].append(relative)
                continue
            if imports:
                report["python"][relative] = imports
            for line in unresolved:
                report["unresolved_dynamic_calls"].append({"file": relative, "line": line})
    workflow_root = (root / ".github" / "workflows"
                     if (root / ".github" / "workflows").is_dir()
                     else root.parents[1] / ".github" / "workflows")
    if workflow_root.is_dir():
        for path in sorted(workflow_root.glob("*.yml")):
            text = path.read_text(encoding="utf8")
            hits = [name for name in sorted(names)
                    if "projection_loom." + name in text
                    or "projection_loom/" + name + ".py" in text]
            if hits:
                report["workflows"][path.name] = hits
    return report


def census(root):
    package = Path(root) / "projection_loom"
    if not package.is_dir():
        raise FileNotFoundError("Projection Loom package unavailable")
    paths = sorted(package.glob("*.py"))
    names = {p.stem for p in paths}
    imports, incoming, unparsed = {}, {name: set() for name in names}, []
    for path in paths:
        text = path.read_text(encoding="utf8")
        try:
            tree = ast.parse(text, filename=str(path))
        except SyntaxError:
            unparsed.append(path.name)
            continue
        deps = set()
        for node in ast.walk(tree):
            if isinstance(node, ast.ImportFrom) and node.module:
                if node.level:
                    target = node.module.split(".")[0]
                elif node.module.startswith("projection_loom."):
                    target = node.module.split(".")[1]
                else:
                    continue
                if target in names:
                    deps.add(target)
            elif isinstance(node, ast.Import):
                for alias in node.names:
                    if alias.name.startswith("projection_loom."):
                        target = alias.name.split(".")[1]
                        if target in names:
                            deps.add(target)
        imports[path.stem] = sorted(deps)
        for name in deps:
            incoming[name].add(path.stem)
    report = {"schema": "projection-loom/architecture-consumer-census",
              "scope": "static-Python-imports-only",
              "dynamic_imports_scanned": False,
              "native_CAD_or_editor_effects_scanned": False,
              "files_unparsed": unparsed,
              "focus": [],
              "new_ground": [],
              "external_consumers": executable_consumers(root,names),
              "deletion_authorized": False}
    for name, (decision, responsibility) in sorted(FOCUS.items()):
        file = package / (name + ".py")
        if not file.is_file():
            raise FileNotFoundError("Expected live module not found: " + str(file))
        report["focus"].append({
            "module": name, "sha256": sha256(file.read_bytes()).hexdigest(),
            "disposition": decision, "responsibility": responsibility,
            "static_imports": imports.get(name, []),
            "static_consumers": sorted(incoming.get(name, []))})
    for name, responsibility in sorted(NEW.items()):
        file = package / (name + ".py")
        if not file.is_file():
            raise FileNotFoundError("Missing new live ground: " + name)
        report["new_ground"].append({
            "module": name, "sha256": sha256(file.read_bytes()).hexdigest(),
            "responsibility": responsibility,
            "static_imports": imports.get(name, []),
            "static_consumers": sorted(incoming.get(name, []))})
    return report


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--out", type=Path)
    args = parser.parse_args()
    document = census(Path(__file__).resolve().parents[1])
    content = json.dumps(document, indent=2, sort_keys=True) + "\n"
    if args.out:
        args.out.parent.mkdir(parents=True, exist_ok=True)
        args.out.write_text(content, encoding="utf8")
    print(content)


if __name__ == "__main__":
    main()
