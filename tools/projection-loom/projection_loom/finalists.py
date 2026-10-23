"""Across-epoch, auditable selection of multiple surviving constructions.

An epoch's chosen parent is NOT the only possible end of a long search. Gather
all scored CAD-valid genomes, retain distance-separated alternatives, then
RE-GROW and re-audit each before rendering. A presentation image never acts as
new evidence, and historic source score remains provisional if unregistered.
"""
from __future__ import annotations
from pathlib import Path
import json
import numpy as np
from PIL import Image,ImageDraw
from .epochs import _atomic
from .render import silhouette
from .evolution import Evolution


def _distance(project,a,b):
    return float(np.linalg.norm([(a[k]-b[k])/(project.bounds[k][1]-project.bounds[k][0])
                 for k in project.bounds])/len(project.bounds)**.5)


def ranked_evergreen_candidates(project,epoch_directory,*,count=4,min_separation=.065):
    if not 3<=count<=5:raise ValueError('Final gallery uses three to five candidates')
    root=Path(epoch_directory)
    rows=[]
    for file in sorted(root.glob('epoch_*.json')):
        data=json.loads(file.read_text())
        for pid,r in data.get('results',{}).items():
            if r.get('state')!='scored' or not r.get('audit',{}).get('valid'):
                continue
            if not r['audit'].get('union_valid') or r['audit'].get('union_solids')!=1:
                continue
            genome=data['proposals'][pid]['genome']
            rows.append({'epoch':int(file.stem.split('_')[1]),'proposal_id':pid,
                         'emitter':data['proposals'][pid]['emitter'],
                         'loss':float(r['combined_loss']),'niche':r['niche'],
                         'genome':dict(genome),'source_receipt':file.name})
    rows.sort(key=lambda r:(r['loss'],r['epoch'],r['proposal_id']))
    selected=[]
    available=list(rows)
    if available:selected.append(available.pop(0))
    # After the best score, prefer meaningful genotype distance and a different
    # phenotypic niche, but never accept invalid or unscored candidates.
    while available and len(selected)<count:
        eligible=[r for r in available if min(_distance(project,r['genome'],s['genome'])
                                               for s in selected)>=min_separation]
        if not eligible:break
        def objective(r):
            distance=min(_distance(project,r['genome'],s['genome']) for s in selected)
            new_niche=r['niche'] not in {s['niche'] for s in selected}
            new_emitter=r['emitter'] not in {s['emitter'] for s in selected}
            return (.025*new_niche+.010*new_emitter+ .17*distance
                    - (r['loss']-selected[0]['loss']))
        winner=max(eligible,key=lambda r:(objective(r),-r['loss'],r['epoch'],r['proposal_id']))
        selected.append(winner)
        available.remove(winner)
    return selected


def export_finalists(project,epochs,out,*,count=4,size=(384,576),
                     min_separation=.065,with_production=True):
    out=Path(out);out.mkdir(parents=True,exist_ok=True)
    candidates=ranked_evergreen_candidates(project,epochs,count=count,
                                           min_separation=min_separation)
    if not candidates:
        raise ValueError('No CAD-valid scored candidates available for final export')
    evo=Evolution(project,size=size,seed=41)
    panels=[]
    manifest={'schema':'projection-loom/final-candidates/v1','location':project.location,
              'reference':'provisional-unregistered' if project.reference else 'synthetic',
              'target_count':count,'actual_count':len(candidates),
              'method':'lowest-loss champion, then phenotype and parameter diversity',
              'candidates':[]}
    from PIL import ImageFont
    for i,r in enumerate(candidates,1):
        assembly=project.grow(r['genome'])
        audit=assembly.audit(join=True)
        if not audit.get('valid') or audit.get('union_solids')!=1 or not audit.get('union_valid'):
            raise ValueError('Final candidate failed mandatory regrowth CAD audit')
        folder=out/f'candidate_{i:02d}'
        folder.mkdir(parents=True,exist_ok=True)
        if with_production:
            project.export(assembly,folder,r['genome'],size=size)
        mesh=assembly.tessellate(linear=.3,angular=.25,union=True)
        mask=silhouette(mesh,evo.reference_camera,size)>96
        canvas=np.full((size[1],size[0],4),[20,26,40,255],dtype=np.uint8)
        canvas[mask]=[208,217,239,255]
        panel=Image.fromarray(canvas,'RGBA');draw=ImageDraw.Draw(panel)
        draw.rectangle((0,0,size[0]-1,48),fill=(14,21,34,255))
        draw.text((10,8),f'Candidate {i} / epoch {r["epoch"]}',fill=(234,239,250))
        draw.text((10,28),f'Loss {r["loss"]:.4f} [{r["emitter"]}]',fill=(148,203,240))
        panel.save(folder/'oblique_preview.png')
        panels.append(panel)
        item={k:r[k] for k in ('epoch','proposal_id','emitter','loss','niche','source_receipt')}
        item.update(index=i,genome=r['genome'],audit_valid=True,
                    relative_min_dist=min([_distance(project,r['genome'],p['genome'])
                                           for p in candidates[:i-1]] or [0]))
        manifest['candidates'].append(item)
    if project.reference:
        from PIL import Image as PILImage
        src=PILImage.open(project.reference).convert('L').resize(size)
        rgba=PILImage.new('RGBA',size,(20,26,40,255))
        rgba.paste((207,215,227,255),mask=src)
        dr=ImageDraw.Draw(rgba);dr.rectangle((0,0,size[0]-1,48),fill=(14,21,34,255))
        dr.text((10,12),'Original alpha witness',fill=(240,240,250))
        panels.insert(0,rgba)
    board=Image.new('RGBA',(size[0]*len(panels),size[1]),(20,26,40,255))
    for i,im in enumerate(panels):board.paste(im,(i*size[0],0))
    board.convert('RGB').save(out/'contact_sheet.png',quality=94)
    _atomic(out/'manifest.json',manifest)
    return manifest
