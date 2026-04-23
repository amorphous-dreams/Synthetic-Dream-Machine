"""`lar:` URI resolution for the Lararium MCP carrier spine.

Resolution policy follows the current MCP roadmap:
- all-caps roots such as `lar:///AGENTS`, `lar:///LARES`, and
  `lar:///INDEXES/**` live adjacent to tuple roots;
- `AGENTS` and `LARES` map to all-caps files under `lares/`;
- `INDEXES/**` and other all-caps roots may act as virtual resource roots;
- stable tuple root `ha.ka.ba` maps to `lares/ha-ka-ba/`;
- other `*.*.*` tuple roots map to `lares/chapel-perilous-opens/<root>/`.
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from urllib.parse import unquote, urlparse


LARES_ROOT = Path(__file__).resolve().parents[1]
STABLE_TUPLE_ROOT = "ha.ka.ba"
CAPS_FILE_ROOTS = {"AGENTS", "LARES"}
VIRTUAL_CAPS_ROOTS = {"INDEXES"}


@dataclass(frozen=True)
class LarResolution:
    uri: str
    root: str
    child_path: tuple[str, ...]
    path: Path | None
    resource_path: str
    kind: str
    exists: bool
    virtual: bool = False

    def to_dict(self) -> dict[str, object]:
        return {
            "uri": self.uri,
            "root": self.root,
            "child_path": list(self.child_path),
            "path": str(self.path) if self.path else None,
            "resource_path": self.resource_path,
            "kind": self.kind,
            "exists": self.exists,
            "virtual": self.virtual,
        }


def _split_lar_uri(uri: str) -> tuple[str, tuple[str, ...]]:
    parsed = urlparse(uri)
    if parsed.scheme != "lar":
        raise ValueError(f"expected lar URI, got {uri!r}")
    if parsed.netloc:
        raise ValueError(f"expected triple-slash lar URI, got {uri!r}")
    parts = tuple(part for part in unquote(parsed.path).lstrip("/").split("/") if part)
    if not parts:
        raise ValueError("lar URI needs a root segment")
    return parts[0], parts[1:]


def _with_md_suffix(path: Path) -> Path:
    if path.suffix:
        return path
    return path.with_suffix(".md")


def _is_tuple_root(root: str) -> bool:
    parts = root.split(".")
    return len(parts) == 3 and all(parts)


def _is_caps_root(root: str) -> bool:
    return root == root.upper() and any(ch.isalpha() for ch in root)


def resolve_lar_uri(uri: str) -> LarResolution:
    """Resolve a `lar:///...` URI into either a repo path or virtual namespace."""

    root, child_path = _split_lar_uri(uri)
    resource_path = "/".join((root, *child_path))

    if root in CAPS_FILE_ROOTS and not child_path:
        path = LARES_ROOT / f"{root}.md"
        return LarResolution(uri, root, child_path, path, resource_path, "caps-file", path.exists())

    if root in VIRTUAL_CAPS_ROOTS or _is_caps_root(root):
        # All-caps roots form a first-class namespace. Some map to files, some
        # remain virtual resources produced by the compiler/index layer.
        return LarResolution(uri, root, child_path, None, resource_path, "caps-virtual", False, True)

    if _is_tuple_root(root):
        if root == STABLE_TUPLE_ROOT:
            base = LARES_ROOT / root.replace(".", "-")
        else:
            base = LARES_ROOT / "chapel-perilous-opens" / root
        path = _with_md_suffix(base.joinpath(*child_path)) if child_path else _with_md_suffix(base)
        return LarResolution(uri, root, child_path, path, resource_path, "tuple-file", path.exists())

    raise ValueError(f"unsupported lar root {root!r} in {uri!r}")


def read_lar_resource(uri: str) -> str:
    """Read a file-backed Lararium resource.

    Virtual roots such as `lar:///INDEXES/**` get materialized by higher index
    layers, not by this raw file reader.
    """

    resolution = resolve_lar_uri(uri)
    if resolution.virtual:
        raise FileNotFoundError(f"{uri} names a virtual lar resource")
    if resolution.path is None or not resolution.path.exists():
        raise FileNotFoundError(f"{uri} does not resolve to an existing file")
    return resolution.path.read_text(encoding="utf-8")
