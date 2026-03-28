#!/usr/bin/env bash
set -euo pipefail

ROOT='/home/joshu/Synthetic-Dream-Machine'
TARGET="$ROOT/_todo/TODO_BECMI_Spell_Material_Staging_Expert.md"

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

require_not_regex() {
  local pattern="$1"
  local label="$2"
  if rg -q --multiline "$pattern" "$TARGET"; then
    fail "unexpected ${label}"
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

require_regex '^### Clerical and Magic-User Spell Expansions$' 'spell expansion heading'
require_regex '^### Magic Support Infrastructure$' 'magic support heading'
require_regex '^### Research and Lost Spell Books$' 'research heading'
require_regex '^### Scrolls, Rings, Wands, Staves, Rods, and Spell-Adjacent Treasure Text$' 'treasure heading'
require_regex 'Research \(Magic Spells and Item' 'research doctrine anchor'
require_regex 'Spell Books, Lost' 'lost spell book witness'
require_regex 'e\. SCROLLS|e\. Scrolls' 'scroll subsection'
require_regex 'f\. RINGS|f\. Rings' 'ring subsection'
require_regex 'g\. WANDS, STAVES, AND RODS|g\. Wands, Staves, and Rods' 'wand/staff/rod subsection'
require_regex 'h\. MISCELLANEOUS MAGIC ITEMS|h\. Miscellaneous Magic Items' 'misc item subsection'
require_regex 'Mirror of Life Trapping|Scarab of Protection' 'page-65 misc item witness'
require_regex 'Wand of Negation' 'wand doctrine witness'
require_regex 'Spell Turning' 'ring doctrine witness'
require_regex '^Dungeon    Silver         Gold             Gems      Jewelry    Magic Items$' 'unguarded treasure table header'
require_regex '^1d20    Score   Communication   Powers\s+Languages$' 'intelligent sword intelligence table header'
require_regex '^User'\''s Alignment   Sword'\''s Alignment   Damage per round$' 'intelligent sword alignment table header'
require_regex '^d%     Primary Powers$' 'primary powers table header'
require_regex '^d%     Extraordinary Powers$' 'extraordinary powers table header'
require_regex '^Level        Effect$' 'heroism table header'
require_regex '^11\+          No Effect$' 'normalized heroism final row'

require_patterns_in_order \
  'expert section page order' \
  'Clerical and Magic-User Spell Expansions' \
  'Magic Support Infrastructure' \
  'Research and Lost Spell Books' \
  'Scrolls, Rings, Wands, Staves, Rods, and Spell-Adjacent Treasure Text'

require_patterns_in_order \
  'expert research ordering' \
  'Research and Lost Spell Books' \
  'Research' \
  'Examples' \
  'Ring x-ray' \
  'Spell Books, Lost'

require_regex 'Ring spell storing\s+10,000 gp\s+1 month per spell level' 'normalized research examples tail row'

require_patterns_in_order \
  'expert treasure ordering' \
  'Scrolls, Rings, Wands, Staves, Rods, and Spell-Adjacent Treasure Text' \
  'e. SCROLLS' \
  'f. RINGS' \
  'g. WANDS, STAVES, AND RODS' \
  'h. MISCELLANEOUS MAGIC ITEMS'

heroism_count=$(rg -n '^Level        Effect$' "$TARGET" | wc -l | tr -d ' ')
if [ "$heroism_count" -lt 2 ]; then
  fail "expected at least 2 normalized Heroism table headers, found $heroism_count"
fi

require_not_regex '^Extraordinary Powers$' 'orphan Extraordinary Powers label'
require_not_regex 'Level\s+Effect\n\nNormal Man Becomes a 4th level fighter' 'flattened heroism block'
require_not_regex '^Normal Man Becomes a 4th level fighter$' 'flattened heroism row'
require_not_regex '^11\s+\+\s+No Effect$' 'split 11+ heroism row'
require_not_regex 'Ring spell\s+storing\s+10,000 gp\s+spell level' 'orphaned ring spell storing row'

range_count=$(rg -c '^Range:' "$TARGET" || true)
if [ "$range_count" -lt 35 ]; then
  fail "expected at least 35 Range lines, found $range_count"
fi

printf 'PASS: Expert staging validation succeeded (%s)\n' "$TARGET"
