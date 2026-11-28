"""Exact same-camera expression math does not grant architecture approval."""
import numpy as np
import pytest
from projection_loom.fire_expression import mask_comparison, difference_image


def test_source_paired_expression_distinguishes_added_removed_and_shared():
    a = np.array([[True, True, False], [False, False, False]], dtype=bool)
    b = np.array([[True, False, True], [False, False, False]], dtype=bool)
    record = mask_comparison(a, b)
    assert (record["appeared"], record["disappeared"], record["shared"]) == (1, 1, 1)
    assert record["changed"] == 2
    assert record["original_occupied"] == record["variant_occupied"] == 2
    assert record["silhouette_iou"] == pytest.approx(1 / 3)
    assert record["original_mask_sha256"] != record["variant_mask_sha256"]
    assert tuple(difference_image(a, b).getpixel((2, 0))) == (74, 204, 225)
    assert tuple(difference_image(a, b).getpixel((1, 0))) == (239, 118, 106)


def test_identity_and_empty_views_have_defined_comparison():
    empty = np.zeros((2, 3), dtype=bool)
    assert mask_comparison(empty, empty)["silhouette_iou"] == 1.0
    assert mask_comparison(~empty, ~empty)["changed"] == 0
    with pytest.raises(ValueError, match="same-size"):
        mask_comparison(empty, empty[:, :2])
    with pytest.raises(ValueError, match="boolean"):
        mask_comparison(empty.astype("uint8"), empty)
