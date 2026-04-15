#!/usr/bin/env python3
# -*- coding: utf-8 -*-

from __future__ import annotations

import argparse
import shutil
import sys
from pathlib import Path


def insert_after(text: str, marker: str, addition: str) -> str:
    if addition.strip() in text:
        return text
    idx = text.find(marker)
    if idx < 0:
        raise ValueError(f"Missing marker:\n{marker[:200]}")
    pos = idx + len(marker)
    return text[:pos] + addition + text[pos:]


def patch_parser_law(text: str) -> str:
    # 1) research-foundation-ka: strengthen MCP note
    marker = "* resources, prompts, and tools as explicit capability surfaces\n"
    addition = (
        "* discoverable tools with declared `inputSchema`, optional `outputSchema`, "
        "and explicit human-in-the-loop guidance around invocation\n"
    )
    text = insert_after(text, marker, addition)

    # 2) research-foundation-ka: add outward extraction note
    marker = (
        "* define later capability gating and delegation profiles without forcing them into root parser-law too early\n"
    )
    addition = (
        "* keep full three-layer lowering, widget-tree law, render projection, and trace continuity detail in "
        "`lar:///ha.ka.ba/render-pipeline-law` so parser-law may remain compact\n"
    )
    text = insert_after(text, marker, addition)

    # 3) architecture-plan-ka: add new linked law
    marker = "* `lar:///ha.ka.ba/parse-aftermath`\n"
    addition = "* `lar:///ha.ka.ba/render-pipeline-law`\n"
    text = insert_after(text, marker, addition)

    # 4) architecture-plan-ka: add extraction todo
    marker = (
        "* define exact AST, token, trace, envelope, and mana products expected from compliant implementations\n"
    )
    addition = (
        "* define the constitutional minimum for token, AST, widget-facing lowering products, "
        "return-envelope, and trace products in parser-law, then move full pipeline schemas, "
        "widget-tree law, and target adapters outward into `lar:///ha.ka.ba/render-pipeline-law`\n"
    )
    text = insert_after(text, marker, addition)

    # 5) act-ka: add minimal stable product note
    marker = "This subphase focuses on how Act actually performs implementation work.\n"
    addition = (
        "\n"
        "A compliant parser MAY produce stable syntax products such as token streams, AST products, "
        "widget-facing lowering seeds or addresses, typed return-envelopes, and trace bundles.\n"
        "\n"
        "Full AST schema, widget-tree schema, render-target adapters, and target projection detail "
        "should move outward into `lar:///ha.ka.ba/render-pipeline-law`.\n"
    )
    text = insert_after(text, marker, addition)

    # 6) hooko-ka: add staged/commit/degrade/rollback trace note
    marker = "* degradation posture\n"
    addition = (
        "\n"
        "When prepared work crosses Hooko, transaction trace should preserve whether the outcome stayed "
        "staged, landed committed, degraded, or rolled back.\n"
        "\n"
        "A compliant parser should not launder one outcome class into another.\n"
    )
    text = insert_after(text, marker, addition)

    # 7) return-types-ka: add outward transaction-lifecycle link
    marker = (
        "It SHOULD, however, preserve enough trace that later profiles may distinguish degraded return from committed return.\n"
    )
    addition = (
        "\n"
        "Parser-law retains the constitutional minimum for `&#x0004;` return routing and phase naming.\n"
        "\n"
        "Broader layer-to-target transaction-lifecycle detail, widget persistence, and render-facing "
        "idempotency detail should move outward into "
        "`lar:///ha.ka.ba/render-pipeline-law#transaction-lifecycle` and related loci.\n"
    )
    text = insert_after(text, marker, addition)

    return text


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Patch parser-law with the approved Route 3 constitutional additions."
    )
    parser.add_argument("input", help="Path to parser-law source markdown file")
    parser.add_argument(
        "-o",
        "--output",
        help="Write patched output to this path; default writes alongside input with .patched suffix",
    )
    parser.add_argument(
        "--in-place",
        action="store_true",
        help="Write back to input path and create a .bak backup first",
    )
    args = parser.parse_args()

    input_path = Path(args.input)
    if not input_path.exists():
        print(f"Input file not found: {input_path}", file=sys.stderr)
        return 1

    original = input_path.read_text(encoding="utf-8")
    patched = patch_parser_law(original)

    if patched == original:
        print("No changes landed. The file may already carry this patch.")
        return 0

    if args.in_place:
        backup_path = input_path.with_suffix(input_path.suffix + ".bak")
        shutil.copy2(input_path, backup_path)
        input_path.write_text(patched, encoding="utf-8")
        print(f"Patched in place: {input_path}")
        print(f"Backup written:   {backup_path}")
        return 0

    output_path = Path(args.output) if args.output != None else input_path.with_suffix(input_path.suffix + ".patched")
    output_path.write_text(patched, encoding="utf-8")
    print(f"Patched output written: {output_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())