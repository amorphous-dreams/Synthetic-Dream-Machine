from hashlib import sha256
from pathlib import Path
import pytest
from projection_loom.developmental import GrowthNode,GrowthProgram,compile_growth,mutate_growth,crossover_growth
from projection_loom.intent_seed import SeedBundle,SeedEntry,IntentContract,GrowthContext

def program():
    return GrowthProgram((
        GrowthNode("foundation","foundation",size=(8,8,2)),
        GrowthNode("terrace","spawn",parent="foundation",face="up",
                   size=(5,5,1.6)),
        GrowthNode("tower","spawn",parent="terrace",face="up",
                   size=(2.4,2.4,3)),
    ))

def context(tmp_path):
    p=tmp_path/"seed"
    p.write_text("subject-neutral")
    b=SeedBundle((SeedEntry.from_file("constructive-grammar",p),))
    i=IntentContract("unnamed-place","develop structurally diverse geometry",
                     ("native-validity","structural-novelty"))
    return GrowthContext(b,i,"1"*64,"2"*64,7)

def test_grows_native_structural_sites():
    p=program()
    result=compile_growth(p)
    assert result.audit()["union_solids"]==1
    assert result.audit()["joints"]==2
    assert "tower/up" in result.sites
    assert result.sites["terrace/up"].producer=="terrace"
    assert len(result.relationships)==2

def test_split_grows_variable_count_of_later_sites():
    p=GrowthProgram((*program().nodes,
      GrowthNode("battlement","split",parent="terrace",face="up",
                 size=(1.,1.,.9),repeats=3)))
    r=compile_growth(p)
    assert len(r.assembly.parts)==6
    assert len([s for s in r.sites if s.startswith("battlement-")])==15

def test_mutation_replay_worker_order_invariant(tmp_path):
    ctx=context(tmp_path)
    p=program()
    children={i:mutate_growth(p,ctx,epoch=4,child=i,edits=5) for i in range(9)}
    backwards={i:mutate_growth(p,ctx,epoch=4,child=i,edits=5) for i in reversed(range(9))}
    assert {i:x.identity for i,x in children.items()}=={i:x.identity for i,x in backwards.items()}
    assert any(x.identity!=p.identity for x in children.values())

def test_crossover_grafts_typed_child(tmp_path):
    p=program()
    child=crossover_growth(p,p,context(tmp_path),epoch=1,child=2)
    assert len(child.nodes)==4
    assert child.nodes[-1].key=="graft_1_2"
    assert compile_growth(child).audit()["union_valid"]

def test_dangling_or_excessive_program_rejected():
    with pytest.raises(ValueError,match="Parent"):
        GrowthProgram((GrowthNode("root","foundation"),GrowthNode("child","spawn",parent="missing",face="up")))
    with pytest.raises(ValueError,match="budget"):
        GrowthProgram((GrowthNode("root","foundation"),*
            (GrowthNode(f"n{i}","split",parent="root",face="up",repeats=8) for i in range(9))))

def test_compiler_uses_no_technical_face_index():
    p=program()
    result=compile_growth(p)
    assert all("/" in key for key in result.sites)
    assert "face" not in str(result.relationships)


def test_bridges_and_exterior_cuts_have_native_witnesses():
    source=GrowthProgram((
        GrowthNode("root","foundation",size=(8,8,3)),
        GrowthNode("west","spawn",parent="root",face="up",
                   size=(2,2,1.5),offset=(-2,0)),
        GrowthNode("east","spawn",parent="root",face="up",
                   size=(2,2,1.5),offset=(2,0)),
        GrowthNode("span","bridge",parent="west",target="east",
                   size=(.6,.6,1)),
        GrowthNode("opening","carve",parent="root",target="root",
                   face="east",size=(.7,.8,1.1)),
    ))
    result=compile_growth(source)
    audit=result.audit()
    assert audit["union_valid"] and audit["valid"]
    assert "opening" in result.assembly.voids.voids
    assert any(rel[1]=="bridges" for rel in result.relationships)


def test_renamed_technical_handles_preserve_semantic_genome():
    first=program()
    second=GrowthProgram((
        GrowthNode("a","foundation",size=(8,8,2)),
        GrowthNode("b","spawn",parent="a",face="up",size=(5,5,1.6)),
        GrowthNode("c","spawn",parent="b",face="up",size=(2.4,2.4,3))))
    assert first.identity==second.identity
    a=compile_growth(first).assembly.material_solid()
    b=compile_growth(second).assembly.material_solid()
    assert abs(a.Volume()-b.Volume())<1e-6

def test_occupancy_is_advisory_not_a_cad_gate():
    from projection_loom.developmental import spatial_occupancy_witness
    r=compile_growth(program())
    w=spatial_occupancy_witness(r)
    assert w["scope"].startswith("conservative")
    assert w["placements"]
    assert all(x["status"]=="AABB-overlap-unverified" for x in w["overlaps"])
