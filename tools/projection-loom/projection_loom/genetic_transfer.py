"""Operator-authorized normalized gene proposals; never source or CAD promotion.

The SHA-256 receipt detects accidental edits and binds a target recipe. It does
not cryptographically prove who authorized the seed; the explicit CLI decision
does that, so it must remain visible in its original operator context.
"""
from __future__ import annotations
from copy import deepcopy
import math
import re
from .provenance_encoding import canonical_json_sha256

TRANSFER_SEED="projection-loom/transfer-seed/v1"
TRANSFER_BUNDLE="projection-loom/transfer-bundle/v1"


def _digest(value):
    return isinstance(value,str) and re.fullmatch(r"[a-f0-9]{64}",value) is not None


def _finite(value):
    return not isinstance(value,bool) and isinstance(value,(float,int)) and math.isfinite(value)


def build_transfer_seed(source_bounds,target_bounds,*,family,source_recipe_sha256,
                        target_recipe_sha256,donor_id,donor_genome,focus,authorized=False):
    if authorized is not True:
        raise PermissionError('Cross-location transfer requires Operator authorization')
    if (not _digest(source_recipe_sha256) or not _digest(target_recipe_sha256)
            or source_recipe_sha256==target_recipe_sha256):
        raise ValueError('Transfer requires distinct source and target SHA-256 recipe digests')
    if (not isinstance(family,str) or not family.strip()
            or not isinstance(donor_id,str) or not donor_id.strip()):
        raise ValueError('Transfer needs a family and an attributed donor')
    if not isinstance(focus,(list,tuple)) or not focus or len(focus)!=len(set(focus)):
        raise ValueError('Transfer focus must be nonempty without duplicate loci')
    if any(key not in source_bounds or key not in target_bounds for key in focus):
        raise ValueError('Transfer focus needs shared source/target loci')
    values={}
    for key in focus:
        if key not in donor_genome:
            raise ValueError('Transfer donor genome missing locus')
        a,b=source_bounds[key]
        lo,hi=target_bounds[key]
        donor=donor_genome[key]
        if (not all(_finite(v) for v in (a,b,lo,hi,donor))
                or b<=a or hi<=lo or not a<=donor<=b):
            raise ValueError('Nonfinite or out of bounds transfer locus')
        values[key]=float((donor-a)/(b-a))
    return {'schema':TRANSFER_SEED,'family':family,
            'donor_id':donor_id,'source_recipe_sha256':source_recipe_sha256,
            'target_recipe_sha256':target_recipe_sha256,'loci':values,
            'authority':'proposal-only','operator_authorized':True}


def bundle_transfers(seeds,*,target_recipe_sha256):
    if not _digest(target_recipe_sha256):
        raise ValueError('Transfer target needs a recipe SHA-256 digest')
    seeds=deepcopy(list(seeds))
    if any(seed.get('target_recipe_sha256')!=target_recipe_sha256 for seed in seeds):
        raise ValueError('Transfer target recipe mismatch')
    body={'schema':TRANSFER_BUNDLE,'target_recipe_sha256':target_recipe_sha256,
          'seeds':seeds}
    body['sha256']=canonical_json_sha256(body)
    return body


def verify_transfer_bundle(bundle,*,target_recipe_sha256,target_bounds,family_focus):
    if not isinstance(bundle,dict):
        raise ValueError('Transfer bundle must hold a receipt')
    body=deepcopy(bundle)
    signature=body.pop('sha256',None)
    if not _digest(signature) or signature!=canonical_json_sha256(body):
        raise ValueError('Transfer bundle digest mismatch')
    if (body.get('schema')!=TRANSFER_BUNDLE or
            body.get('target_recipe_sha256')!=target_recipe_sha256):
        raise ValueError('Transfer target identity mismatch')
    if not isinstance(body.get('seeds'),list):
        raise ValueError('Transfer bundle needs a list of donor seeds')
    results=[]
    for seed in body['seeds']:
        if not isinstance(seed,dict) or seed.get('schema')!=TRANSFER_SEED:
            raise ValueError('Transfer seed needs a known receipt schema')
        family=seed.get('family')
        if (seed.get('operator_authorized') is not True
                or seed.get('authority')!='proposal-only'
                or seed.get('target_recipe_sha256')!=target_recipe_sha256
                or not _digest(seed.get('source_recipe_sha256'))
                or seed['source_recipe_sha256']==target_recipe_sha256
                or not isinstance(seed.get('donor_id'),str)
                or not seed['donor_id'].strip()
                or family not in family_focus):
            raise ValueError('Transfer seed target, authority, or family invalid')
        if not isinstance(seed.get('loci'),dict) or not seed['loci']:
            raise ValueError('Transfer seed must provide bounded donor loci')
        for key,value in seed['loci'].items():
            if (key not in family_focus[family] or key not in target_bounds
                    or not _finite(value) or not 0<=value<=1):
                raise ValueError('Transfer seed has unauthorized or unbounded locus')
        results.append(seed)
    return results
