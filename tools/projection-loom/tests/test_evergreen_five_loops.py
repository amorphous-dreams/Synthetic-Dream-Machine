"""Five widening OODA-HA passes; guard evergreen contracts and native authority.

The tests start as RED contracts. No historic archive is opened for writing.
"""
import hashlib
import json
from pathlib import Path

import numpy as np
import pytest
from PIL import Image

from projection_loom.campaign import visual_descriptor
from projection_loom.feature_evidence import FeatureEvidence
from projection_loom.genetic_transfer import (
    build_transfer_seed, bundle_transfers, verify_transfer_bundle,
)


def _seed(*, focus=("x",), donor=None):
    return build_transfer_seed(
        {"x": (0.0, 10.0)}, {"x": (-2.0, 2.0)},
        family="needle", donor_id="gen-3/needle",
        source_recipe_sha256="a" * 64, target_recipe_sha256="b" * 64,
        donor_genome=donor or {"x": 8.0},
        focus=focus, authorized=True,
    )


def test_pulse_tiny_mask_never_emits_nan_or_inf():
    for height in (1, 2, 5, 6):
        pixels=np.zeros((height, 7), dtype=bool)
        pixels[0, 3]=True
        trait=visual_descriptor(pixels)
        assert len(trait["region_coverage"])==6
        assert all(np.isfinite(v) for v in trait["region_coverage"])
        assert all(v>=0 for v in trait["region_coverage"])
        assert trait["region_coverage"][0]>0
    empty=visual_descriptor(np.zeros((1, 4),dtype=bool))
    assert empty["niche"]=="empty"
    assert empty["region_coverage"]==[0.0]*6


def test_pulse_rejects_malformed_transfer_identifiers_duplicate_or_nonfinite_loci():
    with pytest.raises(ValueError,match="focus|duplicate"):
        _seed(focus=("x", "x"))
    with pytest.raises(ValueError,match="locus|focus"):
        _seed(focus=("x", "unknown"))
    with pytest.raises(ValueError,match="finite|bounds"):
        _seed(donor={"x":float("nan")})
    with pytest.raises(ValueError,match="digest|sha"):
        build_transfer_seed({"x":(0,10)},{"x":(0,1)},family="needle",
            donor_id="donor",source_recipe_sha256="invalid",
            target_recipe_sha256="b"*64,donor_genome={"x":.5},
            focus=("x",),authorized=True)
    bundle=bundle_transfers([_seed()],target_recipe_sha256="b"*64)
    forged=json.loads(json.dumps(bundle))
    forged["seeds"][0]["loci"]["x"]=True
    forged.pop("sha256")
    from projection_loom.provenance_encoding import canonical_json_sha256
    forged["sha256"]=canonical_json_sha256(forged)
    with pytest.raises(ValueError,match="locus|finite|bounded"):
        verify_transfer_bundle(forged,target_recipe_sha256="b"*64,
            target_bounds={"x":(-2,2)},family_focus={"needle":("x",)})


def test_pulse_feature_manifest_refuses_symlink_escape_even_when_digest_matches(tmp_path):
    outside=tmp_path/"outside.png"
    Image.fromarray(np.full((12,16),255,dtype=np.uint8),"L").save(outside)
    folder=tmp_path/"evidence"
    folder.mkdir()
    (folder/"region.png").symlink_to(outside)
    manifest=folder/"feature.json"
    manifest.write_text(json.dumps({
        "schema":"projection-loom/feature-evidence/v1",
        "source_sha256":"a"*64,"evidence_state":"operator-annotated",
        "regions":{"Fortress":{"path":"region.png",
                 "sha256":hashlib.sha256(outside.read_bytes()).hexdigest()}}
    }))
    with pytest.raises(ValueError,match="outside|escape|symlink"):
        FeatureEvidence.load(manifest,source_sha256="a"*64,score_size=(16,12))
