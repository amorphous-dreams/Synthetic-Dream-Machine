"""Alpha architectural invariants: one helm, many evidence witnesses.

The live branch is authoritative; retired OODA modules are not compatibility
contracts. These tests exercise an inspection helper with explicit negative
controls so a future accidental duplicate runner or impure guard fails CI.
"""
from pathlib import Path
import shutil

import pytest

from scripts.check_architecture import inspect_source_tree
from scripts.check_env import verify_direct_pins


ROOT = Path(__file__).resolve().parents[1]


def test_live_package_has_one_helm_and_pure_phase_law():
    assert inspect_source_tree(ROOT) == []


def test_architecture_witness_rejects_retired_name_and_second_helm(tmp_path):
    package = tmp_path / 'projection_loom'
    shutil.copytree(ROOT / 'projection_loom', package)
    (package / 'ooda.py').write_text('def run_ooda_epochs(): pass\n')
    issues = inspect_source_tree(tmp_path)
    assert any('Retired module' in item for item in issues)
    assert any('More than one OODA-HA controller' in item for item in issues)


def test_architecture_witness_rejects_impure_phase_guard(tmp_path):
    package = tmp_path / 'projection_loom'
    shutil.copytree(ROOT / 'projection_loom', package)
    phase = package / 'phase_rules.py'
    phase.write_text(phase.read_text() + "\nfrom pathlib import Path\nPath('oops').write_text('bad')\n")
    issues = inspect_source_tree(tmp_path)
    assert any('Phase-law module cannot import' in item for item in issues)
    assert any('Phase-law module must not write' in item for item in issues)


def test_architecture_witness_rejects_backedge_from_renderers(tmp_path):
    package = tmp_path / 'projection_loom'
    shutil.copytree(ROOT / 'projection_loom', package)
    review = package / 'review.py'
    review.write_text(review.read_text() + '\nfrom .fractal_ooda_ha import OODAJournal\n')
    assert any('Renderer and pure policy cannot import the OODA helm' in item
               for item in inspect_source_tree(tmp_path))


def test_direct_ci_pins_cover_installed_project_declarations(tmp_path):
    pins = verify_direct_pins(ROOT / 'requirements-ci.txt',
                              project_path=ROOT / 'pyproject.toml', installed=False)
    assert pins['cadquery'] == '2.8.0'
    assert pins['numpy'] == '2.3.5'
    assert pins['trimesh'] == '4.11.1'
    assert pins['pytest'] == '9.0.2'
    altered = tmp_path / 'requirements.txt'
    altered.write_text((ROOT / 'requirements-ci.txt').read_text() + '\nunpinned-lib>=1\n')
    with pytest.raises(ValueError, match='unpinned'):
        verify_direct_pins(altered, installed=False)
    altered.write_text((ROOT / 'requirements-ci.txt').read_text().replace(
        'trimesh==4.11.1', ''))
    with pytest.raises(ValueError, match='missing'):
        verify_direct_pins(altered, project_path=ROOT / 'pyproject.toml',
                           installed=False)


def test_workflow_ensures_environment_and_architecture_gates():
    workflow = (ROOT.parents[1] / '.github/workflows/projection-loom.yml').read_text()
    assert 'python -m pip check' in workflow
    assert 'python -m compileall -q projection_loom scripts' in workflow
    assert 'python scripts/check_architecture.py' in workflow
    assert 'python -m pytest -q tests' in workflow
