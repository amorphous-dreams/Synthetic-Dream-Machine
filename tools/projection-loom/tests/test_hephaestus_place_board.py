"""One whole-place operator board preserves native and visual authority."""
import json
import pytest
from test_hephaestus_place_campaign import setup
from projection_loom.place_campaign import run_place_campaign
from projection_loom.place_board import render_place_board,verify_place_board


def test_review_board_from_real_source_bound_native_place(tmp_path):
    campaign=tmp_path/"native"
    summary=run_place_campaign(*setup(),campaign,epochs=1,offspring=1,exact_budget=1)
    assert summary["admitted"]==1
    board=tmp_path/"operator-board"
    result=render_place_board(campaign,board)
    assert result["admitted"]==1
    assert result["candidates"][0]["six_view"]
    assert result["candidates"][0]["native_scene"]["native_step"]
    assert result["candidates"][0]["goal_consequences"][0]["kind"]=="connect"
    assert result["candidates"][0]["emitter_receipt"]["emitter"]=="initial"
    assert result["relational_emissions"]["native_attempts"]==1
    assert "Emitter: initial" in (board/"board.html").read_text()
    assert "Source evidence" in (board/"board.html").read_text()
    assert "geometric-route-proposal" in (board/"board.html").read_text()
    assert "No automatic artistic winner" in (board/"board.html").read_text()
    assert not result["automatic_artistic_winner"]
    assert verify_place_board(campaign,board)
    with pytest.raises(ValueError,match="unused immutable"):
        render_place_board(campaign,board)


def test_changed_operator_board_html_cannot_pass_local_verification(tmp_path):
    campaign=tmp_path/"native"
    run_place_campaign(*setup(),campaign,epochs=1,offspring=1,exact_budget=1)
    board=tmp_path/"board"
    render_place_board(campaign,board)
    (board/"board.html").write_text("<p>unearned winner</p>")
    with pytest.raises(ValueError,match="HTML changed"):
        verify_place_board(campaign,board)

def test_operator_board_refuses_image_path_escape(tmp_path):
    campaign=tmp_path/"native"
    run_place_campaign(*setup(),campaign,epochs=1,offspring=1,exact_budget=1)
    board=tmp_path/"board"
    render_place_board(campaign,board)
    document=board/"board.json"
    record=json.loads(document.read_text())
    record["candidates"][0]["six_view"]="../outside.png"
    document.write_text(json.dumps(record))
    with pytest.raises(ValueError,match="image path"):
        verify_place_board(campaign,board)
