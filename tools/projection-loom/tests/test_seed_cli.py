"""Portable model seed entry points exposed by the command surface."""
from pathlib import Path
from projection_loom.cli import main
from projection_loom.evolution import Project

EXAMPLE=Path(__file__).resolve().parents[1]/'examples'/'project.json'


def test_render_from_imported_mesh(tmp_path):
    project=Project.load(EXAMPLE)
    exported=project.build(project.initial).export_obj(tmp_path/'held.obj')
    result=main(['render','--project',str(EXAMPLE),
                 '--seed-geometry',str(exported),'--out',str(tmp_path/'output')])
    assert result['geometry_mode']=='deformation'
    assert (tmp_path/'output'/'controls'/'front_silhouette.png').is_file()


def test_validate_from_imported_native_mesh(tmp_path):
    project=Project.load(EXAMPLE)
    exported=project.build(project.initial).save(tmp_path/'held.npz',project.initial)
    result=main(['validate','--project',str(EXAMPLE),
                 '--seed-geometry',str(exported),'--out',str(tmp_path/'checks')])
    assert result['geometry_source']==str(exported.resolve())
    assert result['contacts']['part_contact_count']>=1
