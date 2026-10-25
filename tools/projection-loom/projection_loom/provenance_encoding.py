"""Deterministic JSON fingerprint *encoding*, not a universal evidence claim.

Different authorities still own their own identities: exact CAD audits,
provisional meshes, source file bytes, bounded recipes, relational witnesses,
and OODA-HA sessions. This module only eliminates encoding drift.
"""


from hashlib import sha256
import json


def canonical_json_sha256(value, *, allow_nan=False):
    """Hash sorted, compact UTF-8 JSON bytes, preserving the known contract.

    Strict by default (epochs, recipes, sessions). Existing location snapshots
    and short relational descriptors explicitly retain their permissive JSON
    spelling, so a cleanup does not silently rewrite identity hashes.
    """
    encoded = json.dumps(
        value, sort_keys=True, separators=(',', ':'),
        ensure_ascii=False, allow_nan=allow_nan,
    ).encode('utf8')
    return sha256(encoded).hexdigest()
