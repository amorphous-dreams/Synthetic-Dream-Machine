# Measured evidence enters without fictional scale

## A native source keeps its own frame

A single painting can supply pixels and an alpha mask without claiming meters.
A real DEM supplies a geotransform, projected horizontal CRS, native pixels,
valid/nodata mask and *declared* vertical datum; a user-specified height datum
is not automatically verified by the raster. Reading a DEM never changes its
source bytes. `inspect_dem(stack,source_id)` verifies the SHA-256 digest and
reads the actual GeoTIFF; `sample_dem` uses the native affine/index mapping
and refuses absent cells. No interpolation fills nodata without another
explicit operation and record.

`project_xy` supports horizontal projected-meter CRS changes **only when named
vertical datums agree**. The height channel remains untouched; grid-required
transformations fail if unavailable. Compound CRS/vertical-datum transformations
need a separate anchored backend.

## A control fit keeps an independent holdout

`fit_rigid` estimates a proper SE(3) transformation without scaling. It rejects
collinear anchors, reflections by using a positive-determinant rotation, and
nonfinite inputs. Manually supplied correspondences remain *provisional*.

`register_control_csv` reads training and held-out correspondence pairs from a
hashed `survey_control` source, then measures train and holdout RMS and worst
holdout error. Only a sufficiently low error receives a `verified` **file-backed
registration** receipt. Survey authenticity remains a source claim, not a
cryptographic proof of real-world measurement. It certifies this *3D-to-3D*
fit, not an oblique *3D-to-image* camera.

## Boundary tests

- Change a DEM byte after registration: reject before sampling.
- Change EPSG/horizontal units: reject or apply real available CRS operation.
- Swap vertical datums: reject rather than keeping the same Z silently.
- Sample valid pixel, masked pixel, and outside bounds: retain each status.
- Rotate/translate a known asymmetric set: recover independent holdouts.
- Feed a wrong pose: retain a provisional result.
- Feed only manually supplied arrays: never certify source-backed registration.

The measured source can later contribute to a factor graph or bundle adjustment;
these implementations neither run SfM nor infer global image scale.

## Sampled surface witnesses

`load_xyz` reads actual three-column XYZ records from digest-checked
`point_cloud` sources. `sample_mesh` takes deterministic samples on triangles
from an OBJ surface witness; neither may supply a CAD evolution genome.
`sampled_surface_distance` reports an approximate two-way nearest-sample
RMS **only when source frames and units match**. It does not compute exact
point-to-BRep distances or verify a point cloud's survey accuracy.
