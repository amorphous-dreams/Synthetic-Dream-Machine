"""Checkpointed geometry evolution across complete render-and-feedback epochs.

Each epoch performs the project search and exports all control modalities. A
subsequent epoch inherits the accepted mesh and validates the four prior control
passes per camera. Previous silhouettes carry a bounded, secondary search weight;
structural and lighting images provide acceptance diagnostics rather than
becoming independent evidence about unseen geometry.
"""
from __future__ import annotations

from pathlib import Path
import hashlib
import json
import os
import shutil
import time
import numpy as np
from PIL import Image

from .evolution import Project, parameters_from_file, produce
from .geometry import Mesh
from .render import export_controls, silhouette, light_vector
from .fitness import Target, silhouette_score
from .topology import assembly_contacts, mask_components

CONTROL_KINDS = ('silhouette', 'structure', 'lit', 'lit_structure')
RUN_SCHEMA = 'projection-loom/epoch-loop/v1'


def _json(path, value):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    pending = path.with_suffix(path.suffix + '.tmp')
    pending.write_text(json.dumps(value, indent=2, sort_keys=True) + '\n')
    os.replace(pending, path)


def _hash(path):
    sha = hashlib.sha256()
    with open(path, 'rb') as src:
        for piece in iter(lambda: src.read(1024 * 1024), b''):
            sha.update(piece)
    return sha.hexdigest()


def _control_paths(files):
    controls = {}
    for view, modalities in files.items():
        if set(modalities) != set(CONTROL_KINDS):
            raise ValueError(f'Incomplete control set for {view}: {sorted(modalities)}')
        controls[view] = {}
        for kind in CONTROL_KINDS:
            source = Path(modalities[kind]).resolve()
            if not source.is_file():
                raise FileNotFoundError(source)
            controls[view][kind] = str(source)
    return controls


def _evidence_specs(controls, feedback_weight):
    if not controls or feedback_weight <= 0:
        return []
    weight = float(feedback_weight) / len(controls)
    return [{'view': name, 'path': files['silhouette'], 'channel': 'luma',
             'weight': weight} for name, files in sorted(controls.items())]


def _gray(path, size=(128, 192), kind='silhouette'):
    with Image.open(path) as im:
        if kind == 'silhouette':
            px = np.array(im.convert('L').resize(size, Image.Resampling.BOX), dtype=np.float32)/255
            return px
        rgba = np.array(im.convert('RGBA').resize(size, Image.Resampling.BOX), dtype=np.float32)/255
    rgb = rgba[..., :3]
    lum = rgb @ np.array((.2126, .7152, .0722), dtype=np.float32)
    alpha = rgba[..., 3]
    return lum, alpha


def _correlate(a, b, mask):
    aa = a[mask].astype(float)
    bb = b[mask].astype(float)
    if len(aa) < 20:
        return 0.
    aa -= aa.mean()
    bb -= bb.mean()
    den = np.linalg.norm(aa)*np.linalg.norm(bb)
    if den < 1e-8:
        return float(np.exp(-10*abs(a[mask].mean()-b[mask].mean())))
    return float(np.clip((aa @ bb)/den, -1, 1)*.5+.5)


def compare_controls(previous, current, size=(128, 192)):
    """Assess feedback from every output modality without confusing its role."""
    previous = _control_paths(previous)
    current = _control_paths(current)
    if previous.keys() != current.keys():
        raise ValueError('Control views must remain stable between epochs')
    per_view = {}
    for view in previous:
        pm = _gray(previous[view]['silhouette'], size)
        cm = _gray(current[view]['silhouette'], size)
        before, after = pm > .35, cm > .35
        intersection = int((before & after).sum())
        union = int((before | after).sum())
        iou = intersection/max(1, union)
        common = before & after
        values = {'silhouette_iou': float(iou)}
        for kind in ('structure', 'lit', 'lit_structure'):
            prev_luma, prev_alpha = _gray(previous[view][kind], size, kind)
            cur_luma, cur_alpha = _gray(current[view][kind], size, kind)
            valid = common & ((prev_alpha > .03) | (cur_alpha > .03))
            if kind == 'structure':
                # Preserve stroke positions independent of sparse line coverage.
                prev_strokes = prev_alpha > .16
                cur_strokes = cur_alpha > .16
                o = int((prev_strokes & cur_strokes).sum())
                u = int((prev_strokes | cur_strokes).sum())
                values['structure_iou'] = float(o / max(1,u))
            else:
                values[f'{kind}_luma_similarity'] = _correlate(prev_luma, cur_luma, valid)
        per_view[view] = values
    score_map = {'silhouette_iou':.62,'structure_iou':.14,
                 'lit_luma_similarity':.14,'lit_structure_luma_similarity':.10}
    aggregate = {name:float(np.mean([v[name] for v in per_view.values()])) for name in score_map}
    return {'per_view': per_view, 'aggregate': aggregate,
            'combined': float(sum(aggregate[name]*w for name,w in score_map.items()))}


def anchored_evidence(project, model, targets, size):
    """Score against unchanged source evidence; never count self-feedback here."""
    if not targets:
        raise ValueError('Anchored evidence requires at least one fixed reference')
    target_scores = []
    for target in targets:
        predicted = silhouette(model, project.cameras[target.view], size)>96
        score = silhouette_score(target.mask, predicted, target.roi)
        target_scores.append((target.weight, score['value']))
    norm = sum(w for w,_ in target_scores)
    quality = sum(w*s for w,s in target_scores) / max(norm,1e-9)
    connectivity = {name:mask_components(silhouette(model,camera,size)>96)
                    for name,camera in project.cameras.items()}
    contacts = assembly_contacts(model)
    islands = sum(max(0, int(item['count'])-1) for item in connectivity.values())
    contact_parts = max(0, int(contacts['part_contact_count'])-1)
    return {'shape_quality':float(quality), 'stray_islands':int(islands),
            'contact_component_extras':int(contact_parts),
            'quality':float(quality - .12*islands - .12*contact_parts),
            'view_connectivity':connectivity}


def _anchor(project, project_seed, seed_geometry, out, export_size, resolution, auto_anchor):
    """Create the immutable run-origin model and, if necessary, reference masks."""
    anchor_dir = out/'anchor'
    anchor_dir.mkdir(parents=True,exist_ok=True)
    if seed_geometry is not None:
        model = Mesh.from_file(seed_geometry)
        parameters = dict(project.initial)
    else:
        parameters = parameters_from_file(project_seed, project.initial)
        model = project.build(parameters)
    anchor_mesh = anchor_dir/'mesh.npz'
    model.save(anchor_mesh, parameters if seed_geometry is None else {})
    model.export_obj(anchor_dir/'mesh.obj')
    photo,light = project.photo_reference(size=resolution)
    controls = _control_paths(export_controls(model,project.cameras,anchor_dir/'controls',
                      size=export_size,light=light if light is not None else light_vector(-75,50),
                      style=project.settings.get('render')))
    bootstrap = []
    if not project.target_specs:
        if not auto_anchor:
            raise ValueError('Project has no fixed targets; set --bootstrap-targets to anchor its initial silhouette')
        # Held snapshots remain fixed even when next-epoch controls vary.
        w = 1.0 / len(controls)
        bootstrap = [{'view': name, 'path': record['silhouette'], 'channel':'luma','weight':w}
                     for name,record in sorted(controls.items())]
    _json(anchor_dir/'manifest.json',{'mesh':str(anchor_mesh.resolve()),
          'controls':controls,'bootstrapped_targets':bootstrap})
    return str(anchor_mesh.resolve()), controls, bootstrap


def _rescan_finished(out, project, config, resume):
    state_file=out/'state.json'
    if not resume:
        if out.exists() and any(out.iterdir()):
            raise FileExistsError(f'Output directory is not empty; use --resume: {out}')
        return None
    if not state_file.is_file():
        raise FileNotFoundError(f'No resumable state in {out}')
    state=json.loads(state_file.read_text())
    if state.get('schema') != RUN_SCHEMA or state.get('config') != config:
        raise ValueError('Resume configuration differs from the saved epoch loop')
    for entry in state['epochs']:
        folder=out/entry['directory']
        required=(folder/'candidate'/'manifest.json', folder/'candidate'/'search.json', folder/'feedback.json')
        if any(not f.is_file() for f in required):
            raise FileNotFoundError(f'Incomplete epoch {entry["number"]}: {required}')
        if not Path(entry['candidate_mesh']).is_file():
            raise FileNotFoundError(f'Missing checkpoint for epoch {entry["number"]}')
    return state


def epoch_loop(project_path, out, seed=None, seed_geometry=None, *, passes=5,
               burst=64, survivors=10, offspring=8, cycles_per_epoch=1,
               rng_seed=4811, resolution=(256,384), export_size=(1024,1536),
               feedback_weight=.12, min_feedback_similarity=.45,
               evidence_tolerance=.015, auto_anchor=True,
               handoff='mesh', resume=False):
    """Run complete geometry evolution/render/feedback cycles and keep checkpoints."""
    if seed is not None and seed_geometry is not None:
        raise ValueError('Use seed or seed_geometry, not both')
    if handoff not in ('mesh','parametric'):
        raise ValueError('handoff must be mesh or parametric')
    if seed_geometry is not None and handoff == 'parametric':
        raise ValueError('A direct mesh seed requires mesh handoff')
    if min(passes,burst,survivors,offspring,cycles_per_epoch) < 1:
        raise ValueError('Epoch, burst and population sizes must be positive')
    if not 0 <= feedback_weight <= .5 or not 0 <= min_feedback_similarity <= 1:
        raise ValueError('Feedback weights and thresholds are outside their supported ranges')
    if evidence_tolerance < 0:
        raise ValueError('Evidence tolerance must not be negative')
    out=Path(out).resolve()
    project_path=Path(project_path).resolve()
    project=Project.load(project_path)
    seed_geometry=Path(seed_geometry).resolve() if seed_geometry is not None else None
    seed=Path(seed).resolve() if seed is not None else None
    config={'project':str(project_path),'project_sha256':_hash(project_path),
        'rig_sha256':_hash(project.rig_path),'seed':str(seed) if seed else None,
        'seed_geometry':str(seed_geometry) if seed_geometry else None,
        'initial_seed_sha256':_hash(seed_geometry or seed) if (seed_geometry or seed) else None,
        'burst':int(burst),'survivors':int(survivors),'offspring':int(offspring),
        'cycles_per_epoch':int(cycles_per_epoch),'rng_seed':int(rng_seed),
        'resolution':list(resolution),'export_size':list(export_size),
        'feedback_weight':float(feedback_weight),'min_feedback_similarity':float(min_feedback_similarity),
        'evidence_tolerance':float(evidence_tolerance),'auto_anchor':bool(auto_anchor),
        'handoff':handoff}
    state=_rescan_finished(out,project,config,resume)
    if state is None:
        out.mkdir(parents=True,exist_ok=True)
        first_mesh,first_controls,boot=_anchor(project,seed,seed_geometry,out,export_size,resolution,auto_anchor)
        state={'schema':RUN_SCHEMA,'config':config,'requested_passes':int(passes),
               'started_at':time.time(),'anchor_mesh':first_mesh,
               'anchor_controls':first_controls,'bootstrap_targets':boot,'epochs':[]}
        _json(out/'state.json',state)
    elif int(passes)<len(state['epochs']):
        raise ValueError('Pass count cannot be less than the number of completed epochs')
    base_specs = list(project.target_specs)+list(state['bootstrap_targets'])
    fixed_targets=[Target.read(item,project_path.parent,size=resolution) for item in base_specs]
    state['requested_passes']=int(passes)
    _json(out/'state.json',state)
    anchor_model=Mesh.from_file(state['anchor_mesh'])
    anchor_evidence=anchored_evidence(project,anchor_model,fixed_targets,resolution)
    print(f'[Projection Loom] immutable anchor quality: {anchor_evidence["quality"]:.4f}', flush=True)
    for epoch in range(len(state['epochs'])+1,passes+1):
        previous=state['epochs'][-1] if state['epochs'] else None
        incoming_mesh=previous['accepted_mesh'] if previous else state['anchor_mesh']
        incoming_controls=previous['accepted_controls'] if previous else state['anchor_controls']
        print(f'[Projection Loom] epoch {epoch}/{passes}: evolving {burst} Sobol samples, {survivors} survivors, {offspring} offspring', flush=True)
        epoch_dir=out/f'epoch_{epoch:02d}'
        if epoch_dir.exists():
            # An interrupted epoch has no committed state entry. Retain it
            # for inspection rather than silently treating it as complete.
            orphan=out/f'epoch_{epoch:02d}_interrupted_{int(time.time())}'
            epoch_dir.rename(orphan)
        epoch_dir.mkdir(parents=True,exist_ok=False)
        candidate_dir=epoch_dir/'candidate'
        snapshot=_control_paths(incoming_controls)
        # All prior controls enter as explicit sources. Only silhouettes enter the
        # population objective; structural and lighting controls enter the review gate.
        feedback_specs=_evidence_specs(snapshot,feedback_weight)
        fixed_feedback=list(state['bootstrap_targets'])
        # Project targets remain part of every score; bootstrapped targets are fixed.
        if handoff=='mesh' or seed_geometry is not None:
            current_seed,geometry_seed=None,incoming_mesh
        else:
            current_seed,geometry_seed=incoming_mesh,None
        local_project_path=project_path
        if fixed_feedback:
            # Passing these as weighted target dictionaries avoids modifying the
            # externally authored project manifest or its path resolution.
            epoch_feedback=fixed_feedback+feedback_specs
        else:
            epoch_feedback=feedback_specs
        result=produce(local_project_path,candidate_dir,seed=current_seed,
            seed_geometry=geometry_seed,feedback=epoch_feedback,
            cycles=cycles_per_epoch,burst=burst,survivors=survivors,
            offspring=offspring,resolution=resolution,export_size=export_size,
            rng_seed=rng_seed+epoch*1009)
        current_controls=_control_paths(result['outputs'])
        previous_mesh=Mesh.from_file(incoming_mesh)
        candidate_mesh=Mesh.from_file(candidate_dir/'mesh.npz')
        prior_quality=anchored_evidence(project,previous_mesh,fixed_targets,resolution)
        next_quality=anchored_evidence(project,candidate_mesh,fixed_targets,resolution)
        comparison=compare_controls(snapshot,current_controls)
        # Score against original/anchored evidence before considering internally
        # generated similarity. A failed candidate remains available for inspection.
        evidence_ok=(next_quality['quality']>=prior_quality['quality']-evidence_tolerance
                     and next_quality['quality']>=anchor_evidence['quality']-evidence_tolerance)
        feedback_ok=comparison['combined']>=min_feedback_similarity
        accepted=bool(evidence_ok and feedback_ok)
        accepted_mesh=str((candidate_dir/'mesh.npz').resolve()) if accepted else incoming_mesh
        accepted_controls=current_controls if accepted else incoming_controls
        feedback_manifest={
            'epoch':epoch,'original_targets':base_specs,
            'geometry_input':incoming_mesh,
            'geometry_input_sha256':_hash(incoming_mesh),
            'input_controls':snapshot,
            'silhouette_targets':feedback_specs,
            'structural_lighting_feedback':comparison,
            'prior_evidence':prior_quality,
            'candidate_evidence':next_quality,
            'quality_gate':{'evidence_ok':evidence_ok,'feedback_ok':feedback_ok,
                            'accepted':accepted},
            'candidate_mesh':str((candidate_dir/'mesh.npz').resolve()),
            'accepted_mesh':accepted_mesh}
        _json(epoch_dir/'feedback.json',feedback_manifest)
        entry={'number':epoch,'directory':epoch_dir.relative_to(out).as_posix(),
               'candidate_mesh':str((candidate_dir/'mesh.npz').resolve()),
               'accepted_mesh':accepted_mesh,'accepted_controls':accepted_controls,
               'accepted':accepted,'anchor_quality_before':prior_quality['quality'],
               'anchor_quality_after':next_quality['quality'],
               'feedback_similarity':comparison['combined'],
               'evaluations':result['evaluations'],
               'candidate_sha256':_hash(candidate_dir/'mesh.npz'),
               'input_sha256':_hash(incoming_mesh)}
        state['epochs'].append(entry)
        _json(out/'state.json',state)
        print(f'[Projection Loom] epoch {epoch}/{passes}: {"accepted" if accepted else "held previous"}; '               f'anchor quality {prior_quality["quality"]:.4f} -> {next_quality["quality"]:.4f}; '               f'feedback {comparison["combined"]:.3f}; evaluations {result["evaluations"]}', flush=True)
    final=state['epochs'][-1] if state['epochs'] else None
    _json(out/'manifest.json',{'schema':RUN_SCHEMA,'passes_completed':len(state['epochs']),
                              'epochs':state['epochs'],
                              'final_mesh':final['accepted_mesh'] if final else state['anchor_mesh'],
                              'final_controls':final['accepted_controls'] if final else state['anchor_controls']})
    return state
