import numpy as np
import pytest
from projection_loom.evidence import prepare_reference, DiversityArchive

def test_transparent_rgb_does_not_change_edge_evidence():
    img=np.zeros((80,80,4),dtype=np.uint8)
    img[12:68,12:68,:3]=100
    img[12:68,12:68,3]=255
    img[30:50,30:50,:3]=210
    alternate=img.copy()
    rng=np.random.default_rng(21)
    alternate[:,:,:3][alternate[:,:,3]==0]=rng.integers(0,256,(int((alternate[:,:,3]==0).sum()),3),dtype=np.uint8)
    a=prepare_reference(img,shape=(40,40))
    b=prepare_reference(alternate,shape=(40,40))
    assert all(np.allclose(a.edges[k],b.edges[k],atol=.0001) for k in a.edges)

def test_nonfinite_descriptor_rejected():
    a=DiversityArchive()
    with pytest.raises(ValueError,match='finite'):
        a.consider([float('nan'),.5],.2,{},True)
    with pytest.raises(ValueError,match='finite'):
        a.consider([.5,.5],float('nan'),{},True)

def test_invalid_design_not_admitted():
    a=DiversityArchive()
    assert not a.consider([.5,.5],.1,{},False)
    assert not a.cells
