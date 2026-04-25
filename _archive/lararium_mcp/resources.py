"""Read-only Lararium resource surface.

This module models the resource spine before binding it to a concrete MCP SDK.
"""

from __future__ import annotations

import json
from dataclasses import dataclass

from .carrier import read_carrier
from .compiler import compile_boot_receipt, compile_full_boot, compile_minimal_boot
from .indexes import compile_carrier_index, compile_interface_index, compile_invariant_index
from .resolver import read_lar_resource, resolve_lar_uri


INDEX_CARRIERS_URI = "lar:///INDEXES/carriers"
INDEX_INTERFACES_URI = "lar:///INDEXES/interfaces"
INDEX_INVARIANTS_URI = "lar:///INDEXES/invariants"
BOOT_MINIMAL_URI = "lar:///boot/minimal"
BOOT_FULL_URI = "lar:///boot/full"
BOOT_RECEIPT_URI = "lar:///boot/receipt"


@dataclass(frozen=True)
class ResourceEntry:
    uri: str
    name: str
    mime_type: str = "text/markdown"

    def to_dict(self) -> dict[str, str]:
        return {"uri": self.uri, "name": self.name, "mimeType": self.mime_type}


def list_lar_resources() -> list[ResourceEntry]:
    carriers = compile_carrier_index()
    entries = [ResourceEntry(carrier.uri, carrier.uri) for carrier in carriers]
    entries.extend(
        [
            ResourceEntry(INDEX_CARRIERS_URI, "Carrier index", "application/json"),
            ResourceEntry(INDEX_INTERFACES_URI, "Interface index", "application/json"),
            ResourceEntry(INDEX_INVARIANTS_URI, "Invariant index", "application/json"),
            ResourceEntry(BOOT_MINIMAL_URI, "Minimal boot artifact", "application/json"),
            ResourceEntry(BOOT_FULL_URI, "Full boot artifact", "application/json"),
            ResourceEntry(BOOT_RECEIPT_URI, "Boot receipt", "application/json"),
        ]
    )
    return sorted(entries, key=lambda item: item.uri)


def read_lar_resource_or_index(uri: str) -> str:
    if uri == INDEX_CARRIERS_URI:
        carriers = compile_carrier_index()
        return json.dumps([carrier.to_dict() for carrier in carriers], indent=2, sort_keys=True)
    if uri == INDEX_INTERFACES_URI:
        carriers = compile_carrier_index()
        return json.dumps(compile_interface_index(carriers), indent=2, sort_keys=True)
    if uri == INDEX_INVARIANTS_URI:
        carriers = compile_carrier_index()
        return json.dumps(compile_invariant_index(carriers), indent=2, sort_keys=True)
    if uri == BOOT_MINIMAL_URI:
        return json.dumps(compile_minimal_boot(), indent=2, sort_keys=True)
    if uri == BOOT_FULL_URI:
        return json.dumps(compile_full_boot(), indent=2, sort_keys=True)
    if uri == BOOT_RECEIPT_URI:
        minimal = compile_minimal_boot()
        return json.dumps(compile_boot_receipt(minimal), indent=2, sort_keys=True)
    return read_lar_resource(uri)


def inspect_carrier(uri: str) -> dict[str, object]:
    return read_carrier(uri).to_dict()


def inspect_resolution(uri: str) -> dict[str, object]:
    return resolve_lar_uri(uri).to_dict()
