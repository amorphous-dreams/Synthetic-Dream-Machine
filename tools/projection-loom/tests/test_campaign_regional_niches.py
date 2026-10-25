"""RED-first: a quality-diversity niche must distinguish measured regional architecture."""
import numpy as np
from projection_loom.campaign import visual_descriptor


def test_identical_global_bbox_area_and_asymmetry_can_differ_by_vertical_profile():
    h,w=48,64
    taper=np.zeros((h,w),dtype=bool)
    inverted=np.zeros_like(taper)
    for i,width in enumerate((8,16,24)):
        taper[i*16:(i+1)*16, (w-width)//2:(w+width)//2] = True
        inverted[i*16:(i+1)*16, (w-(32-width))//2:(w+(32-width))//2] = True
    a=visual_descriptor(taper)
    b=visual_descriptor(inverted)
    assert a['occupancy']==b['occupancy']
    assert a['bbox']==b['bbox']
    assert a['asymmetry']==b['asymmetry']
    assert a['mask_sha256'] != b['mask_sha256']
    # Source-grounded, regional phenotype, not genome parameter bins.
    assert a['niche'] != b['niche']
    assert a['region_widths'] != b['region_widths']


def test_region_niche_is_reproducible_and_tolerates_one_interior_pixel_change():
    mask=np.zeros((96,128),dtype=bool)
    mask[5:90,40:85]=True
    a=visual_descriptor(mask)
    assert a==visual_descriptor(mask.copy())
    modified=mask.copy(); modified[10,39]=True
    b=visual_descriptor(modified)
    assert a['mask_sha256'] != b['mask_sha256']
    assert a['niche']==b['niche']  # single-pixel perturbation is not a new island
