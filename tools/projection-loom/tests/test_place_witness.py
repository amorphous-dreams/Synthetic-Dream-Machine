"""Native passage, section and read-only interop evidence."""
import pytest
from hypothesis import given, settings, strategies as st
from projection_loom.solid import SolidAssembly,box
from projection_loom.place_witness import review_place,_routes


def source():
    a=SolidAssembly(overlap_ratio=.003)
    a.add("base",box((0,0,0),(10,10,2)),parents=(),slot="base")
    a.add("keep",box((0,0,2),(4,4,4)),parents=("base",),slot="keep")
    a.add_void("hall",box((0,0,2),(1,1,1)),connects=("gate",))
    a.add_void("gate",box((0,-2,2),(1,4,1)),
               kind="doorway",connects=("hall",),exterior=True)
    assert a.audit(join=True)["valid"]
    return a


def test_native_slices_routes_and_material_deltas():
    a=source()
    from projection_loom.fire_geometry import _staged
    b=_staged(a)
    b.add_box("new-gallery",(3.5,0,1.1),(3.0,1.0,.6),
              parents=("base",),slot="new-gallery")
    assert b.audit(join=True)["valid"]
    report=review_place(a,[b],location="a-place",elevations=(1.2,2.0),
                        cell=.5,clearance=.6,padding=.5)
    assert report["assemblies"][0]["routes"]["hops"]["hall"]==1
    assert report["assemblies"][1]["exact_native_material_added"]>0
    assert report["assemblies"][1]["exact_native_material_removed"]==0
    assert report["sections"][0]["material"][1]["sampled_symmetric_difference_area"]>0
    assert report["authority"].startswith("native CAD audit")
    assert report["sha256"]


def test_reject_unadmitted_and_excessive_sample_budget():
    a=source()
    with pytest.raises(ValueError,match="1..8"):
        review_place(a,[],location="p")
    with pytest.raises(ValueError,match="resolution"):
        review_place(a,[a],location="p",elevations=(1.0,),cell=.2,padding=8)


@settings(max_examples=8,deadline=None)
@given(cell=st.floats(min_value=.3,max_value=1.5,allow_nan=False),
       clearance=st.floats(min_value=.2,max_value=3,allow_nan=False))
def test_native_identity_never_fabricates_material_difference(cell,clearance):
    a=source()
    result=review_place(a,[a],location="p",elevations=(1.,),
                        cell=cell,clearance=clearance,padding=0)
    row=result["assemblies"][1]
    assert row["exact_native_material_added"]==0
    assert row["exact_native_material_removed"]==0
    assert result["sections"][0]["material"][1]["sampled_symmetric_difference_area"]==0
