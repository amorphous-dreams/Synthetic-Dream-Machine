"""Native construction receipts replay from JSON without identity drift."""
import json

from projection_loom.developmental import GrowthNode, GrowthProgram
from projection_loom.place_genome import PlaceBody, PlaceGenome


def test_growth_node_serialization_is_json_native_at_the_source():
    node=GrowthNode("wing","spawn",parent="root",face="east",
                    size=(2.5,3,1),offset=(.125,-.75),repeats=2)
    original=node.as_dict()
    assert original==json.loads(json.dumps(original))
    assert type(original["size"]) is list
    assert type(original["offset"]) is list
    assert original["size"]==[2.5,3.0,1.0]
    assert original["offset"]==[.125,-.75]
    assert GrowthNode(**json.loads(json.dumps(original)))==node


def test_original_place_and_program_replay_without_array_tuple_drift():
    program=GrowthProgram((GrowthNode("root","foundation",size=(4,3,2)),
                           GrowthNode("wing","spawn",parent="root",face="up",
                                      size=(2,2,1),offset=(1,-1))))
    place=PlaceGenome((PlaceBody("east",program,(12,3,0)),
                       PlaceBody("west",program,(0,0,0))))
    original=place.to_dict()
    reread=json.loads(json.dumps(original))
    assert original==reread
    assert PlaceGenome.from_dict(reread).identity==place.identity
    assert [x.as_dict() for x in program.nodes]==json.loads(json.dumps(
        [x.as_dict() for x in program.nodes]))
    assert program.identity==GrowthProgram.from_dict({
        "nodes":json.loads(json.dumps([n.as_dict() for n in program.nodes]))}).identity
