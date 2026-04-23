"""In-memory Lararium carrier and interface indexes."""

from __future__ import annotations

from collections import defaultdict
from pathlib import Path
from typing import Iterable

from .carrier import CarrierRecord, read_carrier
from .resolver import LARES_ROOT


def file_path_to_lar_uri(path: Path) -> str:
    path = path.resolve()
    rel = path.relative_to(LARES_ROOT)
    if len(rel.parts) == 1 and rel.suffix == ".md" and rel.stem == rel.stem.upper():
        return f"lar:///{rel.stem}"
    if rel.parts and rel.parts[0] == "ha-ka-ba":
        without_suffix = rel.with_suffix("")
        return "lar:///ha.ka.ba/" + "/".join(without_suffix.parts[1:])
    raise ValueError(f"cannot derive lar URI for {path}")


def iter_source_carrier_paths(root: Path | None = None) -> Iterable[Path]:
    root = root or LARES_ROOT
    yield from sorted((root / "ha-ka-ba" / "api" / "v0.1").rglob("*.md"))
    for caps_root in ("AGENTS", "LARES"):
        path = root / f"{caps_root}.md"
        if path.exists():
            yield path


def compile_carrier_index(root: Path | None = None) -> list[CarrierRecord]:
    records: list[CarrierRecord] = []
    for path in iter_source_carrier_paths(root):
        try:
            uri = file_path_to_lar_uri(path)
            records.append(read_carrier(uri))
        except Exception:
            # The first index pass stays conservative: malformed or unsupported
            # legacy-ish files do not stop lawful carrier discovery.
            continue
    return records


def compile_interface_index(carriers: Iterable[CarrierRecord]) -> dict[str, list[str]]:
    index: dict[str, list[str]] = defaultdict(list)
    for carrier in carriers:
        for interface_uri in carrier.implements:
            index[interface_uri].append(carrier.uri)
    return {key: sorted(value) for key, value in sorted(index.items())}


def compile_invariant_index(carriers: Iterable[CarrierRecord]) -> list[str]:
    invariant_uri = "lar:///ha.ka.ba/api/v0.1/pono/invariant"
    return sorted(carrier.uri for carrier in carriers if invariant_uri in carrier.implements)
