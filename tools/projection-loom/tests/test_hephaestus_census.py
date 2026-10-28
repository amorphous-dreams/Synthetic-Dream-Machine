"""Warranted dependency tracing and specific rewrite responsibility inventory."""
import importlib.util
from pathlib import Path


def test_hephaestus_module_census_is_complete_and_explicit():
    path = Path(__file__).resolve().parents[1] / "scripts" / "hephaestus_census.py"
    spec = importlib.util.spec_from_file_location("hephaestus_census", path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    report = module.census(Path(__file__).resolve().parents[1])
    assert report["scope"] == "static-Python-imports-only"
    assert report["files_unparsed"] == []
    assert len(report["focus"]) == 8
    assert len(report["new_ground"]) == 7
    assert {entry["disposition"] for entry in report["focus"]} == {
        "RETAIN", "EXTRACT", "REWRITE"}
    lookup = {entry["module"]: entry for entry in report["focus"]}
    assert lookup["fractal_ooda_ha"]["disposition"] == "RETAIN"
    assert lookup["solid"]["disposition"] == "RETAIN"
    assert "seed_adapters" in lookup["generalized_campaign"]["static_imports"]
    assert "generalized_campaign" not in lookup["solid"]["static_imports"]
