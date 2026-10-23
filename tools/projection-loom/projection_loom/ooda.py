"""OODA-HA as an executable, nested, human-steerable workflow.

A location contains epoch loops; each epoch contains actual evaluated candidate
loops.  The five phases are guarded state transitions, not descriptive tags.
Only the epoch Act calls a CAD evaluator, and it checkpoints completed candidates
before acknowledging external controls.  Operator commands arrive through an
append-only local inbox so a separate CLI process never rewrites the runner's
checkpoint.  This is cooperative pausing at safe points, not preemptive CAD abort.
"""
from __future__ import annotations
from contextlib import contextmanager
from hashlib import sha256
from pathlib import Path
from uuid import uuid4
from time import time_ns
import json
import math
import os
from PIL import Image
import numpy as np

from .epochs import WideEpoch, propose_methods, project_code_digest, project_silhouette_score
from .epochs import _hash, _atomic

PHASES = ('observe', 'orient', 'decide', 'act', 'aftermath', 'closed')
SCHEMA = 'projection-loom/ooda-ha-session/v1'


def _fingerprint(value):
    return sha256(json.dumps(value, sort_keys=True, ensure_ascii=False,
                             separators=(',', ':'), allow_nan=False).encode()).hexdigest()


def _autonomy(value):
    x = float(value)
    if not math.isfinite(x) or not 0 <= x <= 1:
        raise ValueError('Autonomy must lie between 0 and 1')
    return x


def control_mode(autonomy):
    """Presets mark regions of the gradient, not different CAD safety policies."""
    a = _autonomy(autonomy)
    return ('manual' if a < .25 else 'co-pilot' if a < .60
            else 'auto-nav' if a < .90 else 'full-speed')


def submit_control(session_path, action, *, actor='operator', **parameters):
    """Durably queue an operator turn; the runner applies it at a safe boundary.

    The inbox is local and single-operator-trusted, not a network authorization
    service.  Distinct immutable files avoid writers clobbering session.json.
    """
    allowed = {'pause', 'resume', 'review', 'set-autonomy', 'approve-plan',
               'choose', 'prefer-emitter', 'pet-name', 'o-takiage'}
    if action not in allowed:
        raise ValueError('Unrecognized steering action')
    if actor != 'operator':
        raise ValueError('External steering currently requires an operator')
    if action == 'set-autonomy':
        if set(parameters) != {'autonomy'}:
            raise ValueError('set-autonomy requires only autonomy')
        parameters['autonomy'] = _autonomy(parameters['autonomy'])
    if action == 'choose' and (set(parameters) != {'proposal_id'} or not parameters['proposal_id']):
        raise ValueError('Choose requires a proposal_id')
    if action == 'prefer-emitter' and (set(parameters) != {'emitter'} or
                                      parameters['emitter'] not in ('sobol', 'local', 'topology')):
        raise ValueError('Select one known proposal emitter')
    if action in ('pause', 'resume', 'review', 'approve-plan') and parameters:
        raise ValueError(f'{action} takes no parameters')
    if action == 'pet-name':
        if not parameters.get('name') or not parameters.get('target') or not parameters.get('proposal_id'):
            raise ValueError('Pet-name needs a proposal, target and name')
        if parameters.get('mode','entity') not in ('entity','location'):
            raise ValueError('Pet-name mode must be entity or location')
    if action == 'o-takiage' and bool(parameters.get('name')) == bool(parameters.get('branch')):
        raise ValueError('O-takiage needs exactly one name or branch')
    base = Path(session_path)
    if not base.exists():
        raise FileNotFoundError('Initialize the OODA run before sending controls')
    snapshot = json.loads(base.read_text(encoding='utf8'))
    if snapshot.get('schema') != SCHEMA:
        raise ValueError('Not an OODA-HA session')
    if snapshot.get('status') == 'completed':
        raise ValueError('This OODA session has completed; start a new location epoch')
    request = {'schema': 'projection-loom/ooda-ha-control/v1', 'id': f'{time_ns():020d}-{uuid4().hex}',
               'run_id': snapshot['run_id'], 'actor': actor, 'action': action,
               'parameters': parameters}
    inbox = base.parent / 'controls' / 'inbox'
    inbox.mkdir(parents=True, exist_ok=True)
    target = inbox / (request['id'] + '.json')
    with target.open('x', encoding='utf8') as f:
        json.dump(request, f, indent=2, allow_nan=False)
        f.write('\n')
    return request


@contextmanager
def single_runner(session_path):
    """Prevent two processes from concurrently advancing one checkpoint."""
    lock = Path(session_path).with_suffix('.runlock')
    try:
        fd = os.open(lock, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
    except FileExistsError as exc:
        raise RuntimeError('This OODA session already has a runner; do not concurrently resume') from exc
    try:
        with os.fdopen(fd, 'w') as f:
            f.write(str(os.getpid()))
        yield
    finally:
        lock.unlink(missing_ok=True)


class OODAJournal:
    """Persist validated transitions, nested loops and operator interventions."""
    def __init__(self, path, *, identity=None, initial=None, autonomy=.70):
        self.path = Path(path)
        self.path.parent.mkdir(parents=True, exist_ok=True)
        if self.path.exists():
            data = json.loads(self.path.read_text(encoding='utf8'))
            signature = data.get('snapshot_sha256')
            if signature != _hash({k:v for k,v in data.items() if k != 'snapshot_sha256'}):
                raise ValueError('OODA journal digest mismatch')
            if data.get('schema') != SCHEMA:
                raise ValueError('Unknown OODA session schema')
            if identity is not None and data['identity'] != identity:
                raise ValueError('Incompatible OODA session; fork to change sources, code or budgets')
            self.data = data
        else:
            if identity is None or initial is None:
                raise ValueError('A new session requires identity and initial genome')
            auto = _autonomy(autonomy)
            self.data = {'schema': SCHEMA, 'identity': identity,
                         'run_id': _fingerprint(identity),
                         'policy': {'autonomy': auto, 'preferred_emitter': None},
                         'status': 'running', 'awaiting': None, 'paused_reason': None,
                         'loops': {}, 'events': [], 'applied_controls': {},
                         'current_epoch': 0, 'current_genome': dict(initial),
                         'passes': []}
            self.begin('location', parent=None, scope='location',
                       evidence={'location': identity['location']})
            self.transition('location', 'orient', {'evidence_state': identity['score_state']})
            self.transition('location', 'decide', {'policy': control_mode(auto)})
            self.transition('location', 'act', {'plan': 'delegate bounded constructive epochs'})
            self.save()

    def save(self):
        self.data['snapshot_sha256'] = _hash({k:v for k,v in self.data.items() if k != 'snapshot_sha256'})
        _atomic(self.path, self.data)

    def event(self, kind, loop_id=None, **detail):
        e = {'seq': len(self.data['events']) + 1, 'kind': kind,
             'loop': loop_id, **detail}
        self.data['events'].append(e)
        return e

    def begin(self, loop_id, *, parent, scope, evidence):
        if loop_id in self.data['loops']:
            return self.data['loops'][loop_id]
        if parent is not None:
            p = self.data['loops'].get(parent)
            if p is None or p['phase'] != 'act':
                raise ValueError('A nested OODA loop must grow under an active parent Act')
            p['children'].append(loop_id)
        self.data['loops'][loop_id] = {'id': loop_id, 'parent': parent,
            'scope': scope, 'phase': 'observe', 'children': [],
            'receipts': {'observe': evidence}}
        self.event('phase', loop_id, phase='observe', detail=evidence)
        return self.data['loops'][loop_id]

    def transition(self, loop_id, phase, detail=None):
        if phase not in PHASES:
            raise ValueError('Unknown OODA-HA phase')
        node = self.data['loops'][loop_id]
        prior = PHASES.index(node['phase'])
        target = PHASES.index(phase)
        if target == prior:
            return False
        if target != prior + 1:
            raise ValueError(f'Illegal OODA-HA phase transition: {node["phase"]} -> {phase}')
        if phase == 'closed' and any(self.data['loops'][x]['phase'] != 'closed'
                                     for x in node['children']):
            raise ValueError('A parent cannot close while child loops remain open')
        node['phase'] = phase
        node['receipts'][phase] = detail if detail is not None else {}
        self.event('phase', loop_id, phase=phase, detail=node['receipts'][phase])
        self.save()
        return True

    def candidate_start(self, epoch_id, proposal):
        """The candidate enters Act *before* CAD growth and scoring begin."""
        loop_id = epoch_id + '/' + proposal.id
        if loop_id not in self.data['loops']:
            self.begin(loop_id, parent=epoch_id, scope='candidate',
                       evidence={'proposal':proposal.id,'parent':proposal.parent})
        node = self.data['loops'][loop_id]
        if node['phase'] == 'observe':
            self.transition(loop_id, 'orient', {'emitter':proposal.emitter,
                'evidence_state':self.data['identity']['score_state']})
        if node['phase'] == 'orient':
            self.transition(loop_id, 'decide', {'scheduled':True,
                'decision':'perform a strict CAD/void audition'})
        if node['phase'] == 'decide':
            self.transition(loop_id, 'act', {'action':'grow, audit, possibly score'})
        if node['phase'] not in ('act','closed'):
            raise ValueError('Candidate cannot evaluate outside its Act')
        self.save()

    def candidate_receipt(self, epoch_id, proposal, result):
        """Close the candidate's actual Act and preserve its Aftermath."""
        self.candidate_start(epoch_id, proposal)
        loop_id=epoch_id+'/'+proposal.id
        if self.data['loops'][loop_id]['phase']=='act':
            self.transition(loop_id, 'aftermath',
                {'outcome':result['state'],'loss':result.get('combined_loss'),
                 'reason':result.get('reason'),
                 'valid':bool(result.get('audit',{}).get('valid',False))})
            self.transition(loop_id, 'closed')

    def wait(self, reason, *, epoch_id, options=()):
        self.data['status'] = 'awaiting_operator'
        self.data['awaiting'] = {'kind': reason, 'loop': epoch_id, 'options': list(options)}
        self.event('operator-checkpoint', epoch_id, reason=reason,
                   options=list(options), autonomy=self.autonomy)
        self.save()

    @property
    def autonomy(self):
        return self.data['policy']['autonomy']

    def poll(self):
        """Apply queued commands once, at phase/candidate safe points."""
        inbox = self.path.parent/'controls'/'inbox'
        for path in sorted(inbox.glob('*.json')):
            raw = path.read_bytes()
            digest = sha256(raw).hexdigest()
            item = json.loads(raw)
            key = item['id']
            if key in self.data['applied_controls']:
                if self.data['applied_controls'][key] != digest:
                    raise ValueError('Previously applied control was altered')
                continue
            if item.get('run_id') != self.data['run_id'] or item.get('actor') != 'operator':
                raise ValueError('Control belongs to another run or unauthorized actor')
            action, args = item['action'], item.get('parameters', {})
            waiting = self.data['awaiting']
            if action in ('pet-name','o-takiage','choose') and (waiting is None or waiting['kind'] != 'review'):
                # A future-directed intervention may arrive before a preview
                # exists. Request a review and defer this action; process later
                # pause/mode controls instead of deadlocking the inbox.
                self.data['force_review'] = True
                self.save()
                continue
            if action == 'pause':
                self.data['status'] = 'paused'
                self.data['paused_reason'] = 'operator pause requested'
            elif action == 'review':
                self.data['force_review'] = True
            elif action == 'resume':
                if waiting is not None:
                    raise ValueError('Resolve the operator checkpoint before resuming')
                self.data['status'] = 'running'
                self.data['paused_reason'] = None
            elif action == 'set-autonomy':
                self.data['policy']['autonomy'] = _autonomy(args['autonomy'])
                # The operator can release a pending review by a deliberate
                # increase in autonomy; record the transfer of control.
                if waiting is not None and self.autonomy >= .60 and waiting['kind']=='review':
                    self.data['awaiting'] = None
                    self.data['status'] = 'running'
                elif waiting is not None and self.autonomy >= .25 and waiting['kind']=='plan':
                    self.data['awaiting'] = None
                    self.data['status'] = 'running'
            elif action == 'prefer-emitter':
                self.data['policy']['preferred_emitter'] = args['emitter']
            elif action == 'approve-plan':
                if waiting is None or waiting['kind'] != 'plan':
                    raise ValueError('No plan awaits approval')
                self.data['loops'][waiting['loop']]['plan_approved'] = True
                self.data['awaiting'] = None
                self.data['status'] = 'running'
            elif action in ('pet-name','o-takiage'):
                from .relations import PetNameLedger, RelationWitness
                review = self.data['loops'][waiting['loop']].get('options', [])
                match = next((o for o in review if o['proposal_id']==args.get('proposal_id')), None)
                witness = RelationWitness.load(match['witness']) if match is not None else None
                if action == 'pet-name' and witness is None:
                    raise ValueError('Pet-name needs an audited proposal preview witness')
                if action == 'o-takiage' and args.get('branch') and witness is None:
                    raise ValueError('Branch release needs an audited proposal witness')
                path = Path(self.data['identity']['ledger_path'])
                ledger = PetNameLedger.load(path) if path.exists() else PetNameLedger(
                    location=self.data['identity']['location'])
                if ledger.location != self.data['identity']['location']:
                    raise ValueError('Pet-name ledger belongs to another location')
                if action == 'pet-name':
                    claim = ledger.pet_name(args['name'],args['target'],witness,
                        mode=args.get('mode','entity'), has=args.get('has',()),
                        member_has=args.get('member_has',()), retain=args.get('retain',.4))
                    outcome = {'claim_id':claim['claim_id'],'name':claim['name']}
                else:
                    outcome = ledger.o_takiage(name=args.get('name'),
                                              branch=args.get('branch'),witness=witness)
                ledger.save(path)
                self.event('lineage-intervention',waiting['loop'],action=action,
                           result=outcome, witness_id=witness.witness_id if witness else None)
            elif action == 'choose':
                if waiting is None or waiting['kind'] != 'review':
                    raise ValueError('No preview review awaits an operator choice')
                if args['proposal_id'] not in waiting['options']:
                    raise ValueError('Selected proposal is not in the audited preview options')
                self.data['operator_choice'] = args['proposal_id']
                self.data['loops'][waiting['loop']]['reviewed'] = True
                self.data['awaiting'] = None
                self.data['status'] = 'running'
            else:
                raise ValueError(f'Unrecognized control: {action}')
            self.data['applied_controls'][key] = digest
            self.event('operator-control', None, action=action, parameters=args,
                       control_id=key, actor=item['actor'])
            self.save()
        return self.data['status'] == 'running' and self.data['awaiting'] is None

    def summary(self):
        waiting = self.data['awaiting']
        reviewed = self.data['loops'].get(waiting['loop'],{}) if waiting else {}
        return {'schema': SCHEMA, 'run_id': self.data['run_id'],
                'status': self.data['status'], 'awaiting': waiting,
                'plan_card': {k: reviewed.get('receipts',{}).get(k,{}) for k in ('observe','orient','decide')}
                     if waiting and waiting['kind']=='plan' else None,
                'review_cards': reviewed.get('options',[]) if waiting and waiting['kind']=='review' else [],
                'adviser_suggestion': reviewed.get('adviser_choice') if waiting else None,
                'autonomy': self.autonomy, 'mode': control_mode(self.autonomy),
                'completed_epochs': self.data['current_epoch'],
                'passes': self.data['passes'], 'selected_genome': self.data['current_genome'],
                'session': str(self.path), 'identity_ledger': self.data['identity']['ledger_path'],
                'events': len(self.data['events'])}


def _source_hashes(project, location_stack):
    hashes = ({'image': sha256(project.reference.read_bytes()).hexdigest()}
              if project.reference else {})
    if location_stack is not None:
        location_stack.audit()
        location_stack.verify_source_bytes()
        if location_stack.location_id != project.location:
            raise ValueError('Source location does not match project')
        hashes.update({'location:' + name: source.sha256
                       for name, source in location_stack.sources.items()})
        hashes['location-snapshot'] = location_stack.to_dict()['snapshot_sha256']
    return hashes


def _previews(project, run, epoch_index, folder, *, limit=4):
    """Regrow *audited* elites for operator viewing; never use previews as evidence."""
    from .evolution import Evolution
    from .render import silhouette
    folder.mkdir(parents=True, exist_ok=True)
    # A selection preview may include a scored alternative that lost its
    # quality-diversity niche. The operator, not the niche winner, may recognize
    # an architectural surprise worth carrying onward. Invalid/unscored forms
    # cannot enter this list.
    scored = []
    for pid, result in run.data['results'].items():
        if result['state'] != 'scored':
            continue
        scored.append({'proposal_id': pid,
                       'combined_loss':result['combined_loss'],
                       'genome':run.data['proposals'][pid]['genome'],
                       'niche':result['niche'],
                       'emitter':run.data['proposals'][pid]['emitter']})
    scored.sort(key=lambda x:(x['combined_loss'],x['proposal_id']))
    elites=[]
    if scored:
        elites.append(scored.pop(0))
    while scored and len(elites)<limit:
        niches={x['niche'] for x in elites}
        emitters={x['emitter'] for x in elites}
        scored.sort(key=lambda x:(x['niche'] in niches,x['emitter'] in emitters,
                                  x['combined_loss'],x['proposal_id']))
        elites.append(scored.pop(0))
    archive_ids={x['proposal_id'] for x in run.data['archive'].values()}
    evo = Evolution(project, size=(192, 288), seed=41)
    options = []
    for elite in elites:
        candidate = project.grow(elite['genome'])
        audit = candidate.audit(join=True)
        if not audit['valid'] or audit.get('union_solids') != 1 or not audit.get('union_valid'):
            raise RuntimeError('Audited elite failed to regrow for the preview')
        mesh = candidate.tessellate(linear=.35, angular=.3, union=True)
        mask = silhouette(mesh, evo.reference_camera, evo.size) > 96
        rgba = np.zeros((evo.size[1], evo.size[0], 4), dtype=np.uint8)
        rgba[mask] = [196, 212, 232, 255]
        stem = elite['proposal_id']
        Image.fromarray(rgba, 'RGBA').save(folder/(stem + '.png'))
        witness = candidate.relation_witness(location=project.location)
        witness.save(folder/(stem + '.relations.json'))
        _atomic(folder/(stem + '.genome.json'), {'genome': elite['genome']})
        options.append({'proposal_id': stem, 'loss': elite['combined_loss'],
                        'emitter': elite['emitter'],
                        'archive_elite': stem in archive_ids,
                        'niche': elite['niche'],
                        'preview': str(folder/(stem + '.png')),
                        'witness': str(folder/(stem + '.relations.json')),
                        'genome': str(folder/(stem + '.genome.json')),
                        'evidence_state': run.score_state})
    _atomic(folder/'review.json', {'epoch': epoch_index + 1, 'options': options,
        'authority': 'Preview is a visualization of an audited CAD candidate, not source evidence'})
    return options


def _preferred_choice(options, preferred_emitter, autonomy):
    if not options:
        return None
    champion = options[0]
    if preferred_emitter:
        viable = [x for x in options if x['emitter'] == preferred_emitter and
                  x['loss'] <= champion['loss'] + .04*(1-autonomy)]
        if viable:
            return viable[0]['proposal_id']
    return champion['proposal_id']


def run_ooda_epochs(project, output, *, passes=3, candidates=9,
                    exact_budget=6, detail_budget=3, seed=41,
                    topology_loci=(), autonomy=.70, ledger_path=None,
                    location_stack=None, adviser=None):
    """Execute fractal OODA-HA over real staged CAD epochs, with safe pauses.

    Re-enter using precisely the same evidence, code and budgets.  The journal
    and per-epoch CAD checkpoints supply durability; operator controls are
    applied at defined safe points.  An optional adviser callback supplies a
    *suggestion* from reviewed valid options, never a CAD validity override.
    """
    if passes < 1 or candidates < 1 or exact_budget < 1 or detail_budget < 1:
        raise ValueError('All OODA budgets must be positive')
    if detail_budget > exact_budget:
        raise ValueError('Detail budget cannot exceed exact audit budget')
    out = Path(output)
    out.mkdir(parents=True, exist_ok=True)
    # The ledger path belongs to the run identity even before a pet-name is
    # authored. Creating that file during Aftermath needs no session migration.
    ledger_path = Path(ledger_path).resolve() if ledger_path else (out/'identity-ledger.json').resolve()
    identity = {'location': project.location, 'source_digests': _source_hashes(project, location_stack),
                'construction_digest': project_code_digest(project),
                'score_state': 'provisional' if project.reference else 'synthetic',
                'passes': passes, 'candidates': candidates, 'exact_budget': exact_budget,
                'detail_budget': detail_budget, 'seed': seed,
                'topology_loci': sorted(set(topology_loci)),
                'ledger_path': str(ledger_path)}
    with single_runner(out/'session.json'):
        journal = OODAJournal(out/'session.json', identity=identity,
                              initial=project.initial, autonomy=autonomy)
        journal.poll()
        if journal.data['status'] == 'completed':
            return journal.summary()
        if journal.data['status'] != 'running':
            return journal.summary()
        for i in range(journal.data['current_epoch'], passes):
            if not journal.poll():
                break
            loop_id = f'epoch-{i+1:04d}'
            current = dict(journal.data['current_genome'])
            if loop_id not in journal.data['loops']:
                journal.begin(loop_id, parent='location', scope='epoch', evidence={
                    'epoch': i+1, 'previous_genome': current,
                    'source_digests': identity['source_digests']})
                journal.save()
            node = journal.data['loops'][loop_id]
            if node['phase'] == 'observe':
                journal.transition(loop_id, 'orient', {
                    'available_methods': ['sobol', 'local', 'topology'],
                    'budgets': {'exact': exact_budget, 'detail': detail_budget},
                    'registration': identity['score_state']})
            if node['phase'] == 'orient':
                journal.transition(loop_id, 'decide', {
                    'sampling_seed': seed + i, 'candidates': candidates,
                    'topology_loci': list(topology_loci),
                    'recommendation': 'bounded multi-emitter CAD auditions'})
            if node['phase'] == 'decide':
                if journal.autonomy < .25 and not node.get('plan_approved'):
                    if journal.data['awaiting'] is None:
                        journal.wait('plan', epoch_id=loop_id)
                    journal.poll()
                    if journal.data['awaiting'] is not None or journal.data['status'] != 'running':
                        break
                    node['plan_approved'] = True
                    journal.save()
                journal.transition(loop_id, 'act', {'operation': 'grow, audit and score candidates'})
            if node['phase'] == 'act':
                from .relations import PetNameLedger
                ledger = PetNameLedger.load(ledger_path) if ledger_path and Path(ledger_path).exists() else None
                ledger_digest = sha256(Path(ledger_path).read_bytes()).hexdigest() if ledger else None
                frozen = node.get('ledger_digest', ledger_digest)
                if frozen != ledger_digest:
                    raise ValueError('Pet-name ledger changed during epoch Act; apply updates after review')
                node['ledger_digest'] = frozen
                journal.save()
                batch = propose_methods(project.bounds, current, seed=seed+i, count=candidates,
                                        topology_loci=topology_loci)
                score, state = project_silhouette_score(project)
                runner = WideEpoch(location=project.location,
                                   source_digests=identity['source_digests'],
                                   construction_digest=identity['construction_digest'],
                                   objectives=('silhouette',),score_state=state,
                                   checkpoint=out/f'epoch_{i+1:03d}.json',
                                   max_exact=exact_budget,max_detail=detail_budget,
                                   seed=seed+i,pet_ledger=ledger)
                root_initial = dict(project.initial)
                def preview(genome):
                    return sum(((genome[k] - root_initial[k]) /
                        (project.bounds[k][1] - project.bounds[k][0]))**2
                        for k in project.bounds)/len(project.bounds)
                def before(proposal):
                    journal.candidate_start(loop_id, proposal)
                def after(proposal, result):
                    journal.candidate_receipt(loop_id, proposal, result)
                    journal.save()
                def go():
                    return journal.poll()
                data = runner.run(batch,grow=project.grow,score=score,preview=preview,
                                  before_candidate=before,after_candidate=after,
                                  should_continue=go)
                # Recover missing micro-loop receipts after a process crash
                # between the CAD checkpoint and journal acknowledgement.
                lookup = {p.id:p for p in batch}
                for candidate_id, result in data['results'].items():
                    if result['state'] not in ('deferred',):
                        journal.candidate_receipt(loop_id, lookup[candidate_id], result)
                journal.save()
                if journal.data['status'] != 'running':
                    break
                # The epoch Act ends only after every budgeted audition has a
                # persistent result; a pause leaves it open for reentry.
                if not runner.completed(batch, preview=preview):
                    break
                options = _previews(project, runner, i, out/f'previews/epoch_{i+1:03d}',
                                    limit=4 if journal.autonomy < .9 else 2)
                node['options'] = options
                journal.transition(loop_id, 'aftermath', {
                    'auditioned': sum(r['state'] not in ('deferred',) for r in data['results'].values()),
                    'scored': sum(r['state'] == 'scored' for r in data['results'].values()),
                    'options': options, 'errors': sum(r['state'] == 'error' for r in data['results'].values())})
            if node['phase'] == 'aftermath':
                if not journal.poll():
                    break
                options = node.get('options', [])
                # External AI advisers can participate through a narrow,
                # source-grounded suggestion interface. The CLI itself uses a
                # deterministic loss heuristic; it makes no LLM connection.
                if adviser is not None and not node.get('adviser_consulted'):
                    suggestion = adviser({'location': project.location, 'epoch': i+1,
                        'options': [dict(x) for x in options],
                        'evidence_state': identity['score_state'],
                        'autonomy': journal.autonomy})
                    node['adviser_consulted'] = True
                    if suggestion is not None:
                        if (not isinstance(suggestion, dict) or
                                suggestion.get('proposal_id') not in [x['proposal_id'] for x in options]):
                            raise ValueError('Adviser suggested a candidate outside the validated preview archive')
                        node['adviser_choice'] = suggestion['proposal_id']
                        journal.event('adviser-suggestion',loop_id,
                            proposal_id=suggestion['proposal_id'],
                            reason=str(suggestion.get('reason',''))[:1000])
                    journal.save()
                # Honor a human intervention even if it arrived while previews
                # or external advice were being prepared, before auto-selection.
                if not journal.poll():
                    break
                if (journal.autonomy < .60 or journal.data.get('force_review')) and options and not node.get('reviewed'):
                    if journal.data['awaiting'] is None:
                        journal.wait('review', epoch_id=loop_id,
                                     options=[x['proposal_id'] for x in options])
                    journal.poll()
                    if journal.data['awaiting'] is not None or journal.data['status'] != 'running':
                        break
                selected = journal.data.pop('operator_choice', None)
                if selected is None:
                    selected = _preferred_choice(options,
                        journal.data['policy']['preferred_emitter'], journal.autonomy)
                    advised = node.get('adviser_choice')
                    candidate = next((o for o in options if o['proposal_id'] == advised),None)
                    if (candidate is not None and options and
                            candidate['loss'] <= options[0]['loss'] + .04*(1-journal.autonomy)):
                        selected = advised
                if selected is not None:
                    chosen = next((x for x in options if x['proposal_id']==selected), None)
                    if chosen is None:
                        raise ValueError('The operator choice no longer belongs to the audited archive')
                    current = json.loads(Path(chosen['genome']).read_text())['genome']
                node['reviewed'] = True
                journal.data['force_review'] = False
                record = {'epoch':i+1,'selected_proposal':selected,
                          'source_evidence':identity['score_state'],
                          'parent_genome':current, 'options':len(options)}
                journal.data['current_genome'] = dict(current)
                journal.data['passes'].append(record)
                journal.data['current_epoch'] = i+1
                journal.event('next-bearing',loop_id,selected=selected,
                               accepted_genome=dict(current))
                journal.transition(loop_id, 'closed')
                journal.save()
        if journal.data['current_epoch'] == passes and journal.data['status'] == 'running':
            journal.transition('location', 'aftermath', {
                'epochs':passes,'selected_genome':journal.data['current_genome']})
            journal.transition('location', 'closed')
            journal.data['status']='completed'
            journal.save()
        _atomic(out/'status.json',journal.summary())
        return journal.summary()
