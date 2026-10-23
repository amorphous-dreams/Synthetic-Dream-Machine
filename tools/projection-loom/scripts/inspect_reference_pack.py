"""Check a downloaded external reference as source evidence, never CAD authority."""
from __future__ import annotations
import argparse
import json
from pathlib import Path
import shutil
import subprocess

from projection_loom.location_stack import Frame, LocationStack, Source
from projection_loom.surface_witness import sample_mesh


def inspect(receipt_file, *, compile_scad=False, limit=6):
    receipt=json.loads(Path(receipt_file).read_text())
    root=Path(receipt['extract_root']).resolve()
    if limit<1:raise ValueError('Reference inspection budget must be positive')
    stack=LocationStack('external-reference-test')
    stack.add_frame(Frame('author-units','local3d','model_unit'))
    findings=[]
    source_files=[]
    for file in receipt['files']:
        path=root/file['path']
        if path.suffix.lower()=='.stl':source_files.append(path)
    for ix,path in enumerate(source_files[:limit]):
        item={'filename':str(path.relative_to(root)),'original_source_sha256':receipt['sha256']}
        try:
            source=Source.from_file('witness-'+str(ix),'cad_model',path,'author-units')
            stack.add_source(source)
            witness=sample_mesh(stack,source.id,count=48,seed=ix)
            item.update({'valid_surface_sample':True,'sample_count':len(witness.points),
                         'sha256':source.sha256,'coordinate_frame':'model_unit-unverified'})
        except Exception as err:
            item.update({'valid_surface_sample':False,'error':str(err)[:300]})
        findings.append(item)
    build=None
    if compile_scad:
        scads=[root/f['path'] for f in receipt['files'] if f['path'].endswith('.scad')]
        if scads:
            src=scads[0]
            openscad=shutil.which('openscad')
            if not openscad:
                raise RuntimeError('OpenSCAD executable missing; install it to compile a reference script')
            if src.stat().st_size>5*1024*1024:
                raise ValueError('Unreviewed OpenSCAD script too large')
            output=root/'projection_loom_compiled_witness.stl'
            task=subprocess.run([openscad,'-o',str(output),str(src)],
                                capture_output=True,text=True,timeout=90,cwd=src.parent,check=False)
            build={'source':str(src.relative_to(root)), 'returncode':task.returncode,
                   'stderr_tail':task.stderr[-1000:],
                   'output':str(output) if output.exists() else None}
            if task.returncode==0 and output.is_file():
                source=Source.from_file('openscad-output','cad_model',output,'author-units')
                stack.add_source(source)
                witness=sample_mesh(stack,source.id,count=48,seed=41)
                build.update({'surface_sample_count':len(witness.points),
                              'sha256':source.sha256, 'cad_validity':'not-inferred'})
    return {'schema':'projection-loom/external-reference-evidence/v1',
            'source':receipt['source'],'original_sha256':receipt['sha256'],
            'locked':receipt['locked'],'license':receipt['license'],
            'sampled_stls':findings,'openscad':build,
            'authority':'polygon samples are source witnesses; not certified CAD union or metric geometry'}


def main(argv=None):
    p=argparse.ArgumentParser()
    p.add_argument('--receipt',type=Path,required=True)
    p.add_argument('--compile-one-scad',action='store_true')
    p.add_argument('--out',type=Path,required=True)
    args=p.parse_args(argv)
    result=inspect(args.receipt,compile_scad=args.compile_one_scad)
    args.out.parent.mkdir(parents=True,exist_ok=True)
    args.out.write_text(json.dumps(result,indent=2)+'\n')
    print(json.dumps({'source':result['source'],'sampled_stls':len(result['sampled_stls']),
                      'compile':bool(result['openscad'])}))


if __name__=='__main__':main()
