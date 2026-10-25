"""RED FIRST: next-wave search architecture and provenance contracts.

These tests deliberately demand behavior not implemented by the prior wave.
Source annotations are observational masks, grammar choices are hypotheses,
and transferred genes convey no cross-location source or CAD authority.
"""
import hashlib
import json
from pathlib import Path

import numpy as np
import pytest
from PIL import Image

from projection_loom.campaign import FAMILY_FOCUSES, LineageArchive, make_brood
from projection_loom.capability_stack import CapabilityRecipe, CapabilityCompositor
from projection_loom.pipeline import Project
from projection_loom.grammar import grow_program
from projection_loom.solid import SolidAssembly
from projection_loom.search_strategy import (
    infer_locus_interactions, adaptive_foci, regional_loss
)
from projection_loom.feature_evidence import FeatureEvidence
from projection_loom.genetic_transfer import (
    build_transfer_seed, verify_transfer_bundle, bundle_transfers
)

ROOT=Path(__file__).resolve().parents[1]
EXAMPLES=ROOT/'examples/necrospire'


def test_measured_gene_interaction_learns_nonadditive_pair_and_freezes_generation():
    rng=np.random.default_rng(104)
    rows={}
    for i in range(96):
        x,y=rng.random(2)
        rows[f'{i:04d}']={
            'id':f'0001/needle-{i:03d}', 'family':'needle',
            'genome':{'x':float(x),'y':float(y),'z':float(rng.random())},
            'losses':{'silhouette':float(.12+.55*(x-.5)*(y-.5))},
            'mask_sha256':f'{i:064x}'}
    # Deliberately contradictory newer data must not affect a frozen generation.
    rows['future']={'id':'0002/needle-000','family':'needle',
        'genome':{'x':.95,'y':.95,'z':.95},
        'losses':{'silhouette':.99},'mask_sha256':'f'*64}
    class Archive:
        data={'members':rows}
    bounds={'x':(0.,1.),'y':(0.,1.),'z':(0.,1.)}
    first=infer_locus_interactions(bounds,Archive(),before_generation=2,
                                  min_samples=24,threshold=.25)
    again=infer_locus_interactions(bounds,Archive(),before_generation=2,
                                  min_samples=24,threshold=.25)
    assert first==again
    assert first and {first[0]['a'],first[0]['b']}=={'x','y'}
    assert first[0]['evidence']=='observational-association'
    foci=adaptive_foci({'needle':('x',),'terraces':('y',),'keep':('z',)},first,max_extra=2)
    assert set(foci['needle'])=={'x','y'}
    assert set().union(*(set(v) for v in foci.values()))==set(bounds)
    assert infer_locus_interactions(bounds,None,min_samples=24)==[]


def test_operator_attention_masks_bound_to_exact_source_and_view(tmp_path):
    mask=np.zeros((48,64),dtype=np.uint8)
    mask[:16,:]=255
    file=tmp_path/'upper.png'
    Image.fromarray(mask,'L').save(file)
    source_hash='a'*64
    payload={'schema':'projection-loom/feature-evidence/v1',
        'source_sha256':source_hash,'evidence_state':'operator-annotated',
        'regions':{'Fortress':{'path':'upper.png','sha256':hashlib.sha256(file.read_bytes()).hexdigest()}}}
    manifest=tmp_path/'evidence.json'
    manifest.write_text(json.dumps(payload))
    loaded=FeatureEvidence.load(manifest,source_sha256=source_hash,score_size=(64,48))
    reference=np.zeros((48,64),dtype=bool)
    reference[:12,12:30]=True
    different=reference.copy()
    different[30:36,12:30]=True
    assert regional_loss(reference,different,'crown',attention=loaded.mask_for('crown'))==0
    changed=reference.copy()
    changed[3:8,12:30]=False
    assert regional_loss(reference,changed,'crown',attention=loaded.mask_for('crown'))>0
    assert loaded.digest==FeatureEvidence.load(manifest,source_sha256=source_hash,
                                                score_size=(64,48)).digest
    with pytest.raises(ValueError,match='source'):
        FeatureEvidence.load(manifest,source_sha256='b'*64,score_size=(64,48))
    file.write_bytes(file.read_bytes()+b'tamper')
    with pytest.raises(ValueError,match='digest'):
        FeatureEvidence.load(manifest,source_sha256=source_hash,score_size=(64,48))


def test_transfer_requires_operator_authorization_and_target_identity():
    source={'x':(0.,10.),'y':(0.,5.)}
    target={'x':(-2.,2.),'y':(10.,20.)}
    with pytest.raises(PermissionError):
        build_transfer_seed(source,target,family='needle',
            source_recipe_sha256='a'*64,target_recipe_sha256='b'*64,
            donor_id='0002/needle',donor_genome={'x':8.,'y':2.},
            focus=('x',),authorized=False)
    seed=build_transfer_seed(source,target,family='needle',
        source_recipe_sha256='a'*64,target_recipe_sha256='b'*64,
        donor_id='0002/needle',donor_genome={'x':8.,'y':2.},
        focus=('x',),authorized=True)
    assert seed['loci']=={'x':pytest.approx(.8)}
    assert seed['authority']=='proposal-only'
    bundle=bundle_transfers([seed],target_recipe_sha256='b'*64)
    assert verify_transfer_bundle(bundle,target_recipe_sha256='b'*64,
                                  target_bounds=target,family_focus={'needle':('x',)})==[seed]
    changed=json.loads(json.dumps(bundle))
    changed['seeds'][0]['loci']['x']=.1
    with pytest.raises(ValueError,match='digest'):
        verify_transfer_bundle(changed,target_recipe_sha256='b'*64,
                               target_bounds=target,family_focus={'needle':('x',)})
    with pytest.raises(ValueError,match='target'):
        verify_transfer_bundle(bundle,target_recipe_sha256='c'*64,
                               target_bounds=target,family_focus={'needle':('x',)})


def test_transfer_seed_reaches_family_offspring_with_attributed_parent(tmp_path):
    recipe=CapabilityRecipe.load(EXAMPLES/'hybrid/recipe_breeding.json')
    source_bounds={'shaft_width':(0.,10.)}
    seed=build_transfer_seed(source_bounds,recipe.bounds,family='needle',
        source_recipe_sha256='a'*64,target_recipe_sha256=recipe.sha256,
        donor_id='donor/needle',donor_genome={'shaft_width':8.},
        focus=('shaft_width',),authorized=True)
    archive=LineageArchive(tmp_path/'a.json',identity={'test':recipe.sha256})
    brood=make_brood(recipe.bounds,recipe.initial,archive,seed=41,
        generation=1,offspring_per_family=3,transfer_seeds=(seed,))
    adopted=[p for p in brood if p.ancestry['family']=='needle'
             and p.ancestry.get('transfer')]
    assert adopted and adopted[0].ancestry['transfer']['donor_id']=='donor/needle'
    assert adopted[0].genome['shaft_width']!=recipe.initial['shaft_width']
    assert all(p.ancestry.get('transfer') is None
               for p in brood if p.ancestry['family']!='needle')


def test_existing_grammar_grows_optional_material_into_existing_valid_assembly():
    a=SolidAssembly(overlap_ratio=.005)
    a.add_box('root',(0,0,0),(4,4,4),parents=())
    ops=[{'key':'wing','op':'box','parents':['root'],
          'center':[1.4,0,0],'size':[2,1,1],
          'when':{'param':'wing.enable','min':.5},'slot':'east-wing'}]
    off=grow_program(ops,{'wing.enable':.2},assembly=a)
    assert off is a and len(a.parts)==1
    on=grow_program(ops,{'wing.enable':.8},assembly=a)
    assert on is a and len(a.parts)==2
    assert on.audit(join=True)['valid']
    assert on.parts['wing'].slot=='east-wing'
    with pytest.raises((KeyError,ValueError)):
        grow_program([{'key':'bad','op':'box','parents':['missing'],
                       'center':[0,0,0],'size':[1,1,1]}],
                     {'wing.enable':1},assembly=on)


@pytest.mark.slow
def test_alpha_recipe_grows_two_true_optional_structural_motifs():
    project=Project.load(EXAMPLES/'project_alpha.json')
    recipe=CapabilityRecipe.load(EXAMPLES/'hybrid/recipe_alpha.json')
    assert recipe.version==3
    assert set(project.bounds)==set(recipe.cad_keys)
    assert len(recipe.bounds)==29
    assert recipe.source_hashes['image']==hashlib.sha256(project.reference.read_bytes()).hexdigest()
    assert recipe.sha256!=CapabilityRecipe.load(EXAMPLES/'hybrid/recipe_breeding.json').sha256
    comp=CapabilityCompositor(project,recipe,size=(64,96),source_mask=project.source_mask((64,96)))
    initial=comp.grow(recipe.initial)
    assert 'east gallery' not in initial.scene.assembly.parts
    genes=dict(recipe.initial,**{'grammar.gallery':.9,'grammar.buttress':.9})
    grown=comp.grow(genes)
    assert grown.audit['cad_valid']
    assert grown.audit['composite_valid_for_render']
    assert grown.audit['composite_cad_union_verified'] is False
    assert 'east gallery' in grown.scene.assembly.parts
    assert 'crown brace' in grown.scene.assembly.parts
    assert {s['id'] for s in grown.steps if s['state']=='complete'} >= {
        'join.gallery','fortress.buttress'}
