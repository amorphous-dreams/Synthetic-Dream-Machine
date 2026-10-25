"""Fail CI cleanly when the installed geometry kernels are unavailable."""
from importlib import metadata
import importlib
import json
import shutil
import math
from pathlib import Path


def check():
    out={}
    for name in ('cadquery','numpy','scipy','networkx','opencv-python-headless',
                 'Pillow','trimesh','pytest','rasterio','pyproj'):
        out[name]=metadata.version(name)
    cadquery=importlib.import_module('cadquery')
    sample=cadquery.Workplane('XY').box(2,3,4).val()
    assert sample.isValid() and math.isclose(sample.Volume(),24.0,rel_tol=1e-9)
    out['openscad_path']=shutil.which('openscad')
    return out



def verify_direct_pins(requirements_path, *, project_path=None, installed=True):
    """Verify direct CI pins and declarations, without claiming a full lockfile.

    Transitive wheels remain resolver-selected and are recorded by pip freeze
    in the CI artifact; this only guards our deliberately pinned direct inputs.
    """
    import re
    import tomllib

    normalize = lambda s: re.sub(r'[-_.]+', '-', s).lower()
    pins = {}
    for line in Path(requirements_path).read_text(encoding='utf8').splitlines():
        line = line.strip()
        if not line or line.startswith('#'):
            continue
        match = re.fullmatch(r'([A-Za-z0-9][A-Za-z0-9_.-]*)==([A-Za-z0-9][A-Za-z0-9_.+-]*)', line)
        if not match:
            raise ValueError(f'CI dependency unpinned or malformed: {line}')
        name, version = normalize(match.group(1)), match.group(2)
        if name in pins:
            raise ValueError(f'CI dependency pinned twice: {name}')
        pins[name] = version

    if project_path is not None:
        project = tomllib.loads(Path(project_path).read_text(encoding='utf8'))['project']
        declared = list(project.get('dependencies', ()))
        for optional in project.get('optional-dependencies', {}).values():
            declared.extend(optional)
        for spec in declared:
            match = re.match(r'^([A-Za-z0-9][A-Za-z0-9_.-]*)', spec)
            if not match or normalize(match.group(1)) not in pins:
                raise ValueError(f'CI direct pins missing declared project dependency: {spec}')

    if installed:
        for name, expected in pins.items():
            actual = metadata.version(name)
            if actual != expected:
                raise ValueError(f'CI installed dependency {name}: expected {expected}, got {actual}')
    return pins


if __name__=='__main__':
    root = Path(__file__).resolve().parents[1]
    verify_direct_pins(root/'requirements-ci.txt',
                       project_path=root/'pyproject.toml', installed=True)
    print(json.dumps(check(),indent=2))
