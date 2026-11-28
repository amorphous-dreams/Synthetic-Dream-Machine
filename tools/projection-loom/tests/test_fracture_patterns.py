"""Finite statistical fracture priors and deterministic image-space patterns."""
import json
import numpy as np
import pytest
from projection_loom.fracture_patterns import (
    bounded_fragment_sizes, crack_field, export_pattern)


def test_bounded_law_is_seeded_truncated_and_finite():
    a=bounded_fragment_sizes(dimension=3,count=50,min_size=.1,max_size=10,seed=19)
    b=bounded_fragment_sizes(dimension=3,count=50,min_size=.1,max_size=10,seed=19)
    assert a==b
    assert a["beta"]==3.5 and a["retained"]==50
    assert .1<=min(a["sizes"])<=max(a["sizes"])<=10
    limited=bounded_fragment_sizes(dimension=2,count=50,min_size=.1,
                                   max_size=10,seed=19,max_total_measure=.1)
    assert limited["retained"]<50
    with pytest.raises(ValueError,match="count"):
        bounded_fragment_sizes(count=513)


def test_network_is_bounded_repeatable_and_attributed():
    a,mask=crack_field(size=(64,96),cells=16,seed=19)
    b,other=crack_field(size=(64,96),cells=16,seed=19)
    assert a==b and np.array_equal(mask,other)
    assert mask.shape==(96,64) and mask.any()
    assert sum(a["cell_area_pixels"])==64*96
    assert a["junction_observation"]["causal_T_Y_X_classification"]=="not inferred"
    with pytest.raises(ValueError,match="dimensions"):
        crack_field(size=(4096,4096))


def test_pattern_writes_recoverable_image_and_receipt(tmp_path):
    result=export_pattern(tmp_path,size=(64,96),cells=12,fragments=12)
    assert (tmp_path/"cracks.png").is_file()
    assert json.loads((tmp_path/"pattern.json").read_text())==result
    assert export_pattern(tmp_path,size=(64,96),cells=12,fragments=12)==result
    with pytest.raises(ValueError,match="identity"):
        export_pattern(tmp_path,size=(64,96),cells=12,fragments=12,seed=2)
