"""Native place and topology six-view sheets retain pixel-exact predecessor output."""
from hashlib import sha256
from io import BytesIO
import numpy as np
from PIL import Image, ImageDraw
from projection_loom import gallery_artifacts


def test_native_six_view_sheet_is_pixel_and_png_identical_to_original(monkeypatch):
    names=gallery_artifacts.VIEWS
    cameras={name:idx for idx,name in enumerate(names)}
    size=(24,16)
    def raster(_mesh,camera,shape):
        assert shape==size
        return np.full((size[1],size[0]),20+camera*31,dtype=np.uint8)
    monkeypatch.setattr(gallery_artifacts,"silhouette",raster)
    result=gallery_artifacts.native_six_view_sheet(object(),cameras,size)
    reference=Image.new("RGB",(3*size[0],2*(size[1]+22)),(15,20,27))
    pen=ImageDraw.Draw(reference)
    for i,name in enumerate(names):
        image=Image.fromarray(raster(None,cameras[name],size),"L").convert("RGB")
        x=(i%3)*size[0]
        y=(i//3)*(size[1]+22)
        reference.paste(image,(x,y+22))
        pen.text((x+4,y+5),name,fill=(230,236,245))
    assert result.size==reference.size
    assert result.tobytes()==reference.tobytes()
    produced=BytesIO()
    legacy=BytesIO()
    result.save(produced,format="PNG")
    reference.save(legacy,format="PNG")
    assert sha256(produced.getvalue()).hexdigest()==sha256(legacy.getvalue()).hexdigest()
