"""The native tree-sitter binding answers to the carrier grammar's ABI alone.

`requirements.txt` pins the binding (`tree-sitter==...`); the grammar package generates `src/parser.c` at the
ABI its CLI emits. The binding loads a grammar only when that ABI lies inside its own window
(`MIN_COMPATIBLE_LANGUAGE_VERSION` .. `LANGUAGE_VERSION`). This file holds both halves of that pair to the
tree, so a pin bump or a grammar regeneration that leaves the window fails here and never at a router boot.
"""
import re
from pathlib import Path

import pytest

HERE = Path(__file__).resolve().parent
REQUIREMENTS = HERE.parent / "requirements.txt"
PARSER_C = HERE.parent.parent / "tree-sitter-memetic-wikitext" / "src" / "parser.c"


def grammar_abi(text: str) -> int:
    found = re.search(r"^#define LANGUAGE_VERSION (\d+)$", text, re.M)
    assert found, "the grammar's parser.c names no LANGUAGE_VERSION"
    return int(found.group(1))


def inside_window(abi: int, low: int, high: int) -> bool:
    return low <= abi <= high


def test_the_grammar_abi_lies_inside_the_bindings_window():
    import tree_sitter

    abi = grammar_abi(PARSER_C.read_text(encoding="utf-8"))
    assert inside_window(abi, tree_sitter.MIN_COMPATIBLE_LANGUAGE_VERSION, tree_sitter.LANGUAGE_VERSION)


def test_the_window_check_refuses_an_abi_outside_it():
    # CONTROL: the instrument reads a known positive and a known negative.
    assert inside_window(15, 13, 15)
    assert not inside_window(16, 13, 15)
    assert not inside_window(12, 13, 15)
    assert grammar_abi("#define LANGUAGE_VERSION 14\n") == 14
    with pytest.raises(AssertionError):
        grammar_abi("no version here")


def test_requirements_pins_the_installed_binding():
    import importlib.metadata

    pinned = re.search(r"^tree-sitter==(\S+)$", REQUIREMENTS.read_text(encoding="utf-8"), re.M)
    assert pinned, "requirements.txt pins no tree-sitter binding"
    assert importlib.metadata.version("tree-sitter") == pinned.group(1)
