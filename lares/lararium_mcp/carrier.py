"""Carrier ingress for Lararium MCP."""

from __future__ import annotations

from dataclasses import dataclass, field
import re
import tomllib
from pathlib import Path
from typing import Any

from .diagnostics import Diagnostic
from .pranala_parser import parse_pranala_edges
from .resolver import resolve_lar_uri


DOCTYPE_RE = re.compile(r"<!--\s*<<~\s*!DOCTYPE\s*=\s*lar:///[^>]+>>\s*-->")
OPENER_RE = re.compile(r"<<~(?:&#x[0-9a-fA-F]+;\s*)?\?\s*->\s*(lar:///[^\s>]+)\s*>>")
IAM_BLOCK_RE = re.compile(r"<<~\s*ahu\s+#iam\s*>>(.*?)<<~/ahu\s*>>", re.DOTALL)
TOML_FENCE_RE = re.compile(r"```toml\s*(.*?)```", re.DOTALL)
BODY_OPEN_RE = re.compile(r"<<~(?:&#x[0-9a-fA-F]+;\s*)?ahu\s+#(?:meme-)?body-open\s*>>")
BODY_CLOSE_RE = re.compile(r"<<~(?:&#x[0-9a-fA-F]+;\s*)?ahu\s+#body-close\s*>>")
RETURN_THROAT_RE = re.compile(r"<<~(?:&#x[0-9a-fA-F]+;\s*)?->\s*\?\s*>>")
OODA_GLYPHS = ("✶", "⏿", "◇", "▶", "⤴", "↺")


@dataclass(frozen=True)
class CarrierShape:
    valid: bool
    rating: str
    depth_state: str
    diagnostics: tuple[Diagnostic, ...]

    def to_dict(self) -> dict[str, object]:
        return {
            "valid": self.valid,
            "rating": self.rating,
            "depth_state": self.depth_state,
            "diagnostics": [item.to_dict() for item in self.diagnostics],
        }


@dataclass(frozen=True)
class CarrierRecord:
    uri: str
    path: Path
    metadata: dict[str, Any]
    implements: tuple[str, ...]
    shape: CarrierShape

    def to_dict(self) -> dict[str, object]:
        return {
            "uri": self.uri,
            "path": str(self.path),
            "metadata": self.metadata,
            "implements": list(self.implements),
            "shape": self.shape.to_dict(),
        }


def extract_iam_metadata(text: str) -> tuple[dict[str, Any], list[Diagnostic]]:
    diagnostics: list[Diagnostic] = []
    match = IAM_BLOCK_RE.search(text)
    if not match:
        return {}, [Diagnostic("carrier.iam.missing", "carrier lacks `ahu #iam` metadata block")]

    fence = TOML_FENCE_RE.search(match.group(1))
    if not fence:
        return {}, [Diagnostic("carrier.iam.toml_missing", "`ahu #iam` lacks a TOML fence")]

    try:
        data = tomllib.loads(fence.group(1))
    except tomllib.TOMLDecodeError as exc:
        diagnostics.append(Diagnostic("carrier.iam.toml_invalid", f"invalid `#iam` TOML: {exc}"))
        return {}, diagnostics

    return data, diagnostics


def extract_interface_bundle(metadata: dict[str, Any]) -> tuple[str, ...]:
    implements = metadata.get("implements", [])
    if isinstance(implements, str):
        return (implements,)
    if not isinstance(implements, list):
        return ()
    return tuple(item for item in implements if isinstance(item, str))


def validate_carrier_shape(text: str, metadata: dict[str, Any] | None = None, uri: str = '', edges: list[Any] | None = None) -> CarrierShape:
    metadata = metadata or {}
    diagnostics: list[Diagnostic] = []

    if not DOCTYPE_RE.search(text):
        diagnostics.append(Diagnostic("carrier.doctype.missing", "memetic-wikitext doctype comment missing"))

    opener = OPENER_RE.search(text)
    if not opener:
        diagnostics.append(Diagnostic("carrier.opener.missing", "document opener with declared `lar:` address missing"))
    else:
        uri_path = metadata.get("uri-path")
        opener_uri = opener.group(1)
        if isinstance(uri_path, str):
            expected_uri = uri_path if uri_path.startswith("lar:///") else f"lar:///{uri_path}"
            if opener_uri != expected_uri:
                diagnostics.append(
                    Diagnostic(
                        "carrier.opener.metadata_mismatch",
                        f"opener URI {opener_uri!r} does not match metadata uri-path {expected_uri!r}",
                        "warning",
                    )
                )

    if not metadata:
        diagnostics.append(Diagnostic("carrier.iam.empty", "metadata could not be extracted"))
    else:
        for field_name in ("uri-path", "file-path", "content-type", "role"):
            if field_name not in metadata:
                diagnostics.append(Diagnostic("carrier.iam.field_missing", f"metadata lacks `{field_name}`"))

    if not BODY_OPEN_RE.search(text):
        diagnostics.append(Diagnostic("carrier.body_open.missing", "body-open threshold missing"))
    if not BODY_CLOSE_RE.search(text):
        diagnostics.append(Diagnostic("carrier.body_close.missing", "body-close threshold missing"))
    if not RETURN_THROAT_RE.search(text):
        diagnostics.append(Diagnostic("carrier.return_throat.missing", "honest return throat `-> ?` missing"))

    missing_glyphs = [glyph for glyph in OODA_GLYPHS if glyph not in text]
    if missing_glyphs:
        diagnostics.append(
            Diagnostic(
                "carrier.ooda_ha.incomplete",
                "six-line OODA-HA phase map lacks glyphs: " + " ".join(missing_glyphs),
                "warning",
            )
        )

    loulou_count = text.count("<<~ loulou lar:///")
    parsed_edges = edges if edges is not None else parse_pranala_edges(uri, text)
    implements = set(extract_interface_bundle(metadata))
    for edge in parsed_edges:
        if edge.family == 'control' and edge.role == 'implements':
            implements.add(edge.to_uri)
    error_count = sum(1 for item in diagnostics if item.severity == "error")
    valid = error_count == 0
    if valid and implements:
        rating = "typed meme"
    elif valid:
        rating = "meme"
    elif metadata or opener:
        rating = "data"
    else:
        rating = "noise"

    depth_state = "resolved" if loulou_count else "absent"
    return CarrierShape(valid, rating, depth_state, tuple(diagnostics))


def read_carrier(uri: str) -> CarrierRecord:
    resolution = resolve_lar_uri(uri)
    if resolution.virtual:
        raise FileNotFoundError(f"{uri} names a virtual carrier namespace")
    if resolution.path is None or not resolution.path.exists():
        raise FileNotFoundError(f"{uri} does not resolve to an existing carrier file")

    text = resolution.path.read_text(encoding="utf-8")
    metadata, metadata_diagnostics = extract_iam_metadata(text)
    edges = parse_pranala_edges(uri, text)
    shape = validate_carrier_shape(text, metadata, uri, edges=edges)
    if metadata_diagnostics:
        shape = CarrierShape(
            False,
            "data" if text.strip() else "noise",
            shape.depth_state,
            tuple((*metadata_diagnostics, *shape.diagnostics)),
        )
    implements = set(extract_interface_bundle(metadata))
    for edge in edges:
        if edge.family == 'control' and edge.role == 'implements':
            implements.add(edge.to_uri)
    return CarrierRecord(uri, resolution.path, metadata, tuple(sorted(implements)), shape)
