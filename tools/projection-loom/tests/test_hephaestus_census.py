"""Consumer census searches the true runtime entrypoint surfaces."""
from pathlib import Path
import importlib.util


def _tool():
    source = Path(__file__).resolve().parents[1] / "scripts" / "hephaestus_census.py"
    spec = importlib.util.spec_from_file_location("hephaestus_census", source)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_consumer_census_finds_external_python_dynamic_and_workflow_callers(tmp_path):
    tool = _tool()
    module = tmp_path / "projection_loom"
    module.mkdir()
    (module / "relational_ground.py").write_text("pass\n")
    (module / "location_workspace.py").write_text("pass\n")
    (module / "scene_usd.py").write_text("pass\n")
    tests = tmp_path / "tests"
    tests.mkdir()
    (tests / "test_runtime.py").write_text(
        "from projection_loom.relational_ground import RelationalGround\n"
        "from importlib import import_module\n"
        "x = import_module('projection_loom.location_workspace')\n"
        "x = import_module(module_name)\n")
    scripts = tmp_path / "scripts"
    scripts.mkdir()
    (scripts / "launch.py").write_text("import projection_loom.scene_usd\n")
    workflows = tmp_path / ".github" / "workflows"
    workflows.mkdir(parents=True)
    (workflows / "test.yml").write_text(
        "run: python -m projection_loom.location_workspace\n")
    result = tool.executable_consumers(
        tmp_path, {"relational_ground", "location_workspace", "scene_usd"})
    assert result["python"]["tests/test_runtime.py"] == [
        "location_workspace", "relational_ground"]
    assert result["python"]["scripts/launch.py"] == ["scene_usd"]
    assert result["workflows"]["test.yml"] == ["location_workspace"]
    assert result["unresolved_dynamic_calls"] == [{
        "file": "tests/test_runtime.py", "line": 4}]
    assert result["retirement_authority"].startswith("operator-only")


def test_live_census_still_refuses_alpha_module_auto_retirement():
    tool = _tool()
    repo = Path(__file__).resolve().parents[1]
    report = tool.census(repo)
    assert report["deletion_authorized"] is False
    assert report["external_consumers"]["scope"].startswith("AST-static")
    assert "location_workspace" in {x["module"] for x in report["new_ground"]}
    assert "relational_ground" in {x["module"] for x in report["new_ground"]}
    assert all(p["static_consumers"] is not None for p in report["new_ground"])
