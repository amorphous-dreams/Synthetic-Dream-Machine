"""RED-first contract: lift canonical JSON *encoding*, not authority.

Five modules share a byte-canonicalization algorithm. Keep strict JSON scopes
strict; keep historically permitted non-finite encoding for legacy relational
witness and location snapshot fingerprints. Files and kernel audits retain
distinct native evidence and digest authorities.
"""
from hashlib import sha256
import json
import math
import pytest

from projection_loom.provenance_encoding import canonical_json_sha256
from projection_loom.epochs import _hash as epoch_hash
from projection_loom.capability_stack import digest as recipe_digest
from projection_loom.fractal_ooda_ha import _fingerprint as session_fingerprint
from projection_loom.relations import _digest as relation_digest
from projection_loom.location_stack import LocationStack


UNICODE_FIXTURE = {'z': [3, {'μ': 'Hā Ka'}], 'a': 0.5}
FULL = 'd9eb31ea682c4c0e0410c290770cc8e8c85ac0db88edc464567e8e1c1557caf7'
NAN_LEGACY = '159f99e03ec6dfb7edcad87bac613ac97a235493ad8b79b33cfa4002fb4477f8'
EMPTY_LOCATION = 'd12defae4f252b26aba23f740ad8476a3e2ce77aed791561564ec9c1ce0f7c13'


def test_full_fingerprints_preserve_exact_unicode_bytes_and_field_order():
    assert canonical_json_sha256(UNICODE_FIXTURE) == FULL
    assert canonical_json_sha256(dict(reversed(list(UNICODE_FIXTURE.items())))) == FULL
    assert epoch_hash(UNICODE_FIXTURE) == FULL
    assert recipe_digest(UNICODE_FIXTURE) == FULL
    assert session_fingerprint(UNICODE_FIXTURE) == FULL


def test_relational_witness_keeps_short_identity_without_claiming_full_scope():
    assert relation_digest(UNICODE_FIXTURE) == FULL[:20]
    assert len(relation_digest(UNICODE_FIXTURE)) == 20
    assert relation_digest({'value': math.nan}) == NAN_LEGACY[:20]


def test_strict_scopes_reject_nonfinite_while_legacy_permissive_is_explicit():
    bad = {'value': math.nan}
    assert canonical_json_sha256(bad, allow_nan=True) == NAN_LEGACY
    for hash_func in (canonical_json_sha256, epoch_hash,
                      recipe_digest, session_fingerprint):
        with pytest.raises(ValueError):
            hash_func(bad)


def test_location_snapshot_uses_evergreen_identity_and_rejects_tampering():
    stack = LocationStack('New Delos')
    payload = stack.to_dict()
    assert payload['schema'] == 'projection-loom/location-stack'
    assert payload['snapshot_sha256'] == EMPTY_LOCATION
    assert canonical_json_sha256({
        k: v for k, v in payload.items() if k != 'snapshot_sha256'
    }, allow_nan=True) == EMPTY_LOCATION
    assert LocationStack.from_dict(payload).to_dict()['snapshot_sha256'] == EMPTY_LOCATION
    corrupted = {**payload, 'pet_name': 'An unauthorized change'}
    with pytest.raises(ValueError, match='digest mismatch'):
        LocationStack.from_dict(corrupted)


def test_source_file_checksum_never_becomes_a_serialized_model_hash():
    data = 'Hā Ka'.encode('utf8')
    assert sha256(data).hexdigest() != canonical_json_sha256('Hā Ka')
    assert canonical_json_sha256('Hā Ka') == canonical_json_sha256(json.loads('"Hā Ka"'))
