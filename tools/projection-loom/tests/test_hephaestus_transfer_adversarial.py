"""N6-C: relationship and geometric contact stay subordinate to actual evidence."""
import json
import pytest
from projection_loom.relational_ground import RelationalGround
from projection_loom.editor_proposals import verify_transfer_receipts


def test_transfer_verification_refuses_missing_and_forged_action():
    request={"support_transfers":[{"child":"c","old_parent":"a","new_parent":"b"}]}
    receipt={"transaction_mode":"support-transfer",
             "support_transfers":[{"transfer":request["support_transfers"][0]}],
             "causal_batch":{"operations":[{"kind":"reparent","target":"c",
                "payload":{"old_parent":"a","new_parent":"b"}}]}}
    with pytest.raises(ValueError, match="matching causal movement"):
        verify_transfer_receipts(request, receipt, None, None)


def test_causal_batch_rejects_unseen_reparent_dependency():
    ground=RelationalGround("n6-descendants")
    for target in ("a","b","c"):
        ground,_=ground.apply({"kind":"create","actor":"author",
            "frontier":list(ground.frontier),"target":target,
            "payload":{"kind":"construct"}})
    ground,_=ground.apply({"kind":"attach","actor":"author",
        "frontier":list(ground.frontier),"target":"c",
        "payload":{"parent":"a","verb":"supports","required":True}})
    before=ground.to_dict()
    with pytest.raises(ValueError, match="cycle|existing|Missing"):
        ground.apply_batch([{"kind":"reparent","target":"c","actor":"author",
            "payload":{"old_parent":"a","new_parent":"b"}},
            {"kind":"reparent","target":"c","actor":"author",
            "payload":{"old_parent":"a","new_parent":"a"}}],
            observed_frontier=list(ground.frontier))
    assert ground.to_dict()==before
