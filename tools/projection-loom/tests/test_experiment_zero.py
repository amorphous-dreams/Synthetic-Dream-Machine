"""Multiobjective review: preserve best source and another distinctive shape."""
import pytest
from projection_loom.experiment_zero import choose_review


def row(ident,family,loss,extra,mask):
    return {"id":ident,"family":family,"combined_loss":loss,
            "observation":{"outer_mask_sha256":mask,"extra_fraction":extra}}


def test_review_preserves_champion_and_distinct_nonchampions():
    choices=choose_review([row("a","needle",.1,0,"mask1"),
                           row("b","needle",.2,0,"mask1"),
                           row("c","crown",.3,.2,"mask2"),
                           row("d","keep",.4,.8,"mask3")],3)
    assert choices[0]["id"]=="a"
    assert {r["id"] for r in choices}=={"a","c","d"}
    with pytest.raises(ValueError,match="seats"):
        choose_review([],0)
