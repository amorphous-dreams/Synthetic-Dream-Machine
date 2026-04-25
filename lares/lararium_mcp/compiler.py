"""Hydration closure compiler for the Lararium carrier graph.

Tier 0 (minimal boot): BFS over control/owns edges from AGENTS entry.
  Loads each discovered meme, parses its pranala edges, follows control edges.
  Result: topologically sorted closure of the core hydration spine.

Tier 1 (full boot): adds Kahn topological sort + one-hop relation expansion.

Boot receipt: SHA256 digest of the compiled closure for cache/drift detection.
"""

from __future__ import annotations

import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from .carrier import read_carrier, validate_carrier_shape
from .indexes import compile_carrier_index
from .meme_graph import DeclaredUnresolved, Meme, MemeGraph
from .pranala_parser import PranaEdge, parse_pranala_edges
from .resolver import LARES_ROOT, resolve_lar_uri


ENTRY_URI = "lar:///AGENTS"


# ---------------------------------------------------------------------------
# Meme loader
# ---------------------------------------------------------------------------

def _load_meme(uri: str) -> Meme | None:
    """Read a carrier file and return a Meme, or None if it cannot be loaded."""
    try:
        resolution = resolve_lar_uri(uri)
    except Exception:
        return None

    if resolution.virtual:
        return Meme(
            uri=uri,
            path=None,
            content_hash=Meme.make_hash(uri, None),
            metadata={},
            virtual=True,
            exists=False,
        )

    if resolution.path is None or not resolution.path.exists():
        return Meme(
            uri=uri,
            path=resolution.path,
            content_hash=Meme.make_hash(uri, None),
            metadata={},
            virtual=False,
            exists=False,
        )

    try:
        file_bytes = resolution.path.read_bytes()
        text = file_bytes.decode('utf-8')
        record = read_carrier(uri)
        edges_out = parse_pranala_edges(uri, text)
        return Meme(
            uri=uri,
            path=resolution.path,
            content_hash=Meme.make_hash(uri, file_bytes),
            metadata=record.metadata,
            edges_out=edges_out,
            virtual=False,
            exists=True,
            shape=record.shape,
        )
    except Exception:
        return None


# ---------------------------------------------------------------------------
# Graph builder
# ---------------------------------------------------------------------------

def _build_control_closure(entry_uri: str) -> tuple[MemeGraph, list[str], list[list[str]]]:
    """BFS over control edges from entry_uri; load each discovered meme.

    Returns (graph, topo_uris, dag_violations).
    topo_uris is in sources-before-targets (hydration) order.
    """
    graph = MemeGraph()
    queue = [entry_uri]
    visited: set[str] = set()
    depth_map: dict[str, int] = {entry_uri: 0}

    while queue:
        uri = queue.pop(0)
        if uri in visited:
            continue
        visited.add(uri)

        if uri not in graph.memes:
            meme = _load_meme(uri)
            if meme is not None:
                graph.add_meme(meme)

        current_depth = depth_map.get(uri, 0)
        for edge in graph.edges_out(uri, 'control'):
            if edge.role == 'implements':
                continue
            target = edge.to_uri
            if target not in visited:
                queue.append(target)
                depth_map[target] = max(depth_map.get(target, 0), current_depth + 1)

    topo_uris, violations = graph.walk_control(entry_uri, ignore_roles={'implements'})
    return graph, topo_uris, violations


def _build_full_closure(
    graph: MemeGraph,
    topo_uris: list[str],
) -> tuple[list[str], list[str]]:
    """Tier 2: one-hop relation expansion from the control-reachable set.

    Returns (additional_uris, all_uris).
    """
    additional = graph.one_hop_relation(topo_uris)
    for uri in additional:
        if uri not in graph.memes:
            meme = _load_meme(uri)
            if meme is not None:
                graph.add_meme(meme)

    # Also sweep the carrier index for any remaining reachable memes
    index_uris = {r.uri for r in compile_carrier_index()}
    topo_set = set(topo_uris) | additional
    index_additional = index_uris - topo_set
    for uri in sorted(index_additional):
        if uri not in graph.memes:
            meme = _load_meme(uri)
            if meme is not None:
                graph.add_meme(meme)

    additional_uris = sorted(additional | index_additional)
    return additional_uris, topo_uris + additional_uris


# ---------------------------------------------------------------------------
# Closure entry builder
# ---------------------------------------------------------------------------

def _closure_entry(
    graph: MemeGraph,
    uri: str,
    depth: int,
    hydration_socket: str = '',
) -> dict[str, Any]:
    meme = graph.memes.get(uri)
    if meme is None:
        resolution = resolve_lar_uri(uri)
        return {
            'uri': uri,
            'file_path': str(resolution.path) if resolution.path else None,
            'kind': resolution.kind,
            'virtual': resolution.virtual,
            'exists': resolution.exists,
            'role': '',
            'hydration_socket': hydration_socket,
            'implements': [],
            'content_hash': '',
            'depth': depth,
        }

    file_path = None
    if meme.path:
        try:
            file_path = str(meme.path.relative_to(LARES_ROOT))
        except ValueError:
            file_path = str(meme.path)

    resolution = resolve_lar_uri(uri)
    return {
        'uri': uri,
        'file_path': file_path,
        'kind': resolution.kind,
        'virtual': meme.virtual,
        'exists': meme.exists,
        'role': meme.metadata.get('role', ''),
        'hydration_socket': hydration_socket,
        'implements': list(meme.implements),
        'content_hash': meme.content_hash,
        'depth': depth,
    }


# ---------------------------------------------------------------------------
# Socket annotation — derived from the edge that points to each meme
# ---------------------------------------------------------------------------

def _build_socket_map(graph: MemeGraph, topo_uris: list[str]) -> dict[str, str]:
    """Map each URI to the from_socket of the control edge that first reaches it."""
    socket_map: dict[str, str] = {topo_uris[0]: 'entry'} if topo_uris else {}
    for uri in topo_uris:
        for edge in graph.edges_out(uri, 'control'):
            if edge.to_uri not in socket_map:
                socket_map[edge.to_uri] = edge.from_socket
    return socket_map


# ---------------------------------------------------------------------------
# Validation
# ---------------------------------------------------------------------------

def _validate(
    closure: list[dict[str, Any]],
    violations: list[list[str]],
    declared_unresolved: list[DeclaredUnresolved] | None = None,
) -> dict[str, Any]:
    missing = [e['uri'] for e in closure if not e['exists'] and not e['virtual']]
    return {
        'all_resolved': True,
        'all_exist': len(missing) == 0,
        'missing': missing,
        'dag_violations': violations,
        'declared_unresolved': [
            {'uri': du.uri, 'severity': du.severity, 'family': du.edge.family}
            for du in (declared_unresolved or [])
            if du.severity in ('error', 'warning')
        ],
    }


# ---------------------------------------------------------------------------
# Public compile functions
# ---------------------------------------------------------------------------

def compile_minimal_boot(entry: str = ENTRY_URI) -> dict[str, Any]:
    """Tier 0+1: BFS over control edges from entry; topologically sorted closure."""
    graph, topo_uris, violations = _build_control_closure(entry)
    socket_map = _build_socket_map(graph, topo_uris)
    depth_map: dict[str, int] = {}
    # Reconstruct depths from topological order
    if topo_uris:
        depth_map[topo_uris[0]] = 0
    for uri in topo_uris:
        depth = depth_map.get(uri, 0)
        for target in graph.successors(uri, 'control'):
            depth_map[target] = max(depth_map.get(target, 0), depth + 1)

    closure = [
        _closure_entry(graph, uri, depth_map.get(uri, 0), socket_map.get(uri, ''))
        for uri in topo_uris
    ]
    declared_unresolved = graph.declared_unresolved()

    return {
        'artifact': 'minimal-boot',
        'compiled_at': datetime.now(timezone.utc).isoformat(),
        'entry': entry,
        'closure': closure,
        'meme_count': len(closure),
        'locus_count': len(closure),
        'validation': _validate(closure, violations, declared_unresolved),
    }


def compile_full_boot(entry: str = ENTRY_URI) -> dict[str, Any]:
    """Tier 0+1+2: control closure extended with one-hop relation + carrier index."""
    graph, topo_uris, violations = _build_control_closure(entry)
    additional_uris, all_uris = _build_full_closure(graph, topo_uris)
    socket_map = _build_socket_map(graph, topo_uris)
    topo_set = set(topo_uris)

    depth_map: dict[str, int] = {}
    if topo_uris:
        depth_map[topo_uris[0]] = 0
    for uri in topo_uris:
        depth = depth_map.get(uri, 0)
        for target in graph.successors(uri, 'control'):
            depth_map[target] = max(depth_map.get(target, 0), depth + 1)

    closure = [
        _closure_entry(graph, uri, depth_map.get(uri, 0), socket_map.get(uri, ''))
        for uri in topo_uris
    ]
    closure += [
        _closure_entry(graph, uri, depth_map.get(uri, 3), socket_map.get(uri, ''))
        for uri in additional_uris
        if uri not in topo_set
    ]

    # Collect all parsed edges for the full artifact
    all_edges: list[PranaEdge] = []
    for meme in graph.memes.values():
        all_edges.extend(meme.edges_out)

    declared_unresolved = graph.declared_unresolved()

    return {
        'artifact': 'full-boot',
        'compiled_at': datetime.now(timezone.utc).isoformat(),
        'entry': entry,
        'closure': closure,
        'meme_count': len(closure),
        'locus_count': len(closure),
        'edge_count': len(all_edges),
        'pranala_edges': [
            {
                'from_uri': e.from_uri,
                'from_socket': e.from_socket,
                'to_uri': e.to_uri,
                'family': e.family,
                'role': e.role,
            }
            for e in all_edges
        ],
        'validation': _validate(closure, violations, declared_unresolved),
    }


def compile_boot_receipt(artifact: dict[str, Any]) -> dict[str, Any]:
    """Digest a compiled boot artifact into a stable cache receipt."""
    payload = json.dumps(artifact, sort_keys=True, separators=(',', ':')).encode()
    sha = hashlib.sha256(payload).hexdigest()
    validation = artifact.get('validation', {})
    return {
        'artifact': 'boot-receipt',
        'compiled_at': artifact.get('compiled_at', datetime.now(timezone.utc).isoformat()),
        'entry': artifact.get('entry', ENTRY_URI),
        'mode': (
            artifact.get('artifact', 'unknown')
            .removeprefix('boot-')
            .replace('-boot', '') or 'unknown'
        ),
        'meme_count': artifact.get('meme_count', 0),
        'locus_count': artifact.get('locus_count', artifact.get('meme_count', 0)),
        'edge_count': artifact.get('edge_count', 0),
        'sha256': sha,
        'validation': {
            'all_resolved': validation.get('all_resolved', False),
            'all_exist': validation.get('all_exist', False),
            'missing': validation.get('missing', []),
            'dag_violations': validation.get('dag_violations', []),
        },
        'compaction_notes': '',
    }
