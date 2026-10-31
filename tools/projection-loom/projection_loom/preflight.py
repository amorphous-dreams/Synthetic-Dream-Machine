"""Reference-scoring preflight: independent of CAD backend and testable with numpy."""
from dataclasses import dataclass
import numpy as np

@dataclass(frozen=True)
class RegistrationReceipt:
    reference_sha256: str
    camera_id: str
    projection: str
    transform: tuple
    calibration_source: str
    holdout_verified: bool


def validate_receipt(receipt):
    if not receipt.reference_sha256 or len(receipt.reference_sha256) != 64:
        raise ValueError('Reference digest missing or malformed')
    if not receipt.camera_id or receipt.projection != 'orthographic':
        raise ValueError('Camera or projection is not registered')
    if not receipt.calibration_source or not receipt.holdout_verified:
        raise ValueError('Independent registration verification required')
    if not np.isfinite(np.asarray(receipt.transform,dtype=float)).all():
        raise ValueError('Nonfinite registration transform')
    return True


def silhouette_loss(reference, prediction):
    a=np.asarray(reference,dtype=bool)
    b=np.asarray(prediction,dtype=bool)
    if a.shape != b.shape or not a.any():
        raise ValueError('Reference mask missing or shapes differ')
    union=np.logical_or(a,b).sum()
    return 1.0-float(np.logical_and(a,b).sum())/max(int(union),1)


def partitioned_loss(reference,prediction,region_weights):
    """Divide weighted global union to retain false-positive area outside reference.

    Region masks may overlap; their weights are normalized at each pixel.
    An explicit nonzero background weight penalizes exterior geometry.
    """
    a=np.asarray(reference,dtype=bool)
    b=np.asarray(prediction,dtype=bool)
    weights=np.zeros(a.shape,dtype=float)
    for region, weight in region_weights:
        m=np.asarray(region,dtype=float)
        if m.shape != a.shape or not np.isfinite(m).all() or np.min(m)<0 or weight<0:
            raise ValueError('Bad region evidence')
        weights+=float(weight)*m
    if a.shape != b.shape or not a.any():
        raise ValueError('Bad reference/prediction pair')
    weights=np.maximum(weights,0.25) # explicit exterior false-positive coverage
    union=np.logical_or(a,b)
    delta=np.logical_xor(a,b)
    return float((weights*delta).sum()/max((weights*union).sum(),1e-12))


def assess_promotion(trials, min_trials=3):
    """Conservative promotion eligibility, not statistical significance test."""
    if len(trials)<min_trials:
        return {'promote':False,'reason':'insufficient independently evolved trials'}
    for trial in trials:
        if not trial.get('registration_holdout_pass') or not trial.get('all_accepts_valid'):
            return {'promote':False,'reason':'registration or CAD gate missing'}
        if trial.get('treatment_budget')!=trial.get('control_budget'):
            return {'promote':False,'reason':'unequal computational budgets'}
    improvements=[t['control_holdout_loss']-t['treatment_holdout_loss'] for t in trials]
    return {'promote':False,'reason':'human blind review and statistical uncertainty analysis still required',
            'paired_improvements':improvements,'median_improvement':float(np.median(improvements))}
