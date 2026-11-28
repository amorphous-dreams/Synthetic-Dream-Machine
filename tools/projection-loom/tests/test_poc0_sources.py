"""Only current, operator-authorized PoC 0 source integrity (not historical models)."""
from pathlib import Path
from hashlib import sha256
import numpy as np
from PIL import Image

HERE=Path(__file__).resolve().parents[1]/'examples/necrospire'

def test_poc0_original_rgba_mask_exact_integrity():
    rgba=(HERE/'source_rgba.png').read_bytes()
    alpha=(HERE/'source_alpha_8bit.png').read_bytes()
    assert sha256(rgba).hexdigest()=='80e1d0ee8ae4bda505c053b42ea1d1f661d71ed4c174f57c15423027872c4f89'
    assert sha256(alpha).hexdigest()=='78f8d1f0cf44a98b748054ae8b5c8f2229c1354696a8e1173963a7c98bc4fbe7'
    with Image.open(HERE/'source_rgba.png') as img:
        assert img.size==(1024,1536) and img.mode=='RGBA'
        original=np.asarray(img.getchannel('A'))
    with Image.open(HERE/'source_alpha_8bit.png') as img:
        assert img.mode=='L' and img.size==(1024,1536)
        assert np.array_equal(original,np.asarray(img))
