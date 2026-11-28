"""Relational witnesses for generated architecture.

Construction handles are not pet-names.  A witness describes what a node does,
what it touches, and which capabilities it carries.  Anonymous nodes may acquire
an operator-given pet-name without forcing the builder to name its geometry.
O-takiage releases *soft lineage holds*, never CAD validity or the event history.
"""
from __future__ import annotations
from collections import defaultdict
from dataclasses import dataclass
import hashlib
import json
import math
import os
from pathlib import Path
from .provenance_encoding import canonical_json_sha256

SCHEMA = 'projection-loom/relational-ledger'
WITNESS = 'projection-loom/relational-witness'


def capabilities(values):
    """Canonical #has propositions; descriptive observations, never executable powers."""
    if isinstance(values, str):
        values = (values,)
    out = set()
    for value in values:
        if not isinstance(value, str) or not value.strip():
            raise ValueError('Capabilities must be nonempty strings')
        tail = value.strip().removeprefix('#has/')
        if not tail or any(c.isspace() for c in tail) or '/' in tail:
            raise ValueError(f'Invalid capability: {value!r}')
        out.add('#has/' + tail)
    return tuple(sorted(out))


def _digest(value):
    # A witness descriptor is deliberately shorter than a full recipe digest.
    return canonical_json_sha256(value, allow_nan=True)[:20]


@dataclass(frozen=True)
class Occurrence:
    handle: str
    kind: str
    role: str
    parents: tuple[str, ...]
    has: tuple[str, ...]
    slot: str | None = None
    anonymous: bool = False
    connects: tuple[str, ...] = ()


class RelationWitness:
    """One generation's authored/observed topology, without kernel face IDs."""
    def __init__(self, nodes, *, location='untitled-location'):
        self.location = str(location)
        self.nodes = dict(nodes)
        if len(self.nodes) != len(set(self.nodes)):
            raise ValueError('Duplicate construction handles')
        for node in self.nodes.values():
            for parent in node.parents:
                if parent not in self.nodes:
                    raise ValueError(f'{node.handle} refers to missing parent {parent}')
        self.witness_id = _digest(self.to_dict(include_digest=False))

    @classmethod
    def from_assembly(cls, assembly, *, location='untitled-location'):
        nodes = {}
        for name, part in assembly.parts.items():
            nodes[name] = Occurrence(name, 'material', part.role, tuple(part.parents),
                                     capabilities(getattr(part, 'has', ())),
                                     getattr(part, 'slot', None), getattr(part, 'anonymous', False))
        root = next(iter(assembly.parts), None)
        for name, part in (assembly.voids.voids.items() if assembly.voids is not None else ()):
            host = getattr(part, 'host', None) or root
            nodes[name] = Occurrence(name, 'void', part.kind, (host,) if host else (),
                                     capabilities(getattr(part, 'has', ())),
                                     getattr(part, 'slot', None), getattr(part, 'anonymous', False), tuple(part.connects))
        return cls(nodes, location=location)

    def to_dict(self, *, include_digest=True):
        d = {'schema': WITNESS, 'location': self.location,
             'entities': [dict(handle=x.handle, kind=x.kind, role=x.role,
                               parents=list(x.parents), has=list(x.has), slot=x.slot,
                               anonymous=x.anonymous, connects=list(x.connects))
                          for x in self.nodes.values()]}
        if include_digest:
            d['witness_id'] = self.witness_id
        return d

    @classmethod
    def from_dict(cls, payload):
        if payload.get('schema') != WITNESS:
            raise ValueError('Unrecognized relational witness schema')
        nodes = {}
        for item in payload['entities']:
            h = item['handle']
            if h in nodes:
                raise ValueError('Duplicate witness handle')
            nodes[h] = Occurrence(h, item['kind'], item['role'], tuple(item.get('parents', ())),
                                  capabilities(item.get('has', ())), item.get('slot'),
                                  bool(item.get('anonymous', False)), tuple(item.get('connects', ())))
        witness = cls(nodes, location=payload.get('location', 'untitled-location'))
        if 'witness_id' in payload and payload['witness_id'] != witness.witness_id:
            raise ValueError('Witness checksum mismatch')
        return witness

    @classmethod
    def load(cls, path):
        return cls.from_dict(json.loads(Path(path).read_text(encoding='utf8')))

    def save(self, path):
        _atomic_json(path, self.to_dict())

    def descendants(self, handle):
        if handle not in self.nodes:
            raise KeyError(handle)
        by_parent = defaultdict(list)
        for node in self.nodes.values():
            for p in node.parents:
                by_parent[p].append(node.handle)
        seen, pending = set(), [handle]
        while pending:
            current = pending.pop()
            if current in seen:
                continue
            seen.add(current)
            pending.extend(by_parent[current])
        return seen

    def _parent_context(self, node):
        # Recursive relational descriptors survive source-handle renaming.
        # Identical siblings remain ambiguous until they receive explicit slots.
        def label(handle, trail=frozenset()):
            if handle in trail:
                raise ValueError('Cyclic construction relations cannot identify an entity')
            parent = self.nodes[handle]
            if parent.slot:
                return f'slot:{parent.kind}:{parent.slot}'
            upstream = sorted(label(p, trail | {handle}) for p in parent.parents)
            return 'relation:' + _digest([parent.kind, parent.role, parent.has, upstream])
        return tuple(sorted(label(p) for p in node.parents))

    def selector(self, handle):
        node = self.nodes[handle]
        return {'kind': node.kind, 'role': node.role, 'parents': list(self._parent_context(node)),
                'slot': node.slot, 'has': list(node.has)}

    def locate(self, selector):
        matched = []
        for node in self.nodes.values():
            if node.kind != selector['kind']:
                continue
            if selector.get('slot') is not None:
                if node.slot != selector['slot']:
                    continue
            else:
                if node.role != selector['role'] or tuple(self._parent_context(node)) != tuple(selector['parents']):
                    continue
                if not set(selector['has']).issubset(node.has):
                    continue
            matched.append(node.handle)
        return matched

    def feature_set(self):
        # Count semantic roles and connections, never transient handles or pet-names.
        counts = defaultdict(int)
        for node in self.nodes.values():
            for cap in node.has or ('#has/unspecified',):
                counts[f'{node.kind}:{node.role}:{cap}'] += 1
            for parent in node.parents:
                parent_node = self.nodes[parent]
                counts[f'link:{parent_node.kind}/{parent_node.role}->{node.kind}/{node.role}'] += 1
        return frozenset(f'{feature}:count={count}' for feature, count in counts.items())


def _atomic_json(path, payload):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_name(path.name + '.pending')
    tmp.write_text(json.dumps(payload, indent=2, ensure_ascii=False, sort_keys=True) + '\n', encoding='utf8')
    os.replace(tmp, path)


class PetNameLedger:
    """Event-sourced, soft binding of pet-names to entity or location relations."""
    def __init__(self, *, location='untitled-location', claims=None, history=None):
        self.location = location
        self.claims = list(claims or [])
        self.history = list(history or [])
        self._source_path = None
        self._source_hash = None

    @classmethod
    def load(cls, path):
        source = Path(path).resolve()
        raw = source.read_bytes()
        obj = json.loads(raw)
        if obj.get('schema') != SCHEMA:
            raise ValueError('Unrecognized relational ledger schema')
        ledger = cls(location=obj['location'], claims=obj['claims'], history=obj['history'])
        ledger._source_path = source
        ledger._source_hash = hashlib.sha256(raw).hexdigest()
        return ledger

    def to_dict(self):
        return {'schema': SCHEMA, 'location': self.location, 'claims': self.claims, 'history': self.history}

    def save(self, path):
        target = Path(path).resolve()
        if target.exists():
            current = hashlib.sha256(target.read_bytes()).hexdigest()
            if target != self._source_path or current != self._source_hash:
                raise RuntimeError('Ledger changed since last read; reconcile the causal branch before writing')
        elif self._source_path == target and self._source_hash is not None:
            raise RuntimeError('Ledger disappeared since last read')
        _atomic_json(target, self.to_dict())
        self._source_path = target
        self._source_hash = hashlib.sha256(target.read_bytes()).hexdigest()

    def _event(self, action, **payload):
        e = {'seq': len(self.history) + 1, 'action': action, **payload}
        self.history.append(e)
        return e

    def control_receipt(self, control_id, command_digest):
        """Recover a durable operator result or refuse a changed command."""
        matches = [event for event in self.history
                   if event.get('control_id') == control_id]
        if len(matches) > 1:
            raise ValueError('Duplicate durable operator control ID in ledger')
        if not matches:
            return None
        receipt = matches[0]
        if receipt.get('command_digest') != command_digest:
            raise ValueError('Operator control digest mismatch after ledger commit')
        if 'control_outcome' not in receipt:
            raise ValueError('Ledger control receipt lacks committed outcome')
        return receipt

    def commit_control(self, control_id, command_digest, outcome):
        """Bind control ID, digest and outcome in the next atomic ledger save."""
        if self.control_receipt(control_id, command_digest) is not None:
            raise ValueError('Operator control already committed')
        if not self.history or self.history[-1].get('control_id') is not None:
            raise ValueError('No fresh ledger event for operator control')
        # o-takiage returns the very event that we augment below.
        # Snapshot it before mutation, or JSON sees a self-referential dict.
        snapshot = json.loads(json.dumps(outcome, allow_nan=False))
        self.history[-1].update(control_id=control_id,
                                command_digest=command_digest,
                                control_outcome=snapshot)
        return snapshot

    def pet_name(self, name, handle, witness, *, mode='entity', has=(), member_has=(), retain=0.4):
        name = str(name).strip()
        if not name:
            raise ValueError('Pet-name cannot be blank')
        if witness.location != self.location:
            raise ValueError('Witness and ledger location differ')
        if handle not in witness.nodes:
            raise KeyError(handle)
        if mode not in ('entity', 'location'):
            raise ValueError('Pet-name mode must describe an entity or a location')
        if not isinstance(retain, (int, float)) or not math.isfinite(retain) or not 0 <= retain <= 1:
            raise ValueError('Retention must lie between zero and one')
        if any(c['name'] == name and c['active'] for c in self.claims):
            raise ValueError('An active pet-name already holds this label')
        expected = capabilities(has)
        member_filter = capabilities(member_has)
        if mode == 'entity' and member_filter:
            raise ValueError('Member filters apply only to locations')
        if len(witness.locate(witness.selector(handle))) != 1:
            raise ValueError('Relational selector is ambiguous; give the emergent rule a stable slot')
        if mode == 'location':
            members = self._members(witness, handle, member_filter)
            if not members:
                raise ValueError('Location selection has no members')
            if not expected:
                expected = capabilities(c for member in members for c in witness.nodes[member].has)
        elif not expected:
            expected = witness.nodes[handle].has
        # The selector, not a CAD vertex or ephemeral handle, describes future matches.
        prior = [c for c in self.claims if c['name'] == name]
        claim = {'claim_id': f'pet:{_digest([self.location, name, len(prior)+1])}',
                 'name': name, 'revision': len(prior)+1, 'mode': mode,
                 'selector': witness.selector(handle), 'has': list(expected),
                 'member_has': list(member_filter), 'released_forks': [], 'retain': float(retain),
                 'active': True, 'born_witness': witness.witness_id,
                 'born_handle': handle}
        self.claims.append(claim)
        self._event('pet-name', claim_id=claim['claim_id'], name=name, mode=mode,
                    witness_id=witness.witness_id)
        return claim

    @staticmethod
    def _members(witness, root, member_filter):
        nodes = witness.descendants(root)
        return sorted(h for h in nodes if set(member_filter).issubset(witness.nodes[h].has))

    def _claim_members(self, witness, root, claim):
        members = set(witness.descendants(root))
        for selector in claim.get('released_forks', ()):
            matches = witness.locate(selector)
            if len(matches) == 1:
                members.difference_update(witness.descendants(matches[0]))
        return sorted(h for h in members if set(claim['member_has']).issubset(witness.nodes[h].has))

    def resolve(self, witness):
        if witness.location != self.location:
            raise ValueError('Cannot reconcile different locations')
        outcomes = []
        for claim in self.claims:
            if not claim['active']:
                continue
            matches = witness.locate(claim['selector'])
            result = {'claim_id': claim['claim_id'], 'name': claim['name'],
                      'mode': claim['mode'], 'status': 'missing', 'handle': None,
                      'members': [], 'missing_has': list(claim['has'])}
            if len(matches) > 1:
                result['status'] = 'ambiguous'
            elif len(matches) == 1:
                root = matches[0]
                members = (self._claim_members(witness, root, claim)
                           if claim['mode'] == 'location' else [root])
                have = set(c for member in members for c in witness.nodes[member].has)
                updated = witness.selector(root)
                drifted = bool(claim['selector']['role'] != updated['role'] or
                               claim['selector']['parents'] != updated['parents'])
                result.update(status=('drifted' if drifted else 'matched') if members else 'missing',
                              handle=root, members=members, relational_drift=drifted,
                              observed_has=sorted(have),
                              missing_has=sorted(set(claim['has'])-have))
            outcomes.append(result)
        return outcomes

    def soft_loss(self, witness):
        """Bounded preference. Ambiguity grants no false match or hard veto."""
        statuses = {o['claim_id']:o for o in self.resolve(witness)}
        cost = 0.0
        for claim in self.claims:
            if not claim['active']:
                continue
            state = statuses[claim['claim_id']]
            if state['status'] == 'missing':
                cost += .025 * claim['retain']
            elif state['status'] == 'drifted':
                cost += .018 * claim['retain']
            elif state['status'] == 'ambiguous':
                cost += .012 * claim['retain']
            elif state['status'] == 'matched':
                cost += .012 * claim['retain'] * len(state['missing_has']) / max(1,len(claim['has']))
            # Ambiguous witnesses never justify binding an arbitrary sibling.
        return float(min(.08, cost))

    def o_takiage(self, *, name=None, branch=None, witness=None):
        """Release a single soft hold or every hold in a construction fork.

        Historical claims stay available. No material, void, or CAD constraints move.
        """
        if (name is None) == (branch is None):
            raise ValueError('Choose exactly one name or branch')
        released = []
        softened_locations = []
        if name is not None:
            released = [c for c in self.claims if c['active'] and c['name'] == name]
            if not released:
                raise ValueError('No active pet-name with that label')
        else:
            if witness is None:
                raise ValueError('A branch release requires a witness')
            if witness.location != self.location:
                raise ValueError('Cannot release a branch in another location')
            branch_selector = witness.selector(branch)
            if len(witness.locate(branch_selector)) != 1:
                raise ValueError('Branch cannot be reidentified uniquely; assign a stable slot before release')
            roots = witness.descendants(branch)
            targets = {o['claim_id']:o['handle'] for o in self.resolve(witness)}
            released = [c for c in self.claims if c['active'] and targets.get(c['claim_id']) in roots]
            for claim in self.claims:
                if not claim['active'] or claim['mode'] != 'location' or claim in released:
                    continue
                location_root = targets.get(claim['claim_id'])
                if location_root is None or branch not in witness.descendants(location_root):
                    continue
                before = list(claim['has'])
                claim.setdefault('released_forks', []).append(branch_selector)
                remaining = self._claim_members(witness, location_root, claim)
                remaining_has = {c for h in remaining for c in witness.nodes[h].has}
                claim['has'] = sorted(set(claim['has']) & remaining_has)
                softened_locations.append({'claim_id': claim['claim_id'],
                                           'released_capabilities':sorted(set(before)-set(claim['has']))})
        for claim in released:
            claim['active'] = False
        event = self._event('o-takiage', scope='name' if name is not None else 'branch',
                            target=name if name is not None else branch,
                            released=[c['claim_id'] for c in released],
                            softened_locations=softened_locations,
                            witness_id=witness.witness_id if witness else None)
        return event
