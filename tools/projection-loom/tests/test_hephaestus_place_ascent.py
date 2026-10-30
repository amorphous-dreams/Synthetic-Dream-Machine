"""Rising stair claims require exact STEP face adjacency, not a preview mesh."""
import pytest
from projection_loom.developmental import GrowthNode,GrowthProgram
from projection_loom.place_genome import PlaceGenome,PlaceBody,AscentRun
from projection_loom.spatial_intent import SpatialGoal,SpatialIntent
from projection_loom.scene_usd import package_scene
from projection_loom.place_affordances import assess_place,verify_place_affordances


def stair(*,gap=False,huge_step=False):
    def block(name,x,height):
        growth=GrowthProgram((GrowthNode("root","foundation",size=(3,3,height)),))
        return PlaceBody(name,growth,(x,0,0))
    bodies=(block("begin",0.,1.),block("tread1",3.,1.4),
            block("tread2",7. if gap else 6.,2.8 if huge_step else 1.8),
            block("summit",9.,2.2))
    genome=PlaceGenome(tuple(sorted(bodies,key=lambda b:b.entity_id)),(),
                        (AscentRun("begin",("tread1","tread2"),"summit"),))
    intent=SpatialIntent("a"*64,(SpatialGoal("ascend","begin","summit",.9,.6),),"operator")
    return genome,intent


def test_native_stair_has_side_faces_and_bounded_step_rises(tmp_path):
    genome,intent=stair()
    package_scene(genome.declaration("stairsite"),tmp_path/"scene")
    result=assess_place(tmp_path/"scene",genome,intent)
    assert result["all_declared_goals_witnessed"],result
    proof=result["goals"][0]["proof"]
    assert len(proof["edge_contacts"])==3
    assert proof["total_native_rise"]>1
    assert not proof["accessibility_certification"] and not proof["load_certification"]
    assert verify_place_affordances(tmp_path/"scene",genome,intent,result)


@pytest.mark.parametrize("params",[{"gap":True},{"huge_step":True}])
def test_broken_or_excessive_native_steps_refuse_ascent(tmp_path,params):
    genome,intent=stair(**params)
    package_scene(genome.declaration("stairsite"),tmp_path/"scene")
    result=assess_place(tmp_path/"scene",genome,intent)
    assert not result["all_declared_goals_witnessed"]
