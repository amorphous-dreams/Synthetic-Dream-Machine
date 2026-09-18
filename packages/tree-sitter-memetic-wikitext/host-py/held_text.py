"""held_text — a carrier that HOLDS a text whole, and the reader that gives the text back.

A text another grammar reads (a specimen written before the framing ruling, a corpus a measurement
depends on) stands in the corpus as a real carrier: the declaration, a canonical head, and ONE ahu
whose meta block declares the held text's own media type. The ahu's body is the text, fenced by a
backtick run longer than any run the text carries, so every wikitext law reads the fence as a quotation
(the fence-mask law) and none reads inside it.

    <<~ ahu #/held>>
    ```toml meta
    type = "<the held text's media type>"
    ```

    ````
    <the text, byte for byte>
    ````

    <<~/ahu>>

The fence is the only escape, and `held` undoes it: the text comes back exactly as it went in. A text
holding no such ahu reads as itself, so a reader may pass any file through `held`.

`host-ts/held-text.mjs` reads the same shape, and the parity gate proves both hosts agree.

Meme: lar:///ha.ka.ba/lares/api/pono/memetic-wikitext
"""
from __future__ import annotations

import re

DECLARATION = ('<<!DOCTYPE "memetic-wikitext+tiddlywiki" '
               '"lar:///ha.ka.ba/lares/api/pono/memetic-wikitext">>')
CARRIER_TYPE = "text/memetic-wikitext+tiddlywiki"

_AHU_OPEN = re.compile(r"^<<~ ahu #/[\w/-]+>>$")
_META_OPEN = "```toml meta"
_TYPE_KEY = re.compile(r'^type\s*=\s*"([^"]+)"\s*$')
_FENCE = re.compile(r"^(`{3,})[ \t]*$")
_AHU_CLOSE = "<<~/ahu>>"


def _find(text: str):
    """(media type, start, end) of the held text's byte span, or None when nothing is held."""
    lines = text.split("\n")
    offsets, o = [], 0
    for ln in lines:
        offsets.append(o)
        o += len(ln) + 1
    for i, ln in enumerate(lines):
        if not _AHU_OPEN.match(ln) or i + 1 >= len(lines) or lines[i + 1] != _META_OPEN:
            continue
        j, held_type = i + 2, None
        while j < len(lines) and lines[j] != "```":
            m = _TYPE_KEY.match(lines[j])
            if m:
                held_type = m.group(1)
            j += 1
        if held_type is None or j >= len(lines):
            continue
        j += 1
        while j < len(lines) and lines[j].strip() == "":
            j += 1
        opener = _FENCE.match(lines[j]) if j < len(lines) else None
        if not opener:
            continue
        run = len(opener.group(1))
        k = j + 1
        while k < len(lines):
            closer = _FENCE.match(lines[k])
            if closer and len(closer.group(1)) >= run:
                break
            k += 1
        if k >= len(lines):
            continue
        after = k + 1
        while after < len(lines) and lines[after].strip() == "":
            after += 1
        if after >= len(lines) or lines[after] != _AHU_CLOSE:
            continue
        return held_type, offsets[j + 1], offsets[k]
    return None


def held(text: str) -> str:
    """The text a carrier holds, byte for byte; a text holding nothing reads as itself."""
    found = _find(text)
    return text if found is None else text[found[1]:found[2]]


def held_type(text: str) -> "str | None":
    """The media type the holding ahu declares, or None when the text holds nothing."""
    found = _find(text)
    return None if found is None else found[0]


def hold(text: str, *, uri: str, file_path: str, role: str, held_type: str) -> str:
    """A carrier holding `text` whole. The block check stands unminted: `lares meme normalize`
    stamps it, the one door every carrier's check passes through."""
    if not text.endswith("\n"):
        raise ValueError("held_text: a held text ends on a newline, so its closing fence owns a line")
    if '"' in role or '"' in held_type:
        raise ValueError("held_text: a meta value carries no double quote")
    longest = max((len(r) for r in re.findall(r"`+", text)), default=0)
    fence = "`" * (max(3, longest) + 1)
    return (
        f"{DECLARATION}\n"
        "\n"
        f'<<^ code="&#x0001;" from="?" -> to="lar:///{uri}">>\n'
        "```toml meta\n"
        "cacheable = false\n"
        f'file-path = "{file_path}"\n'
        'l-space   = "stable"\n'
        f'role      = "{role}"\n'
        f'type      = "{CARRIER_TYPE}"\n'
        f'uri-path  = "{uri}"\n'
        "```\n"
        "\n"
        '<<^ code="&#x0002;">>\n'
        "\n"
        "<<~ ahu #/held>>\n"
        "```toml meta\n"
        f'type = "{held_type}"\n'
        "```\n"
        "\n"
        f"{fence}\n"
        f"{text}"
        f"{fence}\n"
        "\n"
        "<<~/ahu>>\n"
        "\n"
        '<<^ code="&#x0003;">>\n'
        "\n"
        '<<^ code="&#x0004;" -> to="?">>\n'
    )
