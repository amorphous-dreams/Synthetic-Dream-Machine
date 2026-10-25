"""Fractal OODA-HA as an executable, nested, human-steerable workflow.

A location contains epoch loops; each epoch contains actual evaluated candidate
loops. Any active phase may also open a subordinate inquiry, which must finish
before its anchoring parent phase can advance. The five phases are guarded state
transitions, not descriptive tags.
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
import numpy as np

from .epochs import CandidateAdapter, WideEpoch, propose_methods, project_code_digest, project_silhouette_score
from .epochs import _hash, _atomic
from .review import render_cad_review, render_compound_review
from .gallery import regrow_compound_gallery, regrow_lineage_gallery
from .campaign import FAMILY_FOCUSES, LineageArchive, make_brood, visual_descriptor
from .search_strategy import SurrogatePreview, regional_loss, adaptive_priorities, emitter_performance, multiscale_source_loss
from .phase_rules import PHASES, next_phase_allowed, child_phase_anchor
from .provenance_encoding import canonical_json_sha256
from .evidence_receipts import OperatorPreferenceReceipt

SCHEMA = 'projection-loom/ooda-ha-session/v2'
CONTROL_SCHEMA = 'projection-loom/ooda-ha-control/v2'
DEFAULT_MAX_DEPTH = 12
DEFAULT_MAX_LOOPS = 4096


def _fingerprint(value):
    return canonical_json_sha256(value)


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
               'choose', 'prefer-emitter', 'pet-name', 'o-takiage',
               'open-inquiry', 'advance-inquiry'}
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
    if action == 'open-inquiry':
        if (set(parameters) != {'parent_loop', 'question'} or
                not isinstance(parameters['parent_loop'], str) or
                not isinstance(parameters['question'], str) or
                not parameters['question'].strip() or len(parameters['question']) > 4096):
            raise ValueError('Open inquiry requires a parent_loop and a bounded question')
    if action == 'advance-inquiry':
        if (set(parameters) != {'loop_id', 'phase', 'detail'} or
                parameters['phase'] not in PHASES[1:] or
                not isinstance(parameters['detail'], dict) or
                len(json.dumps(parameters['detail'], allow_nan=False)) > 8192):
            raise ValueError('Advance inquiry requires a next phase and a bounded detail dictionary')
    base = Path(session_path)
    if not base.exists():
        raise FileNotFoundError('Initialize the OODA run before sending controls')
    snapshot = json.loads(base.read_text(encoding='utf8'))
    if snapshot.get('schema') != SCHEMA:
        raise ValueError('Not an OODA-HA session')
    if snapshot.get('status') == 'completed':
        raise ValueError('This OODA session has completed; start a new location epoch')
    request = {'schema': CONTROL_SCHEMA, 'id': f'{time_ns():020d}-{uuid4().hex}',
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
    def __init__(self, path, *, identity=None, initial=None, autonomy=.70,
                 max_depth=DEFAULT_MAX_DEPTH, max_loops=DEFAULT_MAX_LOOPS):
        if (isinstance(max_depth, bool) or not isinstance(max_depth, int) or max_depth < 1 or
                isinstance(max_loops, bool) or not isinstance(max_loops, int) or max_loops < 1):
            raise ValueError('Finite positive OODA depth and loop budgets are required')
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
            if data.get('limits') != {'max_depth': max_depth, 'max_loops': max_loops}:
                raise ValueError('OODA recursion budget changed; fork rather than replay')
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
                         'limits': {'max_depth':max_depth, 'max_loops':max_loops},
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

    def begin(self, loop_id, *, parent, scope, evidence, parent_phase=None):
        """Open a real child beneath *any* active parent phase.

        A child carries an immutable phase anchor; the parent may not leave
        that phase until the child completes. Re-entry by loop_id is idempotent.
        The parent remains authoritative over the original task and controls.
        """
        if not isinstance(loop_id, str) or not loop_id or not isinstance(scope, str) or not scope:
            raise ValueError('Every loop needs a nonempty identifier and scope')
        existing = self.data['loops'].get(loop_id)
        if existing is not None:
            if existing['parent'] != parent or existing['scope'] != scope:
                raise ValueError('Loop id already names another parent or scope')
            return existing
        if len(self.data['loops']) >= self.data['limits']['max_loops']:
            raise ValueError('OODA loop budget reached; choose a new bounded session')
        parent_phase, depth = child_phase_anchor(
            self.data['loops'], parent, parent_phase=parent_phase,
            max_depth=self.data['limits']['max_depth'])
        # Verify the evidence is serializable *before* mutating the parent.
        _hash(evidence)
        node = {'id': loop_id, 'parent': parent, 'parent_phase': parent_phase,
                'depth': depth, 'scope': scope, 'phase': 'observe',
                'children': [], 'receipts': {'observe': evidence}}
        self.data['loops'][loop_id] = node
        if parent is not None:
            self.data['loops'][parent]['children'].append(loop_id)
        self.event('phase', loop_id, phase='observe', detail=evidence,
                   parent_phase=parent_phase)
        self.save()
        return node

    def transition(self, loop_id, phase, detail=None):
        """Advance only after every child anchored to this phase has closed."""
        if not next_phase_allowed(self.data['loops'], loop_id, phase):
            return False
        node = self.data['loops'][loop_id]
        receipt = detail if detail is not None else {}
        _hash(receipt)
        node['phase'] = phase
        node['receipts'][phase] = receipt
        self.event('phase', loop_id, phase=phase, detail=receipt)
        if phase == 'closed' and node['parent'] is not None:
            self.event('child-return', node['parent'], child=loop_id,
                       anchor=node['parent_phase'], outcome=receipt)
        self.save()
        return True

    def open_inquiry(self, parent_loop, question, *, loop_id=None):
        """Let an Operator/AI investigation interrupt any active phase.

        A prior preview/plan checkpoint remains underneath this inquiry. An
        inquiry never certifies CAD or modifies previously scored candidates.
        """
        parent = self.data['loops'].get(parent_loop)
        if parent is None or parent['phase'] == 'closed':
            raise ValueError('Inquiry requires a currently active parent')
        if not isinstance(question, str) or not question.strip() or len(question) > 4096:
            raise ValueError('Inquiry question must contain bounded text')
        if loop_id is None:
            loop_id = f'{parent_loop}/inquiry-{len(parent["children"])+1:04d}'
        existed = loop_id in self.data['loops']
        node = self.begin(loop_id, parent=parent_loop, scope='inquiry', evidence={
            'question': question, 'anchor': parent['phase']})
        if existed and node['phase'] == 'closed':
            return node  # Idempotent control replay never reopens a completed loop.
        if 'return_to' not in node:
            node['return_to'] = self.data['awaiting']
        self.data['awaiting'] = {'kind':'inquiry','loop':loop_id,
                                 'parent':parent_loop, 'anchor':node['parent_phase'],
                                 'question':question}
        self.data['status'] = 'awaiting_operator'
        if not existed:
            self.event('inquiry-open',loop_id,parent=parent_loop,
                       anchor=node['parent_phase'],question=question)
        self.save()
        return node

    def advance_inquiry(self, loop_id, phase, detail=None):
        """Carry one inquiry phase with an explicit operator/AI receipt."""
        node = self.data['loops'].get(loop_id)
        if node is None or node['scope'] != 'inquiry':
            raise ValueError('Only an inquiry may advance with inquiry controls')
        if phase not in PHASES[1:]:
            raise ValueError('Inquiry phase must follow Observe')
        if node['phase'] == phase and node['receipts'].get(phase) == (detail or {}):
            # A crash between transition persistence and control acknowledgement
            # must not duplicate the operation or replay the side effect.
            return node
        if self.data['awaiting'] is None or self.data['awaiting'].get('loop') != loop_id:
            raise ValueError('The requested inquiry is not the active checkpoint')
        self.transition(loop_id, phase, detail)
        if phase == 'closed':
            self.data['awaiting'] = node['return_to']
            self.data['status'] = 'awaiting_operator' if node['return_to'] else 'running'
            self.event('inquiry-return',node['parent'],child=loop_id,
                       anchor=node['parent_phase'], outcome=detail or {})
        self.save()
        return node

    def consult_phase(self, loop_id, adviser=None):
        """Optional AI/Operator phase adviser proposes bounded *child inquiry*.

        The adviser cannot mutate the parent, certify evidence, or skip a gate.
        A question causes a durable operator checkpoint before the phase moves.
        The phase consultation and its deterministic child ID survive re-entry.
        """
        if adviser is None:
            return self.poll()
        node = self.data['loops'][loop_id]
        phase = node['phase']
        if phase in ('closed',):
            return self.poll()
        consulted = node.setdefault('consulted_phases', [])
        if phase in consulted:
            return self.poll()
        child_id = f'{loop_id}/consult-{phase}'
        if child_id not in self.data['loops']:
            response = adviser({'loop_id':loop_id, 'scope':node['scope'],
                                'phase':phase, 'parent_phase':node['parent_phase'],
                                'autonomy':self.autonomy,
                                'evidence':node['receipts'].get(phase,{})})
            if response is not None:
                if (not isinstance(response,dict) or set(response) != {'question'} or
                        not isinstance(response['question'],str) or
                        not response['question'].strip()):
                    raise ValueError('Phase adviser may only propose one bounded inquiry question')
                self.open_inquiry(loop_id,response['question'],loop_id=child_id)
        consulted.append(phase)
        self.save()
        return self.poll()

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
            if (item.get('schema') != CONTROL_SCHEMA or
                    item.get('run_id') != self.data['run_id'] or item.get('actor') != 'operator'):
                raise ValueError('Control belongs to another run, schema, or unauthorized actor')
            action, args = item['action'], item.get('parameters', {})
            if action in ('choose', 'prefer-emitter', 'set-autonomy'):
                OperatorPreferenceReceipt.from_control(item)
            waiting = self.data['awaiting']
            if action in ('pet-name','o-takiage','choose') and (waiting is None or waiting['kind'] != 'review'):
                # A future-directed intervention may arrive before a preview
                # exists. Request a review and defer this action; process later
                # pause/mode controls instead of deadlocking the inbox.
                self.data['force_review'] = True
                self.save()
                continue
            if action == 'open-inquiry':
                self.open_inquiry(args['parent_loop'], args['question'],
                                  loop_id=f'{args["parent_loop"]}/inquiry-{key}')
            elif action == 'advance-inquiry':
                self.advance_inquiry(args['loop_id'], args['phase'], args['detail'])
            elif action == 'pause':
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
                path = Path(self.data['identity']['ledger_path'])
                ledger = PetNameLedger.load(path) if path.exists() else PetNameLedger(
                    location=self.data['identity']['location'])
                if ledger.location != self.data['identity']['location']:
                    raise ValueError('Pet-name ledger belongs to another location')
                committed = ledger.control_receipt(key, digest)
                if committed is not None:
                    # A crash after ledger persistence but before journal
                    # acknowledgement must never re-execute the operator action.
                    if committed['action'] != action:
                        raise ValueError('Operator control action mismatch on replay')
                    outcome = committed['control_outcome']
                    witness_id = committed.get('witness_id')
                else:
                    review = self.data['loops'][waiting['loop']].get('options', [])
                    match = next((o for o in review if o['proposal_id']==args.get('proposal_id')), None)
                    witness = RelationWitness.load(match['witness']) if match is not None else None
                    if action == 'pet-name' and witness is None:
                        raise ValueError('Pet-name needs an audited proposal preview witness')
                    if action == 'o-takiage' and args.get('branch') and witness is None:
                        raise ValueError('Branch release needs an audited proposal witness')
                    if action == 'pet-name':
                        claim = ledger.pet_name(args['name'],args['target'],witness,
                            mode=args.get('mode','entity'), has=args.get('has',()),
                            member_has=args.get('member_has',()), retain=args.get('retain',.4))
                        outcome = {'claim_id':claim['claim_id'],'name':claim['name']}
                    else:
                        outcome = ledger.o_takiage(name=args.get('name'),
                                                  branch=args.get('branch'),witness=witness)
                    witness_id = witness.witness_id if witness else None
                    outcome = ledger.commit_control(key,digest,outcome)
                    ledger.save(path)
                self.event('lineage-intervention',waiting['loop'],action=action,
                           result=outcome, witness_id=witness_id)
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
                'events': len(self.data['events']),
                'gallery': self.data.get('gallery'),
                'inquiries': [{'id': n['id'], 'parent': n['parent'],
                               'parent_phase': n['parent_phase'], 'phase': n['phase'],
                               'depth': n['depth']}
                              for n in self.data['loops'].values()
                              if n['scope'] == 'inquiry' and n['phase'] != 'closed']}


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
                    location_stack=None, adviser=None, phase_adviser=None,
                    max_depth=DEFAULT_MAX_DEPTH, max_loops=DEFAULT_MAX_LOOPS,
                    recipe=None, registry=None, score_size=(128,192), finalists=3,
                    breeding=False, offspring_per_family=6,
                    migration_every=4, mutation_scale=.16,
                    feature_evidence_path=None, transfer_bundle_path=None):
    """One fractal OODA-HA controller for CAD and compound-capability epochs.

    Re-enter using precisely the same evidence, code and budgets.  The journal
    and per-epoch CAD checkpoints supply durability; operator controls are
    applied at defined safe points.  An optional adviser callback supplies a
    *suggestion* from reviewed valid options, never a CAD validity override.
    """
    if passes < 1 or candidates < 1 or exact_budget < 1 or detail_budget < 1:
        raise ValueError('All OODA budgets must be positive')
    if detail_budget > exact_budget:
        raise ValueError('Detail budget cannot exceed exact audit budget')
    if breeding:
        if recipe is None or not recipe.bounds:
            raise ValueError('Breeding requires a source-bound structural family recipe with all loci')
        if type(offspring_per_family) is not int or not 1 <= offspring_per_family <= 32:
            raise ValueError('Breeding offspring budget must be 1..32 per family')
        if type(migration_every) is not int or migration_every < 2:
            raise ValueError('Breeding migration interval must be at least two')
        if not math.isfinite(mutation_scale) or not 0 < mutation_scale <= .4:
            raise ValueError('Breeding mutation scale must be within (0,.4]')
        # The family population, not --candidates, determines birth count.
        candidates = len(FAMILY_FOCUSES) * offspring_per_family
    feature_evidence=None
    feature_sha=None
    if feature_evidence_path is not None:
        if not breeding or recipe is None or project.reference is None:
            raise ValueError('Feature annotations require source-bound breeding')
        from .feature_evidence import FeatureEvidence
        feature_evidence=FeatureEvidence.load(
            feature_evidence_path,
            source_sha256=sha256(project.reference.read_bytes()).hexdigest(),
            score_size=score_size)
        feature_sha=feature_evidence.digest
    transfers=()
    transfer_digest=None
    if transfer_bundle_path is not None:
        if not breeding or recipe is None:
            raise ValueError('Transfer bundles require a source-bound breeding recipe')
        from .genetic_transfer import verify_transfer_bundle
        payload=json.loads(Path(transfer_bundle_path).read_text(encoding='utf8'))
        transfers=tuple(verify_transfer_bundle(payload,
            target_recipe_sha256=recipe.sha256,target_bounds=recipe.bounds,
            family_focus=FAMILY_FOCUSES))
        transfer_digest=payload['sha256']
    out = Path(output)
    out.mkdir(parents=True, exist_ok=True)
    # The ledger path belongs to the run identity even before a pet-name is
    # authored. Creating that file during Aftermath needs no session migration.
    ledger_path = Path(ledger_path).resolve() if ledger_path else (out/'identity-ledger.json').resolve()
    compositor = None
    if recipe is not None:
        from .capability_stack import CapabilityCompositor
        from .calibration import freeze_display_camera
        from .render import silhouette
        if (len(score_size)!=2 or any(isinstance(x,bool) or not isinstance(x,int) or
               x<32 or x>1024 for x in score_size)):
            raise ValueError('Capability score viewport requires bounded width and height')
        if not 3<=finalists<=5:
            raise ValueError('Compound finale requires 3-5 requested survivors')
        source_hashes = _source_hashes(project,location_stack)
        if project.reference is not None:
            if recipe.source_hashes.get('image') != source_hashes['image']:
                raise ValueError('Compound recipe source digest differs from actual image bytes')
            source_mask = project.source_mask(score_size)
            camera = project.cameras[project.reference_view]
            if camera.fit != 'fixed':
                raise ValueError('External compound fitness needs fixed reference camera')
        else:
            source_mask = None
            seed_assembly = project.grow(recipe.cad_genome(recipe.initial))
            seed_audit = seed_assembly.audit(join=True)
            if not seed_audit['valid']:
                raise ValueError('Cannot freeze the reference-free viewport on invalid CAD')
            seed_mesh = seed_assembly.tessellate(linear=.35,angular=.3,union=True)
            camera = freeze_display_camera(project.cameras[project.reference_view],
                                           seed_mesh.vertices,score_size)
        compositor = CapabilityCompositor(project,recipe,registry=registry,camera=camera,
                           size=score_size,source_mask=source_mask)
        if source_mask is None:
            seed_build = compositor.grow(recipe.initial)
            source_mask = silhouette(seed_build.scene.render_mesh(),camera,score_size)>96
        if not recipe.source_hashes.items() <= source_hashes.items():
            raise ValueError('Compound source lineage references missing or changed witnesses')
        initial = dict(recipe.initial)
        bounds = recipe.bounds
        score_state = 'provisional' if project.reference is not None else 'synthetic'
        construction_digest = compositor.construction_digest()
        objectives = ('silhouette','prior','regional','macro','contour') if breeding else ('silhouette','prior')
        extra_topology = [step.activation for step in recipe.steps if step.activation]
        topology_loci = tuple(dict.fromkeys([*topology_loci,*extra_topology]))
    else:
        source_hashes = _source_hashes(project,location_stack)
        initial = dict(project.initial)
        bounds = project.bounds
        score_state = 'provisional' if project.reference else 'synthetic'
        construction_digest = project_code_digest(project)
        objectives = ('silhouette',)
    identity = {'location': project.location, 'source_digests': source_hashes,
                'construction_digest': construction_digest,
                'score_state': score_state, 'passes': passes, 'candidates': candidates,
                'exact_budget': exact_budget, 'detail_budget': detail_budget,
                'seed': seed, 'topology_loci': sorted(set(topology_loci)),
                'ledger_path': str(ledger_path),
                'feature_evidence_sha256':feature_sha,
                'transfer_bundle_sha256':transfer_digest}
    if compositor is not None:
        identity.update(capability_recipe_sha256=recipe.sha256,
              capability_operator_sha256=compositor.registry.fingerprint(),
              score_size=list(score_size),finalists=finalists)
    archive_identity = None
    if breeding:
        identity['breeding'] = {'families': list(FAMILY_FOCUSES),
                'offspring_per_family':offspring_per_family,
                'migration_every':migration_every,
                'mutation_scale':mutation_scale}
        archive_identity = {
            'source_digests':dict(source_hashes),
            'construction_digest':construction_digest,
            'recipe_sha256':recipe.sha256,
            'score_size':list(score_size),
            'seed':seed, 'breeding':identity['breeding'],
            'feature_evidence_sha256':feature_sha,
            'transfer_bundle_sha256':transfer_digest,
            'location':project.location}
    with single_runner(out/'session.json'):
        archive = (LineageArchive(out/'lineage_archive.json',identity=archive_identity)
                   if breeding else None)
        journal = OODAJournal(out/'session.json', identity=identity,
                              initial=initial, autonomy=autonomy,
                              max_depth=max_depth, max_loops=max_loops)
        def status_with_archive():
            result = journal.summary()
            if archive is not None:
                result.update(archive_identity=archive.identity,
                              archive_generation_count=archive.generation_count,
                              archive_unique_niches=len(archive.elites()),
                              lineage_gallery=journal.data.get('lineage_gallery'),
                              searchability=archive.census(bounds,activations=tuple(
                                  step.activation for step in recipe.steps if step.activation)))
            return result
        journal.poll()
        if journal.data['status'] == 'completed':
            return status_with_archive()
        if journal.data['status'] != 'running':
            return status_with_archive()
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
                if not journal.consult_phase(loop_id, phase_adviser):
                    break
                journal.transition(loop_id, 'orient', {
                    'available_methods': (list(FAMILY_FOCUSES) if breeding else
                                          ['sobol', 'local', 'topology']),
                    'capability_recipe':recipe.sha256 if recipe else None,
                    'budgets': {'exact': exact_budget, 'detail': detail_budget},
                    'registration': identity['score_state']})
            if node['phase'] == 'orient':
                if not journal.consult_phase(loop_id, phase_adviser):
                    break
                journal.transition(loop_id, 'decide', {
                    'sampling_seed': seed + i, 'candidates': candidates,
                    'family_breeding':identity.get('breeding'),
                    'topology_loci': list(topology_loci),
                    'recommendation': 'bounded multi-emitter CAD and capability auditions' if compositor else 'bounded multi-emitter CAD auditions'})
            if node['phase'] == 'decide':
                if not journal.consult_phase(loop_id, phase_adviser):
                    break
                if journal.autonomy < .25 and not node.get('plan_approved'):
                    if journal.data['awaiting'] is None:
                        journal.wait('plan', epoch_id=loop_id)
                    journal.poll()
                    if journal.data['awaiting'] is not None or journal.data['status'] != 'running':
                        break
                    node['plan_approved'] = True
                    journal.save()
                journal.transition(loop_id, 'act', {'operation': 'grow, audit and score candidates',
                      'capability_recipe':recipe.sha256 if recipe else None})
            if node['phase'] == 'act':
                if not journal.consult_phase(loop_id, phase_adviser):
                    break
                from .relations import PetNameLedger
                ledger = PetNameLedger.load(ledger_path) if ledger_path and Path(ledger_path).exists() else None
                ledger_digest = sha256(Path(ledger_path).read_bytes()).hexdigest() if ledger else None
                frozen = node.get('ledger_digest', ledger_digest)
                if frozen != ledger_digest:
                    raise ValueError('Pet-name ledger changed during epoch Act; apply updates after review')
                node['ledger_digest'] = frozen
                journal.save()
                batch = (make_brood(bounds, initial, archive, seed=seed,
                              generation=i+1,offspring_per_family=offspring_per_family,
                              migration_every=migration_every,mutation_scale=mutation_scale,
                              transfer_seeds=transfers)
                         if breeding else propose_methods(bounds,current,seed=seed+i,
                             count=candidates,topology_loci=topology_loci))
                # The selected parent gets a distinct seat; never sacrifice
                # Sobol exploration to make room for inheritance. Every
                # emitter keeps its own bounded proposals and the lineage
                # seed competes under the exact same mandatory CAD gates.
                if compositor is not None and not breeding:
                    from .epochs import Proposal
                    batch.insert(0,Proposal('lineage-seed','lineage',dict(current),'selected-parent'))
                solid_score, state = (project_silhouette_score(project) if compositor is None
                                      else (None,score_state))
                runner = WideEpoch(location=project.location,
                                   source_digests=identity['source_digests'],
                                   construction_digest=identity['construction_digest'],
                                   objectives=objectives,score_state=state,
                                   checkpoint=out/f'epoch_{i+1:03d}.json',
                                   max_exact=exact_budget,max_detail=detail_budget,
                                   seed=seed+i,pet_ledger=ledger,
                                   emitter_turn=i,
                                   emitter_performance=emitter_performance(archive,before_generation=i+1) if breeding else None)
                running_id = [None]
                builds = {}
                visual_index = {}
                from .capability_stack import digest as genome_digest
                surrogate=SurrogatePreview(bounds,archive,before_generation=i+1) if breeding else None
                emitter_credit=adaptive_priorities(batch,archive,before_generation=i+1) if breeding else {}
                by_genome={}
                for proposal in batch:
                    digest=genome_digest(proposal.genome)
                    by_genome[digest]=min(by_genome.get(digest,0.),
                                          emitter_credit.get(proposal.id,0.))
                def preview(genome):
                    if surrogate is not None:
                        # Conservative exploration bonus improves the cheap
                        # ordering, never the CAD gate or mandatory reservations.
                        return surrogate.priority(genome)+.02*by_genome.get(
                            genome_digest(genome),0.)
                    return float(np.mean([((genome[k]-current[k]) / (hi-lo))**2
                                    for k,(lo,hi) in bounds.items()]))
                def before(proposal):
                    running_id[0] = proposal.id
                    journal.candidate_start(loop_id, proposal)
                def capability_event(step, event, receipt):
                    """A child loop executes within the candidate's live Act."""
                    if running_id[0] is None:
                        raise ValueError('Capability stage outside candidate Act')
                    parent = loop_id + '/' + running_id[0]
                    child = parent + '/capability/' + step.id
                    if event == 'begin':
                        journal.begin(child,parent=parent,scope='capability',
                            evidence={'entity':step.entity,'operator':step.operator,
                                      'dependencies':receipt['dependencies'],
                                      'recipe_sha256':recipe.sha256})
                        for earlier,later,detail in (
                            ('observe','orient',{'dependencies':receipt['dependencies']}),
                            ('orient','decide',{'operator':step.operator}),
                            ('decide','act',{'execute':step.id})):
                            if journal.data['loops'][child]['phase']==earlier:
                                journal.transition(child,later,detail)
                    elif event == 'end':
                        if journal.data['loops'][child]['phase']=='act':
                            journal.transition(child,'aftermath',receipt)
                        if journal.data['loops'][child]['phase']=='aftermath':
                            journal.transition(child,'closed',{'state':receipt['state']})
                    else:
                        raise ValueError('Unknown capability phase event')
                def grow(genome):
                    if compositor is None:
                        return project.grow(genome)
                    build=compositor.grow(genome,stage_event=capability_event)
                    builds[genome_digest(genome)] = build
                    return build.scene.assembly
                def score(genome,assembly):
                    if compositor is None:
                        return solid_score(genome,assembly)
                    from .render import silhouette
                    from .evolution import iou
                    build=builds[genome_digest(genome)]
                    mask=silhouette(build.scene.render_mesh(),compositor.camera,score_size)>96
                    if breeding:
                        visual_index[genome_digest(genome)]=visual_descriptor(mask)
                    normalized=np.array([(genome[k]-lo)/(hi-lo) for k,(lo,hi) in bounds.items()])
                    origin=np.array([(recipe.initial[k]-lo)/(hi-lo) for k,(lo,hi) in bounds.items()])
                    loss={'silhouette':float(1-iou(source_mask,mask)),
                          'prior':float(.008*np.mean((normalized-origin)**2))}
                    if breeding:
                        family=(running_id[0] or '').split('-')[0]
                        loss['regional']=regional_loss(source_mask,mask,family,
                            attention=feature_evidence.mask_for(family) if feature_evidence else None)
                        loss.update(multiscale_source_loss(source_mask,mask))
                    return loss
                def features(genome,assembly):
                    build=builds[genome_digest(genome)]
                    traits={f'{row["entity"]}:{row["operator"]}:{row["id"]}'
                            for row in build.steps if row['state']=='complete'}
                    if breeding:
                        visual = visual_index[genome_digest(genome)]
                        traits.add('visual:'+visual['mask_sha256'])
                        traits.add('visual-niche:'+visual['niche'])
                    for key,value in genome.items():
                        if key in recipe.cad_keys or key.endswith('seed'):continue
                        lo,hi=bounds[key]
                        band=int(min(3,4*(value-lo)/(hi-lo)))
                        traits.add(f'gene:{key}:{band}')
                    return sorted(traits)
                def witnesses(genome,assembly):
                    return builds[genome_digest(genome)].witness()
                def after(proposal,result):
                    journal.candidate_receipt(loop_id,proposal,result)
                    running_id[0] = None
                    journal.save()
                def go():
                    return journal.poll()
                # One callback bundle for CAD-only and compound candidates.
                # The epoch owns exact gates; the bundle owns no evidence authority.
                adapter = CandidateAdapter(
                    grow=grow, score=score, preview=preview,
                    feature_hook=features if compositor else None,
                    witness_hook=witnesses if compositor else None,
                    before_candidate=before, after_candidate=after,
                    should_continue=go)
                data = runner.run(batch, adapter=adapter)
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
                if archive is not None and not node.get('archive_assimilated'):
                    culling = archive.assimilate(i+1,data)
                    node['archive_assimilated']=True
                    journal.event('lineage-culling',loop_id,generation=i+1,
                                  counts=culling,niches=len(archive.elites()),
                                  surviving_families=sorted(archive.data['champions']),
                                  adaptive_emitter_evidence=emitter_performance(archive),
                                  measured_searchability=archive.census(
                                      bounds,activations=tuple(
                                          step.activation for step in recipe.steps if step.activation)))
                    journal.save()
                options = (render_compound_review(compositor,runner,i,
                                out/f'previews/epoch_{i+1:03d}',
                                limit=4 if journal.autonomy<.9 else 2)
                    if compositor else
                    render_cad_review(project,runner,i,out/f'previews/epoch_{i+1:03d}',
                              limit=4 if journal.autonomy<.9 else 2))
                node['options'] = options
                journal.transition(loop_id, 'aftermath', {
                    'auditioned': sum(r['state'] not in ('deferred',) for r in data['results'].values()),
                    'scored': sum(r['state'] == 'scored' for r in data['results'].values()),
                    'options': options, 'errors': sum(r['state'] == 'error' for r in data['results'].values())})
            if node['phase'] == 'aftermath':
                if not journal.consult_phase(loop_id, phase_adviser):
                    break
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
            if journal.data['loops']['location']['phase']=='act':
                journal.transition('location', 'aftermath', {
                    'epochs':passes,'selected_genome':journal.data['current_genome']})
            if compositor is not None:
                # Gallery growth belongs to the *existing location Aftermath*;
                # it may not create a second execution controller.
                gallery_id='location/final-gallery'
                gallery_node=journal.data['loops'].get(gallery_id)
                if gallery_node is None:
                    gallery_node=journal.begin(gallery_id,parent='location',scope='gallery',
                        evidence={'source':'completed epoch archives','recipe':recipe.sha256})
                if gallery_node['phase']=='observe':
                    journal.transition(gallery_id,'orient',{'budget':finalists,'evidence':score_state})
                if gallery_node['phase']=='orient':
                    journal.transition(gallery_id,'decide',{'selection':'valid, diverse compound recipes'})
                if gallery_node['phase']=='decide':
                    journal.transition(gallery_id,'act',{'operation':'regrow exact CAD and polygon witnesses'})
                if gallery_node['phase']=='act':
                    gallery=regrow_compound_gallery(compositor,out,passes=passes,
                                                     count=finalists,unique_visual=breeding)
                    journal.data['gallery']=gallery
                    if archive is not None:
                        journal.data['lineage_gallery']=regrow_lineage_gallery(
                            compositor,archive,out,limit_per_family=2)
                    journal.transition(gallery_id,'aftermath',{
                        'actual_count':gallery['actual_count'],
                        'lineage_count':journal.data.get('lineage_gallery',{}).get('actual_count'),
                        'requested':finalists,'cad_mesh_union_verified':False})
                if gallery_node['phase']=='aftermath':
                    journal.transition(gallery_id,'closed',{'result':'audited composite gallery'})
            journal.transition('location', 'closed')
            journal.data['status']='completed'
            journal.save()
        result=status_with_archive()
        _atomic(out/'status.json',result)
        return result
