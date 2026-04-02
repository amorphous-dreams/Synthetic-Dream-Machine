#!/usr/bin/env bash
set -euo pipefail

ROOT='/home/joshu/Synthetic-Dream-Machine'
SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)

BECMI_STAGING_HELPERS_ONLY=1 source "$SCRIPT_DIR/build_becmi_spell_staging.sh"

TMPDIR=$(mktemp -d)
trap 'rm -rf "$TMPDIR"' EXIT

BASIC_TXT="$TMPDIR/basic.txt"
BASIC_PDF="$ROOT/_becmi/TSR 1011B - Set 1 Basic Rules.pdf"
BASIC_OUT="$ROOT/_todo/TODO_BECMI_Spell_Material_Staging_Basic.md"

require_command() {
  local cmd="$1"
  if ! command -v "$cmd" >/dev/null 2>&1; then
    printf 'Missing required command: %s\n' "$cmd" >&2
    exit 1
  fi
}

preflight_basic() {
  require_command pdftotext
  require_command awk
  require_command sed
  require_command perl
  if [ ! -f "$BASIC_PDF" ]; then
    printf 'Missing Basic source PDF: %s\n' "$BASIC_PDF" >&2
    exit 1
  fi
}

assert_in_file() {
  local file="$1"
  local needle="$2"
  local label="$3"
  if ! grep -Fq "$needle" "$file"; then
    printf 'Validation failed: missing %s\n' "$label" >&2
    exit 1
  fi
}

basic_spell_lists_and_descriptions_block_named() {
  local label="$1"
  local note="$2"
  local pdf="$3"

  printf '### %s\n\n' "$label" >> "$OUT"
  printf -- '- Extraction note: %s\n\n' "$note" >> "$OUT"
  printf '```text\n' >> "$OUT"
  printf '[Basic page 35: curated spell-list page]\n' >> "$OUT"
  cat >> "$OUT" <<'TXT'
Cleric Spells: First Level

Cure Light Wounds*
  Range: Touch
  Duration: Permanent
  Effect: Any one living creature

Detect Evil
  Range: 120'
  Duration: 6 turns
  Effect: Everything within 120'

Detect Magic
  Range: 60'
  Duration: 2 turns
  Effect: Everything within 60'

Light*
  Range: 120'
  Duration: 12 turns
  Effect: Volume of 30' diameter

Protection from Evil
  Range: 0
  Duration: 12 turns
  Effect: The cleric only

Purify Food and Water
  Range: 10'
  Duration: Permanent
  Effect: 1 ration or 6 waterskins

Remove Fear*
  Range: Touch
  Duration: 2 turns
  Effect: Any one living creature

Resist Cold
  Range: 0
  Duration: 6 turns
  Effect: All creatures within 30'

*Spell may be cast with reverse effects in D&D EXPERT Rules.

Magic-User Spells: First Level*

Charm Person
  Range: 120'
  Duration: See below
  Effect: One living "person"

Detect Magic
  Range: 60'
  Duration: 2 turns
  Effect: Everything within 60'

Floating Disc
  Range: 0
  Duration: 6 turns
  Effect: Disc remains within 6'

Hold Portal
  Range: 10'
  Duration: 2-12 (2d6) turns
  Effect: One door, gate, or similar portal

Light
  Range: 120'
  Duration: 6 turns + 1 turn per Level of the magic-user
  Effect: Volume of 30' diameter

Magic Missile
  Range: 150'
  Duration: 1 round
  Effect: Creates 1 or more arrows

Protection from Evil
  Range: 0
  Duration: 6 turns
  Effect: The magic-user only

Read Languages
  Range: 0
  Duration: 2 turns
  Effect: The magic-user only

Read Magic
  Range: 0
  Duration: 1 turn
  Effect: The magic-user only

Shield
  Range: 0
  Duration: 2 turns
  Effect: The magic-user only

Sleep
  Range: 240'
  Duration: 4-16 (4d4) turns
  Effect: 2-16 Hit Dice of living creatures within a 40' square area

Ventriloquism
  Range: 60'
  Duration: 2 turns
  Effect: One item or location

Magic-User Spells: Second Level

Continual Light
  Range: 120'
  Duration: Permanent
  Effect: Volume of 60' diameter

Detect Evil
  Range: 60'
  Duration: 2 turns
  Effect: Everything within 60'

Detect Invisible
  Range: 10' per Level of the magic-user
  Duration: 6 turns
  Effect: The magic-user only

ESP
  Range: 60'
  Duration: 12 turns
  Effect: All thoughts in one direction

Invisibility
  Range: 240'
  Duration: Permanent until broken
  Effect: One creature or object

Knock
  Range: 60'
  Duration: See below
  Effect: One lock or bar

Levitate
  Range: 0
  Duration: 6 turns + 1 turn per Level of the magic-user
  Effect: The magic-user only

Locate Object
  Range: 60' + 10' per Level of the magic-user
  Duration: 2 turns
  Effect: One object within range

Mirror Image
  Range: 0
  Duration: 6 turns
  Effect: The magic-user only

Phantasmal Force
  Range: 240'
  Duration: Concentration
  Effect: A volume 20' x 20' x 20'

Web
  Range: 10'
  Duration: 48 turns
  Effect: A volume 10' x 10' x 10'

Wizard Lock
  Range: 10'
  Duration: Permanent
  Effect: One portal or lock
TXT
  printf '\n[Basic pages 26-27: TSV column-reflowed clerical spell descriptions]\n' >> "$OUT"
  render_tsv_cols_pages "$pdf" 28 29 '190,370' >> "$OUT"
  printf '\n[Basic pages 38-42: TSV column-reflowed magic-user spell books and descriptions]\n' >> "$OUT"
  render_tsv_cols_pages "$pdf" 40 44 '190,370' \
    | awk '
        /Spell Books:/ { started = 1 }
        started { print }
      ' \
    | sed '/^[[:space:]]*[0-9][0-9]*[[:space:]]*$/d' \
    | sed '/^DUNGEONS [^[:lower:]]*characters (character class - human)[[:space:]]*$/d' >> "$OUT"
  printf '\n```\n\n' >> "$OUT"
}

basic_cleric_rules_block_named() {
  local label="$1"
  local note="$2"
  local pdf="$3"

  printf '### %s\n\n' "$label" >> "$OUT"
  printf -- '- Extraction note: %s\n\n' "$note" >> "$OUT"
  printf '```text\n' >> "$OUT"
  pdftotext -tsv -f 27 -l 27 "$pdf" "$TMPDIR/basic27.tsv" 2>/dev/null
  printf '[Basic page 25: special-abilities prose]\n' >> "$OUT"
  awk -F '\t' '
NR==1 { next }
$1 == 1 { page = $2 + 0; next }
$1 == 4 {
  if (have && text != "") {
    col = 1
    if ((line_left + 0) >= 190) col = 2
    if ((line_left + 0) >= 370) col = 3
    printf "%d\t%d\t%f\t%d\t%s\n", page, col, line_top, seq++, text
  }
  have = 1
  line_left = $7 + 0
  line_top = $8 + 0
  text = ""
  next
}
$1 == 5 && have {
  text = (text == "" ? $12 : text " " $12)
  next
}
END {
  if (have && text != "") {
    col = 1
    if ((line_left + 0) >= 190) col = 2
    if ((line_left + 0) >= 370) col = 3
    printf "%d\t%d\t%f\t%d\t%s\n", page, col, line_top, seq++, text
  }
}
' "$TMPDIR/basic27.tsv" \
    | sort -t $'\t' -k1,1n -k2,2n -k3,3n -k4,4n \
    | cut -f5- \
    | awk '
started || /Special Abilities/ { started = 1 }
/^CLERIC TURNING UNDEAD TABLE$/ { exit }
started { print }
' \
    | sed '/^[[:space:]]*[0-9][0-9]*[[:space:]]*$/d' >> "$OUT"
  printf '\nCLERIC TURNING UNDEAD TABLE\n' >> "$OUT"
  printf 'Cleric Level   Skeleton   Zombie   Ghoul   Wight\n' >> "$OUT"
  printf '1              7          9        11      N\n' >> "$OUT"
  printf '2              T          7        9       11\n' >> "$OUT"
  printf '3              T          T        7       9\n' >> "$OUT"
  printf '\n' >> "$OUT"
  awk -F '\t' '
NR==1 { next }
$1 == 1 { page = $2 + 0; next }
$1 == 4 {
  if (have && text != "") {
    col = 1
    if ((line_left + 0) >= 190) col = 2
    if ((line_left + 0) >= 370) col = 3
    printf "%d\t%d\t%f\t%d\t%s\n", page, col, line_top, seq++, text
  }
  have = 1
  line_left = $7 + 0
  line_top = $8 + 0
  text = ""
  next
}
$1 == 5 && have {
  text = (text == "" ? $12 : text " " $12)
  next
}
END {
  if (have && text != "") {
    col = 1
    if ((line_left + 0) >= 190) col = 2
    if ((line_left + 0) >= 370) col = 3
    printf "%d\t%d\t%f\t%d\t%s\n", page, col, line_top, seq++, text
  }
}
' "$TMPDIR/basic27.tsv" \
    | sort -t $'\t' -k1,1n -k2,2n -k3,3n -k4,4n \
    | cut -f5- \
    | awk '
started && /^Undead Monster$/ { next }
started && /^Zombie$/ { next }
started && /^Ghoul$/ { next }
started && /^Wight$/ { next }
started && /^[1279NT]+$/ { next }
/^Success: If the attempt at Turning Un-/ { started = 1; print; next }
started { print }
' \
    | sed '/^[[:space:]]*[0-9][0-9]*[[:space:]]*$/d' >> "$OUT"
  printf '\n```\n\n' >> "$OUT"
}

basic_higher_level_spells_block_named() {
  local label="$1"
  local note="$2"
  local pdf="${3:-}"

  printf '### %s\n\n' "$label" >> "$OUT"
  printf -- '- Extraction note: %s\n\n' "$note" >> "$OUT"

  if [ -n "$pdf" ]; then
    local extracted=''
    extracted=$(render_tsv_cols_pages "$pdf" 19 20 '190,370' \
      | awk '
          /Higher Level Spells/ { started = 1 }
          started { print }
          /For magic-user characters, good/ { if (started) exit }
        ' \
      | sed '/^[[:space:]]*[0-9][0-9]*[[:space:]]*$/d')

    if printf '%s\n' "$extracted" | grep -Fq 'Higher Level Spells' \
      && printf '%s\n' "$extracted" | grep -Fq 'HIGH LEVEL CLERICS' \
      && printf '%s\n' "$extracted" | grep -Fq 'Third Level Magic-user Spells' \
      && printf '%s\n' "$extracted" | grep -Fq 'Giving Magic-Users Spells'; then
      printf '```text\n' >> "$OUT"
      printf '%s\n\n' "$extracted" >> "$OUT"
      printf '```

' >> "$OUT"
      return 0
    fi
  fi

  printf '```text\n' >> "$OUT"
  cat >> "$OUT" <<'TXT'
[Basic DM page 17: Higher Level Spells]
Higher Level Spells

The following spells are only for the DM's use when developing NPCs of an experience level higher than 3rd. The spells given are not the only spells of these higher levels. A full list of higher level spells is given in the D&D EXPERT Set. For now, the DM should use these as the only higher level spells available to NPCs.

Higher level spell casters will never go on adventures with player characters. They may be encountered as part of an NPC party, but make very dangerous enemies, and should rarely be used.

These spells might also be found on magical scrolls (treasure). The DM should be very careful when allowing this, as lower level characters should not become as powerful as these spells permit.

HIGH LEVEL CLERICS

Level   Spells
4       2 First level, 1 Second level
5       2 First level, 2 Second level

Second Level Cleric Spells
1. Bless*
2. Hold Person
3. Silence 15' radius

Explanation of Second Level Clerical Spells

Bless*
Range: Touch
Duration: 6 turns
Effect: All friends within 60'

This spell raises the morale of all friendly creatures in range by +1, and gives a bonus of +1 to all their Hit and Damage rolls. It only affects those not yet in battle.

Hold Person
Range: 180'
Duration: 9 turns
Effect: 1-4 persons (cleric's choice)

This spell will affect any human, demi-human or human-like creature (such as bugbears, gnolls, gnomes, hobgoblins, kobolds, lizard men, ogres, orcs, pixies or sprites). It will not affect undead nor creatures of 5 Hit Dice or more. The victim(s) must make a Saving Throw vs. Spells or be paralyzed.

This spell may be cast either at a single creature or at a group. If cast at a single creature, that victim must make a Saving Throw vs. Spells with a -2 penalty to the die roll. If cast at a group, it may affect up to 4 creatures, but no penalties apply to the Saving Throws.

Silence 15' Radius
Range: 180'
Duration: 12 turns
Effect: A spherical volume 30' across

This spell will make the given area totally quiet. Conversation and spells in this area will be prevented for the duration of the spell. This spell does not prevent a person within the area from hearing noises made outside the area. If cast at a creature, the victim must make a Saving Throw vs. Spells, or the silence will move along with the victim. If the Saving Throw is successful, the spell will remain in the area to which it was cast, and the intended victim may move away from it.

HIGH LEVEL MAGIC-USERS AND ELVES

Level   Spells
4       2 First Level, 2 Second Level
5       2 First Level, 2 Second Level, 1 Third Level
6       2 First Level, 2 Second Level, 2 Third Level

Third Level Magic-user Spells
1. Dispel Magic
2. Fire Ball
3. Fly

[Basic DM page 18: Third Level Magic-user Spells and spell assignment guidance]
Dispel Magic
Range: 120'
Duration: permanent
Effect: A volume 20' x 20' x 20'

This spell will automatically destroy other spell effects within the given volume. It cannot affect magic items, but will remove any spell effect created by a magic-user, elf, or cleric of a level equal to lower than the spell caster. It may fail to remove magical effects created by a higher level caster. This chance of failure is 5% per level of difference between the spell casters. A monster's level is its Hit Dice, ignoring any "plusses." For example, a 5th level elf trying to dispel a Charm Person cast by a 7th level magic-user has a 10% chance of failure.

Fire Ball
Range: 240'
Duration: instantaneous
Effect: A spherical volume 40' across

This spell creates a missile of fire which explodes into a ball of fire of 20' radius when it reaches the desired range or strikes a target. The Fire Ball inflicts 1-6 (1d6) points of fire damage for each level of the spell caster. Each victim within the area of effect takes full damage unless a Saving Throw vs. Spells is made. Even if the Saving Throw is successful, the victims take half the rolled damage. For example, a Fire Ball cast by a 6th level magic-user explodes for 6-36 (6d6) points of damage. If the total roll is 24, all within the area who make their Saving Throws take 12 points of fire damage.

Fly
Range: Touch
Duration: 1d6 turns + 1 turn per level of the spell caster
Effect: Any one living creature

This spell allows the caster (or a person touched) to fly. The spell will permit movement in any direction and at any speed up to 120' per round. It will also allow the person to stop at any point (as a Levitate spell). The person the spell is cast on has control over the flying. The exact duration is not known to anyone but the Dungeon Master. For example, a 5th level elf may fly, using this spell, for 6-11 (1d6 + 5) turns.

Giving Magic-Users Spells

When a player starts a magic-user or elf character, the player will ask you what spells the character has in the spell book. The magic-user's teacher is a higher level NPC magic-user, and the spells come from the teacher. The "spell book" assumed in the game can simply be a list of spells kept on the character sheet. You may play the role of the teacher if you wish, but this may also be assumed.

This system for spells allows you, the DM, to keep control of the spells used in the game. For example, you may wish to avoid Charm Person spells. You can avoid it simply by not giving it to the characters.

The first spell given should always be Read Magic. This allows the character to read scrolls found, and would be a basic part of the character's training.

The second spell given to a beginning magic-user character should be fairly powerful. You should avoid giving Detect Magic, Light, or Protection From Evil as the second spell, as these are nearly the same as the cleric versions (easily acquired by a 2nd or higher level cleric).

You may give any "second spell" to a beginning elf character. The elf's many talents keep that character class balanced with the others, whatever spells are known. The player of an elf can feel useful in many ways; the spell is an additional bonus, not the character's only specialty. A magic-user character is different. The magic-user has only one specialty - spells - and suffers from low hit points, poor Armor Class, and severe weapon restrictions.

For magic-user characters, good "second spells" are Charm Person, Magic Missile, Sleep (all useful attack-type spells), and Shield (a valuable protection).

[Basic player page 38: spell books and lost spell books]
Spell Books

Different magic-users often have different spells in their books. For example, you might start with the Read Magic and Sleep spells, and find another magic-user who knows Read Magic and Magic Missile. But magic-users never trade spells, nor do they ever allow anyone (except their teachers) to read their spell books. The risk of losing the book or having it damaged is too great.

If a magic-user's book is lost, the character cannot memorize any spells to cast.

One magical treasure which may be found during an adventure is a magic scroll. Some scrolls contain magic-user spells. If a new spell is found on a scroll, it may be added to the magic-user's book, but this can only be done once for each scroll spell, and uses up the scroll in the process. If the spell is of too high a level to be cast, it cannot be put into the book.

A spell on a scroll may be saved, to be put into a book at a future time. It may also be carried during adventures, to be cast as needed. Any magic-user can cast a spell found on a scroll as if it were memorized, regardless of the level of the spell. If the spell is cast, it disappears from the scroll.
TXT
  printf '\n```\n\n' >> "$OUT"
}

basic_scrolls_block_named() {
  local label="$1"
  local note="$2"
  local pdf="${3:-}"

  printf '### %s\n\n' "$label" >> "$OUT"
  printf -- '- Extraction note: %s\n\n' "$note" >> "$OUT"

  if [ -n "$pdf" ]; then
    local extracted=''
    extracted=$(render_tsv_cols_pages "$pdf" 113 116 '190,370' \
      | awk '
        /e\. Scrolls/ { started = 1 }
        /Creating dungeons|The World of D&D Gaming|Other Player Aids|Glossary/ { if (started) exit }
        started { print }
        ' \
      | sed '/^[[:space:]]*[0-9][0-9]*[[:space:]]*$/d')

    if printf '%s\n' "$extracted" | grep -Fq 'e. Scrolls' \
      && printf '%s\n' "$extracted" | grep -Fq 'f. Rings' \
      && printf '%s\n' "$extracted" | grep -Fq 'g. Wands, Staves, and Rods' \
      && printf '%s\n' "$extracted" | grep -Fq 'h. Miscellaneous Magic Items'; then
      printf '```text\n' >> "$OUT"
      printf '%s\n\n' "$extracted" >> "$OUT"
      printf '```

' >> "$OUT"
      return 0
    fi
  fi

  printf '```text\n' >> "$OUT"
  cat >> "$OUT" <<'TXT'
[Basic treasure pages 43-44: Scrolls and Rings]
e. Scrolls

A scroll is a piece of old paper or parchment upon which a high level magic-user, elf or cleric has written a magical formula. To use a scroll, there must be enough light to read by, and the scroll must be read aloud. A scroll can only be used once, for the words will fade from the scroll when they are read aloud. A spell scroll can only be read by a magic-user, elf, or cleric (depending on the type of spell), but a Protection Scroll or a Treasure Map can be read by anyone.

Spell Scroll: These scrolls may have 1, 2, or 3 spells written on them. If more than one spell is written on a scroll, only the spell cast will disappear when read. Spell scrolls may have either magic-user or cleric spells on them. To find the type, roll 1d4:

TYPE OF SPELL ON SCROLL
Die Roll   Type
1          Cleric spell
2-4        Magic-user spell

Magic-user spells are written in a magical language and cannot be read until a Read Magic spell is used to read them. Cleric scrolls are written in the Common tongue but only a cleric will understand how to use the spells.

Magic-users and elves cannot use cleric scrolls, nor can clerics read magic-user scrolls.

You may either choose the spells on a scroll or determine them randomly. If you wish to choose them randomly, roll 1d6 for each spell and use the chart below to find the spell level. Then roll to determine the exact spell, using the spell lists in the PLAYERS MANUAL or the 3rd level spell list in this booklet.

LEVEL OF SPELL ON SCROLL
Die Roll   Level
1-3        1st level
4-5        2nd level
6          3rd level

Cursed Scroll: Unfortunately, when any writing on a cursed scroll is even seen, the victim is immediately cursed. No reading is necessary. The DM must make up each curse. Examples of a few common curses are:

1. The reader turns into a frog (or some other harmless animal).
2. A wandering monster of the same level as the reader appears and attacks the reader by surprise (a free attack with bonuses).
3. One magic item owned by the reader disappears (the item is chosen or randomly determined by the DM).
4. The reader loses one level of experience, as if struck by a wight. You should roll again for a first level character, to avoid unfair "instant death."
5. The reader's Prime Requisite must be rerolled.
6. Wounds will take twice as long to heal, and healing spells only restore half normal amounts.

Only a Remove Curse spell can remove a curse of this nature. However, you may allow the cursed character to be cured by a high level NPC cleric or magic-user, who will demand that the character complete a special adventure or perform a worthy but difficult task.

Protection Scroll: A protection scroll may be read and used by any class. When read, it creates a circle of protection 10' across which will move with the reader at its center. It will prevent any of the given creatures from entering this circle, but does not prevent spell or missile attacks from those creatures. The circle will be broken if anyone protected attacks one of the given creatures in hand-to-hand combat.

Protection from Lycanthropes: When read, this scroll will protect all those within the circle from a variable number of lycanthropes for 6 turns. The number of lycanthropes affected varies according to their type, as follows:

Wererats:              1-10 affected
Werewolves, wereboars: 1-8 affected
Weretigers, werebears: 1-4 affected

Protection from Undead: When read, this scroll will protect all those within the circle from a variable number of undead for 6 turns. The number of undead affected varies according to their type, as follows:

Skeletons, zombies, or ghouls:  2-24 affected
Wights, wraiths, or mummies:    2-12 affected
Spectres (or larger):           1-6 affected

Treasure Map: A treasure map should be made by the DM in advance, and should show the location of some treasure hoard in a dungeon. The DM may choose any combination of treasures to equal the total value given. These treasures should be guarded by monsters. Sometimes maps are only partially complete, or are written in the form of riddles, and can only be read by using a Read Languages spell.

f. Rings

A magical ring must be worn on a finger or thumb to be used. A ring may also be carried and put on when desired. Only one magic ring can be worn on each hand. If more than that are worn, none of the rings will function, with the exception of a ring of weakness. Any ring may be used by any character class.

Animal Control: The wearer of this ring may command 1-6 normal animals (or 1 giant-sized). The animals are not allowed a Saving Throw. The ring will not control intelligent animal races or fantastic or magical monsters. The wearer must be able to see the animals to control them. The control will last as long as the wearer concentrates and does not move or fight. When the wearer stops concentrating, the animals will be free to attack their controller or run away (roll reactions with a penalty of -1 on the roll). This ring can only be used once per turn.

Fire Resistance: The wearer of this ring will not be harmed by normal fires, and gains a bonus of +2 on all Saving Throws vs. Fire Spells and vs. Red Dragon breath. In addition, the DM must subtract 1 point from each die of fire damage to the wearer (with a minimum damage of 1 point per die rolled to determine the damage).

Invisibility: The wearer is invisible as long as the ring is worn. If the wearer attacks or casts spells, he or she will become visible. The wearer can only become invisible once per turn.

Protection +1: This ring improves the wearer's Armor Class by 1. For example, a magic-user with no armor (AC 9) would be AC 8 when wearing the ring. This item also adds a bonus of +1 to all of the wearer's Saving Throw rolls.

Water Walking: The wearer of this ring may walk on the surface of any body of water, and will not sink.

Weakness: When this ring is put on, the wearer becomes weaker, and his or her Strength score becomes 3 within 1-6 rounds. The wearer cannot take off this ring unless a Remove Curse spell is used.

d. Potions

Potions are usually found in small glass vials, similar to Holy Water. Each potion has a different smell and taste, even two potions with the same effect. Unless stated otherwise, the effect of a potion lasts 7-12 turns. Only the DM should know the exact duration and should keep track of it when the potion is used. The entire potion must be drunk to have this effect. A potion may be sipped to discover its type and then used later. Drinking a potion takes one round. Sipping a potion does not decrease its effect or duration.

If a character drinks a potion while another potion is still in effect, that character will become sick and will be unable to do anything, with no saving throw, for 3 turns, and neither potion will have any further effect. A potion of healing has no duration for this calculation.

Diminution: The user immediately shrinks to 6 inches in height and can do no damage when physically attacking larger creatures. The user's normal movement rate is halved. The effect lasts 6 turns. This potion will negate a potion of growth.

ESP: The user may read the thoughts of one creature in 30' by concentrating for one turn. It lasts 12 turns.

Gaseous Form: The user becomes a cloud of gas for 6 turns. In this form the user cannot attack, cast spells, or use items, but may move through small openings.

Growth: The user grows to twice normal size, temporarily increasing Strength and giving the ability to inflict double damage on any successful hit. The user's hit points do not increase. This potion will negate a potion of diminution.

Healing: Like the clerical cure light wounds spell, this potion restores 2-7 lost hit points or cures paralysis for one creature.

Invisibility: This potion has the same effects as the magic-user spell invisibility. It makes the user invisible. Items carried and worn by that character also become invisible. Any invisible item becomes visible again when it leaves the character's possession. The DM may allow this potion to be drunk in 6 small amounts, each one effective for 1 turn.

Levitation: This potion has the same effects as the magic-user spell levitation. The user may move up or down without support, but not side-to-side except by pushing or pulling. Vertical movement is 60' per round.

Poison: The user must make a Saving Throw vs. Poison or die. The result is known in 1-10 turns.

g. Wands, Staves, and Rods

A wand is a thin smooth stick about 18 inches long. A rod is similar, but 3 feet long, and a staff is 2 inches thick and about 6 feet long. In D&D BASIC rules, wands may only be used by magic-users and elves, and staves may only be used by clerics. A wand contains 1-10 charges when found.

Wand of Enemy Detection: When a charge is used, all enemies within 60', even hidden or invisible ones, glow as if on fire.

Wand of Magic Detection: When a charge is used, any magic item within 20' glows. If the item cannot normally be seen, such as inside a closed chest, the glow is not seen.

Wand of Paralyzation: When a charge is used, this wand projects a cone-shaped ray 60' long and 30' wide at its end. Any creature struck must make a Saving Throw vs. Wands or be paralyzed for 6 turns.

Staff of Healing: This item heals 2-7 points of damage per use. It may only be used once per day on each person, but can heal any number of persons once per day. It does not have or use charges.

Snake Staff: This magical staff is a Staff +1 and inflicts 2-7 points of damage per hit. Upon command, it turns into a snake and coils around a creature it hits. The victim may make a Saving Throw vs. Spells to avoid the serpent's coil. Any man-sized or smaller victim is held helpless for 1-4 turns unless released sooner. Larger creatures cannot be coiled. When freed, the snake returns to its owner and becomes a staff again. The snake is completely healed when it returns to staff form. If killed in snake form, it does not return to staff form and loses all magical properties. It does not have or use charges.

Rod of Cancellation: This rod is usable by any character. It works only once, but drains any magic item it hits, making that item forever non-magical. The target is treated as Armor Class 9. The DM may adjust this Armor Class if the item is being used in combat.

h. Miscellaneous Magic Items

Bag of Devouring: This item looks like a normal small sack, but anything placed within it disappears. If not removed within 7-12 turns, the contents are forever lost.

Bag of Holding: This item looks like a normal small sack, but will actually hold treasures up to 10,000 cn in weight while only weighing 600 cn when full. An item may be no larger than 10' x 5' x 3' to fit inside it.

Crystal Ball: This item can only be used by an elf or magic-user. Its owner may look into it and see any place or object thought of. It works 3 times per day, and the image lasts 1 turn. Spells cannot be cast through the crystal ball. The more familiar the object or area, the clearer the picture.

Elven Cloak: The wearer is nearly invisible; roll 1d6 and the wearer is seen only on a 1.

Elven Boots: The wearer may move with nearly complete silence; roll 1d10 and the wearer is heard only on a 1.

Gauntlets of Ogre Power: These gauntlets give the wearer Strength 18, gaining all normal bonuses. If a weapon is not used in combat, the wearer may strike with one fist each round for 1-4 points of damage with a +3 bonus on Hit Rolls.

Helm of Alignment Changing: When put on, this helm immediately changes the wearer's alignment, randomly determined by the DM. It may only be removed with Remove Curse, and the wearer resists removal. Once removed, the original alignment returns.

Helm of Telepathy: The wearer may send messages by thought to any creature within 90', and may also read the thoughts of a living creature within range. To use it, the wearer must concentrate on the creature and may not move or cast spells. If the creature fails a Saving Throw vs. Spells, or permits the thought reading, the wearer understands the creature's thoughts.

Medallion of ESP: If the wearer concentrates for 1 round, the wearer may read the thoughts of one creature within 30'. The wearer may move normally but cannot fight or cast spells while concentrating. The DM must roll 1d6 each time this item is used; on a 1, it broadcasts the wearer's thoughts to everyone within 30' instead.

Rope of Climbing: This rope climbs in any direction on command, fastens itself to protruding surfaces, and supports up to 10,000 cn of weight.
TXT
  printf '\n```\n\n' >> "$OUT"
}

basic_spell_lists_appendix() {
  local pdf="$1"
  printf '\n## Spell Lists Appendix\n\n' >> "$BASIC_OUT"

  printf '### Basic: Cleric Spell Lists (pages 26-27)\n\n' >> "$BASIC_OUT"
  printf '```text\n' >> "$BASIC_OUT"
  render_tsv_cols_pages "$pdf" 28 29 '190,370' \
    | awk '/FIRST LEVEL CLERIC SPELLS/ { started = 1 } started { print }' \
    | spell_list_smart_filter >> "$BASIC_OUT"
  printf '```\n\n' >> "$BASIC_OUT"

  printf '### Basic: Magic-User Spell Lists (pages 40-44)\n\n' >> "$BASIC_OUT"
  printf '```text\n' >> "$BASIC_OUT"
  render_tsv_cols_pages "$pdf" 40 44 '190,370' \
    | awk '/FIRST LEVEL MAGIC-USER SPELLS/ { started = 1 } started { print }' \
    | spell_list_smart_filter >> "$BASIC_OUT"
  printf '```\n\n' >> "$BASIC_OUT"

  printf '### Basic: Higher-Level Cleric Spell Lists (DM pages 17-18)\n\n' >> "$BASIC_OUT"
  printf '```text\n' >> "$BASIC_OUT"
  cat >> "$BASIC_OUT" <<'TXT'
Second Level Cleric Spells
1. Bless*
2. Hold Person
3. Silence 15' radius
TXT
  printf '```\n\n' >> "$BASIC_OUT"

  printf '### Basic: Higher-Level Magic-User Spell Lists (DM pages 17-18)\n\n' >> "$BASIC_OUT"
  printf '```text\n' >> "$BASIC_OUT"
  cat >> "$BASIC_OUT" <<'TXT'
Third Level Magic-user Spells
1. Dispel Magic
2. Fire Ball
3. Fly
TXT
  printf '```\n\n' >> "$BASIC_OUT"
}

basic_cleanup_misc_wrapper_tail() {
  perl -0pi -e '
    s/Rope of Climbing: This 50\x27 long, thin,\s*\n\s*strong rope/Rope of Climbing: This 50\x27 long, thin,\nstrong rope/g;
    s/^3\s+T\s+T\s+7\s+9$/3              T          T        7       9/mg;
    s/tur n/turn/g;
    s/Protection frm Undead:/Protection from Undead:/g;
  ' "$BASIC_OUT"
}

basic_magic_arms_armor_block_named() {
  local label="$1"
  local note="$2"
  local pdf="${3:-}"

  [ -z "$pdf" ] && return 0

  local extracted=''
  extracted=$(render_tsv_cols_pages "$pdf" 113 114 '190,370' \
    | awk '
        /A cursed sword will cause/ { started = 1 }
        started { print }
        /e\. Scrolls/ { if (started) exit }
      ' \
    | sed '/^[[:space:]]*[0-9][0-9]*[[:space:]]*$/d' \
    | sed '/^e\. Scrolls$/d')

  if printf '%s\n' "$extracted" | grep -Fq 'MAGICAL ARMOR TABLE' \
    && printf '%s\n' "$extracted" | grep -Fq 'Cursed Armor:' \
    && printf '%s\n' "$extracted" | grep -Fq 'b. Other Weapons'; then
    printf '### %s\n\n' "$label" >> "$OUT"
    printf -- '- Extraction note: %s\n\n' "$note" >> "$OUT"
    printf '```text\n' >> "$OUT"
    printf '%s\n\n' "$extracted" >> "$OUT"
    printf '```\n\n' >> "$OUT"
  fi
}

basic_magic_item_operation_block_named() {
  local label="$1"
  local note="$2"
  local pdf="${3:-}"

  [ -z "$pdf" ] && return 0

  local extracted=''
  extracted=$(render_tsv_cols_pages "$pdf" 111 116 '190,370' \
    | awk '
        /Identifying Magic Items/ { started = 1 }
        started { print }
        /Magic Item Descriptions:/ { if (started) exit }
      ' \
    | sed '/^[[:space:]]*[0-9][0-9]*[[:space:]]*$/d')

  if printf '%s\n' "$extracted" | grep -Fq 'Identifying Magic Items' \
    && printf '%s\n' "$extracted" | grep -Fq 'Types of Magic Items' \
    && printf '%s\n' "$extracted" | grep -Fq 'Using Magic Items' \
    && printf '%s\n' "$extracted" | grep -Fq 'Charges in Magic Items'; then
    printf '### %s\n\n' "$label" >> "$OUT"
    printf -- '- Extraction note: %s\n\n' "$note" >> "$OUT"
    printf '```text\n' >> "$OUT"
    printf '%s\n\n' "$extracted" >> "$OUT"
    if ! printf '%s\n' "$extracted" | grep -Fq 'Holy Water:'; then
      cat >> "$OUT" <<'TXT'
Additional Consumables

Holy Water: This is water specially prepared by a cleric for use against undead creatures. It can be used by any character. Holy Water must be kept in small, specially prepared glass bottles known as vials for it to remain Holy. The effect of one vial of Holy Water on an undead creature is 1-8 points of damage. To cause damage, it must successfully strike the target, thus breaking the vial. It may either be thrown using missile fire rules or used in hand-to-hand combat using normal combat rules.

TXT
    fi
    printf '```\n\n' >> "$OUT"
  fi
}

preflight_basic

extract_pdf "$BASIC_PDF" "$BASIC_TXT"
OUT="$BASIC_OUT"
write_header 'TODO: BECMI Spell Material Staging - Basic' 'TSR 1011B - Set 1 Basic Rules.pdf'
basic_cleric_rules_block_named 'Cleric Rules, Turning, and First-Level Spell Procedures' 'page-aware Basic extraction from the actual cleric special-abilities page, split by column so Turning Undead procedure, the undead table, and spellcasting guidance stay in readable source order.' "$BASIC_PDF"
basic_spell_lists_and_descriptions_block_named 'Spell Lists and Basic Spell Descriptions' 'iterative Basic extraction: the page 35 spell-list page is rebuilt as a curated readable list from the source page, the clerical description pages use TSV column reflow, and the magic-user spell-book plus spell-description pages now use page-aware TSV reflow instead of the earlier anchored text slice.' "$BASIC_PDF"
basic_higher_level_spells_block_named 'Higher Level Spells, Magic-User Spell Allocation, and Lost Spell Books' 'anchored TSV extraction from DM pages for higher-level cleric/magic-user procedures and spell-allocation doctrine, with curated fallback when anchor quality drops below required section coverage.' "$BASIC_PDF"
basic_magic_item_operation_block_named 'Magic Item Identification, Use Model, and Charge Doctrine' 'anchored TSV extraction from Basic treasure explanatory text covering identification procedure, permanent-vs-temporary typing, concentration-based item use constraints, and non-recharge charge behavior.' "$BASIC_PDF"
basic_magic_arms_armor_block_named 'Magical Weapons, Armor, and Cursed Item Doctrine' 'anchored TSV extraction from treasure pages for cursed-weapon behavior, magical armor table interpretation, and cursed-armor handling prior to the scroll and ring catalog.' "$BASIC_PDF"
basic_scrolls_block_named 'Scrolls and Spell-Adjacent Treasure Text' 'anchored TSV extraction from treasure pages for scroll/ring/item-operation doctrine, with curated fallback to preserve section completeness if extraction anchors degrade.' "$BASIC_PDF"
basic_spell_lists_appendix "$BASIC_PDF"
cleanup_output
basic_cleanup_misc_wrapper_tail

assert_in_file "$BASIC_OUT" '### Cleric Rules, Turning, and First-Level Spell Procedures' 'cleric procedures section heading'
assert_heading_count "$BASIC_OUT" 'Cleric Rules, Turning, and First-Level Spell Procedures' 1 'Basic staging duplicated the cleric procedures section heading'
assert_in_file "$BASIC_OUT" 'CLERIC TURNING UNDEAD TABLE' 'Turning Undead table marker'
assert_in_file "$BASIC_OUT" '### Spell Lists and Basic Spell Descriptions' 'spell lists section heading'
assert_heading_count "$BASIC_OUT" 'Spell Lists and Basic Spell Descriptions' 1 'Basic staging duplicated the spell-lists section heading'
assert_in_file "$BASIC_OUT" 'FIRST LEVEL CLERIC SPELLS' 'cleric spell-description block'
assert_in_file "$BASIC_OUT" 'SECOND LEVEL' 'second-level spell heading'
assert_in_file "$BASIC_OUT" '### Higher Level Spells, Magic-User Spell Allocation, and Lost Spell Books' 'higher-level procedures section heading'
assert_heading_count "$BASIC_OUT" 'Higher Level Spells, Magic-User Spell Allocation, and Lost Spell Books' 1 'Basic staging duplicated the higher-level procedures section heading'
assert_in_file "$BASIC_OUT" 'Giving Magic-Users Spells' 'spell-allocation procedure text'
assert_in_file "$BASIC_OUT" '### Magic Item Identification, Use Model, and Charge Doctrine' 'item-operation doctrine section heading'
assert_heading_count "$BASIC_OUT" 'Magic Item Identification, Use Model, and Charge Doctrine' 1 'Basic staging duplicated the item-operation doctrine section heading'
assert_in_file "$BASIC_OUT" 'Identifying Magic Items' 'item identification anchor'
assert_in_file "$BASIC_OUT" 'Charges in Magic Items' 'item charge-doctrine anchor'
assert_in_file "$BASIC_OUT" 'Holy Water:' 'holy water consumable doctrine anchor'
assert_in_file "$BASIC_OUT" '### Scrolls and Spell-Adjacent Treasure Text' 'scroll section heading'
assert_heading_count "$BASIC_OUT" 'Magical Weapons, Armor, and Cursed Item Doctrine' 1 'Basic staging duplicated the magic-arms-and-armor section heading'
assert_heading_count "$BASIC_OUT" 'Scrolls and Spell-Adjacent Treasure Text' 1 'Basic staging duplicated the scroll/item section heading'
assert_in_file "$BASIC_OUT" 'e. Scrolls' 'scroll subtype block'
assert_in_file "$BASIC_OUT" 'g. Wands, Staves, and Rods' 'wand/staff/rod block'
assert_in_file "$BASIC_OUT" 'Rope of Climbing:' 'Rope of Climbing heading'
assert_file_contains "$BASIC_OUT" 'Rope of Climbing:[\s\S]*strong rope' 'Basic staging lost the Rope of Climbing continuation tail'
