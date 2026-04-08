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

expert_crop_layout() {
  local page="$1"
  local x="$2"
  local y="$3"
  local w="$4"
  local h="$5"
  pdftotext -layout -nodiag -nopgbrk -f "$page" -l "$page" -x "$x" -y "$y" -W "$w" -H "$h" "$EXPERT_PDF" - 2>/dev/null
}

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
    s/\b1week\b/1 week/g;
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
    s/^g\. MISCELLANEOUS MAGIC ITEMS$/h. MISCELLANEOUS MAGIC ITEMS/mg;
    s/Staff of Striking@\):This/Staff of Striking \(s\): This/g;
    s/^\+\s*$//mg;
    s/\bYi damage\b/1\/2 damage/g;
    s/\bt 2\b/\+2/g;
    s/\bafinger of\b/a finger of/g;
    s/Wand of Polymorphing: This wand creates either a polymorph self or polymorph other\n effect \(as if using the magic-user spells\)\.\nThe user must state which effect is desired\.\nAn unwilling victim may make a Saving\nThrow vs\. Wands to avoid the effect\.\n\nThe user must state which effect is desired\.\nAn unwilling victim may make a Saving\nThrow vs\. Wands to avoid the effect\./Wand of Polymorphing: This wand creates either a polymorph self or polymorph other\n effect \(as if using the magic-user spells\)\.\nThe user must state which effect is desired\.\nAn unwilling victim may make a Saving\nThrow vs\. Wands to avoid the effect\./g;
    s/teleport another creature or item\. An un\nwilling victim may make a Saving Throw vs\nSpells to avoid the effect\. After one use, the\nhelm will no longer function\. If a telepor\nspell is then cast upon it, the user may then\nteleport as often as desired, up to once pe/teleport another creature or item. An unwilling victim may make a Saving Throw vs. Spells to avoid the effect. After one use, the helm will no longer function. If a teleport spell is then cast upon it, the user may then teleport as often as desired, up to once per round./g;
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
  # Bboxes tuned from rendered page overlays in _todo/_page_renders/.cache/expert/.
  # This pass widened the boxes and nudged them right to reduce left-column bleed.
  printf '[Expert page 27: Research (Magic Spells and Items), column 2]\n' >> "$OUT"
  expert_crop_layout 27 220 70 190 760 \
    | awk 'started || /Research \(Magic Spells and Items\)/ { started = 1; print }' \
    | awk '!/^[[:space:]]*25[[:space:]]*$/' \
    | expert_cleanup_snippet >> "$OUT"
  printf '\n[Expert page 27: Research (Magic Spells and Items), column 3]\n' >> "$OUT"
  expert_crop_layout 27 400 78 182 600 \
    | expert_cleanup_snippet >> "$OUT"
  printf '\n[Expert page 28: Spell Books, Lost]\n' >> "$OUT"
  expert_crop_layout 28 390 60 210 760 \
    | awk 'started || /Spell Books, Lost/ { started = 1; print }' \
    | expert_cleanup_snippet >> "$OUT"
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
  printf '[Expert treasure chapter flow: pages 58-65, read in page/column order]\n' >> "$OUT"
  render_tsv_cols_pages_anchored "$EXPERT_PDF" 58 65 '185,370' 'Cursed Items:' \
    | awk '!/^[[:space:]]*Treasures[[:space:]]*$/' \
    | expert_cleanup_snippet \
    | perl -0pe '
        s/^g\. MISCELLANEOUS MAGIC ITEMS$/h. MISCELLANEOUS MAGIC ITEMS/mg;
        s/Staff of Striking@\):/Staff of Striking (s):/g;
        s/\bWands for \?4 damage\b/Wands for 1\/2 damage/g;
        s/\bWands for Yi damage\b/Wands for 1\/2 damage/g;
        s/\bafinger of\b/a finger of/g;
        s/^\+\s*$//mg;
        s/\b1week\b/1 week/g;
      ' >> "$OUT"
  printf '\n```\n\n' >> "$OUT"
}

normalize_expert_general_repairs() {
  perl -0pi -e 's/any one creature within IO\x27\. The spell may/any one creature within 10\x27. The spell may/g;' "$EXPERT_OUT"
  perl -0pi -e 's/Staff of Striking@\):This/Staff of Striking \(s\): This/g; s/^\+\s*\n//mg; s/Wands for Yi damage/Wands for 1\/2 damage/g; s/\ng\. MISCELLANEOUS MAGIC ITEMS/\nh. MISCELLANEOUS MAGIC ITEMS/g; s/bonus of\nt 2 to the wearer/bonus of\n+2 to the wearer/g; s/afinger of/a finger of/g; s/points of damage \(2d6 2\)\./points of damage \(2d6+2\)\./g; s/greater\. A cleric may only make items usa-\n\n\[Expert page 27: Research \(Magic Spells and Items\), column 3\]\nble by clerics, and a magic-user \(or elf\) may\nonly make items usable by that class\./greater. A cleric may only make items usable by clerics, and a magic-user \(or elf\) may only make items usable by that class.\n\n[Expert page 27: Research \(Magic Spells and Items\), column 3]/g; s/(The user must state which effect is desired\.\nAn unwilling victim may make a Saving\nThrow vs\. Wands to avoid the effect\.)\n\n\1/$1/g; s/Helm of Teleportation \(m\): The wearer\nmay teleport \(as with the magic-user spell,\n\nteleport another creature or item\. An unwilling victim may make a Saving Throw vs\. Spells to avoid the effect\. After one use, the helm will no longer function\. If a teleport spell is then cast upon it, the user may then teleport as often as desired, up to once per round\./Helm of Teleportation \(m\): The wearer\nmay teleport \(as with the magic-user spell,\nincluding chances of error\), or may try to\nteleport another creature or item. An unwilling victim may make a Saving Throw vs.\nSpells to avoid the effect. After one use, the\nhelm will no longer function. If a teleport\nspell is then cast upon it, the user may then\nteleport as often as desired, up to once per\nround./g;' "$EXPERT_OUT"
}

normalize_expert_research_examples() {
  perl -0pi -e '
    s/Examples\s+cost\s+Time/Examples                 cost       Time/g;
    s/Ring x-ray\s+vision\s+100,000 gp\s+12 months/Ring x-ray vision     100,000 gp     12 months/g;
    s/Ring spell\s+storing\s+10,000 gp\s+1 month per\s+spell level/Ring spell storing   10,000 gp     1 month per spell level/g;
    s/Ring spell\s+1 month per\s+\n\n\[Expert page 28: Spell Books, Lost\]/Ring spell storing   10,000 gp     1 month per spell level\n\n[Expert page 28: Spell Books, Lost]/g;
    s/Ring spell\s+1 month per/Ring spell storing   10,000 gp     1 month per spell level/g;
  ' "$EXPERT_OUT"
}

normalize_expert_treasure_tables() {
  perl -0pi -e 's/UNGUARDED TREASURE\n.*?\nMagic Items/UNGUARDED TREASURE\n\nDungeon    Silver         Gold             Gems      Jewelry    Magic Items\nLevel\n1          100 x 1d6      50% 10 x 1d6     5% 1d6    2% 1d6    2% any 1\n2-3        100 x 1d12     50% 100 x 1d6    10% 1d6   5% 1d6    8% any 1\n4-5        1,000 x 1d6    200 x 1d6        20% 1d8   10% 1d8   10% any 1\n6-7        2,000 x 1d6    500 x 1d6        30% 1d10  15% 1d10  15% any 1\n8-9        5,000 x 1d6    1,000 x 1d6      40% 1d12  20% 1d12  20% any 1\n\nMagic Items/s;' "$EXPERT_OUT"
}

normalize_expert_intelligent_sword_tables() {
  perl -0pi -e 's/Intelligence\nMethod of\n1d20\nScore\nCommunication\n1-6\nEmpathy\n7-1 1\nEmpathy\n12-15\nEmpathy\n16-18\nSpeech\nSpeech\nSpeech\n//s; s/Roll 1d20 to find the exact intelligence score\nof the sword:\nPowers\nlanguages\n1 Primary\n-\n2 Primary\n-\n3 Primary\n-\n3 Primary\n1-3\n3 Primary \+ reads magic\n1-6\n\n3 Primary 1 Extraordinary,\n2-8\nalso reads magic\neach round while the sword is touched or\nheld, according to the following chart:\nUser\x27s\nSword\x27s\nDamage\nAlignment\nAlignment\nper round\nLawful\nNeutral\n1-6\nChaotic\n2-12\nNeutral\nLawful\n1-6\nChaotic\n1-6\nChaotic\nLawful\n2-12\nNeutral\n1-6/Roll 1d20 to find the exact intelligence score\nof the sword:\n\n1d20    Score   Communication   Powers                               Languages\n1-6     7       Empathy         1 Primary                            -\n7-11    8       Empathy         2 Primary                            -\n12-15   9       Empathy         3 Primary                            -\n16-18   10      Speech          3 Primary                            1-3\n19      11      Speech          3 Primary + reads magic              1-6\n20      12      Speech          3 Primary + 1 Extraordinary,\n                                 also reads magic                    2-8\n\neach round while the sword is touched or\nheld, according to the following chart:\n\nUser\x27s Alignment   Sword\x27s Alignment   Damage per round\nLawful              Neutral              1-6\nLawful              Chaotic              2-12\nNeutral             Lawful               1-6\nNeutral             Chaotic              1-6\nChaotic             Lawful               2-12\nChaotic             Neutral              1-6/s;' "$EXPERT_OUT"
  perl -0pi -e 's/d%\nPrimary Powers\n01-10 Detect evil \(good\)\n11-15 Detect gems\n16-25 Detect magic\n26-35 Detect metal\n36-50 Detect shifting walls and rooms\n51-65 Detect sloping passages\n66-75 Find secret doors\ni6-85 Find traps\n86-95 See invisible\n96-99 Roll for 1 extraordinary ower\n\\\nRoll twice more on this ta le/d%     Primary Powers\n01-10  Detect evil \(good\)\n11-15  Detect gems\n16-25  Detect magic\n26-35  Detect metal\n36-50  Detect shifting walls and rooms\n51-65  Detect sloping passages\n66-75  Find secret doors\n76-85  Find traps\n86-95  See invisible\n96-99  Roll for 1 extraordinary power\n00     Roll twice more on this table/g; s/Extraordinary Powers\nd%\n01-10 Clairaudience\n11-20 Clairvoyance\n21-30 ESP\n31-35 Extra damage \(duplicate allowed\)\n36-40 Flying\n4 1-45 Hea!ing \(duplicate allowed\)\n46-54 Illusion\n55-59 Levitation\n60-69 Telekinesis\n70-79 Telepathy\n80-88 Teleportation\n89-97 X-ray vision\n98-99 Make 2 more rolls on this table\*\nMake 3 more rolls on this table\*\n"Ignore any further result of 98 or more\./Extraordinary Powers\n\nd%     Extraordinary Powers\n01-10  Clairaudience\n11-20  Clairvoyance\n21-30  ESP\n31-35  Extra damage \(duplicate allowed\)\n36-40  Flying\n41-45  Healing \(duplicate allowed\)\n46-54  Illusion\n55-59  Levitation\n60-69  Telekinesis\n70-79  Telepathy\n80-88  Teleportation\n89-97  X-ray vision\n98-99  Make 2 more rolls on this table\*\n00     Make 3 more rolls on this table\*\n\n\*Ignore any further result of 98 or more./g;' "$EXPERT_OUT"
}

normalize_expert_potion_tables() {
  perl -0pi -e 's/Level\nEffect\nNormal Man Becomes a 4th level fighter\n1-3\nGain 3 levels or Hit Dice\n4-7\nGain 2 levels or Hit Dice\n8-10\nGain 1 level or Hit Die\nNo Effect/Level        Effect\nNormal Man   Becomes a 4th level fighter\n1-3          Gain 3 levels or Hit Dice\n4-7          Gain 2 levels or Hit Dice\n8-10         Gain 1 level or Hit Die\n11+          No Effect/g; s/Level\s+Effect\n\s*Normal Man Becomes a 4th level fighter\n1-3\s+Gain 3 levels or Hit Dice\n4-7\s+Gain 2 levels or Hit Dice\n8-10\s+Gain 1 level or Hit Die\n11\s+\+\s+No Effect/Level        Effect\nNormal Man   Becomes a 4th level fighter\n1-3          Gain 3 levels or Hit Dice\n4-7          Gain 2 levels or Hit Dice\n8-10         Gain 1 level or Hit Die\n11+          No Effect/g;' "$EXPERT_OUT"
}

normalize_expert_residual_labels() {
  perl -0pi -e 's/\nExtraordinary Powers\n\n(d%     Extraordinary Powers)/\n\n$1/g; s/\nLevel   Effect\nNormal Man   Becomes a 4th level fighter/\nLevel        Effect\nNormal Man   Becomes a 4th level fighter/g;' "$EXPERT_OUT"
}

validate_expert_output() {
  assert_heading_count "$EXPERT_OUT" 'Clerical and Magic-User Spell Expansions' 1 'Expert staging duplicated the spell-expansions section heading'
  assert_heading_count "$EXPERT_OUT" 'Research and Lost Spell Books' 1 'Expert staging duplicated the research section heading'
  assert_heading_count "$EXPERT_OUT" 'Magic Support Infrastructure' 1 'Expert staging duplicated the magic-support section heading'
  assert_heading_count "$EXPERT_OUT" 'Scrolls, Rings, Wands, Staves, Rods, and Spell-Adjacent Treasure Text' 1 'Expert staging duplicated the treasure/item section heading'
  assert_heading_count "$EXPERT_OUT" 'Magic Item Doctrine and Intelligent Weapons' 1 'Expert staging duplicated the doctrine section heading'

  assert_file_contains "$EXPERT_OUT" 'Research \(Magic Spells and Item' 'Expert research heading is missing from the source-derived block'
  assert_file_contains "$EXPERT_OUT" 'Spell Books, Lost' 'Expert lost spell-book heading is missing'
  assert_section_patterns_in_order "$EXPERT_OUT" '### Research and Lost Spell Books' '### Scrolls, Rings, Wands, Staves, Rods, and Spell-Adjacent Treasure Text' 'Expert research procedure ordering broke' 'Research \(Magic Spells and Item' 'Examples' 'Ring x-ray|Ring x-ray vision' 'Spell Books, Lost'
  assert_section_contains "$EXPERT_OUT" '### Research and Lost Spell Books' '### Scrolls, Rings, Wands, Staves, Rods, and Spell-Adjacent Treasure Text' 'Ring x-ray|x-ray[[:space:]]+vision[[:space:]]+100,000 gp' 'Expert research examples lost the long-tail item witness'
  assert_section_contains "$EXPERT_OUT" '### Research and Lost Spell Books' '### Scrolls, Rings, Wands, Staves, Rods, and Spell-Adjacent Treasure Text' 'Ring spell storing[[:space:]]+10,000 gp[[:space:]]+1 month per spell level' 'Expert research examples still contain an orphaned final row'

  assert_section_patterns_in_order "$EXPERT_OUT" '### Scrolls, Rings, Wands, Staves, Rods, and Spell-Adjacent Treasure Text' '### Magic Item Doctrine and Intelligent Weapons' 'Expert treasure doctrine ordering broke' 'e\. SCROLLS|e\. Scrolls' 'f\. RINGS|f\. Rings' 'g\. WANDS, STAVES, AND RODS|g\. Wands, Staves, and Rods' 'h\. MISCELLANEOUS MAGIC ITEMS|h\. Miscellaneous Magic Items'
  assert_section_contains "$EXPERT_OUT" '### Scrolls, Rings, Wands, Staves, Rods, and Spell-Adjacent Treasure Text' '### Magic Item Doctrine and Intelligent Weapons' 'Wand of Negation' 'Expert treasure block lost Wand of Negation'
  assert_section_contains "$EXPERT_OUT" '### Scrolls, Rings, Wands, Staves, Rods, and Spell-Adjacent Treasure Text' '### Magic Item Doctrine and Intelligent Weapons' 'Spell Turning' 'Expert treasure block lost Spell Turning'
  assert_section_contains "$EXPERT_OUT" '### Scrolls, Rings, Wands, Staves, Rods, and Spell-Adjacent Treasure Text' '### Magic Item Doctrine and Intelligent Weapons' 'Mirror of Life Trapping|Scarab of Protection' 'Expert treasure block is truncated before the page-65 misc witness'
}

expert_1st_2nd_mu_sourcing_notes() {
  # These 21 spells appear in the Expert Set 1st/2nd level MU spell lists (pages 13-14)
  # but the Expert Set provides no standalone description text for them; it explicitly
  # refers players to the Basic Set for these entries.  The blocks below are sourcing-note
  # placeholders — not spell descriptions — so that the multi-witness staging builder can
  # record the provenance and mark these witnesses [needs-review] rather than silently
  # missing them.  strip_appendix() does NOT remove this section because it is placed
  # before the ## Spell Lists Appendix sentinel.
  printf '### Expert: 1st and 2nd Level MU Spell Sourcing Notes\n\n' >> "$EXPERT_OUT"
  printf -- '- Extraction note: Expert Set (pages 13-14) reproduces 1st and 2nd level MU spell lists without standalone spell descriptions. The Expert Set text reads: "The following first and second level spells may be reversed" — implying descriptions remain as in Basic. These note blocks record that provenance so downstream witness coverage is explicit; they are not description witnesses. See Basic staging section "Spell Lists and Basic Spell Descriptions" for the source text.\n\n' >> "$EXPERT_OUT"
  printf '```text\n' >> "$EXPERT_OUT"
  cat >> "$EXPERT_OUT" <<'TXT'
Charm Person
[Expert Set sourcing note (MU1): Expert Set (pages 13-14) reproduces the spell list only; no standalone description. Description text in Basic staging -> Spell Lists and Basic Spell Descriptions.]

Detect Magic
[Expert Set sourcing note (MU1): Expert Set (pages 13-14) reproduces the spell list only; no standalone description. Description text in Basic staging -> Spell Lists and Basic Spell Descriptions.]

Floating Disc
[Expert Set sourcing note (MU1): Expert Set (pages 13-14) reproduces the spell list only; no standalone description. Description text in Basic staging -> Spell Lists and Basic Spell Descriptions.]

Hold Portal
[Expert Set sourcing note (MU1): Expert Set (pages 13-14) reproduces the spell list only; no standalone description. Description text in Basic staging -> Spell Lists and Basic Spell Descriptions.]

Magic Missile
[Expert Set sourcing note (MU1): Expert Set (pages 13-14) reproduces the spell list only; no standalone description. Description text in Basic staging -> Spell Lists and Basic Spell Descriptions.]

Protection from Evil
[Expert Set sourcing note (MU1): Expert Set (pages 13-14) reproduces the spell list only; no standalone description. Description text in Basic staging -> Spell Lists and Basic Spell Descriptions.]

Read Languages
[Expert Set sourcing note (MU1): Expert Set (pages 13-14) reproduces the spell list only; no standalone description. Description text in Basic staging -> Spell Lists and Basic Spell Descriptions.]

Read Magic
[Expert Set sourcing note (MU1): Expert Set (pages 13-14) reproduces the spell list only; no standalone description. Description text in Basic staging -> Spell Lists and Basic Spell Descriptions.]

Shield
[Expert Set sourcing note (MU1): Expert Set (pages 13-14) reproduces the spell list only; no standalone description. Description text in Basic staging -> Spell Lists and Basic Spell Descriptions.]

Sleep
[Expert Set sourcing note (MU1): Expert Set (pages 13-14) reproduces the spell list only; no standalone description. Description text in Basic staging -> Spell Lists and Basic Spell Descriptions.]

Ventriloquism
[Expert Set sourcing note (MU1): Expert Set (pages 13-14) reproduces the spell list only; no standalone description. Description text in Basic staging -> Spell Lists and Basic Spell Descriptions.]

Detect Evil
[Expert Set sourcing note (MU2): Expert Set (pages 13-14) reproduces the spell list only; no standalone description. Description text in Basic staging -> Spell Lists and Basic Spell Descriptions.]

Detect Invisible
[Expert Set sourcing note (MU2): Expert Set (pages 13-14) reproduces the spell list only; no standalone description. Description text in Basic staging -> Spell Lists and Basic Spell Descriptions.]

ESP
[Expert Set sourcing note (MU2): Expert Set (pages 13-14) reproduces the spell list only; no standalone description. Description text in Basic staging -> Spell Lists and Basic Spell Descriptions.]

Invisibility
[Expert Set sourcing note (MU2): Expert Set (pages 13-14) reproduces the spell list only; no standalone description. Description text in Basic staging -> Spell Lists and Basic Spell Descriptions.]

Knock
[Expert Set sourcing note (MU2): Expert Set (pages 13-14) reproduces the spell list only; no standalone description. Description text in Basic staging -> Spell Lists and Basic Spell Descriptions.]

Levitate
[Expert Set sourcing note (MU2): Expert Set (pages 13-14) reproduces the spell list only; no standalone description. Description text in Basic staging -> Spell Lists and Basic Spell Descriptions.]

Mirror Image
[Expert Set sourcing note (MU2): Expert Set (pages 13-14) reproduces the spell list only; no standalone description. Description text in Basic staging -> Spell Lists and Basic Spell Descriptions.]

Phantasmal Force
[Expert Set sourcing note (MU2): Expert Set (pages 13-14) reproduces the spell list only; no standalone description. Description text in Basic staging -> Spell Lists and Basic Spell Descriptions.]

Web
[Expert Set sourcing note (MU2): Expert Set (pages 13-14) reproduces the spell list only; no standalone description. Description text in Basic staging -> Spell Lists and Basic Spell Descriptions.]

Wizard Lock
[Expert Set sourcing note (MU2): Expert Set (pages 13-14) reproduces the spell list only; no standalone description. Description text in Basic staging -> Spell Lists and Basic Spell Descriptions.]

Geas
[Expert Set sourcing note (MU6): Expert Set (pages 13-18) includes Geas in the 6th level MU spell list only; no standalone description found in the Expert PDF. Description text in Rules Cyclopedia staging.]
TXT
  printf '\n```\n\n' >> "$EXPERT_OUT"
}

expert_3rd_6th_mu_descriptions() {
  local pdf="$1"
  # Expert pages 13-14 contain the 3rd-6th level MU spell descriptions alongside
  # the reversal notes for 1st/2nd level spells. The column layout places numbered
  # spell lists in one column and descriptions in the adjacent column; TSV reflow
  # captures both. The awk below anchors on the reversal-note paragraph and strips
  # numbered list entries and level heading noise, leaving only prose spell
  # descriptions. These include Clairvoyance (MU3), Fire Ball (MU3), and all other
  # 3rd-6th level Expert MU spell descriptions that appear after the spell index.
  # Placed pre-sentinel so multi-witness builder can scan them as Expert witnesses.
  printf '### Expert: 3rd-6th Level MU Spell Descriptions (pages 13-14)\n\n' >> "$EXPERT_OUT"
  printf -- '- Extraction note: post-list prose extracted from Expert pages 13-14 using TSV column reflow anchored at the reversible-spell intro paragraph. Numbered list entries, ALL-CAPS level headings, and Title Case sub-headers stripped as noise. What remains is description content for 3rd-6th level MU spells (Clairvoyance, Fire Ball, Geas, etc.) plus reversal notes for 1st/2nd level spells. This section is placed before the Spell Lists Appendix sentinel so multi-witness builder strip_appendix() does not discard it.\n\n' >> "$EXPERT_OUT"
  printf '```text\n' >> "$EXPERT_OUT"
  render_tsv_cols_pages_anchored_until "$pdf" 13 14 '185,370' 'MAGIC-USER SPELLS' 'THIEF' \
    | awk '
        started {
          # strip Title Case level sub-headers: "First/Second/Third Level Magic-user Spells"
          if (/^(First|Second|Third|Fourth|Fifth|Sixth) Level Magic-user Spells$/) next
          # strip ALL-CAPS level headings (numbered list section starts)
          if (/^[^a-z]+$/ && /[A-Z]/ && (/SPELL/ || /LEVEL/)) next
          # strip numbered list entries (including OCR space-in-number artifacts)
          if (/^[[:space:]]*[[:digit:]][[:digit:] ]*\.[[:space:]]/) next
          print
          next
        }
        /^The following first and second level spells/ { started = 1; print }
      ' >> "$EXPERT_OUT"
  printf '\n```\n\n' >> "$EXPERT_OUT"
}

expert_spell_lists_appendix() {
  local pdf="$1"

  printf '\n## Spell Lists Appendix\n\n' >> "$EXPERT_OUT"
  printf -- '- Note: these are raw numbered spell lists from the Expert Set. They are appendix-only \x2014 the per-spell description extraction above is the authoritative witness source. Multi.py strips this section before scanning for spell witnesses.\n\n' >> "$EXPERT_OUT"

  printf '### Expert: Cleric Spell Lists (page 6, book page 4)\n\n' >> "$EXPERT_OUT"
  printf -- '- Extraction note: TSV column reflow of Expert cleric spell lists from the character class table on book page 4 (PDF page 6). Middle and right columns contain 1st-6th level spell index; stops at the Cleric Saving Throws table.\n\n' >> "$EXPERT_OUT"
  printf '```text\n' >> "$EXPERT_OUT"
  render_tsv_cols_pages_anchored_until "$pdf" 6 6 '185,370' 'FIRST LEVEL CLERIC SPELLS' 'CLERIC SAVING THROWS' \
    | sed 's/^F I l T H /FIFTH /' \
    | spell_list_smart_filter >> "$EXPERT_OUT"
  printf '\n```\n\n' >> "$EXPERT_OUT"

  printf '### Expert: Magic-User Spell Lists (pages 13-14)\n\n' >> "$EXPERT_OUT"
  printf -- '- Extraction note: TSV column reflow of Expert magic-user spell list pages.\n\n' >> "$EXPERT_OUT"
  printf '```text\n' >> "$EXPERT_OUT"
  render_tsv_cols_pages_anchored_until "$pdf" 13 14 '185,370' 'MAGIC-USER SPELLS' 'THIEF' \
    | spell_list_smart_filter >> "$EXPERT_OUT"
  printf '\n```\n\n' >> "$EXPERT_OUT"
}

extract_pdf "$EXPERT_PDF" "$EXPERT_TXT"
OUT="$EXPERT_OUT"
write_header 'TODO: BECMI Spell Material Staging - Expert' 'TSR 1012B - Set 2 Expert Rules.pdf'
expert_spell_expansions_block_named 'Clerical and Magic-User Spell Expansions' 'stitched Expert spell extraction: clerical spell pages 7-11 and magic-user spell pages 13-18 use separate TSV coordinate reflow passes so the real spell sections stay in source order and the intervening fighter/thief class tables are excluded.' "$EXPERT_PDF"
expert_magic_support_block_named 'Magic Support Infrastructure' 'page-26 layout slices target the Alchemist and Sage specialist support entries and then apply narrow OCR cleanup to preserve those two magic-relevant procedures without carrying the full specialist roster.' "$EXPERT_PDF"
expert_research_block_named 'Research and Lost Spell Books' 'bounded page-column extraction from the actual Expert research pages, split into source-derived sub-blocks for the research procedure, item-creation examples, and the lost spell-book guidance rather than one hand-reconstructed summary.'
expert_magic_items_block_named 'Scrolls, Rings, Wands, Staves, Rods, and Spell-Adjacent Treasure Text' 'full readable treasure-chapter extraction from pages 58-65, reflowed in page/column order so cursed items, swords, armor/weapons, potions, scrolls, rings, wands/staves/rods, and miscellaneous items remain in chapter sequence rather than stitched out of order.'
expert_magic_item_doctrine_block_named 'Magic Item Doctrine and Intelligent Weapons' 'page-59 to page-61 column slices target generic magic-item doctrine, intelligent-weapon control rules, and the specific control-potion subset needed for downstream spell/effect coverage; cleanup normalizes OCR scars and dehyphenates wrapped words.' "$EXPERT_PDF"
cleanup_output
normalize_expert_research_examples
normalize_expert_general_repairs
normalize_expert_treasure_tables
normalize_expert_intelligent_sword_tables
normalize_expert_potion_tables
normalize_expert_residual_labels
validate_expert_output
expert_3rd_6th_mu_descriptions "$EXPERT_PDF"
expert_1st_2nd_mu_sourcing_notes
expert_spell_lists_appendix "$EXPERT_PDF"
