#!/usr/bin/env python3
"""form_store — the FORM plane's store: one owned Form root, a caller-supplied dense vector per key.

Meme: lar:///ha.ka.ba/lararium/api/living-grammar-palace#two-planes. The plane caps (plane_fanout's
FormPlaneCap, the dream pass, the channel dial, the projector, plane_query) store and read the FORM
plane through this class; each caller computes its own sparse {indices, values} vector and this store
densifies it to the collection's fixed length. Never the embedding model: the vector rides in whole.
"""
from __future__ import annotations

import json

from holder_caps import mine_busy_retry


# The cross-graph join: the form entry is KEYED by the verbatim_sha (the content
# drawer's join key), so form-drawer.id == content-drawer.lar_verbatim_sha and the
# two graphs fuse on one key (living-grammar-palace#two-planes — the FORM side here,
# the CONTENT side stays the existing verbatim mempalace).
#
# Caller-vector pattern (the BASE multi-collection move): we open a SEPARATE "form"
# collection (a second collection beside the palace default), ALWAYS supply our own
# dense form-vector as the embedding, and skip the embedder-identity check — so the
# palace's configured embedding model is left attached but NEVER invoked (no model
# load, no download, no network), exactly as structurepalace_io does for the AST store.
#
# DIMENSION: ChromaDB pins a collection's vector length at the first insert. The
# form-vector is SPARSE {indices, values} of logical length == basis.dimension; we
# DENSIFY it to a fixed dense vector of that dimension (an O(D) scatter — negligible
# for D in the tens-to-low-hundreds the constructicon basis carries). A later store
# whose basis.dimension differs (the grammar grew new sigil/family axes) collides
# with the pinned length → ChromaDB raises and we surface it as a basis-drift flag
# (re-pin/migration is deferred to the P5 collapse).
PROVENANCE_CAP = 64
FORM_COLLECTION = "form"


def _densify(form_vector: dict, dimension: int) -> list[float]:
    """Scatter a sparse {indices, values} form-vector into a fixed dense vector of
    length ``dimension`` — the shape ChromaDB stores (one fixed length per collection)."""
    dense = [0.0] * dimension
    indices = form_vector.get("indices") or []
    values = form_vector.get("values") or []
    for i, v in zip(indices, values):
        if isinstance(i, int) and 0 <= i < dimension:
            dense[i] = float(v)
    return dense


def _unreliable_witness_timestamp() -> str:
    """A host-wall-clock reading — an UNRELIABLE WITNESS under no-global-now: island clocks skew, so
    this value NEVER compares across islands and NEVER orders anything. Provenance only; the logical/FFZ
    clock is the ordering authority once it lands py-side. Named to strip the false-clock authority.
    Routes through deep_time — the ONE island-local-wall-time provenance home."""
    from deep_time import island_local_now

    return island_local_now()


class FormPalaceStore:
    """One owned Form root, using its default collection; store, query and get."""

    def __init__(self, palace_path: str) -> None:
        from mempalace.palace import get_collection

        # The Form path already separates this plane from Content. The pinned
        # MemPalace wrapper rejects an ad-hoc collection_name="form"; use its
        # configured default collection within the owned Form root instead.
        self._col = get_collection(palace_path, create=True, _skip_identity_check=True)

    def _get_raw(self, key: str) -> dict | None:
        got = self._col.get(ids=[key], include=["documents", "metadatas"])
        ids = got.get("ids") or []
        if not ids:
            return None
        docs = got.get("documents") or [None]
        metas = got.get("metadatas") or [None]
        return {"id": ids[0], "document": docs[0], "metadata": metas[0] or {}}

    def store(self, key: str, form_vector: dict, dimension: int, metadata: dict) -> dict:
        """Upsert one form-vector keyed by ``key`` (the verbatim_sha). Recurrence on the
        same key (a re-mined turn) bumps ``count`` and refreshes ``last_sighting``."""
        if not key:
            raise ValueError("form store requires a non-empty key (the verbatim_sha)")
        dense = _densify(form_vector, dimension)
        sighting = _unreliable_witness_timestamp()  # a PURE unreliable-witness sighting — provenance only
        # Flat, chroma-legal metadata (str/int/float/bool only — never None).
        meta: dict[str, object] = {
            "kind": "form",
            "lar_verbatim_sha": str(metadata.get("verbatim_sha", key)),
            "register": str(metadata.get("register", "")),
            "grammar_layer": str(metadata.get("grammar_layer", "")),
            "struct_hash": str(metadata.get("struct_hash", "")),
            "conformance": float(metadata.get("conformance", 0.0)),
            "dimension": int(dimension),
        }
        existing = self._get_raw(key)
        count = 1
        if existing is not None:
            try:
                count = int(existing["metadata"].get("count", 1)) + 1
            except (ValueError, TypeError):
                count = 1
            meta["first_sighting"] = existing["metadata"].get("first_sighting", sighting)
        else:
            meta["first_sighting"] = sighting
        meta["count"] = count
        meta["last_sighting"] = sighting
        document = json.dumps(
            {
                # The TRUE dense basis — the sparse {indices, values} the caller computed.
                # Persisting it hands the node reader (parse-form-vector, which PREFERS
                # form_vector when present) the real basis, rather than forcing it to
                # reconstruct indices from the ID-keyed axis_activation profile alone.
                "form_vector": form_vector,
                "axis_activation": metadata.get("axis_activation", {}),
                "turn_conformance": meta["conformance"],
            }
        )
        try:
            mine_busy_retry(lambda: self._col.upsert(
                ids=[key], documents=[document], metadatas=[meta], embeddings=[dense]
            ))
        except Exception as exc:  # noqa: BLE001 — surface dimension drift precisely
            raise ValueError(
                f"form store upsert failed (dimension={dimension}; a basis-dimension "
                f"drift re-pins the collection — see P5): {type(exc).__name__}: {exc}"
            ) from exc
        return {"key": key, "dimension": dimension, "count": count, "conformance": meta["conformance"]}

    def query(self, form_vector: dict, dimension: int, n_results: int, where: dict | None) -> dict:
        """Nearest form-vectors by similarity, optionally narrowed by a metadata where-filter."""
        dense = _densify(form_vector, dimension)
        res = self._col.query(
            query_embeddings=[dense],
            n_results=n_results,
            where=where,
            include=["metadatas", "distances"],
        )
        ids = (getattr(res, "ids", None) or [[]])[0]
        metas = (getattr(res, "metadatas", None) or [[]])[0]
        dists = (getattr(res, "distances", None) or [[]])[0]
        matches = [
            {"key": ids[i], "distance": dists[i] if i < len(dists) else None,
             "metadata": metas[i] if i < len(metas) else {}}
            for i in range(len(ids))
        ]
        return {"matches": matches}

    def filter(self, where: dict | None, n_results: int) -> dict:
        """METADATA-ONLY filter (NO vector) — chroma `.get(where=…)`: match by metadata alone.
        `distance` is null (a where-match carries no similarity ranking). A null/empty where returns up to
        n_results of the collection; a where matching nothing returns []."""
        kwargs = {"limit": n_results, "include": ["metadatas"]}
        if where:
            kwargs["where"] = where
        got = self._col.get(**kwargs)
        ids = got.get("ids") or []
        metas = got.get("metadatas") or []
        matches = [
            {"key": ids[i], "distance": None,
             "metadata": metas[i] if i < len(metas) else {}}
            for i in range(len(ids))
        ]
        return {"matches": matches}

    def get(self, key: str) -> dict | None:
        raw = self._get_raw(key)
        if raw is None:
            return None
        return {"key": raw["id"], "metadata": raw["metadata"], "document": raw["document"]}
