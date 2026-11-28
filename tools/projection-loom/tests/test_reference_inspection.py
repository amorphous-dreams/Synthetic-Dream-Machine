"""The model intake path never promotes a downloaded triangle surface to CAD."""
import importlib.util
import json
from pathlib import Path
import subprocess
import shutil
import trimesh

SCRIPTS=Path(__file__).resolve().parents[1]/'scripts'

def load(name):
    p=SCRIPTS/name
    spec=importlib.util.spec_from_file_location(name.replace('.py',''),p)
    mod=importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def test_external_stl_and_scad_compiler_report(tmp_path):
    fetch=load('fetch_references.py')
    probe=load('inspect_reference_pack.py')
    mesh=trimesh.creation.box(extents=[2,3,4])
    stl=tmp_path/'source.stl';mesh.export(stl)
    scad=tmp_path/'source.scad';scad.write_text('cube([2,3,4]);')
    from io import BytesIO
    import zipfile
    raw=BytesIO()
    with zipfile.ZipFile(raw,'w') as z:
        z.write(stl,'models/source.stl')
        z.write(scad,'models/source.scad')
    archive=tmp_path/'external.zip';archive.write_bytes(raw.getvalue())
    receipt=fetch.acquire('brutalism2',tmp_path/'cache',bootstrap=True,
                          lockfile=tmp_path/'lock.json',import_archive=archive)
    p=tmp_path/'cache/receipts/brutalism2.json'
    output=probe.inspect(p,compile_scad=shutil.which('openscad') is not None)
    assert output['original_sha256']==receipt['sha256']
    assert len(output['sampled_stls'])==1
    assert output['sampled_stls'][0]['valid_surface_sample']
    assert output['sampled_stls'][0]['coordinate_frame']=='model_unit-unverified'
    assert output['authority'].startswith('polygon')
    if shutil.which('openscad'):
        assert output['openscad']['returncode']==0
        assert output['openscad']['cad_validity']=='not-inferred'
