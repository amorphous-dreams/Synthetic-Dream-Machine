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
from .evidence_receipts import CompoundAuditReceipt


def regrow_compound_gallery(compositor, output, *, passes, count, unique_visual=False):
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
            visible=next((f.split(':',1)[1] for f in result.get('phenotype',[])
                          if f.startswith('visual:')),None)
            row={'proposal_id':proposal_id,'genome':genome,'visual_mask':visible,
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
        if unique_visual and row['visual_mask'] and row['visual_mask'] in {x['visual_mask'] for x in chosen}:continue
        if row['niche'] in {x['niche'] for x in chosen}:continue
        genome=row['genome']
        if any(sum(((genome[k]-x['genome'][k])/(hi-lo))**2
                   for k,(lo,hi) in compositor.recipe.bounds.items())**.5 < .08 for x in chosen):
            continue
        chosen.append(row)
    for row in available:
        if len(chosen)>=count:break
        if row in chosen:continue
        if unique_visual and row['visual_mask'] and row['visual_mask'] in {x['visual_mask'] for x in chosen}:continue
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
        if not CompoundAuditReceipt.from_native(built.audit).render_admissible:
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





def regrow_lineage_gallery(compositor, archive, output, *, limit_per_family=2):
    """Operator pinboard: visually distinct, independently re-audited family survivors.

    No separate OODA controller, new source record, or structural certificate.
    All CAD and polygon scopes are checked again from the inherited genome.
    """
    from .campaign import FAMILY_FOCUSES, visual_descriptor
    from .render import silhouette
    if type(limit_per_family) is not int or not 1 <= limit_per_family <= 3:
        raise ValueError('Family review budget must be 1..3')
    root = Path(output) / 'lineage_gallery'
    root.mkdir(parents=True, exist_ok=True)
    W, H = compositor.size
    source = compositor.source_mask
    gallery=[]
    cells=[]
    seen=set()
    if source is not None:
        cells.append((Image.fromarray(np.uint8(source)*255,'L'), 'SOURCE: provisional'))
    for family in FAMILY_FOCUSES:
        parents=archive.parents(family, limit=limit_per_family)
        for original in parents:
            if original['mask_sha256'] in seen:
                continue
            build=compositor.grow(original['genome'])
            if not CompoundAuditReceipt.from_native(build.audit).render_admissible:
                raise ValueError('Archived lineage failed independent CAD/mesh/socket re-audit')
            mask=silhouette(build.scene.render_mesh(),compositor.camera,compositor.size)>96
            descriptor=visual_descriptor(mask)
            if descriptor['mask_sha256']!=original['mask_sha256']:
                raise ValueError('Archived visual phenotype changed during regrowth')
            rank=len(gallery)+1
            folder=root/f'candidate_{rank:02d}'
            folder.mkdir(parents=True,exist_ok=True)
            Image.fromarray(np.uint8(mask)*255,'L').save(folder/'silhouette.png')
            build.witness().save(folder/'relations.json')
            entry={'rank':rank, 'family':family,'lineage_id':original['id'],
                   'emitter':original['emitter'],'parent':original['parent'],
                   'genome':original['genome'], 'loss':original['combined_loss'],
                   'visual_niche':original['niche'],
                   'mask_sha256':descriptor['mask_sha256'],
                   'recipe_sha256':compositor.recipe.sha256,
                   'evidence_state':original['evidence_state'],
                   'cad_valid':True,'mesh_valid_for_render':True,
                   'cad_mesh_union_verified':False,
                   'mask':str(folder/'silhouette.png'),
                   'witness':str(folder/'relations.json')}
            _atomic(folder/'receipt.json',entry)
            gallery.append(entry)
            cells.append((Image.fromarray(np.uint8(mask)*255,'L'),
                          f'{family.upper()} #{rank} / IoU {1-original["losses"]["silhouette"]:.3f}'))
            seen.add(original['mask_sha256'])
    columns=min(6,max(1,len(cells)))
    rows=(len(cells)+columns-1)//columns
    sheet=Image.new('RGB',(columns*W*2,rows*(H*2+29)),(17,19,24))
    from PIL import ImageDraw
    draw=ImageDraw.Draw(sheet)
    for i,(mask,label) in enumerate(cells):
        x=(i%columns)*W*2; y=(i//columns)*(H*2+29)
        sheet.paste(mask.resize((W*2,H*2)).convert('RGB'),(x,y+29))
        draw.text((x+4,y+7),label,fill=(235,235,238))
    sheet.save(root/'contact_sheet.png')
    record={'schema':'projection-loom/lineage-review-gallery/v1',
            'recipe_sha256':compositor.recipe.sha256,
            'source_digests':compositor.recipe.source_hashes,
            'family_count':len(FAMILY_FOCUSES), 'requested_per_family':limit_per_family,
            'actual_count':len(gallery),'distinct_visual_masks':len(seen),
            'candidates':gallery,'cad_mesh_union_verified':False,
            'evidence_state':'provisional' if compositor.project.reference else 'synthetic',
            'contact_sheet':str(root/'contact_sheet.png')}
    _atomic(root/'gallery.json',record)
    return record
