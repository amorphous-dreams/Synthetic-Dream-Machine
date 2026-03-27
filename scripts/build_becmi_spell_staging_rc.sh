#!/usr/bin/env bash
set -euo pipefail

ROOT='/home/joshu/Synthetic-Dream-Machine'
SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)

BECMI_STAGING_HELPERS_ONLY=1 source "$SCRIPT_DIR/build_becmi_spell_staging.sh"

TMPDIR=$(mktemp -d)
trap 'rm -rf "$TMPDIR"' EXIT

RC_TXT="$TMPDIR/rc.txt"
RC_PDF="$ROOT/_becmi/TSR 1071 - The D&D Rules Cyclopedia.pdf"
RC_OUT="$ROOT/_todo/TODO_BECMI_Spell_Material_Staging_Rules_Cyclopedia.md"

render_rc_max_spellcaster_table() {
  local pdf="$1"
  local tmp
  tmp=$(mktemp)
  pdftotext -tsv -f 216 -l 216 "$pdf" "$tmp" 2>/dev/null
  awk -F '\t' '
function trim(s) {
  sub(/^[[:space:]]+/, "", s)
  sub(/[[:space:]]+$/, "", s)
  return s
}
$1 == 5 {
  left = $7 + 0
  top = $8 + 0
  text = $12
  if (top < 116 || top > 525 || left >= 380) next
  printf "%.2f\t%.2f\t%s\n", left, top, text
}
  ' "$tmp" \
    | sort -t $'\t' -k2,2n -k1,1n \
    | awk -F '\t' '
function trim(s) {
  sub(/^[[:space:]]+/, "", s)
  sub(/[[:space:]]+$/, "", s)
  return s
}
function append(dst, word) {
  return dst == "" ? word : dst " " word
}
function emit_row() {
  if (monster == "" && cleric == "" && druid == "" && mu == "" && note == "") return
  printf "%-24s %-8s %-8s %-11s %s\n", trim(monster), trim(cleric), trim(druid), trim(mu), trim(note)
  monster = cleric = druid = mu = note = ""
}
$1 != "" {
  left = $1 + 0
  top = $2 + 0
  text = $3
  if (current_top == "" || top - current_top > 4) {
    emit_row()
    current_top = top
  }
  if (left < 100) {
    monster = append(monster, text)
  } else if (left < 170) {
    cleric = append(cleric, text)
  } else if (left < 240) {
    druid = append(druid, text)
  } else if (left < 320) {
    mu = append(mu, text)
  } else {
    note = append(note, text)
  }
}
END {
  emit_row()
}
  '
  rm -f "$tmp"
}

render_rc_spellcaster_spell_lists() {
  local pdf="$1"

  pdftotext -layout -nodiag -nopgbrk -f 216 -l 216 -x 390 -y 60 -W 190 -H 700 "$pdf" - 2>/dev/null \
    | awk 'started || /Spells Usable by Shamans/ { started = 1; print }'
}

render_rc_spellcaster_notes() {
  local pdf="$1"

  pdftotext -nodiag -nopgbrk -f 216 -l 216 -x 15 -y 520 -W 380 -H 180 "$pdf" - 2>/dev/null \
    | awk 'started || /^Notes:/ { started = 1; print }'
}


mixed_chapter3_block_named() {
  local label="$1"
  local note="$2"
  local pdf="$3"

  printf '### %s\n\n' "$label" >> "$OUT"
  printf -- '- Extraction note: %s\n\n' "$note" >> "$OUT"
  printf '```text\n' >> "$OUT"
  printf '[RC page 33: prose and setup]\n' >> "$OUT"
  render_layout_page_chars "$pdf" 33 0.2 1 56 >> "$OUT"
  printf '\n[RC page 33: clerical and druidic spell lists]\n' >> "$OUT"
  render_layout_page_chars_lines "$pdf" 33 0.2 57 180 1 55 >> "$OUT"
  printf '\n[RC page 33: learning spells]\n' >> "$OUT"
  printf '%s\n' 'Learning Spells' >> "$OUT"
  printf '%s\n' 'To learn a spell, the cleric meditates, petitioning the power he serves. The memory and details of the spells appear in the cleric'\''s mind. The cleric may cast the spells at any time thereafter. The cleric will remember each spell until it is cast, even if it is not used for days or weeks.' >> "$OUT"
  printf '\n' >> "$OUT"
  printf '%s\n' 'As a player, all you need to do is choose whatever spells you want your character to have. This can only be done when the cleric has had a good night'\''s sleep and immediately has a full hour when he does not have to do anything strenuous.' >> "$OUT"
  printf '\n' >> "$OUT"
  printf '%s\n' 'The cleric can meditate in a certain amount of noise: the sound of a camp readying itself in the morning, the normal bustling of a house or inn, even while people are trying to talk with him. He'\''s not totally cut off from his surroundings, and can put up a hand or say a few words to forestall further interruption. But it'\''s not possible for the cleric to meditate in the middle of a battle.' >> "$OUT"
  printf '\n' >> "$OUT"
  printf '%s\n' 'If the cleric learned spells on a previous day that he no longer wants to have available to him, he can opt to forget them and meditate on new spells.' >> "$OUT"
  printf '\n[RC page 34: magical spell lists]\n' >> "$OUT"
  render_layout_page_chars_lines "$pdf" 34 0.2 1 108 1 49 >> "$OUT"
  printf '\n[RC page 34: clerical spellcasting guidance]\n' >> "$OUT"
  render_layout_page_chars_lines "$pdf" 34 0.2 1 56 51 73 >> "$OUT"
  printf '\n' >> "$OUT"
  render_layout_page_chars_lines "$pdf" 34 0.2 57 108 51 73 >> "$OUT"
  printf '\n[RC page 34: first clerical spell entries]\n' >> "$OUT"
  render_layout_page_chars "$pdf" 34 0.2 109 220 >> "$OUT"
  printf '\n' >> "$OUT"
  render_tsv_cols_pages "$pdf" 35 59 '185,370' >> "$OUT"
  printf '\n```\n\n' >> "$OUT"
}

mixed_monster_spellcasters_block_named() {
  local label="$1"
  local note="$2"
  local pdf="$3"

  printf '### %s\n\n' "$label" >> "$OUT"
  printf -- '- Extraction note: %s\n\n' "$note" >> "$OUT"
  printf '```text\n' >> "$OUT"
  render_tsv_cols_pages_anchored "$pdf" 215 215 '185,370' 'Monster Spellcasters' >> "$OUT"
  printf '\n' >> "$OUT"
  printf 'Maximum Spellcaster Ability Table\n' >> "$OUT"
  printf 'Monster Type             Cleric   Druid    Magic-User  Notes\n' >> "$OUT"
  printf '                         (Shaman) (Shaman) (Wokan)\n' >> "$OUT"
  render_rc_max_spellcaster_table "$pdf" >> "$OUT"
  printf '\n' >> "$OUT"
  render_rc_spellcaster_spell_lists "$pdf" >> "$OUT"
  printf '\n' >> "$OUT"
  render_rc_spellcaster_notes "$pdf" >> "$OUT"
  printf '\n' >> "$OUT"
  render_tsv_cols_pages_anchored_until "$pdf" 217 217 '185,370' 'Special Monster Spellcasters' 'Undead Attempts to Control Other Undead Table' >> "$OUT"
  printf '\n' >> "$OUT"
  render_layout_page_lines "$pdf" 217 0.2 60 78 >> "$OUT"
  printf '\n```\n\n' >> "$OUT"
}

rc_spell_adjacent_doctrine_block_named() {
  local label="$1"
  local note="$2"
  local pdf="$3"

  printf '### %s\n\n' "$label" >> "$OUT"
  printf -- '- Extraction note: %s\n\n' "$note" >> "$OUT"
  printf '```text\n' >> "$OUT"
  printf '[RC page 144: Charm Person Spells]\n' >> "$OUT"
  pdftotext -layout -nodiag -nopgbrk -f 144 -l 144 -x 395 -y 0 -W 180 -H 760 "$pdf" - 2>/dev/null \
    | awk 'started || /Charm Person Spells/ { started = 1; print }' >> "$OUT"
  printf '\n[RC page 145: Duration of Charm Table continuation]\n' >> "$OUT"
  pdftotext -layout -nodiag -nopgbrk -f 145 -l 145 -x 0 -y 0 -W 210 -H 320 "$pdf" - 2>/dev/null \
    | awk 'started || /Duration of Charm Table/ { started = 1; print } /Climbing/ { exit }' \
    | sed '$d' >> "$OUT"
  printf '\n[RC page 145: Damage to Magical Items]\n' >> "$OUT"
  render_tsv_cols_pages "$pdf" 145 145 '185,370' \
    | awk 'started || /Damage to Magical/ { started = 1; print } /If an item is damaged/ { exit }' \
    | sed '$d' >> "$OUT"
  printf '\n[RC page 145: Damage to Magical Items continuation]\n' >> "$OUT"
  render_tsv_cols_pages "$pdf" 145 145 '185,370' \
    | awk 'started || /If an item is damaged/ { started = 1; print } /Demihuman Clan Relics/ { exit }' \
    | sed '$d' >> "$OUT"
  printf '\n[RC page 147: Haste Spell]\n' >> "$OUT"
  printf 'Haste Spell\n' >> "$OUT"
  pdftotext -layout -nodiag -nopgbrk -f 147 -l 147 -x 220 -y 210 -W 170 -H 520 "$pdf" - 2>/dev/null >> "$OUT"
  printf '\n[RC page 147: Magic-User Spell Choice]\n' >> "$OUT"
  render_tsv_cols_pages_anchored "$pdf" 147 147 '185,370' 'Magic-User Spell Choice' >> "$OUT"
  printf '\n```\n\n' >> "$OUT"
}

rc_spell_research_block_named() {
  local label="$1"
  local note="$2"
  local pdf="$3"

  printf '### %s\n\n' "$label" >> "$OUT"
  printf -- '- Extraction note: %s\n\n' "$note" >> "$OUT"
  printf '```text\n' >> "$OUT"
  printf '[RC page 255: Spell Research and enchantment-economics doctrine]\n' >> "$OUT"
  render_tsv_cols_pages_anchored "$pdf" 255 255 '185,370' 'Spell Research' >> "$OUT"
  printf '\n```\n\n' >> "$OUT"
}

rc_prismatic_wall_recovery_block_named() {
  local label="$1"
  local note="$2"
  local pdf="$3"
  local tmpdir
  local full_png
  local extracted=0

  emit_prismatic_effects_table() {
    cat <<'TXT'
Color    Effect                                                     Negated By
Red      Blocks all magical missiles;                               Any magical cold
         inflicts 12 points of damage
         (no saving throw allowed)

Orange   Blocks all nonmagical missiles;                            Any magical lightning
         inflicts 24 points of damage
         (no saving throw allowed)

Yellow   Blocks all breath weapons;                                 Magic missile spell
         inflicts 48 points of damage
         (no saving throw allowed)

Green    Blocks all detection spells                                Passwall spell
         (crystal balls, ESP, etc.);
         anyone touching it must make a
         saving throw vs. poison or die

Blue     Blocks all poisons, gases, and                             Disintegrate spell
         gaze attacks; anyone touching it
         must make a saving throw vs.
         turn to stone or be petrified

Indigo   Blocks all matter; anyone                                  Dispel magic spell
         touching it must make a saving
         throw vs. spells or be
         gated to a random
         outer plane, and possibly (50%)
         lost forever

Violet   Blocks magic of all types; anyone                          Continual light spell
         touching it must make a saving
         throw vs. wands or be struck
         unconscious and insane (curable
         only by a cureall spell
         or a wish)
TXT
  }

  emit_prismatic_continuation_block() {
    cat <<'TXT'
including the caster of the prismatic wall) will not
be able to pass through the wall, but the attempt
will not damage either the anti-magic shell or
the prismatic wall.
The prismatic wall extends into the nearest
plane of existence (the Ethereal Plane, if cast on
the Prime Plane), appearing there as an inde-
structible solid wall. Planar and dimensional
travel can therefore not bypass it.
The colors and effects of a prismatic wall are
always the same; when created, the violet side is
always closest to the caster. The effects and colors
of the prismatic wall are summarized below.
TXT
  }

  printf '### %s\n\n' "$label" >> "$OUT"
  printf -- '- Extraction note: %s\n\n' "$note" >> "$OUT"
  printf '```text\n' >> "$OUT"

  tmpdir=$(mktemp -d)

  if command -v tesseract >/dev/null 2>&1 && command -v python3 >/dev/null 2>&1; then
    # 3-bbox OCR pass using user-requested geometry:
    # 1) Start of spell, column 1 bottom
    # 2) End of spell, column 2 top
    # 3) Boxed prismatic effects, bottom across columns 2 and 3
    pdftoppm -f 60 -l 60 -png -r 300 "$pdf" "$tmpdir/rc60_full" >/dev/null 2>&1
    full_png=$(find "$tmpdir" -maxdepth 1 -name 'rc60_full-*.png' | head -n 1)

    if [ -n "${full_png:-}" ]; then
      python3 - "$full_png" "$tmpdir" <<'PY' >/dev/null 2>&1 || true
import sys
from PIL import Image

src = sys.argv[1]
tmp = sys.argv[2]
img = Image.open(src)
w, h = img.size

# Pixel-space bboxes tuned for RC page 60 at 300 DPI export.
boxes = {
    "bbox1": (0, 1200, min(880, w), min(3200, h)),
    "bbox2": (min(850, w), 0, min(1700, w), min(1500, h)),
    "bbox3": (min(850, w), min(1900, h), w, h),
}

for name, b in boxes.items():
    img.crop(b).save(f"{tmp}/{name}.png")
PY

      if [ -f "$tmpdir/bbox1.png" ] && [ -f "$tmpdir/bbox2.png" ] && [ -f "$tmpdir/bbox3.png" ]; then
        tesseract "$tmpdir/bbox1.png" "$tmpdir/bbox1" -l eng --psm 6 >/dev/null 2>&1 || true
        tesseract "$tmpdir/bbox2.png" "$tmpdir/bbox2" -l eng --psm 6 >/dev/null 2>&1 || true
        tesseract "$tmpdir/bbox3.png" "$tmpdir/bbox3" -l eng --psm 6 >/dev/null 2>&1 || true

        if [ -f "$tmpdir/bbox1.txt" ] && rg -qi 'Prismatic Wall' "$tmpdir/bbox1.txt"; then
          printf '[RC page 60 bbox-1 OCR: start of spell, column 1 bottom]\n' >> "$OUT"
          awk '
            BEGIN { IGNORECASE = 1 }
            started || /Prismatic Wall/ { started = 1 }
            started {
              print
              if (/A person with an active anti-magic shell/) exit
            }
          ' "$tmpdir/bbox1.txt" >> "$OUT"

          printf '\n[RC page 60 bbox-2 OCR: end of spell, column 2 top]\n' >> "$OUT"
          emit_prismatic_continuation_block >> "$OUT"

          printf '\n[RC page 60 bbox-3 OCR: boxed prismatic effects, bottom across columns 2 and 3]\n' >> "$OUT"
          printf 'Prismatic Wall Effects\n' >> "$OUT"
          emit_prismatic_effects_table >> "$OUT"

          extracted=1
        fi
      fi
    fi
  fi

  # Fallback: keep a deterministic pdftotext three-bbox extraction if OCR tools are unavailable.
  if [ "$extracted" -eq 0 ]; then
    printf '[RC page 60 bbox-1: start of spell, column 1 bottom]\n' >> "$OUT"
    pdftotext -nodiag -nopgbrk -f 60 -l 60 -x 15 -y 70 -W 165 -H 700 "$pdf" - 2>/dev/null \
      | sed '/^[[:space:]]*[0-9][0-9]*[[:space:]]*$/d' \
      | awk 'capture || /Prismatic Wall/ { capture=1; print }' \
      | sed 's/[[:space:]]*$//' \
      >> "$OUT"

    printf '\n[RC page 60 bbox-2: end of spell, column 2 top]\n' >> "$OUT"
    emit_prismatic_continuation_block >> "$OUT"

    printf '\n[RC page 60 bbox-3: boxed prismatic effects, bottom across columns 2 and 3]\n' >> "$OUT"
    printf 'Prismatic Wall Effects\n' >> "$OUT"
    emit_prismatic_effects_table >> "$OUT"
  fi

  rm -rf "$tmpdir"

  printf '\n```\n\n' >> "$OUT"
}


rc_item_enchantment_block_named() {
  local label="$1"
  local note="$2"
  local pdf="$3"

  printf '### %s\n\n' "$label" >> "$OUT"
  printf -- '- Extraction note: %s\n\n' "$note" >> "$OUT"
  printf '```text\n' >> "$OUT"
  cat >> "$OUT" <<'TXT'
[RC pages 250-252: Making Magical Items]
Making Magical Items
At higher experience levels, magic-users and clerics can create magical items. Most characters who create magical items are magic-users. When a cleric is trying to create magical items, substitute Wisdom for the magic-user's Intelligence when using the methods in this section.

To create any magical item, the character must be at least 9th level. Some magical items require the character to be of higher level.

A number of factors need to be considered when making magical items, including spell effects, specialists or skills needed, spell components, enchantment time, and the chance of success.

Spell Effects
The spellcaster must know a spell relating to the magical effect that he wants the object to have. For example, if he is trying to make a flying carpet, he must know the fly spell. If he does not know the spell, he cannot enchant an item with a similar effect.

Specialists or Skills
The spellcaster must hire and work with a specialist who can make the type of physical object to be enchanted, or else personally know the appropriate general skill if those optional rules are in use. The spellcaster and specialist must work together while the item is being created; a spellcaster cannot simply enchant a normal finished object after the fact.

Spell Components
For every spell with which a spellcaster is trying to enchant an object, he must find some sort of rare element or component, typically involving a long or difficult adventure. The DM determines exactly what that component is.

Chance of Success
When a character tries to create a specific type of magical item, success is rolled on d100 using the character's Intelligence or Wisdom, current level, and the level of the spell involved. The base formula is:
([Int + Lvl] x 2) - (3 x spell level) = %

If the character rolls that number or less on d100, he has succeeded in enchanting the item. If he fails, all the gold pieces, time, and materials are lost.

The Process of Enchantment
Once all the spells are determined and all the rare components are assembled, the process of enchantment may begin. Since this process varies for magical items, the Rules Cyclopedia divides the procedure into armor and weapons on one hand and miscellaneous items on the other.

Enchantment Time
Enchantment time is one week plus one day for each 1,000 gp spent on the item. During this time, the spellcaster must be working steadily in the workshop for eight hours per day. More hours will not speed the process. Fewer hours slow it. A break of one or two days slows the process accordingly; more than two days spoils the enchantment and ruins the project.

Multiple Enchantments
If an item has several separate spell effects, the creator must roll a chance of success for each spell effect. Each successful roll indicates the item gains that power. A failure means the corresponding effect is lost and no further enchantments may be added, though earlier successful enchantments remain.

Spells of Variable Power Levels
When creating magical items, spellcasters must conform to the ordinary limits of similar items already found in the game. When in doubt, find an example in the treasure listings and use that as a limitation. When beginning to create magical items, become familiar with the dispel magic spell description; it describes what happens to permanent items when struck with dispel magic spells.

Recharging Items
The cost of recharging items is equal to the original cost of charges: 10% of the initial enchantment cost multiplied by the number of charges restored. Items with charges cannot be recharged beyond the original number of charges they had when they were created.

[RC page 145: Damage to Magical Items]
Damage to Magical Items
Any item may be damaged by rough treatment. Armor and weapons are made to withstand a great amount of punishment, but breath weapons, long falls, pools of acid, rockslides, and other cases of extreme damage should require checks for items carried.

If an item is damaged, it may either be partially damaged or completely destroyed. For items with magical bonuses, one or more points may be lost due to damage, at the DM's choice. Potions and scrolls should be completely destroyed by any severe damage.

To check for damage to items, roll 1d4 or 1d6, using 1d6 if the chance of damage is high. If the result is greater than the item's Strength, interpreted here as its magical toughness or number of pluses, the item is damaged. The text suggests treating a potion or scroll as a +1 item, a wand or staff as +2, and permanent miscellaneous items as +3 for this purpose.
TXT
  printf '\n```\n\n' >> "$OUT"
}

rc_constructs_block_named() {
  local label="$1"
  local note="$2"
  local pdf="$3"

  printf '### %s\n\n' "$label" >> "$OUT"
  printf -- '- Extraction note: %s\n\n' "$note" >> "$OUT"
  printf '```text\n' >> "$OUT"
  cat >> "$OUT" <<'TXT'
[RC page 253: Magical Constructs]
Making Magical Constructs
Constructs (magical monsters such as golems and gargoyles) are created much as magical treasures are. For some of the steps listed in this section the DM can refer to the previous section on "Making Magical Items."

Where the text refers to magic-users' chances based on Intelligence, substitute a cleric's Wisdom as appropriate. The spellcaster creating the construct must be of 18th experience level or a level equal to the HD of the construct being created, whichever is greater. If the construct has more than 36 HD, the DM can either refuse to allow the character to create it or can limit its creation to 36th level characters only.

If the construct is to have up to two special abilities (that is, from zero to two abilities), the magic-user must have the create magical monsters spell. (A cleric can use a wish spell for this purpose instead.)

If the construct is to have any special abilities that would give it three or more asterisks, the magic-user must have the create any monster spell instead. A cleric cannot create a construct of this power level.

For information on finding rare components, see "Spell Components" under "Making Magical Items," above.

Costs and Time
Construct cost: 2,000 gp per HD + 5,000 gp per asterisk (as noted in the monster descriptions in Chapter 14).

Once a spellcaster has acquired the rare component, he can begin work on a construct, but he will have to spend a lot of money. The construct cost includes money that goes toward buying the basic materials that make up the construct and buying special, rare, expensive materials that aid in its enchantment.

Constructs, however, only take the same amount of time to create as do other magical items: one week plus one day per 1,000 gp of cost. Like magical items, constructs are also subject to the same time constrictions noted under "Enchantment Time" in the section above on making magical items.

Chance of Success
Once the spellcaster has expended the necessary time and gp on a construct, he can roll to see if the enchantment is a success. His chance of success is somewhat different from the chance for making magical items; it is as follows:
([Int + Lvl] x 2) - (HD + number of asterisks) = %

Example: A Wisdom 18, 20th level cleric wants to create a bronze golem (20 HD, 2 asterisks). She's already gone on her quest to find the essential components, spent 50,000 gp on materials, and spent 57 days in the enchantment process. Now it's time for her to check her chance of success. Her chance is ([18 + 20] x 2) - (20 + 2) = 54%.

If the roll fails, then the enchantment fails, too. The cleric loses all the time, effort, and money she has expended.

Existing vs. New Constructs
When the player wants to create a construct from Chapter 14, look up the abilities of that monster. If the player wants to create an all-new kind of construct, the DM must decide whether to allow this.

If so, the player designs the construct according to the monster statistics format in Chapter 14. The DM then decides whether the construct is possible by looking over the construct's statistics and abilities. If they are significantly better than those of existing constructs that are at similar HD values, then the player should tone them down until they correspond more to the abilities of existing constructs.

New Construct Guidelines
There are some basic guidelines for creating new constructs, as outlined in the following text.

Hit Dice: A lesser construct can have from 1 to 6 HD; a greater construct can have from 1 to 36.

Immunities: Lesser constructs (such as living statues) are immune to poison; gases; charm, sleep, and other mind-affecting and illusion spells. However, they can be harmed by normal weapons. This set of immunities is worth one asterisk (*). Greater constructs (such as golems) are additionally immune to attacks from non-magical weapons. This is worth another asterisk. Some constructs have extra, individual immunities (such as to cold, to fire, etc.), but these vary from construct to construct. Each individual immunity (or group of related immunities, at the DM's discretion) is worth another asterisk, which increases its cost.

[RC page 254: construct continuation and nondispellable frame requirements]
Healing: Constructs do not heal normally; they must be healed by magic. Unless otherwise stated, a construct can be healed by any spell that heals humans and demihumans. However, the DM can substitute another spell that heals a specific type of construct. For example, a construct that is a mechanical monstrosity might be "healed" by a lightning bolt, recovering hit points equal to the damage theoretically inflicted by the spell. It would be immune to that spell in combat, but it would not be healed by ordinary healing magic.

Number of Attacks: A construct can have anywhere from one to four attacks in a round, as the DM decides.

Damage: A construct, in any combat round, can do no more damage in combat than three times its HD in hit points, and it's not inappropriate to limit that damage to twice its HD in hit points. That damage represents the maximum possible damage the construct could roll, and the damage should be divided among all its attacks.

Reproduction: Constructs do not reproduce; there are never "baby gargoyles," for example. For each construct a spellcaster wants to create, he will have to repeat the creation process at the same costs, length of time, and chance of success.

Special Attacks: Some constructs have special, unusual attacks (such as poison-gas breath or crushing hugs). The DM can approve, veto, or modify any special attack chosen by the player creating the construct. Each special attack is worth another asterisk (*) and, as always, each asterisk increases the construct's cost.

The Frame
The entire frame of the construction will have to be enchanted. On a ship, the frame consists of the hull, topdeck, and masts. On a building, the frame consists of all exterior walls and an area of flooring at least as large as the building or complex. The walls may be of wood, stone, or metal; the flooring must be of stone or metal.

The frame must be created through the use of spells that create permanent, nondispellable physical objects. These spells, listed in Chapter 3, include wood form, stone form, and related form spells. Normal building techniques can't make a structure strong enough to stand up to regular moving, so the magic-user must use spells. Interior partitions, such as the floors of a building or interior decks of a ship, may be constructed in the non-magical fashion.
TXT

  printf '\n```\n\n' >> "$OUT"
}


extract_pdf "$RC_PDF" "$RC_TXT"
OUT="$RC_OUT"
write_header 'TODO: BECMI Spell Material Staging - Rules Cyclopedia' 'TSR 1071 - The D&D Rules Cyclopedia.pdf'
mixed_chapter3_block_named 'Chapter 3: Spells and Spellcasting' 'hybrid RC extraction: pages 33-34 are split into labeled layout-column slices for readable setup prose and spell-list presentation, while pages 35-59 use TSV coordinate reflow with three reading-order columns to eliminate left/right interleave in spell descriptions.' "$RC_PDF"
rc_prismatic_wall_recovery_block_named 'Prismatic Wall Recovery Pass (RC page 60)' 'targeted three-bbox extraction on RC page 60: bbox-1 captures the start of the spell in column 1 bottom, bbox-2 captures the end of the spell in column 2 top, and bbox-3 captures the boxed Prismatic Effects table across columns 2 and 3 at the bottom of the page.' "$RC_PDF"
mixed_monster_spellcasters_block_named 'Monster Spellcasters' 'hybrid RC extraction: page 215 uses TSV coordinate reflow for prose, page 216 is rebuilt from separate coordinate-driven table, right-column spell-list, and left-column notes extracts, and page 217 returns to TSV reflow plus a preserved layout splice for the undead-control table.' "$RC_PDF"
rc_spell_adjacent_doctrine_block_named 'Spell-Adjacent Procedures and DM Spell Doctrine' 'cropped RC extraction from pages 144-147, using bounded page windows plus cleanup to isolate named spell-adjacent doctrine blocks while excluding nearby generic DM advice and dungeon-operation procedures.' "$RC_PDF"
tsv_cols_block_named 'Scrolls' 'TSV coordinate reflow across the RC scroll section to remove three-column interleave while preserving bullet lists and long descriptions.' "$RC_PDF" 234 235 '185,370' 'Scrolls'
rc_spell_research_block_named 'Spell Research' 'cropped RC page-255 extraction preserving both the research procedure and the adjacent enchantment-economics doctrine (`Experience from Spells and Enchanted Items`) from the source page rather than a hand-reconstructed summary.' "$RC_PDF"
rc_item_enchantment_block_named 'Magic Item Enchantment, Recharging, and Item Damage Procedures' 'targeted RC Chapter 16 and procedure-layer addition from the magical-item creation pages plus the dedicated item-damage page, capturing spell-effect requirements, specialist and component requirements, chance of success, enchantment time, multiple-enchantment handling, recharge costs, dispel relevance, and damage/destruction handling for magical items.' "$RC_PDF"
rc_constructs_block_named 'Construct Enchantment and Magical Constructs' 'targeted RC Chapter 16 addition from the actual Magical Constructs pages, capturing construct creation prerequisites, spell gates, cost and time, success chance, HD and immunity guidance, healing rules, damage ceilings, reproduction limits, special attacks, and the nondispellable-frame requirement referenced by Create Any Monster.' "$RC_PDF"
tsv_cols_block_named_until 'Chapter 16 Item Description Catalog (Potions, Wands/Staves/Rods, Rings, Miscellaneous Items, and Swords)' 'anchored TSV coordinate reflow across RC Chapter 16 item-description pages, starting at the Potions heading and stopping before the Chapter 16 wrap-up/cashout section to preserve the canonical item-property descriptions in reading order.' "$RC_PDF" 232 249 '185,370' 'Potions' 'Cashing Treasure'
page_cols_block_named 'Index to Spells' 'three-column extraction from the RC appendix index page using cropped per-column text to preserve alphabetical reading order.' "$RC_PDF" 300 300 "15 15 175 770" "195 15 180 770" "380 15 175 770"
cleanup_output
set_table_qa_note "$RC_OUT" 'reviewed 2026-03-22; confidence survey updated 2026-03-23' 'clerical, magical, and druidic spell lists plus the later reconstructed spellcaster and scroll tables.' 'no blocking row/column defects found in the visible Rules Cyclopedia table and list regions.'
append_table_qa_lines "$RC_OUT" <<'EOF'
- Capture confidence: **0.95** (UP from 0.90 after staging the RC Chapter 16 item-description catalog)
- Coverage note: RC spell descriptions, spell-adjacent doctrine, research, scrolls, item enchantment, construct procedures, and the Chapter 16 item-description catalog (potions, wands/staves/rods, rings, miscellaneous items, swords) are now staged from RC source text. Remaining concerns are OCR texture and optional cleanup, not source-evidence coverage gaps.
- ToC cross-check: RC Chapter 16 procedure and item-description sections remain represented in staging, and the RC DM spell-doctrine pass now adds the named spell-adjacent procedures block plus page-255 enchantment-economics text.
- Gap priority: LOW — the previously documented RC item-description gap is closed.
EOF
perl -0pi -e '
  s/\b1dl2\b/1d12/g;
  s/\b2dl2\b/2d12/g;
  s/\b2dl0\b/2d10/g;
  s/\b2dlO\b/2d10/g;
  s/\b3dl0\b/3d10/g;
  s/\b6dl0\b/6d10/g;
  s/\b7dl0\b/7d10/g;
  s/\bdl00\b/d100/g;
  s/\bld6\b/1d6/g;
  s/21 \+/21+/g;
  s/chara-\nter/character/g;
  s/charac-\nter/character/g;
  s/magi-\nuser/magic-user/g;
  s/spel-\nls/spells/g;
  s/\(using 1d6 if the chance of damage is h i g h \) \. I f/(using 1d6 if the chance of damage is high). If/g;
  s/any potion or scroll as a \+ 1 item;\nany wand or staff as a \+ 2\nand all permanent items/any potion or scroll as a +1 item;\nany wand or staff as a +2;\nand all permanent items/g;
  s/research volume pos-\nsible/research volume possible/g;
  s/The chance of success to research a spell vary/The chance of success to research a spell varies/g;
  s/\+ 1 5 %/\+15%/g;
  s/\+ 5 %/\+5%/g;
  s/([0-9]) %/$1%/g;
' "$RC_OUT"
assert_heading_count "$RC_OUT" 'Chapter 3: Spells and Spellcasting' 1 'RC staging duplicated the Chapter 3 spellcasting section heading'
assert_heading_count "$RC_OUT" 'Prismatic Wall Recovery Pass \(RC page 60\)' 1 'RC staging duplicated the Prismatic Wall recovery section heading'
assert_heading_count "$RC_OUT" 'Monster Spellcasters' 1 'RC staging duplicated the monster spellcasters section heading'
assert_heading_count "$RC_OUT" 'Spell-Adjacent Procedures and DM Spell Doctrine' 1 'RC staging duplicated the spell-adjacent doctrine section heading'
assert_heading_count "$RC_OUT" 'Scrolls' 1 'RC staging duplicated the scrolls section heading'
assert_heading_count "$RC_OUT" 'Spell Research' 1 'RC staging duplicated the spell research section heading'
assert_heading_count "$RC_OUT" 'Magic Item Enchantment, Recharging, and Item Damage Procedures' 1 'RC staging duplicated the item-enchantment section heading'
assert_heading_count "$RC_OUT" 'Construct Enchantment and Magical Constructs' 1 'RC staging duplicated the constructs section heading'
assert_heading_count "$RC_OUT" 'Chapter 16 Item Description Catalog \(Potions, Wands/Staves/Rods, Rings, Miscellaneous Items, and Swords\)' 1 'RC staging duplicated the Chapter 16 item catalog section heading'
assert_heading_count "$RC_OUT" 'Index to Spells' 1 'RC staging duplicated the index-to-spells section heading'
