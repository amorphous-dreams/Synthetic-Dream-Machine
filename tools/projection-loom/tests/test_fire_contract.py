"""Real Fire authored contracts meet native CAD, not an LLM execution shim."""
import copy
import json
import pytest
from projection_loom.solid import SolidAssembly,box
from projection_loom.relations import RelationWitness,PetNameLedger
from projection_loom.fire_contract import validate_proposal,resolve_proposal,verify_plan
from projection_loom.fire_geometry import audition_plan


def site():
    body=SolidAssembly()
    body.add("base",box((0,0,0),(12,12,2)),parents=(),slot="base")
    body.add("terrace",box((-3,0,2),(3,3,4)),parents=("base",),slot="terrace")
    body.add("tower",box((3,0,2),(3,3,4)),parents=("base",),slot="tower")
    assert body.audit(join=True)["valid"]
    return body


def proposal(witness):
    return {
        "schema":"projection-loom/fire-proposal",
        "inscription":'<<~ art worktype="architectural study" subject="fortress and crystal" read="interdependence" imagery="terraces bridge a core" treatment="heavy stone" composition="tension" relation="connected masses" depiction-scope="native construction" >>',
        "folio":[{"kind":"study","text":"A bridge connects inhabited terraces"}],
        "source":{"location":witness.location,"witness_id":witness.witness_id},
        "bindings":[{"alias":"a","selector":witness.selector("terrace")},
                    {"alias":"b","selector":witness.selector("tower")}],
        "alternatives":[{"id":"span","subject":"a","object":"b",
                         "relation":"bridges","implementation":"bridge-between",
                         "parameters":{"width":.55,"depth":.55}}],
        "intent":{"state":"proposed","read":"explore alternatives",
                  "attribution":"ai-interpretation"},
    }


def test_audited_native_bridge_preserves_source_and_provenance():
    body=site()
    witness=body.relation_witness(location="necrospire")
    plan=resolve_proposal(proposal(witness),witness)
    assert verify_plan(plan)["sha256"]==plan["sha256"]
    before=set(body.parts)
    result=audition_plan(plan,body,location="necrospire")
    outcome=result["results"][0]
    assert outcome["state"]=="native-admitted",outcome["reason"]
    assert outcome["native_audit"]["valid"]
    assert outcome["part_delta"]==1
    assert outcome["added_volume"]>=0
    assert len(outcome["witness"]["entities"])==4
    assert set(body.parts)==before
    assert body.audit(join=True)["valid"]


def test_unsolved_proposals_remain_proposals_not_geometry():
    body=site()
    witness=body.relation_witness(location="necrospire")
    p=proposal(witness)
    p["alternatives"]=[{"id":"unknown","subject":"a","object":"b",
                         "relation":"studies","implementation":"study-only",
                         "parameters":{}}]
    plan=resolve_proposal(p,witness)
    result=audition_plan(plan,body,location="necrospire")
    assert result["results"][0]["state"]=="study-only"
    assert len(body.parts)==3


def test_artist_prose_is_not_executable_and_unknown_operator_rejected():
    w=site().relation_witness(location="necrospire")
    p=proposal(w)
    p["inscription"]='__import__("os").system("echo no")'
    assert validate_proposal(p)["inscription"]==p["inscription"]
    p["alternatives"][0]["implementation"]="untrusted-python"
    with pytest.raises(ValueError,match="contract"):
        validate_proposal(p)


def test_relationships_are_type_checked_and_ambiguity_rejected():
    w=site().relation_witness(location="necrospire")
    p=proposal(w)
    p["bindings"][1]["selector"]["slot"]="none"
    with pytest.raises(ValueError,match="missing or ambiguous"):
        resolve_proposal(p,w)
    p=proposal(w)
    p["alternatives"][0]["object"]="a"
    with pytest.raises(ValueError,match="self"):
        validate_proposal(p)


def test_pet_name_is_operator_ledger_authority_only():
    w=site().relation_witness(location="necrospire")
    ledger=PetNameLedger(location="necrospire")
    ledger.pet_name("North Tower","tower",w)
    p=proposal(w)
    p["bindings"][1]={"alias":"b","pet_name":"North Tower"}
    assert resolve_proposal(p,w,ledger=ledger)["resolved"]["b"]=="tower"
    with pytest.raises(ValueError,match="operator ledger"):
        resolve_proposal(p,w)


def test_native_invalid_geometry_never_touches_source():
    body=site()
    w=body.relation_witness(location="necrospire")
    p=proposal(w)
    p["alternatives"][0]["parameters"]["width"]=.01
    p["alternatives"][0]["parameters"]["depth"]=.01
    before=body.audit(join=True)
    outcome=audition_plan(resolve_proposal(p,w),body,location="necrospire",
                          max_parts=3)["results"][0]
    assert outcome["state"]=="rejected"
    assert "part budget" in outcome["reason"]
    assert body.audit(join=True)==before


def test_digest_tampering_and_unqualified_source_rejected():
    body=site()
    w=body.relation_witness(location="necrospire")
    p=proposal(w)
    p["source"]["seed_entity_sha256"]="a"*64
    with pytest.raises(ValueError,match="seed identity"):
        resolve_proposal(p,w,source_seed_sha256="b"*64)
    p=proposal(w)
    plan=resolve_proposal(p,w)
    plan["resolved"]["b"]="arbitrary"
    with pytest.raises(ValueError,match="checksum"):
        verify_plan(plan)
