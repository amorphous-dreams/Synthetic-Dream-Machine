"""Audit a completed compound OODA-HA run without trusting its human-readable claims."""
from __future__ import annotations
import argparse,json
from pathlib import Path


def inspect(folder):
    root=Path(folder)
    session=json.loads((root/'session.json').read_text(encoding='utf8'))
    gallery=json.loads((root/'finalists/gallery.json').read_text(encoding='utf8'))
    loops=session['loops']
    if session['status']!='completed' or loops['location']['phase']!='closed':
        raise ValueError('Location and OODA-HA helm did not close')
    if loops['location/final-gallery']['parent_phase']!='aftermath':
        raise ValueError('Final gallery escaped the location Aftermath')
    candidates=[x for x in loops.values() if x['scope']=='candidate']
    capabilities=[x for x in loops.values() if x['scope']=='capability']
    if not candidates or not capabilities:
        raise ValueError('Compound run lacks real nested candidate/capability loops')
    if any(x['phase']!='closed' or x['parent_phase']!='act' for x in capabilities):
        raise ValueError('Capability did not complete in its candidate Act')
    if any(x['phase']!='closed' for x in candidates):
        raise ValueError('Candidate remains open')
    if not 2<=gallery['actual_count']<=5:
        raise ValueError('Missing diverse valid finalists')
    if gallery.get('cad_mesh_union_verified') is not False:
        raise ValueError('A composite cannot claim unproved BRep-mesh fusion')
    for row in gallery['finalists']:
        folder=Path(row['folder'])
        for leaf in ('cad_body.step','composite_render.obj','recipe.json',
                     'genome.json','compound_manifest.json','relations.json','scored_mask.png'):
            if not (folder/leaf).is_file() or (folder/leaf).stat().st_size==0:
                raise ValueError(f'Finalist artifact absent: {folder/leaf}')
        model=json.loads((folder/'genome.json').read_text(encoding='utf8'))
        assert model['recipe_sha256']==gallery['recipe_sha256']
        assert 'shaft_width' in model['genome'] and 'crystal.relief' in model['genome']
        witness=json.loads((folder/'relations.json').read_text(encoding='utf8'))
        handles={x['handle'] for x in witness['entities']}
        if not {'@location','@entity/Crystal','@entity/Joining','@entity/Fortress'}<=handles:
            raise ValueError('An entity disappeared from the relation witness')
    return {'status':session['status'],'location':gallery['location'],
            'epochs':session['current_epoch'],'candidates_evaluated':len(candidates),
            'capability_loops':len(capabilities),'finalists':gallery['actual_count'],
            'evidence_state':gallery['evidence_state'],'events':len(session['events'])}


if __name__=='__main__':
    p=argparse.ArgumentParser()
    p.add_argument('--out',required=True,type=Path)
    args=p.parse_args()
    print(json.dumps(inspect(args.out),indent=2))
