#!/usr/bin/env bash
set -euo pipefail

ROOT='/home/joshu/Synthetic-Dream-Machine'
SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
TARGET="$ROOT/_todo/BECMI/TODO_BECMI_Spell_Material_Staging_Immortals.md"

BECMI_STAGING_HELPERS_ONLY=1 source "$SCRIPT_DIR/build_becmi_spell_staging.sh"

[ -f "$TARGET" ] || fail_staging_validation "target file not found: $TARGET"

assert_file_contains "$TARGET" '^### Sections 1-2: Power Point Conversion, Rank Progression, Sphere Choice, and Recovery Context$' 'Immortals Sections 1-2 doctrine block heading is missing'
assert_file_contains "$TARGET" '^### Section 3: Immortal Magic$' 'Immortals Section 3 heading is missing'

assert_section_contains "$TARGET" '### Sections 1-2: Power Point Conversion, Rank Progression, Sphere Choice, and Recovery Context' '### Section 3: Immortal Magic' 'Each 10,000 XP are worth 1 PP' 'Immortals PP conversion doctrine is missing'
assert_section_contains "$TARGET" '### Sections 1-2: Power Point Conversion, Rank Progression, Sphere Choice, and Recovery Context' '### Section 3: Immortal Magic' 'permanent PP total' 'Immortals PP bookkeeping flow is truncated'
assert_section_contains "$TARGET" '### Sections 1-2: Power Point Conversion, Rank Progression, Sphere Choice, and Recovery Context' '### Section 3: Immortal Magic' 'higher ranks of Immortals in ascending order' 'Immortals rank frame is missing'
assert_section_contains "$TARGET" '### Sections 1-2: Power Point Conversion, Rank Progression, Sphere Choice, and Recovery Context' '### Section 3: Immortal Magic' 'Rank\s+Per Point\s+Score' 'Immortals ability-cost table header is malformed or missing'
assert_section_contains "$TARGET" '### Sections 1-2: Power Point Conversion, Rank Progression, Sphere Choice, and Recovery Context' '### Section 3: Immortal Magic' 'Hierarch\s+160 PP' 'Immortals ability-cost table is truncated before Hierarch'
assert_section_contains "$TARGET" '### Sections 1-2: Power Point Conversion, Rank Progression, Sphere Choice, and Recovery Context' '### Section 3: Immortal Magic' 'Greater Talent must be raised to the maxi' 'Immortals GT advancement gate is missing'
assert_section_contains "$TARGET" '### Sections 1-2: Power Point Conversion, Rank Progression, Sphere Choice, and Recovery Context' '### Section 3: Immortal Magic' '^Spheres$' 'Immortals sphere-choice frame is missing'
assert_section_contains "$TARGET" '### Sections 1-2: Power Point Conversion, Rank Progression, Sphere Choice, and Recovery Context' '### Section 3: Immortal Magic' '"bias" of the Plane—hostile, neutral, or' 'Immortals bias doctrine is missing'
assert_section_contains "$TARGET" '### Sections 1-2: Power Point Conversion, Rank Progression, Sphere Choice, and Recovery Context' '### Section 3: Immortal Magic' '^Power Point Recovery$' 'Immortals Power Point recovery doctrine is missing'

assert_section_contains "$TARGET" '### Section 3: Immortal Magic' '' 'Sphere Factors for Magical Effects' 'Immortals sphere-factor matrix heading is missing'
assert_section_contains "$TARGET" '### Section 3: Immortal Magic' '' 'Force Field' 'Immortals sample-cost table is truncated before Force Field'
assert_section_contains "$TARGET" '### Section 3: Immortal Magic' '' 'Remove Fear' 'Immortals sample-cost table is truncated before Remove Fear'
assert_section_contains "$TARGET" '### Section 3: Immortal Magic' '' '^Changing Range and Duration$' 'Immortals range/duration doctrine is missing'
assert_section_contains "$TARGET" '### Section 3: Immortal Magic' '' '^Conjuring and Summoning$' 'Immortals conjuring/summoning doctrine is missing'
assert_section_contains "$TARGET" '### Section 3: Immortal Magic' '' '^Damage$' 'Immortals damage doctrine is missing'
assert_section_contains "$TARGET" '### Section 3: Immortal Magic' '' 'Average Results of Common Dice Rolls' 'Immortals common-dice table heading is malformed'
assert_section_contains "$TARGET" '### Section 3: Immortal Magic' '' 'Durations of Mental Effects' 'Immortals mental-effects duration table heading is malformed'
assert_section_contains "$TARGET" '### Section 3: Immortal Magic' '' '^Undead Curing$' 'Immortals undead/Entropy interaction doctrine is missing'
assert_section_contains "$TARGET" '### Section 3: Immortal Magic' '' 'Contact Outer Plane: This produces an' 'Immortals Contact Outer Plane override is missing'
assert_section_contains "$TARGET" '### Section 3: Immortal Magic' '' 'Invisible Stalker: See General Notes \(Conjuring and Summoning\)\.' 'Immortals Invisible Stalker override is malformed'
assert_section_contains "$TARGET" '### Section 3: Immortal Magic' '' '^Feeblemind: See General Notes \(Mental Effects\)\.$' 'Immortals Feeblemind override is missing'
assert_section_contains "$TARGET" '### Section 3: Immortal Magic' '' '^Life Trapping: This effect can only be$' 'Immortals Life Trapping override is missing'
assert_section_contains "$TARGET" '### Section 3: Immortal Magic' '' 'Maze: This has no effect whatsoever if used' 'Immortals effect-explanation flow is truncated before Maze'
assert_section_contains "$TARGET" '### Section 3: Immortal Magic' '' 'Pass-Wall:' 'Immortals effect-explanation flow is truncated before the late-alphabet continuation'
assert_section_contains "$TARGET" '### Section 3: Immortal Magic' '' 'Shapechange:' 'Immortals N-Z override recovery is missing Shapechange'
assert_section_contains "$TARGET" '### Section 3: Immortal Magic' '' 'Symbol:' 'Immortals N-Z override recovery is missing Symbol'
assert_section_contains "$TARGET" '### Section 3: Immortal Magic' '' 'Teleport:' 'Immortals N-Z override recovery is missing Teleport'
assert_section_contains "$TARGET" '### Section 3: Immortal Magic' '' 'Web:' 'Immortals N-Z override recovery is missing Web'
assert_section_contains "$TARGET" '### Section 3: Immortal Magic' '' 'Wish:' 'Immortals N-Z override recovery is missing Wish'

assert_section_not_contains "$TARGET" '### Section 3: Immortal Magic' '' 'Section 4:' 'Immortals Section 3 extraction bled into Section 4'
assert_file_not_contains "$TARGET" '^\[Immortals page' 'Immortals output still contains inline page markers'
assert_file_not_contains "$TARGET" 'previously limited to "self can be delivered' 'Immortals cleanup left a broken self-only clause fragment'
assert_file_not_contains "$TARGET" '\b1dl2\b' 'Immortals cleanup left malformed 1d12 OCR output'
assert_file_not_contains "$TARGET" 'sim-\n\s*ilar effect' 'Immortals cleanup left a broken continuation join in Insect Swarm'

printf 'PASS: Immortals staging validation succeeded (%s)\n' "$TARGET"
