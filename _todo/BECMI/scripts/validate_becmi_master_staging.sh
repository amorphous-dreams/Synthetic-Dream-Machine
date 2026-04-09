#!/usr/bin/env bash
set -euo pipefail

ROOT='/home/joshu/Synthetic-Dream-Machine'
TARGET="$ROOT/_todo/BECMI/TODO_BECMI_Spell_Material_Staging_Master.md"

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

require_regex '^### Anti-Magic Effects and Dispel Magic Procedures$' 'master procedures heading'
require_regex '^### Artifact Chapter Context and Witnesses$' 'artifact witness heading'
require_regex '^Anti-Magic Effects$' 'anti-magic anchor'
require_regex '^Dispel Magic$' 'dispel anchor'
require_regex 'touch dispel' 'touch-dispel witness'
require_regex 'Artifacts in the Game' 'artifact doctrine witness'
require_regex 'Creating Artifacts' 'artifact creation witness'
require_regex 'Magnitude of Artifact' 'artifact table witness'

require_patterns_in_order \
  'master procedures ordering' \
  'Anti-Magic Effects and Dispel Magic Procedures' \
  'Master procedures page 2: Anti-Magic Effects' \
  '^Anti-Magic Effects$' \
  'A-M Duration' \
  'Detailed Examples' \
  'Master procedures page 6: Dispel Magic' \
  '^Dispel Magic$' \
  'touch dispel' \
  'Effects on Items'

require_patterns_in_order \
  'master artifact witness ordering' \
  'Artifact Chapter Context and Witnesses' \
  'Using Artifacts in the Game' \
  'Artifact Powers' \
  'Creating Artifacts' \
  'Magnitude of Artifact'

require_regex 'DIAMOND ORB OF TYCHE\nThis item appears to be a crystal ball' 'diamond orb heading/body separation'
require_regex 'SHARD OF SAKKRAD[\s\S]*Suggested Powers \(PP 750\):[\s\S]*Luck 100[\s\S]*Activation: The shard is active when found\.[\s\S]*Use of Powers: A power is granted to the user[\s\S]*Suggested Handicaps \(4; #1 appears when the item is first used' 'shard power/activation/handicap continuity'
require_regex "Anti-Magic 100%, 10' radius emanating from the artifact" 'shard anti-magic penalty text'
if rg -q 'DIAMOND 0RB OF TYCHE|Luck 100   Activation|healingpower|Your Notes:DIAMOND ORB OF TYCHE|Hit Dice\.Source: Arabian folklore\.|Your Notes:[[:space:]]+B C|Your Notes:[[:space:]]+m m|Good Fortune\.FIERY BRAND OF MASAUWU' "$TARGET"; then
  fail "master artifact OCR regression fragment still present"
fi
if rg -q '\bI t has\b|Turn as C L 36|Turn as C L 24|^C 3 Open Locks|open locks attempts '"'"'|sword ofslicing|ofcharlemagne|Angurvadal \(Stream of Anguish\) wa$' "$TARGET"; then
  fail "master residual OCR texture regression still present"
fi

printf 'PASS: Master staging validation succeeded (%s)\n' "$TARGET"
