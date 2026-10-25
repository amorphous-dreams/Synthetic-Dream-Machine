"""Typed views of native audits: shared presentation, no shared proof authority.

These immutable adapters inspect the receipts produced by CAD, polygon, source
registration and trusted capability engines. They do not run those validators,
authorize a control or turn an output image into independent source evidence.
"""
from __future__ import annotations

from collections.abc import Mapping
from dataclasses import dataclass
from math import isfinite


def _mapping(value, domain):
    if not isinstance(value, Mapping):
        raise ValueError(f'{domain} requires a native receipt mapping')
    return value


def _flag(value, key, domain):
    if type(value.get(key)) is not bool:
        raise ValueError(f'{domain} requires a boolean {key}')
    return value[key]


@dataclass(frozen=True)
class CadAuditReceipt:
    material_valid: bool
    union_valid: bool
    union_solids: int

    @classmethod
    def from_native(cls, raw):
        raw = _mapping(raw, 'CAD audit')
        valid = _flag(raw, 'valid', 'CAD audit')
        union = _flag(raw, 'union_valid', 'CAD audit')
        solids = raw.get('union_solids')
        if type(solids) is not int or solids < 0:
            raise ValueError('CAD audit needs an integer union_solids count')
        return cls(valid, union, solids)

    @property
    def admitted(self):
        return self.material_valid and self.union_valid and self.union_solids == 1


@dataclass(frozen=True)
class PolygonSurfaceReceipt:
    name: str
    valid: bool
    watertight: bool
    triangles: int

    @classmethod
    def from_native(cls, raw):
        raw = _mapping(raw, 'polygon audit')
        if raw.get('scope') != 'polygon-surface-only':
            raise ValueError('Polygon audit scope cannot masquerade as CAD')
        valid = _flag(raw, 'valid', 'polygon audit')
        watertight = _flag(raw, 'watertight', 'polygon audit')
        faces = raw.get('triangles')
        if type(faces) is not int or faces < 0 or (valid and faces == 0):
            raise ValueError('Polygon audit requires an actual triangle count')
        name = raw.get('name')
        if not isinstance(name, str) or not name:
            raise ValueError('Polygon audit needs a named layer')
        return cls(name, valid, watertight, faces)


@dataclass(frozen=True)
class SocketProximityReceipt:
    name: str
    valid: bool

    @classmethod
    def from_native(cls, raw):
        raw = _mapping(raw, 'socket audit')
        if raw.get('scope') != 'interface-proximity-not-structural-fusion':
            raise ValueError('Socket audit proves proximity, not structural fusion')
        valid = _flag(raw, 'valid', 'socket audit')
        name = raw.get('name')
        if not isinstance(name, str) or not name:
            raise ValueError('Socket audit needs a named attachment')
        if valid:
            vals = [raw.get(k) for k in ('mesh_to_cad_anchor', 'cad_point_to_brep', 'tolerance')]
            if any(type(v) not in (float, int) or not isfinite(v) for v in vals):
                raise ValueError('Valid socket requires measured finite distances')
            if vals[2] <= 0 or vals[0] < 0 or vals[1] < 0 or max(vals[:2]) > vals[2]:
                raise ValueError('Socket proximity exceeds its tolerance')
        return cls(name, valid)


@dataclass(frozen=True)
class CompoundAuditReceipt:
    cad: CadAuditReceipt
    layers: tuple[PolygonSurfaceReceipt, ...]
    sockets: tuple[SocketProximityReceipt, ...]
    reported_render_gate: bool

    @classmethod
    def from_native(cls, raw):
        raw = _mapping(raw, 'compound audit')
        cad = CadAuditReceipt.from_native(raw.get('cad'))
        if _flag(raw, 'cad_valid', 'compound audit') != cad.material_valid:
            raise ValueError('Compound CAD claim contradicts its native CAD audit')
        if _flag(raw, 'composite_cad_union_verified', 'compound audit') is not False:
            raise ValueError('Compound receipt cannot assert cross-kernel fusion')
        layers = raw.get('layers')
        sockets = raw.get('attachments')
        if not isinstance(layers, list) or not isinstance(sockets, list):
            raise ValueError('Compound audit needs separate polygon and socket receipts')
        polygons = tuple(PolygonSurfaceReceipt.from_native(x) for x in layers)
        proximities = tuple(SocketProximityReceipt.from_native(x) for x in sockets)
        reported = _flag(raw, 'composite_valid_for_render', 'compound audit')
        calculated = (cad.material_valid and all(x.valid for x in polygons)
                      and all(x.valid for x in proximities))
        if reported != calculated:
            raise ValueError('Compound render gate contradicts its scoped audits')
        return cls(cad, polygons, proximities, reported)

    @property
    def render_admissible(self):
        return self.reported_render_gate and self.cad.admitted


@dataclass(frozen=True)
class RegistrationEvidenceReceipt:
    source_frame: str
    target_frame: str
    declared_state: str
    source_anchors: tuple[str, ...]

    @classmethod
    def from_location(cls, stack, native):
        from .location_stack import LocationStack, RegistrationReceipt
        if not isinstance(stack, LocationStack) or not isinstance(native, RegistrationReceipt):
            raise ValueError('Registration evidence needs an actual location and registration receipt')
        if native not in stack.registrations:
            raise ValueError('Registration receipt is not attached to this location')
        stack.audit()  # relationship check; NOT real-world source authenticity
        return cls(native.source_frame, native.target_frame, native.state,
                   tuple(native.anchor_sources))


@dataclass(frozen=True)
class OperatorPreferenceReceipt:
    action: str
    parameters: tuple[tuple[str, object], ...]

    @classmethod
    def from_control(cls, control):
        control = _mapping(control, 'operator preference')
        if control.get('actor') != 'operator':
            raise ValueError('Operator preference requires operator authority')
        action = control.get('action')
        args = _mapping(control.get('parameters'), 'operator parameters')
        if action == 'choose':
            valid = (set(args) == {'proposal_id'} and
                     isinstance(args['proposal_id'], str) and bool(args['proposal_id']))
        elif action == 'prefer-emitter':
            valid = set(args) == {'emitter'} and args['emitter'] in ('sobol', 'local', 'topology')
        elif action == 'set-autonomy':
            value = args.get('autonomy')
            valid = (set(args) == {'autonomy'} and type(value) in (int, float)
                     and isfinite(value) and 0 <= value <= 1)
        else:
            raise ValueError('Not an operator preference control')
        if not valid:
            raise ValueError('Malformed operator preference control')
        return cls(action, tuple(sorted(args.items())))


@dataclass(frozen=True)
class CapabilityStepReceipt:
    id: str
    state: str
    output_kind: str | None

    @classmethod
    def from_native(cls, raw):
        raw = _mapping(raw, 'capability step')
        for key in ('id', 'entity', 'operator'):
            if not isinstance(raw.get(key), str) or not raw[key]:
                raise ValueError(f'Capability step requires {key}')
        state = raw.get('state')
        if state not in ('complete', 'inactive', 'inactive-dependency', 'error'):
            raise ValueError('Unknown capability step state')
        if state == 'complete':
            if 'output' not in raw or 'error' in raw:
                raise ValueError('Completed capability needs an output, not an error')
            output = raw['output']
            # Custom trusted operators may return any serializable result.
            kind = output.get('kind') if isinstance(output, Mapping) else None
            if kind is not None and (not isinstance(kind, str) or not kind):
                raise ValueError('Capability output kind must be a nonempty string')
        else:
            kind = None
            if 'output' in raw:
                raise ValueError('Inactive or failed capability cannot claim completed output')
            if state == 'error' and not isinstance(raw.get('error'), str):
                raise ValueError('Failed capability needs an error reason')
        return cls(raw['id'], state, kind)


def presentation_envelope(receipt):
    """Shared display shape; deliberately NO universal valid/proven boolean."""
    if isinstance(receipt, CadAuditReceipt):
        return {'domain': 'cad-brep', 'status': 'admitted' if receipt.admitted else 'rejected'}
    if isinstance(receipt, PolygonSurfaceReceipt):
        return {'domain': 'polygon-surface', 'status': 'render-valid' if receipt.valid else 'rejected'}
    if isinstance(receipt, SocketProximityReceipt):
        return {'domain': 'socket-proximity', 'status': 'within-tolerance' if receipt.valid else 'rejected'}
    if isinstance(receipt, CompoundAuditReceipt):
        return {'domain': 'compound-render', 'status': 'render-admitted' if receipt.render_admissible else 'rejected'}
    if isinstance(receipt, RegistrationEvidenceReceipt):
        status = ('fit-verified-not-survey-authenticity' if receipt.declared_state == 'verified'
                  else 'provisional')
        return {'domain': 'frame-registration', 'status': status}
    if isinstance(receipt, OperatorPreferenceReceipt):
        return {'domain': 'operator-preference', 'status': 'requested'}
    if isinstance(receipt, CapabilityStepReceipt):
        return {'domain': 'capability-execution', 'status': receipt.state}
    raise ValueError('Unrecognized typed receipt; raw dicts carry no common authority')
