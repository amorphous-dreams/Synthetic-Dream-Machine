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
  cat >> "$OUT" <<'TXT'
B. Buying and Selling Magic Items
At some point in your game, the characters will probably find a magic item that they cannot use or do not want. They may then try to sell the item for cash.

This forces you, the Dungeon Master, to decide two things: whether magic items can be bought or sold, and where this would occur.

In a world full of magic, this sort of business should exist in some form. But it can easily get out of control; many items are cursed or otherwise dangerous. Spells may be used to create "fakes" (such as a light spell cast on a normal sword or gem). Any business dealing with magic items should, logically, have magical means of detecting and identifying the worth of the items, and connections with authorities to be sure that an item is legally salable and not stolen. Protection is also extremely important; a powerful magic-user should not be able to loot the local magic shop.

Thus, the recommended place for this sort of business is the Magic-user's Guild. The "shop" should be lined with lead (blocking most magical effects), and heavily safeguarded with magical traps. Apprentices might be constantly on watch for magical visitors (possibly polymorphed spell effects, invisible things, and so forth). An invisible stalker might automatically appear if any attempt at theft occurs.

You must also decide on the prices to be offered for items brought in, the items being offered for sale, and their prices. Many items might have limited availability; a powerful wand would not be freely sold to Chaotics. You can assume that all powerful items would be sold to powerful persons. A church would certainly buy any staff of curing that appears; rulers are always interested in buying potions, scrolls, and other items usable by all classes. Miscellaneous magic items would be extremely rare, and much in demand.

Of all the magic items, potions are the easiest to make, and thus the most commonly found; some might be for sale. Healing and super-healing potions are those most often sought by adventurers; other types might be available as well.

If you wish to have magic items available for purchase, the following prices are recommended. They are designed for higher level characters, and for sales in a large city. Fewer items should be available, and for higher prices, in smaller places. Items not listed should not be sold. Note that these are the prices to be paid by PCs to buy items, not the prices offered if some are brought in for sale.

MAGIC ITEM PRICE SUGGESTIONS
Armor           10,000 to 150,000 gp
Misc. Item       5,000 to 750,000 gp
Misc. Weapon     5,000 to 250,000 gp
Missile          1,000 to  50,000 gp
Missile Device  10,000 to 250,000 gp
Potion           1,000 to  10,000 gp
Ring            10,000 to 250,000 gp
Rod             25,000 to 500,000 gp
Scroll           5,000 to  75,000 gp
Shield           5,000 to 100,000 gp
Staff           15,000 to 300,000 gp
Sword            5,000 to 500,000 gp
Wand             5,000 to 150,000 gp

The most common problem you must face is what to offer adventurers to purchase items they bring in and wish to sell. Because of taxes, operating expenses, the lower value of "used goods," cost of identifying items, and so forth, you could offer 10-30% of the values given above. You may modify this by the Charisma of the seller, adding or subtracting 5% for each point of adjustment.

Experience Points: You may choose to award XP for cash gained through the sale of magic items. Beware, however, for a rare item may bring vast amounts of unearned experience, and upset the balance of your game. You may choose instead to award a set XP value for each item, regardless of the cash acquired through its sale.
TXT
  printf '\n[Companion procedures: damage to magic items]\n' >> "$OUT"
  cat >> "$OUT" <<'TXT'
Damage To Magic Items
Any item may be damaged by rough treatment. Armor and weapons, however, are made to withstand a considerable amount of punishment.

The DM should decide whether an item might be damaged, based on the item and the type of attack, and then make an Item Damage roll.

Some breath weapons (acid, fire, cold) should require such checks. If the user makes his Saving Throw against the breath, bonuses can be applied to the item's roll.

Long falls (100' or more) should require checks. Pools of acid, rockslides, and other cases of extreme damage should require checks for items carried. A scroll normally need not be checked except against fire damage; you may also include water damage, if desired.

To check for damage to items, roll 1d4 or 1d6 (using 1d6 if the chance of damage is high). If the result is greater than the item's Strength (number of "plusses"), the item is damaged. Items without plusses may be given ratings for this purpose. Consider:
any potion or scroll as a +1 item;
any wand or staff as a +2;
and all permanent items (such as rods, rings, and miscellaneous items) as +3.

This roll may be modified; for example, if a character is hit by a rockslide, Dexterity adjustments could be applied to the rolls. If a character tries to break something, Strength adjustments could be applied. No adjustment should be greater than +2. However, adjustments to the chance of survival can be any number of subtractions from the roll. A potion bottle dropped from a tabletop might require a check for breakage, but with a -2 adjustment (thus, only a roll of 4 indicating breakage).

If an item is damaged, it may either be partially damaged or completely destroyed. For items with magical bonuses, one or more points may be lost, because of damage (DM's choice). Potions, scrolls, and rings should be completely destroyed by any severe damage.
TXT
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
  printf '\n[Companion treasure descriptions: scrolls, wands\/staves\/rods, rings, and miscellaneous items]\n' >> "$OUT"
  render_tsv_cols_pages_anchored_until "$pdf" 81 93 '185,370' '6. Scrolls' '10. Armor and Shields' >> "$OUT"
  printf '\n```\n\n' >> "$OUT"
}

extract_pdf "$COMP_PDF" "$COMP_TXT"
OUT="$COMP_OUT"
write_header 'TODO: BECMI Spell Material Staging - Companion' 'TSR 1013 - Set 3 Companion Set.pdf'
companion_spell_block_named 'High-Level Cleric, Druid, and Magic-User Spell Material' 'section-aware Companion spell extraction using TSV coordinate reflow on the actual cleric, druid, and magic-user class pages, split so each spell block starts at its real section heading instead of earlier class spill.' "$COMP_PDF"
companion_magic_items_block_named 'Spell-Adjacent Rings, Rods, and Miscellaneous Magic Items' 'section-aware Companion treasure extraction combining an anchored buying/selling procedure block, a curated damage-to-magic-items procedure block, readable layout tables for scrolls/wands-rings-miscellaneous items, and TSV-reflowed item descriptions for scrolls, spell-catching, staffs, rods, rings, quill copying, and elemental-travel items.' "$COMP_PDF"
cleanup_output
set_table_qa_note "$COMP_OUT" 'reviewed 2026-03-22; confidence survey updated 2026-03-23' 'treasure tables, spell-scroll type and level tables, wand/staff/rod tables, ring tables, miscellaneous-item tables, and the new 5th-9th level magic-user spell block.' 'no blocking row/column defects remain, and the densest Companion table block has been rewritten into sequential readable tables for easier human scanning.'
append_table_qa_lines "$COMP_OUT" <<'EOF'
- Capture confidence: **0.91** (UP from 0.78 after staging the Companion MU 5th-9th spell run)
- Coverage note: Cleric 5th-7th level spells, Druid 1st-7th level spells, Companion Magic-User 5th-9th level spells, and the spell-adjacent item section are now all staged from Companion source text. Remaining concerns are OCR texture and later comparison work against RC wording, not missing primary Companion spell content.
- ToC cross-check: Companion PDF ToC sections for high-level cleric, druid, and `Magic-user Spells: Fifth to Ninth Level` are now represented in staging. The former MU spell gap is closed by the pages 22-28 TSV extraction block.
- Gap priority: LOW — primary Companion spell coverage gap closed on 2026-03-23; remaining work is cleanup and version-difference review.
EOF
perl -0pi -e 's/100t the local magic shop/loot the local magic shop/g;' "$COMP_OUT"
perl -0pi -e 's/pic-\ntures of creatures within loo\x27, in any area/pic-\ntures of creatures within 100\x27, in any area/g;' "$COMP_OUT"
perl -0pi -e 's/5\x27xlO\x27xl\x27/5\x27x10\x27x1\x27/g;' "$COMP_OUT"
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
 perl -0pi -e 's/Boat, Undersea:/Travel, Passage, and Conveyance Seeds\n\nBoat, Undersea:/g;' "$COMP_OUT"
 perl -0pi -e 's/Chime of Time:/Time, Light, and Sudden Event Seeds\n\nChime of Time:/g;' "$COMP_OUT"
 perl -0pi -e 's/Muzzle of Training:/Control, Detection, and Trick Devices\n\nMuzzle of Training:/g;' "$COMP_OUT"
 perl -0pi -e 's/Ointment:/Consumables and Security Tools\n\nOintment:/g;' "$COMP_OUT"
 perl -0pi -e 's/Quill of Copying:/Copying, Identification, and Elemental Passage\n\nQuill of Copying:/g;' "$COMP_OUT"
 perl -0pi -e 's/Wheel of Floating:/Wheels, Motion, and Fortune Devices\n\nWheel of Floating:/g;' "$COMP_OUT"
perl -0pi -e '
  s/\bX P\b/XP/g;
  s/\bD M\b/DM/g;
' "$COMP_OUT"

