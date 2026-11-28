import json
from pathlib import Path
import pytest
from projection_loom.finalists import ranked_evergreen_candidates,export_finalists
from projection_loom.pipeline import Project

ROOT=Path(__file__).resolve().parents[1]

def test_finalists_select_valid_and_diverse_scored_genomes(tmp_path):
    project=Project.load(ROOT/'examples/observatory.json')
    batch={}
    props={}
    for n,delta in enumerate((0,.03,.09,.18,.26)):
        g=dict(project.initial); k=next(iter(g))
        g[k]=min(project.bounds[k][1],g[k]+delta*(project.bounds[k][1]-project.bounds[k][0]))
        cid=f'candidate-{n:04d}'
        props[cid]={'genome':g,'emitter':'local' if n%2 else 'sobol'}
        batch[cid]={'state':'scored','audit':{'valid':True,'union_valid':True,'union_solids':1},
                    'combined_loss':.29+n*.003,'niche':str(n%3)}
    batch['invalid']={'state':'scored','audit':{'valid':False,'union_valid':False,'union_solids':2},
                      'combined_loss':0,'niche':'wrong'}
    (tmp_path/'epoch_001.json').write_text(json.dumps({'proposals':props,'results':batch}))
    chosen=ranked_evergreen_candidates(project,tmp_path,count=3,min_separation=.01)
    assert len(chosen)==3
    assert chosen[0]['proposal_id']=='candidate-0000'
    assert len({x['proposal_id'] for x in chosen})==3


def test_finalists_reject_insufficient_or_empty_evidence(tmp_path):
    project=Project.load(ROOT/'examples/observatory.json')
    assert ranked_evergreen_candidates(project,tmp_path,count=3)==[]
    with pytest.raises(ValueError,match='No CAD-valid'):
        export_finalists(project,tmp_path,tmp_path/'out',count=4,with_production=False)
    with pytest.raises(ValueError,match='three to five'):
        ranked_evergreen_candidates(project,tmp_path,count=2)
