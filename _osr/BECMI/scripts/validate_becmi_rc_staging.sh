#!/usr/bin/env bash
set -euo pipefail

ROOT='/home/joshu/Synthetic-Dream-Machine'
TARGET="$ROOT/_todo/BECMI/TODO_BECMI_Spell_Material_Staging_Rules_Cyclopedia.md"

fail() {
  printf 'FAIL: %s\n' "$1" >&2
  exit 1
}

require_regex() {
  local pattern="$1"
  local label="$2"
  if ! rg -q --multiline "$pattern" "$TARGET"; then
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

[ -f "$TARGET" ] || fail "target file not found: $TARGET"

require_regex '^### Chapter 3: Spells and Spellcasting$' 'chapter 3 heading'
require_regex '^### Prismatic Wall Recovery Pass \(RC page 60\)$' 'prismatic heading'
require_regex '^### Monster Spellcasters$' 'monster spellcasters heading'
require_regex '^### Scrolls$' 'scrolls heading'
require_regex '^### Spell Research$' 'spell research heading'
require_regex '^### Chapter 16 Item Description Catalog \(Potions, Wands/Staves/Rods, Rings, Miscellaneous Items, and Swords\)$' 'chapter 16 catalog heading'
require_regex 'Reversible Spells' 'chapter 3 prose witness'
require_regex 'Prismatic Wall Effects' 'prismatic table witness'
require_regex 'Maximum Spellcaster Ability Table' 'monster spellcaster table witness'
require_regex 'Magic-User Spell Choice' 'spell-adjacent doctrine witness'
require_regex '^Potions$' 'chapter 16 starting anchor'
require_regex '^Index to Spells$' 'index witness'

require_patterns_in_order \
  'rc top-level section ordering' \
  '^### Chapter 3: Spells and Spellcasting$' \
  '^### Prismatic Wall Recovery Pass \(RC page 60\)$' \
  '^### Monster Spellcasters$' \
  '^### Spell-Adjacent Procedures and DM Spell Doctrine$' \
  '^### Scrolls$' \
  '^### Spell Research$' \
  '^### Magic Item Enchantment, Recharging, and Item Damage Procedures$' \
  '^### Construct Enchantment and Magical Constructs$' \
  '^### Chapter 16 Item Description Catalog \(Potions, Wands/Staves/Rods, Rings, Miscellaneous Items, and Swords\)$'

require_patterns_in_order \
  'rc prismatic ordering' \
  '^### Prismatic Wall Recovery Pass \(RC page 60\)$' \
  'RC page 60 bbox-1' \
  'Prismatic Wall' \
  'RC page 60 bbox-2' \
  'nearest\nplane of existence|nearest plane of existence' \
  'RC page 60 bbox-3' \
  'Prismatic Wall Effects'

require_patterns_in_order \
  'rc chapter 16 ordering' \
  'Chapter 16 Item Description Catalog' \
  '^Potions$' \
  'Wands/Staves/Rods|Wands, Staves, and Rods' \
  '^Rings$' \
  'Miscellaneous Items' \
  '^Swords$'

printf 'PASS: RC staging validation succeeded (%s)\n' "$TARGET"
