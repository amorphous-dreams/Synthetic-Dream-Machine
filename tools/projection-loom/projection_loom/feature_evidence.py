"""Operator annotations are digest-bound masks, not independently registered sources."""
from __future__ import annotations
import json
from hashlib import sha256
from pathlib import Path
import numpy as np
from PIL import Image
from .provenance_encoding import canonical_json_sha256

FAMILY_ENTITY={'needle':'Crystal','fractured':'Crystal','crystal':'Crystal',
               'terraces':'Joining','crown':'Fortress','keep':'Fortress'}

class FeatureEvidence:
    def __init__(self, masks, digest, *, source_sha256):
        self.masks=masks
        self.digest=digest
        self.source_sha256=source_sha256
    @classmethod
    def load(cls,path,*,source_sha256,score_size):
        path=Path(path)
        data=json.loads(path.read_text(encoding='utf8'))
        if data.get('schema')!='projection-loom/feature-evidence/v1':
            raise ValueError('Unsupported feature evidence schema')
        if data.get('source_sha256')!=source_sha256:
            raise ValueError('Feature evidence source digest mismatch')
        if data.get('evidence_state')!='operator-annotated':
            raise ValueError('Feature evidence is operator-annotated, not verified registration')
        from .campaign import FAMILY_ENTITIES
        valid=set(FAMILY_ENTITIES.values())
        regions=data.get('regions')
        if not isinstance(regions,dict) or not regions or set(regions)-valid:
            raise ValueError('Feature evidence needs known entity regions')
        masks={}
        digests={}
        for entity, record in sorted(regions.items()):
            relative=Path(record['path'])
            if relative.is_absolute() or '..' in relative.parts:
                raise ValueError('Feature evidence must stay beside its manifest')
            file=(path.parent/relative).resolve()
            if not file.is_file() or sha256(file.read_bytes()).hexdigest()!=record.get('sha256'):
                raise ValueError('Feature evidence mask digest mismatch')
            with Image.open(file) as image:
                if image.size!=tuple(score_size):
                    raise ValueError('Feature mask dimensions differ from scoring camera')
                pixels=np.asarray(image.convert('L'))>127
            if not pixels.any():
                raise ValueError('Empty feature attention mask')
            masks[entity]=pixels
            digests[entity]=record['sha256']
        digest=canonical_json_sha256({'source_sha256':source_sha256,
                                     'mask_digests':digests,'score_size':list(score_size)})
        return cls(masks,digest,source_sha256=source_sha256)
    def mask_for(self,family):
        if family not in FAMILY_ENTITY:
            raise ValueError('Unknown feature family')
        return self.masks.get(FAMILY_ENTITY[family])
