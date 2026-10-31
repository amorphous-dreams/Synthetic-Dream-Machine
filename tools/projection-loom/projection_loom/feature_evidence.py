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
    def __init__(self, masks, digest, *, source_sha256, view_sha256=None):
        self.masks=masks
        self.digest=digest
        self.source_sha256=source_sha256
        self.view_sha256=view_sha256

    @staticmethod
    def view_identity(project, score_size):
        """Bind Operator attention to its actual unregistered fixed camera."""
        return canonical_json_sha256({
            'reference_view':project.reference_view,
            'camera':project.cameras[project.reference_view].to_dict(),
            'score_size':list(score_size)})
    @classmethod
    def author(cls,project,regions,out,*,score_size):
        """Snapshot Operator supplied PNG regions with exact source/image digests.

        No region is inferred from the painting and no registration is created.
        The resulting manifest is a local annotation receipt only.
        """
        from shutil import copyfile
        if project.reference is None or not project.reference.is_file():
            raise ValueError('Feature annotation requires an actual source image')
        if not isinstance(regions,dict) or not regions or set(regions)-set(FAMILY_ENTITY.values()):
            raise ValueError('Feature annotations require known entity names')
        target=Path(out)
        if target.exists():
            raise ValueError('Feature annotation manifest already exists')
        entries={}
        for entity,file in sorted(regions.items()):
            original=Path(file)
            if not original.is_file():
                raise FileNotFoundError(original)
            with Image.open(original) as img:
                if img.size!=tuple(score_size):
                    raise ValueError('Feature mask dimensions differ from scoring camera')
                if not (np.asarray(img.convert('L'))>127).any():
                    raise ValueError('Empty feature attention mask')
            entries[entity]=original
        target.parent.mkdir(parents=True,exist_ok=True)
        copied={}
        for entity,original in entries.items():
            stored=target.parent/('feature-'+entity.lower()+'.png')
            if stored.exists():
                raise ValueError('Feature mask snapshot already exists')
            copyfile(original,stored)
            copied[entity]={'path':stored.name,
                'sha256':sha256(stored.read_bytes()).hexdigest()}
        source_sha256=sha256(project.reference.read_bytes()).hexdigest()
        view_sha256=cls.view_identity(project,score_size)
        manifest={'schema':'projection-loom/feature-evidence',
            'source_sha256':source_sha256,'view_sha256':view_sha256,
            'evidence_state':'operator-annotated','regions':copied}
        target.write_text(json.dumps(manifest,indent=2,sort_keys=True)+'\n',encoding='utf8')
        return cls.load(target,source_sha256=source_sha256,score_size=score_size,
                        view_sha256=view_sha256)

    @classmethod
    def load(cls,path,*,source_sha256,score_size,view_sha256=None):
        path=Path(path)
        data=json.loads(path.read_text(encoding='utf8'))
        if data.get('schema')!='projection-loom/feature-evidence':
            raise ValueError('Unsupported feature evidence schema')
        if data.get('source_sha256')!=source_sha256:
            raise ValueError('Feature evidence source digest mismatch')
        declared_view=data.get('view_sha256')
        if view_sha256 is not None and declared_view!=view_sha256:
            raise ValueError('Feature evidence view/camera digest mismatch')
        if declared_view is not None and (
            not isinstance(declared_view,str) or len(declared_view)!=64):
            raise ValueError('Invalid feature camera digest')
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
            if not file.is_relative_to(path.parent.resolve()):
                raise ValueError('Feature mask symlink escapes its evidence directory')
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
                                     'view_sha256':declared_view,
                                     'mask_digests':digests,'score_size':list(score_size)})
        return cls(masks,digest,source_sha256=source_sha256,
                   view_sha256=declared_view)
    def mask_for(self,family):
        if family not in FAMILY_ENTITY:
            raise ValueError('Unknown feature family')
        return self.masks.get(FAMILY_ENTITY[family])
