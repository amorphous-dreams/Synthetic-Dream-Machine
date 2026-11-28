"""Known-answer terrain and control-pose witnesses; no stale architecture seeds."""
import numpy as np
import pytest
from projection_loom.location_stack import LocationStack,Frame,Source
from projection_loom.geospatial import inspect_dem,sample_dem,project_xy
from projection_loom.registration3d import fit_rigid,apply_rigid,register_landmarks,register_control_csv


def make_stack(tmp_path,datum='NAVD88'):
    import rasterio
    from rasterio.transform import from_origin
    f=tmp_path/'heights.tif'
    with rasterio.open(f,'w',driver='GTiff',height=3,width=3,count=1,dtype='float32',
                       crs='EPSG:32610',transform=from_origin(500000,5100000,10,10),nodata=-9999) as out:
        out.write(np.array([[10,11,12],[13,-9999,15],[16,17,18]],dtype='float32'),1)
    stack=LocationStack('synthetic-terrain')
    stack.add_frame(Frame('utm','geospatial3d','m',crs='EPSG:32610',vertical_datum=datum))
    stack.add_source(Source.from_file('dem','dem',f,'utm'))
    return stack,f


def test_real_dem_metadata_mask_and_sample(tmp_path):
    stack,_=make_stack(tmp_path)
    result=inspect_dem(stack,'dem')
    assert result.width==3 and result.height==3 and result.valid_fraction==pytest.approx(8/9)
    xy=[[500005,5099995],[500015,5099985],[500025,5099975],[499999,5099995]]
    assert sample_dem(stack,'dem',xy)==[10,None,18,None]


def test_dem_digest_and_crs_do_not_silently_shift(tmp_path):
    stack,f=make_stack(tmp_path)
    f.write_bytes(b'tampered source')
    with pytest.raises(ValueError,match='no longer agree'):
        inspect_dem(stack,'dem')


def test_dem_rejects_datum_conflict_and_unscaled_frame(tmp_path):
    stack,_=make_stack(tmp_path)
    stack.add_frame(Frame('other','geospatial3d','m',crs='EPSG:32610',vertical_datum='EGM96'))
    with pytest.raises(ValueError,match='datum'):
        sample_dem(stack,'dem',[[500005,5099995]],point_frame='other')
    stack.add_frame(Frame('pixel','pixel','px'))
    with pytest.raises(ValueError,match='geospatial'):
        sample_dem(stack,'dem',[[0,0]],point_frame='pixel')


def test_known_horizontal_crs_transform_round_trip(tmp_path):
    stack,_=make_stack(tmp_path)
    a=stack.frames['utm']
    b=Frame('utm-other','geospatial3d','m',crs='EPSG:26910',vertical_datum='NAVD88')
    p=np.array([[500005.,5099995.]])
    new=project_xy(p,a,b)
    old=project_xy(new,b,a)
    assert np.allclose(p,old,atol=0.03)


def test_rigid_registration_known_answer_and_heldouts(tmp_path):
    stack,_=make_stack(tmp_path)
    stack.add_frame(Frame('local','local3d','m'))
    a=np.array([[0,0,0],[1,0,0],[0,2,0],[0,0,3],[2,1,0]],dtype=float)
    h=np.array([[2,2,2],[3,1,2],[1,3,4]],dtype=float)
    R=np.array([[0,-1,0],[1,0,0],[0,0,1]])
    shift=np.array([12.,-7.,3.])
    controls=tmp_path/'measured.csv'
    with controls.open('w') as stream:
        stream.write("phase,sx,sy,sz,tx,ty,tz\n")
        for phase,pts in (("train",a),("holdout",h)):
            for src,tgt in zip(pts,pts@R.T+shift):
                stream.write(phase+","+",".join(map(str,[*src,*tgt]))+"\n")
    stack.add_source(Source.from_file("survey","survey_control",controls,"utm"))
    fit=register_control_csv(stack,"local","utm","survey",tolerance_m=.001)
    assert fit.state=='verified' and fit.holdout_rms<1e-8
    assert np.allclose(apply_rigid(h,fit.matrix),h@R.T+shift)
    assert stack.audit()['verified_registrations']==1
    assert fit.to_dict()['sha256']


def test_registration_wrong_pose_and_unverified(tmp_path):
    stack,_=make_stack(tmp_path)
    stack.add_frame(Frame('local','local3d','m'))
    a=np.array([[0,0,0],[1,0,0],[0,2,0],[0,0,3]],float)
    h=np.array([[2,2,2],[3,1,2],[1,3,4]],float)
    fit=register_landmarks(stack,'local','utm',a,a+1,h,h+np.array([6,0,0]),
                          tolerance_m=.1)
    assert fit.state=='provisional' and stack.audit()['verified_registrations']==0
    apparent=register_landmarks(stack,"local","utm",a,a+1,h,h+1,tolerance_m=.1)
    assert apparent.state=="provisional"  # Naked arrays never self-certify.
    with pytest.raises(ValueError,match='collinear'):
        fit_rigid([[0,0,0],[1,0,0],[2,0,0]],[[0,0,0],[1,0,0],[2,0,0]])


def test_unknown_height_datum_preserves_native_pixels(tmp_path):
    stack,_=make_stack(tmp_path,datum='unknown')
    assert sample_dem(stack,'dem',[[500005,5099995]])==[10.]
    stack.add_frame(Frame('neighbor','geospatial3d','m',crs='EPSG:26910',
                          vertical_datum='unknown'))
    with pytest.raises(ValueError,match='Unknown vertical datum'):
        sample_dem(stack,'dem',[[500005,5099995]],point_frame='neighbor')
