from pathlib import Path
from projection_loom.cli import main

EXAMPLE=Path(__file__).resolve().parents[1]/'examples'/'project.json'


def test_render_cli(tmp_path):
    result=main(['render','--project',str(EXAMPLE),'--out',str(tmp_path/'render')])
    assert 'controls' in result
    assert (tmp_path/'render'/'controls'/'top_lit_structure.png').exists()


def test_validate_cli(tmp_path):
    result=main(['validate','--project',str(EXAMPLE),'--out',str(tmp_path/'qa')])
    assert 'contacts' in result
    assert set(result['projections'])=={'reference','front','side','rear','top'}
