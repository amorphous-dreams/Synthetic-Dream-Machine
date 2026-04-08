#!/usr/bin/env bash
set -euo pipefail

ROOT='/home/joshu/Synthetic-Dream-Machine'
TARGET="$ROOT/_todo/TODO_BECMI_Spell_Material_Staging_Basic.md"

fail() {
  printf 'FAIL: %s\n' "$1" >&2
  exit 1
}

require_in_file() {
  local needle="$1"
  local label="$2"
  if ! grep -Fq "$needle" "$TARGET"; then
    fail "missing ${label}"
  fi
}

require_regex() {
  local pattern="$1"
  local label="$2"
  if ! rg -q "$pattern" "$TARGET"; then
    fail "missing ${label}"
  fi
}

require_patterns_in_order() {
  local label="$1"
  shift
  python3 - "$TARGET" "$label" "$@" <<'PY'
import re
import sys

path = sys.argv[1]
label = sys.argv[2]
patterns = sys.argv[3:]

with open(path, "r", encoding="utf-8") as fh:
    text = fh.read()

pos = 0
for pattern in patterns:
    match = re.search(pattern, text[pos:], re.MULTILINE)
    if not match:
        print(f"FAIL: {label} (missing or out of order: {pattern})", file=sys.stderr)
        sys.exit(1)
    pos += match.end()
PY
}

if [ ! -f "$TARGET" ]; then
  fail "target file not found: $TARGET"
fi

# Required major sections
require_in_file '### Cleric Rules, Turning, and First-Level Spell Procedures' 'cleric procedures heading'
require_in_file '### Spell Lists and Basic Spell Descriptions' 'spell list heading'
require_in_file '### Higher Level Spells, Magic-User Spell Allocation, and Lost Spell Books' 'higher-level procedures heading'
require_in_file '### Magic Item Identification, Use Model, and Charge Doctrine' 'item-operation doctrine heading'
require_in_file '### Scrolls and Spell-Adjacent Treasure Text' 'scroll procedures heading'

# Required anchors and procedures
require_in_file 'CLERIC TURNING UNDEAD TABLE' 'Turning Undead table marker'
require_in_file 'FIRST LEVEL CLERIC SPELLS' 'first-level cleric list'
require_in_file 'SECOND LEVEL' 'second-level heading'
require_in_file 'Giving Magic-Users Spells' 'starting spell procedure'
require_in_file 'Identifying Magic Items' 'item identification doctrine'
require_in_file 'Using Magic Items' 'item use procedure doctrine'
require_in_file 'Charges in Magic Items' 'item charge doctrine'
require_in_file 'Holy Water:' 'holy water consumable doctrine'
require_in_file 'e. Scrolls' 'scrolls subsection'
require_in_file 'f. Rings' 'rings subsection'
require_in_file 'g. Wands, Staves, and Rods' 'wands/staves/rods subsection'
require_in_file 'h. Miscellaneous Magic Items' 'misc magic items subsection'
require_in_file 'Rope of Climbing:' 'Rope of Climbing heading'
require_in_file "strong rope will climb in any direction" 'Rope of Climbing continuation witness'

# Order and continuity checks
require_patterns_in_order \
  'basic spell list ordering' \
  'Magic-User Spells: First Level' \
  'Magic Missile' \
  'Magic-User Spells: Second Level' \
  'Wizard Lock'

require_patterns_in_order \
  'basic higher-level procedure ordering' \
  'Higher Level Spells, Magic-User Spell Allocation, and Lost Spell Books' \
  'Giving Magic-Users Spells' \
  "If a magic-user's book is lost"

require_patterns_in_order \
  'basic item-operation ordering' \
  'Magic Item Identification, Use Model, and Charge Doctrine' \
  'Identifying Magic Items' \
  'Using Magic Items' \
  'Charges in Magic Items' \
  'Holy Water:'

require_patterns_in_order \
  'basic scroll wrapper ordering' \
  'Scrolls and Spell-Adjacent Treasure Text' \
  'e. Scrolls' \
  'f. Rings' \
  'g. Wands, Staves, and Rods' \
  'h. Miscellaneous Magic Items'

# Coverage sanity checks
range_count=$(rg -c '^Range:' "$TARGET" || true)
if [ "$range_count" -lt 25 ]; then
  fail "expected at least 25 Range lines, found $range_count"
fi

effect_count=$(rg -c '^Effect:' "$TARGET" || true)
if [ "$effect_count" -lt 25 ]; then
  fail "expected at least 25 Effect lines, found $effect_count"
fi

spell_anchor_count=$(rg -c 'Cure Light Wounds|Magic Missile|Invisibility|Dispel Magic|Fire Ball|Fly' "$TARGET" || true)
if [ "$spell_anchor_count" -lt 6 ]; then
  fail "expected core spell anchors to appear at least 6 times, found $spell_anchor_count"
fi

printf 'PASS: Basic staging validation succeeded (%s)\n' "$TARGET"
