from pathlib import Path
import numpy as np
import pytest
from projection_loom.location_stack import LocationStack,Source,Frame
from projection_loom.surface_witness import load_xyz,sample_mesh,sampled_surface_distance


def make_stack(tmp_path):
    stack=LocationStack('survey')
    stack.add_frame(Frame('local','local3d','m'))
    stack.add_frame(Frame('other','local3d','model_unit'))
    p=tmp_path/'points.xyz'
    p.write_text('# surveyed synthetic points\n0 0 0\n1 0 0\n0 1 0\n')
    stack.add_source(Source.from_file('points','point_cloud',p,'local'))
    return stack,p


def test_digest_checked_cloud_and_null_invariants(tmp_path):
    stack,p=make_stack(tmp_path)
    xyz=load_xyz(stack,'points')
    assert xyz.as_array().shape==(3,3)
    assert sampled_surface_distance(xyz,xyz)['sampled_bidirectional_rms']==0
    with pytest.raises(ValueError,match='limit'):
        load_xyz(stack,'points',max_points=2)
    p.write_text('changed')
    with pytest.raises(ValueError,match='changed'):
        load_xyz(stack,'points')


def test_real_obj_surface_sampling_does_not_seed_cad(tmp_path):
    stack,_=make_stack(tmp_path)
    obj=tmp_path/'square.obj'
    obj.write_text('v 0 0 0\nv 1 0 0\nv 0 1 0\nf 1 2 3\n')
    stack.add_source(Source.from_file('mesh','photogrammetry_mesh',obj,'local'))
    pts=sample_mesh(stack,'mesh',count=30,seed=11)
    assert pts.as_array().shape==(30,3)
    assert np.allclose(pts.as_array()[:,2],0)
    assert sampled_surface_distance(pts,pts)['sampled_bidirectional_rms']==0
    assert np.array_equal(pts.as_array(),sample_mesh(stack,'mesh',count=30,seed=11).as_array())


def test_reject_unregistered_cloud_scale(tmp_path):
    stack,_=make_stack(tmp_path)
    original=load_xyz(stack,'points')
    from dataclasses import replace
    changed=replace(original,frame_id='other',units='model_unit')
    with pytest.raises(ValueError,match='Unregistered'):
        sampled_surface_distance(original,changed)


def test_glb_scene_transforms_can_be_sampled_as_witness_only(tmp_path):
    """A scan-style GLB scene can contribute points, never a CAD solid."""
    import trimesh
    stack,_=make_stack(tmp_path)
    tri=trimesh.Trimesh(vertices=[[0,0,0],[1,0,0],[0,1,0]],faces=[[0,1,2]],process=False)
    scene=trimesh.Scene()
    scene.add_geometry(tri,node_name='base')
    shift=np.eye(4); shift[:3,3]=[0,0,3]
    scene.add_geometry(tri,node_name='upper',transform=shift)
    file=tmp_path/'two-level.glb'
    file.write_bytes(scene.export(file_type='glb'))
    stack.add_source(Source.from_file('observed-glb','photogrammetry_mesh',file,'local'))
    points=sample_mesh(stack,'observed-glb',count=60,seed=8)
    a=points.as_array()
    assert a.shape==(60,3)
    assert a[:,2].min()==0 and a[:,2].max()==3
    assert sampled_surface_distance(points,points)['sampled_bidirectional_rms']==0
    file.write_bytes(file.read_bytes()+b'extra')
    with pytest.raises(ValueError,match='changed'):
        sample_mesh(stack,'observed-glb',count=10)
