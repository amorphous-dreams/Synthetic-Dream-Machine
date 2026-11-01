"""YIN source-bound construction seal: subtraction never erases authored bodies.

Semantic growth and inherited source have different authority. This audit
keeps original native bodies and relation declarations immutable while
allowing explicitly generated architecture to enter a new construction.
It cannot certify STEP contacts or structural capacity.
"""
from __future__ import annotations
from .place_genome import PlaceGenome
from .provenance_encoding import canonical_json_sha256


def seal_constructive_growth(original:PlaceGenome,proposed:PlaceGenome):
    if not isinstance(original,PlaceGenome) or not isinstance(proposed,PlaceGenome):
        raise ValueError("Construction seal needs original and proposed typed genomes")
    old={b.entity_id:b for b in original.bodies}
    new={b.entity_id:b for b in proposed.bodies}
    if not set(old)<=set(new):
        raise ValueError("Construction must preserve all original native body identities")
    for key,body in old.items():
        if new[key]!=body:
            raise ValueError("Construction replaced an original authored native body")
    additions=sorted(set(new)-set(old))
    if len(new)>16:
        raise ValueError("Construction exceeded bounded independent body budget")
    added={}
    for field in ("walkways","ascents","bearings"):
        before=getattr(original,field)
        after=getattr(proposed,field)
        prev={canonical_json_sha256(v.to_dict()) for v in before}
        now={canonical_json_sha256(v.to_dict()) for v in after}
        if not prev<=now:
            raise ValueError("Construction discarded an original authored relation")
        added[field]=[row.to_dict() for row in after
                      if canonical_json_sha256(row.to_dict()) not in prev]
    body={"schema":"projection-loom/source-preserving-growth-seal",
          "original_genome_sha256":original.identity,
          "proposed_genome_sha256":proposed.identity,
          "preserved_original_bodies":sorted(old),
          "generated_body_ids":additions,
          "added_relations":added,
          "original_bodies_rewritten":False,
          "native_audition_completed":False,
          "automatic_promotion":False}
    return {**body,"sha256":canonical_json_sha256(body)}


def verify_constructive_growth(original,proposed,receipt):
    if receipt!=seal_constructive_growth(original,proposed):
        raise ValueError("Original construction source seal changed")
    return True
