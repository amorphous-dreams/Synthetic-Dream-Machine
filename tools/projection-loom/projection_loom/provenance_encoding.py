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


def first_json_difference(expected, observed, path="$"):
    """Locate the first divergence; never reinterpret or forgive a receipt.

    Both arguments already carry the requested authority. This function
    supplies diagnostics only; the caller MUST still refuse on any mismatch.
    """
    if type(expected) is not type(observed):
        return path + " (type)"
    if isinstance(expected, dict):
        if set(expected) != set(observed):
            missing=sorted(set(expected)-set(observed))
            extra=sorted(set(observed)-set(expected))
            key=(missing or extra)[0]
            return path + "." + str(key) + (" (missing)" if missing else " (unexpected)")
        for key in sorted(expected):
            diff=first_json_difference(expected[key],observed[key],path+"."+str(key))
            if diff is not None:
                return diff
        return None
    if isinstance(expected, list):
        if len(expected)!=len(observed):
            return path + " (length)"
        for i,(left,right) in enumerate(zip(expected,observed)):
            diff=first_json_difference(left,right,path+f"[{i}]")
            if diff is not None:
                return diff
        return None
    return None if expected==observed else path
