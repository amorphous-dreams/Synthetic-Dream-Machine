"""Known, neutral and null calibration tests. Synthetic oracle is independent."""
import math
from pathlib import Path
import numpy as np
import pytest
from PIL import Image
from projection_loom.cameras import Camera
from projection_loom.calibration import (
    calibrate_orthographic, camera_rmse, ensure_fixed_evidence_camera,
    reference_evidence_diagnostic)

ROOT = Path(__file__).resolve().parents[1]
POINTS = np.array([
    [-3.0,-2.0,0.0], [3.0,-2.0,0.0], [-3.0,2.0,0.0], [3.0,2.0,0.0],
    [-2.3,-1.0,4.0], [2.8,-1.1,4.4], [-2.1,1.8,4.3], [2.0,2.0,5.3],
    [0.8,0.0,9.0], [-1.0,-1.3,10.4], [2.4,0.7,8.0],
    [-1.8,3.4,2.1], [2.2,-2.6,6.2], [-2.5,2.0,7.3],
], dtype=float)
TRAIN = np.array([0,1,2,3,4,5,6,7,8,9])
HOLD = np.array([10,11,12,13])
SIZE = (256,384)


def independent_oracle(points, az=33.5, el=24.0, roll=-11.0,
                       scale=18.4, center=(126.25,165.7)):
    """A second direct trigonometric projector; not Camera.project()."""
    a,e,r=map(math.radians,(az,el,roll))
    R=np.array([math.cos(a)*math.cos(r)-math.sin(e)*math.sin(a)*math.sin(r),
                math.sin(a)*math.cos(r)+math.sin(e)*math.cos(a)*math.sin(r),
                math.cos(e)*math.sin(r)])
    U=np.array([-math.cos(a)*math.sin(r)-math.sin(e)*math.sin(a)*math.cos(r),
                -math.sin(a)*math.sin(r)+math.sin(e)*math.cos(a)*math.cos(r),
                math.cos(e)*math.cos(r)])
    q=np.asarray(points)
    return np.column_stack((center[0]+scale*q@R,center[1]-scale*q@U))


@pytest.fixture
def case():
    truth=independent_oracle(POINTS)
    expected=Camera(azimuth=33.5,elevation=24,roll=-11,fit='fixed',
                    pixel_scale=18.4,pixel_center=(126.25,165.7),reference_size=SIZE)
    return truth,expected


def test_independent_projection_agreement(case):
    target,known=case
    assert np.max(np.abs(known.project(POINTS,SIZE)[0]-target)) < 1e-9


def test_fit_recovers_held_out_known_landmarks(case):
    xy,truth=case
    observations=xy+np.random.default_rng(73).normal(0,.08,size=xy.shape)
    result=calibrate_orthographic(POINTS,observations,size=SIZE,
        train_indices=TRAIN,holdout_indices=HOLD,
        expected_outward=truth.basis()[2],max_holdout_rmse=.5)
    assert result.accepted, result.as_dict()
    assert result.holdout_rmse<.5
    assert abs(result.camera.pixel_scale-18.4)<.15
    assert result.view_alignment_deg<.5
    assert abs(result.camera.azimuth-33.5)<.8
    assert abs(result.camera.elevation-24)<.8


def test_auto_fitting_erases_candidate_size_drift(case):
    auto=Camera(azimuth=33.5,elevation=24,roll=-11,fit='bounds')
    assert np.max(np.abs(auto.project(POINTS,SIZE)[0]-auto.project(POINTS*1.24,SIZE)[0]))<1e-10
    fixed=case[1]
    assert camera_rmse(fixed,POINTS*1.24,case[0],SIZE)>8


def test_fixed_projector_scaled_rasters_do_not_lose_physical_size(case):
    base=case[1].project(POINTS,SIZE)[0]
    twice=case[1].project(POINTS,(512,768))[0]
    assert np.allclose(twice,2*base,atol=1e-9)
    halve=case[1].project(POINTS,(128,192))[0]
    assert np.allclose(halve,base/2,atol=1e-9)


def test_mirror_requires_an_independent_view_prior(case):
    xy,truth=case
    mirrored=xy.copy()
    mirrored[:,0]=2*126.25-xy[:,0]
    result=calibrate_orthographic(POINTS,mirrored,size=SIZE,
        train_indices=TRAIN,holdout_indices=HOLD,
        expected_outward=truth.basis()[2],max_view_deviation_deg=20)
    assert not result.accepted and result.view_alignment_deg>20


def test_perspective_source_is_not_silently_accepted_as_orthographic(case):
    xy,truth=case
    depths=POINTS@truth.basis()[2]
    p=np.array([126.25,165.7])
    # Deliberate, strong depth-dependent perspective distortion.
    warped=(xy-p)/(1+.14*depths[:,None])+p
    result=calibrate_orthographic(POINTS,warped,size=SIZE,
        train_indices=TRAIN,holdout_indices=HOLD,max_holdout_rmse=.7)
    assert not result.accepted and result.holdout_rmse>.7


def test_known_wrong_pose_is_detected(case):
    xy,_=case
    wrong=Camera(azimuth=41,elevation=24,roll=-11,fit='fixed',
                 pixel_scale=18.4,pixel_center=(136.25,165.7),reference_size=SIZE)
    assert camera_rmse(wrong,POINTS,xy,SIZE)>8


def test_all_null_coverage_is_rejected():
    blank=np.zeros((40,30),np.uint8)
    full=np.full((40,30),255,np.uint8)
    assert reference_evidence_diagnostic(blank)['status']=='null-empty'
    assert reference_evidence_diagnostic(full)['status']=='null-full-frame'


def test_uniform_interior_is_silhouette_only():
    alpha=np.zeros((50,60),np.uint8);alpha[10:40,15:45]=255
    color=np.zeros((50,60,3),np.uint8);color[alpha>0]=127
    q=reference_evidence_diagnostic(alpha,color)
    assert q['status']=='usable-silhouette' and not q['edge_signal']


def test_interior_lines_produce_separate_evidence():
    alpha=np.zeros((50,60),np.uint8);alpha[10:40,15:45]=255
    color=np.zeros((50,60,3),np.uint8);color[alpha>0]=127
    color[15:35,30:33]=255
    assert reference_evidence_diagnostic(alpha,color)['edge_signal']


def test_degenerate_planar_landmark_set_cannot_certify_3d_pose(case):
    xyz=POINTS.copy();xyz[:,2]=0
    with pytest.raises(ValueError,match='Degenerate'):
        calibrate_orthographic(xyz,case[0],size=SIZE,
            train_indices=TRAIN,holdout_indices=HOLD)


def test_train_holdout_leakage_rejected(case):
    with pytest.raises(ValueError,match='leakage'):
        calibrate_orthographic(POINTS,case[0],size=SIZE,
            train_indices=TRAIN,holdout_indices=[5,11,12])


def test_auto_fit_cannot_claim_registered_fitness():
    with pytest.raises(ValueError,match='must be fixed'):
        ensure_fixed_evidence_camera(Camera(fit='bounds'))
    assert ensure_fixed_evidence_camera(Camera(fit='fixed',pixel_scale=12,reference_size=SIZE))


def test_null_nonfinite_landmarks_rejected(case):
    pts=POINTS.copy();pts[0,1]=float('nan')
    with pytest.raises(ValueError,match='Non-finite'):
        calibrate_orthographic(pts,case[0],size=SIZE,
            train_indices=TRAIN,holdout_indices=HOLD)


def test_orthographic_left_right_need_distinct_projection_receipts():
    center=(126.,180.)
    left=Camera(azimuth=-90,fit='fixed',pixel_scale=17,
                pixel_center=center,reference_size=SIZE)
    right=Camera(azimuth=90,fit='fixed',pixel_scale=17,
                 pixel_center=center,reference_size=SIZE)
    L=left.project(POINTS,SIZE)[0]
    R=right.project(POINTS,SIZE)[0]
    assert np.max(np.abs(L-R))>10
    assert left.basis()[2]@right.basis()[2] < -.999
    # These points may look mirrored from certain views. Their facing vectors
    # nevertheless differ by 180deg: a flipped bitmap is not a camera receipt.


def test_camera_from_dict_preserves_fixed_mode(case):
    truth=case[1]
    restored=Camera.from_dict(truth.to_dict())
    assert np.allclose(restored.project(POINTS,SIZE)[0],truth.project(POINTS,SIZE)[0])


def test_cad_neutral_solid_camera_projection_both_modes():
    from projection_loom.solid import box
    from projection_loom.geometry import Mesh
    from projection_loom.render import silhouette
    import cv2
    root=box((0,0,0),(2,3,4))
    vs,fs=root.tessellate(.2,.25)
    vertices=np.array([v.toTuple() for v in vs])
    faces=np.array(fs,int)
    m=Mesh(vertices,faces, [0]*len(faces), [], [{'name':'root','first_face':0,'num_faces':len(faces)}])
    auto=Camera(azimuth=0,elevation=0,fit='bounds')
    fixed=Camera(azimuth=0,elevation=0,fit='fixed',pixel_scale=27,
                 pixel_center=(128,192),reference_size=SIZE)
    # A construction grown by 30% must change its registered silhouette.
    sm=Mesh(vertices*1.3,faces, [0]*len(faces), [], [{'name':'root','first_face':0,'num_faces':len(faces)}])
    a=silhouette(m,auto,SIZE)>0;b=silhouette(sm,auto,SIZE)>0
    c=silhouette(m,fixed,SIZE)>0;d=silhouette(sm,fixed,SIZE)>0
    assert np.array_equal(a,b)
    assert not np.array_equal(c,d)
    assert np.sum(c^d)>500


def test_frozen_display_snapshot_matches_baseline_without_claiming_registration():
    from projection_loom.calibration import freeze_display_camera
    auto=Camera(azimuth=45,elevation=16,roll=5,fit='bounds')
    fixed=freeze_display_camera(auto,POINTS,SIZE)
    assert np.max(abs(auto.project(POINTS,SIZE)[0]-fixed.project(POINTS,SIZE)[0]))<1e-10
    assert fixed.fit=='fixed'
    assert np.max(abs(auto.project(POINTS*1.2,SIZE)[0]-fixed.project(POINTS*1.2,SIZE)[0]))>5


def test_fixed_scale_requires_explicit_reference_frame():
    c=Camera(fit='fixed',pixel_scale=8)
    with pytest.raises(ValueError,match='reference_size'):
        c.project(POINTS,SIZE)


def test_symmetric_cube_null_cannot_identify_yaw():
    from projection_loom.solid import box
    from projection_loom.geometry import Mesh
    from projection_loom.render import silhouette
    s=box((0,0,0),(2,2,2))
    verts,faces=s.tessellate(.2,.25)
    vertex=np.array([v.toTuple() for v in verts])
    m=Mesh(vertex,np.array(faces,int),[0]*len(faces),[],[])
    a=Camera(azimuth=0,elevation=0,fit='fixed',pixel_scale=35,
             reference_size=SIZE,pixel_center=(128,192))
    b=Camera(azimuth=90,elevation=0,fit='fixed',pixel_scale=35,
             reference_size=SIZE,pixel_center=(128,192))
    assert np.array_equal(silhouette(m,a,SIZE),silhouette(m,b,SIZE))


def test_fixed_projection_rejects_non_uniform_resizing():
    c=Camera(fit='fixed', pixel_scale=12, reference_size=SIZE)
    with pytest.raises(ValueError, match='non-uniformly'):
        c.project(POINTS,(256,256))


def test_full_control_render_respects_fixed_viewport_and_supersampling():
    from projection_loom.solid import box
    from projection_loom.geometry import Mesh
    from projection_loom.render import silhouette, render_controls
    s=box((0,0,0),(2.2,2.7,3.1))
    vs,fs=s.tessellate(.2,.25)
    verts=np.array([v.toTuple() for v in vs]); faces=np.array(fs,int)
    mesh=Mesh(verts,faces,[0]*len(faces),[],[])
    camera=Camera(azimuth=32,elevation=20,fit='fixed',pixel_scale=20,
                  pixel_center=(128,192),reference_size=SIZE)
    render=render_controls(mesh,camera,size=(128,192),
         style={'linework_mode':'semantic','supersample':2,'work_width':128})
    expected=silhouette(mesh,camera,(128,192),supersample=2)
    assert np.array_equal(np.array(render['silhouette']),expected)
    assert np.count_nonzero(expected)>100
