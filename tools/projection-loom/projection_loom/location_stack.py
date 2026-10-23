"""Evidence-first, heterogeneous location stacks for Projection Loom.

This module specifies the seam between measured/source evidence, inferred
hypotheses, and constructed bodies. It does NOT perform photogrammetry,
coordinate conversion, or registration: it makes their missing receipts visible.
A location may contain many independent CAD bodies and non-solid representations.
"""
from __future__ import annotations

from dataclasses import dataclass, asdict
from hashlib import sha256
import json
from pathlib import Path
import re
from collections import defaultdict

SCHEMA = 'projection-loom/location-stack/v1'
HEX_SHA256 = re.compile(r'^[0-9a-f]{64}$')
SOURCE_KINDS = frozenset({
    'single_image', 'image_set', 'dem', 'point_cloud', 'photogrammetry_mesh',
    'cad_model', 'drawing', 'survey_control', 'text_testimony'
})
ELEMENT_KINDS = frozenset({
    'cad_body', 'terrain', 'point_field', 'surface_mesh', 'image_plane',
    'void_network', 'unresolved_form'
})
STATUS = frozenset({'source', 'inferred', 'proposed'})
FRAME_KINDS = frozenset({'pixel', 'local3d', 'geospatial3d'})


def _nonblank(value, name):
    if not isinstance(value, str) or not value.strip():
        raise ValueError(f'{name} must be nonblank')
    return value


@dataclass(frozen=True)
class Frame:
    id: str
    kind: str
    units: str
    crs: str | None = None
    vertical_datum: str | None = None

    def __post_init__(self):
        _nonblank(self.id, 'frame id')
        if self.kind not in FRAME_KINDS:
            raise ValueError(f'Unknown frame kind: {self.kind}')
        if self.kind == 'pixel':
            if self.units != 'px' or self.crs is not None or self.vertical_datum is not None:
                raise ValueError('Pixel frames use px without a CRS or vertical datum')
        elif self.kind == 'local3d':
            if self.units not in ('m', 'ft', 'model_unit') or self.crs is not None:
                raise ValueError('Local frame must specify m, ft, or model_unit, without a CRS')
            if self.vertical_datum is not None:
                raise ValueError('Local frames need a local origin, not a geospatial height datum')
        else:
            if self.units != 'm' or not self.crs or not self.vertical_datum:
                raise ValueError('Geospatial 3D frames require CRS, meters and explicit vertical datum')
            # 'unknown' records absence of elevation datum; it does not manufacture one.


@dataclass(frozen=True)
class Source:
    id: str
    kind: str
    sha256: str
    locator: str
    frame_id: str | None
    observed_as: str = 'source'

    @classmethod
    def from_file(cls, id, kind, path, frame_id, observed_as='source'):
        """Ingest actual bytes instead of accepting an unverified supplied digest."""
        location = Path(path)
        if not location.is_file():
            raise FileNotFoundError(location)
        hasher = sha256()
        with location.open('rb') as stream:
            for chunk in iter(lambda: stream.read(1024 * 1024), b''):
                hasher.update(chunk)
        return cls(id, kind, hasher.hexdigest(), str(location), frame_id, observed_as)

    def __post_init__(self):
        _nonblank(self.id, 'source id')
        _nonblank(self.locator, 'source locator')
        if self.kind not in SOURCE_KINDS:
            raise ValueError(f'Unknown source kind: {self.kind}')
        if not isinstance(self.sha256, str) or not HEX_SHA256.fullmatch(self.sha256):
            raise ValueError('Every source needs a lowercase SHA256 content digest')
        if self.observed_as not in STATUS:
            raise ValueError('Unknown source epistemic status')
        if self.kind == 'text_testimony' and self.frame_id is not None:
            raise ValueError('Text testimony has no implied metric or image frame')
        if self.kind != 'text_testimony' and not self.frame_id:
            raise ValueError('Geometric or image evidence requires an explicit frame')


@dataclass(frozen=True)
class Element:
    handle: str
    kind: str
    witness_ids: tuple[str, ...] = ()
    capabilities: tuple[str, ...] = ()
    epistemic: str = 'proposed'
    body_token: str | None = None

    def __post_init__(self):
        _nonblank(self.handle, 'element handle')
        if self.kind not in ELEMENT_KINDS or self.epistemic not in STATUS:
            raise ValueError('Unsupported representation or epistemic status')
        if self.kind == 'cad_body' and not self.body_token:
            raise ValueError('A CAD body needs a separate constructive-body reference')
        if self.kind != 'cad_body' and self.body_token is not None:
            raise ValueError('Only a CAD body may carry a CAD body token')
        if any(not c.startswith('#has/') or len(c) <= 5 for c in self.capabilities):
            raise ValueError('Capabilities must use #has/<descriptor>')
        if self.epistemic == 'source' and not self.witness_ids:
            raise ValueError('An observed/source-level element needs a source reference')


@dataclass(frozen=True)
class Relation:
    subject: str
    verb: str
    object: str
    epistemic: str = 'proposed'
    witness_ids: tuple[str, ...] = ()

    def __post_init__(self):
        _nonblank(self.subject, 'relation subject')
        _nonblank(self.verb, 'relation verb')
        _nonblank(self.object, 'relation object')
        if self.epistemic not in STATUS:
            raise ValueError('Unknown relation epistemic status')
        if self.epistemic == 'source' and not self.witness_ids:
            raise ValueError('A source-attested relationship needs source evidence')


@dataclass(frozen=True)
class RegistrationReceipt:
    """Records verification evidence; no transform is fabricated by this class."""
    source_frame: str
    target_frame: str
    method: str
    state: str = 'provisional'
    anchor_sources: tuple[str, ...] = ()
    residual: float | None = None
    residual_units: str | None = None

    def __post_init__(self):
        _nonblank(self.method, 'registration method')
        if self.state not in ('provisional', 'verified'):
            raise ValueError('Invalid registration state')
        if self.source_frame == self.target_frame:
            raise ValueError('Registration requires distinct frames')
        if self.state == 'verified':
            if not self.anchor_sources or self.residual is None or not self.residual_units:
                raise ValueError('Verified registration needs anchors and measured residual')
            import math
            if not math.isfinite(self.residual) or self.residual < 0:
                raise ValueError('Registration residual must be finite and nonnegative')


class LocationStack:
    """Heterogeneous evidence and construction inventory under one location name.

    A single architectural *body* must pass its own CAD gate. Unrelated bodies,
    terrain and other elements are never forcibly fused at location scope.
    """
    def __init__(self, location_id: str, pet_name: str | None = None):
        self.location_id = _nonblank(location_id, 'location id')
        self.pet_name = pet_name
        self.frames: dict[str, Frame] = {}
        self.sources: dict[str, Source] = {}
        self.elements: dict[str, Element] = {}
        self.relations: list[Relation] = []
        self.registrations: list[RegistrationReceipt] = []

    def add_frame(self, frame: Frame):
        if frame.id in self.frames:
            raise ValueError(f'Duplicate frame: {frame.id}')
        self.frames[frame.id] = frame
        return self

    def add_source(self, source: Source):
        if source.id in self.sources:
            raise ValueError(f'Duplicate source: {source.id}')
        self.sources[source.id] = source
        return self

    def add_element(self, element: Element):
        if element.handle in self.elements:
            raise ValueError(f'Duplicate element: {element.handle}')
        self.elements[element.handle] = element
        return self

    def relate(self, relation: Relation):
        self.relations.append(relation)
        return self

    def register(self, receipt: RegistrationReceipt):
        self.registrations.append(receipt)
        return self

    def audit(self):
        for source in self.sources.values():
            if source.frame_id is not None and source.frame_id not in self.frames:
                raise ValueError(f'Source {source.id} references an unknown frame')
            if source.frame_id is not None:
                f = self.frames[source.frame_id]
                if source.kind in ('single_image', 'image_set', 'drawing') and f.kind != 'pixel':
                    raise ValueError(f'{source.kind} needs a pixel frame')
                if source.kind in ('dem', 'point_cloud', 'photogrammetry_mesh', 'cad_model', 'survey_control') and f.kind == 'pixel':
                    raise ValueError(f'{source.kind} cannot claim a pixel-only 3D frame')
        for element in self.elements.values():
            for witness in element.witness_ids:
                if witness not in self.sources:
                    raise ValueError(f'Element {element.handle} references unknown source {witness}')
        containment = defaultdict(list)
        for rel in self.relations:
            if rel.subject not in self.elements or rel.object not in self.elements:
                raise ValueError('Relations must connect known elements')
            for witness in rel.witness_ids:
                if witness not in self.sources:
                    raise ValueError(f'Relation references unknown source {witness}')
            if rel.verb == 'contains':
                containment[rel.subject].append(rel.object)
        visited, active = set(), set()
        def visit(node):
            if node in active:
                raise ValueError('Location containment graph contains a cycle')
            if node in visited:
                return
            active.add(node)
            for child in containment[node]:
                visit(child)
            active.remove(node)
            visited.add(node)
        for entity_id in self.elements:
            visit(entity_id)
        for receipt in self.registrations:
            if receipt.source_frame not in self.frames or receipt.target_frame not in self.frames:
                raise ValueError('Registration references an unknown frame')
            for anchor in receipt.anchor_sources:
                if anchor not in self.sources:
                    raise ValueError('Registration anchor has no source evidence')
            if receipt.state == 'verified':
                # A source cannot independently certify the mapping of its own
                # pixel frame to metric space. Require an external 3D anchor.
                anchors = [self.sources[a] for a in receipt.anchor_sources]
                if (self.frames[receipt.source_frame].kind == 'pixel' and
                    not any(a.frame_id != receipt.source_frame and a.kind == 'survey_control' for a in anchors)):
                    raise ValueError('Pixel-to-world registration requires independent surveyed control')
        return {
            'valid': True,
            'location_id': self.location_id,
            'frames': len(self.frames), 'sources': len(self.sources),
            'elements': len(self.elements),
            'cad_bodies': sum(e.kind == 'cad_body' for e in self.elements.values()),
            'relations': len(self.relations),
            'verified_registrations': sum(r.state == 'verified' for r in self.registrations),
        }

    def audit_cad_bodies(self, assemblies: dict[str, object]):
        """Check each CAD body separately; no scene-wide Boolean fusion."""
        validated = []
        for element in self.elements.values():
            if element.kind != 'cad_body':
                continue
            if element.body_token not in assemblies:
                raise ValueError(f'Missing live CAD body: {element.body_token}')
            report = assemblies[element.body_token].audit(join=True)
            if (not report.get('valid') or not report.get('union_valid')
                    or report.get('union_solids') != 1):
                raise ValueError(f'Invalid CAD body: {element.handle}')
            validated.append(element.handle)
        return tuple(sorted(validated))

    def to_dict(self):
        data = {
            'schema': SCHEMA, 'location_id': self.location_id,
            'pet_name': self.pet_name,
            'frames': [asdict(self.frames[k]) for k in sorted(self.frames)],
            'sources': [asdict(self.sources[k]) for k in sorted(self.sources)],
            'elements': [asdict(self.elements[k]) for k in sorted(self.elements)],
            'relations': [asdict(r) for r in self.relations],
            'registrations': [asdict(r) for r in self.registrations],
        }
        serialized = json.dumps(data, sort_keys=True, separators=(',', ':'), ensure_ascii=False)
        data['snapshot_sha256'] = sha256(serialized.encode('utf8')).hexdigest()
        return data

    @classmethod
    def from_dict(cls, data):
        if data.get('schema') != SCHEMA:
            raise ValueError('Location-stack schema is not the active contract')
        recorded = data.get('snapshot_sha256')
        unsigned = {k: v for k, v in data.items() if k != 'snapshot_sha256'}
        encoded = json.dumps(unsigned, sort_keys=True, separators=(',', ':'), ensure_ascii=False)
        if not recorded or sha256(encoded.encode('utf8')).hexdigest() != recorded:
            raise ValueError('Location snapshot digest mismatch')
        stack = cls(data['location_id'], data.get('pet_name'))
        for row in data['frames']:
            stack.add_frame(Frame(**row))
        for row in data['sources']:
            stack.add_source(Source(**row))
        for row in data['elements']:
            # Normalize persisted sequences to the immutable in-memory contract.
            row = dict(row)
            row['witness_ids'] = tuple(row.get('witness_ids', ()))
            row['capabilities'] = tuple(row.get('capabilities', ()))
            stack.add_element(Element(**row))
        for row in data['relations']:
            row = dict(row)
            row['witness_ids'] = tuple(row.get('witness_ids', ()))
            stack.relate(Relation(**row))
        for row in data['registrations']:
            row = dict(row)
            row['anchor_sources'] = tuple(row.get('anchor_sources', ()))
            stack.register(RegistrationReceipt(**row))
        stack.audit()
        return stack

    @classmethod
    def load(cls, path):
        return cls.from_dict(json.loads(Path(path).read_text(encoding='utf8')))

    def save(self, path):
        self.audit()
        p = Path(path)
        p.parent.mkdir(parents=True, exist_ok=True)
        tmp = p.with_name(p.name + '.pending')
        tmp.write_text(json.dumps(self.to_dict(), indent=2, ensure_ascii=False) + '\n', encoding='utf8')
        tmp.replace(p)
