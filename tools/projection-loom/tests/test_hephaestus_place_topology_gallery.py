"""Read-only native STEP image review keeps every alternative and refusal."""
import json
import pytest
from projection_loom.place_topology_gallery import render_topology_gallery,verify_topology_gallery
from projection_loom.place_topology_study import run_topology_study
from projection_loom.place_genome import PlaceGenome,PlaceBody
from test_hephaestus_place_three_hop import authored


def test_six_view_topology_review_uses_frozen_native_evidence(tmp_path):
    site,spatial=authored()
    opts={"location":"topological-place","goal_index":0,"corner_prefix":"lane"}
    study=tmp_path/"study"
    run_topology_study(site,spatial,study,**opts)
    root=tmp_path/"gallery"
    result=render_topology_gallery(site,spatial,study,root,**opts)
    assert len(result["entries"])==4
    assert all(item["image_file"] for item in result["entries"])
    assert all((root/item["image_file"]).is_file() for item in result["entries"])
    html=(root/"review.html").read_text()
    assert "Actual independent STEP auditions: 4" in html
    assert "source camera registration" in html
    assert "x-y-x_six_view.png" in html
    assert result["automatic_artistic_winner"] is False
    assert verify_topology_gallery(site,spatial,study,root,**opts)


def test_refused_source_footprint_keeps_read_only_negative_card(tmp_path):
    site,spatial=authored()
    obstacle=PlaceBody("barrier",site.bodies[0].program,(6,0,0))
    blocked=PlaceGenome(tuple(sorted((*site.bodies,obstacle),key=lambda x:x.entity_id)))
    opts={"location":"topological-place","goal_index":0,"corner_prefix":"lane"}
    study=tmp_path/"study"
    run_topology_study(blocked,spatial,study,**opts)
    gallery=tmp_path/"gallery"
    receipt=render_topology_gallery(blocked,spatial,study,gallery,**opts)
    negative=[x for x in receipt["entries"] if x["state"]=="construction-refused"]
    assert len(negative)==1 and negative[0]["pattern"]=="x-y-x"
    assert negative[0]["image_file"] is None
    assert "Construction refused" in (gallery/"review.html").read_text()
    assert verify_topology_gallery(blocked,spatial,study,gallery,**opts)


def test_rendered_gallery_image_and_html_rewrites_both_refuse_replay(tmp_path):
    site,spatial=authored()
    opts={"location":"topological-place","goal_index":0,"corner_prefix":"lane"}
    study=tmp_path/"study"
    run_topology_study(site,spatial,study,**opts)
    gallery=tmp_path/"gallery"
    render_topology_gallery(site,spatial,study,gallery,**opts)
    image=gallery/"x-y-x_six_view.png"
    image.write_bytes(image.read_bytes()+b"forgery")
    with pytest.raises(ValueError,match="image no longer"):
        verify_topology_gallery(site,spatial,study,gallery,**opts)
    image.write_bytes(image.read_bytes()[:-7])
    (gallery/"review.html").write_text("<html>forged</html>")
    with pytest.raises(ValueError,match="board HTML diverged"):
        verify_topology_gallery(site,spatial,study,gallery,**opts)
