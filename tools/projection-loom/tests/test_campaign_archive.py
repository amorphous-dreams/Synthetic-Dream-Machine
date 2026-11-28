"""RED-first: persistent breeding lineages survive culling, duplicates and restart."""
import copy
import hashlib
import json
from pathlib import Path
import pytest
from projection_loom.campaign import LineageArchive, visual_descriptor

IDENTITY = {'source': 'a'*64, 'recipe':'b'*64, 'construction':'c'*64,
            'families':['needle','crown']}


def trial():
    def p(f, g):
        return {'emitter':f'family:{f}:local', 'genome':{'x':g}, 'parent':'seed'}
    def r(loss, mask, niche):
        return {'state':'scored','combined_loss':loss, 'losses':{'silhouette':loss},
                'phenotype':['visual:'+hashlib.sha256(mask.encode()).hexdigest(),'visual-niche:'+niche],
                'witness_id':mask[:12], 'evidence_state':'provisional',
                'audit':{'valid':True, 'union_solids':1, 'union_valid':True}}
    return {'run_id':'run-1', 'proposals':{
        'needle':p('needle', .1), 'crown':p('crown', .9),
        'duplicate':p('needle', .5), 'rejected':p('crown', .4)},
        'results':{'needle':r(.4,'m1','n1'), 'crown':r(.3,'m2','n2'),
                   'duplicate':r(.2,'m1','n1'),
                   'rejected':{'state':'rejected','reason':'CAD gate'}}}


def test_archives_distinct_phenotypes_and_non_global_winners(tmp_path):
    path = tmp_path/'archive.json'
    archive = LineageArchive(path, identity=IDENTITY)
    report = archive.assimilate(1, trial())
    assert report['scored'] == 3
    assert report['rejected'] == 1
    assert archive.best('crown')['combined_loss'] == .3
    assert archive.best('needle')['combined_loss'] == .2
    assert len(archive.elites()) == 2  # one mask, one phenotype, even if genome differs
    assert archive.elites()[0]['combined_loss'] == .2
    assert set(x['family'] for x in archive.elites()) == {'crown','needle'}
    assert len(archive.parents('needle')) >= 1
    assert archive.assimilate(1, trial()) == report
    reloaded = LineageArchive(path, identity=IDENTITY)
    assert reloaded.elites() == archive.elites()
    assert reloaded.generation_count == 1


def test_durable_replay_and_integrity_refuse_mutated_epoch(tmp_path):
    path = tmp_path/'archive.json'
    archive = LineageArchive(path, identity=IDENTITY)
    archive.assimilate(1, trial())
    edited = trial(); edited['results']['needle']['combined_loss'] = .01
    with pytest.raises(ValueError, match='changed|collision'):
        archive.assimilate(1, edited)
    with pytest.raises(ValueError, match='identity'):
        LineageArchive(path, identity={**IDENTITY,'source':'z'*64})
    contents = json.loads(path.read_text()); contents['elites']['n1']['combined_loss'] = 999
    path.write_text(json.dumps(contents))
    with pytest.raises(ValueError, match='digest'):
        LineageArchive(path, identity=IDENTITY)


def test_families_survive_an_unscored_generation(tmp_path):
    archive = LineageArchive(tmp_path/'a.json', identity=IDENTITY)
    archive.assimilate(1,trial())
    data={'run_id':'run-2','proposals':{'x':{'emitter':'family:crown:sobol',
          'genome':{'x':.3}, 'parent':'crown'}},
          'results':{'x':{'state':'deferred','reason':'budget'}}}
    report = archive.assimilate(2,data)
    assert report['scored']==0 and report['deferred']==1
    assert archive.best('crown')['combined_loss']==.3
    assert archive.generation_count == 2


def test_visual_features_reject_same_pixels_but_distinct_genomes():
    import numpy as np
    mask = np.zeros((24,36),dtype=bool); mask[3:20,11:27]=True
    a = visual_descriptor(mask)
    assert len(a['mask_sha256']) == 64
    assert a['niche'].startswith('area:')
    assert visual_descriptor(mask.copy()) == a
    other=mask.copy();other[2,12]=True
    assert visual_descriptor(other)['mask_sha256'] != a['mask_sha256']
    assert visual_descriptor(np.zeros_like(mask))['niche']=='empty'
