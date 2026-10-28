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
    "location_stack": ("EXTRACT", "mixed source inventory, frames, relations, registration and native body audits"),
    "intent_seed": ("REWRITE", "producer-neutral source and intent contracts, retaining original evidence digests"),
    "seed_adapters": ("EXTRACT", "authored capability decoders and construction proposals behind experiment ownership"),
    "generalized_campaign": ("REWRITE", "single-helm generic campaign orchestration, replay and evidence ownership"),
    "developmental": ("EXTRACT", "native growth and inherited site logic; replace unstable site addressing"),
    "solid": ("RETAIN", "strict native OpenCascade/CadQuery geometry and independent audits"),
    "fractal_ooda_ha": ("RETAIN", "sole five-phase decision helm, operator controls and journals"),
    "cli": ("RETAIN", "one command surface including semantic ground, native scenes and evidence"),
}
NEW = {
    "relational_ground": "typed semantic identity, relations and causal frontiers",
    "scene_usd": "portable OpenUSD and independently verified native STEP evidence",
    "scene_variants": "separate candidate alternatives through USD variant sets",
    "incremental_graph": "pure dependency-sensitive rebuild plans",
    "editor_proposals": "typed actor-attributed editor proposals, conflict and CAD regeneration",
    "regulative_growth": "bounded native site responsiveness under single OODA-HA journal",
    "hephaestus_crucible": "held-out cross-representation adversarial witness",
}


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
              "new_ground": []}
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
