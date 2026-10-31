<!-- Research archive: Projection_Loom_Known_Neutral_Null_Calibration_IV.zip / Projection_Loom_Calibration_IV/README.md. Historical experimental testimony, not an active model or test fixture. -->

# Projection Loom: Known / Neutral / Null Calibration IV

Status: **local tested candidate**, NOT merged into PR #84, and NOT a verified
camera calibration of the Necrospire artist's master image.

## Executive observation

The existing `fit: bounds` / `fit: height` camera adapts its image scale to EACH
candidate's bounding box. This can erase growth variations before they are
scored. A 30% enlargement of the recovered Necrospire CAD seed produced exactly
the same silhouette under candidate-by-candidate auto-fit (IoU = 1.000), while a
frozen camera gave IoU = 0.65310 relative to the original candidate.

## New code

- `projection_loom/cameras.py`: backward-compatible display auto-fit,
  PLUS `fit: fixed`, `roll`, `pixel_scale`, `pixel_center`, `world_anchor`,
  and `reference_size`; respects supersampling and rejects nonuniform frame
  resizing rather than silently deforming an orthographic witness.
- `projection_loom/calibration.py`: constrained orthographic 3D-to-2D
  landmark fit, independent held-out reprojection diagnostics, facing-direction
  prior, null-image diagnosis, and `freeze_display_camera()`.
- `preflight.py`: unchanged prior preflight guard module; bundled to keep
  the research state reproducible.
- `tests/test_calibration.py`: 23 known, neutral, null and real-source tests.
- `tests/test_preflight.py`, `tests/test_evidence.py`,
  `tests/test_refinement_guards.py`: recovered previous tests.
- `tests/test_pipeline.py`, `tests/test_solids.py`: historical test logic
  adapted to the RECOVERED 7-solid, 3-void, 6-camera local specimen.
  The original test files are preserved in `historical_tests/` as evidence.

## Run

Requires Python 3.12+, CadQuery/OpenCascade, NumPy, SciPy, OpenCV, Pillow,
Pytest, and the dependencies already used by the recovered local Loom.

```bash
python -m pip install -e '.[test]'  # or install equivalent dependencies
PYTHONPATH=. pytest -q tests
PYTHONPATH=. python run_calibration_bench.py
```

Observed: **56/56 regression tests pass**; known oracle benchmark **16/16**
passed (four camera directions times four noise levels). Worst synthetic held-out
reprojection RMS = 0.803 px, median = 0.244 px. These are calibrated SYNTHETIC
3D-2D points, not the Necrospire artwork.

## Controls

- **Known**: asymmetric, noncoplanar 14-point 3D fiducial rig; ten known
  points fit camera, four held out; target image points computed by a separate
  analytic orthographic projector.
- **Neutral**: valid CAD seed and simple box; check rendering of exact known
  geometries without interpretive painting.
- **Nulls**: blank/full silhouette, constant-color internal pixels,
  degenerate planar 3D landmarks, mirrored view with independent facing prior,
  deliberately wrong camera/translation, and strong perspective distortion.
- **Nonidentifiability**: a symmetric cube from two distinct camera azimuths
  produced the same silhouette; geometry appearance alone cannot determine
  all camera parameters.

In the negative controls the reflected camera was rejected with 180-degree
facing discrepancy, perspective-perturbed landmarks with 18.7 px holdout RMS,
and an intentionally wrong pose with 12.0 px reprojection RMS.

## Master reference: scope of evidence

- Original RGBA alpha = archived exact 8-bit alpha **byte-for-byte as pixels**.
- Original reference silhouette coverage at threshold 96: 13.156%.
- Recovered CAD seed valid under its structural + void audit.
- Frozen candidate auto-fit is a USEFUL repeatable viewport but it has **not**
  been calibrated against independently verified 3D coordinates in the artist
  image. The real reference receipt says `UNREGISTERED`.
- Side-label review: in this camera convention `front azimuth=0` looks from -Y;
  `l-side azimuth=90` actually looks from +X and `r-side azimuth=270` from -X.
  Confirm the intended handedness before publishing paired L/R drawings.

## OODA-HA

Observe: camera auto-fit conceals scale changes; original source alpha is
reliable, but camera pose is not independently grounded.

Orient: known 3D-2D fiducials can identify a camera, while a symmetric or
featureless artifact cannot. Do not substitute a perspective camera solution
for our axonometric rendering model.

Decide: freeze camera and pixel frame ahead of construction fitness evaluation.
Keep display auto-fit ONLY as a presentation operation.

Act: implement constrained fitted camera, null gates, independent synthetic
oracle, holdout checks and regression tests.

Aftermath: the machinery passes tests, but the Necrospire-specific camera is
still an unverified hypothesis. Do not use these results to certify improved
architectural growth or promote RGBA internal-edge fitness yet.

## Next integration and experimentation

1. Obtain independently held 3D-to-image correspondences for the ACTUAL
   Necrospire: anchored design dimensions / a locked three-dimensional
   reference artifact and hand-confirmed matching locations in the original
   RGBA. Avoid deriving both sides of the correspondences from the candidate
   being evaluated.
2. Fit the real fixed camera, including silhouette crop and roll, freeze it,
   and lock holdout landmarks as external evidence.
3. Run independent paired evolutionary searches with identical CAD budgets,
   shared initial seeds, and frozen camera. Preserve multi-view and morphology
   holdouts. Audit valid fused solids and connected negative spaces.
4. Before a PR commit, run clean-checkout tests from the PR branch. The PR's
   historical 25-part assumptions do not match the recovered seven-part
   void-growth project used in this package.

## Research precedents

- OpenCV, camera calibration using known object/world points, with independent
  reprojection errors: https://docs.opencv.org/5.0/tutorials/calib3d/camera_calibration_square_chess/camera_calibration_square_chess.html
- OpenCascade HLR projection interfaces, including axonometric projector:
  https://occt3d.com/dev/doc/refman/html/class_h_l_r_algo___projector.html
- OpenCascade exact BRep versus approximate polyhedral HLR:
  https://github.com/Open-Cascade-SAS/OCCT/blob/master/dox/user_guides/modeling_algos/modeling_algos.md

The OpenCV chessboard example uses photographic perspective calibration; we
borrow its known-target / reprojection-evidence design, NOT its pinhole model.
The benchmark here fits the Loom's explicit *orthographic* camera.
