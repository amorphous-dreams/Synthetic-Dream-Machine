"""Small controlled evolutionary study: CAD genotype + polymesh phenotype.

Both engines regrow every trial. Fixed oblique image evidence remains provisional.
The mesh does not enter a BRep union or acquire fabricated structural authority.
"""
from __future__ import annotations
import argparse
from hashlib import sha256
import json
from pathlib import Path
import sys
import numpy as np
from PIL import Image,ImageDraw
from projection_loom.render import silhouette
from projection_loom.evolution import iou
from projection_loom.pipeline import Project

from hybrid_demo import BASE,grow_hybrid


def run(out, *, epochs=2, per_epoch=6, seed=31, size=(192,288)):
    if epochs<1 or per_epoch<2:
        raise ValueError('Need positive epoch count and at least two trial specimens')
    project=Project.load(BASE/'project.json')
    source=project.source_mask(size)
    if source is None:
        raise ValueError('Hybrid experiment needs the original alpha witness')
    rng=np.random.default_rng(seed)
    p=dict(project.initial)
    lo=np.array([project.bounds[k][0] for k in p]);hi=np.array([project.bounds[k][1] for k in p])
    keys=list(p)
    candidates=[]
    for epoch in range(epochs):
        observed=[]
        for i in range(per_epoch):
            if epoch==0 and i==0:
                genome=dict(project.initial);perturb=.13
            else:
                factors=rng.normal(0,.22 if epoch==0 else .11,size=len(keys))
                vector=np.clip(np.array([p[k] for k in keys])+factors*(hi-lo),lo,hi)
                genome={k:float(v) for k,v in zip(keys,vector)}
                perturb=float(np.clip(.13+rng.normal(0,.06),.01,.26))
            _,scene=grow_hybrid(genome,perturb=perturb)
            audit=scene.audit()
            if not audit['composite_valid_for_render']:
                observed.append({'valid':False,'genome':genome,'perturb':perturb})
                continue
            hybrid_mesh=scene.render_mesh()
            hybrid_mask=silhouette(hybrid_mesh,project.cameras['oblique'],size)>96
            cad_mask=silhouette(scene.assembly.tessellate(union=True),
                                project.cameras['oblique'],size)>96
            result={'valid':True,'epoch':epoch+1,'index':i+1,'genome':genome,
                    'mesh_perturb':perturb,'hybrid_iou':float(iou(source,hybrid_mask)),
                    'cad_only_iou':float(iou(source,cad_mask)),
                    'cad_union_valid':audit['cad_valid'],
                    'mesh_render_valid':audit['composite_valid_for_render'],
                    'cad_mesh_union_verified':False,
                    'mask':np.uint8(hybrid_mask)*255}
            observed.append(result);candidates.append(result)
        valid=sorted((row for row in observed if row['valid']),
                     key=lambda x:-x['hybrid_iou'])
        if valid:p=dict(valid[0]['genome'])
    valid=sorted(candidates,key=lambda x:-x['hybrid_iou'])
    survivors=[]
    def distance(a,b):
        delta=np.array([(a['genome'][k]-b['genome'][k])/(project.bounds[k][1]-project.bounds[k][0])
                        for k in keys])
        return float(np.linalg.norm(delta)+abs(a['mesh_perturb']-b['mesh_perturb']))
    for row in valid:
        if all(distance(row,former)>.08 for former in survivors):
            survivors.append(row)
        if len(survivors)==3:break
    output=Path(out);output.mkdir(parents=True,exist_ok=True)
    report={'schema':'projection-loom/hybrid-mesh-trial/v1',
            'evidence_status':'provisional-unregistered-artwork',
            'source_sha256':sha256(project.reference.read_bytes()).hexdigest(),
            'epochs':epochs,'per_epoch':per_epoch,'evaluated':len(candidates),
            'finalists':[{k:v for k,v in item.items() if k!='mask'} for item in survivors],
            'best_hybrid_iou':valid[0]['hybrid_iou'],
            'best_cad_only_iou':max(x['cad_only_iou'] for x in valid),
            'claims':'Rendered polymesh/CAD scene; BRep solid integrity remains CAD-only'}
    (output/'trial.json').write_text(json.dumps(report,indent=2)+'\n')
    for ix,item in enumerate(survivors,1):
        Image.fromarray(item['mask'],'L').save(output/f'candidate_{ix:02d}.png')
    # Comparison control: original alpha and three varied successful renderings.
    scale=2
    sheet=Image.new('RGB',(size[0]*scale*4,size[1]*scale+28),(18,18,24))
    images=[Image.fromarray(np.uint8(source)*255,'L')]+[Image.fromarray(x['mask'],'L') for x in survivors]
    labels=['SOURCE ALPHA']+[f'HYBRID {j+1}  IoU {x["hybrid_iou"]:.3f}' for j,x in enumerate(survivors)]
    painter=ImageDraw.Draw(sheet)
    for ix,(img,label) in enumerate(zip(images,labels)):
        sheet.paste(img.resize((size[0]*scale,size[1]*scale)).convert('RGB'),(ix*size[0]*scale,28))
        painter.text((ix*size[0]*scale+8,7),label,fill=(221,221,228))
    sheet.save(output/'hybrid_contact_sheet.png')
    return report


def main(argv=None):
    p=argparse.ArgumentParser()
    p.add_argument('--out',type=Path,required=True)
    p.add_argument('--epochs',type=int,default=2)
    p.add_argument('--per-epoch',type=int,default=6)
    args=p.parse_args(argv)
    summary=run(args.out,epochs=args.epochs,per_epoch=args.per_epoch)
    print(json.dumps({k:summary[k] for k in ('epochs','evaluated','best_hybrid_iou','best_cad_only_iou')}))


if __name__=='__main__': main()
