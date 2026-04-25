"""Pranala parser — extract PranaEdge records from carrier text.

Handles four surface forms:
  block pranala   <<~ pranala #frag FROM -> TO >> ... <<~/pranala >>
  inline pranala  <<~ pranala #frag FROM -> TO family:F role:R >>
  loulou sugar    <<~ loulou URI >>          → family=relation
  aka sugar       <<~ aka URI >>             → family=observe
  kahea sugar     <<~ kahea URI >>           → family=dataflow

? -> resolution uses the innermost enclosing ahu #fragment as from_socket.
"""

from __future__ import annotations

import re
import tomllib
from dataclasses import dataclass, field
from typing import Any

# ---------------------------------------------------------------------------
# PranaEdge dataclass
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class PranaEdge:
    from_uri: str
    from_socket: str
    to_uri: str
    to_socket: str
    family: str
    lifecycle: str = "instance"
    role: str | None = None
    traversal: str = "source-to-target"
    propagation: str = "none"
    label: str = ""
    payload: dict = field(default_factory=dict)
    cardinality: str | None = None
    polarity: str | None = None
    status: str = "declared"
    confidence: float | None = None
    render_mode: str | None = None

    def __hash__(self) -> int:
        return hash((self.from_socket, self.to_uri, self.to_socket, self.family, self.role))


# ---------------------------------------------------------------------------
# Compiled regexes
# ---------------------------------------------------------------------------

# ahu open: <<~ [namespace] ahu #fragment >>
# Permissive prefix to catch <<~&#x0002; ahu ... >> and <<~ॐ ँ&#x0002; ahu ... >>
_AHU_OPEN_RE = re.compile(r'<<~[^>]*\bahu\s+(#[\w-]+)\s*>>')
_AHU_CLOSE_RE = re.compile(r'<<~/ahu\s*>>')

# Block pranala: opening line up to first >>, then body, then closing sigil.
# Uses non-greedy body match.
_BLOCK_RE = re.compile(
    r'<<~\s*pranala\s+'
    r'(#[\w-]+\s+)?'             # optional #fragment-id (group 1)
    r'(\S+)\s*->\s*(\S+)\s*>>'  # FROM -> TO (groups 2, 3)
    r'(.*?)'                     # body (group 4)
    r'<<~/pranala\s*>>',
    re.DOTALL,
)

# Inline pranala: single-line, ends with >>
# Must NOT match lines that are the opening of a block pranala (those have a
# closing <<~/pranala >> somewhere later).  We strip block regions before
# applying this regex.
_INLINE_RE = re.compile(
    r'<<~\s*pranala\s+'
    r'(#[\w-]+\s+)?'              # optional #fragment-id (group 1)
    r'(\S+)\s*->\s*(\S+)'         # FROM -> TO (groups 2, 3)
    r'(?:\s+family:([\w-]+))?'    # optional family:F (group 4)
    r'(?:\s+role:([\w-]+))?'      # optional role:R (group 5)
    r'\s*>>',
)

_LOULOU_RE = re.compile(r'<<~\s*loulou\s+(\S+)\s*>>')
_AKA_RE    = re.compile(r'<<~\s*aka\s+(\S+)\s*>>')
_KAHEA_RE  = re.compile(r'<<~\s*kahea\s+(\S+)\s*>>')
_TOML_FENCE_RE = re.compile(r'```toml\s*(.*?)```', re.DOTALL)

# ---------------------------------------------------------------------------
# URI helpers
# ---------------------------------------------------------------------------

def _resolve_to(raw: str, carrier_uri: str) -> tuple[str, str]:
    """Return (to_uri, to_socket) from a raw TO expression."""
    if '#' in raw and raw.startswith('lar:///'):
        uri, frag = raw.split('#', 1)
        return uri, uri + '#' + frag
    if raw.startswith('lar:///'):
        return raw, ''
    # Relative: prepend carrier root up to the api/docs segment
    parts = carrier_uri.split('/')
    # lar:///ha.ka.ba/api/v0.1/... → root = lar:///ha.ka.ba/api/v0.1/
    try:
        api_idx = next(i for i, p in enumerate(parts) if p in ('api', 'docs', 'library'))
        root = '/'.join(parts[:api_idx + 2]) + '/'
    except StopIteration:
        root = carrier_uri.rsplit('/', 1)[0] + '/'
    resolved = root + raw
    return resolved, ''


def _resolve_from(token: str, carrier_uri: str, ahu_stack: list[str]) -> tuple[str, str]:
    """Return (from_uri, from_socket) for a FROM token."""
    if token == '?':
        socket = ahu_stack[-1] if ahu_stack else carrier_uri
        return carrier_uri, socket
    if '#' in token and token.startswith('lar:///'):
        uri, frag = token.split('#', 1)
        return uri, uri + '#' + frag
    if token.startswith('lar:///'):
        return token, token
    return carrier_uri, carrier_uri


# ---------------------------------------------------------------------------
# TOML body field normalization
# ---------------------------------------------------------------------------

def _fields_from_toml(toml_text: str) -> dict[str, Any]:
    try:
        raw = tomllib.loads(toml_text)
    except tomllib.TOMLDecodeError:
        return {}

    out: dict[str, Any] = {}
    out['lifecycle'] = raw.get('lifecycle', 'instance')
    out['role'] = raw.get('role')
    out['label'] = raw.get('label', '')
    out['cardinality'] = raw.get('cardinality')
    out['polarity'] = raw.get('polarity')
    out['status'] = raw.get('status', 'declared')
    out['confidence'] = raw.get('confidence')
    out['render_mode'] = raw.get('render-mode')

    # traversal: prefer explicit field; map legacy dir values
    dir_val = raw.get('dir')
    traversal = raw.get('traversal')
    payload: dict[str, Any] = dict(raw.get('payload') or {})
    if dir_val == 'both':
        traversal = 'source-to-target'
        payload['dir_hint'] = 'both'
    elif dir_val == 'back':
        traversal = 'target-to-source'
    elif dir_val == 'forward':
        traversal = 'source-to-target'
    out['traversal'] = traversal or 'source-to-target'
    out['propagation'] = raw.get('propagation', 'none')

    # unknown keys land in payload
    known = {'family', 'lifecycle', 'role', 'label', 'cardinality', 'polarity',
             'status', 'confidence', 'render-mode', 'traversal', 'propagation',
             'dir', 'payload', 'from', 'to', 'when'}
    for k, v in raw.items():
        if k not in known:
            payload[k] = v
    out['payload'] = payload
    return out


# ---------------------------------------------------------------------------
# Main parser
# ---------------------------------------------------------------------------

def parse_pranala_edges(carrier_uri: str, text: str) -> list[PranaEdge]:
    """Extract all PranaEdge records from carrier text.

    Processes text sequentially to maintain ahu context stack for ? -> resolution.
    Block pranala regions are identified first and excluded from inline scan.
    """
    edges: list[PranaEdge] = []

    # Step 1: collect block pranala spans so inline scan can skip them.
    block_spans: list[tuple[int, int]] = [
        (m.start(), m.end()) for m in _BLOCK_RE.finditer(text)
    ]

    def _in_block(pos: int) -> bool:
        return any(s <= pos < e for s, e in block_spans)

    # Step 2: collect all events with positions.
    # Event types: ahu_open, ahu_close, block, inline, loulou, aka, kahea
    events: list[tuple[int, str, re.Match]] = []  # type: ignore[type-arg]

    for m in _AHU_OPEN_RE.finditer(text):
        events.append((m.start(), 'ahu_open', m))
    for m in _AHU_CLOSE_RE.finditer(text):
        events.append((m.start(), 'ahu_close', m))
    for m in _BLOCK_RE.finditer(text):
        events.append((m.start(), 'block', m))
    for m in _INLINE_RE.finditer(text):
        if not _in_block(m.start()):
            events.append((m.start(), 'inline', m))
    for m in _LOULOU_RE.finditer(text):
        if not _in_block(m.start()):
            events.append((m.start(), 'loulou', m))
    for m in _AKA_RE.finditer(text):
        if not _in_block(m.start()):
            events.append((m.start(), 'aka', m))
    for m in _KAHEA_RE.finditer(text):
        if not _in_block(m.start()):
            events.append((m.start(), 'kahea', m))

    events.sort(key=lambda ev: ev[0])

    ahu_stack: list[str] = []

    for _pos, kind, m in events:
        if kind == 'ahu_open':
            frag = m.group(1).strip()
            ahu_stack.append(carrier_uri + frag)  # frag already has '#'
            continue

        if kind == 'ahu_close':
            if ahu_stack:
                ahu_stack.pop()
            continue

        if kind == 'block':
            frag_raw, from_raw, to_raw, body = (
                m.group(1) or '', m.group(2), m.group(3), m.group(4)
            )
            from_uri, from_socket = _resolve_from(from_raw.strip(), carrier_uri, ahu_stack)
            if frag_raw.strip():
                from_socket = carrier_uri + frag_raw.strip()
            to_uri, to_socket = _resolve_to(to_raw, carrier_uri)

            fields: dict[str, Any] = {}
            toml_m = _TOML_FENCE_RE.search(body)
            if toml_m:
                fields = _fields_from_toml(toml_m.group(1))
            # family may appear in the TOML body for block form
            family = fields.pop('family', None) or ''
            if not family:
                # Try to extract from body text before TOML
                family_m = re.search(r'\bfamily\s*=\s*"([\w-]+)"', body)
                family = family_m.group(1) if family_m else 'relation'

            edges.append(PranaEdge(
                from_uri=from_uri,
                from_socket=from_socket,
                to_uri=to_uri,
                to_socket=to_socket,
                family=family,
                **{k: v for k, v in fields.items() if v is not None or k in ('role', 'cardinality', 'polarity', 'confidence', 'render_mode')},
            ))
            continue

        if kind == 'inline':
            frag_raw = (m.group(1) or '').strip()
            from_raw = m.group(2)
            to_raw = m.group(3)
            family = m.group(4) or 'relation'
            role = m.group(5) or None

            from_uri, from_socket = _resolve_from(from_raw, carrier_uri, ahu_stack)
            if frag_raw:
                from_socket = carrier_uri + frag_raw
            to_uri, to_socket = _resolve_to(to_raw, carrier_uri)

            edges.append(PranaEdge(
                from_uri=from_uri,
                from_socket=from_socket,
                to_uri=to_uri,
                to_socket=to_socket,
                family=family,
                role=role,
            ))
            continue

        # Sugar forms
        target_uri = m.group(1)
        if '#' in target_uri and target_uri.startswith('lar:///'):
            to_uri_s, to_socket_s = target_uri.split('#', 1)
            to_socket_s = to_uri_s + '#' + to_socket_s
        else:
            to_uri_s, to_socket_s = target_uri, ''

        from_socket_s = ahu_stack[-1] if ahu_stack else carrier_uri

        if kind == 'loulou':
            edges.append(PranaEdge(
                from_uri=carrier_uri, from_socket=from_socket_s,
                to_uri=to_uri_s, to_socket=to_socket_s,
                family='relation', lifecycle='instance',
                traversal='source-to-target', propagation='none',
            ))
        elif kind == 'aka':
            edges.append(PranaEdge(
                from_uri=carrier_uri, from_socket=from_socket_s,
                to_uri=to_uri_s, to_socket=to_socket_s,
                family='observe', lifecycle='instance',
                traversal='source-to-target', propagation='none',
            ))
        elif kind == 'kahea':
            edges.append(PranaEdge(
                from_uri=carrier_uri, from_socket=from_socket_s,
                to_uri=to_uri_s, to_socket=to_socket_s,
                family='dataflow', lifecycle='instance',
                traversal='source-to-target', propagation='push-forward',
            ))

    return edges
