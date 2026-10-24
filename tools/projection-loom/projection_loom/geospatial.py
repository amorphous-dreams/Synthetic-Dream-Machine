"""Measured DEM witnesses, independent of architecture and construction scale.

Read real raster metadata, masks and pixel centers with Rasterio.  Never infer
meters from an unscaled picture or repair a missing vertical datum.  Conversion
is limited to projected metric frames with *matching* named height datums; a
true vertical-datum transformation requires separately certified control data.
"""
from __future__ import annotations
from dataclasses import dataclass, asdict
from pathlib import Path
from hashlib import sha256
import math
import numpy as np

from .location_stack import Frame, Source, LocationStack


def _source_file(stack: LocationStack, source_id: str, expected_kind: str):
    stack.audit()
    source = stack.sources[source_id]
    if source.kind != expected_kind:
        raise ValueError(f'Expected {expected_kind} source')
    path = Path(source.locator)
    if not path.is_file():
        raise FileNotFoundError(path)
    hasher=sha256()
    with path.open('rb') as stream:
        for chunk in iter(lambda: stream.read(1024*1024), b''):
            hasher.update(chunk)
    actual=hasher.hexdigest()
    if actual != source.sha256:
        raise ValueError('Source bytes no longer agree with the source witness')
    return path, source, stack.frames[source.frame_id]


def _meter_crs(frame: Frame):
    from pyproj import CRS
    if frame.kind != 'geospatial3d':
        raise ValueError('DEM coordinates require a geospatial frame')
    crs = CRS.from_user_input(frame.crs)
    if not crs.is_projected or not crs.axis_info:
        raise ValueError('DEM sampling requires a projected horizontal CRS in meters')
    if any(abs(float(ax.unit_conversion_factor) - 1.0) > 1e-8 for ax in crs.axis_info[:2]):
        raise ValueError('DEM horizontal axes must use meters')
    return crs


@dataclass(frozen=True)
class DEMMetadata:
    source_id: str
    source_sha256: str
    frame_id: str
    width: int
    height: int
    bands: int
    crs: str
    vertical_datum: str
    transform: tuple[float, ...]
    nodata: float | None
    valid_fraction: float

    def to_dict(self):
        return asdict(self)


def inspect_dem(stack: LocationStack, source_id: str) -> DEMMetadata:
    """Read actual raster metadata; no resampling, height or datum inference."""
    import rasterio
    path, source, frame = _source_file(stack, source_id, 'dem')
    declared = _meter_crs(frame)
    with rasterio.open(path) as ds:
        if ds.count < 1 or ds.crs is None or ds.width < 1 or ds.height < 1:
            raise ValueError('DEM must have at least one georeferenced raster band')
        if not declared.equals(ds.crs):
            raise ValueError('Raster CRS disagrees with its declared evidence frame')
        if abs(ds.transform.a * ds.transform.e - ds.transform.b * ds.transform.d) < 1e-12:
            raise ValueError('DEM geotransform cannot be singular')
        # Block windows bound memory even for a very large terrain surface.
        n_good=0
        for _,window in ds.block_windows(1):
            values=ds.read(1,window=window,masked=True)
            n_good+=int(np.count_nonzero(~np.ma.getmaskarray(values) &
                                        np.isfinite(values.filled(np.nan))))
        return DEMMetadata(
            source.id, source.sha256, frame.id, ds.width, ds.height,
            ds.count, str(ds.crs), frame.vertical_datum,
            tuple(float(v) for v in ds.transform[:6]),
            float(ds.nodata) if ds.nodata is not None and math.isfinite(ds.nodata) else None,
            float(n_good/(ds.width*ds.height)))


def project_xy(points, source_frame: Frame, destination_frame: Frame):
    """Convert *horizontal* projected-meter coordinates without moving Z.

    We reject datum changes rather than pretending the height channel follows
    the horizontal reprojection. A vertical grid or control fit belongs to a
    separate independently validated transformation.
    """
    from pyproj.transformer import TransformerGroup
    a = _meter_crs(source_frame)
    b = _meter_crs(destination_frame)
    if source_frame.vertical_datum != destination_frame.vertical_datum:
        raise ValueError('Mismatched vertical datum')
    pts = np.asarray(points, dtype=float)
    if pts.ndim != 2 or pts.shape[1] != 2 or not np.isfinite(pts).all():
        raise ValueError('Expected finite Nx2 horizontal points')
    if a.equals(b):
        # Native samples may report relative heights with an unknown datum.
        return pts.copy()
    if source_frame.vertical_datum in (None, 'unknown'):
        raise ValueError('Unknown vertical datum; no cross-frame height claim')
    group = TransformerGroup(a, b, always_xy=True)
    if not group.best_available or not group.transformers:
        raise ValueError('Required coordinate operation or grid is unavailable')
    x,y = group.transformers[0].transform(pts[:,0].tolist(),pts[:,1].tolist(),errcheck=True)
    xy = np.column_stack((x,y))
    if not np.isfinite(xy).all():
        raise ValueError('Invalid transformed coordinates')
    return xy


def sample_dem(stack: LocationStack, source_id: str, points, *, point_frame: str | None = None):
    """Sample raster values using its own transform and valid-data mask.

    An out-of-bounds/nodata coordinate reports None; no interpolation across
    missing terrain. Query points must carry a declared metric geospatial frame.
    """
    import rasterio
    from rasterio.windows import Window
    path, source, frame = _source_file(stack, source_id, 'dem')
    inspect_dem(stack, source_id)
    query_frame = stack.frames[point_frame] if point_frame else frame
    xy = project_xy(points, query_frame, frame)
    values = []
    with rasterio.open(path) as ds:
        for x,y in xy:
            r,c = ds.index(float(x),float(y))
            if not (0 <= r < ds.height and 0 <= c < ds.width):
                values.append(None)
                continue
            data = ds.read(1, window=Window(c,r,1,1), masked=True)
            values.append(None if np.ma.is_masked(data[0,0]) or
                          not np.isfinite(float(data[0,0])) else float(data[0,0]))
    return values
