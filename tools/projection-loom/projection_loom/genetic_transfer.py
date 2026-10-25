"""Explicit operator-authorized source/target fragment transfer; never source promotion."""
from __future__ import annotations
from copy import deepcopy
from .provenance_encoding import canonical_json_sha256

def build_transfer_seed(source_bounds,target_bounds,*,family,source_recipe_sha256,
                        target_recipe_sha256,donor_id,donor_genome,focus,authorized=False):
    if not authorized:
        raise PermissionError('Cross-location transfer requires Operator authorization')
    if not source_recipe_sha256 or not target_recipe_sha256 or source_recipe_sha256==target_recipe_sha256:
        raise ValueError('Transfer requires distinct source and target recipes')
    if not family or not donor_id or not focus or set(focus)-set(source_bounds)&set(target_bounds):
        raise ValueError('Transfer requires known compatible normalized loci')
    values={}
    for key in focus:
        if key not in source_bounds or key not in target_bounds or key not in donor_genome:
            raise ValueError('Missing source or target transfer locus')
        a,b=source_bounds[key]; lo,hi=target_bounds[key]
        if b<=a or hi<=lo or not a<=float(donor_genome[key])<=b:
            raise ValueError('Out of bounds transfer locus')
        values[key]=(float(donor_genome[key])-a)/(b-a)
    return {'schema':'projection-loom/transfer-seed/v1','family':family,
            'donor_id':donor_id,'source_recipe_sha256':source_recipe_sha256,
            'target_recipe_sha256':target_recipe_sha256,'loci':values,
            'authority':'proposal-only','operator_authorized':True}

def bundle_transfers(seeds,*,target_recipe_sha256):
    seeds=deepcopy(list(seeds))
    if any(s.get('target_recipe_sha256')!=target_recipe_sha256 for s in seeds):
        raise ValueError('Transfer target recipe mismatch')
    body={'schema':'projection-loom/transfer-bundle/v1',
          'target_recipe_sha256':target_recipe_sha256,'seeds':seeds}
    body['sha256']=canonical_json_sha256(body)
    return body

def verify_transfer_bundle(bundle,*,target_recipe_sha256,target_bounds,family_focus):
    body=deepcopy(bundle)
    digest=body.pop('sha256',None)
    if digest!=canonical_json_sha256(body):
        raise ValueError('Transfer bundle digest mismatch')
    if body.get('schema')!='projection-loom/transfer-bundle/v1' or body.get('target_recipe_sha256')!=target_recipe_sha256:
        raise ValueError('Transfer target identity mismatch')
    results=[]
    for seed in body['seeds']:
        family=seed['family']
        if (not seed.get('operator_authorized') or seed.get('authority')!='proposal-only'
            or seed['target_recipe_sha256']!=target_recipe_sha256 or family not in family_focus):
            raise ValueError('Transfer seed target, authority, or family invalid')
        for key,value in seed['loci'].items():
            import math
            if key not in family_focus[family] or key not in target_bounds or not isinstance(value,(int,float)) or not math.isfinite(value) or not 0<=value<=1:
                raise ValueError('Transfer seed has unauthorized or unbounded locus')
        results.append(seed)
    return results
