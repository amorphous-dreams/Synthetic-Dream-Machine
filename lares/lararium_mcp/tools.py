"""Read-only tool façade for clients without resource support."""

from __future__ import annotations

from .resources import inspect_carrier, inspect_resolution, list_lar_resources, read_lar_resource_or_index


def resolve_lar_uri_tool(uri: str) -> dict[str, object]:
    return inspect_resolution(uri)


def read_lar_resource_tool(uri: str) -> str:
    return read_lar_resource_or_index(uri)


def list_lar_carriers_tool() -> list[dict[str, str]]:
    return [entry.to_dict() for entry in list_lar_resources()]


def inspect_carrier_tool(uri: str) -> dict[str, object]:
    return inspect_carrier(uri)
