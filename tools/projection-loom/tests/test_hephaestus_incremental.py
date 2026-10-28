"""Selective invalidation, no fake cache truth or second OODA-HA."""
import copy
import pytest
from projection_loom.incremental_graph import DependencyGraph, Product, graph_for_scene
from projection_loom.provenance_encoding import canonical_json_sha256


def digest(s):
    return canonical_json_sha256(s)


def graph(a="a"):
    return DependencyGraph((
        Product("a", "source", digest(a)),
        Product("b", "native", digest("builder"), ("a",)),
        Product("c", "usd", digest("tessellate"), ("b",)),
        Product("independent", "observation", digest("unrelated")),
    ))


def test_invalidation_reaches_required_dependents_and_preserves_unrelated():
    before, after = graph("a"), graph("different")
    result = after.compare(before)
    assert result["rebuilt"] == ["a", "b", "c"]
    assert result["cached"] == ["independent"]
    assert result["avoided_rebuilds"] == 1


def test_independent_order_is_metamorphically_invariant():
    items = list(graph().products.values())
    original = DependencyGraph(items)
    reordered = DependencyGraph(reversed(items))
    assert original.effective_digests() == reordered.effective_digests()
    assert reordered.compare(original)["required_rebuilds"] == 0


def test_invalid_graph_cycles_and_missing_inputs_refused():
    with pytest.raises(ValueError, match="Missing declared dependency"):
        DependencyGraph([Product("a", "native", digest(1), ("missing",))])
    with pytest.raises(ValueError, match="Cyclic dependency"):
        DependencyGraph([Product("a", "native", digest(1), ("b",)),
                         Product("b", "native", digest(1), ("a",))])
    with pytest.raises(ValueError, match="Duplicate product"):
        DependencyGraph([Product("a", "native", digest(1)), Product("a", "native", digest(2))])


def test_scene_selective_dependency_plan():
    def program(width):
        return {"nodes": [{"key": "root", "op": "foundation",
                           "size": [width, 5, 2]}]}
    previous = {"schema": "projection-loom/scene-declaration",
                "location": "independent-subject", "meters_per_unit": 1.0,
                "assemblies": [
                    {"entity_id": "east", "growth_program": program(5)},
                    {"entity_id": "west", "growth_program": program(6)}]}
    current = copy.deepcopy(previous)
    current["assemblies"][0]["growth_program"]["nodes"][0]["size"][0] = 7
    plan = graph_for_scene(current).compare(graph_for_scene(previous))
    assert plan["rebuilt"] == ["program:east", "cad:east", "step:east",
                               "usd:east", "scene:composition"]
    assert "cad:west" in plan["cached"]
    assert "usd:west" in plan["cached"]
    assert "scene:presentation" in plan["cached"]
    current["assemblies"].reverse()
    assert graph_for_scene(current).effective_digests() == graph_for_scene(
        {"schema": previous["schema"], "location": previous["location"],
         "meters_per_unit": previous["meters_per_unit"],
         "assemblies": list(reversed(current["assemblies"]))}).effective_digests()
