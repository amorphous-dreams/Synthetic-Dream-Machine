#!/usr/bin/env bash
set -euo pipefail

ROOT='/home/joshu/Synthetic-Dream-Machine'
SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
TARGET="$ROOT/_todo/TODO_BECMI_Spell_Material_Staging_Companion.md"

BECMI_STAGING_HELPERS_ONLY=1 source "$SCRIPT_DIR/build_becmi_spell_staging.sh"

[ -f "$TARGET" ] || fail_staging_validation "target file not found: $TARGET"

assert_heading_count "$TARGET" 'High-Level Cleric, Druid, and Magic-User Spell Material' 1 'Companion staging duplicated the high-level spell section heading'
assert_heading_count "$TARGET" 'Spell-Adjacent Rings, Rods, and Miscellaneous Magic Items' 1 'Companion staging duplicated the spell-adjacent item section heading'
assert_heading_count "$TARGET" 'Demi-Human Crafts and Poison' 1 'Companion staging duplicated the demi-human crafts/poison section heading'

assert_section_contains "$TARGET" '[Companion pages 13-14: high-level cleric spell material]' '[Companion pages 15-17: druid transition, philosophy, and spell material]' 'Raise Dead Fully\*' 'cleric flow is missing Companion seventh-level spell evidence'
assert_section_contains "$TARGET" '[Companion pages 15-17: druid transition, philosophy, and spell material]' '[Companion pages 22-28: magic-user 5th-9th level spell material]' 'Druid Philosophy' 'druid flow is missing the philosophy transition block'
assert_section_not_contains "$TARGET" '[Companion pages 15-17: druid transition, philosophy, and spell material]' '[Companion pages 22-28: magic-user 5th-9th level spell material]' '^Fighter$' 'druid flow is bleeding into the adjacent Fighter class section'

assert_file_contains "$TARGET" 'Contact Outer Plane[\s\S]*Range: 0 \(magic-user only\)' 'Companion recovery pass lost Contact Outer Plane spell body'
assert_file_contains "$TARGET" 'Dissolve\*[\s\S]*Range: 120' 'Companion recovery pass lost Dissolve spell body'
assert_file_contains "$TARGET" 'Feeblemind[\s\S]*Range: 240' 'Companion recovery pass lost Feeblemind spell body'
assert_file_contains "$TARGET" 'Telekinesis[\s\S]*Range: 120' 'Companion recovery pass lost Telekinesis spell body'
assert_file_contains "$TARGET" 'Move Earth[\s\S]*Range: 240' 'Companion recovery pass lost Move Earth spell body'
assert_file_contains "$TARGET" 'Reincarnation[\s\S]*Range: 10' 'Companion recovery pass lost Reincarnation spell body'
assert_file_contains "$TARGET" 'Wall of Iron[\s\S]*Range: 120' 'Companion recovery pass lost Wall of Iron spell body'
assert_file_contains "$TARGET" 'Weather Control[\s\S]*Range: 0 \(magic-user only\)' 'Companion recovery pass lost Weather Control spell body'
assert_file_contains "$TARGET" 'Create Normal Monsters[\s\S]*Range: 30' 'Companion recovery pass lost Create Normal Monsters spell body'
assert_file_contains "$TARGET" 'Lore[\s\S]*Range: 0 \(magic-user only\)' 'Companion recovery pass lost Lore spell body'
assert_file_contains "$TARGET" 'Mass Invisibility\*[\s\S]*Range: 240' 'Companion recovery pass lost Mass Invisibility spell body'

assert_section_contains "$TARGET" '[Companion pages 22-28: magic-user 5th-9th level spell material]' '```' 'Contact Outer Plane' 'magic-user flow is missing the Companion Contact Outer Plane body'
assert_section_contains "$TARGET" '[Companion pages 22-28: magic-user 5th-9th level spell material]' '```' '^Gate\*$' 'magic-user flow is missing the Companion Gate heading'

assert_section_contains "$TARGET" '[Companion procedures: buying and selling magic items]' '[Companion procedures: damage to magic items]' 'Armor[[:space:]]+10,000 to 150,000 gp' 'buying/selling procedure lost the Companion price table'
assert_section_not_contains "$TARGET" '[Companion procedures: buying and selling magic items]' '[Companion procedures: damage to magic items]' 'Planning and Placing Treasure' 'buying/selling procedure is bleeding into the next treasure-planning section'
assert_section_contains "$TARGET" '[Companion procedures: damage to magic items]' '[Companion treasure tables: magic-item tables]' 'any potion or scroll as a \+1 item;' 'damage-to-magic-items procedure lost the item-strength bands'
assert_section_not_contains "$TARGET" '[Companion procedures: damage to magic items]' '[Companion treasure tables: magic-item tables]' 'Demi-Human Crafts' 'damage-to-magic-items procedure is bleeding into demi-human crafts'

assert_section_contains "$TARGET" '[Companion procedures: demi-human crafts]' '[Companion procedures: poison]' 'Dwarf: By using the Forge of Power' 'demi-human crafts flow is missing the dwarf forging procedure'
assert_section_not_contains "$TARGET" '[Companion procedures: demi-human crafts]' '[Companion procedures: poison]' 'Hit points for demi-humans are limited by|Hit Points \(Maximum\)' 'demi-human crafts flow is bleeding into the hit-points-maximum section'
assert_section_not_contains "$TARGET" '[Companion procedures: demi-human crafts]' '[Companion procedures: poison]' 'Aging|Damage To Magic Items|Constructs' 'demi-human crafts flow is still carrying pre-section procedure bleed'

assert_section_contains "$TARGET" '[Companion procedures: poison]' '```' '^Poison$' 'procedures flow is missing the Companion Poison section heading'
assert_section_contains "$TARGET" '[Companion procedures: poison]' '```' 'The use of poison is evil, and may cause' 'poison flow is truncated before its alignment/legal guidance'
assert_section_not_contains "$TARGET" '[Companion procedures: poison]' '```' 'Hit Roll Charts|HIT ROLLS: ALL DEMI-HUMANS' 'poison flow is bleeding into the hit-roll tables'

assert_section_contains "$TARGET" '[Companion treasure tables: magic-item tables' '[Companion treasure descriptions: scrolls, wands/staves/rods, rings, and miscellaneous items]' '01-70[[:space:]]+Magic-User|71-95[[:space:]]+Cleric|96-00[[:space:]]+Druid' 'spell-scroll type table collapsed or lost its probability rows'
assert_section_contains "$TARGET" '[Companion treasure descriptions: scrolls, wands/staves/rods, rings, and miscellaneous items]' '```' '1-4[[:space:]]+1st or 2nd level spells' 'spell-catching capacity table collapsed in the item-description flow'
assert_section_contains "$TARGET" '[Companion treasure descriptions: scrolls, wands/staves/rods, rings, and miscellaneous items]' '```' 'Muzzle of Training: This item is a device' 'miscellaneous-item description flow is truncated before Muzzle of Training'
assert_section_contains "$TARGET" '[Companion treasure descriptions: scrolls, wands/staves/rods, rings, and miscellaneous items]' '```' 'monster with a bite attack\. It will magically' 'miscellaneous-item description flow lost the Muzzle of Training continuation'

assert_file_not_contains "$TARGET" "spdl|loo'|5'x?lO'x?l'|3dlO|Typeof" 'Companion staging still contains known OCR/truncation regressions after cleanup'

printf 'PASS: Companion staging validation succeeded (%s)\n' "$TARGET"
