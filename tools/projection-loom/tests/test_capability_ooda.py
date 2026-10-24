"""One OODA-HA helm drives compound CAD/polymesh loops and human steering."""
from __future__ import annotations
import json
from pathlib import Path

import pytest

from projection_loom.capability_stack import Capability, CapabilityRecipe, CapabilityCompositor, default_registry
from projection_loom.pipeline import Project
from projection_loom.ooda import run_ooda_epochs, submit_control
from projection_loom.relations import PetNameLedger, RelationWitness

ROOT=Path(__file__).resolve().parents[1]


def necro():
    return (Project.load(ROOT/'examples/necrospire/project.json'),
            CapabilityRecipe.load(ROOT/'examples/necrospire/hybrid/recipe.json'))


def small(**kw):
    return dict(passes=kw.get('passes',1), candidates=3,exact_budget=2,
                detail_budget=2,seed=27,score_size=(64,96),finalists=3)


def test_compound_witness_holds_three_entities_and_mesh_is_derived_from_cad():
    project,recipe=necro()
    from PIL import Image
    comp=CapabilityCompositor(project,recipe,size=(64,96),source_mask=project.source_mask((64,96)))
    build=comp.grow(recipe.initial)
    assert build.audit['cad_valid'] and build.audit['composite_valid_for_render']
    assert build.audit['composite_cad_union_verified'] is False
    assert build.scene.layers['~crystal-surface']['covers_part']=='obsidian needle'
    witness=build.witness()
    assert {x for x in witness.nodes if x.startswith('@entity/')}=={
        '@entity/Crystal','@entity/Joining','@entity/Fortress'}
    assert '#has/faceted' in witness.nodes['@entity/Crystal'].has
    assert '#has/structural-interface' in witness.nodes['@entity/Joining'].has
    assert all(p in witness.nodes for p in build.scene.assembly.parts)
    assert len(witness.locate(witness.selector('@entity/Crystal')))==1
    assert build.manifest(comp.registry)['claims']['cross-kernel'].startswith('semantic')


def test_operator_review_pet_names_compound_entity_then_exports_gallery(tmp_path):
    project,recipe=necro()
    out=tmp_path/'helm'
    args=small()
    first=run_ooda_epochs(project,out,recipe=recipe,autonomy=0,**args)
    assert first['awaiting']['kind']=='plan'
    submit_control(out/'session.json','approve-plan')
    second=run_ooda_epochs(project,out,recipe=recipe,autonomy=0,**args)
    assert second['awaiting']['kind']=='review'
    cards=second['review_cards']
    assert cards
    target=cards[0]
    witness=RelationWitness.load(target['witness'])
    assert '@entity/Crystal' in witness.nodes
    submit_control(out/'session.json','pet-name',proposal_id=target['proposal_id'],
                   target='@entity/Crystal',name='Nightglass Witness',mode='entity')
    submit_control(out/'session.json','choose',proposal_id=target['proposal_id'])
    complete=run_ooda_epochs(project,out,recipe=recipe,autonomy=0,**args)
    assert complete['status']=='completed' and complete['completed_epochs']==1
    assert complete['gallery']['actual_count']>=1
    assert (out/'finalists/contact_sheet.png').exists()
    ledger=PetNameLedger.load(out/'identity-ledger.json')
    assert len(ledger.claims)==1 and ledger.claims[0]['name']=='Nightglass Witness'
    assert ledger.claims[0]['active']
    tree=json.loads((out/'session.json').read_text())['loops']
    assert tree['location']['phase']=='closed'
    assert tree['location/final-gallery']['parent_phase']=='aftermath'
    children=[v for v in tree.values() if v['scope']=='capability']
    assert children and all(x['parent_phase']=='act' and x['phase']=='closed' for x in children)
    assert {x['receipts']['aftermath']['state'] for x in children} <= {'complete','inactive','inactive-dependency'}
    preview=json.loads(Path(target['genome']).read_text())
    assert 'crystal.relief' in preview['genome'] and 'shaft_width' in preview['genome']
    assert preview['recipe_sha256']==recipe.sha256


def test_fullspeed_two_epochs_inherit_dual_genome_and_restart_idempotently(tmp_path):
    project,recipe=necro()
    out=tmp_path/'epochs'
    args=small(passes=2)
    result=run_ooda_epochs(project,out,recipe=recipe,autonomy=1.,**args)
    assert result['status']=='completed' and result['completed_epochs']==2
    assert result['gallery']['requested']==3
    assert result['gallery']['actual_count']>=2
    assert all('crystal.relief' in x['genome'] and 'shaft_width' in x['genome']
               for x in result['gallery']['finalists'])
    journal=json.loads((out/'session.json').read_text())
    assert len([x for x in journal['loops'].values() if x['scope']=='epoch'])==2
    assert journal['loops']['location/final-gallery']['phase']=='closed'
    assert journal['passes'][0]['parent_genome']==json.loads((out/'epoch_002.json').read_text())['proposals']['candidate-0001']['genome']
    events=len(journal['events'])
    again=run_ooda_epochs(project,out,recipe=recipe,autonomy=0,**args)
    assert again['status']=='completed' and again['events']==events
    for entry in result['gallery']['finalists']:
        model=Path(entry['folder'])
        assert (model/'cad_body.step').stat().st_size>1000
        assert (model/'composite_render.obj').stat().st_size>1000
        assert (model/'recipe.json').is_file()
        assert (model/'genome.json').is_file()
        witness=RelationWitness.load(model/'relations.json')
        assert '@entity/Crystal' in witness.nodes


def test_recipe_or_operator_changes_reject_resume_checkpoint(tmp_path):
    project,recipe=necro()
    args=small()
    run_ooda_epochs(project,tmp_path/'original',recipe=recipe,autonomy=0,**args)
    different=CapabilityRecipe(location=recipe.location,pet_name=recipe.pet_name,
          steps=recipe.steps,bounds=recipe.bounds,initial=dict(recipe.initial,**{'crystal.relief':.2}),
          cad_keys=recipe.cad_keys,source_hashes=recipe.source_hashes)
    with pytest.raises(ValueError,match='Incompatible'):
        run_ooda_epochs(project,tmp_path/'original',recipe=different,autonomy=0,**args)
    original=default_registry()
    shifted=default_registry()
    shifted.register('new-safely-versioned-op','2',lambda ctx,step:{'kind':'test'})
    with pytest.raises(ValueError,match='Incompatible'):
        run_ooda_epochs(project,tmp_path/'original',recipe=recipe,registry=shifted,
                        autonomy=0,**args)
    assert original.fingerprint()!=shifted.fingerprint()


def test_sourceless_named_location_with_standalone_polymesh(tmp_path):
    project=Project.load(ROOT/'examples/observatory.json')
    recipe=CapabilityRecipe(location=project.location,pet_name='An Observatory in the Void',
        steps=[Capability('pedestal.cad','Foundation','cad',part='pedestal',has=('#has/pedestal',)),
               Capability('object.mesh','Found Object','standalone-polymesh',layer='~poly',
                          params=(('radius','radius'),),has=('#has/sculptural',))],
        bounds={**project.bounds,'radius':(.15,1.2)},
        initial={**project.initial,'radius':.6},
        cad_keys=tuple(project.initial),source_hashes={},provenance='synthetic')
    result=run_ooda_epochs(project,tmp_path/'void',recipe=recipe,
             passes=1,candidates=3,exact_budget=2,detail_budget=2,
             score_size=(64,96),finalists=3,autonomy=1.)
    assert result['status']=='completed'
    assert result['gallery']['evidence_state']=='synthetic'
    assert any('@entity/Found Object' in RelationWitness.load(Path(x['folder'])/'relations.json').nodes
               for x in result['gallery']['finalists'])
