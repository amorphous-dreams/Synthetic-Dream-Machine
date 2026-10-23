"""Measured rigid camera/survey-frame correspondences, with independent holdouts.

This estimates an SE(3) transformation only, never invented global scale.  Its
verified receipt requires actual paired points, held-out points and a separate
survey-control source. It does not reconstruct a camera from one picture.
"""
from __future__ import annotations
from dataclasses import dataclass, asdict
from hashlib import sha256
import csv
from pathlib import Path
import json
import math
import numpy as np
from .location_stack import LocationStack, RegistrationReceipt


def _points(values):
    a = np.asarray(values,dtype=float)
    if a.ndim != 2 or a.shape[1] != 3 or len(a)<3 or not np.isfinite(a).all():
        raise ValueError('Need at least three finite 3D correspondences')
    if np.linalg.matrix_rank(a-a.mean(0),tol=1e-8)<2:
        raise ValueError('Landmarks are collinear or degenerate')
    return a


def fit_rigid(source, target):
    """Estimate the proper rigid transformation source -> target (unit scale)."""
    a,b=_points(source),_points(target)
    if a.shape!=b.shape:
        raise ValueError('Correspondence count differs')
    ac,bc=a.mean(0),b.mean(0)
    u,s,vt=np.linalg.svd((a-ac).T@(b-bc))
    rotation=vt.T@u.T
    if np.linalg.det(rotation)<0:
        vt[-1,:]*=-1
        rotation=vt.T@u.T
    transform=np.eye(4)
    transform[:3,:3]=rotation
    transform[:3,3]=bc-rotation@ac
    return transform


def apply_rigid(points, matrix):
    pts=np.asarray(points,dtype=float)
    t=np.asarray(matrix,dtype=float)
    if pts.ndim!=2 or pts.shape[1]!=3 or not np.isfinite(pts).all():
        raise ValueError('Expected finite Nx3 landmarks')
    if t.shape!=(4,4) or not np.isfinite(t).all() or not np.allclose(t[3],[0,0,0,1]):
        raise ValueError('Invalid affine matrix')
    if not np.allclose(t[:3,:3].T@t[:3,:3],np.eye(3),atol=1e-7) or np.linalg.det(t[:3,:3])<.9999:
        raise ValueError('Only proper rigid transformations are supported')
    return pts@t[:3,:3].T+t[:3,3]


@dataclass(frozen=True)
class RigidFit:
    source_frame: str
    target_frame: str
    matrix: tuple[tuple[float, ...], ...]
    training_rms: float
    holdout_rms: float
    holdout_max: float
    source_count: int
    holdout_count: int
    anchor_sources: tuple[str, ...]
    state: str
    threshold_m: float
    source_digests: tuple[str, ...]
    measured_from: str = "supplied-landmarks"

    def to_dict(self):
        obj=asdict(self)
        obj['schema']='projection-loom/measured-rigid-registration/v1'
        payload=json.dumps(obj,sort_keys=True,separators=(',',':')).encode()
        obj['sha256']=sha256(payload).hexdigest()
        return obj

    def receipt(self):
        return RegistrationReceipt(self.source_frame,self.target_frame,
                                   'independent-rigid-landmark-fit',self.state,
                                   self.anchor_sources,self.holdout_rms,'m')


def register_landmarks(stack: LocationStack, source_frame: str, target_frame: str,
                       train_source, train_target, holdout_source, holdout_target,
                       *, anchor_sources=(), tolerance_m=0.1, _control_file=None) -> RigidFit:
    """Fit supplied landmarks provisionally. File-backed control can verify it."""
    if not math.isfinite(tolerance_m) or tolerance_m<=0:
        raise ValueError('Tolerance must be positive')
    stack.audit()
    if source_frame==target_frame:
        raise ValueError('Registration must connect two distinct frames')
    frames=[stack.frames[f] for f in (source_frame,target_frame)]
    if any(f.kind not in ('local3d','geospatial3d') or f.units!='m' for f in frames):
        raise ValueError('Rigid metric registration requires two metric 3D frames')
    if any(f.kind=='geospatial3d' and f.vertical_datum=='unknown' for f in frames):
        raise ValueError('Registration cannot certify an unknown vertical datum')
    anchors=tuple(anchor_sources)
    if anchors and any(k not in stack.sources for k in anchors):
        raise ValueError('Unknown control source')
    if _control_file is not None and not any(stack.sources[k].kind=='survey_control' for k in anchors):
        raise ValueError('Independent survey-control source required')
    train_a,train_b=_points(train_source),_points(train_target)
    hold_a,hold_b=_points(holdout_source),_points(holdout_target)
    if train_a.shape!=train_b.shape or hold_a.shape!=hold_b.shape:
        raise ValueError('Landmark pair counts differ')
    # Duplicate training observations cannot masquerade as held-out testimony.
    if any(np.any(np.all(np.isclose(train_a,p,atol=1e-9),axis=1)) for p in hold_a):
        raise ValueError('Holdouts overlap calibration points')
    matrix=fit_rigid(train_a,train_b)
    train_errors=np.linalg.norm(apply_rigid(train_a,matrix)-train_b,axis=1)
    hold_errors=np.linalg.norm(apply_rigid(hold_a,matrix)-hold_b,axis=1)
    rms=lambda errs:float(np.sqrt(np.mean(errs**2)))
    a,b=rms(train_errors),rms(hold_errors)
    # Manual arrays cannot certify they came from the referenced source.
    # Verified status enters only through the digest-checked CSV reader.
    state=('verified' if _control_file is not None and
           max(a,b,float(hold_errors.max()))<=tolerance_m else 'provisional')
    fit=RigidFit(source_frame,target_frame,tuple(tuple(float(v) for v in row) for row in matrix),
                 a,b,float(hold_errors.max()),len(train_a),len(hold_a),anchors,state,
                 float(tolerance_m),tuple(stack.sources[k].sha256 for k in anchors),
                 str(_control_file) if _control_file else 'supplied-landmarks')
    stack.register(fit.receipt())
    return fit


def register_control_csv(stack: LocationStack, source_frame: str, target_frame: str,
                         control_id: str, *, tolerance_m: float = 0.1) -> RigidFit:
    """Fit training/holdout pairs read from a digest-checked control CSV.

    Required columns: phase, sx,sy,sz, tx,ty,tz. Independent means not
    included in the training fit; survey authenticity remains a source claim.
    """
    control=stack.sources[control_id]
    if control.kind!='survey_control' or control.frame_id!=target_frame:
        raise ValueError('Control witness must originate in target survey frame')
    path=Path(control.locator)
    if not path.is_file() or sha256(path.read_bytes()).hexdigest()!=control.sha256:
        raise ValueError('Control file digest disagrees with source witness')
    groups={'train':([],[]),'holdout':([],[])}
    with path.open(newline='',encoding='utf8') as stream:
        reader=csv.DictReader(stream)
        expected={'phase','sx','sy','sz','tx','ty','tz'}
        if set(reader.fieldnames or [])!=expected:
            raise ValueError('Unexpected survey-control CSV columns')
        for row in reader:
            if row['phase'] not in groups:
                raise ValueError('Control rows need train or holdout phase')
            pairs=groups[row['phase']]
            pairs[0].append([float(row[k]) for k in ('sx','sy','sz')])
            pairs[1].append([float(row[k]) for k in ('tx','ty','tz')])
    return register_landmarks(stack,source_frame,target_frame,*groups['train'],
                              *groups['holdout'],anchor_sources=(control_id,),
                              tolerance_m=tolerance_m,_control_file=str(path))
