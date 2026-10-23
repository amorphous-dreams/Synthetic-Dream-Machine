"""Command-line interface for solid-grown production models."""
from __future__ import annotations
import argparse,json
from pathlib import Path
import numpy as np
from .pipeline import Project
from .evolution import Evolution
from .render import silhouette
from .relations import PetNameLedger, RelationWitness


def _save(path,value):
    p=Path(path);p.parent.mkdir(parents=True,exist_ok=True)
    p.write_text(json.dumps(value,indent=2))


def main(argv=None):
    parser=argparse.ArgumentParser(prog='projection-loom',description='Grow and evolve CAD-solid architectures')
    commands=parser.add_subparsers(dest='command',required=True)
    for name in ('grow','validate','evolve','epoch-loop','discover'):
        p=commands.add_parser(name)
        p.add_argument('--project',type=Path,required=True)
        p.add_argument('--out',type=Path,required=True)
        p.add_argument('--genome',type=Path,help='JSON construction genome; never an imported mesh')
        p.add_argument('--identity-ledger',type=Path,help='optional operator-authored pet-name ledger')
        if name in ('grow','evolve','epoch-loop'):p.add_argument('--export-size',nargs=2,type=int,default=[1024,1536])
        if name in ('evolve','epoch-loop'):
            p.add_argument('--burst',type=int,default=32)
            p.add_argument('--survivors',type=int,default=6)
            p.add_argument('--offspring',type=int,default=5)
            p.add_argument('--seed',type=int,default=4811)
            p.add_argument('--slack-fraction',type=float,default=.20,
                           help='fraction of survivors reserved for novel valid phenotypes')
        if name=='epoch-loop':p.add_argument('--passes',type=int,default=5)
    p=commands.add_parser('wide-epoch',help='Resumable staged constructive epochs')
    p.add_argument('--project',type=Path,required=True)
    p.add_argument('--out',type=Path,required=True)
    p.add_argument('--passes',type=int,default=3)
    p.add_argument('--candidates',type=int,default=9)
    p.add_argument('--exact-budget',type=int,default=6)
    p.add_argument('--detail-budget',type=int,default=3)
    p.add_argument('--topology-locus',action='append',default=[])
    p.add_argument('--seed',type=int,default=41)
    p.add_argument('--location-stack',type=Path)
    p.add_argument('--identity-ledger',type=Path)
    p=commands.add_parser('inspect-dem',help='Inspect an actual digest-checked DEM and its datum')
    p.add_argument('--location-stack',type=Path,required=True)
    p.add_argument('--source-id',required=True)
    p=commands.add_parser('register-control',help='Fit held-out rigid survey control')
    p.add_argument('--location-stack',type=Path,required=True)
    p.add_argument('--source-frame',required=True)
    p.add_argument('--target-frame',required=True)
    p.add_argument('--source-id',required=True)
    p.add_argument('--tolerance',type=float,required=True)
    p.add_argument('--out',type=Path,required=True)
    p=commands.add_parser('pet-name',help='Bind an observed entity or a nameless location set')
    p.add_argument('--witness',type=Path,required=True)
    p.add_argument('--ledger',type=Path,required=True)
    p.add_argument('--target',required=True,help='observed construction handle (not a CAD face index)')
    p.add_argument('--name',required=True,help='operator-given pet-name')
    p.add_argument('--mode',choices=['entity','location'],default='entity')
    p.add_argument('--has',action='append',default=[],help='expected #has capability; repeatable')
    p.add_argument('--member-has',action='append',default=[],help='location member capability filter')
    p.add_argument('--retain',type=float,default=.4,help='soft affinity, from zero to one')
    p=commands.add_parser('o-takiage',help='Release one pet-name or a whole construction fork')
    p.add_argument('--ledger',type=Path,required=True)
    group=p.add_mutually_exclusive_group(required=True)
    group.add_argument('--name')
    group.add_argument('--branch')
    p.add_argument('--witness',type=Path,help='required for branch release')
    args=parser.parse_args(argv)
    if args.command=='inspect-dem':
        from .location_stack import LocationStack
        from .geospatial import inspect_dem
        result=inspect_dem(LocationStack.load(args.location_stack),args.source_id).to_dict()
        print(json.dumps(result));return result
    if args.command=='register-control':
        from .location_stack import LocationStack
        from .registration3d import register_control_csv
        stack=LocationStack.load(args.location_stack)
        fit=register_control_csv(stack,args.source_frame,args.target_frame,args.source_id,
                                 tolerance_m=args.tolerance)
        _save(args.out,fit.to_dict())
        print(json.dumps({'state':fit.state,'holdout_rms':fit.holdout_rms}))
        return fit
    if args.command=='wide-epoch':
        from .epochs import run_project_epochs
        from .location_stack import LocationStack
        project=Project.load(args.project)
        ledger=PetNameLedger.load(args.identity_ledger) if args.identity_ledger else None
        location=LocationStack.load(args.location_stack) if args.location_stack else None
        result=run_project_epochs(project,args.out,passes=args.passes,
                       candidates=args.candidates,exact_budget=args.exact_budget,
                       detail_budget=args.detail_budget,seed=args.seed,
                       topology_loci=args.topology_locus,ledger=ledger,
                       location_stack=location)
        print(json.dumps({'passes':len(result['passes']),
                          'evidence_state':result['evidence_state']}))
        return result
    if args.command=='pet-name':
        witness=RelationWitness.load(args.witness)
        ledger=PetNameLedger.load(args.ledger) if args.ledger.exists() else PetNameLedger(location=witness.location)
        claim=ledger.pet_name(args.name,args.target,witness,mode=args.mode,
                              has=args.has,member_has=args.member_has,retain=args.retain)
        ledger.save(args.ledger)
        print(json.dumps({'pet_name':claim['name'],'claim_id':claim['claim_id'], 'mode':claim['mode']}))
        return claim
    if args.command=='o-takiage':
        ledger=PetNameLedger.load(args.ledger)
        witness=RelationWitness.load(args.witness) if args.witness else None
        receipt=ledger.o_takiage(name=args.name,branch=args.branch,witness=witness)
        ledger.save(args.ledger)
        print(json.dumps(receipt))
        return receipt
    project=Project.load(args.project)
    ledger=PetNameLedger.load(args.identity_ledger) if args.identity_ledger else None
    if ledger is not None and ledger.location != project.location:
        raise ValueError('Identity ledger location does not match project')
    args.out.mkdir(parents=True,exist_ok=True)
    genome=project.load_genome(args.genome) if args.genome else dict(project.initial)
    if args.command=='discover':
        assembly=project.grow(genome)
        audit=assembly.audit(join=True)
        if not audit['valid']:
            raise ValueError('Only structurally and spatially valid constructions may be discovered')
        witness=assembly.relation_witness(location=project.location)
        witness.save(args.out/'relations.json')
        receipt={'witness_id':witness.witness_id,'entities':len(witness.nodes),
                 'nameless':sum(x.anonymous for x in witness.nodes.values()),
                 'bindings':ledger.resolve(witness) if ledger else []}
        _save(args.out/'discovery.json',receipt)
        print(json.dumps(receipt))
        return receipt
    if args.command=='validate':
        audit=project.grow(genome).audit(join=True)
        _save(args.out/'audit.json',audit)
        print(json.dumps({'valid':audit['valid'],'parts':audit['parts'],'joints':audit['joints']}))
        return audit
    if args.command=='grow':
        a=project.grow(genome)
        result=project.export(a,args.out,genome,size=tuple(args.export_size),ledger=ledger)
        print(json.dumps({'valid':result['contacts']['valid'],'parts':result['contacts']['parts'],'model':str(args.out)}))
        return result
    evolution=Evolution(project,seed=args.seed,ledger=ledger,slack_fraction=args.slack_fraction)
    if args.command=='evolve':
        results=evolution.evolve(genome,burst=args.burst,survivors=args.survivors,offspring=args.offspring)
        for n,item in enumerate(results,1):
            project.export(project.grow(item['genome']),args.out/f'lineage_{n:02d}',item['genome'],size=tuple(args.export_size),ledger=ledger)
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
                mesh=project.grow(current).tessellate(linear=.40,union=True)
                feedback={n:silhouette(mesh,evolution.fitness_cameras[n],evolution.size)>96 for n in project.cameras if n!=project.reference_view}
            results=evolution.evolve(current,burst=args.burst,survivors=args.survivors,offspring=args.offspring,feedback=feedback)
            if results:
                best=results[0]
                # Do not discard the accepted genome solely due to self-feedback.
                immutable_loss=evolution.evaluate(evolution.as_vector(immutable),lit=True)
                candidate_loss=evolution.evaluate(evolution.as_vector(best['genome']),lit=True)
                if candidate_loss<=immutable_loss+.04:current=best['genome']
            folder=args.out/f'epoch_{i+1:02d}'
            project.export(project.grow(current),folder,current,size=tuple(args.export_size),ledger=ledger)
            _save(folder/'search.json',{'top_lineages':results,'history':evolution.records})
            manifest['passes'].append({'epoch':i+1,'genome':dict(current),'best_loss':results[0]['loss'] if results else None,
                                       'accepted':dict(current)==(results[0]['genome'] if results else {}),
                                       'models':[x['genome'] for x in results]})
            _save(args.out/'manifest.json',manifest)
        print(json.dumps({'passes':len(manifest['passes']),'evaluations':evolution.eval_count}))
        return manifest

if __name__=='__main__':main()
