"""Transactional, typed edits to *hypothesis* location graphs.

These are proposals for later geometry growth, never unverified CAD models.
Changing a witness-attested node or relation requires new source evidence; it
cannot occur by rewriting a conjecture. Unknown/dangling edges reject the whole
transaction. O-takiage remains a separate soft identity-ledger operation.
"""
from __future__ import annotations
from dataclasses import dataclass
from .location_stack import LocationStack, Element, Relation


@dataclass(frozen=True)
class RewriteReceipt:
    rule: str
    before: str
    after: str
    operations: int
    created: tuple[str, ...]
    released: tuple[str, ...]


def apply_rewrite(stack: LocationStack, rule: str, operations):
    """Return a fresh validated location and a causal content-hash receipt."""
    if not rule or not isinstance(rule,str):
        raise ValueError('Rule name required')
    stack.audit()
    before=stack.to_dict()['snapshot_sha256']
    candidate=LocationStack.from_dict(stack.to_dict())
    created=[]
    removed=[]
    for action in operations:
        op=action['op']
        if op=='spawn':
            if action.get('epistemic','proposed')!='proposed':
                raise ValueError('A rewrite cannot manufacture source testimony')
            entity=Element(action['handle'],action.get('kind','unresolved_form'),
                           tuple(action.get('witness_ids',())),tuple(action.get('capabilities',())),
                           'proposed',action.get('body_token'))
            candidate.add_element(entity)
            created.append(entity.handle)
            if 'contained_by' in action:
                candidate.relate(Relation(action['contained_by'],'contains',entity.handle))
        elif op=='relate':
            if action.get('epistemic','proposed')!='proposed':
                raise ValueError('A rewrite cannot invent a measured relation')
            candidate.relate(Relation(action['subject'],action['verb'],action['object']))
        elif op=='release':
            handle=action['handle']
            if handle not in candidate.elements:
                raise KeyError(handle)
            existing=candidate.elements[handle]
            if existing.epistemic!='proposed':
                raise ValueError('Source and inferred entities require independent evidence decisions')
            if any(r.epistemic!='proposed' and (r.subject==handle or r.object==handle) for r in candidate.relations):
                raise ValueError('A witnessed relation cannot be removed by a proposal rewrite')
            incident=[r for r in candidate.relations if r.subject==handle or r.object==handle]
            if incident and not action.get('detach',False):
                raise ValueError('Dangling relation; explicitly request detach')
            candidate.relations=[r for r in candidate.relations if r not in incident]
            del candidate.elements[handle]
            removed.append(handle)
        elif op=='has':
            handle=action['handle']
            original=candidate.elements[handle]
            if original.epistemic!='proposed':
                raise ValueError('Cannot rewrite source-attested capabilities')
            from .relations import capabilities
            update=capabilities(action['capabilities'])
            if action.get('mode','add')=='remove':
                caps=tuple(sorted(set(original.capabilities)-set(update)))
            elif action.get('mode','add')=='add':
                caps=tuple(sorted(set(original.capabilities)|set(update)))
            else:raise ValueError('Unknown capability rewrite mode')
            candidate.elements[handle]=Element(original.handle,original.kind,
                original.witness_ids,caps,original.epistemic,original.body_token)
        else:
            raise ValueError(f'Unsupported graph rewrite: {op}')
    candidate.audit()
    return candidate, RewriteReceipt(rule,before,candidate.to_dict()['snapshot_sha256'],
                                    len(operations),tuple(created),tuple(removed))
