"""MCP prompt catalog for the Lararium carrier spine.

Prompts give clients a structured entry point into hydration without requiring
resource browsing.  Each prompt embeds compiler or carrier output directly into
the message turn so clients that support only tools still receive useful payloads.
"""

from __future__ import annotations

import json
from typing import Any

from .compiler import compile_boot_receipt, compile_full_boot, compile_minimal_boot
from .resources import read_lar_resource_or_index
from .resolver import resolve_lar_uri


# ---------------------------------------------------------------------------
# Prompt catalog — static definitions consumed by prompts/list
# ---------------------------------------------------------------------------

PROMPT_CATALOG: tuple[dict[str, Any], ...] = (
    {
        "name": "lararium-boot_minimal",
        "description": (
            "Load the minimal Lararium boot closure into context. "
            "Embeds the 14-locus required-core artifact (roles, implements bundles, "
            "hydration sockets, and validation) as a user turn. "
            "Use this to prime a session with the canonical threshold law."
        ),
        "arguments": [],
    },
    {
        "name": "lararium-hydrate_full",
        "description": (
            "Load the full Lararium hydration closure into context. "
            "Embeds all indexed carriers beyond the required-core. "
            "Use this when the session needs the complete graph rather than just the boot floor."
        ),
        "arguments": [],
    },
    {
        "name": "lararium-boot_receipt",
        "description": (
            "Load the current boot receipt into context. "
            "Embeds the sha256-digested closure summary for cache and drift detection. "
            "Use this to verify whether the hydration state matches a known good receipt."
        ),
        "arguments": [],
    },
    {
        "name": "lararium-resolve_uri",
        "description": (
            "Resolve a lar:/// URI and embed its resolution record and carrier metadata. "
            "Use this to ground a session in one specific locus before navigating its graph."
        ),
        "arguments": [
            {
                "name": "uri",
                "description": "A lar:/// URI such as lar:///AGENTS or lar:///ha.ka.ba/api/v0.1/pono/meme.",
                "required": True,
            }
        ],
    },
    {
        "name": "lararium-read_carrier",
        "description": (
            "Read a carrier's source text and embed it directly. "
            "Use this when the session needs the raw memetic-wikitext of a specific locus."
        ),
        "arguments": [
            {
                "name": "uri",
                "description": "A file-backed lar:/// carrier URI.",
                "required": True,
            }
        ],
    },
    {
        "name": "lararium-compare_hydration",
        "description": (
            "Compare minimal and full hydration closures. "
            "Embeds both artifact summaries side by side so the session can reason about "
            "what additional carriers the full boot adds beyond the required-core floor."
        ),
        "arguments": [],
    },
)

_CATALOG_BY_NAME: dict[str, dict[str, Any]] = {p["name"]: p for p in PROMPT_CATALOG}


# ---------------------------------------------------------------------------
# Message builders
# ---------------------------------------------------------------------------

def _user_text(text: str) -> dict[str, Any]:
    return {"role": "user", "content": {"type": "text", "text": text}}


def _json_block(label: str, data: Any) -> str:
    body = json.dumps(data, indent=2, sort_keys=True)
    return f"## {label}\n\n```json\n{body}\n```"


def _get_boot_minimal() -> dict[str, Any]:
    artifact = compile_minimal_boot()
    text = "\n\n".join([
        "# Lararium minimal boot closure",
        (
            f"Entry: `{artifact['entry']}`  "
            f"Loci: {artifact['locus_count']}  "
            f"All exist: {artifact['validation']['all_exist']}"
        ),
        _json_block("Closure", artifact["closure"]),
    ])
    return {
        "description": PROMPT_CATALOG[0]["description"],
        "messages": [_user_text(text)],
    }


def _get_hydrate_full() -> dict[str, Any]:
    artifact = compile_full_boot()
    summary = {
        "artifact": artifact["artifact"],
        "entry": artifact["entry"],
        "locus_count": artifact["locus_count"],
        "compiler_note": artifact.get("compiler_note", ""),
        "validation": artifact["validation"],
        "closure_uris": [e["uri"] for e in artifact["closure"]],
    }
    text = "\n\n".join([
        "# Lararium full boot closure",
        (
            f"Entry: `{artifact['entry']}`  "
            f"Loci: {artifact['locus_count']}  "
            f"All exist: {artifact['validation']['all_exist']}"
        ),
        _json_block("Full closure summary", summary),
    ])
    return {
        "description": PROMPT_CATALOG[1]["description"],
        "messages": [_user_text(text)],
    }


def _get_boot_receipt() -> dict[str, Any]:
    minimal = compile_minimal_boot()
    receipt = compile_boot_receipt(minimal)
    text = "\n\n".join([
        "# Lararium boot receipt",
        _json_block("Receipt", receipt),
    ])
    return {
        "description": PROMPT_CATALOG[2]["description"],
        "messages": [_user_text(text)],
    }


def _get_resolve_uri(uri: str) -> dict[str, Any]:
    resolution = resolve_lar_uri(uri)
    resolution_dict = resolution.to_dict()
    blocks = [
        f"# Lararium URI resolution — `{uri}`",
        _json_block("Resolution record", resolution_dict),
    ]
    if not resolution.virtual and resolution.exists and resolution.path:
        try:
            from .carrier import read_carrier  # local import to avoid circular at module level
            record = read_carrier(uri)
            blocks.append(_json_block("Carrier metadata", {
                "implements": record.implements,
                "shape": record.shape.to_dict(),
                "metadata": {k: v for k, v in record.metadata.items()
                             if k in ("role", "uri-path", "content-type", "register",
                                      "mana", "manaoio", "cacheable", "retain")},
            }))
        except Exception as exc:
            blocks.append(f"_Carrier inspection failed: {exc}_")
    return {
        "description": PROMPT_CATALOG[3]["description"],
        "messages": [_user_text("\n\n".join(blocks))],
    }


def _get_read_carrier(uri: str) -> dict[str, Any]:
    text_content = read_lar_resource_or_index(uri)
    text = "\n\n".join([
        f"# Carrier source — `{uri}`",
        f"```\n{text_content}\n```",
    ])
    return {
        "description": PROMPT_CATALOG[4]["description"],
        "messages": [_user_text(text)],
    }


def _get_compare_hydration() -> dict[str, Any]:
    minimal = compile_minimal_boot()
    full = compile_full_boot()
    minimal_uris = {e["uri"] for e in minimal["closure"]}
    additional = [e["uri"] for e in full["closure"] if e["uri"] not in minimal_uris]
    summary = {
        "minimal_locus_count": minimal["locus_count"],
        "full_locus_count": full["locus_count"],
        "additional_loci_count": len(additional),
        "additional_loci": additional,
        "minimal_validation": minimal["validation"],
        "full_validation": full["validation"],
    }
    text = "\n\n".join([
        "# Lararium hydration comparison — minimal vs full",
        (
            f"Minimal: {minimal['locus_count']} loci  "
            f"Full: {full['locus_count']} loci  "
            f"Additional: {len(additional)}"
        ),
        _json_block("Comparison", summary),
    ])
    return {
        "description": PROMPT_CATALOG[5]["description"],
        "messages": [_user_text(text)],
    }


# ---------------------------------------------------------------------------
# Public surface
# ---------------------------------------------------------------------------

def list_prompts() -> list[dict[str, Any]]:
    return list(PROMPT_CATALOG)


def get_prompt(name: str, arguments: dict[str, str] | None = None) -> dict[str, Any]:
    arguments = arguments or {}
    if name not in _CATALOG_BY_NAME:
        raise KeyError(f"unknown prompt: {name!r}")

    match name:
        case "lararium-boot_minimal":
            return _get_boot_minimal()
        case "lararium-hydrate_full":
            return _get_hydrate_full()
        case "lararium-boot_receipt":
            return _get_boot_receipt()
        case "lararium-resolve_uri":
            uri = arguments.get("uri", "")
            if not uri:
                raise ValueError("argument 'uri' is required for lararium-resolve_uri")
            return _get_resolve_uri(uri)
        case "lararium-read_carrier":
            uri = arguments.get("uri", "")
            if not uri:
                raise ValueError("argument 'uri' is required for lararium-read_carrier")
            return _get_read_carrier(uri)
        case "lararium-compare_hydration":
            return _get_compare_hydration()
        case _:
            raise KeyError(f"prompt handler not implemented: {name!r}")
