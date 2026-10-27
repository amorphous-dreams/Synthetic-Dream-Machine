"""Re-audit scored native finalists against original 1024x1536 alpha.

This does not rank unverified drawings or promote operator pet-names.
Search runs at bounded resolution; finalist silhouette claims use full pixels.
"""
from __future__ import annotations
import argparse
from pathlib import Path
import json
import hashlib
import numpy as np
from PIL import Image
from projection_loom.pipeline import Project
from projection_loom.capability_stack import CapabilityRecipe, CapabilityCompositor
from projection_loom.render import silhouette
from projection_loom.evidence_receipts import CompoundAuditReceipt

SIZE=(1024,1536)

def evaluate(project_path,recipe_path,session_dir,output_dir):
    project=Project.load(project_path)
    recipe=CapabilityRecipe.load(recipe_path)
    if project.reference is None or project.reference_view != 'oblique':
        raise ValueError('Full-resolution reference requires an original oblique')
    if project.seed_entity is None:
        raise ValueError('An original content-addressed Oblique Seed is required')
    reference=project.source_mask(SIZE)
    if reference is None or reference.shape!=(1536,1024):
        raise ValueError('Original source mask did not preserve full resolution')
    compositor=CapabilityCompositor(project,recipe,size=(128,192),
                                   source_mask=project.source_mask((128,192)))
    results=[]
    root=Path(session_dir)
    for path in sorted(root.glob('epoch_*.json')):
        epoch=json.loads(path.read_text(encoding='utf8'))
        for proposal_id,result in sorted(epoch['results'].items()):
            if result.get('state')!='scored':
                continue
            genome=epoch['proposals'][proposal_id]['genome']
            build=compositor.grow(genome)
            if not CompoundAuditReceipt.from_native(build.audit).render_admissible:
                raise ValueError('Native-scored lineage failed full-resolution regrowth')
            candidate=silhouette(build.scene.render_mesh(),compositor.camera,SIZE)>96
            common=int(np.logical_and(reference,candidate).sum())
            union=int(np.logical_or(reference,candidate).sum())
            iou=common/union if union else 1.
            results.append(dict(
                epoch=path.stem,proposal_id=proposal_id,iou=iou,
                intersection_pixels=common,union_pixels=union,
                source_pixels=int(reference.sum()),candidate_pixels=int(candidate.sum()),
                native_valid=True,
                evidence='same original L8 source alpha and frozen oblique; one source',
                recipe_sha256=recipe.sha256,
                seed_sha256=project.seed_entity.sha256,
                genome=genome))
    if not results:
        raise ValueError('No scored CAD-valid candidates received full-resolution audit')
    results.sort(key=lambda x:(-x['iou'],x['epoch'],x['proposal_id']))
    dest=Path(output_dir);dest.mkdir(parents=True,exist_ok=True)
    top=results[:min(5,len(results))]
    cols=[]
    cols.append(Image.fromarray(np.uint8(reference)*255,'L').resize((256,384)))
    for item in top:
        mesh=compositor.grow(item['genome']).scene.render_mesh()
        cols.append(Image.fromarray(silhouette(mesh,compositor.camera,SIZE),'L').resize((256,384)))
    sheet=Image.new('RGB',(256*len(cols),416),(14,18,24))
    from PIL import ImageDraw
    pen=ImageDraw.Draw(sheet)
    for i,im in enumerate(cols):
        sheet.paste(im.convert('RGB'),(i*256,32))
        label='ORIGINAL SOURCE' if i==0 else f'{top[i-1]["epoch"]} / IoU {top[i-1]["iou"]:.4f}'
        pen.text((i*256+4,8),label,fill=(235,235,235))
    sheet.save(dest/'full_resolution_oblique_finals.png')
    payload={'schema':'projection-loom/full-resolution-source-audit',
             'source_size':[1024,1536],'source_observation_count':1,
             'comparison_camera':'original fixed oblique','candidate_count':len(results),
             'best':top[0],'candidates':results,
             'artistic_winner_or_operator_promotion':False}
    (dest/'full_resolution_audit.json').write_text(json.dumps(payload,indent=2,allow_nan=False)+'\n')
    return payload

if __name__=='__main__':
    p=argparse.ArgumentParser()
    p.add_argument('--project',required=True)
    p.add_argument('--recipe',required=True)
    p.add_argument('--session',required=True)
    p.add_argument('--out',required=True)
    a=p.parse_args()
    result=evaluate(a.project,a.recipe,a.session,a.out)
    print(json.dumps({k:result[k] for k in ('source_size','candidate_count','best')},indent=2))
