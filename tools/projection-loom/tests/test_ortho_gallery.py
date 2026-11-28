"""The native gallery only presents verified scored candidates, never new survivors."""
import numpy as np
from PIL import Image
import pytest
from projection_loom.ortho_gallery import VIEWS, board, make
from projection_loom.cameras import Camera
from projection_loom.epochs import _hash


def test_exact_six_view_presentation():
    image=Image.new("RGBA",(160,240),(110,154,192,255))
    datum={"rank":1,"family":"crystal","epoch":2,"alpha_iou":.71,
           "global_loss":.31,"lit":{name:image for name in VIEWS},
           "silhouettes":{name:image for name in VIEWS}}
    display=board("FIXED NATIVE ORTHOS",[datum],lit=True)
    assert display.width>1000 and display.height>300
    assert np.asarray(display).any()
    assert board("FIXED NATIVE ORTHOS",[datum],lit=False).size==display.size


def test_refuses_nonreview_seats_without_touching_files(tmp_path):
    for seats in (0,1,6):
        with pytest.raises(ValueError,match=r"2\.\.5"):
            make(tmp_path,"missing","missing",tmp_path/"result",seats=seats)
    assert not (tmp_path/"result").exists()


def test_review_view_names_stable():
    assert VIEWS==("oblique","front","r-side","back","l-side","top")


def test_review_camera_digest_uses_archived_json_not_float_roundtrip():
    # JSON-canonical digests distinguish integer and float values even if
    # Camera.from_dict normalizes the same camera for rendering.
    original={'azimuth':0,'elevation':0,'roll':0,'fit':'height','margin':0.02}
    camera=Camera.from_dict(original)
    assert camera.to_dict()==original
    assert _hash(camera.to_dict())!=_hash(original)
    assert _hash(original)==_hash(dict(original))
