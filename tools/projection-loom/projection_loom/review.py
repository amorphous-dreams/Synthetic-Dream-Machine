"""Operator review artifacts for independently audited CAD and compound forms.

These renderers consume scored, scheduled selections but never decide lineage,
phase progression, operator consent, or native-kernel certification. Source
images stay sources; generated previews remain review aids.
"""
from __future__ import annotations
from PIL import Image
import numpy as np

from .epochs import _atomic
from .selection import select_review_candidates
from .evidence_receipts import CadAuditReceipt, CompoundAuditReceipt


def render_cad_review(project, run, epoch_index, folder, *, limit=4):
    """Regrow *audited* elites for operator viewing; never use previews as evidence."""
    from .evolution import Evolution
    from .render import silhouette
    folder.mkdir(parents=True, exist_ok=True)
    # A selection preview may include a scored alternative that lost its
    # quality-diversity niche. The operator, not the niche winner, may recognize
    # an architectural surprise worth carrying onward. Invalid/unscored forms
    # cannot enter this list.
    elites = select_review_candidates(run.data, limit=limit)
    archive_ids={x['proposal_id'] for x in run.data['archive'].values()}
    evo = Evolution(project, size=(192, 288), seed=41)
    options = []
    for elite in elites:
        candidate = project.grow(elite['genome'])
        audit = candidate.audit(join=True)
        if not CadAuditReceipt.from_native(audit).admitted:
            raise RuntimeError('Audited elite failed to regrow for the preview')
        mesh = candidate.tessellate(linear=.35, angular=.3, union=True)
        mask = silhouette(mesh, evo.reference_camera, evo.size) > 96
        rgba = np.zeros((evo.size[1], evo.size[0], 4), dtype=np.uint8)
        rgba[mask] = [196, 212, 232, 255]
        stem = elite['proposal_id']
        Image.fromarray(rgba, 'RGBA').save(folder/(stem + '.png'))
        witness = candidate.relation_witness(location=project.location)
        witness.save(folder/(stem + '.relations.json'))
        _atomic(folder/(stem + '.genome.json'), {'genome': elite['genome']})
        options.append({'proposal_id': stem, 'loss': elite['combined_loss'],
                        'emitter': elite['emitter'],
                        'archive_elite': stem in archive_ids,
                        'niche': elite['niche'],
                        'preview': str(folder/(stem + '.png')),
                        'witness': str(folder/(stem + '.relations.json')),
                        'genome': str(folder/(stem + '.genome.json')),
                        'evidence_state': run.score_state})
    _atomic(folder/'review.json', {'epoch': epoch_index + 1, 'options': options,
        'authority': 'Preview is a visualization of an audited CAD candidate, not source evidence'})
    return options


def render_compound_review(compositor, run, epoch_index, folder, *, limit=4):
    """Real reviewed choices from exact-audited compound genomes.

    Pet-name controls consume entity-capability witnesses from the SAME
    construction that produced the screenshot. A preview never proves the art
    camera was calibrated; only the CAD, mesh and sockets earned their gates.
    """
    from .render import silhouette
    folder.mkdir(parents=True,exist_ok=True)
    selected=select_review_candidates(run.data,limit=limit)
    archive_ids={x['proposal_id'] for x in run.data['archive'].values()}
    options=[]
    for item in selected:
        build=compositor.grow(item['genome'])
        if not CompoundAuditReceipt.from_native(build.audit).render_admissible:
            raise RuntimeError('Scored compound failed to regrow for review')
        mask=silhouette(build.scene.render_mesh(),compositor.camera,compositor.size)>96
        rgba=np.zeros((compositor.size[1],compositor.size[0],4),dtype=np.uint8)
        rgba[mask]=[196,212,232,255]
        stem=item['proposal_id']
        Image.fromarray(rgba,'RGBA').save(folder/(stem+'.png'))
        build.witness().save(folder/(stem+'.relations.json'))
        _atomic(folder/(stem+'.genome.json'),{
            'genome':item['genome'],'recipe_sha256':compositor.recipe.sha256})
        options.append({'proposal_id':stem,'loss':item['combined_loss'],
            'emitter':item['emitter'],'archive_elite':stem in archive_ids,
            'niche':item['niche'],'preview':str(folder/(stem+'.png')),
            'witness':str(folder/(stem+'.relations.json')),
            'genome':str(folder/(stem+'.genome.json')),
            'recipe_sha256':compositor.recipe.sha256,
            'evidence_state':run.score_state})
    _atomic(folder/'review.json',{'epoch':epoch_index+1,'options':options,
             'authority':'CAD+polymesh audited; source image registration remains provisional'})
    return options


