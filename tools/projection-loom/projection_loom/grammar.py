"""Small executable construction grammar for nameless CAD and negative volumes.

Rules grow fresh solids from a genome; their symbolic keys are local construction
handles, not pet-names, mesh faces or durable entity IDs. Discrete branches and
continuous dimensions can coexist. Each output must pass the existing full
positive-material and void audit before entering the evolutionary archive.
"""
from __future__ import annotations
import math
from collections.abc import Mapping

from .solid import SolidAssembly, box, beam


def _number(value, genome):
    if isinstance(value, Mapping):
        key=value.get('param')
        if key not in genome:
            raise ValueError(f'Unknown grammar genome locus: {key!r}')
        value=float(genome[key])*float(value.get('factor',1))+float(value.get('offset',0))
    result=float(value)
    if not math.isfinite(result):
        raise ValueError('Grammar geometry must be finite')
    return result


def _vec(values, genome):
    if len(values)!=3:
        raise ValueError('Geometry vectors require three numbers')
    return tuple(_number(x,genome) for x in values)


def _active(step, genome):
    guard=step.get('when')
    if guard is None:return True
    if set(guard)!= {'param','min'}:
        raise ValueError('A grammar guard needs param and min')
    return _number({'param':guard['param']},genome)>=_number(guard['min'],genome)


def grow_program(steps, genome, *, overlap_ratio=.012):
    """Interpret a bounded, typed program; no imported mesh seeds or implicit links.

    Supported operators: root-box, box, beam, void-box. A `key` names a local
    slot in the interpreter. `anonymous=True` creates a technical ~p/~v handle
    while preserving the named rule-slot when one is supplied. The operators
    deliberately require explicit placement and parent/route relations.
    """
    assembly=SolidAssembly(overlap_ratio=overlap_ratio)
    handles={}
    seen=set()
    for step in steps:
        key=step['key']
        if not isinstance(key,str) or not key or key in seen:
            raise ValueError('Every grammar operation needs a unique local key')
        seen.add(key)
        if not _active(step,genome):
            continue
        op=step['op']
        parents=[handles[p] for p in step.get('parents',())]
        kw={'has':tuple(step.get('has',())), 'slot':step.get('slot')}
        anonymous=bool(step.get('anonymous',False))
        name=None if anonymous else key
        if op=='root-box':
            if assembly.parts or parents:
                raise ValueError('Exactly one foundation roots a constructed body')
            solid=box(_vec(step['center'],genome),_vec(step['size'],genome))
            if anonymous:
                handle=assembly.spawn(solid,parents=(),role='foundation',material=0,**kw)
            else:
                assembly.add(name,solid,parents=(),role='foundation',material=0,**kw)
                handle=name
        elif op=='box':
            if not parents:
                raise ValueError('Every material member needs a supporting parent')
            solid=box(_vec(step['center'],genome),_vec(step['size'],genome),
                      taper=_number(step.get('taper',0),genome))
            role=step.get('role','secondary')
            material=int(step.get('material',2))
            if anonymous:
                handle=assembly.spawn(solid,parents=parents,role=role,material=material,**kw)
            else:
                assembly.add(name,solid,parents=parents,role=role,material=material,**kw)
                handle=name
        elif op=='beam':
            if not parents:
                raise ValueError('Every beam requires supporting parents')
            solid=beam(
                _vec(step['start'],genome),_vec(step['end'],genome),
                _number(step['width'],genome),_number(step['depth'],genome))
            if anonymous:
                handle=assembly.spawn(solid,parents=parents,role='secondary',material=2,**kw)
            else:
                assembly.add(name,solid,parents=parents,role='secondary',material=2,**kw)
                handle=name
        elif op=='void-box':
            solid=box(_vec(step['center'],genome),_vec(step['size'],genome))
            host_key=step.get('host')
            host=handles[host_key] if host_key is not None else None
            connects=[handles[v] for v in step.get('connects',())]
            params={'kind':step.get('kind','room'),'host':host,
                    'connects':connects,'exterior':bool(step.get('exterior',False)),**kw}
            if anonymous:
                handle=assembly.spawn_void(solid,**params)
            else:
                assembly.add_void(name,solid,**params)
                handle=name
        else:
            raise ValueError(f'Unsupported construction operator: {op}')
        handles[key]=handle
    if not assembly.parts:
        raise ValueError('Construction grammar produced no material body')
    return assembly
