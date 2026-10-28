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



def test_native_rule_receipt_measures_nonzero_expression():
    base=fixture()
    witness=base.relation_witness(location="necrospire")
    row=audition_plan(resolve_proposal(example(witness,"encircles","ring-around"),witness),
                      base,location="necrospire")["results"][0]
    if row["state"]=="native-admitted":
        assert row["added_volume"]>0
        assert row["part_delta"]==4
    else:
        assert row["reason"]



def test_real_single_seed_fire_bearing_has_native_expression():
    """Source-specific proof; controlled fixtures alone do not meet this gate."""
    from pathlib import Path
    from projection_loom.pipeline import Project
    from projection_loom.capability_stack import CapabilityRecipe, CapabilityCompositor
    from projection_loom.fire_geometry import fire_audition
    import sys
    root = Path(__file__).resolve().parents[1]
    project = Project.load(root / "examples/necrospire/project_alpha.json")
    recipe = CapabilityRecipe.load(root / "examples/necrospire/hybrid/recipe_alpha.json")
    context = CapabilityCompositor(project, recipe, size=(64, 96),
                  source_mask=project.source_mask((64, 96))).grow(recipe.initial).witness()
    # The fixture author shares the same root as the CLI; no runtime AI service.
    sys.path.insert(0, str(root / "examples/necrospire"))
    try:
        from fire_study import build_study
        proposal = build_study({
            "source": {"location": context.location, "witness_id": context.witness_id,
                       "seed_entity_sha256": project.seed_entity.sha256},
            "bindings": [{"handle": name, "selector": context.selector(name)}
                         for name in ("lower terrace", "central keep")]})
    finally:
        sys.path.remove(str(root / "examples/necrospire"))
    result = fire_audition(project, recipe, proposal)
    assert [x["state"] for x in result["results"]] == [
        "native-admitted", "native-admitted", "study-only"]
    assert all(x["added_volume"] > 0 for x in result["results"][:2])
    assert all(x["native_audit"]["union_solids"] == 1 for x in result["results"][:2])


def test_source_fire_two_probe_profiles_are_distinct():
    import sys
    from pathlib import Path
    from projection_loom.fire_contract import validate_proposal
    root=Path(__file__).resolve().parents[1]
    sys.path.insert(0,str(root/'examples/necrospire'))
    try:
        from fire_study import build_study
        context={'source':{'location':'necrospire','witness_id':'source-12345'},'bindings':[
            {'handle':'lower terrace','selector':{'kind':'material','role':'primary','parents':[],'slot':'lower-terrace','has':[]}},
            {'handle':'central keep','selector':{'kind':'material','role':'primary','parents':[],'slot':'central-keep','has':[]}}]}
        a=validate_proposal(build_study(context,epoch=1))
        b=validate_proposal(build_study(context,epoch=2))
        assert a['source']==b['source']
        assert [x['parameters']['setback'] for x in a['alternatives'][:2]]==[0.,0.]
        assert [x['parameters']['setback'] for x in b['alternatives'][:2]]==[.1,.1]
        assert [x['implementation'] for x in a['alternatives']]==['bearing-column','bearing-column','study-only']
    finally:
        sys.path.remove(str(root/'examples/necrospire'))



def test_open_front_skirting_court_is_native_and_source_unmodified():
    original=fixture()
    witness=original.relation_witness(location="necrospire")
    proposal=example(witness,"skirts","skirting-court")
    original_audit=original.audit(join=True)
    row=audition_plan(resolve_proposal(proposal,witness),original,
                      location="necrospire")["results"][0]
    assert row["state"]=="native-admitted",row["reason"]
    assert row["part_delta"]==3
    assert row["added_volume"]>0
    assert row["native_audit"]["valid"]
    assert original.audit(join=True)==original_audit



def test_native_fire_rule_steps_cannot_diverge_from_its_source_plan():
    from copy import deepcopy
    from projection_loom.fire_geometry import verify_native_rule_replay
    base=fixture()
    witness=base.relation_witness(location="necrospire")
    plan=resolve_proposal(example(witness,"bears","bearing-column"),witness)
    native=audition_plan(plan,base,location="necrospire")["results"][0]
    assert native["state"]=="native-admitted"
    assert verify_native_rule_replay(plan,native,base)==native["rule_steps"]
    altered=deepcopy(native)
    altered["rule_steps"][0]["width"]=2.0
    with __import__("pytest").raises(ValueError,match="operations changed"):
        verify_native_rule_replay(plan,altered,base)
    altered=deepcopy(native)
    altered["relation"]="bridges"
    with __import__("pytest").raises(ValueError,match="relation changed"):
        verify_native_rule_replay(plan,altered,base)



def test_fire_native_replay_tolerates_only_cad_roundoff_not_semantic_change():
    from copy import deepcopy
    from projection_loom.fire_geometry import verify_native_rule_replay
    base = fixture()
    witness = base.relation_witness(location="necrospire")
    plan = resolve_proposal(example(witness, "bears", "bearing-column"), witness)
    native = audition_plan(plan, base, location="necrospire")["results"][0]
    assert native["state"] == "native-admitted"
    roundoff = deepcopy(native)
    roundoff["rule_steps"][0]["start"][0] += 1e-9
    assert verify_native_rule_replay(plan, roundoff, base) == native["rule_steps"]
    changed = deepcopy(native)
    changed["rule_steps"][0]["start"][0] += 1e-3
    with __import__("pytest").raises(ValueError, match=r"rule_steps\[0\]\.start\[0\]"):
        verify_native_rule_replay(plan, changed, base)
    changed = deepcopy(native)
    changed["rule_steps"][0]["parents"].reverse()
    with __import__("pytest").raises(ValueError, match="rule_steps"):
        verify_native_rule_replay(plan, changed, base)
