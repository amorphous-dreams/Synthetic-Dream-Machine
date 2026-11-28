"""Scientific fracture-pattern proposals, independent of structural CAD authority.

Villermaux (2025) supplies a bounded fragment-size statistical prior. Polygon
tessellation gives an explicitly *synthetic* 2D crack network; junction counts
describe that pattern, NOT a solved stress field or a reconstruction of
physical fracture. All output sizes and fragment counts have hard finite caps.

References:
  Villermaux, PRL 135, 228201 (2025), doi:10.1103/r7xz-5d9c
  Domokos et al., PNAS (2020), doi:10.1073/pnas.2001037117
  Silver et al., PNAS (2025), doi:10.1073/pnas.2411738122
"""
from __future__ import annotations

from hashlib import sha256
from pathlib import Path
import math

import numpy as np
from scipy.spatial import cKDTree
from scipy.ndimage import convolve
from PIL import Image

from .epochs import _atomic, _hash

EXPONENTS = {1: 1.3, 2: 2.4, 3: 3.5}
MAX_PIXELS = 512 * 512
MAX_FRAGMENTS = 512


def bounded_fragment_sizes(*, dimension=3, count=64, min_size=1.,
                           max_size=64., seed=41, max_total_measure=None):
    """Inverse-CDF samples of a normalized, truncated number-size power law.

    p(d) proportional to d^-beta; count, size cutoff and resource ceiling
    prevent the infinite-small-fragment interpretation. Size units are caller
    supplied. A physical claim requires material/fracture-energy calibration.
    """
    if dimension not in EXPONENTS or type(dimension) is not int:
        raise ValueError("Fragment dimensionality must be 1, 2, or 3")
    if type(count) is not int or not 1 <= count <= MAX_FRAGMENTS:
        raise ValueError("Finite fragment count must be 1..512")
    if type(seed) is not int:
        raise ValueError("Deterministic seed must be an integer")
    if (not math.isfinite(min_size) or not math.isfinite(max_size)
            or not 0 < min_size < max_size):
        raise ValueError("Fragment cutoffs must be positive, ordered, finite")
    if max_total_measure is not None and (
            not math.isfinite(max_total_measure) or max_total_measure <= 0):
        raise ValueError("Fragment resource ceiling must be finite and positive")
    beta = EXPONENTS[dimension]
    u = np.random.default_rng(seed).random(count)
    exponent = 1 - beta
    sizes = (min_size ** exponent +
             u * (max_size ** exponent - min_size ** exponent)) ** (1 / exponent)
    sizes.sort()
    sizes = sizes[::-1]
    retained = []
    total = 0.
    for size in sizes:
        measure = float(size) ** dimension
        if max_total_measure is not None and total + measure > max_total_measure:
            continue
        retained.append(float(size))
        total += measure
    return {"schema": "projection-loom/fragment-size-prior",
            "law": "truncated number-size power law; approximate regime prior",
            "dimension": dimension, "beta": beta, "seed": seed,
            "min_size": float(min_size), "max_size": float(max_size),
            "requested": count, "retained": len(retained),
            "total_size_power": total,
            "unmodeled_count": count - len(retained),
            "sizes": retained,
            "resource_ceiling": max_total_measure,
            "measurement_authority": "synthetic sampled statistical prior; not mechanically certified"}


def crack_field(*, size=(128, 192), cells=36, seed=41,
                anisotropy=1.0, width_px=1):
    """Bounded Voronoi crack *proposal*, with measured junction topology.

    scikit-image supplies morphological skeletonization. Connected line
    junctions are counted as degree-3 and degree-4+, rather than claiming
    causal T/Y/X histories from noisy raster connectivity alone.
    """
    if (len(size) != 2 or any(type(x) is not int or not 32 <= x <= 512
                              for x in size) or size[0] * size[1] > MAX_PIXELS):
        raise ValueError("Crack raster dimensions exceed finite bounds")
    if type(cells) is not int or not 3 <= cells <= 128:
        raise ValueError("Crack tessellation requires 3..128 cells")
    if type(seed) is not int or not math.isfinite(anisotropy) or not .25 <= anisotropy <= 4:
        raise ValueError("Finite anisotropy and deterministic seed required")
    if type(width_px) is not int or width_px not in (1, 2, 3):
        raise ValueError("Crack width must be 1..3 pixels")
    from skimage.morphology import skeletonize, binary_dilation, disk
    w,h=size
    rng=np.random.default_rng(seed)
    seeds=rng.random((cells, 2))
    seeds[:, 0]*=w
    seeds[:, 1]*=h
    transformed=seeds.copy()
    transformed[:, 0]*=anisotropy
    yy,xx=np.mgrid[:h,:w]
    points=np.column_stack((xx.ravel()*anisotropy,yy.ravel()))
    labels=cKDTree(transformed).query(points,k=1,workers=1)[1].reshape(h,w)
    # Identify adjacent Voronoi regions without edge-wrap artifacts.
    crack=np.zeros((h,w),dtype=bool)
    different=(labels[:,1:]!=labels[:,:-1])
    crack[:,1:]|=different
    crack[1:,:]|=(labels[1:,:]!=labels[:-1,:])
    skeleton=skeletonize(crack)
    pixels=skeleton if width_px==1 else binary_dilation(skeleton,disk(width_px-1))
    # Count neighborhood-degree junction pixel clusters, not per-pixel
    # occurrences of the same junction.
    kernel=np.ones((3,3),dtype=np.uint8)
    kernel[1,1]=0
    neighbors=convolve(skeleton.astype(np.uint8),kernel,mode="constant",cval=0)
    from scipy.ndimage import label as connected_components
    three=int(connected_components(skeleton & (neighbors==3))[1])
    four=int(connected_components(skeleton & (neighbors>=4))[1])
    area=np.bincount(labels.ravel(),minlength=cells)
    data={"schema":"projection-loom/synthetic-crack-network",
          "size":[w,h],"seed":seed,"cells":cells,
          "anisotropy":float(anisotropy),"line_width_px":width_px,
          "junction_observation":{"degree_3_clusters":three,
                                  "degree_4plus_clusters":four,
                                  "causal_T_Y_X_classification":"not inferred"},
          "cell_area_pixels":area.astype(int).tolist(),
          "visible_crack_pixels":int(pixels.sum()),
          "mask_sha256":sha256(pixels.astype(np.uint8).tobytes()).hexdigest(),
          "generation":"Voronoi cell boundary followed by skeletonized raster",
          "authority":"2D statistical appearance hypothesis, not structural CAD or stress evidence"}
    return data,pixels


def export_pattern(output, *, size=(128,192), cells=36, seed=41,
                   anisotropy=1., width_px=1, dimension=3,
                   fragments=64, min_size=1., max_size=64.,
                   max_total_measure=None):
    """Deliver a reusable mask and signed science-parameter receipt."""
    output=Path(output)
    network,mask=crack_field(size=size,cells=cells,seed=seed,
                             anisotropy=anisotropy,width_px=width_px)
    fragments_record=bounded_fragment_sizes(
        dimension=dimension,count=fragments,min_size=min_size,
        max_size=max_size,seed=seed,max_total_measure=max_total_measure)
    report={"schema":"projection-loom/fracture-pattern-proposal",
            "network":network,"fragments":fragments_record,
            "references":[
                "doi:10.1103/r7xz-5d9c",
                "doi:10.1073/pnas.2001037117",
                "doi:10.1073/pnas.2411738122"],
            "claims":"statistical and visual hypotheses only; actual CAD remains separately audited"}
    report["sha256"]=_hash(report)
    target=output/"pattern.json"
    if target.exists() and report!=__import__("json").loads(target.read_text()):
        raise ValueError("Fracture pattern identity differs from existing output")
    output.mkdir(parents=True,exist_ok=True)
    Image.fromarray(mask.astype(np.uint8)*255,"L").save(output/"cracks.png")
    _atomic(target,report)
    return report
