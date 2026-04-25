"""MemeGraph — adjacency structure over reachable memes in the carrier DAG.

Provides:
  Meme              — one resolved carrier node
  DeclaredUnresolved — a pranala edge whose target cannot be located on disk
  MemeGraph          — mutable adjacency structure; walk, sort, hash

All graph operations (topological_sort, detect_cycles, etc.) operate on the
memes already loaded into the graph.  I/O — reading carrier files and parsing
edges — belongs to the compiler; MemeGraph is a pure in-memory structure.
"""

from __future__ import annotations

import hashlib
import json
from collections import defaultdict, deque
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from .pranala_parser import PranaEdge


# ---------------------------------------------------------------------------
# Meme
# ---------------------------------------------------------------------------

@dataclass
class Meme:
    uri: str
    path: Path | None
    content_hash: str
    metadata: dict[str, Any]
    edges_out: list[PranaEdge] = field(default_factory=list)
    virtual: bool = False
    exists: bool = False
    shape: Any = None  # CarrierShape when available; Any to avoid circular import

    @property
    def implements(self) -> tuple[str, ...]:
        """URIs of interfaces this meme declares via control/implements edges."""
        return tuple(
            e.to_uri for e in self.edges_out
            if e.role == 'implements' and e.family == 'control'
        )

    @classmethod
    def make_hash(cls, uri: str, file_bytes: bytes | None) -> str:
        payload = uri + ':' + (file_bytes.decode('utf-8', errors='replace') if file_bytes else 'virtual')
        return 'sha256:' + hashlib.sha256(payload.encode('utf-8')).hexdigest()


# ---------------------------------------------------------------------------
# DeclaredUnresolved
# ---------------------------------------------------------------------------

@dataclass
class DeclaredUnresolved:
    uri: str
    edge: PranaEdge
    severity: str  # "error" | "warning" | "info"

    @classmethod
    def from_edge(cls, edge: PranaEdge) -> 'DeclaredUnresolved':
        # Two-phase load pattern (Bazel/Flecs): interface attachment edges
        # (control/implements) point to abstract interface URIs that are
        # intentionally outside the boot walk spine.  They are not missing
        # boot dependencies — they are Phase 1 interface references that
        # resolve during interface_index construction.  Mark as "info".
        # Hard "error" reserves for structural edges (owns, composes) whose
        # targets must exist for the walk to be valid.
        if edge.family == 'control':
            if edge.role == 'implements':
                severity = 'info'
            else:
                severity = 'error'
        elif edge.family == 'relation':
            severity = 'warning'
        else:
            severity = 'info'
        return cls(uri=edge.to_uri, edge=edge, severity=severity)


# ---------------------------------------------------------------------------
# MemeGraph
# ---------------------------------------------------------------------------

class MemeGraph:
    """Mutable adjacency structure over carrier memes.

    Internal layout:
        memes:     uri → Meme
        adjacency: family → from_uri → [PranaEdge, ...]
    """

    def __init__(self) -> None:
        self.memes: dict[str, Meme] = {}
        # adjacency[family][from_uri] = [PranaEdge, ...]
        self.adjacency: dict[str, dict[str, list[PranaEdge]]] = defaultdict(lambda: defaultdict(list))

    # ------------------------------------------------------------------
    # Mutation
    # ------------------------------------------------------------------

    def add_meme(self, meme: Meme) -> None:
        """Insert a meme and index its outbound edges into the adjacency map."""
        self.memes[meme.uri] = meme
        for edge in meme.edges_out:
            self.adjacency[edge.family][edge.from_uri].append(edge)

    # ------------------------------------------------------------------
    # Query
    # ------------------------------------------------------------------

    def successors(self, uri: str, family: str) -> list[str]:
        """Outbound target URIs for a given meme and edge family."""
        return [e.to_uri for e in self.adjacency.get(family, {}).get(uri, [])]

    def edges_out(self, uri: str, family: str | None = None) -> list[PranaEdge]:
        """All outbound PranaEdge records from uri, optionally filtered by family."""
        meme = self.memes.get(uri)
        if meme is None:
            return []
        if family is None:
            return list(meme.edges_out)
        return [e for e in meme.edges_out if e.family == family]

    def one_hop_relation(self, control_uris: list[str] | set[str]) -> set[str]:
        """Relation-edge neighbours of control-reachable memes, excluding already-reachable."""
        seen = set(control_uris)
        additional: set[str] = set()
        for uri in control_uris:
            for target in self.successors(uri, 'relation'):
                if target not in seen:
                    additional.add(target)
                    seen.add(target)
        return additional

    # ------------------------------------------------------------------
    # Cycle detection
    # ------------------------------------------------------------------

    def detect_cycles(self, families: list[str] | None = None) -> list[list[str]]:
        """DFS gray/black cycle detection over given families (default: all loaded)."""
        if families is None:
            families = list(self.adjacency.keys())

        WHITE, GRAY, BLACK = 0, 1, 2
        color: dict[str, int] = defaultdict(int)
        violations: list[list[str]] = []
        stack_path: list[str] = []

        def visit(uri: str, family: str) -> None:
            if color[uri] == GRAY:
                cycle_start = stack_path.index(uri)
                violations.append(stack_path[cycle_start:] + [uri])
                return
            if color[uri] == BLACK:
                return
            color[uri] = GRAY
            stack_path.append(uri)
            for target in self.successors(uri, family):
                visit(target, family)
            stack_path.pop()
            color[uri] = BLACK

        for family in families:
            # Skip mutual-pair check for relation family (permitted by pranala law)
            color.clear()
            for uri in list(self.adjacency.get(family, {}).keys()):
                if color[uri] == WHITE:
                    visit(uri, family)

        return violations

    # ------------------------------------------------------------------
    # Topological sort (Kahn's algorithm)
    # ------------------------------------------------------------------

    def topological_sort(
        self,
        uri_set: set[str] | list[str],
        family: str = 'control',
    ) -> list[str]:
        """Kahn's BFS topological sort restricted to uri_set over family edges.

        Returns URIs in sources-before-targets order.
        """
        nodes = set(uri_set)
        in_degree: dict[str, int] = {u: 0 for u in nodes}
        successors_map: dict[str, list[str]] = {u: [] for u in nodes}

        for uri in nodes:
            for target in self.successors(uri, family):
                if target in nodes:
                    in_degree[target] += 1
                    successors_map[uri].append(target)

        queue: deque[str] = deque(u for u in nodes if in_degree[u] == 0)
        result: list[str] = []
        while queue:
            uri = queue.popleft()
            result.append(uri)
            for target in successors_map[uri]:
                in_degree[target] -= 1
                if in_degree[target] == 0:
                    queue.append(target)

        # Any remaining nodes (cycle residue) appended in stable order
        remaining = [u for u in nodes if u not in set(result)]
        result.extend(sorted(remaining))
        return result

    # ------------------------------------------------------------------
    # Closure hash
    # ------------------------------------------------------------------

    def closure_hash(self, uri_list: list[str], edge_list: list[PranaEdge]) -> str:
        """SHA256 of sorted meme hashes + serialised edge records."""
        meme_hashes = sorted(
            self.memes[u].content_hash for u in uri_list if u in self.memes
        )
        edge_records = sorted(
            (e.from_socket, e.to_uri, e.family, e.role or '')
            for e in edge_list
        )
        payload = json.dumps({'memes': meme_hashes, 'edges': edge_records},
                             sort_keys=True, separators=(',', ':'))
        return 'sha256:' + hashlib.sha256(payload.encode('utf-8')).hexdigest()

    # ------------------------------------------------------------------
    # Declared-unresolved scan
    # ------------------------------------------------------------------

    def declared_unresolved(self) -> list[DeclaredUnresolved]:
        """Edges pointing to URIs not loaded in this graph.

        Deduplicates by target URI, keeping the highest severity seen.
        Severity order: error > warning > info.
        """
        _rank = {'error': 2, 'warning': 1, 'info': 0}
        best: dict[str, DeclaredUnresolved] = {}
        for meme in self.memes.values():
            for edge in meme.edges_out:
                if edge.to_uri not in self.memes:
                    du = DeclaredUnresolved.from_edge(edge)
                    existing = best.get(du.uri)
                    if existing is None or _rank[du.severity] > _rank[existing.severity]:
                        best[du.uri] = du
        return sorted(best.values(), key=lambda d: (-_rank[d.severity], d.uri))
