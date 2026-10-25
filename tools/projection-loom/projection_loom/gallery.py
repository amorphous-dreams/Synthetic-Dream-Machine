"""Gallery regrowth and export within the existing OODA-HA location Aftermath.

The caller, not this renderer, opens and closes the gallery child loop.
Finalists re-grow from inherited recipes, re-audit native CAD and polygon
scopes independently, and never treat their contact sheet as new evidence.
"""
from __future__ import annotations
from pathlib import Path
import json
from PIL import Image
import numpy as np

from .epochs import _atomic


def regrow_compound_gallery(compositor, output, *, passes, count):
    """Act within the location Aftermath: regrow diverse lineages from recipes.

    All scored epoch archives participate. Only a regenerated, audited compound
    can become a finalist. The STEP remains exact CAD material, while OBJ
    carries separately qualified surface layers.
    """
    from .capability_stack import digest
    from .render import silhouette
    if not 3<=count<=5:
        raise ValueError('Finalist request must be 3-5')
    out=Path(output)
    pool={}
    for epoch in range(passes):
        path=out/f'epoch_{epoch+1:03d}.json'
        data=json.loads(path.read_text(encoding='utf8'))
        for proposal_id,result in data['results'].items():
            if (result.get('state')!='scored' or
                    not result.get('audit',{}).get('valid') or
                    not result['audit'].get('union_valid') or
                    result['audit'].get('union_solids')!=1):
                continue
            genome=data['proposals'][proposal_id]['genome']
            key=digest(genome)
            row={'proposal_id':proposal_id,'genome':genome,
                 'niche':result['niche'],'epoch':epoch+1,
                 'combined_loss':result['combined_loss'],
                 'losses':result['losses'],'phenotype':result['phenotype'],
                 'emitter':data['proposals'][proposal_id]['emitter']}
            if key not in pool or row['combined_loss']<pool[key]['combined_loss']:
                pool[key]=row
    available=sorted(pool.values(),key=lambda x:(x['combined_loss'],x['proposal_id']))
    chosen=[]
    # The full scored pool, not merely one elite per niche, remains eligible.
    # Retain a champion; reserve the remaining seats for distinct niches
    # before falling back to meaningful genome distance.
    for row in available:
        if not chosen:
            chosen.append(row)
            continue
        if len(chosen)>=count:break
        if row['niche'] in {x['niche'] for x in chosen}:continue
        genome=row['genome']
        if any(sum(((genome[k]-x['genome'][k])/(hi-lo))**2
                   for k,(lo,hi) in compositor.recipe.bounds.items())**.5 < .08 for x in chosen):
            continue
        chosen.append(row)
    for row in available:
        if len(chosen)>=count:break
        if row in chosen:continue
        genome=row['genome']
        if any(sum(((genome[k]-x['genome'][k])/(hi-lo))**2
                   for k,(lo,hi) in compositor.recipe.bounds.items())**.5 < .08 for x in chosen):
            continue
        chosen.append(row)
    preview_size=compositor.size
    witness=compositor.source_mask
    if witness is None:
        seed=compositor.grow(compositor.recipe.initial)
        witness=silhouette(seed.scene.render_mesh(),compositor.camera,preview_size)>96
    pictures=[Image.fromarray(np.uint8(witness)*255,'L')]
    labels=['SOURCE (provisional)' if compositor.project.reference else 'SYNTHETIC SEED']
    receipts=[]
    for n,row in enumerate(chosen,1):
        built=compositor.grow(row['genome'])
        if not built.audit['cad_valid'] or not built.audit['composite_valid_for_render']:
            raise RuntimeError('Finalist failed CAD/mesh/socket gates')
        folder=out/'finalists'/f'candidate_{n:02d}'
        built.export(folder,{compositor.project.reference_view:compositor.camera},
                     compositor.registry,size=(256,384))
        mask=silhouette(built.scene.render_mesh(),compositor.camera,preview_size)>96
        Image.fromarray(np.uint8(mask)*255,'L').save(folder/'scored_mask.png')
        built.witness().save(folder/'relations.json')
        receipts.append({'rank':n,'epoch':row['epoch'],'niche':row['niche'],
              'loss':row['combined_loss'],'genome':row['genome'],
              'recipe_sha256':compositor.recipe.sha256,'folder':str(folder),
              'cad_valid':True,'mesh_valid_for_render':True,
              'cad_mesh_union_verified':False})
        pictures.append(Image.fromarray(np.uint8(mask)*255,'L'))
        labels.append(f'COMPOUND {n} / IoU {1-row["losses"]["silhouette"]:.3f}')
    W,H=preview_size
    sheet=Image.new('RGB',((len(pictures))*W*2,H*2+28),(17,19,24))
    from PIL import ImageDraw
    draw=ImageDraw.Draw(sheet)
    for i,(pic,label) in enumerate(zip(pictures,labels)):
        sheet.paste(pic.resize((W*2,H*2)).convert('RGB'),(i*W*2,28))
        draw.text((i*W*2+5,7),label,fill=(235,235,238))
    (out/'finalists').mkdir(exist_ok=True)
    sheet.save(out/'finalists'/'contact_sheet.png')
    receipt={'schema':'projection-loom/composed-gallery/v1',
             'location':compositor.recipe.location,'recipe_sha256':compositor.recipe.sha256,
             'operator_sha256':compositor.registry.fingerprint(),
             'available_distinct_genomes':len(pool),'requested':count,
             'actual_count':len(receipts),'finalists':receipts,
             'evidence_state':'provisional' if compositor.project.reference else 'synthetic',
             'cad_mesh_union_verified':False,
             'contact_sheet':str(out/'finalists'/'contact_sheet.png')}
    _atomic(out/'finalists'/'gallery.json',receipt)
    return receipt


