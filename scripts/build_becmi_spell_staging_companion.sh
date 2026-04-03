#!/usr/bin/env bash
set -euo pipefail

ROOT='/home/joshu/Synthetic-Dream-Machine'
SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)

BECMI_STAGING_HELPERS_ONLY=1 source "$SCRIPT_DIR/build_becmi_spell_staging.sh"

TMPDIR=$(mktemp -d)
trap 'rm -rf "$TMPDIR"' EXIT

COMP_TXT="$TMPDIR/companion.txt"
COMP_PDF="$ROOT/_becmi/TSR 1013 - Set 3 Companion Set.pdf"
COMP_OUT="$ROOT/_todo/TODO_BECMI_Spell_Material_Staging_Companion.md"

companion_crop_layout() {
  local page="$1"
  local x="$2"
  local y="$3"
  local w="$4"
  local h="$5"
  pdftotext -layout -nodiag -nopgbrk -f "$page" -l "$page" -x "$x" -y "$y" -W "$w" -H "$h" "$COMP_PDF" - 2>/dev/null
}

companion_spell_block_named() {
  local label="$1"
  local note="$2"
  local pdf="$3"

  printf '### %s\n\n' "$label" >> "$OUT"
  printf -- '- Extraction note: %s\n\n' "$note" >> "$OUT"
  printf '```text\n' >> "$OUT"
  printf '[Companion pages 13-14: high-level cleric spell material]\n' >> "$OUT"
  render_tsv_cols_pages_anchored_until "$pdf" 13 14 '185,370' 'FIFTH LEVEL CLERIC SPELLS' 'Druid' >> "$OUT"
  printf '\n[Companion pages 15-17: druid transition, philosophy, and spell material]\n' >> "$OUT"
  render_tsv_cols_pages_anchored_until "$pdf" 15 17 '185,370' 'Druid' 'Fighter' \
    | awk 'start || $0 == "Druid" { start = 1; print }' >> "$OUT"
  printf '\n[Companion pages 22-24: layout-column recovery for fifth- through seventh-level magic-user spell bodies]\n' >> "$OUT"
  {
    companion_crop_layout 22 195 145 192 610 \
      | awk 'started || /Fifth Level Magic-user Spells/ { started = 1; print }'
    printf '\n'
    companion_crop_layout 22 390 145 192 610 \
      | awk 'started || /Contact Outer Plane/ { started = 1; print }'
    printf '\n'
    companion_crop_layout 23 0 70 192 690 \
      | awk 'started || /Move Earth/ { started = 1; print }'
    printf '\n'
    companion_crop_layout 23 195 145 192 610 \
      | awk 'started || /Wall of Iron/ { started = 1; print }'
    printf '\n'
    companion_crop_layout 23 390 145 192 610 \
      | awk 'started || /Seventh Level Magic-user Spells/ { started = 1; print }'
    printf '\n'
    companion_crop_layout 24 0 70 192 700 \
      | awk 'started || /Create Normal Monsters/ { started = 1; print }'
    printf '\n'
    companion_crop_layout 24 195 145 192 610 \
      | awk 'started || /Lore/ { started = 1; print }'
    printf '\n'
    companion_crop_layout 24 390 145 192 610 \
      | awk 'started || /Mass Invisibility\*/ { started = 1; print }'
  } >> "$OUT"
  printf '\n[Companion pages 22-28: magic-user 5th-9th level spell material]\n' >> "$OUT"
  render_tsv_cols_pages_anchored "$pdf" 22 28 '185,370' 'FIFTH LEVEL MAGIC-USER SPELLS' >> "$OUT"
  printf '\n```\n\n' >> "$OUT"
}

companion_magic_items_block_named() {
  local label="$1"
  local note="$2"
  local pdf="$3"

  printf '### %s\n\n' "$label" >> "$OUT"
  printf -- '- Extraction note: %s\n\n' "$note" >> "$OUT"
  printf '```text\n' >> "$OUT"
  printf '[Companion procedures: buying and selling magic items]\n' >> "$OUT"
  render_tsv_cols_pages_anchored_until "$pdf" 64 65 '185,370' 'B. Buying and Selling Magic Items' 'Planning and Placing Treasure' >> "$OUT"
  printf '\n[Companion procedures: damage to magic items]\n' >> "$OUT"
  render_tsv_cols_pages_anchored_until "$pdf" 59 60 '185,370' 'Damage To Magic Items' 'Demi-Human Crafts' >> "$OUT"
  printf '\n[Companion treasure tables: magic-item tables]\n' >> "$OUT"
  cat >> "$OUT" <<'TXT'
3b. Types of Jewelry
Value (in gp): Common 100-3,000; Uncommon 4,000-10,000; Rare 15,000-50,000

Roll  Common         Uncommon       Rare
1     Anklet         Armband        Amulet
2     Beads          Belt           Crown
3     Bracelet       Collar         Diadem
4     Brooch         Earring        Medallion
5     Buckle         Four-leaf Clover Orb
6     Cameo          Heart          Ring
7     Chain          Leaf           Scarab
8     Clasp          Necklace       Scepter
9     Locket         Pendant        Talisman
10    Pin            Rabbit's Foot  Tiara

5. Potion

d%     Type of Potion
01-02  Agility
03     Animal Control
04-06  Antidote
07-08  Blending
09-10  Bug Repellant
11-12  Clairaudience
13-14  Clairvoyance
15-16  Climbing
17-18  Defense
19-20  Diminution (B)
21-24  Delusion (X)
25     Dragon Control
26-27  Dreamspeech
28     Elasticity
29-30  Elemental Form
31-32  ESP (B)
33     Ethereality
34-36  Fire Resistance (X)
37-39  Flying (X)
40-41  Fortitude
42     Freedom
43-45  Gaseous Form (B)
46     Giant Control (X)
47-49  Giant Strength (X)
50-51  Growth (B)
52-57  Healing (B)
58-60  Heroism (X)
61     Human Control (X)
62-64  Invisibility (B)
65-66  Invulnerability (X)
67-68  Levitation (B)
69-70  Longevity (X)
71     Luck
72     Merging
73-74  Plant Control (X)
75-77  Poison (B)
78-80  Polymorph Self (X)
81-82  Sight
83-84  Speech
85-88  Speed (X)
89-90  Strength
91-93  Super-healing
94-96  Swimming
97     Treasure Finding (X)
98     Undead Control (X)
99-00  Water Breathing

6. Scroll

d%     Type of Scroll
01-03  Communication
04-05  Creation
06-13  Curse (occurs when read; B)*
14     Delay (S)
15-17  Equipment
18-19  Illumination
20-21  Mages (S)
22-25  Map to Normal treasure (B)'
26-28  Map to magical treasure (B)*
29-30  Map to combined treasure (X)'
31     Map to special treasure (X)'
32-34  Mapping
35-36  Portals
37-42  Protection from Elementals (X)
43-50  Protection from Lycanthropes (B)
51-54  Protection from Magic (X)
55-61  Protection from Undead (B)
62-63  Questioning
64     Repetition (S)
65-66  Seeing
67-68  Shelter
69-71  Spell Catching
72-96  Spells (see below)*
97-98  Trapping
99-00  Truth

* More information is given in this set.

4. All Magic Items

d%     Use Table
01-25  5. Potion
26-37  6. Scroll
38-46  7. Wand, Staff, or Rod
47-52  8. Ring
53-62  9. Misc. Magic Item
63-72  10. Armor or Shield
73-83  11. Missile or Device
84-92  12. Sword
93-00  13. Misc. Weapon

SPELL SCROLLS

6a. Type of Scroll

d%     Type
01-70  Magic-User
71-95  Cleric
96-00  Druid

6b. Level of Spell

Spell Level  Cleric or Druid  Magic-User
1            01-34            01-28
2            35-58            29-49
3            59-76            50-64
4            77-88            65-75
5            89-95            76-84
6            96-99            85-91
7            00               92-96
8            --               97-99
9            --               00

Roll for only one type per scroll; then find the level of each spell separately.

7. Wand, Staff, or Rod

d%     Type of Wand, Staff, or Rod
01-05  Wand of Cold (M) (X)
06-10  Wand of Enemy Detection (M) (B)
11-14  Wand of Fear (M) (X)
15-19  Wand of Fire Balls (M) (X)
20-23  Wand of Illusion (M) (X)
24-28  Wand of Lightning Bolts (M) (X)
29-33  Wand of Magic Detection (M) (B)
34-38  Wand of Metal Detection (M) (X)
39-42  Wand of Negation (M) (X)
43-47  Wand of Paralyzation (M) (B)
48-52  Wand of Polymorphing (M) (X)
53-56  Wand of Secret Door Detection (M) (X)
57-60  Wand of Trap Detection (M) (X)
61     Staff of Commanding (S) (X)
62-63  Staff of Dispelling
64-66  Staff of the Druids (DR)
67-69  Staff of an Element (M)
70-71  Staff of Harming (C)
72-78  Staff of Healing (C) (B)
79     Staff of Power (M) (X)
80-82  Snake Staff (C) (B)
83-85  Staff of Striking (S) (X)
86-87  Staff of Withering (C) (X)
88     Staff of Wizardry (M) (X)
89-90  Rod of Cancellation (B)
91     Rod of Dominion
92     Rod of Health (C)
93-94  Rod of Inertia (N)
95     Rod of Parrying
96     Rod of Victory
97-99  Rod of Weaponry
00     Rod of the Wyrm

Charges:
Wand   3-30 (3d10)
Staff  2-40 (2d20)
Rod    no charges

8. Ring

d%     Type of Ring
01-02  Animal Control (B)
03-08  Delusion (X)
09     Djinni Summoning (X)
10-13  Ear Ring
14-17  Elemental Adaptation
18-23  Fire Resistance (B)
24-26  Holiness (C)
27     Human Control (X)
28-32  Invisibility (B)
33-35  Life Protection
36-38  Memory (S)
39-40  Plant Control (X)
41-45  Protection, +1
46-48  Protection, +2
49-50  Protection, +3
51     Protection, +4
52-55  Quickness
56     Regeneration (X)
57-59  Remedies
60-61  Safety
62-64  Seeing
65-67  Spell Eating
68-69  Spell Storing (X)
70-71  Spell Turning (X)
72-75  Survival
76-77  Telekinesis (X)
78-81  Truth
82-84  Truthfulness
85-86  Truthlessness
87-91  Water Walking (B)
92-96  Weakness (B)
97-98  Wishes
99-00  X-Ray Vision (X)

9. Miscellaneous Items

d%     Type of Miscellaneous Item
01-02  Amulet of Protection from Crystal Balls and ESP (X)
03-04  Bag of Devouring (B)
05-09  Bag of Holding (B)
10-12  Boat, Undersea
13-14  Boots of Levitation (X)
15-17  Boots of Speed (X)
18-19  Boots of Traveling and Leaping (X)
20     Bowl of Commanding Water Elementals (X)
21     Brazier of Commanding Fire Elementals (X)
22-23  Broom of Flying (X)
24     Censer of Controlling Air Elementals (X)
25-27  Chime of Time
28-29  Crystal Ball (M) (B)
30     Crystal Ball with Clairaudience (M) (X)
31     Crystal Ball with ESP (M) (X)
32-33  Displacer Cloak (X)
34     Drums of Panic (X)
35     Efreeti Bottle (X)
36-38  Eggs of Wonder
39-40  Elven Cloak (B)
41-42  Elven Boots (B)
43     Flying Carpet (X)
44-45  Gauntlets of Ogre Power (B)
46-47  Girdle of Giant Strength (X)
48-49  Helm of Alignment Changing (B)
50-51  Helm of Reading (X)
52     Helm of Telepathy (B)
53     Helm of Teleportation (M) (X)
54     Horn of Blasting (X)
55-57  Lamp of Long Burning
58-59  Lamp, Hurricane
60-61  Medallion of ESP, 30' range (B)
62     Medallion of ESP, 90' range (X)
63     Mirror of Life Trapping (X)
64-66  Muzzle of Training
67-68  Nail, Finger
69-71  Nail of Pointing
72-76  Ointment
77-79  Pouch of Security
80-82  Quill of Copying (S)
83-86  Rope of Climbing (B)
87-88  Scarab of Protection (X)
89-91  Slate of Identification (S)
92     Stone of Controlling Earth Elementals (X)
93-94  Talisman of Elemental Travel
95-97  Wheel of Floating
98     Wheel of Fortune
99-00  Wheel, Square
TXT
  printf '\n[Companion treasure descriptions: scrolls, wands/staves/rods, rings, and miscellaneous items]\n' >> "$OUT"
  render_tsv_cols_pages_anchored_until "$pdf" 86 93 '185,370' '6. Scrolls' '10. Armor and Shields' \
    | sed '/^Treasures$/d' >> "$OUT"
  printf '\n```\n\n' >> "$OUT"
}

companion_procedures_block_named() {
  local label="$1"
  local note="$2"
  local pdf="$3"

  printf '### %s\n\n' "$label" >> "$OUT"
  printf -- '- Extraction note: %s\n\n' "$note" >> "$OUT"
  printf '```text\n' >> "$OUT"
  printf '[Companion procedures: demi-human crafts]\n' >> "$OUT"
  render_tsv_col_pages_anchored_until "$pdf" 59 60 '185,370' 3 'Demi-Human Crafts' 'Hit points for demi-humans are limited by' >> "$OUT"
  printf '\n[Companion procedures: poison]\n' >> "$OUT"
  render_tsv_col_pages_anchored_until "$pdf" 60 61 '185,370' 3 'Poison' 'Hit Roll Charts' >> "$OUT"
  printf '\n```\n\n' >> "$OUT"
}

validate_companion_staging() {
  assert_section_contains "$COMP_OUT" '[Companion pages 13-14: high-level cleric spell material]' '[Companion pages 15-17: druid transition, philosophy, and spell material]' 'Raise Dead Fully\*' 'cleric flow is missing Companion seventh-level spell evidence'
  assert_section_contains "$COMP_OUT" '[Companion pages 15-17: druid transition, philosophy, and spell material]' '[Companion pages 22-28: magic-user 5th-9th level spell material]' 'Druid Philosophy' 'druid flow is missing the philosophy transition block'
  assert_section_not_contains "$COMP_OUT" '[Companion pages 15-17: druid transition, philosophy, and spell material]' '[Companion pages 22-28: magic-user 5th-9th level spell material]' '^Fighter$' 'druid flow is bleeding into the adjacent Fighter class section'
  assert_file_contains "$COMP_OUT" 'Contact Outer Plane[\s\S]*Range: 0 \(magic-user only\)' 'Companion recovery pass lost Contact Outer Plane spell body'
  assert_file_contains "$COMP_OUT" 'Dissolve\*[\s\S]*Range: 120' 'Companion recovery pass lost Dissolve spell body'
  assert_file_contains "$COMP_OUT" 'Feeblemind[\s\S]*Range: 240' 'Companion recovery pass lost Feeblemind spell body'
  assert_file_contains "$COMP_OUT" 'Telekinesis[\s\S]*Range: 120' 'Companion recovery pass lost Telekinesis spell body'
  assert_file_contains "$COMP_OUT" 'Move Earth[\s\S]*Range: 240' 'Companion recovery pass lost Move Earth spell body'
  assert_file_contains "$COMP_OUT" 'Reincarnation[\s\S]*Range: 10' 'Companion recovery pass lost Reincarnation spell body'
  assert_file_contains "$COMP_OUT" 'Wall of Iron[\s\S]*Range: 120' 'Companion recovery pass lost Wall of Iron spell body'
  assert_file_contains "$COMP_OUT" 'Weather Control[\s\S]*Range: 0 \(magic-user only\)' 'Companion recovery pass lost Weather Control spell body'
  assert_file_contains "$COMP_OUT" 'Create Normal Monsters[\s\S]*Range: 30' 'Companion recovery pass lost Create Normal Monsters spell body'
  assert_file_contains "$COMP_OUT" 'Lore[\s\S]*Range: 0 \(magic-user only\)' 'Companion recovery pass lost Lore spell body'
  assert_file_contains "$COMP_OUT" 'Mass Invisibility\*[\s\S]*Range: 240' 'Companion recovery pass lost Mass Invisibility spell body'
  assert_section_contains "$COMP_OUT" '[Companion pages 22-28: magic-user 5th-9th level spell material]' '```' 'Contact Outer Plane' 'magic-user flow is missing the Companion Contact Outer Plane body'
  assert_section_contains "$COMP_OUT" '[Companion pages 22-28: magic-user 5th-9th level spell material]' '```' '^Gate\*$' 'magic-user flow is missing the Companion Gate heading'
  assert_section_contains "$COMP_OUT" '[Companion procedures: buying and selling magic items]' '[Companion procedures: damage to magic items]' 'Armor[[:space:]]+10,000 to 150,000 gp' 'buying/selling procedure lost the Companion price table'
  assert_section_not_contains "$COMP_OUT" '[Companion procedures: buying and selling magic items]' '[Companion procedures: damage to magic items]' 'Planning and Placing Treasure' 'buying/selling procedure is bleeding into the next treasure-planning section'
  assert_section_contains "$COMP_OUT" '[Companion procedures: damage to magic items]' '[Companion treasure tables: magic-item tables]' 'any potion or scroll as a \+1 item;' 'damage-to-magic-items procedure lost the item-strength bands'
  assert_section_not_contains "$COMP_OUT" '[Companion procedures: damage to magic items]' '[Companion treasure tables: magic-item tables]' 'Demi-Human Crafts' 'damage-to-magic-items procedure is bleeding into demi-human crafts'
  assert_section_contains "$COMP_OUT" '[Companion procedures: demi-human crafts]' '[Companion procedures: poison]' 'Dwarf: By using the Forge of Power' 'demi-human crafts flow is missing the dwarf forging procedure'
  assert_section_not_contains "$COMP_OUT" '[Companion procedures: demi-human crafts]' '[Companion procedures: poison]' 'Hit points for demi-humans are limited by|Hit Points \(Maximum\)' 'demi-human crafts flow is bleeding into the hit-points-maximum section'
  assert_section_not_contains "$COMP_OUT" '[Companion procedures: demi-human crafts]' '[Companion procedures: poison]' 'Aging|Damage To Magic Items|Constructs' 'demi-human crafts flow is still carrying pre-section procedure bleed'
  assert_section_contains "$COMP_OUT" '[Companion procedures: poison]' '```' '^Poison$' 'procedures flow is missing the Companion Poison section heading'
  assert_section_contains "$COMP_OUT" '[Companion procedures: poison]' '```' 'The use of poison is evil, and may cause' 'poison flow is truncated before its alignment/legal guidance'
  assert_section_not_contains "$COMP_OUT" '[Companion procedures: poison]' '```' 'Hit Roll Charts|HIT ROLLS: ALL DEMI-HUMANS' 'poison flow is bleeding into the hit-roll tables'
  assert_section_contains "$COMP_OUT" '[Companion treasure tables: magic-item tables' '[Companion treasure descriptions: scrolls, wands/staves/rods, rings, and miscellaneous items]' '01-70[[:space:]]+Magic-User|71-95[[:space:]]+Cleric|96-00[[:space:]]+Druid' 'spell-scroll type table collapsed or lost its probability rows'
  assert_section_contains "$COMP_OUT" '[Companion treasure descriptions: scrolls, wands/staves/rods, rings, and miscellaneous items]' '```' '1-4[[:space:]]+1st or 2nd level spells' 'spell-catching capacity table collapsed in the item-description flow'
  assert_section_contains "$COMP_OUT" '[Companion treasure descriptions: scrolls, wands/staves/rods, rings, and miscellaneous items]' '```' 'Muzzle of Training: This item is a device' 'miscellaneous-item description flow is truncated before Muzzle of Training'
  assert_section_contains "$COMP_OUT" '[Companion treasure descriptions: scrolls, wands/staves/rods, rings, and miscellaneous items]' '```' 'monster with a bite attack\. It will magically' 'miscellaneous-item description flow lost the Muzzle of Training continuation'
  assert_file_not_contains "$COMP_OUT" "spdl|loo'|5'x?lO'x?l'|3dlO|Typeof" 'Companion staging still contains known OCR/truncation regressions after cleanup'
}

extract_pdf "$COMP_PDF" "$COMP_TXT"
OUT="$COMP_OUT"
write_header 'TODO: BECMI Spell Material Staging - Companion' 'TSR 1013 - Set 3 Companion Set.pdf'
companion_spell_block_named 'High-Level Cleric, Druid, and Magic-User Spell Material' 'section-aware Companion spell extraction using TSV coordinate reflow on the actual cleric, druid, and magic-user class pages, split so each spell block starts at its real section heading instead of earlier class spill.' "$COMP_PDF"
companion_magic_items_block_named 'Spell-Adjacent Rings, Rods, and Miscellaneous Magic Items' 'Companion treasure extraction split by content type: flow-first TSV reflow for buying/selling, item damage, and the scroll-through-miscellaneous-item prose descriptions; readable sequential formatting for the dense item tables; deterministic post-cleanup is limited to stable OCR and page-header repair after capture.' "$COMP_PDF"
companion_procedures_block_named 'Demi-Human Crafts and Poison' 'flow-first Companion procedures extraction using right-column TSV reflow for the Demi-Human Crafts and Poison sections, explicitly skipping the Hit Points Maximum section between them.' "$COMP_PDF"
cleanup_output
perl -0pi -e 's/100t the local magic shop/loot the local magic shop/g;' "$COMP_OUT"
perl -0pi -e 's/invisible things, and so forth\.\s+An/invisible things, and so forth\)\. An/g;' "$COMP_OUT"
perl -0pi -e 's/loo\x27/100\x27/g;' "$COMP_OUT"
perl -0pi -e '
  s/    Distance and\n    Number of         Chance of\.         \.\.\n    Questions Insanity Knowing                Lying/    Distance and\n    Number of Questions   Chance of Insanity   Knowing   Lying/g;
  s/Distance and\s*\n\s*Number of\s+Chance of\.?\s*\.?\s*\n\s*Questions\s+Insanity\s+Knowing\s+Lying/Distance and\nNumber of Questions   Chance of Insanity   Knowing   Lying/g;
  s/         3\s+25 %\s+50 %\n\s*4\s+5%\s*\n\s*10\s+30\s+45\n\s*5\s+15\s+35\s+40/         3           5%           25 %          50 %\n         4           10            30            45\n         5           15           35            40/g;
' "$COMP_OUT"
perl -0pi -e 's/ONS\s*\nMAGIC ITEM PRICE SUGGES.\s*\n/MAGIC ITEM PRICE SUGGESTIONS\n/g;' "$COMP_OUT"
perl -0pi -e 's/Armor\s*\n10,000 to 150,000\s*\nP/Armor           10,000 to 150,000 gp/g;' "$COMP_OUT"
perl -0pi -e 's/Misc\. Item\s*\n5,000 to 750,000\s*\nP/Misc. Item       5,000 to 750,000 gp/g;' "$COMP_OUT"
perl -0pi -e 's/5,000 to 250,000\s*\nMisc\. Weapon\s*\nP/Misc. Weapon     5,000 to 250,000 gp/g;' "$COMP_OUT"
perl -0pi -e 's/1,000 to 50,000\s*\nMissile\s*\nP/Missile          1,000 to  50,000 gp/g;' "$COMP_OUT"
perl -0pi -e 's/Missile Device 10,000 to 250,000\s*\nP/Missile Device  10,000 to 250,000 gp/g;' "$COMP_OUT"
perl -0pi -e 's/Potion\s*\n1,000 to 10,000\s*\nP/Potion           1,000 to  10,000 gp/g;' "$COMP_OUT"
perl -0pi -e 's/Ring\s*\n10,000 to 250,000\s*\nP/Ring            10,000 to 250,000 gp/g;' "$COMP_OUT"
perl -0pi -e 's/25,000 to 500,000\s*\nRod\s*\nP/Rod             25,000 to 500,000 gp/g;' "$COMP_OUT"
perl -0pi -e 's/Scroll\s*\n5,000 to 75,000\s*\nP/Scroll           5,000 to  75,000 gp/g;' "$COMP_OUT"
perl -0pi -e 's/Shield\s*\n5,000 to 100,000\s*\nP/Shield           5,000 to 100,000 gp/g;' "$COMP_OUT"
perl -0pi -e 's/15,000 to 300,000\s*\nStaff\s*\nP/Staff           15,000 to 300,000 gp/g;' "$COMP_OUT"
perl -0pi -e 's/5,000 to 500,000\s*\nSword\s*\nP/Sword            5,000 to 500,000 gp/g;' "$COMP_OUT"
perl -0pi -e 's/5,000 to 150,000\s*\nWand\s*\nP/Wand             5,000 to 150,000 gp/g;' "$COMP_OUT"
perl -0pi -e 's/pic-\ntures of creatures within loo\x27, in any area/pic-\ntures of creatures within 100\x27, in any area/g;' "$COMP_OUT"
perl -0pi -e 's/5\x27xlO\x27xl\x27/5\x27x10\x27x1\x27/g;' "$COMP_OUT"
perl -0pi -e 's/01-70\s+Magic-\n\s*User/01-70    Magic-User/g;' "$COMP_OUT"
perl -0pi -e 's/\nTreasures\n/\n/g;' "$COMP_OUT"
perl -0pi -e 's/\bifthe\b/if the/g;' "$COMP_OUT"
perl -0pi -e 's/\boflong\b/of long/g;' "$COMP_OUT"
perl -0pi -e 's/\bspdl\b/spell/g;' "$COMP_OUT"
perl -0pi -e 's/\bscrolI\b/scroll/g;' "$COMP_OUT"
perl -0pi -e 's/\bofthis\b/of this/g;' "$COMP_OUT"
perl -0pi -e 's/\bofspell\b/of spell/g;' "$COMP_OUT"
perl -0pi -e 's/\bstaffcan\b/staff can/g;' "$COMP_OUT"
perl -0pi -e 's/\bstaffof\b/staff of/g;' "$COMP_OUT"
perl -0pi -e 's/\bofair\b/of air/g;' "$COMP_OUT"
perl -0pi -e 's/m t 1st/must/g;' "$COMP_OUT"
perl -0pi -e 's/purch;\s*ISt\s*:/purchase/g;' "$COMP_OUT"
perl -0pi -e 's/Be X i iuse of/Because of/g;' "$COMP_OUT"
perl -0pi -e 's/itc \?IT is/items/g;' "$COMP_OUT"
perl -0pi -e 's/thi S/this/g;' "$COMP_OUT"
perl -0pi -e 's/SUI bt racting/subtracting/g;' "$COMP_OUT"
perl -0pi -e 's/1t 3 Cha-/18 Cha-/g;' "$COMP_OUT"
perl -0pi -e 's/E in\( 1 could/and could/g;' "$COMP_OUT"
perl -0pi -e 's/UF IW ard/upward/g;' "$COMP_OUT"
perl -0pi -e 's/asst 1IT led/assumed/g;' "$COMP_OUT"
perl -0pi -e 's/wi sh to cre-/wish to cre-/g;' "$COMP_OUT"
perl -0pi -e 's/tl he sale of/the sale of/g;' "$COMP_OUT"
perl -0pi -e 's/I C lealers/dealers/g;' "$COMP_OUT"
perl -0pi -e 's/th e i highest/the highest/g;' "$COMP_OUT"
perl -0pi -e 's/g iic lelines/guidelines/g;' "$COMP_OUT"
perl -0pi -e 's/bc : C consist-/be consist-/g;' "$COMP_OUT"
perl -0pi -e 's/th Le vari-/the vari-/g;' "$COMP_OUT"
perl -0pi -e 's/a\. fa ilable/available/g;' "$COMP_OUT"
perl -0pi -e 's/I notices/notices/g;' "$COMP_OUT"
perl -0pi -e 's/fa lr 1 the dis-/for the dis-/g;' "$COMP_OUT"
perl -0pi -e 's/th ec :harac-/the charac-/g;' "$COMP_OUT"
perl -0pi -e 's/c\.\.\.\.hr lose to/choose to/g;' "$COMP_OUT"
perl -0pi -e 's/c\.\.\.\s*\.hr lose to/choose to/g;' "$COMP_OUT"
perl -0pi -e 's/un earned/unearned/g;' "$COMP_OUT"
perl -0pi -e 's/c \)f your/of your/g;' "$COMP_OUT"
perl -0pi -e 's/awa rd/award/g;' "$COMP_OUT"
perl -0pi -e 's/of t he cash/of the cash/g;' "$COMP_OUT"
perl -0pi -e 's/iter ns/items/g;' "$COMP_OUT"
perl -0pi -e 's/eith ier/either/g;' "$COMP_OUT"
perl -0pi -e 's/thc : Guild/the Guild/g;' "$COMP_OUT"
perl -0pi -e "s/the lower '\\s*V alue/the lower value/g;" "$COMP_OUT"
perl -0pi -e 's/oft he/of the/g;' "$COMP_OUT"
perl -0pi -e 's/\nand the prices offered for them\. notices/\nand the prices offered for them. Notices/g;' "$COMP_OUT"
perl -0pi -e 's/\nI\nmagic items\./\nmagic items./g;' "$COMP_OUT"
perl -0pi -e 's/\nI\n(Sixth Level Magic-user Spells)/\n$1/g;' "$COMP_OUT"
perl -0pi -e "s/1 00 '/100'/g;" "$COMP_OUT"
perl -0pi -e 's/type of attack and then would/type of attack, and then/g;' "$COMP_OUT"
perl -0pi -e 's/make make/make/g;' "$COMP_OUT"
perl -0pi -e 's/\bd %\b/d%/g;' "$COMP_OUT"
perl -0pi -e 's/\bU p to\b/Up to/g;' "$COMP_OUT"
perl -0pi -e 's/\bId10\b/1d10/g;' "$COMP_OUT"
perl -0pi -e "s/1\\.5[’']/15'/g;" "$COMP_OUT"
 perl -0pi -e 's/0 1-03/01-03/g;' "$COMP_OUT"
 perl -0pi -e 's/06- 13/06-13/g;' "$COMP_OUT"
 perl -0pi -e 's/09- 10/09-10/g;' "$COMP_OUT"
 perl -0pi -e 's/2 1-24/21-24/g;' "$COMP_OUT"
 perl -0pi -e 's/83-84\./83-84/g;' "$COMP_OUT"
 perl -0pi -e 's/97-99\s+a/97-99      8/g;' "$COMP_OUT"
 perl -0pi -e 's/Diminution B\)/Diminution \(B\)/g;' "$COMP_OUT"
 perl -0pi -e 's/number o f charges/number of charges/g;' "$COMP_OUT"
 perl -0pi -e 's/3dlO/3d10/g;' "$COMP_OUT"
 perl -0pi -e 's/see be!ow/see below/g;' "$COMP_OUT"
 perl -0pi -e 's/6a\. Typeof/6a. Type of/g;' "$COMP_OUT"
 perl -0pi -e 's/41-42 Elven Boots \(B\) \\\s+I/41-42 Elven Boots \(B\)/g;' "$COMP_OUT"
 perl -0pi -e 's/98 Wheel of Fortune\s+-\s+\//98 Wheel of Fortune/g;' "$COMP_OUT"
perl -0pi -e '
  s/\bX P\b/XP/g;
  s/\bD M\b/DM/g;
' "$COMP_OUT"
assert_heading_count "$COMP_OUT" 'High-Level Cleric, Druid, and Magic-User Spell Material' 1 'Companion staging duplicated the high-level spell section heading'
assert_heading_count "$COMP_OUT" 'Spell-Adjacent Rings, Rods, and Miscellaneous Magic Items' 1 'Companion staging duplicated the spell-adjacent item section heading'
assert_heading_count "$COMP_OUT" 'Demi-Human Crafts and Poison' 1 'Companion staging duplicated the demi-human crafts/poison section heading'
validate_companion_staging

companion_list_only_sourcing_notes() {
  # These 23 spells appear in the Companion Set cleric and druid spell lists but
  # the Companion Set PDF provides no standalone description text for them. The
  # Companion Set either only lists them by name and level or defers descriptions
  # entirely to earlier sets or the Rules Cyclopedia. These blocks record the
  # provenance for the multi-witness staging builder and are not description
  # witnesses. See Rules Cyclopedia staging for source descriptions.
  printf '### Companion: List-Only Spell Sourcing Notes\n\n' >> "$COMP_OUT"
  printf -- '- Extraction note: The following Companion Set spells (pages 13-17 for cleric/druid, pages 22-24 for magic-user) appear in spell level lists only. The Companion Set PDF includes no standalone description text for these entries; descriptions are in the Rules Cyclopedia staging. These note blocks serve as explicit Companion lane provenance markers for the multi-witness builder.\n\n' >> "$COMP_OUT"
  printf '```text\n' >> "$COMP_OUT"
  cat >> "$COMP_OUT" <<'TXT'
Commune
[Companion (Cl5, pp.13-14): list-only; desc → RC]

Create Food
[Companion (Cl5, pp.13-14): list-only; desc → RC]

Dispel Evil
[Companion (Cl5, pp.13-14): list-only; desc → RC]

Insect Plague
[Companion (Cl5, pp.13-14): list-only; desc → RC]

Quest
[Companion (Cl5, pp.13-14): list-only; desc → RC]

Animate Objects
[Companion (Cl6, pp.13-14): list-only; desc → RC]

Cureall
[Companion (Cl6, pp.13-14): list-only; desc → RC]

Find the Path
[Companion (Cl6, pp.13-14): list-only; desc → RC]

Speak with Monsters
[Companion (Cl6, pp.13-14): list-only; desc → RC]

Word of Recall
[Companion (Cl6, pp.13-14): list-only; desc → RC]

Earthquake
[Companion (Cl7, pp.13-14): list-only; desc → RC]

Holy Word
[Companion (Cl7, pp.13-14): list-only; desc → RC]

Raise Dead Fully
[Companion (Cl7, pp.13-14): list-only; desc → RC]

Restore
[Companion (Cl7, pp.13-14): list-only; desc → RC]

Anti-Plant Shell
[Companion (D5, pp.15-17): list-only; desc → RC]

Control Winds
[Companion (D5, pp.15-17): list-only; desc → RC]

Pass Plant
[Companion (D5, pp.15-17): list-only; desc → RC]

Anti-Animal Shell
[Companion (D6, pp.15-17): list-only; desc → RC]

Transport Through Plants
[Companion (D6, pp.15-17): list-only; desc → RC]

Summon Weather
[Companion (D6, pp.15-17): list-only; desc → RC]

Creeping Doom
[Companion (D7, pp.15-17): list-only; desc → RC]

Metal to Wood
[Companion (D7, pp.15-17): list-only; desc → RC]

Conjure Elemental
[Companion (MU5, pp.22-24): list-only; desc → RC]
TXT
  printf '\n```\n\n' >> "$COMP_OUT"
}

companion_spell_lists_appendix() {
  local pdf="$1"

  printf '\n## Spell Lists Appendix\n\n' >> "$COMP_OUT"
  printf -- '- Note: these are raw numbered spell lists from the Companion Set. They are appendix-only \x2014 the per-spell description extraction above is the authoritative witness source. Multi.py strips this section before scanning for spell witnesses.\n\n' >> "$COMP_OUT"

  printf '### Companion: Cleric Spell Lists (pages 13-14)\n\n' >> "$COMP_OUT"
  printf -- '- Extraction note: TSV column reflow of Companion cleric 5th-7th level spell list pages.\n\n' >> "$COMP_OUT"
  printf '```text\n' >> "$COMP_OUT"
  render_tsv_cols_pages_anchored_until "$pdf" 13 14 '185,370' 'FIFTH LEVEL CLERIC SPELLS' 'Druid' \
    | spell_list_smart_filter >> "$COMP_OUT"
  printf '\n```\n\n' >> "$COMP_OUT"

  printf '### Companion: Magic-User Spell Lists (pages 22-24)\n\n' >> "$COMP_OUT"
  printf -- '- Extraction note: TSV column reflow of Companion magic-user 5th-9th level spell lists (pages 22-24). Column reflow orders left columns (numbered index lists) before middle/right columns (descriptions); smart filter strips descriptions.\n\n' >> "$COMP_OUT"
  printf '```text\n' >> "$COMP_OUT"
  render_tsv_cols_pages "$COMP_PDF" 22 24 '185,370' \
    | awk 'started || /FIFTH LEVEL MAGIC-USER SPELLS/ { started = 1; print }' \
    | spell_list_smart_filter >> "$COMP_OUT"
  printf '\n```\n\n' >> "$COMP_OUT"
}

companion_list_only_sourcing_notes
companion_spell_lists_appendix "$COMP_PDF"
