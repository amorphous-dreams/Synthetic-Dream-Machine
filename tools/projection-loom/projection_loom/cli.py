"""Command-line interface for solid-grown production models."""
from __future__ import annotations
import argparse,json
from pathlib import Path
import numpy as np
from .pipeline import Project
from .evolution import Evolution
from .render import silhouette


def _save(path,value):
    p=Path(path);p.parent.mkdir(parents=True,exist_ok=True)
    p.write_text(json.dumps(value,indent=2))


def main(argv=None):
    parser=argparse.ArgumentParser(prog='projection-loom',description='Grow and evolve CAD-solid architectures')
    commands=parser.add_subparsers(dest='command',required=True)
    for name in ('grow','validate','evolve','epoch-loop'):
        p=commands.add_parser(name)
        p.add_argument('--project',type=Path,required=True)
        p.add_argument('--out',type=Path,required=True)
        p.add_argument('--genome',type=Path,help='v2 JSON construction genome; never an imported mesh')
        if name in ('grow','evolve','epoch-loop'):p.add_argument('--export-size',nargs=2,type=int,default=[1024,1536])
        if name in ('evolve','epoch-loop'):
            p.add_argument('--burst',type=int,default=32)
            p.add_argument('--survivors',type=int,default=6)
            p.add_argument('--offspring',type=int,default=5)
            p.add_argument('--seed',type=int,default=4811)
        if name=='epoch-loop':p.add_argument('--passes',type=int,default=5)
    args=parser.parse_args(argv)
    project=Project.load(args.project)
    args.out.mkdir(parents=True,exist_ok=True)
    genome=project.load_genome(args.genome) if args.genome else dict(project.initial)
    if args.command=='validate':
        audit=project.grow(genome).audit(join=True)
        _save(args.out/'audit.json',audit)
        print(json.dumps({'valid':audit['valid'],'parts':audit['parts'],'joints':audit['joints']}))
        return audit
    if args.command=='grow':
        a=project.grow(genome)
        result=project.export(a,args.out,genome,size=tuple(args.export_size))
        print(json.dumps({'valid':result['contacts']['valid'],'parts':result['contacts']['parts'],'model':str(args.out)}))
        return result
    evolution=Evolution(project,seed=args.seed)
    if args.command=='evolve':
        results=evolution.evolve(genome,burst=args.burst,survivors=args.survivors,offspring=args.offspring)
        for n,item in enumerate(results,1):
            project.export(project.grow(item['genome']),args.out/f'lineage_{n:02d}',item['genome'],size=tuple(args.export_size))
        _save(args.out/'evolution.json',{'lineages':results,'evaluations':evolution.eval_count,'history':evolution.records})
        print(json.dumps({'lineages':len(results),'evaluations':evolution.eval_count}))
        return results
    if args.command=='epoch-loop':
        manifest={'passes':[],'schema':'projection-loom/solid-epochs/v2','policy':'each generation grows fresh solids from v2 genome; meshes never become seeds'}
        immutable=genome.copy()
        current=dict(genome)
        for i in range(args.passes):
            feedback=None
            if i:
                mesh=project.grow(current).tessellate(linear=.40)
                feedback={n:silhouette(mesh,cam,evolution.size)>96 for n,cam in project.cameras.items() if n!='oblique'}
            results=evolution.evolve(current,burst=args.burst,survivors=args.survivors,offspring=args.offspring,feedback=feedback)
            if results:
                best=results[0]
                # Do not discard the accepted genome solely due to self-feedback.
                immutable_loss=evolution.evaluate(evolution.as_vector(immutable),lit=True)
                candidate_loss=evolution.evaluate(evolution.as_vector(best['genome']),lit=True)
                if candidate_loss<=immutable_loss+.04:current=best['genome']
            folder=args.out/f'epoch_{i+1:02d}'
            project.export(project.grow(current),folder,current,size=tuple(args.export_size))
            _save(folder/'search.json',{'top_lineages':results,'history':evolution.records})
            manifest['passes'].append({'epoch':i+1,'genome':dict(current),'best_loss':results[0]['loss'] if results else None,
                                       'accepted':dict(current)==(results[0]['genome'] if results else {}),
                                       'models':[x['genome'] for x in results]})
            _save(args.out/'manifest.json',manifest)
        print(json.dumps({'passes':len(manifest['passes']),'evaluations':evolution.eval_count}))
        return manifest

if __name__=='__main__':main()
