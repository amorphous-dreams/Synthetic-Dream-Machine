"""Observed native audition and rule-presence funnels."""
import pytest
from projection_loom.developmental import GrowthNode, GrowthProgram
from projection_loom.generalized_campaign import activation_funnels


def offer(identity, method, with_spawn=True):
    nodes = [GrowthNode("root", "foundation", size=(5, 5, 2))]
    if with_spawn:
        nodes.append(GrowthNode("roof", "spawn", parent="root",
                                face="up", size=(1.5, 1.5, 1)))
    return {"id": identity, "emitter": method, "program": GrowthProgram(tuple(nodes))}


def test_funnel_does_not_conflate_offered_admitted_deferred():
    offered = [offer("a", "initial"), offer("b", "mutation"),
               offer("c", "topology", False)]
    result = activation_funnels(offered, offered[:2],
        [{"id": "a", "state": "native-valid"},
         {"id": "b", "state": "native-rejected"}])
    assert result["emitters"]["initial"]["native_valid"] == 1
    assert result["emitters"]["mutation"]["native_rejected"] == 1
    assert result["emitters"]["topology"]["deferred"] == 1
    assert result["declared_rule_presence"]["foundation"]["proposed"] == 3
    assert result["declared_rule_presence"]["foundation"]["attempted"] == 2
    assert result["declared_rule_presence"]["spawn"]["proposed"] == 2


def test_funnel_refuses_missing_duplicate_and_unknown_receipts():
    offered = [offer("a", "mutation"), offer("b", "mutation")]
    with pytest.raises(ValueError, match="disagree"):
        activation_funnels(offered, offered[:1], [])
    with pytest.raises(ValueError, match="Repeated selected"):
        activation_funnels(offered, offered[:1] * 2,
                           [{"id": "a", "state": "native-valid"}] * 2)
    with pytest.raises(ValueError, match="Unknown exact audition"):
        activation_funnels(offered, offered[:1],
                           [{"id": "a", "state": "succeeded-maybe"}])


def test_funnel_preserves_operational_error():
    item = offer("a", "topology")
    result = activation_funnels([item], [item],
                                [{"id": "a", "state": "operational-error"}])
    assert result["emitters"]["topology"]["operational_error"] == 1
    assert result["emitters"]["topology"]["native_valid"] == 0
