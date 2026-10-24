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


if __name__=='__main__':
    print(json.dumps(check(),indent=2))
