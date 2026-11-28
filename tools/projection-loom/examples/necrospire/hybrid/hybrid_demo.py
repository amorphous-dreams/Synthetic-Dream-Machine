"""One named location in the void, composed of CAD + sculptural polymesh.

Use the existing Necrospire CAD builder as structural cage. A separate
procedural polymesh contributes crystal facets, never new BRep authority.
"""
from __future__ import annotations
import argparse
from pathlib import Path
import math

from projection_loom.pipeline import Project
from projection_loom.hybrid import HybridLocation, faceted_crystal_mesh

BASE = Path(__file__).resolve().parents[1]


def grow_hybrid(genome=None, *, perturb=.13):
    project=Project.load(BASE/'project.json')
    p=dict(project.initial)
    if genome:p.update(genome)
    cage=project.grow(p)
    shaft=p['shaft_width']; length=p['shaft_length']
    sections=[(-length,0,0,.08,.10),(-.78*length,-.13,0,shaft*.37,shaft*.43),
              (-.55*length,.06,0,shaft*.48,shaft*.61),
              (-.3*length,.14,0,shaft*.51,shaft*.65),
              (-1.4,0,0,shaft*.66,shaft*.72),
              (1.2,0,0,shaft*.7,shaft*.68)]
    poly=faceted_crystal_mesh(sections,sides=8,jaggedness=.05,perturb=perturb)
    layer='~polymesh-obsidian'
    scene=HybridLocation('necrospire-poc0',cage,pet_name='Necrospire: A Crystal Bearing a Fortress')
    scene.add_mesh(layer,poly,role='sculptural',source='procedural',
                   genotype={'shaft_width':shaft,'shaft_length':length,'perturb':perturb})
    anchor_x=shaft*.7*(1+.05*math.sin(.35))
    scene.attach('crystal-to-cad-cage',layer,'obsidian needle',
                 (len(sections)-1)*8,(anchor_x,0,1.2),tolerance=.06)
    return project,scene


def main(argv=None):
    p=argparse.ArgumentParser()
    p.add_argument('--out',type=Path,required=True)
    p.add_argument('--perturb',type=float,default=.13)
    args=p.parse_args(argv)
    project,scene=grow_hybrid(perturb=args.perturb)
    result=scene.export(args.out,{'oblique':project.cameras['oblique']},
                        size=(256,384),style=project.render_style)
    print({'cad_valid':result['audit']['cad_valid'],
           'composite_render_valid':result['audit']['composite_valid_for_render'],
           'polymesh_faces':result['audit']['layers'][0]['triangles'],
           'step':str(args.out/'cad_body.step')})


if __name__=='__main__':main()
