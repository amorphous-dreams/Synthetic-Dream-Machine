"""Author-declared construction hierarchy and support-path semantics.

A structure records what must support what, before any camera or shading can
hide a missing joint. 'exempt' explicitly describes intentional free-standing
or magical visual elements; it is never inferred from silhouette continuity.
"""
from __future__ import annotations
from dataclasses import dataclass
from collections import defaultdict
from .solid_contacts import audit_pairs

VALID_ROLES={'foundation','primary','secondary','detail','exempt'}

@dataclass(frozen=True)
class Attachment:
    parent: str
    child: str
    min_radius: float=0.
    min_ratio: float=.055


class ArchitectureGraph:
    def __init__(self,roots,links,roles=None,policy='report'):
        self.roots=tuple(roots)
        self.links=tuple(Attachment(**x) if isinstance(x,dict) else x for x in links)
        self.roles=dict(roles or {})
        self.policy=policy
        if self.policy not in ('report','gate'):
            raise ValueError('structure policy must be report or gate')
        if not self.roots:raise ValueError('Structure requires at least one root')
        if any(role not in VALID_ROLES for role in self.roles.values()):
            raise ValueError(f'Unknown architectural role; choose {sorted(VALID_ROLES)}')

    @classmethod
    def from_dict(cls,src):
        return cls(src['roots'],src.get('attachments',[]),src.get('roles'),src.get('policy','report'))

    def validate(self,mesh):
        names=[x['name'] for x in mesh.parts]
        if len(set(names))!=len(names):raise ValueError('Structure requires unique part names')
        missing=set(self.roots)|{x.parent for x in self.links}|{x.child for x in self.links}|set(self.roles)
        missing-=set(names)
        if missing:raise ValueError(f'Unknown structural parts: {sorted(missing)}')
        roots=set(self.roots)
        parent_to_children=defaultdict(set)
        incoming=defaultdict(set)
        for link in self.links:
            if link.parent==link.child or link.min_radius<0 or link.min_ratio<0:
                raise ValueError('Invalid attachment relation')
            parent_to_children[link.parent].add(link.child)
            incoming[link.child].add(link.parent)
        # Support paths must form a rooted DAG; otherwise cycles can legitimize
        # mutually floating parts in an assembly.
        visited=set();visiting=set()
        def visit(node):
            if node in visiting:raise ValueError('Support graph contains a cycle')
            if node in visited:return
            visiting.add(node)
            for ch in parent_to_children[node]:visit(ch)
            visiting.remove(node);visited.add(node)
        for root in roots:visit(root)
        if any(x.parent not in visited for x in self.links):
            raise ValueError('Support graph has unrooted attachment chains')
        unreachable=[n for n in names if n not in visited and self.roles.get(n)!='exempt']
        if unreachable:raise ValueError(f'Unrooted architectural parts: {unreachable}')
        return True

    def audit(self,mesh):
        self.validate(mesh)
        measured=audit_pairs(mesh,[vars(x) for x in self.links])
        exceptions={name for name,role in self.roles.items() if role=='exempt'}
        failures=[m for m in measured if not m['meets_threshold']]
        # Uncertain observations cannot pass a strict gate.
        statuses={k:sum(1 for v in measured if v['status']==k) for k in sorted({v['status'] for v in measured})}
        return {'valid':not failures,'policy':self.policy,'roots':list(self.roots),
                'parts':len(mesh.parts),'attachments':measured,'failed':failures,
                'exceptions':sorted(exceptions),'by_status':statuses,
                'guarantee':'Numeric closed-convex overlap for qualifying parts; uncertain/open meshes fail strict gate'}

    def require_valid(self,mesh):
        r=self.audit(mesh)
        if self.policy=='gate' and not r['valid']:
            raise ValueError('Structural gate rejected mesh: '+', '.join(f'{v["parent"]}->{v["child"]} ({v["status"]})' for v in r['failed'][:6]))
        return r

    def drawing_roles(self):
        return {k:('primary' if v=='foundation' else 'detail' if v=='exempt' else v)
                for k,v in self.roles.items()}
