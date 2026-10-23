"""Pair A PoC control: published Ur dimensions + two *local synthetic* SCAD meshes.

This harness exercises the real multi-source evidence path, NOT archaeological
reconstruction accuracy and NOT the CC0 archive or Sketchfab model. Third-party
sources remain separately linked until verified raw bytes are supplied.
"""
from __future__ import annotations
from pathlib import Path
import hashlib, json, shutil, subprocess
import numpy as np
import trimesh
from PIL import Image, ImageDraw, ImageFont

from projection_loom.pipeline import Project
from projection_loom.epochs import WideEpoch, Proposal, propose_methods, project_code_digest
from projection_loom.calibration import freeze_display_camera
from projection_loom.geometry import Mesh
from projection_loom.render import silhouette
from projection_loom.evolution import iou
from projection_loom.location_stack import LocationStack, Source, Frame
from projection_loom.surface_witness import sample_mesh, sampled_surface_distance

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'../out/pair_a'
SIZE=(224,176)


def mesh_from_stl(path):
    tri=trimesh.load(path,process=False)
    if not isinstance(tri,trimesh.Trimesh) or not len(tri.faces):
        raise ValueError('Expected an actual STL triangle mesh')
    return Mesh(tri.vertices,tri.faces,np.zeros(len(tri.faces)),np.zeros((0,3),int))


def hashfile(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def compile_trusted_fixture(subject):
    """Compile only source-controlled fixtures, not untrusted downloaded scripts.

    This compiler invocation is NOT an isolation sandbox. Do not point it at
    arbitrary outside .scad files; import/use can read files under privileges.
    """
    executable=shutil.which('openscad')
    if not executable:
        raise RuntimeError('OpenSCAD CLI needed for local synthetic control; no external asset is fabricated')
    source=ROOT/f'examples/{subject}/neutral_scad_probe.scad'
    dest=OUT.parent/f'{subject}_neutral_probe.stl'
    dest.parent.mkdir(parents=True, exist_ok=True)
    # Only the two explicitly known, locally authored fixtures are accepted.
    if subject not in ('ur', 'brutalist') or not source.is_file() or source.stat().st_size>16_384:
        raise ValueError('Only bundled small synthetic fixtures may be compiled')
    subprocess.run([executable,'-o',str(dest),str(source)],check=True,
                   timeout=90,stdout=subprocess.DEVNULL,stderr=subprocess.PIPE)
    if not dest.is_file() or not 0 < dest.stat().st_size < 2_000_000:
        raise ValueError('OpenSCAD did not produce a bounded STL reference')
    return dest


def assess(subject, *, passes=2, count=7, exact=5, detail=4, seed=81):
    project=Project.load(ROOT/f'examples/{subject}/project.json')
    reference_file=compile_trusted_fixture(subject)
    reference_mesh=mesh_from_stl(reference_file)
    source_sca=ROOT/f'examples/{subject}/neutral_scad_probe.scad'
    provenance=ROOT/f'examples/{subject}/provenance.json'
    stack=LocationStack(project.location)
    stack.add_frame(Frame('model-space','local3d','m' if subject=='ur' else 'model_unit'))
    stack.add_source(Source.from_file('local-scad-compilation','cad_model',reference_file,'model-space',observed_as='proposed'))
    source_obs=sample_mesh(stack,'local-scad-compilation',count=500,seed=12)
    # Explicitly freeze once from the reference mesh; do not fit each candidate.
    cameras={n:freeze_display_camera(project.cameras[n],reference_mesh.vertices,SIZE)
             for n in ('front','oblique','top')}
    reference_masks={n:silhouette(reference_mesh,cam,SIZE)>96 for n,cam in cameras.items()}
    result_dir=OUT/subject;result_dir.mkdir(parents=True,exist_ok=True)
    for n,m in reference_masks.items():Image.fromarray((m.astype('uint8')*255)).save(result_dir/f'local_probe_{n}.png')
    hashes={'scad':hashfile(source_sca),'compiled_stl':hashfile(reference_file),'provenance_manifest':hashfile(provenance)}
    score_kind='published_dimensions' if subject=='ur' else 'local_probe_bounds'
    selected=dict(project.initial)
    records=[]
    witness_stats=None
    last_arch=[]
    for epoch in range(1,passes+1):
        proposals=[Proposal('seed-anchor','known-answer',dict(selected))]
        methods=propose_methods(project.bounds,selected,seed=seed+epoch,count=count-1,
                      topology_loci=('summit_shrine',) if subject=='ur' else ())
        proposals.extend([Proposal(f'{p.id}-e{epoch:02d}',p.emitter,p.genome,p.parent) for p in methods])
        def measure(genome,assembly):
            nonlocal witness_stats
            mesh=assembly.tessellate(linear=.4,angular=.33,union=True)
            # All comparisons hold the same cameras and pixel frames.
            losses=[(1-iou(reference_masks[n],silhouette(mesh,cameras[n],SIZE)>96))
                    for n in cameras]
            if subject=='ur':
                dimension=float(np.mean([(genome[k]-t)**2/r**2 for k,t,r in
                  [('base_length',62.5,6.),('base_width',43.,6.),('base_height',11.,2.5)]]))
            else:
                bb=assembly.material_solid().BoundingBox()
                measured=np.array([bb.xlen,bb.ylen,bb.zlen]); actual=np.ptp(reference_mesh.vertices,axis=0)
                dimension=float(np.mean(((measured-actual)/np.maximum(actual,1))**2))
            return {'source_mesh_silhouette':float(np.mean(losses)),score_kind:dimension}
        def preview(g):
            return float(np.mean([((g[k]-selected[k])/(hi-lo))**2 for k,(lo,hi) in project.bounds.items()]))
        runner=WideEpoch(location=project.location,source_digests=hashes,
                         construction_digest=project_code_digest(project),
                         objectives=('source_mesh_silhouette',score_kind),
                         score_state='synthetic',checkpoint=result_dir/f'epoch_{epoch:03d}.json',
                         max_exact=exact,max_detail=detail,seed=seed+epoch)
        data=runner.run(proposals,grow=project.grow,score=measure,preview=preview)
        arch=sorted(data['archive'].values(),key=lambda x:x['combined_loss'])
        if arch:selected=dict(arch[0]['genome'])
        last_arch=arch
        records.append({'epoch':epoch,'proposals':len(proposals),
           'cad_evaluated':sum(r.get('audit') is not None for r in data['results'].values()),
           'scored':sum(r['state']=='scored' for r in data['results'].values()),
           'best_loss':arch[0]['combined_loss'] if arch else None,'phenotype_niches':len(arch),
           'selected':selected})
    final_assembly=project.grow(selected);audit=final_assembly.audit(join=True)
    assert audit['valid'], 'A selected model must pass full CAD audit'
    result=project.export(final_assembly,result_dir/'final_cad',selected,size=(280,220))
    final_mesh=final_assembly.tessellate(linear=.33,angular=.30,union=True)
    final_tri=trimesh.Trimesh(vertices=final_mesh.vertices,faces=final_mesh.faces,process=False)
    final_stl=result_dir/'final_surface.stl';final_tri.export(final_stl)
    compare_stack=LocationStack(project.location)
    compare_stack.add_frame(Frame('model-space','local3d','m' if subject=='ur' else 'model_unit'))
    compare_stack.add_source(Source.from_file('reference','cad_model',reference_file,'model-space',observed_as='proposed'))
    compare_stack.add_source(Source.from_file('current','cad_model',final_stl,'model-space',observed_as='proposed'))
    source_pts=sample_mesh(compare_stack,'reference',count=800,seed=13)
    final_pts=sample_mesh(compare_stack,'current',count=800,seed=13)
    surface=sampled_surface_distance(source_pts,final_pts)
    views={}
    for view,cam in cameras.items():
        candidate=silhouette(final_mesh,cam,SIZE)>96
        baseline=reference_masks[view]
        views[view]={'iou':float(iou(baseline,candidate))}
        overlay=np.zeros((SIZE[1],SIZE[0],3),dtype=np.uint8)
        overlay[...,0]=(baseline&~candidate)*220
        overlay[...,1]=(candidate&~baseline)*240
        overlay[...,2]=(baseline&candidate)*210
        Image.fromarray(overlay).save(result_dir/f'overlay_{view}.png')
    summary={'schema':'projection-loom/pair-a-control/v1',
             'subject':subject,'external_sources_ingested':False,
             'source_test_type':'locally authored SCAD/STL control (not third party)',
             'evidence_state':'synthetic','units':source_pts.units,
             'evidence_sources':hashes,'passes':records,
             'selected_genome':selected,'audit_valid':audit['valid'],
             'generated_solid_count':audit['union_solids'],'modelled_parts':audit['parts'],
             'modelled_voids':len(final_assembly.voids.voids) if final_assembly.voids else 0,
             'fixed_camera_iou':views,'sampled_surface_distance':surface,
             'next_hard_inputs':('history-builds-sketchfab' if subject=='ur' else 'nosycat-cc0-brutalism2.zip')}
    (result_dir/'summary.json').write_text(json.dumps(summary,indent=2))
    return summary


def make_sheet(rows):
    subjects=list(rows)
    view_names=['front','oblique','top']
    W=3*SIZE[0]+48; H=2*SIZE[1]*2+100
    canvas=Image.new('RGB',(W,H),(25,30,38));draw=ImageDraw.Draw(canvas)
    y=12
    for subj in subjects:
        draw.text((12,y),f'{subj.upper()} — local synthetic source (top) vs winning CAD (bottom)',fill=(220,229,239))
        y+=25
        for row in (0,1):
            for j,n in enumerate(view_names):
                if row==0:
                    source=Image.open(OUT/subj/f'local_probe_{n}.png').convert('L')
                    a=np.array(source);img=Image.fromarray(np.stack([a,a,a],axis=2))
                else:
                    # Blue denotes matching pixels; red = reference only; green = CAD only.
                    img=Image.open(OUT/subj/f'overlay_{n}.png').convert('RGB')
                canvas.paste(img,(12+j*(SIZE[0]+6),y+row*(SIZE[1]+2)))
        y+=2*SIZE[1]+24
    fp=OUT/'pair_a_contact_sheet.png';canvas.save(fp)
    return fp

if __name__=='__main__':
    OUT.mkdir(parents=True,exist_ok=True)
    rows={p:assess(p) for p in ('ur','brutalist')}
    image=make_sheet(rows)
    (OUT/'paired_summary.json').write_text(json.dumps(rows,indent=2))
    print(json.dumps({'results':{k:{'loss':v['passes'][-1]['best_loss'],
                      'valid':v['audit_valid'],'IoU_oblique':v['fixed_camera_iou']['oblique']['iou'],
                      'sample_distance':v['sampled_surface_distance']['sampled_bidirectional_rms']}
                      for k,v in rows.items()},'contact':str(image)},indent=2))
