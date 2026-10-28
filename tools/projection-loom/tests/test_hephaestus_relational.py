"""Independent semantic identity, causal-frontier and refusal witnesses."""
import json
import pytest
from projection_loom.relational_ground import RelationalGround, IDENTITY


def op(action, target, frontier=(), **kw):
    return {"kind": action, "target": target, "frontier": list(frontier),
            "actor": "operator", "payload": kw}


def added(ground, action):
    revised, receipt = ground.apply(action)
    assert receipt["outcome"] == "accepted"
    assert len(revised.events) == len(ground.events) + 1
    return revised


def test_stable_id_reparent_transform_and_representation_rename(tmp_path):
    g = RelationalGround("independent-village")
    for entity in ("old", "new", "terrace", "stair"):
        g = added(g, op("create", entity, g.frontier, kind="construct"))
    g = added(g, op("attach", "terrace", g.frontier, parent="old"))
    g = added(g, op("attach", "stair", g.frontier, parent="terrace"))
    g = added(g, op("reparent", "terrace", g.frontier,
                    old_parent="old", new_parent="new"))
    state = g.snapshot()
    assert "terrace" in state["entities"]
    assert {"parent": "new", "child": "terrace", "verb": "supports",
            "required": True} in state["relations"]
    assert state["entities"]["stair"]["invalidated"]
    before_revision = state["entities"]["terrace"]["revision"]
    g = added(g, op("bind-representation", "terrace", g.frontier,
                    path="/Village/ChangingPrimPath"))
    assert g.snapshot()["entities"]["terrace"]["revision"] == before_revision
    matrix = list(IDENTITY)
    matrix[3] = 7
    g = added(g, op("transform", "terrace", g.frontier,
                    matrix=matrix, frame="local3d"))
    state = g.snapshot()
    assert state["entities"]["terrace"]["id"] == "terrace"
    assert state["entities"]["terrace"]["revision"] != before_revision
    assert state["entities"]["stair"]["invalidated"]
    path = tmp_path / "ground.json"
    g.save(path)
    assert RelationalGround.load(path).to_dict() == g.to_dict()
    assert RelationalGround.load(path).as_prov()["activities"]


def test_support_refusal_and_intentional_invalidation():
    g = RelationalGround("garden")
    for entity in ("root", "child"):
        g = added(g, op("create", entity, g.frontier, kind="construct"))
    g = added(g, op("attach", "child", g.frontier, parent="root"))
    with pytest.raises(ValueError, match="strand"):
        g.apply(op("remove", "root", g.frontier))
    with pytest.raises(ValueError, match="explicit invalidation"):
        g.apply(op("detach", "child", g.frontier, parent="root"))
    g = added(g, op("detach", "child", g.frontier,
                    parent="root", invalidate=True))
    assert g.snapshot()["entities"]["child"]["invalidated"]
    g = added(g, op("remove", "root", g.frontier))
    assert "root" not in g.snapshot()["entities"]


def test_concurrent_independent_edits_reconcile_without_global_clock():
    g = RelationalGround("bridge")
    for entity in ("a", "b"):
        g = added(g, op("create", entity, g.frontier, kind="construct"))
    frontier = g.frontier
    a = added(g, op("annotate", "a", frontier, note="retain stone"))
    b = added(a, op("annotate", "b", frontier, note="add railing"))
    assert len(b.frontier) == 2  # incomparable sibling events
    assert len(b.snapshot()["entities"]["a"]["annotations"]) == 1
    assert len(b.snapshot()["entities"]["b"]["annotations"]) == 1
    with pytest.raises(ValueError, match="Conflicting concurrent"):
        b.apply(op("annotate", "a", frontier, note="conflicting annotation"))
    with pytest.raises(ValueError, match="Unknown observed"):
        b.apply(op("annotate", "a", ["0" * 64], note="invented frontier"))


def test_atomic_refusals_cyclic_and_forged_causality():
    g = RelationalGround("waterfront")
    for entity in ("x", "y"):
        g = added(g, op("create", entity, g.frontier, kind="construct"))
    g = added(g, op("attach", "y", g.frontier, parent="x"))
    old = g.to_dict()
    with pytest.raises(ValueError, match="cycle"):
        g.apply(op("attach", "x", g.frontier, parent="y"))
    assert g.to_dict() == old
    forged = json.loads(json.dumps(old))
    forged["events"][next(iter(forged["events"]))]["operation"]["target"] = "forged"
    with pytest.raises(ValueError, match="digest"):
        RelationalGround.from_dict(forged)
    with pytest.raises(ValueError, match="finite"):
        g.apply(op("transform", "x", g.frontier,
                   matrix=[float("nan")] * 16, frame="local3d"))


def test_identity_is_not_content_hash_and_source_is_not_a_geometry_claim():
    g = RelationalGround("witness")
    g = added(g, op("create", "a", g.frontier, kind="construct", attributes={"mass": 2}))
    g = added(g, op("create", "b", g.frontier, kind="construct", attributes={"mass": 2}))
    s = g.snapshot()["entities"]
    assert s["a"]["revision"] == s["b"]["revision"]
    assert s["a"]["id"] != s["b"]["id"]
    with pytest.raises(ValueError, match="requires source testimony"):
        g.apply(op("create", "fake-source", g.frontier,
                   kind="source", authority="source"))
    with pytest.raises(ValueError, match="Cannot rewrite source"):
        source = added(g, op("create", "source", g.frontier, kind="source",
                             authority="source", source_ids=["photo:1"]))
        source.apply(op("transform", "source", source.frontier,
                        matrix=list(IDENTITY), frame="local3d"))


def test_cli_roundtrip(tmp_path):
    from projection_loom.cli import main
    out = tmp_path / "location.json"
    main(["ground-init", "--location", "cli-village", "--out", str(out)])
    operation = tmp_path / "edit.json"
    operation.write_text(json.dumps(op("create", "foundation",
                                      [], kind="construct")))
    second = tmp_path / "updated.json"
    main(["ground-apply", "--ground", str(out), "--edit", str(operation),
          "--out", str(second)])
    assert "foundation" in RelationalGround.load(second).snapshot()["entities"]
