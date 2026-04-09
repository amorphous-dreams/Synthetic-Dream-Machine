#!/usr/bin/env python3
"""
fix_staging_fence_apostrophes.py
────────────────────────────────
Convert straight ASCII apostrophes (U+0027) to the typographic right single
quotation mark (U+2019) INSIDE code-fence blocks of the BECMI spell staging
files.

These files store verbatim source spell text inside ```text fences as part of
the pipeline that feeds FTLS Chapter 06 osr: import cards.  The prior repo-wide
pass (fix_apostrophes.py) deliberately skipped fence content; this script
finishes the job for content that is prose-destined, not code-destined.

────────────────────────────────────────────────────────────────────────────────
BEST PRACTICES: TYPING U+2019 ON A NORMAL KEYBOARD
────────────────────────────────────────────────────────────────────────────────

The typographic apostrophe / right single quotation mark is U+2019 (').

  macOS
    • Smart Quotes on by default in most apps (TextEdit, Pages, Mail).
    • In VS Code / terminals: Option + Shift + ] inserts '  (U+2019)
                               Option + ]         inserts '  (U+2018, left)
    • Or: Edit → Emoji & Symbols → search "right single" → double-click.

  Windows
    • In Microsoft Office: smart quotes are on by default (AutoFormat).
    • In VS Code / Notepad: Alt + 0 1 4 6  on the *numpad*  →  '  (U+2019)
    • Or: Win + . (emoji picker) → Symbols → Punctuation → scroll to ' .
    • Or: Insert → Symbol in Word.

  Linux (X11)
    • Compose key sequence: Compose  '  '  →  '  (exact sequence varies by
      compose table; works after setting a Compose key in keyboard settings).
    • IBus / ibus-table: depends on input method.
    • GTK apps with smart-quotes enabled may auto-convert on typing.
    • Fallback: Ctrl + Shift + U  then  2 0 1 9  Enter  (in most GTK apps and
      many terminal emulators).

  Universal fallback (any OS, any editor)
    • Search-replace: find  '  (U+0027) → replace  '  (U+2019) after writing.
    • Copy the character from this source file comment and paste it wherever
      needed — your clipboard will carry the correct codepoint.
    • Run this script.

  VS Code tip
    • In the editor, place the cursor after a word-ending apostrophe and press
      Ctrl/Cmd + H to open Find & Replace; paste '  in "find" and '  in
      "replace", then "Replace All" scoped to selection.

  Measurement marks (feet/prime notation)
    • Spell range notation like  60'  uses U+0027 conventionally in raw game
      text.  This script preserves digit-adjacent apostrophes (10', 60', 150')
      as U+0027 — only letter-preceded apostrophes (contractions and
      possessives) are converted to U+2019.  If you need true prime marks
      (U+2032 ′), run a separate pass replacing  [0-9]+'  with  [0-9]+′.

────────────────────────────────────────────────────────────────────────────────

USAGE
    python3 _todo/BECMI/scripts/fix_staging_fence_apostrophes.py [--dry-run] [root_dir]

    --dry-run   Print changes without writing files.
    root_dir    Repo root (default: current working directory).

"""

import re
import os
import sys

# ── Target files ──────────────────────────────────────────────────────────────
# Add paths here (relative to repo root) to expand the scope.
# Keep paths relative so the script stays portable.
TARGET_FILES = [
    "_todo/BECMI/TODO_BECMI_Spell_Material_Staging.md",
    # "_todo/BECMI/TODO_BECMI_Spell_Material_Staging_Basic.md",
    # "_todo/BECMI/TODO_BECMI_Spell_Material_Staging_Expert.md",
    # "_todo/BECMI/TODO_BECMI_Spell_Material_Staging_Companion.md",
    # "_todo/BECMI/TODO_BECMI_Spell_Material_Staging_Master.md",
    # "_todo/BECMI/TODO_BECMI_Spell_Material_Staging_Immortals.md",
    # "_todo/BECMI/TODO_BECMI_Spell_Material_Staging_Rules_Cyclopedia.md",
]

STRAIGHT = "\u0027"   # '  ASCII apostrophe / straight single quote
CURLY_R  = "\u2019"   # '  RIGHT SINGLE QUOTATION MARK (typographic apostrophe)


def fix_fences(text: str) -> tuple[str, int]:
    """
    Replace U+0027 with U+2019 *only* inside ```...``` code fences,
    and only for apostrophes that follow a letter (prose/possessive use),
    e.g. "user's", "weapon's", "it's".

    Apostrophes following a digit (measurement marks like 10', 60', 30')
    are left as U+0027.

    Fence detection uses separate open/close patterns so that a stray bare
    ``` line inside extracted content does not accidentally reopen or close
    the current fence context.
      - Opening:  line matches ```<non-whitespace> (has a language/id tag)
      - Closing:  line is bare ``` (optional trailing whitespace only)

    Returns (modified_text, change_count).
    """
    OPENING_FENCE = re.compile(r"^\s*```\S")    # ```text, ```python, etc.
    CLOSING_FENCE = re.compile(r"^\s*```\s*$")  # bare ```
    PROSE_APOS = re.compile(r"(?<=[a-zA-Z])'")  # apostrophe after a letter only

    lines = text.splitlines(keepends=True)
    result: list[str] = []
    in_fence = False
    total_changes = 0

    for line in lines:
        if OPENING_FENCE.match(line):
            in_fence = True
            result.append(line)
            continue
        if CLOSING_FENCE.match(line):
            in_fence = False
            result.append(line)
            continue

        if in_fence and STRAIGHT in line:
            matches = PROSE_APOS.findall(line)
            if matches:
                fixed = PROSE_APOS.sub(CURLY_R, line)
                total_changes += len(matches)
                result.append(fixed)
            else:
                result.append(line)
        else:
            result.append(line)

    return "".join(result), total_changes


def main() -> None:
    dry_run = "--dry-run" in sys.argv
    # Last non-flag argument is root, otherwise cwd
    args = [a for a in sys.argv[1:] if not a.startswith("-")]
    root = args[-1] if args else "."

    summary: list[tuple[str, int]] = []

    for rel_path in TARGET_FILES:
        full_path = os.path.join(root, rel_path)
        if not os.path.isfile(full_path):
            print(f"  SKIP (not found): {rel_path}")
            continue

        with open(full_path, encoding="utf-8") as fh:
            original = fh.read()

        fixed, n = fix_fences(original)

        if n == 0:
            print(f"  clean  (0 changes): {rel_path}")
            continue

        summary.append((rel_path, n))
        tag = "[dry-run]" if dry_run else "[fixed]  "
        print(f"  {tag} {n:5d}  {rel_path}")

        if not dry_run:
            with open(full_path, "w", encoding="utf-8") as fh:
                fh.write(fixed)

    total = sum(n for _, n in summary)
    action = "Would fix" if dry_run else "Fixed"
    print(f"\n{action} {total} apostrophe(s) across {len(summary)} file(s).")


if __name__ == "__main__":
    main()
