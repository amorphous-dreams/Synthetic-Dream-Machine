"""Tight-aperture guarantees for generative multi-kernel entity capabilities."""
from pathlib import Path
import json
import numpy as np
import pytest

from projection_loom.solid import SolidAssembly, box
from projection_loom.hybrid import derived_cad_surface, semantic_cad_point, HybridLocation
from projection_loom.capability_stack import (Capability, CapabilityRecipe,
                                              CapabilityCompositor, default_registry)
from projection_loom.pipeline import Project
from projection_loom.cameras import Camera

ROOT=Path(__file__).resolve().parents[1]


@pytest.mark.parametrize('amp', [.0,.09,.23])
def test_cad_derived_mesh_changes_only_its_own_surface(amp):
    solid=box((0,0,0),(2,2,5))
    before=solid.Volume()
    mesh,receipt=derived_cad_surface(solid,{'relief':amp,'seed':11,'fracture':.07},
                   camera=Camera(azimuth=35,elevation=20,fit='bounds'),size=(128,192))
    assert mesh.is_watertight and mesh.is_volume and mesh.volume>0
    assert solid.Volume()==pytest.approx(before)
    assert receipt['BRep_tessellated'] and receipt['source_vertices']==len(mesh.vertices)
    assert receipt['maximum_world_deviation']>=0
    anchor=np.asarray(semantic_cad_point(solid,'top-east'))
    assert np.min(np.linalg.norm(mesh.vertices-anchor,axis=1))<1e-6


@pytest.mark.parametrize('bad', [
   {'relief':.40}, {'fracture':.5}, {'wave':100},
   {'seed':-3}, {'guide':.7}, {'protected_radius':0}, {'max_shift_px':0}
])
def test_unbounded_surface_operators_fail_closed(bad):
    with pytest.raises(ValueError):
        derived_cad_surface(box((0,0,0),(2,2,4)),bad)


def test_source_guidance_requires_fixed_evidence_camera():
    with pytest.raises(ValueError,match='fixed'):
        derived_cad_surface(box((0,0,0),(2,2,4)),{'guide':.15},
           camera=Camera(azimuth=40,elevation=20,fit='bounds'),
           size=(64,96),source_mask=np.zeros((96,64),dtype=bool))


def test_bound_projected_surface_deviation():
    from projection_loom.calibration import freeze_display_camera
    part=box((0,0,0),(3,2,6))
    vs,_=part.tessellate(.35,.3)
    fixed=freeze_display_camera(Camera(azimuth=45,elevation=15,fit='bounds'),
                                 np.asarray([v.toTuple() for v in vs]),(96,144))
    mesh,receipt=derived_cad_surface(part,{'relief':.3,'fracture':.3,
                                         'max_shift_px':2.},camera=fixed,size=(96,144))
    assert mesh.is_volume
    assert receipt['maximum_world_deviation']*receipt['pixel_scale']<=2.0001


def test_exact_cad_receipts_invalidate_on_construction_mutation():
    a=SolidAssembly().add('foundation',box((0,0,0),(5,5,4)),role='foundation')
    first=a.audit(join=True)
    assert a.audit(join=True)==first
    a.add('wing',box((2,0,0),(3,2,2)),parents=['foundation'])
    second=a.audit(join=True)
    assert second['parts']==2 and second['union_volume']>first['union_volume']
    assert len(second['contacts'])==1


def test_recipe_rejects_dependency_cycles_and_missing_loci():
    with pytest.raises(ValueError,match='cycle|dependency'):
        CapabilityRecipe(location='test',pet_name='Test',steps=[
            Capability('a','Test','cad',depends_on=('b',)),
            Capability('b','Test','cad',depends_on=('a',))],
            bounds={'x':(0,1)},initial={'x':.5},cad_keys=('x',))
    with pytest.raises(ValueError,match='Missing activation'):
        CapabilityRecipe(location='test',pet_name='Test',steps=[
            Capability('a','Test','cad',activation='not-in-genome')],
            bounds={'x':(0,1)},initial={'x':.5},cad_keys=('x',))


def test_versioned_recipe_hash_and_source_lineage_reject_tampering(tmp_path):
    project=Project.load(ROOT/'examples/necrospire/project.json')
    original=CapabilityRecipe.load(ROOT/'examples/necrospire/hybrid/recipe.json')
    file=tmp_path/'recipe.json'
    original.save(file)
    assert CapabilityRecipe.load(file).sha256==original.sha256
    data=json.loads(file.read_text())
    data['initial']['crystal.relief']+=.01
    file.write_text(json.dumps(data))
    with pytest.raises(ValueError,match='digest'):
        CapabilityRecipe.load(file)
    altered=CapabilityRecipe(location=original.location,pet_name=original.pet_name,
        steps=original.steps,bounds=original.bounds,initial=original.initial,
        cad_keys=original.cad_keys,source_hashes={'image':'0'*64})
    with pytest.raises(ValueError,match='digest'):
        CapabilityCompositor(project,altered,size=(64,96))


def test_operator_version_and_surface_activation_change_phenotype():
    project=Project.load(ROOT/'examples/necrospire/project.json')
    recipe=CapabilityRecipe.load(ROOT/'examples/necrospire/hybrid/recipe.json')
    comp=CapabilityCompositor(project,recipe,size=(64,96))
    from projection_loom.capability_stack import digest
    first=comp.grow(recipe.initial)
    genes=dict(recipe.initial,**{'join.enable':.8})
    next_model=comp.grow(genes)
    active1={x['id'] for x in first.steps if x['state']=='complete'}
    active2={x['id'] for x in next_model.steps if x['state']=='complete'}
    assert 'join.mesh' not in active1 and 'join.mesh' in active2
    assert first.witness().witness_id!=next_model.witness().witness_id
    assert first.scene.audit()['composite_cad_union_verified'] is False
    assert first.recipe.sha256==next_model.recipe.sha256
    assert digest(first.genome)!=digest(next_model.genome)
