import sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).parents[1]))
import numpy as np
import pytest
from projection_loom.preflight import silhouette_loss,partitioned_loss,validate_receipt,RegistrationReceipt,assess_promotion

def test_perfect():
    a=np.zeros((8,8),bool);a[2:6,2:6]=1
    assert silhouette_loss(a,a)==0
    assert partitioned_loss(a,a,[(a.astype(float),1)])==0

def test_extraneous_area_is_penalized():
    a=np.zeros((8,8),bool);a[2:5,2:5]=1
    b=a.copy();b[0:2,0:2]=1
    assert silhouette_loss(a,b)>0
    assert partitioned_loss(a,b,[(a.astype(float),1)])>0

def test_empty_prediction_is_bad():
    a=np.zeros((8,8),bool);a[2:5,2:5]=1
    assert silhouette_loss(a,np.zeros_like(a))==1

def test_overlapping_regions_do_not_ignore_background():
    a=np.zeros((8,8),bool);a[2:5,2:5]=1
    b=a.copy();b[0,0]=1
    assert partitioned_loss(a,b,[(a.astype(float),1),(a.astype(float),2)])>0

def test_unverified_receipt_rejected():
    r=RegistrationReceipt('a'*64,'oblique','orthographic',(1,0,0,1),'',False)
    with pytest.raises(ValueError):validate_receipt(r)

def test_verified_receipt_ok():
    r=RegistrationReceipt('a'*64,'oblique','orthographic',(1,0,0,1),'independent landmarks',True)
    assert validate_receipt(r)

def test_shared_pool_does_not_get_promoted():
    assert not assess_promotion([])['promote']

def test_bad_budget_blocks_promotion():
    t={'registration_holdout_pass':True,'all_accepts_valid':True,'treatment_budget':10,'control_budget':5}
    assert 'unequal' in assess_promotion([t]*3)['reason']
