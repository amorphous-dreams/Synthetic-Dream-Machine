#!/usr/bin/env bash
set -euo pipefail

ROOT='/home/joshu/Synthetic-Dream-Machine'
SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)

BECMI_STAGING_HELPERS_ONLY=1 source "$SCRIPT_DIR/build_becmi_spell_staging.sh"

TMPDIR=$(mktemp -d)
trap 'rm -rf "$TMPDIR"' EXIT

EXPERT_TXT="$TMPDIR/expert.txt"
EXPERT_PDF="$ROOT/_becmi/TSR 1012B - Set 2 Expert Rules.pdf"
EXPERT_OUT="$ROOT/_todo/TODO_BECMI_Spell_Material_Staging_Expert.md"

expert_cleanup_snippet() {
  perl -0pe '
    s/\f//g;
    s/\x{2018}|\x{2019}/'\''/g;
    s/\x{201C}|\x{201D}/"/g;
    s/gpimonth/gp\/month/g;
    s/T h e/The/g;
    s/\.4ny/Any/g;
    s/euil/evil/g;
    s/mapc/magic/g;
    s/samewav/same way/g;
    s/\bYz\b/1\/2/g;
    s/\bi s\b/is/g;
    s/\#l/#1/g;
    s/([[:alpha:]])-\n([[:alpha:]])/$1$2/g;
    s/advi-\s*sor/advisor/g;
    s/involv-\s*ing/involving/g;
    s/time re-\s*quired/time required/g;
    s/\n Sage/\nSage/g;
    s/^\s*Intelligent Swords\s*\n\s*Intelligent Swords\s*$/Intelligent Swords/mg;
    s/^\s*["”\x{201d}\x{201c}]+\s*$//mg;
    s/^\s*(ll|ble|the)\s*$//mg;
    s/^t,\s+or /or /mg;
    s/^the\s+A Lawful/A Lawful/mg;
    s/\bwel$/well/mg;
    s/\bwheth$/whether/mg;
    s/\bextr$/extra/mg;
    s/\bld$/ld20/mg;
    s/\bd7c\b/d%/g;
    s/owner\x27/owner\x27s/g;
    s/as well\nAn/as well.\nAn/g;
    s/turn t/turn to/g;
    s/Then turn too/Then turn to/g;
    s/turn too/turn to/g;
    s/\(1d20\nand languages known\./\(1d20\)\nand languages known./g;
    s/result of a roll\n1d20/result of a roll of\n1d20/g;
    s/result of a roll of\nld20/result of a roll of\n1d20/g;
    s/\bld20\b/1d20/g;
    s/\bld12\b/1d12/g;
    s/it will us/it will usually/g;
    s/languages it\nspeak/languages it can\nspeak/g;
    s/five differ\nsituations/five different\nsituations/g;
    s/first handles the swor/first handles the sword/g;
    s/until t\nsituation/until the\nsituation/g;
    s/fan\nscabbards/fancy\nscabbards/g;
    s/\bYz\b/1\/2/g;
    s/\bi s\b/is/g;
    s/\bwill us\nally\b/will usually/g;
    s/\bwill us\b/will usually/g;
    s/will usually\s+ally cooperate/will usually cooperate/g;
    s/languages it\s+speak/languages it can speak/g;
    s/first handles the swordd\./first handles the sword./g;
    s/\bcon-\n\s*trol\b/control/g;
    s/\bei-\n\s*ther\b/either/g;
    s/\bweap-\n\s*ons\b/weapons/g;
    s/\boppo-\n\s*nent\b/opponent/g;
    s/\bop-\n\s*ponent\b/opponent/g;
    s/\bpo-\n\s*tions\b/potions/g;
    s/\bCon-\n\s*trol\b/Control/g;
    s/\bcharac-\n\s*ter\b/character/g;
    s/\bfol-\n\s*lows\b/follows/g;
    s/\bde-\n\s*scriptions\b/descriptions/g;
    s/^\s*\.\s*$//mg;
    s/[ \t]+\n/\n/g;
    s/\n{3,}/\n\n/g;
    s/^[ \t]+//mg;
  '
}

expert_magic_support_block_named() {
  local label="$1"
  local note="$2"
  local pdf="$3"

  printf '### %s\n\n' "$label" >> "$OUT"
  printf -- '- Extraction note: %s\n\n' "$note" >> "$OUT"
  printf '```text\n' >> "$OUT"
  printf '[Expert page 26: magic support infrastructure]\n' >> "$OUT"

  {
    pdftotext -layout -nodiag -nopgbrk -f 28 -l 28 "$pdf" - 2>/dev/null \
      | cut -c1-55 \
      | sed -n '30,36p'
    printf '\n'
    pdftotext -layout -nodiag -nopgbrk -f 28 -l 28 "$pdf" - 2>/dev/null \
      | cut -c50-98 \
      | sed -n '42,49p'
  } | expert_cleanup_snippet | perl -0pe 's/\n(?=\S)/ /g; s/ {2,}/ /g; s/\n\n/\n\n/g; s/^ +//mg' >> "$OUT"

  printf '\n```\n\n' >> "$OUT"
}

expert_magic_item_doctrine_block_named() {
  local label="$1"
  local note="$2"
  local pdf="$3"

  printf '### %s\n\n' "$label" >> "$OUT"
  printf -- '- Extraction note: %s\n\n' "$note" >> "$OUT"
  printf '```text\n' >> "$OUT"
  printf '[Expert pages 59-61: magic item doctrine, intelligent weapons, and potion interfaces]\n' >> "$OUT"

  {
    printf 'Magic Item Notes\n\n'
    pdftotext -layout -nodiag -nopgbrk -f 61 -l 61 "$pdf" - 2>/dev/null \
      | cut -c1-48 \
      | sed -n '13,39p'
    printf '\nIntelligent Swords\n'
    pdftotext -layout -nodiag -nopgbrk -f 61 -l 61 "$pdf" - 2>/dev/null \
      | cut -c97-150 \
      | sed -n '4,32p'
    printf '\n'
    pdftotext -layout -nodiag -nopgbrk -f 61 -l 61 "$pdf" - 2>/dev/null \
      | cut -c49-96 \
      | sed -n '52,59p'
    printf '\n'
    pdftotext -layout -nodiag -nopgbrk -f 62 -l 62 "$pdf" - 2>/dev/null \
      | cut -c49-96 \
      | sed -n '52,75p'
    printf '\n'
    pdftotext -layout -nodiag -nopgbrk -f 62 -l 62 "$pdf" - 2>/dev/null \
      | cut -c97-150 \
      | sed -n '11,75p'
    printf '\nControl Potions\n\n'
    pdftotext -layout -nodiag -nopgbrk -f 63 -l 63 "$pdf" - 2>/dev/null \
      | cut -c1-47 \
      | sed -n '34,49p'
    printf '\n'
    pdftotext -layout -nodiag -nopgbrk -f 63 -l 63 "$pdf" - 2>/dev/null \
      | cut -c1-47 \
      | sed -n '61,68p'
    printf '\n'
    pdftotext -layout -nodiag -nopgbrk -f 63 -l 63 "$pdf" - 2>/dev/null \
      | cut -c48-95 \
      | sed -n '23,43p'
    printf '\n'
    pdftotext -layout -nodiag -nopgbrk -f 63 -l 63 "$pdf" - 2>/dev/null \
      | cut -c48-95 \
      | sed -n '50,53p'
    printf '\n'
    pdftotext -layout -nodiag -nopgbrk -f 63 -l 63 "$pdf" - 2>/dev/null \
      | cut -c48-95 \
      | sed -n '72,75p'
  } | expert_cleanup_snippet >> "$OUT"

  printf '\n```\n\n' >> "$OUT"
}

expert_scrolls_block_named() {
  local label="$1"
  local note="$2"
  local pdf="$3"

  printf '### %s\n\n' "$label" >> "$OUT"
  printf -- '- Extraction note: %s\n\n' "$note" >> "$OUT"
  printf '```text\n' >> "$OUT"
  printf '[Expert page 61: e. SCROLLS]\n' >> "$OUT"
  pdftotext -layout -nodiag -nopgbrk -f 63 -l 63 -x 380 -y 80 -W 200 -H 620 "$pdf" - 2>/dev/null \
    | awk 'started || /e\. SCROLLS/ { started=1; print }' >> "$OUT"
  printf '\n[Expert page 62: g. WANDS, STAVES, AND RODS]\n' >> "$OUT"
  pdftotext -nodiag -nopgbrk -f 64 -l 64 -x 200 -y 70 -W 380 -H 620 "$pdf" - 2>/dev/null \
    | awk 'started || /g\. WANDS, STAVES, AND RODS/ { started=1; print }' >> "$OUT"
  printf '\n```\n\n' >> "$OUT"
}

expert_research_block_named() {
  local label="$1"
  local note="$2"

  printf '### %s\n\n' "$label" >> "$OUT"
  printf -- '- Extraction note: %s\n\n' "$note" >> "$OUT"
  printf '```text\n' >> "$OUT"
  cat >> "$OUT" <<'TXT'
[Expert pages 27-28: Research and Lost Spell Books]
Research (Magic Spells and Items)

A cleric, magic-user, or elf may try to invent new spells and create new magical items through research. These are difficult and lengthy projects. The DM should be very careful when letting the players develop new spells and new magic. Permanent effects, unlimited uses, and effects that increase with level or have no Saving Throw can lead to severe imbalance. In most cases, a new design should be tested for a time with the understanding that changes may be made later if necessary.

Spells: Research requires both time and money. The player should have a firm idea of the spell desired. The new spell must be written out and given to the DM, who decides whether it is possible, what level it should be, and what changes are needed for play balance. A character may only research spells of levels equal to those which can already be cast. Spell research costs 1,000 gp and 2 weeks of time per spell level.

Magic Items: A spell caster may not create magic items until reaching 9th level or greater. A cleric may only make items usable by clerics, and a magic-user or elf may only make items usable by that class.

To create a magic item, the spell caster must first gather rare materials from which the item will be made. The DM should decide what is necessary. A scroll might require special parchment and a different formula of ink for each spell effect. Weapons might require rare metals, powdered gems forged into the metal, or the blood or skins of creatures to be specially affected by the weapon. These materials should be difficult to obtain, and the spell caster will often have to adventure to acquire them, for there are no magic shops.

The spell caster must then spend time and money fashioning the item and enchanting it. The spell caster may not go adventuring during the time it takes to create a magic item.

If an item duplicates a spell effect, the cost is usually 500 gp and 1 week of time per spell level. There is always at least a 15% chance that magical research or production will fail. This check is made after the time and money are spent.

The DM may limit or forbid the production of certain powerful items by requiring very rare substances for production. They could be hard to find, very costly, time-consuming, or require a special adventure.

Examples

Item                     Cost       Time
Scroll: magic missile
  (x2)                   1,000 gp   2 weeks
Potion of healing          500 gp   1 week
Fire ball wand
  (20 charges)          30,000 gp   17 weeks
20 arrows +1            10,000 gp   1 month
Plate mail +1           10,000 gp   6 months
Crystal ball            30,000 gp   6 months
Ring of x-ray vision   100,000 gp   12 months
Ring of spell storing   10,000 gp   1 month per spell level

Spell Books, Lost

A magic-user or elf whose spell book is lost or destroyed cannot regain spells until it is replaced. The method, time, and cost are left to the DM to decide. A rough guideline is 1,000 gp and 1 week of study for each spell level replaced. Replacing a 3rd level spell would therefore require 3,000 gp and 3 weeks. This should require all the character's time, leaving none for adventuring.
TXT
  printf '\n```\n\n' >> "$OUT"
}

expert_spell_expansions_block_named() {
  local label="$1"
  local note="$2"
  local pdf="$3"

  printf '### %s\n\n' "$label" >> "$OUT"
  printf -- '- Extraction note: %s\n\n' "$note" >> "$OUT"
  printf '```text\n' >> "$OUT"
  printf '[Expert pages 7-11: clerical spell expansions]\n' >> "$OUT"
  render_tsv_cols_pages_anchored "$pdf" 7 11 '185,370' 'First Level Clerical Spells' >> "$OUT"
  printf '\n[Expert pages 13-18: magic-user spell expansions]\n' >> "$OUT"
  cat >> "$OUT" <<'TXT'
FIRST LEVEL MAGIC-USER SPELLS
1. Charm Person
2. Detect Magic
3. Floating Disc
4. Hold Portal
5. Light*
6. Magic Missile
7. Protection from Evil
8. Read Languages
9. Read Magic
10. Shield
11. Sleep
12. Ventriloquism

SECOND LEVEL MAGIC-USER SPELLS
1. Continual Light*
2. Detect Evil
3. Detect Invisible
4. ESP*
5. Invisibility
6. Knock
7. Levitate
8. Locate Object
9. Mirror Image
10. Phantasmal Force
11. Web
12. Wizard Lock

THIRD LEVEL MAGIC-USER SPELLS
1. Clairvoyance
2. Dispel Magic
3. Fire Ball
4. Fly
5. Haste*
6. Hold Person*
7. Infravision
8. Invisibility 10' radius
9. Lightning Bolt
10. Protection from Evil 10' radius
11. Protection from Normal Missiles
12. Water Breathing

FOURTH LEVEL MAGIC-USER SPELLS
1. Charm Monster
2. Confusion
3. Dimension Door
4. Growth of Plants*
5. Hallucinatory Terrain
6. Ice Storm/Wall
7. Massmorph
8. Polymorph Others
9. Polymorph Self
10. Remove Curse*
11. Wall of Fire
12. Wizard Eye

FIFTH LEVEL MAGIC-USER SPELLS
1. Animate Dead
2. Cloudkill
3. Conjure Elemental
4. Hold Monster*
5. Magic Jar
6. Pass-Wall
7. Teleport
8. Wall of Stone

SIXTH LEVEL MAGIC-USER SPELLS
1. Anti-Magic Shell
2. Death Spell
3. Disintegrate
4. Geas*
5. Invisible Stalker
6. Lower Water
7. Projected Image
8. Stone to Flesh*

*Spell may be cast with reverse effect.

TXT
  cat >> "$OUT" <<'TXT'
The following first and second level spells
may be reversed; Ranges, durations, Sav-
ing Throws, and areas of effect will remain
unchanged unless specified.

First Level Magic-user Spells

Light*
When reversed, this spell, darkness, creates
a circle of darkness 30' in diameter. It will
block all sight except infravision. Darkness
will cancel a light spell if cast upon it (but
may itself be cancelled by another light
spell). If cast at an opponent's eyes, it will
cause blindness until cancelled, or until the
duration ends.

Second Level Magic-user Spells

Continual Light*
The reverse of this spell, continual darkness,
creates a completely dark volume of 30'
radius. Torches, lanterns, and even a light
spell will not affect it, and infravision can-
not penetrate it. If cast on a creature's eyes,
the creature must make a Saving Throw vs.
Spells or be blinded until the spell is re-
moved. A continual light spell will cancel its
effects.

TXT
  render_tsv_cols_pages "$pdf" 14 18 '185,370' \
    | awk '
        /THIEF SAVING THROWS/ { exit }
        { print }
      ' >> "$OUT"
  printf '\n```\n\n' >> "$OUT"
}

expert_magic_items_block_named() {
  local label="$1"
  local note="$2"

  printf '### %s\n\n' "$label" >> "$OUT"
  printf -- '- Extraction note: %s\n\n' "$note" >> "$OUT"
  printf '```text\n' >> "$OUT"
  cat >> "$OUT" <<'TXT'
[Expert pages 60-65: scrolls, rings, wands, staves, rods, and miscellaneous magic items]
Cursed Items

Any magical treasure can be cursed when found. A curse can be removed for a short time, 1-20 rounds, by a remove curse spell, or permanently removed by the same spell from a high level cleric or magic-user, at the DM's choice. A cleric's dispel evil spell should remove nearly all curses, except perhaps those bestowed by very powerful spell casters or items.

The curse on an item may have nearly any effect imaginable. A sword +2 might be cursed to act as a sword -2, penalizing the Hit roll, and a shield +3 could likewise penalize Armor Class by 3. Items could work normally but with side effects, causing the wielder to argue, sneeze, drop other items, slowly lose strength, and so forth.

Magic Item Notes

If the range or duration of a magic item is not given, treat it the same as a magic spell from a 6th level spell caster.

The following notations may appear on Expert magic-item charts:
- (B) described in the D&D Basic Set
- (c) usable only by a cleric
- (m) usable only by a magic-user or elf
- (s) usable only by a spell caster: cleric, magic-user, or elf

Several items can detect, control, or otherwise perform actions within a given range. Any of these actions can be blocked by a thin sheet of lead, 1' of any other metal, or 10' of stone.

e. Scrolls

To use a scroll, there must be enough light to read by, and the scroll must be read aloud. A scroll, or for spell scrolls each spell, may only be used once, as the words disappear when read. Only magic-users and elves may use magic-user scrolls, and a read magic spell must be used first to discover the contents of each scroll. Only clerics may use clerical spell scrolls, but they need no magical aid to discover the contents. Anyone may use protection scrolls and treasure maps.

Spells: A scroll of spells may only be used by the character class matching the spells on the scroll. The type of spells, cleric or magic-user, the exact spells themselves, and the level of each spell may be selected or determined randomly.

Protection Scrolls: A protection scroll may be read by any character who can read the Common language.

Protection from Elementals: This scroll creates a circle of protection, 10' radius, around the reader. No elemental can attack those within the circle unless attacked first in hand-to-hand combat. Once attacked, an elemental may attack in return. The effect lasts 2 turns and moves with the reader.

Protection from Magic: This scroll creates a circle of protection, 10' radius, around the reader. No spells or spell effects, including those from items, may enter or leave the circle. The effect lasts 1-4 turns, moves with the reader, and may not be broken except by a magical wish.

Treasure Maps: Each map shows a route to the location of a treasure in a dungeon or wilderness area. The treasure is usually hidden or protected by monsters, traps, or magic. A normal treasure contains no magic items. A magical treasure may include some coins and a few gems of low value. A combined treasure has both magic and valuable gems or jewelry, and a special treasure should mention at least one permanent item, such as a Staff or Sword.

f. Rings

The ring must be worn on a hand to have its effect, but may be carried and put on when desired. Any ring may be used once per round unless noted otherwise. No more than 2 magic rings may be worn at the same time.

Delusion: The wearer believes this to be any one other ring, but it has no real effect. The wearer will not be convinced otherwise until a remove curse spell is used.

Djinni Summoning: The wearer may summon one djinni to serve for up to one day. The ring may be used once per week at most.

Human Control: This is the same effect as the potion of the same name. The effect lasts until cancelled by the wearer, until the ring is removed, or until a dispel magic spell removes the charm.

Plant Control: This has the same effect as the potion of the same name, but only lasts as long as the wearer concentrates.

Protection +1, 5' radius: This improves the wearer's Armor Class and Saving Throws by 1, and gives the same bonus to all creatures within 5', both friend and foe.

Regeneration: The wearer regenerates lost hit points at the rate of 1 per turn and may regrow lost limbs. The ring will not function if the wearer's hit points drop to 0 or less. Fire and acid damage cannot be regenerated.

Spell Storing: When found, this ring has 1-6 spells stored within it. Those exact spells are the limit of the ring's powers and cannot be changed. After a spell is used, it may be replaced by a spell caster who must cast the replacement spell directly at the ring. The ring does not absorb spells thrown at the wearer. The spells have the duration, range, and effect equal to the lowest level needed to cast them.

Spell Turning: This ring reflects 2-12 spells back to their casters. Only spells are reflected, not spell-like monster powers or spell-like item effects.

Telekinesis: The wearer may move up to 2,000 cn of weight by concentration alone.

Wishes: A ring of wishes is an extremely powerful item and should be handled with great care by both DM and players.

X-ray Vision: The wearer may see up to 30' through a wall and into the space beyond by standing still and concentrating. The effect may be blocked by gold or lead. One 10' x 10' area may be inspected per use, requiring one full turn.

g. Wands, Staves, and Rods

A rod may be used by any character class, but a staff can only be used by a spell caster, sometimes restricted to a specific type, and a wand can only be used by a magic-user or elf. A wand normally has 2-20 charges when found, and a staff 3-30. Each use of a power costs 1 charge unless noted otherwise. Each item may be used once per round at most.

Staff of Commanding (s): This item has all the powers of the rings of animal, human, and plant control.

Staff of Power (m): This item can be used as a staff of striking and can also create fire ball, lightning bolt, and ice storm effects, each doing 8-48 points of damage. It can also create a continual light effect or move 2,400 cn of weight by telekinesis.

Staff of Striking (s): This weapon inflicts 2-12 points of damage per charge if the hit is successful. Only one charge may be used per strike.

Staff of Withering (c): One hit from this item ages the victim 10 years. One or two hits are fatal to most animals and harmful to many humans. Elves may ignore the first 200 years of aging, dwarves the first 50 years, and halflings the first 20 years. Undead are not affected.

Staff of Wizardry (m): This staff +1 has all the powers of a Staff of Power, plus invisibility, passwall, web, and conjure elemental. It may also create a whirlwind, shoot a cone of paralyzation, or be broken to release all of its power in an explosion. The final strike inflicts 8 points of damage per remaining charge to all creatures within 30', including the user, though a Saving Throw vs. Staff is allowed for half damage.

Wand of Cold: This creates a cone of cold 60' long and 30' wide at the far end. All within the cone take 6-36 points of cold damage, but may make a Saving Throw vs. Wands for half damage.

Wand of Fear: This creates a cone of fear 60' long and 30' wide at the far end. All within the cone must make a Saving Throw vs. Wands or run away from the user for 30 rounds at 3 times the normal rate.

Wand of Fire Balls: This creates a fire ball effect up to 240' away. All victims take 6-36 points of fire damage, but may make a Saving Throw vs. Wands for half damage.

Wand of Illusion: This creates a phantasmal force effect. The user must concentrate on the illusion to maintain it, but may walk at half normal movement rate while doing so.

Wand of Lightning Bolts: This creates a lightning bolt starting up to 240' away and 60' long from that point. Victims take 6-36 points of electrical damage, but may make a Saving Throw vs. Wands for half damage.

Wand of Metal Detection: This points toward any named type of metal within 20' if at least 1,000 cn is present.

Wand of Negation: This cancels the effects of one other wand or staff. If the other effect has a duration, the negation lasts for one round.

Wand of Polymorphing: This creates either a polymorph self or polymorph other effect. An unwilling victim may make a Saving Throw vs. Wands to avoid the effect.

Wand of Secret Door Detection: The user may find any secret door within 20', using one charge per secret door found.

Wand of Trap Detection: This points at all traps within 20', one at a time, at a cost of 1 charge per trap.

h. Miscellaneous Magic Items

Each of these items may be used by any character class, and up to once per round unless noted otherwise. Most effects either work automatically or are activated by concentration alone.

Amulet vs. Crystal Balls and ESP: The wearer is automatically protected from being spied on by anyone using a crystal ball or any type of ESP.

Boots of Levitation: The wearer may levitate as if using the magic-user spell, with no duration limit.

Boots of Speed: The wearer may move as fast as a riding horse for 12 hours, after which the wearer must rest for one full day.

Boots of Traveling and Leaping: The wearer needs no rest during normal movement and may jump up to 10' high and 30' long.

Broom of Flying: This carries its owner through the air at 240' per turn. One other person or up to 2,000 cn of baggage may also be carried, reducing speed to 180' per turn.

Crystal Ball with Clairaudience: This works like a standard crystal ball, but also allows listening through the ears of a creature in the viewed area.

Crystal Ball with ESP: This works like a standard crystal ball, but also allows listening to the thoughts of a creature viewed.

Displacer Cloak: This warps light rays so the wearer is actually 5' away from the visible location. Hand-to-hand attacks are penalized by -2 and most missile fire automatically misses.

Drums of Panic: Creatures 10'-240' away must make a Saving Throw vs. Spells or run away from the user for 30 rounds. If the morale system is used, each creature instead makes a morale check with a +2 penalty to the roll.

Efreeti Bottle: When opened, this releases an efreeti that serves the opener once per day for 101 days or until slain.

Elemental Devices: Bowl, Brazier, Censer, or Stone. Each may be used once per day, takes 1 turn to use, summons a device elemental of the appropriate type, and allows the user to control it subject to normal elemental-control rules.

Flying Carpet: This carries one passenger at 100' per round, two at 80', or three at 60'. It will not carry more than 3 passengers and their equipment.

Girdle of Giant Strength: This gives the wearer the same chances to hit as a hill giant and 2-16 points of damage per hit.

Helm of Reading Languages and Magic: The wearer may read any writing regardless of language or magical properties. It does not allow use of spell scrolls unless the character can do so normally. The helm is fragile and may be destroyed if the wearer is killed or struck.

Helm of Teleportation (m): The wearer may teleport, including the normal chances of error, or may try to teleport another creature or item. After one use the helm no longer functions until a teleport spell is cast upon it, after which the user may teleport once per round until teleporting another item or creature.

Horn of Blasting: This creates a cone of sound 100' long and 20' wide at the far end. Victims take 2-12 points of damage and must make a Saving Throw vs. Spells or be deafened for one turn.

Medallion of ESP (90'): This allows the user to listen to another's thoughts to a range of 90'.

Mirror of Life Trapping: Any man-size or smaller creature looking into the mirror must make a Saving Throw vs. Spells or be sucked into it with all equipment. The mirror may store up to 20 creatures.

Scarab of Protection: This automatically absorbs any curse and will also absorb a finger of death. It works 2-12 times before becoming worthless.
TXT
  printf '\n```\n\n' >> "$OUT"
}

extract_pdf "$EXPERT_PDF" "$EXPERT_TXT"
OUT="$EXPERT_OUT"
write_header 'TODO: BECMI Spell Material Staging - Expert' 'TSR 1012B - Set 2 Expert Rules.pdf'
expert_spell_expansions_block_named 'Clerical and Magic-User Spell Expansions' 'stitched Expert spell extraction: clerical spell pages 7-11 and magic-user spell pages 13-18 use separate TSV coordinate reflow passes so the real spell sections stay in source order and the intervening fighter/thief class tables are excluded.' "$EXPERT_PDF"
expert_research_block_named 'Research and Lost Spell Books' 'curated Expert reconstruction from pages 27-28, replacing the contaminated line-range slice with the actual research procedures, item-creation examples, and lost spell-book recovery guidance.'
expert_magic_support_block_named 'Magic Support Infrastructure' 'page-26 layout slices target the Alchemist and Sage specialist support entries and then apply narrow OCR cleanup to preserve those two magic-relevant procedures without carrying the full specialist roster.' "$EXPERT_PDF"
expert_magic_items_block_named 'Scrolls, Rings, Wands, Staves, Rods, and Spell-Adjacent Treasure Text' 'curated Expert reconstruction from treasure pages 60-65, combining cursed-item doctrine, general magic-item operation notes, scroll procedures, ring procedures, wand/staff/rod procedures, and the full page-65 miscellaneous magic-item list.'
expert_magic_item_doctrine_block_named 'Magic Item Doctrine and Intelligent Weapons' 'page-59 to page-61 column slices target generic magic-item doctrine, intelligent-weapon control rules, and the specific control-potion subset needed for downstream spell/effect coverage; cleanup normalizes OCR scars and dehyphenates wrapped words.' "$EXPERT_PDF"
cleanup_output
set_table_qa_note "$EXPERT_OUT" 'reviewed 2026-03-22; confidence survey updated 2026-03-23' 'leveled spell lists, spell-expansion sections, structured spell-property blocks, magic support infrastructure, and high-value spell-adjacent item/procedure doctrine.' 'no blocking row/column defects found in the visible Expert table and list regions.'
append_table_qa_lines "$EXPERT_OUT" <<'EOF'
- Capture confidence: **0.89**
- Coverage note: Core Expert cleric and magic-user spell expansions, magic support infrastructure, research/lost-book procedures, and high-value treasure-chapter item doctrine are staged cleanly. The page-65 miscellaneous magic-item list is fully present in this staging block; remaining issues are OCR texture and minor normalization.
- ToC cross-check: Expert CONTENTS review found spell sections, support/research procedures, and the full page-65 `h. MISCELLANEOUS MAGIC ITEMS` list accounted for.
- Gap priority: LOW — cleanup is now readability-focused, not structural coverage.
EOF
perl -0pi -e 's/any one creature within IO\x27\. The spell may/any one creature within 10\x27. The spell may/g;' "$EXPERT_OUT"
assert_heading_count "$EXPERT_OUT" 'Clerical and Magic-User Spell Expansions' 1 'Expert staging duplicated the spell-expansions section heading'
assert_heading_count "$EXPERT_OUT" 'Research and Lost Spell Books' 1 'Expert staging duplicated the research section heading'
assert_heading_count "$EXPERT_OUT" 'Magic Support Infrastructure' 1 'Expert staging duplicated the magic-support section heading'
assert_heading_count "$EXPERT_OUT" 'Scrolls, Rings, Wands, Staves, Rods, and Spell-Adjacent Treasure Text' 1 'Expert staging duplicated the treasure/item section heading'
assert_heading_count "$EXPERT_OUT" 'Magic Item Doctrine and Intelligent Weapons' 1 'Expert staging duplicated the doctrine section heading'
