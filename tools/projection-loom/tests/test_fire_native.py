"""Fire proposals are native, auditable and side-effect-free by default."""
from projection_loom.solid import SolidAssembly,box
from projection_loom.fire_contract import resolve_proposal
from projection_loom.fire_geometry import audition_plan
from projection_loom.fire_review import provenance_document
from projection_loom.provenance_encoding import canonical_json_sha256


def fixture():
    body=SolidAssembly()
    body.add("foundation",box((0,0,0),(12,12,2)),parents=(),slot="foundation")
    body.add("upper",box((0,0,2),(3,3,4)),parents=("foundation",),slot="upper")
    assert body.audit(join=True)["valid"]
    return body


def example(witness,relation,implementation):
    return {"schema":"projection-loom/fire-proposal",
            "inscription":'<<~ art subject="a tower" read="inhabited massing" >>',
            "folio":[],
            "source":{"location":witness.location,"witness_id":witness.witness_id},
            "bindings":[{"alias":"base","selector":witness.selector("foundation")},
                        {"alias":"top","selector":witness.selector("upper")}],
            "alternatives":[{"id":"first","subject":"base","object":"top",
                             "relation":relation,"implementation":implementation,
                             "parameters":{"width":.4,"depth":.4,"clearance":.3}}],
            "intent":{"state":"proposed","read":"Explore architectural contacts",
                      "attribution":"operator-request"}}


def test_bearing_is_native_and_staged():
    base=fixture()
    w=base.relation_witness(location="necrospire")
    plan=resolve_proposal(example(w,"bears","bearing-column"),w)
    result=audition_plan(plan,base,location="necrospire")
    row=result["results"][0]
    assert row["state"]=="native-admitted",row["reason"]
    assert row["native_audit"]["valid"]
    assert len(base.parts)==2
    assert row["part_delta"]==1
    assert row["claim"].startswith("native BRep")


def test_encirclement_is_native_or_attributed_rejection_never_partial():
    base=fixture()
    w=base.relation_witness(location="necrospire")
    plan=resolve_proposal(example(w,"encircles","ring-around"),w)
    before=base.audit(join=True)
    result=audition_plan(plan,base,location="necrospire")
    row=result["results"][0]
    assert row["state"] in ("native-admitted","rejected")
    assert row["reason"] is not None or row["native_audit"]["valid"]
    assert base.audit(join=True)==before
    assert len(base.parts)==2


def test_prov_export_distinguishes_failed_and_verified_entities():
    from copy import deepcopy
    record={"schema":"projection-loom/fire-native-audition",
            "original_witness_id":"witness-a","plan_sha256":"a"*64,
            "results":[{"state":"native-admitted","witness_id":"witness-b"},
                       {"state":"rejected","reason":"contact failure"}]}
    record["sha256"]=canonical_json_sha256(record)
    result=provenance_document(record)
    graph=result["@graph"]
    assert sum(e.get("@type")=="prov:Entity" for e in graph)==2
    assert graph[-1]["prov:wasDerivedFrom"]["@id"]=="urn:loom-witness:witness-a"
    wrong=deepcopy(record)
    wrong["results"][1]["reason"]="tampered"
    import pytest
    with pytest.raises(ValueError,match="digest"):
        provenance_document(wrong)
