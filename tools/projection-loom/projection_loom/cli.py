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
    p.add_argument('--max-depth',type=int,default=12,help='optional nested inquiry depth budget')
    p.add_argument('--max-loops',type=int,default=4096,help='bounded session loop count')
    p.add_argument('--llm-provider',choices=['none','ollama','openai-compatible'],default='none',
                   help='opt-in LLM advice; without this, the Operator can still steer through the inbox')
    p.add_argument('--llm-model',help='provider model name; required when provider enabled')
    p.add_argument('--llm-endpoint',help='optional explicitly trusted HTTP(S) provider endpoint')
    p.add_argument('--llm-key-env',default='OPENAI_API_KEY',help='environment variable containing API key')
    p.add_argument('--llm-phases',action='store_true',help='allow the LLM to suggest nested inquiries at phase gates')
    p.add_argument('--llm-timeout',type=float,default=35)
    p.add_argument('--control', choices=['manual','co-pilot','auto-nav','full-speed'],default='auto-nav')
    p.add_argument('--autonomy',type=float)
    p.add_argument('--capability-recipe',type=Path,
                   help='optional per-entity CAD/mesh capability genome; same OODA helm')
    p.add_argument('--score-size',type=int,nargs=2,default=[128,192],
                   metavar=('WIDTH','HEIGHT'),help='fixed compound evidence viewport')
    p.add_argument('--finalists',type=int,choices=[3,4,5],default=3,
                   help='valid CAD and mesh compound survivors regenerated in location Aftermath')
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
    p=commands.add_parser('search-census',help='Inspect measured source-bound lineage reachability; never generate geometry')
    p.add_argument('--archive',type=Path,required=True)
    p.add_argument('--capability-recipe',type=Path,required=True)
    p.add_argument('--out',type=Path,help='optional JSON witness path')
    p=commands.add_parser('ooda-run', help='Run nested OODA-HA with durable operator steering')
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
    p.add_argument('--max-depth',type=int,default=12,help='nested inquiry depth budget')
    p.add_argument('--max-loops',type=int,default=4096,help='bounded session loop count')
    p.add_argument('--llm-provider',choices=['none','ollama','openai-compatible'],default='none',
                   help='opt-in LLM advice; without this, the Operator can still steer through the inbox')
    p.add_argument('--llm-model',help='provider model name; required when provider enabled')
    p.add_argument('--llm-endpoint',help='optional explicitly trusted HTTP(S) provider endpoint')
    p.add_argument('--llm-key-env',default='OPENAI_API_KEY',help='environment variable containing API key')
    p.add_argument('--llm-phases',action='store_true',help='allow the LLM to suggest nested inquiries at phase gates')
    p.add_argument('--llm-timeout',type=float,default=35)
    p.add_argument('--control', choices=['manual','co-pilot','auto-nav','full-speed'],
                   default='auto-nav', help='operator/AI steering preset')
    p.add_argument('--autonomy',type=float,
                   help='continuous AI discretion [0,1], overrides --control')
    p.add_argument('--capability-recipe',type=Path,
                   help='optional capability recipe; a selected lineage carries CAD plus polymesh genes')
    p.add_argument('--score-size',type=int,nargs=2,default=[128,192],
                   metavar=('WIDTH','HEIGHT'),help='fixed compound evidence viewport')
    p.add_argument('--finalists',type=int,choices=[3,4,5],default=3,
                   help='regrow distinct compound finalists inside location Aftermath')
    p.add_argument('--feature-evidence',type=Path,
                   help='operator-annotated source-bound region masks, provisional only')
    p.add_argument('--transfer-bundle',type=Path,
                   help='operator-authorized normalized cross-location proposal fragments')
    p.add_argument('--breeding',action='store_true',
                   help='six-family quality-diversity campaign using a versioned structural recipe')
    p.add_argument('--offspring-per-family',type=int,default=6,
                   help='bounded 1..32 offspring per family per generation')
    p.add_argument('--migration-every',type=int,default=4,
                   help='generations between compatible cross-family locus grafts')
    p.add_argument('--mutation-scale',type=float,default=.16,
                   help='relative spread for local breeding (0,.4]')
    p=commands.add_parser('ooda-finalists',help='Regrow 3-5 distinct CAD-valid survivors across epochs')
    p.add_argument('--project',type=Path,required=True)
    p.add_argument('--epochs',type=Path,required=True)
    p.add_argument('--out',type=Path,required=True)
    p.add_argument('--count',type=int,choices=[3,4,5],default=4)
    p.add_argument('--size',type=int,nargs=2,default=[384,576])
    p.add_argument('--no-production',action='store_true',help='preview gallery only; still CAD audited')
    p=commands.add_parser('ooda-status',help='Inspect the phase tree and operator checkpoints')
    p.add_argument('--session',type=Path,required=True)
    p=commands.add_parser('ooda-steer',help='Queue a control, applied at the next safe boundary')
    p.add_argument('--session',type=Path,required=True)
    p.add_argument('--action',choices=['pause','resume','review','set-autonomy','approve-plan','choose',
                            'prefer-emitter','pet-name','o-takiage',
                            'open-inquiry','advance-inquiry'],required=True)
    p.add_argument('--autonomy',type=float)
    p.add_argument('--proposal')
    p.add_argument('--emitter',choices=['sobol','local','topology'])
    p.add_argument('--name')
    p.add_argument('--target')
    p.add_argument('--branch')
    p.add_argument('--mode',choices=['entity','location'],default='entity')
    p.add_argument('--has',action='append',default=[])
    p.add_argument('--member-has',action='append',default=[])
    p.add_argument('--retain',type=float,default=.4)
    p.add_argument('--loop',help='existing parent loop or active inquiry loop id')
    p.add_argument('--question',help='question initiating a phase-anchored inquiry')
    p.add_argument('--phase',choices=['orient','decide','act','aftermath','closed'],
                   help='next phase of an active inquiry')
    p.add_argument('--note',help='operator/AI observation, rationale, action or aftermath receipt')
    args=parser.parse_args(argv)
    if args.command=='search-census':
        from .campaign import LineageArchive
        from .capability_stack import CapabilityRecipe
        from .search_strategy import emitter_performance
        recipe=CapabilityRecipe.load(args.capability_recipe)
        payload=json.loads(args.archive.read_text(encoding='utf-8'))
        archive=LineageArchive(args.archive,identity=payload['identity'])
        if archive.identity.get('recipe_sha256') not in (None,recipe.sha256):
            raise ValueError('Census recipe identity differs from lineage archive')
        result=archive.census(recipe.bounds,activations=tuple(
            step.activation for step in recipe.steps if step.activation))
        result['emitter_performance']=emitter_performance(archive)
        result['recipe_sha256']=recipe.sha256
        if args.out:_save(args.out,result)
        print(json.dumps(result,indent=2))
        return result
    if args.command in ('ooda-run','wide-epoch'):
        from .fractal_ooda_ha import run_ooda_epochs
        from .location_stack import LocationStack
        presets={'manual':0.,'co-pilot':.40,'auto-nav':.75,'full-speed':1.}
        project=Project.load(args.project)
        source=LocationStack.load(args.location_stack) if args.location_stack else None
        if args.capability_recipe:
            from .capability_stack import CapabilityRecipe
            recipe=CapabilityRecipe.load(args.capability_recipe)
        else:
            recipe=None
        model_advice = None
        if args.llm_provider != 'none':
            from .llm_helm import HelmLLM
            model_advice=HelmLLM(args.llm_provider,args.llm_model,endpoint=args.llm_endpoint,
                                 api_key_env=args.llm_key_env,timeout=args.llm_timeout)
        result=run_ooda_epochs(project,args.out,passes=args.passes,
            candidates=args.candidates,exact_budget=args.exact_budget,
            detail_budget=args.detail_budget,seed=args.seed,
            topology_loci=args.topology_locus,
            autonomy=args.autonomy if args.autonomy is not None else presets[args.control],
            ledger_path=args.identity_ledger,location_stack=source,
            max_depth=args.max_depth,max_loops=args.max_loops,
            adviser=model_advice.choose if model_advice else None,
            phase_adviser=model_advice.phase if model_advice and args.llm_phases else None,
            recipe=recipe,score_size=tuple(args.score_size),finalists=args.finalists,
            breeding=getattr(args,'breeding',False),
            offspring_per_family=getattr(args,'offspring_per_family',6),
            migration_every=getattr(args,'migration_every',4),
            mutation_scale=getattr(args,'mutation_scale',.16),
            feature_evidence_path=getattr(args,'feature_evidence',None),
            transfer_bundle_path=getattr(args,'transfer_bundle',None))
        print(json.dumps(result,indent=2));return result
    if args.command=='ooda-finalists':
        from .finalists import export_finalists
        project=Project.load(args.project)
        result=export_finalists(project,args.epochs,args.out,count=args.count,
                                size=tuple(args.size),with_production=not args.no_production)
        print(json.dumps({'actual_count':result['actual_count'],
                          'gallery':str(args.out/'contact_sheet.png')}))
        return result
    if args.command=='ooda-status':
        from .fractal_ooda_ha import OODAJournal
        session=OODAJournal(args.session)
        state=session.summary()
        state['open_loops']=[{'id':n['id'],'phase':n['phase'],'scope':n['scope'],
                              'parent_phase':n.get('parent_phase')}
            for n in session.data['loops'].values() if n['phase']!='closed']
        print(json.dumps(state,indent=2));return state
    if args.command=='ooda-steer':
        from .fractal_ooda_ha import submit_control
        parameters={}
        if args.action=='set-autonomy':
            if args.autonomy is None:parser.error('set-autonomy needs --autonomy')
            parameters['autonomy']=args.autonomy
        elif args.action=='choose':
            if not args.proposal:parser.error('choose needs --proposal')
            parameters['proposal_id']=args.proposal
        elif args.action=='prefer-emitter':
            if not args.emitter:parser.error('prefer-emitter needs --emitter')
            parameters['emitter']=args.emitter
        elif args.action=='pet-name':
            parameters=dict(proposal_id=args.proposal,name=args.name,
                target=args.target,mode=args.mode,has=args.has,
                member_has=args.member_has,retain=args.retain)
        elif args.action=='o-takiage':
            parameters=dict(name=args.name,branch=args.branch,proposal_id=args.proposal)
        elif args.action=='open-inquiry':
            if not args.loop or not args.question:
                parser.error('open-inquiry needs --loop and --question')
            parameters=dict(parent_loop=args.loop, question=args.question)
        elif args.action=='advance-inquiry':
            if not args.loop or not args.phase:
                parser.error('advance-inquiry needs --loop and --phase')
            parameters=dict(loop_id=args.loop,phase=args.phase,detail={'note':args.note or ''})
        msg=submit_control(args.session,args.action,**parameters)
        print(json.dumps(msg,indent=2));return msg
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
