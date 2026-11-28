"""Current relational lifecycle: anonymous growth, pet-names, and o-takiage."""
import json
import numpy as np
import pytest

from projection_loom import SolidAssembly, box
from projection_loom.relations import PetNameLedger, RelationWitness, Occurrence, capabilities
from projection_loom.evolution import Evolution


def specimen(*, extra=False, renamed=False, slots=True, include_bridge=True):
    a=SolidAssembly()
    root='pillar' if renamed else 'foundation'
    a.add(root,box((0,0,0),(4,4,3)),role='foundation',has=('shelter',))
    if include_bridge:
        bridge=a.spawn(box((1.8,0,.1),(1.2,.5,.5)),parents=(root,),
                       has=('bridge','crossing'),slot='west-outcrop' if slots else None)
        a.spawn(box((2.32,0,.1),(.7,.3,.3)),parents=(bridge,),
                has=('parapet',),slot='outcrop-child' if slots else None)
    if extra:
        a.spawn(box((-1.8,0,.1),(1.2,.5,.5)),parents=(root,),
                has=('bridge','crossing'),slot='east-outcrop' if slots else None)
    a.spawn_void(box((0,-1.9,0),(.6,.8,.7)),kind='doorway',exterior=True,
                 has=('threshold','traversal'),host=root,slot='gate-cut')
    assert a.audit(join=True)['valid']
    return a


def witness(a):
    return a.relation_witness(location='harbor-of-surprises')


def test_spawn_is_nameless_but_can_parent_more_nameless_structure():
    w=witness(specimen())
    assert sum(e.anonymous for e in w.nodes.values())==3
    bridge=next(e for e in w.nodes.values() if '#has/bridge' in e.has)
    child=next(e for e in w.nodes.values() if '#has/parapet' in e.has)
    assert child.parents==(bridge.handle,)
    assert '#has/threshold' in next(e for e in w.nodes.values() if e.kind=='void').has
    assert w.descendants(bridge.handle)=={bridge.handle,child.handle}
    assert w.feature_set()


def test_pet_name_survives_regrowth_and_source_handle_rename(tmp_path):
    w=witness(specimen())
    bridge=next(e.handle for e in w.nodes.values() if '#has/bridge' in e.has)
    ledger=PetNameLedger(location=w.location)
    ledger.pet_name('The Impossible Courtesy',bridge,w,has=['bridge','crossing'],retain=.75)
    path=tmp_path/'names.json';ledger.save(path)
    restored=PetNameLedger.load(path)
    next_w=witness(specimen(extra=True,renamed=True))
    matched=restored.resolve(next_w)
    assert matched[0]['status']=='matched'
    assert matched[0]['handle'] in next_w.nodes
    assert restored.soft_loss(next_w)==0
    receipt=restored.o_takiage(name='The Impossible Courtesy')
    assert len(receipt['released'])==1
    assert restored.resolve(next_w)==[] and restored.soft_loss(next_w)==0
    assert len(restored.history)==2
    again=restored.pet_name('The Impossible Courtesy',matched[0]['handle'],next_w)
    assert again['revision']==2 and again['claim_id']!=receipt['released'][0]


def test_without_slot_repeated_twins_are_ambiguous_and_must_not_rebind():
    w=witness(specimen(slots=False))
    bridge=next(e.handle for e in w.nodes.values() if '#has/bridge' in e.has)
    ledger=PetNameLedger(location=w.location)
    ledger.pet_name('Bridge perhaps',bridge,w)
    twin=witness(specimen(extra=True,slots=False))
    verdict=ledger.resolve(twin)[0]
    assert verdict['status']=='ambiguous' and verdict['handle'] is None
    assert not verdict['members']
    other_bridge=next(e.handle for e in twin.nodes.values() if '#has/bridge' in e.has)
    with pytest.raises(ValueError,match='ambiguous'):
        ledger.pet_name('False identity',other_bridge,twin)


def test_location_is_named_set_of_nameless_has_capable_entities():
    w=witness(specimen())
    ledger=PetNameLedger(location=w.location)
    loc=ledger.pet_name('The Threaded Threshold','foundation',w,mode='location',
                        has=['bridge','threshold'],retain=.5)
    verdict=ledger.resolve(w)[0]
    assert verdict['mode']=='location' and verdict['status']=='matched'
    assert len(verdict['members'])==4
    assert not verdict['missing_has']
    assert all(e.anonymous for h,e in w.nodes.items() if h!='foundation')
    assert set(loc['has'])=={'#has/bridge','#has/threshold'}


def test_branch_o_takiage_relaxes_subtree_and_preserves_named_location():
    w=witness(specimen())
    bridge=next(e.handle for e in w.nodes.values() if '#has/bridge' in e.has)
    gate=next(e.handle for e in w.nodes.values() if '#has/threshold' in e.has)
    ledger=PetNameLedger(location=w.location)
    loc=ledger.pet_name('House of Maybes','foundation',w,mode='location',has=['bridge','threshold'])
    a=ledger.pet_name('Falling Bridge',bridge,w)
    b=ledger.pet_name('Open Gate',gate,w)
    before=w.witness_id
    ev=ledger.o_takiage(branch=bridge,witness=w)
    assert ev['released']==[a['claim_id']]
    assert ev['softened_locations'] and ev['softened_locations'][0]['released_capabilities']==['#has/bridge']
    assert ledger.resolve(w)[0]['claim_id']==loc['claim_id']
    resolved={x['name']:x for x in ledger.resolve(w)}
    assert 'Falling Bridge' not in resolved and 'Open Gate' in resolved
    assert '#has/bridge' not in ledger.claims[0]['has']
    assert bridge not in resolved['House of Maybes']['members']
    assert before==w.witness_id and len(w.nodes)==4
    assert ledger.history[-1]['action']=='o-takiage'
    # Released fork remains available for later discovery and a different name.
    ledger.pet_name('Reinvented Bridge',bridge,w)
    assert 'Reinvented Bridge' in {x['name'] for x in ledger.resolve(w)}


def test_null_and_mismatch_guards(tmp_path):
    w=witness(specimen())
    path=tmp_path/'witness.json';w.save(path)
    assert RelationWitness.load(path).witness_id==w.witness_id
    payload=json.loads(path.read_text());payload['entities'][0]['role']='forged'
    with pytest.raises(ValueError,match='checksum'):
        RelationWitness.from_dict(payload)
    with pytest.raises(ValueError):capabilities(['not valid capability'])
    ledger=PetNameLedger(location=w.location)
    with pytest.raises(ValueError,match='different locations'):
        ledger.resolve(RelationWitness(w.nodes,location='different'))
    with pytest.raises(ValueError,match='requires a witness'):
        ledger.o_takiage(branch='foundation')
    with pytest.raises(ValueError,match='No active'):
        ledger.o_takiage(name='Unknown')


def test_lost_pet_name_is_a_soft_penalty_not_a_cad_gate():
    original=witness(specimen())
    bridge=next(e.handle for e in original.nodes.values() if '#has/bridge' in e.has)
    ledger=PetNameLedger(location=original.location)
    ledger.pet_name('Maybe Bridge',bridge,original,retain=.5)
    lost=witness(specimen(include_bridge=False))
    assert ledger.resolve(lost)[0]['status']=='missing'
    assert ledger.soft_loss(lost)>0
    assert specimen(include_bridge=False).audit(join=True)['valid']
    ledger.o_takiage(name='Maybe Bridge')
    assert ledger.soft_loss(lost)==0


def test_phenotype_slack_reserves_novel_valid_candidate():
    e=Evolution.__new__(Evolution)
    e.spread=np.ones(2)
    e.slack_fraction=.34
    a=np.array([.1,0.]);b=np.array([.2,0.]);c=np.array([.3,0.]);d=np.array([.4,0.]);invalid=np.array([.6,0.])
    e.phenotypes={tuple(z):frozenset({'tower'}) for z in [a,b,c]}
    e.phenotypes[tuple(d)]=frozenset({'unexpected-bridge'})
    e.phenotypes[tuple(invalid)]=frozenset({'unbounded-super-shape'})
    chosen=e.select_with_slack([(.1,a),(.2,b),(.3,c),(.5,d),(5.0,invalid)],3,.03)
    assert len(chosen)==3
    assert any(np.array_equal(v,d) for _,v in chosen)
    assert all(not np.array_equal(v,invalid) for _,v in chosen)


def test_location_member_filter_does_not_pet_name_every_member():
    w=witness(specimen())
    ledger=PetNameLedger(location=w.location)
    ledger.pet_name('All crossings','foundation',w,mode='location',member_has=['crossing'])
    members=ledger.resolve(w)[0]['members']
    assert len(members)==1
    assert w.nodes[members[0]].anonymous
    assert not any(n.handle=='All crossings' for n in w.nodes.values())


def test_slot_match_records_relational_drift_without_silent_certainty():
    w=witness(specimen())
    bridge=next(e.handle for e in w.nodes.values() if '#has/bridge' in e.has)
    ledger=PetNameLedger(location=w.location)
    ledger.pet_name('Bridge evolving',bridge,w)
    nodes=dict(w.nodes)
    previous=nodes[bridge]
    nodes[bridge]=Occurrence(previous.handle,previous.kind,'primary',previous.parents,
                             previous.has,previous.slot,previous.anonymous)
    changed=RelationWitness(nodes,location=w.location)
    record=ledger.resolve(changed)[0]
    assert record['status']=='drifted' and record['relational_drift']
    assert ledger.soft_loss(changed)>0


def test_local_first_ledger_rejects_stale_writer(tmp_path):
    w=witness(specimen())
    p=tmp_path/'names.json'
    ledger=PetNameLedger(location=w.location)
    ledger.save(p)
    writer_a=PetNameLedger.load(p)
    writer_b=PetNameLedger.load(p)
    writer_a.pet_name('A name','foundation',w)
    writer_a.save(p)
    writer_b.pet_name('Another name','foundation',w)
    with pytest.raises(RuntimeError,match='changed since last read'):
        writer_b.save(p)
    assert PetNameLedger.load(p).claims[0]['name']=='A name'


def test_whole_anonymous_location_can_hold_a_pet_name_without_node_labels():
    a=SolidAssembly()
    root=a.spawn(box((0,0,0),(3,3,3)),role='foundation',has=['refuge'],slot='seed')
    a.spawn(box((1.3,0,0),(1,.5,.6)),parents=(root,),has=['bridge'],slot='growth-1')
    w=a.relation_witness(location='anonymous-place')
    assert all(x.anonymous for x in w.nodes.values())
    ledger=PetNameLedger(location=w.location)
    ledger.pet_name('A Constellation of Possibilities',root,w,mode='location',has=['bridge','refuge'])
    result=ledger.resolve(w)[0]
    assert result['status']=='matched' and len(result['members'])==2
    assert not any(x.handle=='A Constellation of Possibilities' for x in w.nodes.values())
