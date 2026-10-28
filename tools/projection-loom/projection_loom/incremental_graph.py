"""Deterministic dependency invalidation under the existing OODA-HA helm.

This is a pure build-graph *planner*. It does not schedule epochs, launch CAD,
claim cached native evidence, or substitute a second evolutionary controller.
Execution must independently validate every generated or cached artifact.
"""
from __future__ import annotations

from dataclasses import dataclass
import re

from .provenance_encoding import canonical_json_sha256

_SHA = re.compile(r"^[a-f0-9]{64}$")


@dataclass(frozen=True)
class Product:
    id: str
    kind: str
    payload_sha256: str
    dependencies: tuple[str, ...] = ()

    def __post_init__(self):
        if not isinstance(self.id, str) or not self.id:
            raise ValueError("Product identity must be nonblank")
        if not isinstance(self.kind, str) or not self.kind:
            raise ValueError("Product kind must be nonblank")
        if not isinstance(self.payload_sha256, str) or not _SHA.fullmatch(self.payload_sha256):
            raise ValueError("Product requires a complete SHA256 of its own input")
        if (not isinstance(self.dependencies, tuple)
                or any(not isinstance(x, str) or not x for x in self.dependencies)
                or len(self.dependencies) != len(set(self.dependencies))):
            raise ValueError("Product dependencies must be unique and named")


class DependencyGraph:
    """Order-independent semantic declaration, dependency-sensitive digests."""
    def __init__(self, products):
        rows = tuple(products)
        if len({p.id for p in rows}) != len(rows):
            raise ValueError("Duplicate product ID")
        self.products = {p.id: p for p in rows}
        self._order()

    @classmethod
    def from_dict(cls, document):
        if set(document) != {"schema", "products"} or document["schema"] != "projection-loom/dependency-graph":
            raise ValueError("Unsupported dependency graph")
        return cls(Product(row["id"], row["kind"], row["payload_sha256"],
                           tuple(row.get("dependencies", ())))
                   for row in document["products"])

    def to_dict(self):
        return {"schema": "projection-loom/dependency-graph", "products": [
            {"id": p.id, "kind": p.kind, "payload_sha256": p.payload_sha256,
             "dependencies": sorted(p.dependencies)}
            for p in sorted(self.products.values(), key=lambda x: x.id)]}

    def _order(self):
        pending = dict(self.products)
        done, ordered = set(), []
        while pending:
            next_ready = sorted(k for k, node in pending.items()
                                if set(node.dependencies) <= done)
            if not next_ready:
                unknown = sorted({d for item in pending.values()
                                  for d in item.dependencies if d not in self.products})
                if unknown:
                    raise ValueError("Missing declared dependency: " + ", ".join(unknown))
                raise ValueError("Cyclic dependency graph")
            for name in next_ready:
                ordered.append(name)
                done.add(name)
                del pending[name]
        return ordered

    def effective_digests(self):
        digests = {}
        for name in self._order():
            p = self.products[name]
            digests[name] = canonical_json_sha256({
                "kind": p.kind, "payload": p.payload_sha256,
                "dependencies": [(d, digests[d]) for d in sorted(p.dependencies)]})
        return digests

    def compare(self, previous):
        if not isinstance(previous, DependencyGraph):
            raise TypeError("Compare two fully validated dependency graphs")
        before, after = previous.effective_digests(), self.effective_digests()
        rebuilt = [name for name in self._order() if before.get(name) != after[name]]
        cached = [name for name in self._order() if before.get(name) == after[name]]
        removed = sorted(set(before) - set(after))
        return {"schema": "projection-loom/invalidation-plan",
                "rebuilt": rebuilt, "cached": cached, "removed": removed,
                "before": before, "after": after,
                "avoided_rebuilds": len(cached),
                "required_rebuilds": len(rebuilt)}


def graph_for_scene(document):
    """Map authored growth programs to bounded CAD/STEP/USD dependency claims.

    These nodes describe prerequisites; they are not attestations of a run.
    Presentation is deliberately independent of constructive inputs.
    """
    from .scene_usd import _validate_declaration
    from .developmental import GrowthProgram
    _validate_declaration(document)
    products = []
    root = document["location"]
    source = Product("location:" + root, "location", canonical_json_sha256(root))
    products.append(source)
    for row in document["assemblies"]:
        identifier = row["entity_id"]
        program = GrowthProgram.from_dict(row["growth_program"])
        source_id = "program:" + identifier
        cad_id = "cad:" + identifier
        step_id = "step:" + identifier
        usd_id = "usd:" + identifier
        products.extend((
            Product(source_id, "growth-program", program.identity),
            Product(cad_id, "native-solid-audit", canonical_json_sha256("native-CAD"),
                    (source_id,)),
            Product(step_id, "STEP-transport", canonical_json_sha256("STEP-export"),
                    (cad_id,)),
            Product(usd_id, "USD-mesh", canonical_json_sha256("native-tessellation"),
                    (cad_id,))
        ))
    products.append(Product("scene:composition", "OpenUSD-stage",
                            canonical_json_sha256({"up_axis": "Z",
                                "meters_per_unit": float(document["meters_per_unit"])}),
                            tuple(sorted(p.id for p in products if p.id.startswith("usd:")))))
    products.append(Product("scene:presentation", "operator-presentation",
                            canonical_json_sha256("independently-owned-presentation"),
                            ("location:" + root,)))
    return DependencyGraph(products)
