import numpy as np
from projection_loom import Assembly,Camera,Mesh
from projection_loom.topology import assembly_contacts,mask_components
from projection_loom.render import silhouette


def test_roundtrip(tmp_path):
    a=Assembly()
    a.prism('base',(0,0,0),(2,2,1))
    a.prism('top',(0,0,.8),(1,1,1),material=1)
    mesh=a.mesh()
    path=mesh.save(tmp_path/'mesh.npz',{'dimension':2.})
    loaded=Mesh.load(path)
    assert loaded.vertices.shape==mesh.vertices.shape
    assert len(loaded.edges)>0
    assert np.array_equal(loaded.faces,mesh.faces)
    assert assembly_contacts(mesh)['part_contact_count']==1


def test_components_detect_floating_geometry():
    a=Assembly()
    a.prism('left',(-3,0,0),(1,1,1))
    a.prism('right',(3,0,0),(1,1,1))
    mesh=a.mesh()
    assert assembly_contacts(mesh)['part_contact_count']==2
    mask=silhouette(mesh,Camera(fit='bounds'),(256,256))>96
    assert mask_components(mask)['significant_count']==2


def test_camera_projection_parallelism():
    a=Assembly().prism('box',(0,0,0),(2,2,2))
    mesh=a.mesh()
    cam=Camera(azimuth=0,elevation=0)
    uv,_,_=cam.project(mesh.vertices,(256,256))
    assert uv.shape==(8,2)
    assert np.isclose(uv[0,0],uv[3,0])
