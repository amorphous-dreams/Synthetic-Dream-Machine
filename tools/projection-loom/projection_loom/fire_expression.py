"""Paired view evidence for Fire native alternatives; no artistic fitness verdict.

Only masks projected through the SAME frozen camera enter a comparison.
Counts describe observable changes, not structural safety or source fidelity.
"""
from __future__ import annotations

from hashlib import sha256
import numpy as np


def mask_comparison(source, alternative):
    """Return reproducible counts for two same-camera binary silhouettes."""
    before = np.asarray(source)
    after = np.asarray(alternative)
    if before.ndim != 2 or after.ndim != 2 or before.shape != after.shape:
        raise ValueError("Fire expression requires same-size two-dimensional masks")
    if before.dtype != np.dtype("bool") or after.dtype != np.dtype("bool"):
        raise ValueError("Fire expression requires boolean silhouette masks")
    appeared = after & ~before
    disappeared = before & ~after
    shared = before & after
    union = before | after
    total = int(np.count_nonzero(union))
    return {
        "original_mask_sha256": sha256(before.astype("uint8").tobytes()).hexdigest(),
        "variant_mask_sha256": sha256(after.astype("uint8").tobytes()).hexdigest(),
        "original_occupied": int(np.count_nonzero(before)),
        "variant_occupied": int(np.count_nonzero(after)),
        "appeared": int(np.count_nonzero(appeared)),
        "disappeared": int(np.count_nonzero(disappeared)),
        "shared": int(np.count_nonzero(shared)),
        "changed": int(np.count_nonzero(appeared | disappeared)),
        "silhouette_iou": float(np.count_nonzero(shared) / total) if total else 1.0,
    }


def difference_image(source, alternative):
    """Readable change plate: cyan appeared, coral disappeared, grey shared."""
    from PIL import Image
    before = np.asarray(source, dtype=bool)
    after = np.asarray(alternative, dtype=bool)
    if before.ndim != 2 or after.shape != before.shape:
        raise ValueError("Fire difference plate requires matching masks")
    plate = np.empty((*before.shape, 3), dtype="uint8")
    plate[:] = (17, 24, 34)
    plate[before & after] = (105, 116, 128)
    plate[after & ~before] = (74, 204, 225)
    plate[before & ~after] = (239, 118, 106)
    return Image.fromarray(plate, "RGB")
