"""Constructive negative space for Projection Loom.

A void is an authored CAD BRep, not an inferred gap in a rendered mesh.
Void topology, boundary access and remaining material validity are audited separately.
"""
from __future__ import annotations
from dataclasses import dataclass
from collections import deque
import cadquery as cq


@dataclass(frozen=True)
class VoidPart:
    name: str
    solid: object
    kind: str
    connects: tuple[str, ...]
    exterior: bool


class VoidAssembly:
    """Carve first-class rooms, corridors and gateways out of a positive assembly.

    `solid` can be a fused CadQuery solid, or an existing SolidAssembly
    whose `audit(join=True)` and `fuse()` methods are authoritative.
    """
    def __init__(self, positive):
        self.positive = positive
        self.voids: dict[str, VoidPart] = {}

    def add(self, name, solid, *, kind='room', connects=(), exterior=False):
        if name in self.voids:
            raise ValueError(f'Duplicate void: {name}')
        if kind not in {'room', 'corridor', 'doorway', 'stairwell', 'shaft', 'recess'}:
            raise ValueError(f'Unsupported void kind: {kind}')
        if not solid.isValid() or len(solid.Solids()) != 1 or solid.Volume() <= 0:
            raise ValueError('Void must be one valid positive-volume CAD solid')
        self.voids[name] = VoidPart(str(name), solid, kind, tuple(connects), bool(exterior))
        if hasattr(self.positive, '_verified_material'):
            self.positive._verified_material = None
        return self

    def audit(self, *, shell=None):
        if shell is None:
            if hasattr(self.positive, 'audit'):
                positive_audit = self.positive.audit(join=False)
                if not positive_audit['valid']:
                    return {'valid': False, 'reason': 'positive assembly invalid', 'positive': positive_audit}
                shell = self.positive.fuse()
            else:
                shell = self.positive
        if not shell.isValid() or len(shell.Solids()) != 1:
            return {'valid': False, 'reason': 'invalid positive solid'}
        if not self.voids:
            return {'valid': True, 'carved': shell, 'contacts': [], 'reachable': [], 'material_solids': 1}
        errors = []
        names = set(self.voids)
        contacts = []
        for name, part in self.voids.items():
            inside = part.solid.intersect(shell).Volume()
            outside = part.solid.Volume() - inside
            contacts.append({'name': name, 'kind': part.kind,
                             'inside_volume': inside, 'outside_volume': outside})
            if inside <= 1e-8:
                errors.append(f'{name}: no material to carve')
            if part.exterior and outside <= 1e-8:
                errors.append(f'{name}: declared exterior but does not pass outside material')
            if not part.exterior and outside > max(1e-6, part.solid.Volume() * 1e-5):
                errors.append(f'{name}: interior void protrudes beyond shell')
            for other in part.connects:
                if other not in names:
                    errors.append(f'{name}: unknown linked void {other}')
                elif other != name and part.solid.intersect(self.voids[other].solid).Volume() <= 1e-8:
                    errors.append(f'{name}: linked void {other} does not overlap')
        # Connection declarations describe actual volumetric overlap; symmetric
        # reachability follows even if only one endpoint authors the link.
        graph = {name: set() for name in names}
        for name, part in self.voids.items():
            for other in part.connects:
                if other in graph and other != name:
                    graph[name].add(other)
                    graph[other].add(name)
        origins = [name for name, part in self.voids.items() if part.exterior]
        reachable = set(origins)
        queue = deque(origins)
        while queue:
            for node in graph[queue.popleft()]:
                if node not in reachable:
                    reachable.add(node)
                    queue.append(node)
        for name, part in self.voids.items():
            if part.kind != 'recess' and name not in reachable:
                errors.append(f'{name}: no declared route to exterior')
        cutters = list(self.voids.values())
        carved = shell.cut(cutters[0].solid)
        for part in cutters[1:]:
            carved = carved.cut(part.solid)
        material_solids = len(carved.Solids())
        if not carved.isValid() or material_solids != 1 or carved.Volume() <= 0:
            errors.append('carving must leave one valid positive-volume material solid')
        return {'valid': not errors, 'errors': errors, 'contacts': contacts,
                'reachable': sorted(reachable), 'material_solids': material_solids,
                'material_volume': carved.Volume(), 'carved': carved}

    def carve(self):
        report = self.audit()
        if not report['valid']:
            raise ValueError('Invalid void construction: ' + '; '.join(report.get('errors', [report.get('reason','unknown')])))
        return report['carved']
