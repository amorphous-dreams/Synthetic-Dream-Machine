"""MemeGraph — adjacency structure over reachable memes in the carrier DAG.

Provides:
  Meme              — one resolved carrier node
  DeclaredUnresolved — a pranala edge whose target cannot be located on disk
  MemeGraph          — mutable adjacency structure; walk, sort, hash

All graph operations (walk_control, topological_sort, etc.) operate on the
memes already loaded into the graph.  I/O — reading carrier files and parsing
edges — belongs to the compiler; MemeGraph is a pure in-memory structure.
"""

from __future__ import annotations

import hashlib
import json
from collections import defaultdict, deque
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Callable

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
    severity: str  # "error" for control family, "warning" for relation, "info" otherwise

    @classmethod
    def from_edge(cls, edge: PranaEdge) -> 'DeclaredUnresolved':
        if edge.family == 'control':
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

    # ------------------------------------------------------------------
    # Walk
    # ------------------------------------------------------------------

    def walk_control(
        self,
        entry_uri: str,
        loader: Callable[[str], Meme | None] | None = None,
        ignore_roles: set[str] | None = None,
    ) -> tuple[list[str], list[list[str]]]:
        """DFS over control edges from entry_uri.

        If loader is provided, it is called for any URI not yet in the graph
        before its outbound edges are explored.  The loader should call
        add_meme() itself or return a Meme to be added.

        ignore_roles: optional set of control edge roles to skip during
        traversal.

        Returns:
            walked_uris  — topologically sorted list of reachable URIs
            dag_violations — list of cycle paths (each a list of URIs)
        """
        WHITE, GRAY, BLACK = 0, 1, 2
        color: dict[str, int] = defaultdict(int)
        topo: list[str] = []
        violations: list[list[str]] = []
        stack_path: list[str] = []

        def _successors(uri: str) -> list[str]:
            return [
                e.to_uri
                for e in self.edges_out(uri, 'control')
                if ignore_roles is None or e.role not in ignore_roles
            ]

        def visit(uri: str) -> None:
            if color[uri] == GRAY:
                # Cycle: record path from re-encountered node
                cycle_start = stack_path.index(uri)
                violations.append(stack_path[cycle_start:] + [uri])
                return
            if color[uri] == BLACK:
                return
            color[uri] = GRAY
            stack_path.append(uri)

            # Load if not yet in graph
            if uri not in self.memes and loader is not None:
                meme = loader(uri)
                if meme is not None and uri not in self.memes:
                    self.add_meme(meme)

            for target in _successors(uri):
                visit(target)

            stack_path.pop()
            color[uri] = BLACK
            topo.append(uri)

        visit(entry_uri)
        # DFS postorder → reverse for topological (sources before targets)
        topo_sorted = list(reversed(topo))
        return topo_sorted, violations

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
        """Edges pointing to URIs not loaded in this graph."""
        result = []
        for meme in self.memes.values():
            for edge in meme.edges_out:
                if edge.to_uri not in self.memes:
                    result.append(DeclaredUnresolved.from_edge(edge))
        return result
