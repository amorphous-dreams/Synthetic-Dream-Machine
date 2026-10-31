"""One named source entity carrying appearance and silhouette witnesses.

An extracted alpha is a channel of the *same* artwork, not a second independent
observation. A pet-name binds this stable source entity, never an image filename
or a CAD face. The entity offers bounded cues; CAD and survey authority remain
separate. Image file bytes and matching alpha channels are checked on load.
"""
from __future__ import annotations

from hashlib import sha256
from pathlib import Path
import json
import re

import cv2
import numpy as np
from PIL import Image

from .provenance_encoding import canonical_json_sha256

SCHEMA = "projection-loom/source-seed-entity"


class SeedEntity:
    def __init__(self, manifest_path, data, rgba, alpha):
        self.manifest_path = Path(manifest_path)
        self.slot = data["slot"]
        self.pet_name = data["pet_name"]
        self.location = data["location"]
        self.reference_view = data["reference_view"]
        self.witnesses = data["witnesses"]
        self.provenance = data["provenance"]
        self.rgba = rgba
        self.alpha = alpha
        self.sha256 = canonical_json_sha256(data)

    @classmethod
    def load(cls, path, *, location=None, reference=None, reference_view=None):
        path = Path(path).resolve()
        data = json.loads(path.read_text(encoding="utf-8"))
        if set(data) != {"schema", "slot", "pet_name", "location", "reference_view",
                         "provenance", "witnesses"} or data["schema"] != SCHEMA:
            raise ValueError("Seed entity requires one recognized source contract")
        if (not isinstance(data["slot"], str)
                or not re.fullmatch(r"[a-z][a-z0-9-]*", data["slot"])
                or not isinstance(data["pet_name"], str)
                or not data["pet_name"].strip()):
            raise ValueError("Seed needs a stable slot and an explicit pet-name")
        if data["provenance"] != "provisional-artwork":
            raise ValueError("Seed cannot claim source registration or survey authority")
        if (location is not None and data["location"] != location or
                reference_view is not None and data["reference_view"] != reference_view):
            raise ValueError("Seed location or camera disagrees with the project")
        if set(data["witnesses"]) != {"appearance", "silhouette"}:
            raise ValueError("Seed needs both RGBA appearance and L8 silhouette channels")
        loaded = {}
        files = {}
        for name, mode in (("appearance", "RGBA"), ("silhouette", "L")):
            entry = data["witnesses"][name]
            if set(entry) != {"path", "sha256", "mode"} or entry["mode"] != mode:
                raise ValueError("Seed channel has an invalid typed image contract")
            relative = Path(entry["path"])
            if relative.is_absolute() or ".." in relative.parts:
                raise ValueError("Seed paths must remain inside their source directory")
            resolved = (path.parent / relative).resolve()
            if not resolved.is_relative_to(path.parent) or not resolved.is_file():
                raise ValueError("Seed source cannot escape its evidence directory")
            raw = resolved.read_bytes()
            if sha256(raw).hexdigest() != entry["sha256"]:
                raise ValueError("Seed witness digest mismatch")
            with Image.open(resolved) as image:
                if image.mode != mode:
                    raise ValueError("Seed image mode differs from its declared channel")
                loaded[name] = np.asarray(image.copy())
            files[name] = resolved
        if loaded["appearance"].ndim != 3 or loaded["appearance"].shape[2] != 4:
            raise ValueError("Seed appearance requires actual RGBA pixels")
        if loaded["silhouette"].shape != loaded["appearance"].shape[:2]:
            raise ValueError("Seed alpha and RGBA dimensions disagree")
        if not np.array_equal(loaded["appearance"][:, :, 3], loaded["silhouette"]):
            raise ValueError("Seed alpha disagrees with the RGBA transparency channel")
        if reference is not None and files["silhouette"] != Path(reference).resolve():
            raise ValueError("The calibrated reference must be the named seed alpha channel")
        return cls(path, data, loaded["appearance"], loaded["silhouette"])

    def source_digests(self):
        return {"seed:entity": self.sha256,
                "seed:appearance": self.witnesses["appearance"]["sha256"],
                "seed:silhouette": self.witnesses["silhouette"]["sha256"]}

    def mask(self, size):
        return cv2.resize(self.alpha, tuple(size), interpolation=cv2.INTER_AREA) > 96

    def appearance_edges(self, size):
        """Internal RGB cues constrained to the same alpha; not independent truth."""
        w, h = size
        resized = cv2.resize(self.rgba, (w, h), interpolation=cv2.INTER_AREA)
        gray = cv2.cvtColor(resized[:, :, :3], cv2.COLOR_RGB2GRAY)
        edges = cv2.Canny(gray, 45, 105) > 0
        return edges & self.mask(size)

    def cue(self, size):
        mask = self.mask(size)
        edges = self.appearance_edges(size)
        record = {"schema": "projection-loom/seed-cue",
                  "seed_entity_sha256": self.sha256,
                  "pet_name": self.pet_name,
                  "slot": self.slot, "size": list(size),
                  "mask_sha256": sha256(mask.astype(np.uint8).tobytes()).hexdigest(),
                  "appearance_edges_sha256": sha256(
                      edges.astype(np.uint8).tobytes()).hexdigest(),
                  "silhouette_pixels": int(mask.sum()),
                  "appearance_edge_pixels": int(edges.sum()),
                  "authority": "two channels of one provisional artwork"}
        return record

    def witness_has(self):
        return ("#has/source-seed", "#has/source-appearance",
                "#has/source-silhouette", "#has/provisional-artwork")
