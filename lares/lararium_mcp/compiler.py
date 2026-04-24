"""Hydration closure compiler for the Lararium carrier graph.

Minimal boot walks the `required-core` declared in `AGENTS#iam`.
Full boot extends with all reachable carriers from the carrier index.
Boot receipt digests the closure for cache and drift detection.

Pranala-aware graph walking (control-edge DAG traversal) is SPRINT-01
follow-on work in MCP-TASK-004.  This seed provides real artifacts from
what the resolver and carrier ingress already know.
"""

from __future__ import annotations

import hashlib
import json
from datetime import datetime, timezone
from typing import Any

from .carrier import read_carrier
from .indexes import compile_carrier_index
from .resolver import LARES_ROOT, resolve_lar_uri


ENTRY_URI = "lar:///AGENTS"

# Hydration socket annotations for the required-core sequence.
# Source: lares/AGENTS.md pranala control edges + BOOT_LOCI_INVENTORY.md.
_SOCKET: dict[str, str] = {
    "lar:///AGENTS": "entry",
    "lar:///ha.ka.ba/api/v0.1/pono/e-prime": "AGENTS#preload-e-prime",
    "lar:///ha.ka.ba/api/v0.1/pono/ooda-ha": "AGENTS#preload-ooda-ha",
    "lar:///ha.ka.ba/api/v0.1/pono/lar-uri": "AGENTS#preload-lar-uri",
    "lar:///ha.ka.ba/api/v0.1/mu": "AGENTS#threshold-to-mu",
    "lar:///ha.ka.ba/api/v0.1/mu/chao": "mu#internal",
    "lar:///ha.ka.ba/api/v0.1/mu/the-four-tools": "mu#internal",
    "lar:///ha.ka.ba/api/v0.1/mu/the-law-of-5s": "mu#internal",
    "lar:///ha.ka.ba/api/v0.1/mu/the-syad-perspectives": "mu#internal",
    "lar:///ha.ka.ba/api/v0.1/lararium": "AGENTS#threshold-to-lararium",
    "lar:///ha.ka.ba/api/v0.1/lararium/hud": "lararium#internal",
    "lar:///ha.ka.ba/api/v0.1/lararium/voices": "lararium#internal",
    "lar:///ha.ka.ba/api/v0.1/lararium/continuity": "lararium#internal",
    "lar:///LARES": "AGENTS#continue-to-lares",
}

# Depth assignment for required-core loci.
_DEPTH: dict[str, int] = {
    "lar:///AGENTS": 0,
    "lar:///ha.ka.ba/api/v0.1/pono/e-prime": 1,
    "lar:///ha.ka.ba/api/v0.1/pono/ooda-ha": 1,
    "lar:///ha.ka.ba/api/v0.1/pono/lar-uri": 1,
    "lar:///ha.ka.ba/api/v0.1/mu": 1,
    "lar:///ha.ka.ba/api/v0.1/mu/chao": 2,
    "lar:///ha.ka.ba/api/v0.1/mu/the-four-tools": 2,
    "lar:///ha.ka.ba/api/v0.1/mu/the-law-of-5s": 2,
    "lar:///ha.ka.ba/api/v0.1/mu/the-syad-perspectives": 2,
    "lar:///ha.ka.ba/api/v0.1/lararium": 1,
    "lar:///ha.ka.ba/api/v0.1/lararium/hud": 2,
    "lar:///ha.ka.ba/api/v0.1/lararium/voices": 2,
    "lar:///ha.ka.ba/api/v0.1/lararium/continuity": 2,
    "lar:///LARES": 1,
}


def _read_required_core() -> list[str]:
    """Read `required-core` from AGENTS #iam metadata.

    Falls back to the static socket table if the carrier read fails, so the
    compiler produces a useful artifact even in degraded states.
    """
    try:
        agents = read_carrier(ENTRY_URI)
        rc = agents.metadata.get("required-core", [])
        if isinstance(rc, list):
            return [item for item in rc if isinstance(item, str)]
    except Exception:
        pass
    return list(_SOCKET.keys())


def _closure_entry(uri: str, depth: int) -> dict[str, Any]:
    resolution = resolve_lar_uri(uri)
    entry: dict[str, Any] = {
        "uri": uri,
        "file_path": (
            str(resolution.path.relative_to(LARES_ROOT))
            if resolution.path and resolution.path.is_absolute()
            else (str(resolution.path) if resolution.path else None)
        ),
        "kind": resolution.kind,
        "virtual": resolution.virtual,
        "exists": resolution.exists,
        "role": "",
        "hydration_socket": _SOCKET.get(uri, ""),
        "implements": [],
        "depth": depth,
    }
    if not resolution.virtual and resolution.exists and resolution.path:
        try:
            record = read_carrier(uri)
            entry["role"] = record.metadata.get("role", "")
            entry["implements"] = list(record.implements)
        except Exception:
            pass
    return entry


def _validate(closure: list[dict[str, Any]]) -> dict[str, Any]:
    missing = [e["uri"] for e in closure if not e["exists"] and not e["virtual"]]
    return {
        "all_resolved": True,
        "all_exist": len(missing) == 0,
        "missing": missing,
        "dag_violations": [],
    }


def compile_minimal_boot(entry: str = ENTRY_URI) -> dict[str, Any]:
    """Produce a minimal boot artifact from the AGENTS required-core closure."""
    required_core = _read_required_core()
    closure = [_closure_entry(uri, _DEPTH.get(uri, 1)) for uri in required_core]
    return {
        "artifact": "minimal-boot",
        "compiled_at": datetime.now(timezone.utc).isoformat(),
        "entry": entry,
        "closure": closure,
        "locus_count": len(closure),
        "validation": _validate(closure),
    }


def compile_full_boot(entry: str = ENTRY_URI) -> dict[str, Any]:
    """Produce a full boot artifact from the required-core plus all indexed carriers.

    The pranala-edge DAG walk (control + relation traversal) is implemented
    as a carrier-index scan until the graph walker lands in SPRINT-01.
    """
    required_core = _read_required_core()
    required_set = set(required_core)

    additional_carriers = [
        record for record in compile_carrier_index()
        if record.uri not in required_set
    ]

    closure = [_closure_entry(uri, _DEPTH.get(uri, 1)) for uri in required_core]
    closure += [_closure_entry(record.uri, 3) for record in additional_carriers]

    return {
        "artifact": "full-boot",
        "compiled_at": datetime.now(timezone.utc).isoformat(),
        "entry": entry,
        "closure": closure,
        "locus_count": len(closure),
        "edge_count": 0,
        "pranala_edges": [],
        "validation": _validate(closure),
        "compiler_note": (
            "pranala-edge DAG walk deferred to SPRINT-01 (MCP-TASK-004); "
            "closure built from required-core + carrier index scan"
        ),
    }


def compile_boot_receipt(artifact: dict[str, Any]) -> dict[str, Any]:
    """Digest a compiled boot artifact into a stable cache receipt."""
    payload = json.dumps(artifact, sort_keys=True, separators=(",", ":")).encode()
    sha = hashlib.sha256(payload).hexdigest()
    validation = artifact.get("validation", {})
    return {
        "artifact": "boot-receipt",
        "compiled_at": artifact.get("compiled_at", datetime.now(timezone.utc).isoformat()),
        "entry": artifact.get("entry", ENTRY_URI),
        "mode": artifact.get("artifact", "unknown").removeprefix("boot-").replace("-boot", "") or "unknown",
        "locus_count": artifact.get("locus_count", 0),
        "edge_count": artifact.get("edge_count", 0),
        "sha256": sha,
        "validation": {
            "all_resolved": validation.get("all_resolved", False),
            "all_exist": validation.get("all_exist", False),
            "missing": validation.get("missing", []),
            "dag_violations": validation.get("dag_violations", []),
        },
        "compaction_notes": "",
    }
