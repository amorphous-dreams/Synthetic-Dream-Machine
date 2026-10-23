"""Command-line entry point for parametric projection workspaces."""
import argparse
import json
from pathlib import Path
from .evolution import Project,parameters_from_file,produce
from .render import export_controls,light_vector,silhouette
from .topology import assembly_contacts,mask_components


def main(argv=None):
    parser=argparse.ArgumentParser(prog='projection-loom')
    commands=parser.add_subparsers(dest='command',required=True)
    for name in ('render','validate','evolve'):
        sub=commands.add_parser(name)
        sub.add_argument('--project',required=True,type=Path)
        sub.add_argument('--out',required=True,type=Path)
        source = sub.add_mutually_exclusive_group()
        source.add_argument('--seed', type=Path, help='parametric checkpoint or parameter map')
        source.add_argument('--seed-geometry', type=Path,
                            help='evolve a saved NPZ or imported OBJ/PLY/STL/GLB/GLTF mesh')
    run=commands.choices['evolve']
    run.add_argument('--feed',action='append',default=[],metavar='VIEW=FILE')
    run.add_argument('--cycles',type=int,default=2)
    run.add_argument('--burst',type=int,default=32)
    run.add_argument('--survivors',type=int,default=6)
    run.add_argument('--offspring',type=int,default=6)
    run.add_argument('--rng-seed',type=int,default=4811)
    args=parser.parse_args(argv)
    if args.command=='evolve':
        result=produce(args.project,args.out,args.seed,args.feed,args.cycles,
                       args.burst,args.survivors,args.offspring,rng_seed=args.rng_seed,
                       seed_geometry=args.seed_geometry)
        print(json.dumps({'manifest':str(args.out/'manifest.json'),'loss':result['final_loss'],
                          'evaluations':result['evaluations']}))
        return result
    project=Project.load(args.project)
    if args.seed_geometry is not None:
        project=project.with_geometry_seed(args.seed_geometry)
    params=parameters_from_file(args.seed,project.initial)
    mesh=project.build(params)
    args.out.mkdir(parents=True,exist_ok=True)
    mesh.save(args.out/'mesh.npz',params)
    if args.command=='render':
        photo,key=project.photo_reference()
        if key is None:key=light_vector(-75,50)
        files=export_controls(mesh,project.cameras,args.out/'controls',
                              light=key,style=project.settings.get('render'))
        output={'controls':files,'mesh':str(args.out/'mesh.npz'),
                'geometry_mode':'deformation' if project.geometry_source else 'parametric',
                'geometry_source':project.geometry_source}
    else:
        output={'geometry_source':project.geometry_source,
                'contacts':assembly_contacts(mesh),
                'projections':{name:mask_components(silhouette(mesh,camera)>96)
                               for name,camera in project.cameras.items()}}
    (args.out/'manifest.json').write_text(json.dumps(output,indent=2))
    print(json.dumps({'manifest':str(args.out/'manifest.json')}))
    return output
