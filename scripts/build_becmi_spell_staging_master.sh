#!/usr/bin/env bash
set -euo pipefail

ROOT='/home/joshu/Synthetic-Dream-Machine'
SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)

BECMI_STAGING_HELPERS_ONLY=1 source "$SCRIPT_DIR/build_becmi_spell_staging.sh"

TMPDIR=$(mktemp -d)
trap 'rm -rf "$TMPDIR"' EXIT

MASTER_TXT="$TMPDIR/master.txt"
MASTER_PDF="$ROOT/_becmi/TSR 1021 - Set 4 Master Rules.pdf"
MASTER_OUT="$ROOT/_todo/TODO_BECMI_Spell_Material_Staging_Master.md"

master_replace_block_between_markers() {
  local start="$1"
  local end="$2"
  local replacement="$3"

  START_BLOCK="$start" END_BLOCK="$end" REPLACEMENT_BLOCK="$replacement" perl -0pi -e '
    BEGIN {
      $start = $ENV{START_BLOCK};
      $end = $ENV{END_BLOCK};
      $replacement = $ENV{REPLACEMENT_BLOCK};
    }
    s/\Q$start\E.*?(?=\Q$end\E)/$replacement/s;
  ' "$MASTER_OUT"
}

master_replace_block_between_regex_markers() {
  local start_pattern="$1"
  local end_pattern="$2"
  local replacement="$3"

  START_PATTERN="$start_pattern" END_PATTERN="$end_pattern" REPLACEMENT_BLOCK="$replacement" perl -0pi -e '
    BEGIN {
      $start = $ENV{START_PATTERN};
      $end = $ENV{END_PATTERN};
      $replacement = $ENV{REPLACEMENT_BLOCK};
    }
    s/$start.*?(?=$end)/$replacement/s;
  ' "$MASTER_OUT"
}

master_cleanup_postbuild() {
  perl -0pi -e '
    s/\(\(215\)/(C15)/g;
    s/\(\(216\)/(C16)/g;
    s/^Characters - Cleric, Druid\s*\n//mg;
    s/\n{3,}/\n\n/g;
    s/^Spectre\s+D D\+\s+D\+$/Spectre     D      D+     D+/mg;
    s/^Vampire\s+D D\s+D$/Vampire     D      D      D/mg;
    s/^Phantom\s+D D\s+D$/Phantom     D      D      D/mg;
    s/^Haunt\s+D D\s+D$/Haunt       D      D      D/mg;
    s/^Spirit\s+D D\s+D$/Spirit      D      D      D/mg;
    s/^Nightshade\s+D D\s+D$/Nightshade  D      D      D/mg;
    s/^Lich\s+T T\s+T$/Lich        T      T      T/mg;
    s/^Special\s+T T\s+T T\s+automatic Turn, 2d6 Hit Dice of undead$/Special     T      T      T/mg;
    s/^D\s+automatic Destroy, 2d6 Hit Dice$/T   automatic Turn, 2d6 Hit Dice of undead\nD   automatic Destroy, 2d6 Hit Dice/mg;
    s/Und e r certain conditions/Under certain conditions/g;
    s/Finger of Dea\s*t h \*\s*\(\s*R60\x27;X9,\s*C12\)/Finger of Death* \(R 60\x27; X9, C12\)/g;
    s/Finger o f D e a t h \* \( R60\x27;X9, C12\)/Finger of Death* \(R 60\x27; X9, C12\)/g;
    s/\n\s*20 Lig h \(R 120\x27, DR 46T, EF 30\x27 dia;\n\s*B40\)/\n  20 Light* \(R 120\x27, DR 46T, EF 30\x27 dia; B40\)/g;
    s/^   Tree Movement: Thr user may swing$/   Tree Movement: The user may swing/mg;
    s/DIAMOND 0RB OF TYCHE/DIAMOND ORB OF TYCHE/g;
    s/Anti-Magic loo % , 10\x27 radius emanat-/Anti-Magic 100%, 10\x27 radius emanat-/g;
    s/healingpower/healing power/g;
    s/Source: North African creation myth$/Source: North African creation myth./mg;
    s/\bI t has\b/It has/g;
    s/Turn as C L 36/Turn as CL 36/g;
    s/Turn as C L 24/Turn as CL 24/g;
    s/^C 3 Open Locks\s+25$/C3 Open Locks 25/mg;
    s/open locks attempts \x27/open locks attempts /g;
    s/Swords: Many magical swords can b$/Swords: Many magical swords can be/mg;
    s/further research is rec\nommended/further research is recommended/g;
    s/Angurvadal \(Stream of Anguish\) wa$/Angurvadal \(Stream of Anguish\) was/mg;
    s/Ar\x27ondight, sword of Launcelot of th\nLake/Ar\x27ondight, sword of Launcelot of the\nLake/g;
    s/sword ofslicing/sword of slicing/g;
    s/was made b\nthe/was made by\nthe/g;
    s/romance epi\n"Orlando Innamorato"/romance epic\n"Orlando Innamorato"/g;
    s/\(Roland in Love\) b\nMatteo/\(Roland in Love\) by\nMatteo/g;
    s/was the sword of Siegfried i\nScandinavian/was the sword of Siegfried in\nScandinavian/g;
    s/ofcharlemagne/of Charlemagne/g;
    s/Aphro\ndite/Aphrodite/g;
    s/when sh\nmarried/when she\nmarried/g;
    s/relatively unre\nmarkable/relatively unremarkable/g;
    s/brough\ndisaster/brought\ndisaster/g;
    s/Odrovir: In Norse legend, a great wa\n/Odrovir: In Norse legend, a great war\n/g;
    s/\(the 24 gods\) o\nheaven/$1 of\nheaven/g;
    s/the Natur\ngods/the Nature\ngods/g;
    s/providing thei\nmixed/providing their\nmixed/g;
    s/was calle\nOdrovir/was called\nOdrovir/g;
    s/King of Egyp\nadvised/King of Egypt\nadvised/g;
    s/friend Polycra\ntes/friend Polycrates/g;
    s/something o\ngreat/something of\ngreat/g;
    s/Polycrate\nthrew/Polycrates\nthrew/g;
    s/it wa\nlater/it was\nlater/g;
    s/King\x27s dinne\ntable/King\x27s dinner\ntable/g;
    s/recognized this sig\nfrom/recognized this sign\nfrom/g;
    s/relations with hi\nfriend/relations with his\nfriend/g;
    s/was bru\ntally slain/was brutally slain/g;
    s/Made famous b\nRichard/Made famous by\nRichard/g;
    s/several Scandinavian legend\n/several Scandinavian legends\n/g;
    s/, Elde\nand Younger/, Elder\nand Younger/g;
    s/\)\. Th\nring/). The\nring/g;
    s/Rhin\nriver/Rhine\nriver/g;
    s/Rhine Maid\nens/Rhine Maidens/g;
    s/foreswearin\nlove/foreswearing\nlove/g;
    s/item, an\nwhen/item, and\nwhen/g;
    s/gods an\nheroes/gods and\nheroes/g;
    s/doom t\nall/doom to\nall/g;
    s/It was made b\nWieland/It was made by\nWieland/g;
    s/the immorta\n\nblacksmith/the immortal\nblacksmith/g;
  ' "$MASTER_OUT"

  local comb_tail diamond_block shard_intro shard_core

  comb_tail=$(cat <<'EOF'
A1 Poison breath 50
B3 Haste 30
C1 Produce fire 15
Cure disease 20
Cure wounds, critical 35
D2 Polymorph self 65

Activation: The comb is not active when acquired. If it is left within a burning fire for 1 full turn, it is activated, but will not reveal powers. Thereafter, whenever the user befriends an elf (loaning money, curing, aiding in battle, and so forth), one power is revealed telepathically, to a maximum of 1 per day, in order of power.
Use of Powers: A power is invoked when a given combination of the comb's teeth are plucked, producing a nearly inaudible musical tone.
Suggested Handicaps (2):
1. When first power is used: User starts turning into an elf (1st level); the process takes 3 months to complete. The user becomes aware of minor changes, including animosity toward dwarves, in 2 weeks. The change stops completely as soon as the artifact is no longer owned, but the change back to normal also takes 3 months.
2. Energy drain: User loses 3 levels of experience when Poison Breath is first used.

Suggested Penalties (3; #1 appears 4 in 6, others each 1 in 6):
1. Slow spell effect centered on user.
2. Polymorph other spell effect upon user, to turn into an eagle.
3. Memory penalty: User cannot memorize any spells of the highest spell level he or she can normally study. Effect is cumulative if not removed.
Source: Breton folklore.
Further Research: Various works on folklore of the British Isles (Irish, Scottish, and Gaelic), such as Celtic Myth and Legend, by Charles Squire. See fays (or fees or faeries), druids of ancient Gaul, the Lamignak elves, Fountain Women of French folklore, and A Field Guide to the Little People (Arrowsmith and Moorse, 1977).

Your Notes:

EOF
)

  diamond_block=$(cat <<'EOF'
DIAMOND ORB OF TYCHE
This item appears to be a crystal ball, but is somewhat larger (about 18 inches across) and glows softly with a white light filled with sparkling colors. It was crafted by the powerful Immortal Tyche, said to control chance and the fortunes of mankind. It is a powerful artifact of Chaos, but is not necessarily evil, and is said to bring good fortune to the user, for a time.

Magnitude: Greater artifact.
Power Limits: 4/A, 3/B, 3/C, 4/D
Sphere: Thought (Thieves, air)
Suggested Powers (PP 405):
Pick pockets 100% 80
X-ray vision 80
Gaseous form 30
Container, 40,000 cn 80
Remove traps 75% 60
Confuse alignment 15
Hide in shadow 70% 60

Activation: The artifact is active when found. The user gets a feeling of inspiration when gazing into the orb. The artifact grants the knowledge of one power when one consecutive hour is spent gazing, to a maximum of 1 power per day, given in order of PP cost.
Use of Powers: By gazing into the orb and concentrating on a power, the user acquires that power after 1-3 rounds.
Suggested Handicaps (3):
1. When first used: Magic error. The user has a 10% chance of failure whenever attempting to cast a spell or use any magic item requiring a command word.
2. When pick pockets is first used: Alignment change to Chaotic, or to Neutral.
3. If, as a container, the artifact is ever completely filled: Recharging begins to cost. The orb stops recharging by itself, and must be given treasure equal to 100 gp value per 1 PP recharged.
Suggested Penalties: Standard chances, totally random adverse effects of 50 PP cost or less affecting the caster, from Tables A3, B3, D4, and D5.
Source: Greek mythology.
Further Research: See general works on mythology, with reference to the Greek myths and gods, especially the goddess of chance or Good Fortune.

EOF
)

  shard_intro=$(cat <<'EOF'
Source: Arabian folklore.
Further Research: See The Arabian Nights' Entertainments (or 1001 Nights, from circa 1450) and related references, including Sinbad the Sailor, Aladdin, Scheherazade, the Roc, and similar material.

Your Notes:

SHARD OF SAKKRAD
According to very old legends, the original home of mankind was in the middle of a vast mountain, so huge that the sun was said to rise from one of its peaks and set on the opposite. The entire base of this mountain is the fabled emerald Sakkrad; its reflection gives the azure hue to the sky. One small piece of that emerald, this very shard, was stolen by a djinni, who subsequently vanished from existence; the shard has never reappeared. It is said to hold unimaginable power; some say that mortal man was not meant to have it, and cannot possibly control it. Others dismiss it as pure legend. Yet despite the tales, many adventurers of great fame and power have gone in search of it; none are known to have returned.
Description: This is a 3-foot-long imperfect hexagonal crystal of azure hue, with sharp edges and pointed ends.
Magnitude: Major artifact.
Power Limits: 4/A, 4/B, 4/C, 5/D
Sphere: Matter (Fighters, earth)

EOF
)

  shard_core=$(cat <<'EOF'
Suggested Powers (PP 750):
Disintegrate 80
Mass charm 75
Polymorph any object 75
Detect magic 15
Plane travel 65
Telekinesis 40
Create any monster 100
Automatic healing 100
Shapechange 100
Luck 100

Activation: The shard is active when found. Anyone who touches it immediately and magically knows all the names, details, and command words of all of its powers. However, all this knowledge vanishes immediately when physical contact ends.
Use of Powers: A power is granted to the user when the proper command word is spoken. It remains until used or until the user stops touching the item.
Suggested Handicaps (4; #1 appears when the item is first used; others appear in sequence whenever the user draws on a 100 point power):
1. Magic error: A 25% chance of error occurs whenever the user casts a spell or utters any command words, except those used on the shard.
2. Operating Costs: The user loses 10% of all treasure owned, and loses 10% each time a 100 point power is employed thereafter.
3. Greed: Anyone seeing the user produce any visible effect of the shard's powers must make a Saving Throw vs. Spells, with a -4 penalty to the roll, or immediately attack the user with intention to possess the shard.
4. Doom: The next time the user employs a 100 point power, there is a 5% chance that an Immortal will arrive. This chance increases by 2% each time a 100 point power is used again. If the Immortal arrives, all within sight range have the choice of watching or looking away. Each of those watching must make a Saving Throw vs. Death Ray, with a -10 penalty to the roll, or die. Each of those looking away may make a Saving Throw vs. Spells; if successful, no further effect occurs, but if failed, each must make the previously mentioned Saving Throw vs. Death Ray. The Immortal departs within 1 round, taking the user and all of his or her non-living valuables, wherever they may be. The shard is not taken, but is teleported to a random location within 10,000 miles.

Suggested Penalties (8; 20% chance of appearance when any power is used; equal chances for each):
1. Delayed blast fire ball within 10' of user, set to detonate in 1-4 rounds; normal saving throw applies to all victims.
2. User takes 40 points of damage.
3. Healing error: When the automatic healing power is next triggered, it drains the usual 100 PP but cures only 10 points of damage, or fails utterly to cure any other effect, poison, disease, and so forth.
4. The user is struck with Paranoia.
5. Memory lapse: The user suddenly and completely forgets how to cast spells, if a spell user, or how to use weapons for 2-20 days; no saving throw.
6. The user is struck by Withdrawal; Saving Throw vs. Spells applies, but with a -5 penalty.
7. Anti-Magic 100%, 10' radius emanating from the artifact. The Anti-Magic will remain until wished away, or until the user washes it in the water at either the north pole or the south pole.
8. Saving Throw penalty: A -8 penalty applies to the user's Saving Throws vs. fire-type attacks.

EOF
)

  master_replace_block_between_regex_markers 'A1 Poison breath\s+50\s*\nB3\s+Haste\s+30\s*\nC1 Produce fire\s+15\s*\n.*?(?:\n\s*)?(?=DIAMOND ORB OF TYCHE)' 'DIAMOND ORB OF TYCHE' "$comb_tail"
  master_replace_block_between_markers 'DIAMOND ORB OF TYCHE' 'FIERY BRAND OF MASAUWU' "$diamond_block"
  master_replace_block_between_regex_markers '\s*Source: Arabian folklore\.?\s*\n.*?(?:\n\s*)?(?=Suggested Powers \(PP 750\):)' 'Suggested Powers \(PP 750\):' "$shard_intro"
  master_replace_block_between_markers 'Suggested Powers (PP 750):' 'Source: North African creation myth.' "$shard_core"
  perl -0pi -e "
    s/\\)DIAMOND ORB OF TYCHE/\\)\\n\\nDIAMOND ORB OF TYCHE/g;
    s/Your Notes:DIAMOND ORB OF TYCHE/Your Notes:\\n\\nDIAMOND ORB OF TYCHE/g;
    s/(\\d+\\s+Hit Dice)\\.Source:/\$1.\\nSource:/g;
    s/Good Fortune\\.FIERY BRAND OF MASAUWU/Good Fortune\\.\\n\\nFIERY BRAND OF MASAUWU/g;
    s/etc\\.SHARD OF SAKKRAD/etc\\.\\n\\nSHARD OF SAKKRAD/g;
    s/Sphere: Matter \\(Fighters, earth\\)Suggested Powers \\(PP 750\\):/Sphere: Matter \\(Fighters, earth\\)\\n\\nSuggested Powers \\(PP 750\\):/g;
    s/7\\. Anti-Magic 100%, 10' radius emanat-\\n\\s*ing from the artifact\\./7. Anti-Magic 100%, 10' radius emanating from the artifact./g;
    s/fire-type attacks\\.Source:/fire-type attacks\\.\\nSource:/g
  " "$MASTER_OUT"
}

master_dedupe_top_sections() {
  local tmp
  tmp=$(mktemp)
  awk '
    /^### / {
      if (seen[$0]++) {
        skip = 1
        next
      }
      skip = 0
    }
    !skip { print }
  ' "$MASTER_OUT" > "$tmp"
  mv "$tmp" "$MASTER_OUT"
}

master_extract_existing_section_to_tmp() {
  local label="$1"
  local tmp="$2"

  awk -v heading="### $label" '
    $0 == heading { in_section = 1; next }
    /^### / && in_section { exit }
    in_section { print }
  ' "$OUT" > "$tmp"
}

master_spell_block_named() {
  local label="$1"
  local note="$2"
  local pdf="$3"

  printf '### %s\n\n' "$label" >> "$OUT"
  printf -- '- Extraction note: %s\n\n' "$note" >> "$OUT"
  printf '```text\n' >> "$OUT"
  printf '[Master pages 5-6: cleric spell material]\n' >> "$OUT"
  cat >> "$OUT" <<'TXT'
Cleric
All rules on spell casting are given in the
D&D Basic and Expert sets.
Any spell marked with an asterisk (*) may
be reversed, as given in the spell description.
Any reversible cleric spell may be reversed
during the casting and need not be memo-
rized in reversed form.
Each spell in the list below is followed by a
reference to the full text of the spell. C =
D&D Companion Set Players Manual
(page number for the 1984 edition).

CLERIC EXPERIENCE TABLE
Spells by Spell Level

Level  XP         1  2  3  4  5  6  7
26     1,900,000  8  7  7  6  6  5  5
27     2,000,000  8  8  7  6  6  6  5
28     2,100,000  8  8  7  7  7  6  5
29     2,200,000  8  8  7  7  7  6  6
30     2,300,000  8  8  8  7  7  7  6
31     2,400,000  8  8  8  8  8  7  6
32     2,500,000  9  8  8  8  8  7  7
33     2,600,000  9  9  8  8  8  8  7
34     2,700,000  9  9  9  8  8  8  8
35     2,800,000  9  9  9  9  9  8  8
36     2,900,000  9  9  9  9  9  9  9

Hit points: +1 per level, with no Constitution effect.

CLERIC SAVING THROW TABLE

Category               25-28  29-32  33-36
Death Ray or Poison    3      2      2
Magic Wands            4      3      2
Paralysis or Stone     4      3      2
Dragon Breath          4      3      2
Rod, Staff, or Spell   4      3      2

CLERIC TURNING UNDEAD TABLE

Undead      25-28  29-32  33-36
Skeleton    D#     D#     D#
Zombie      D+     D#     D#
Ghoul       D+     D+     D#
Wight       D+     D+     D+
Wraith      D+     D+     D+
Mummy       D+     D+     D+
Spectre     D      D+     D+
Vampire     D      D      D
Phantom     D      D      D
Haunt       D      D      D
Spirit      D      D      D
Nightshade  D      D      D
Lich        T      T      T
Special     T      T      T

T   automatic Turn, 2d6 Hit Dice of undead
D   automatic Destroy, 2d6 Hit Dice
D+  automatic Destroy, 3d6 Hit Dice
D#  automatic Destroy, 4d6 Hit Dice

SEVENTH-LEVEL CLERIC SPELLS
1. Earthquake (C13)
2. Holy Word (C13)
3. Raise Dead Fully* (C13)
4. Restore* (C13)
5. Survival (described below)
6. Travel (described below)
7. Wish (page 4)
8. Wizardry (page 4)
TXT
  render_tsv_cols_pages "$pdf" 5 6 '185,370' \
    | awk '
        started {
          if (/^Druid$/) exit
          print
          next
        }
        /^Survival$/ { started = 1; print }
      ' >> "$OUT"
  printf '\n[Master pages 6-7: druid spell material]\n' >> "$OUT"
  render_tsv_cols_pages "$pdf" 6 7 '185,370' \
    | awk '
        started {
          if (/^Magic-user$/) exit
          print
          next
        }
        /^Druid$/ { started = 1; print }
      ' >> "$OUT"
  printf '\n[Master pages 8-12: magic-user spell material]\n' >> "$OUT"
  cat >> "$OUT" <<'TXT'
Magic-user
All details on spell casting are given in the
D&D Basic and Expert sets. Any spell
marked with an asterisk (*) may be reversed,
as given in the spell description. All reversible
magic-user spells must be memorized in
reversed form to be used.
C = D&D Companion Set Players Manual
(page number for the 1984 edition).

MAGIC-USER SAVING THROW TABLE

Category                    25-27  28-30  31-33  34-36
Death Ray or Poison         4      3      3      2
Magic Wands                4      4      3      2
Paralysis or Turn to Stone 5      4      3      2
Dragon Breath              4      3      2      2
Rod, Staff, or Spell       5      4      3      2

Special Note: Any damage-causing spell can produce a maximum of 20 dice (of whatever type is applicable) of damage.

MAGIC-USER EXPERIENCE TABLE
Spells by Spell Level

Level  XP         1  2  3  4  5  6  7  8  9
26     2,850,000  7  7  7  6  6  5  5  4  3
27     3,000,000  7  7  7  6  6  5  5  5  4
28     3,150,000  8  8  7  6  6  6  6  5  4
29     3,300,000  8  8  7  7  7  6  6  5  5
30     3,450,000  8  8  8  7  7  7  6  6  5
31     3,600,000  8  8  8  7  7  7  7  6  6
32     3,750,000  9  8  8  8  8  7  7  7  6
33     3,900,000  9  9  9  8  8  8  7  7  7
34     4,050,000  9  9  9  9  8  8  8  8  7
35     4,200,000  9  9  9  9  9  9  8  8  8
36     4,350,000  9  9  9  9  9  9  9  9  9

Hit points: +1 per level, with no Constitution effect.

EIGHTH-LEVEL MAGIC-USER SPELLS
1. Clone (described below)
2. Create Magical Monsters (page 7)
3. Dance (C24)
4. Explosive Cloud (C24)
5. Force Field (page 8)
6. Mass Charm* (C24)
7. Mind Barrier* (C24)
8. Permanence (C25)
9. Polymorph Any Object (C25)
10. Power Word Blind (C25)
11. Symbol (C25)
12. Travel (page 8)

NINTH-LEVEL MAGIC-USER SPELLS
1. Contingency (page 8)
2. Create Any Monster (page 8)
3. Gate* (C26)
4. Heal (page 9)
5. Immunity (page 9)
6. Maze (C26)
7. Meteor Swarm (C26)
8. Power Word Kill (C26)
9. Prismatic Wall (page 9)
10. Shapechange (page 9)
11. Timestop (page 10)
12. Wish (page 10)
TXT
  render_tsv_cols_pages "$pdf" 8 12 '185,370' \
    | awk '
        started {
          if (/^Weapon Mastery$/) exit
          print
          next
        }
        /^Clone$/ { started = 1; print }
      ' >> "$OUT"
  printf '\n```\n\n' >> "$OUT"
}

master_nonhuman_block_named() {
  local label="$1"
  local note="$2"
  local pdf="$3"

  printf '### %s\n\n' "$label" >> "$OUT"
  printf -- '- Extraction note: %s\n\n' "$note" >> "$OUT"
  printf '```text\n' >> "$OUT"
  printf 'Spell Casters (Non-Human)\n' >> "$OUT"
  printf '\n' >> "$OUT"
  render_tsv_cols_pages "$pdf" 59 61 '185,370' \
    | awk '
        started {
          if (index($0, "UNDEAD ATTEMPTS")) exit
          print
          next
        }
        /^A non-human cleric or druid is known as a$/ { started = 1; print }
      ' >> "$OUT"
  printf '\nUNDEAD ATTEMPTS TO CONTROL OTHER UNDEAD\n' >> "$OUT"
  printf 'Pawn          4   5-6  7-8  9-10  11-13  14-16  17-19  20-23  24-27  28-32  33+\n' >> "$OUT"
  printf 'Skeleton      7   5    3    C     C      C      C      C      C      C      C\n' >> "$OUT"
  printf 'Zombie        9   7    5    3     C      C      C      C      C      C      C\n' >> "$OUT"
  printf 'Ghoul         11  9    7    5     3      C      C      C      C      C      C\n' >> "$OUT"
  printf 'Wight             11   9    7     5      3      C      C      C      C      C\n' >> "$OUT"
  printf 'Wraith                  11   9     7      5      3      C      C      C      C\n' >> "$OUT"
  printf 'Mummy                        11    9      7      5      3      C      C      C\n' >> "$OUT"
  printf 'Spectre                             11     9      7      5      3      C      C\n' >> "$OUT"
  printf 'Vampire (a)                               11     9      7      5      3      C\n' >> "$OUT"
  printf 'Vampire (b)                                      11     9      7      5      3\n' >> "$OUT"
  printf 'Phantom                                                11     9      7      5\n' >> "$OUT"
  printf 'Haunt                                                         11     9      7\n' >> "$OUT"
  printf 'Spirit                                                               11     9\n' >> "$OUT"
  printf '(a) Non-spell-using vampire of 7 or 8 Hit Dice\n' >> "$OUT"
  printf '(b) Vampire of 9 Hit Dice, or any spell-using vampire\n' >> "$OUT"
  printf 'Number: Roll needed (or higher), on 2d6, for the Liege to successfully take control of the lesser undead\n' >> "$OUT"
  printf 'C: Control is automatic\n\n' >> "$OUT"
  pdftotext -nodiag -nopgbrk -f 61 -l 61 -x 0 -y 200 -W 190 -H 500 "$pdf" - 2>/dev/null \
    | awk 'started || /A Liege can create a chain of control by/ { started = 1; print }' \
    | sed \
        -e 's/A Liege a$/A Liege at/' \
        -e 's/DM Com$/DM Com-/' \
        -e 's/Assume normal weapons$/Assume normal weapons/' \
    >> "$OUT"
  printf '\n' >> "$OUT"
  printf 'When a character tries to turn Pawns, the attempt is checked as if against the Liege. If the attempt fails, the Pawns are completely unaffected, even if they would normally be Turned or Destroyed by the result.\n\n' >> "$OUT"
  pdftotext -nodiag -nopgbrk -f 61 -l 61 -x 190 -y 200 -W 190 -H 500 "$pdf" - 2>/dev/null \
    | awk 'started || /Turn succeeds, the control link is broken, but/ { started = 1; print }' \
    | sed '1s/^/If the /' \
    >> "$OUT"
  printf '\n' >> "$OUT"
  pdftotext -nodiag -nopgbrk -f 61 -l 61 -x 380 -y 200 -W 190 -H 500 "$pdf" - 2>/dev/null \
    | awk 'started || /of these created undead may thus vary widely/ { started = 1; print }' \
    | sed \
        -e '/^[[:space:]]*Undead are not a[[:space:]]*$/d' \
        -e '/^[[:space:]]*attacks that affect only living cre[[:space:]]*$/d' \
        -e '/^[[:space:]]*charm hold discord[[:space:]]*$/d' \
    >> "$OUT"
  printf '\n```\n\n' >> "$OUT"
}

master_procedures_block_named() {
  local label="$1"
  local note="$2"
  local pdf="$3"
  local am_example_patch

  am_example_patch=$(cat <<'TXT'
instead. The weapon, shield, and armor are not checked, since they are permanent items. When the DM checks the anti-magic again at the start of the next round, the bless effect remains active, but the bonuses no longer apply from any cancelled effects.

One turn after the character leaves the A-M area, the fighter's polymorph and haste effects return. The fighter can continue the polymorph effect for 5-10 rounds more and the haste effect for about four turns more. The bless effect lasts 7-12 turns, counting both the combat rounds and the turn spent under the A-M effect; the haste countdown likewise continues while the effect is suppressed.
TXT
)

  printf '### %s\n\n' "$label" >> "$OUT"
  printf -- '- Extraction note: %s\n\n' "$note" >> "$OUT"
  printf '```text\n' >> "$OUT"
  printf '[Master procedures page 2: Anti-Magic Effects]\n' >> "$OUT"
  {
    pdftotext -layout -nodiag -nopgbrk -f 40 -l 40 -x 0 -y 40 -W 185 -H 700 "$pdf" - 2>/dev/null
    printf '\n'
    pdftotext -layout -nodiag -nopgbrk -f 40 -l 40 -x 190 -y 40 -W 185 -H 700 "$pdf" - 2>/dev/null
    printf '\n'
    pdftotext -layout -nodiag -nopgbrk -f 40 -l 40 -x 380 -y 40 -W 185 -H 700 "$pdf" - 2>/dev/null
    printf '\n'
  } \
    | awk 'started || /^Anti-Magic Effects$/ { started = 1; print }' \
    | awk 'stopped { next } /^Character Notes$/ { stopped = 1; next } { print }' \
    | awk 'skip { if (/^about four turns more\.$/) skip = 0; next } /^instead\. The weapon,$/ { skip = 1; next } { print }' \
    | sed \
        -e '/^[[:space:]]*Procedures[[:space:]]*$/d' \
        -e '/^[[:space:]]*The following procedures are covered in[[:space:]]*$/d' \
        -e '/^[[:space:]]*this section:[[:space:]]*$/d' \
        -e '/^[[:space:]]*Dominion Income and XP[[:space:]]*$/d' \
        -e '/^[[:space:]]*Encounters[[:space:]]*$/d' \
        -e '/^[[:space:]]*Experience Point Values[[:space:]]*$/d' \
        -e '/^[[:space:]]*X P of Selected Monsters[[:space:]]*$/d' \
        -e '/^[[:space:]]*Hit Roll Charts \(Monsters\)[[:space:]]*$/d' \
        -e '/^[[:space:]]*Immortals[[:space:]]*$/d' \
        -e '/^[[:space:]]*Intelligence[[:space:]]*$/d' \
        -e '/^[[:space:]]*Mystics[[:space:]]*$/d' \
        -e '/^[[:space:]]*Reality Shifts[[:space:]]*$/d' \
        -e '/^[[:space:]]*Record Keeping[[:space:]]*$/d' \
        -e '/^[[:space:]]*Spell Casters \(Non-Human\)[[:space:]]*$/d' \
        -e '/^[[:space:]]*Undead Lieges and Pawns[[:space:]]*$/d' \
        -e '/^[[:space:]]*2[[:space:]]*$/d' \
        -e 's/This ray.s A-M value is 100%/This ray\x27s A-M value is 100%;/' \
        -e 's/ofexistence/of existence/g' \
        -e 's/Ele mental/Ele-\nmental/g' \
        -e 's/Spheres o$/Spheres of/' \
        -e 's/Sphere o$/Sphere of/' \
        -e 's/Power (Matter, Energy, Time, and Thought$/Power (Matter, Energy, Time, and Thought)/' \
        -e 's/one or more o$/one or more of/' \
        -e 's/avoid most o$/avoid most of/' \
        -e 's/magical item is moved out of the ray, i$/magical item is moved out of the ray, it/' \
        -e 's/hasreeffect/haste effect/g' \
        -e 's/sword ofspeed-/sword of speed-/' \
        -e 's/porion offlying/potion of flying/g' \
        -e 's/porion of polymorph self/potion of polymorph self/g' \
    | awk -v patch="$am_example_patch" '
        !inserted && /^3\. Area spell effects$/ {
          print ""
          print patch
          print ""
          inserted = 1
        }
        { print }
      ' \
    >> "$OUT"
  printf '\n[Master procedures page 6: Dispel Magic]\n' >> "$OUT"
  {
    pdftotext -layout -nodiag -nopgbrk -f 44 -l 44 -x 0 -y 40 -W 185 -H 700 "$pdf" - 2>/dev/null
    printf '\n'
    pdftotext -layout -nodiag -nopgbrk -f 44 -l 44 -x 190 -y 40 -W 185 -H 700 "$pdf" - 2>/dev/null
    printf '\n'
    pdftotext -layout -nodiag -nopgbrk -f 44 -l 44 -x 380 -y 40 -W 185 -H 700 "$pdf" - 2>/dev/null
    printf '\n'
  } \
    | awk 'started || /^Dispel Magic$/ { started = 1; print }' \
    | awk 'stopped { next } /^Dominion Income and XP$/ { stopped = 1; next } { print }' \
    | sed \
        -e '/^[[:space:]]*Procedures[[:space:]]*$/d' \
        -e '/^[[:space:]]*6[[:space:]]*$/d' \
      -e 's/ringofspellstoring/ring of spell storing/g' \
      -e 's/ring of spell storingare/ring of spell storing are/g' \
        -e 's/Ifthe/If the/g' \
        -e 's/ofwonder/of wonder/g' \
    >> "$OUT"
  printf '\n```\n\n' >> "$OUT"
}

master_artifact_chapter_context_named() {
  local label="$1"
  local note="$2"
  local page

  printf '### %s\n\n' "$label" >> "$OUT"
  printf -- '- Extraction note: %s\n\n' "$note" >> "$OUT"
  printf '```text\n' >> "$OUT"
  for page in $(seq 83 102); do
    if [ "$page" -eq 102 ]; then
      {
        pdftotext -layout -nodiag -nopgbrk -f "$page" -l "$page" -x 8 -y 40 -W 198 -H 720 "$MASTER_PDF" - 2>/dev/null
        printf '\n'
        pdftotext -layout -nodiag -nopgbrk -f "$page" -l "$page" -x 206 -y 40 -W 184 -H 720 "$MASTER_PDF" - 2>/dev/null
        printf '\n'
        pdftotext -layout -nodiag -nopgbrk -f "$page" -l "$page" -x 392 -y 40 -W 178 -H 720 "$MASTER_PDF" - 2>/dev/null
        printf '\n\n'
      } \
    else
      {
        pdftotext -layout -nodiag -nopgbrk -f "$page" -l "$page" -x 10 -y 40 -W 185 -H 720 "$MASTER_PDF" - 2>/dev/null
        printf '\n'
        pdftotext -layout -nodiag -nopgbrk -f "$page" -l "$page" -x 200 -y 40 -W 185 -H 720 "$MASTER_PDF" - 2>/dev/null
        printf '\n'
        pdftotext -layout -nodiag -nopgbrk -f "$page" -l "$page" -x 390 -y 40 -W 180 -H 720 "$MASTER_PDF" - 2>/dev/null
        printf '\n\n'
      } \
    fi \
      | sed '/^[[:space:]]*[0-9][0-9]*[[:space:]]*$/d' \
      | sed '/^[[:space:]]*Artifacts[[:space:]]*$/d' \
      | sed '/^[[:space:]]*Other Magic Items[[:space:]]*$/d' \
      | awk '
          BEGIN{blank=0}
          /^[[:space:]]*$/ { blank++; if (blank <= 1) print ""; next }
          { blank=0; print }
        ' \
      >> "$OUT"
  done
  printf '\n```\n\n' >> "$OUT"
}

master_named_artifact_operation_witnesses_named() {
  local label="$1"
  local note="$2"
  local tmp

  tmp=$(mktemp)
  master_extract_existing_section_to_tmp 'Named Artifact Catalog' "$tmp"

  printf '### %s\n\n' "$label" >> "$OUT"
  printf -- '- Extraction note: %s\n\n' "$note" >> "$OUT"
  printf '```text\n' >> "$OUT"
  printf '[Derived from the staged named-artifact catalog by extracting operational paragraphs]\n\n' >> "$OUT"
  awk '
    function flush_record() {
      if (artifact != "" && body != "") {
        print artifact
        print body
        print ""
      }
      body = ""
    }
    function is_artifact_heading(line) {
      return (line ~ /^[A-Z0-9][A-Z0-9'\'' ,.-]+$/ \
        && line !~ /^THE / \
        && line !~ /^SOURCE:/ \
        && line !~ /^FURTHER RESEARCH:/)
    }
    {
      if (is_artifact_heading($0)) {
        flush_record()
        artifact = $0
        capture = 0
        next
      }
      if (artifact == "") next

      if ($0 ~ /^(Activation:|Use of Powers:|Suggested Handicap|Suggested Handicaps|Suggested Penalty|Suggested Penalties|Other Details:)/) {
        if (body != "") body = body "\n"
        body = body $0
        capture = 1
        next
      }

      if (capture) {
        if ($0 ~ /^(Description:|Magnitude:|Power Limits:|Sphere:|Suggested Powers|Source:|Further Research:)/ || is_artifact_heading($0)) {
          capture = 0
          if (is_artifact_heading($0)) {
            flush_record()
            artifact = $0
          }
          next
        }
        if ($0 ~ /^[[:space:]]*$/) {
          body = body "\n"
          capture = 0
          next
        }
        body = body "\n" $0
      }
    }
    END { flush_record() }
  ' "$tmp" >> "$OUT"
  printf '\n```\n\n' >> "$OUT"
  rm -f "$tmp"
}

master_named_artifacts_block_named() {
  local label="$1"
  local note="$2"
  local pdf="$3"

  printf '### %s\n\n' "$label" >> "$OUT"
  printf -- '- Extraction note: %s\n\n' "$note" >> "$OUT"
  printf '```text\n' >> "$OUT"
  printf '[Master named-artifact pages 56-63: curated source-derived catalog block]\n\n' >> "$OUT"

  cat >> "$OUT" <<'TXT'
The "Known" Artifacts
The following section gives full details for several known artifacts. Each has been constructed using the following system; each is also based on material from myths, legends, and works of literature. You are free to modify any and all of the powers given, and this is recommended if your players have read this booklet of rules. Some space is left below each description for your notes on actual powers.

The introduction of any artifact into a campaign should be preceded by rumors or myths of its existence. General information about each artifact is given in a separate introductory paragraph which may be read to the players. You may elaborate on the information given, or may discredit it entirely, developing your own backgrounds.

ARMET BY WAYLAND
This is a tight-fitting helmet with bevor (chinpiece) and movable visor, crafted by the legendary Immortal armorer Wayland Smith. Some claim that it makes the wearer invulnerable to all attacks.

Magnitude: Lesser artifact.
Power Limits: 3/A, 3/B, 2/C, 3/D
Sphere: Matter (Fighters, earth)
Suggested Powers (PP 225):
B3 Fly 25 PP
D1 Invisibility 20 PP
D1 Immunity 100 PP
D2 -8 AC bonus 80 PP

Activation: The Armet is not active when acquired. It is activated if the user wears it while slaying any large or huge dragon. The user may be aided in the battle, but must either inflict at least 1/2 the damage needed to kill the monster or personally deliver the blow that slays.

CLAW OF MIGHTY SIMURGH
Long ago, a great roc-like bird appeared to a wandering cleric. The bird said it was Immortal, and had already seen three cycles of life on earth, each ending in destruction by water, ice, and fire. It gave one of its smallest claws (a mere 2 feet long) to the cleric. Explaining its powers, the Mighty Simurgh asked that it be used for the betterment of mankind. The cleric did what she could, but lives no more, and the claw has apparently fallen into the clutches of Chaos.

Description: Curved talon 25 inches long, made of an ivory-like substance.
Magnitude: Minor artifact.
Power Limits: 2/A, 2/B, 2/C, 2/D
Sphere: Time (Clerics, water)
Suggested Powers (PP 100):
A3 Calm others 30
A5 Turn bonus, +2 + 1d6 HD 20
B2 Predict weather 10
D3 Immune to poison 40

Activation: The artifact is active when acquired.
Use of Powers: Once the claw is claimed, full knowledge is granted telepathically during the user's first sleep.
Suggested Handicap (1), activated when first power is used: The user loathes violence, urges peace to all living things, and refuses to attack anyone unless attacked. This effect does not cover undead.
Suggested Penalty (1), 25% chance whenever rainfall, flooding, tornado, falling snow, or similar weather is witnessed: Service. The user imagines that the Simurgh has demanded an interview. The user must gather a party to go to the far northern mountains, leaving within 3 days. The effect wears off when the mountains are reached.
Source: Ancient Middle Eastern legend.
Further Research: This is a recurrent but very general theme, a great being that has lived forever and possesses the knowledge of the ages. Look for similar recurrent themes among the myths of different cultures; related items can prove suitable for artifact design, and usable in nearly any setting.

COMB OF THE KORRIGANS
A group of nine powerful elves took a rare woodland creature (the Korrigan) as their symbol. Successful as a mortal group, they resumed their close friendship after all reached Immortality. Together they created this item to aid mortal elves to reach Immortality, but only if they strive toward representing the best of elvenkind. The Korrigans became nearly legendary in mortal life, commonly using shapechanging and haste in their travels and combats, and this device presumably bestows similar powers.

Description: Hair comb, 5 inches long, made of pink bone-like substance, fine teeth.
Magnitude: Lesser artifact.
Power Limits: 3/A, 3/B, 2/C, 3/D
Sphere: Energy (Magic-users, fire)
Suggested Powers (PP 215):
A1 Poison breath 50
B3 Haste 30
C1 Produce fire 15
Cure disease 20
Cure wounds, critical 35
D2 Polymorph self 65

Activation: The comb is not active when acquired. If it is left within a burning fire for 1 full turn, it is activated, but will not reveal powers. Thereafter, whenever the user befriends an elf (loaning money, curing, aiding in battle, and so forth), one power is revealed telepathically, to a maximum of 1 per day, in order of power.
Use of Powers: A power is invoked when a given combination of the comb's teeth are plucked, producing a nearly inaudible musical tone.
Suggested Handicaps (2):
1. When first power is used: User starts turning into an elf (1st level); the process takes 3 months to complete. The user becomes aware of minor changes, including animosity toward dwarves, in 2 weeks. The change stops completely as soon as the artifact is no longer owned, but the change back to normal also takes 3 months.
2. Energy drain: User loses 3 levels of experience when Poison Breath is first used.
Suggested Penalties (3; #1 appears 4 in 6, others each 1 in 6):
1. Slow spell effect centered on user.
2. Polymorph other spell effect upon user, to turn into an eagle.
3. Memory penalty: User cannot memorize any spells of the highest spell level he or she can normally study. Effect is cumulative if not removed.
Source: Breton folklore.
Further Research: Various works on folklore of the British Isles (Irish, Scottish, and Gaelic), such as Celtic Myth and Legend, by Charles Squire. See fays (or fees or faeries), druids of ancient Gaul, the Lamignak elves, Fountain Women of French folklore, and A Field Guide to the Little People (Arrowsmith and Moorse, 1977).

DIAMOND ORB OF TYCHE
This item appears to be a crystal ball, but is somewhat larger (about 18 inches across) and glows softly with a white light filled with sparkling colors. It was crafted by the powerful Immortal Tyche, said to control chance and the fortunes of mankind. It is a powerful artifact of Chaos, but is not necessarily evil, and is said to bring good fortune to the user, for a time.

Magnitude: Greater artifact.
Power Limits: 4/A, 3/B, 3/C, 4/D
Sphere: Thought (Thieves, air)
Suggested Powers (PP 405):
Pick pockets 100% 80
X-ray vision 80
Gaseous form 30
Container, 40,000 cn 80
Remove traps 75% 60
Confuse alignment 15
Hide in shadow 70% 60

Activation: The artifact is active when found. The user gets a feeling of inspiration when gazing into the orb. The artifact grants the knowledge of one power when one consecutive hour is spent gazing, to a maximum of 1 power per day, given in order of PP cost.
Use of Powers: By gazing into the orb and concentrating on a power, the user acquires that power after 1-3 rounds.
Suggested Handicaps (3):
1. When first used: Magic error. The user has a 10% chance of failure whenever attempting to cast a spell or use any magic item requiring a command word.
2. When pick pockets is first used: Alignment change to Chaotic, or to Neutral.
3. If, as a container, the artifact is ever completely filled: Recharging begins to cost. The orb stops recharging by itself, and must be given treasure equal to 100 gp value per 1 PP recharged.
Suggested Penalties: Standard chances, totally random adverse effects of 50 PP cost or less affecting the caster, from Tables A3, B3, D4, and D5.
Source: Greek mythology.
Further Research: See general works on mythology, with reference to the Greek myths and gods, especially the goddess of chance or Good Fortune.

FIERY BRAND OF MASAUWU
The legendary Guardian of Death, Masauwu (possibly another name for Orcus) is greatly feared. It is rumored that he walks across the entire earth every night, appearing as a dark-skinned giant clad in animal skins and carrying a flaming torch. This device is sometimes left for others to use, especially if they will further his causes. It has horrible and awesome powers, but if the user impresses Masauwu by employing it often and with diligence, he may grant even greater ones.

Description: This is a club-like torch, 4 feet long. It is not normally burning when found. If lit, it can only be extinguished by water.
Magnitude: Greater artifact.
Power Limits: 4/A, 3/B, 3/C, 4/D
Sphere: Entropy (Death)
Suggested Powers (PP 450):
A1 Meteor swarm 100
A1 Obliterate 90
A4 Turn as CL 36 95
A5 Spell damage bonus, 1, 2, 3 = 4 80
B2 Detect invisible 35
B3 Teleport 50

Activation: The artifact is active when found. Each time the user slays another creature by using the item, knowledge of 1 power is granted, to a maximum of 2 per day. The artifact may be wielded as a club. Powers are revealed in order of PP cost.
Use of Powers: The artifact must be lit for any powers to function, issuing forth from the flames, on command.
Suggested Handicaps (3):
1. When the first power is used: Constitution score drops 5 points, minimum score 3.
2. When turn undead is first used: Energy drain; user loses 3 levels.
3. When spell damage bonus is first used to augment meteor swarm: Doom is sent. User and artifact will utterly vanish, but leave all equipment carried, either when user is next struck by any undead creature, or when spell damage bonus is applied to the meteor swarm a third time.
Suggested Penalties (5, standard chances of appearance, equal chances for each):
1. Cause critical wounds, cast at user; saving throw applies.
2. Attract undead: If adventuring underground or outdoors after dark, 2-8 undead arrive in 1-6 rounds. All are of one type; roll 1d12 to find Hit Dice type.
3. Operating Cost: User loses 20% of all treasure owned, not counting magic.
4. Die: User drops dead instantly, no saving throw. Can be normally raised.
5. Poison gas: Artifact releases 20,000 cubic feet of purple gas. Each victim within it must make a Saving Throw vs. Poison, with a -2 penalty, or die. User is not affected by the gas.
Source: Hopi (American Indian) legends.
Further Research: From the North American Indians; see various pamphlets from universities and museums of the United States, especially for Hopi Indian legends. Truth of a Hopi by Edmund Nequatewa (Museum of Northern Arizona, Flagstaff). Note also that the lord of the Overworld and Guardian of the dead appears in legends of many other tribes.

GIRDLE OF ARMIDA
Armida was once a famous sorceress in a far land. To help her achieve the greatest heights in her craft, her immortal uncle, Idraote, gave her this girdle. However, she used it to tempt and confuse paladins, generally bringing confusion and discord to others. Having fallen to petty abuse of her powers, Armida did not reach her Immortal goal; but the girdle remains, to tempt and possibly aid other magic-users to become Paragons. It is supposedly watched over by Idraote to this day.

Description: This is a simple human-sized leather belt, though it will shrink or enlarge to fit any user. It is ornately tooled with arcane symbols which describe its powers and command words; however, this ancient language of magic can only be deciphered by a read magic spell from a 30th or higher level caster.
Magnitude: Minor artifact.
Power Limits: 2/A, 1/B, 2/C, 3/D
Sphere: Energy (Magic-users, fire)
Suggested Powers (PP 100):
A2 Charm monster 30
A2 Confusion 25
C2 Change odors 15
D2 Memorize +3 spell levels 30

Activation: The girdle is active when found.
Use of Powers: Powers are activated by command words given on the girdle.
Suggested Handicap (1, when first used): Extra damage. Whenever the user is struck by any natural weapon (claw, bite, and so forth), he or she takes 1-10 points of extra damage. This becomes 1 less point of damage for each 10 days that pass after the artifact is no longer owned, vanishing in 100 days.
Suggested Penalties (2):
1. Whenever either attack, charm or confusion, is cast at a Lawful or Neutral creature, hold person is cast at the user; saving throw applies.
2. At standard chances: size change; the user gains or loses, equal chances, 50% of current height.
Source: Italian literary romance works dealing with the First Crusade (1096-1099).
Further Research: See a translation of the romantic epic Gerusalemme Liberata (Jerusalem Delivered) by Torquato Tasso (1581).

HUMBABA'S GLARING EYE
The huge one-eyed monster Humbaba was fought long ago by a great hero, named Gilgamesh. Its eye was taken after its defeat, and was made into an artifact by Ninsun, a powerful Immortal. It eventually caused Gilgamesh to seek immortality above all else, but he failed, and was eventually destroyed. The Eye remains, a famed symbol of death and destruction. The Eye is said to provide the powers of the original monster, including breath and gaze weapons.

Description: This appears to be a mummified monstrous eyeball, 4 inches in diameter. It is reddish white in color, with a black iris and many bulging red arteries and blue veins.
Magnitude: Lesser artifact.
Power Limits: 3/A, 2/B, 2/C, 3/D
Sphere: Energy (Magic-users, fire)
Suggested Powers (PP 190):
A1 Cause disease 25
A1 Fire breath 60
A3 Flesh to stone 50
C3 Summon weather 55

Activation: The eye is active when found, but it is difficult to gain knowledge of the powers. The user must employ ESP or clairvoyance, and look through the eye into a reflecting surface, such as a mirror or water. In the reflection of the center of the eye, the user may read the name of one effect and its command word, if the language can be understood, thus requiring a read language at the same time. The information changes each midnight, to that of a randomly determined power; thus, many readings may be required before all the powers are revealed.
Use of Powers: The eye does not grant powers to its user, but produces the effects itself; it may be accurately aimed with very little practice.
Suggested Handicap (1): The user becomes obsessed with seeking Immortality. Every 10 days, a Saving Throw vs. Spells is made, the first with a -1 penalty, the second with -2, the third with -3, and so forth. A failed saving throw forces the user to choose and begin to actively pursue one of the routes to Immortality, forsaking all other activities.
Suggested Penalties (2, standard chances):
1. Body part change: The user's head enlarges to 4 times normal size, large enough to accommodate Humbaba's Glaring Eye, if the user lacks one. This effect is not cumulative.
2. Age: The user becomes 10-40 years older. No saving throw applies, but the effect may be dispelled.
Source: Babylonian myths.
Further Research: The Epic of Gilgamesh (circa 2000 B.C.) and general references on mythology, especially Sumerian and Babylonian.

HYMIR'S STEAMING CALDRON
The vain Immortal giant Hymir created this device to produce vast amounts of superb ale for his own enjoyment, and for his friends Thor and other Immortals. Its powers can, however, be used in other ways.

Description: This is a black iron kettle with a handle, of a type normally found in kitchens. It is about 18 inches across and 1 foot tall.
Magnitude: Minor artifact.
Power Limits: 2/A, 1/B, 2/C, 3/D
Sphere: Time (Clerics, water)
Suggested Powers (PP 35):
A1 Create poison* 40
B4 Container, 10,000 cn 20
C1 Create water 20
C2 Change tastes 20
*Note: The only poison this will create is alcohol.

Activation: The kettle is inactive when found. The user may activate it by filling it with water and heating it over a fire. The user may read the powers and command words in the rising bubbles by using a read magic spell. However, it is impossible to exactly duplicate Hymir's formula for the taste of his ale, unless a sample of his ale has been tasted.
Use of Powers: Each power is triggered by command words. The user may give the commands from up to 10 feet away. However, each power applies only to the contents of the kettle.
Suggested Handicap (1): Fumbling; whenever the user attacks another with either a weapon or spell, he or she has 1 chance in 6 of fumbling the attack.
Suggested Penalty (1): Memory penalty, with different effects as detailed below.
Spell caster: After memorizing spells, the user immediately forgets 1 spell of each odd-numbered spell level, up to 1 each of 1st, 3rd, 5th, 7th, and 9th level spells.
Non-spellcaster: The user immediately forgets how to use 1 weapon.
Source: Scandinavian mythology.
Further Research: See general reference works on mythology, especially referring to the giants of the Norse myths, which are different from D&D game giants; Hymir is a minor character, usually appearing only in references to Thor and the Midgard Serpent.

IVORY PLUME OF MAAT
This small but exquisitely crafted feather-shaped brooch was created by a great Paladin, the beautiful fighter Maat. She was a many-talented mortal, and strove always to promote good over evil. Her device is said to enable the user to follow in her noble footsteps, doing good deeds and furthering the cause of Law and Justice.

Description: The plume is 3 inches long, made of very fine ivory.
Magnitude: Greater artifact.
Power Limits: 4/A, 3/B, 3/C, 4/D
Sphere: Matter (Fighters, earth)
Suggested Powers (PP 490):
A1 Dispel evil 40
A2 Geas 50
A4 Continual light 35
A4 Turn as CL 24 70
B1 Lie detection 50
B2 Know alignment 20
B2 Choose Option 45
C2 Purify food + water 10
C2 Repair normal objects 10
D1 Remove fear 10
D2 +4 Saving Throw bonus 50
D3 Immune to disease 20
D3 Immune to energy drain 80

Activation: The plume is active when acquired. Knowledge of the powers is immediately telepathically granted to any user who is a Paladin or Lawful Knight. Any other would-be user must gain the knowledge through a contact other plane or commune spell, by asking Maat directly.
Use of Powers: Each power can be activated by mental command alone.
Suggested Handicaps (3):
1. When first used: alignment changes to Lawful; if already Lawful, become more rigidly so, and work more actively to defeat Chaos.
2. Magic error: An 80% chance of error applies whenever the user casts a spell, or uses a magical device requiring a command word, to harm any Lawful or Neutral creature that has no evil intentions.
3. Recharging: The artifact will not recharge itself. Whenever the user slays a chaotic creature, or any creature with evil intentions, while openly wearing the plume, 1 PP is recharged for each 100 XPV of the creature slain, rounded up. When the artifact is fully charged, excess recharge power is ignored.
Suggested Penalties (5):
1. Whenever the item is touched: If the creature touching the plume is Chaotic or has evil intentions, obliterate is cast at the creature, no saving throw, and uses 90 PP.
2. When first used: Wall of stone forms as a closed cylinder around the user. However, if the user closes his or her eyes, thinks of justice or Maat, and steps forward, the wall vanishes when touched. The wall is completely invulnerable to outside attacks, including a wish. If the wall is destroyed or damaged by the user, he or she thereafter takes double damage from all physical attacks, no saving throw, and unremovable, as a Handicap.
3. If the user ever slays a Lawful creature, the user is immediately reduced to -10 hp and dies, no saving throw.
4. At standard chances: Harden. A volume of up to 30,000 cubic feet of mud, mire, swamp, or other muck suddenly dries completely, if within 120 feet of the user.
5. At standard chances: Opponents. 1-4 Chaotic enemies condense magically from the air, within 30 feet of the user. All the creatures are of one type; the type has a number of Hit Dice equal to 31-50% (1d20 + 10%) of the user's levels. The creatures are native to the user's plane of existence, considering undead native to any plane. Each opponent has maximum possible hit points. Neither side has surprise.
Source: Egyptian mythology.
Further Research: The Book of the Dead, translated by E. A. Wallis Budge, and other references on Egyptian mythology. Maat, goddess of absolute order, was wife of Thoth, god of knowledge, and daughter of Ra, the highest ruler and sun god of the mythos, and assisted in the work of creation.

ORTNIT'S LANCE OF DOOM
It is not known how the hero Ortnit, or Hartnit, acquired this powerful weapon. The device's origin is also a mystery. Ortnit defeated many giants with it, so it may have great powers against this ilk; but he was later slain ignominiously by a small white dragon, which is odd considering his legendary power. The weapon remains, but is often shunned, rumored to bring death to any user.

Description: This is an ornately scribed lance, entirely sheathed in light metal, which can only be used when riding a mount, base damage 2d6.
Magnitude: Minor artifact.
Power Limits: 2/A, 1/B, 2/C, 3/D
Sphere: Entropy (Death)
Suggested Powers (PP 95):
Lance +5, +10 vs. Giants
Weapon Talent: Translating 10
A3 Hold monster 35
A2 Dodge any missile 50

Activation: The hold monster power is activated whenever the lance first strikes a creature. At that time, the user discovers that he or she feels capable of dodging missiles, the other power, and can discover the use, but not the cost, of that power through practice.
Use of Powers: Knowledge of the existence of the hold power can be deduced by observing results, but is never explained. The translating talent appears automatically as well; the user simply understands, somehow, all languages heard as long as the lance is held. The dodge power is activated as soon as the user tries to dodge a missile.
Suggested Handicap (1): The user loses 1/3 of all treasure carried each time he or she uses the lance to slay a creature.
Suggested Penalty (1): This takes effect when any creature is struck with the lance, but may not become apparent until much later. The user takes double normal damage from all blows or breaths of any dragon for one full day. The user may make the usual Saving Throw vs. a dragon's breath, taking only full normal damage if the attempt succeeds.
Source: Germanic legends.
Further Research: Refer to the medieval German epic poems composed in the 13th century and collected in Das Heldenbuch (The Book of Heroes). In this and other works, see references to Ortnit and his brother Wolfdietrich. Legends of another Germanic hero, Dietrich of Bern, were based on Theodoric the Great, King of the Ostrogoths, 454-526 A.D. The famous epic poem The Nibelungenlied is another source, based loosely on the Scandinavian Volsunga Saga with added material unique to Germanic legend.

PILEUS
The Pileus (pill-A-us) was made deliberately similar to the red Liberty Cap, a long-time symbol of freedom. An Immortal Paragon mage named Saturnius created it to bring freedom to enslaved mortals. It is rumored that the wearer of this device will remain free forever, and can free all those who suffer imprisonment of any sort.

Description: This item is a simple red felt cap, which will enlarge or shrink to fit any user. It must be worn for its powers to be used.
Magnitude: Minor artifact.
Power Limits: 2/A, 1/B, 2/C, 3/D
Sphere: Energy (Magic-users, fire)
Suggested Powers (PP 100):
B3 Dimension door 25
C3 Knock 20
D1 Free person 25
D3 Immune to paralysis 30

Activation: This cap is inactive when acquired, and will remain inactive until the would-be user wears it while freeing from imprisonment another of his or her race. The night after this act, the user receives knowledge of the cap's powers and command words, through dreams.
Use of Powers: The pileus produces its effects, either upon the user or at some object within range, whenever the user mentally commands it to do so.
Suggested Handicap (1): Repel others. The user slowly develops a repulsive invisible aura; the reaction rolls of all those coming within 30 feet are penalized -3 when the artifact is first used. However, treat any Attack result on the Reaction Table as Flee in disgust instead. Other characters may make saving throws to tolerate the repulsion, but the given penalty applies to those rolls as well. A new saving throw must be made for each hour spent in the user's presence.
Suggested Penalty (1, standard chances): Rot. One body part becomes diseased and falls off in 1 hour. This affects toes first, one by one, then fingers, ears, nose, and then limbs. A cure disease applied before the part falls off will negate the effect, at least for that occurrence.
Source: Roman and French history.
Further Research: The Liberty Cap is a common symbol of freedom in history. The red pileus, a Phrygian cap of red felt, was placed upon a slave's head during the ceremony of manumission. It was used regularly in the Roman Empire, and appeared in the French Revolution (1789-1799) as the Bonnet Rouge.

RAINBOW SCARF OF SINBAD
The success of the famous adventurer Sinbad the Sailor, whose whereabouts and even existence are now dubious, is said to have been caused by this simple item of apparel. Especially made to aid the Epic Hero on his way to Immortality, this device must be worn at all times. It may bring luck and intelligence, but will bring hazardous adventure as well if even a tenth of the legends of Sinbad are true.

Description: This is a silk scarf, 2 feet square, decorated in swirls of rainbow colors.
Magnitude: Minor artifact.
Power Limits: 2/A, 1/B, 2/C, 3/D
Sphere: Thought (Thieves, air)
Suggested Powers (PP 90):
A2 Cause fear 10
A5 Bless 10
B4 Container, 10,000 cn 10
C3 Open locks 75% 10
D2 +2 Saving Throw bonus 25
D2 Intelligence to 18 20

Activation: The artifact is not active when acquired. If it is worn while the user travels by sea, the powers of the scarf may be read in passing sea mists, by using both read magic and detect invisible spells, at the maximum rate of 1 power per hour.
Use of Powers: Any power revealed can be produced by thought alone, without uttering any command words. However, the Intelligence 18 power is produced automatically whenever the open locks power is called forth unless the user specifies otherwise.
Suggested Handicap (1): When the item is first used, the user's Wisdom drops by 4 points.
Suggested Penalty (1, standard chances): 1-4 hostile monsters of some type magically appear within 30 feet of the user. Select or randomly determine any monster from 1 to 12 Hit Dice.
Source: Arabian folklore.
Further Research: See The Arabian Nights' Entertainments (or 1001 Nights, from circa 1450) and related references, including Sinbad the Sailor, Aladdin, Scheherazade, the Roc, and similar material.

SHARD OF SAKKRAD
According to very old legends, the original home of mankind was in the middle of a vast mountain, so huge that the sun was said to rise from one of its peaks and set on the opposite. The entire base of this mountain is the fabled emerald Sakkrad; its reflection gives the azure hue to the sky. One small piece of that emerald, this very shard, was stolen by a djinni, who subsequently vanished from existence; the shard has never reappeared. It is said to hold unimaginable power; some say that mortal man was not meant to have it, and cannot possibly control it. Others dismiss it as pure legend. Yet despite the tales, many adventurers of great fame and power have gone in search of it; none are known to have returned.

Description: This is a 3-foot-long imperfect hexagonal crystal of azure hue, with sharp edges and pointed ends.
Magnitude: Major artifact.
Power Limits: 4/A, 4/B, 4/C, 5/D
Sphere: Matter (Fighters, earth)
Suggested Powers (PP 750):
Disintegrate 80
Mass charm 75
Polymorph any object 75
Detect magic 15
Plane travel 65
Telekinesis 40
Create any monster 100
Automatic healing 100
Shapechange 100
Luck 100

Activation: The shard is active when found. Anyone who touches it immediately and magically knows all the names, details, and command words of all of its powers. However, all this knowledge vanishes immediately when physical contact ends.
Use of Powers: A power is granted to the user when the proper command word is spoken. It remains until used or until the user stops touching the item.
Suggested Handicaps (4; #1 appears when the item is first used; others appear in sequence whenever the user draws on a 100 point power):
1. Magic error: A 25% chance of error occurs whenever the user casts a spell or utters any command words, except those used on the shard.
2. Operating Costs: The user loses 10% of all treasure owned, and loses 10% each time a 100 point power is employed thereafter.
3. Greed: Anyone seeing the user produce any visible effect of the shard's powers must make a Saving Throw vs. Spells, with a -4 penalty to the roll, or immediately attack the user with intention to possess the shard.
4. Doom: The next time the user employs a 100 point power, there is a 5% chance that an Immortal will arrive. This chance increases by 2% each time a 100 point power is used again. If the Immortal arrives, all within sight range have the choice of watching or looking away. Each of those watching must make a Saving Throw vs. Death Ray, with a -10 penalty to the roll, or die. Each of those looking away may make a Saving Throw vs. Spells; if successful, no further effect occurs, but if failed, each must make the previously mentioned Saving Throw vs. Death Ray. The Immortal departs within 1 round, taking the user and all of his or her non-living valuables, wherever they may be. The shard is not taken, but is teleported to a random location within 10,000 miles.
Suggested Penalties (8; 20% chance of appearance when any power is used; equal chances for each):
1. Delayed blast fire ball within 10' of user, set to detonate in 1-4 rounds; normal saving throw applies to all victims.
2. User takes 40 points of damage.
3. Healing error: When the automatic healing power is next triggered, it drains the usual 100 PP but cures only 10 points of damage, or fails utterly to cure any other effect, poison, disease, and so forth.
4. The user is struck with Paranoia.
5. Memory lapse: The user suddenly and completely forgets how to cast spells, if a spell user, or how to use weapons for 2-20 days; no saving throw.
6. The user is struck by Withdrawal; Saving Throw vs. Spells applies, but with a -5 penalty.
7. Anti-Magic 100%, 10' radius emanating from the artifact. The Anti-Magic will remain until wished away, or until the user washes it in the water at either the north pole or the south pole.
8. Saving Throw penalty: A -8 penalty applies to the user's Saving Throws vs. fire-type attacks.
Source: North African creation myth.
Further Research: This item is loosely based on a creation myth common in Africa and Asia Minor.

TOME OF SSU-MA
The Immortal Hero Ssu-Ma is said to be the father of written knowledge, bringing mankind from barbaric chaos to civilization. His Great Tome is said to gather knowledge of all sorts from the very air itself, and is thus able to provide information on anything in existence.

Description: This large, bulky book is 5 feet square and nearly a foot thick. Its covers are each half an inch thick, fastened securely by a built-in lock. The covers are not marked in any way.
Magnitude: Lesser artifact.
Power Limits: 3/A, 2/B, 2/C, 4/D
Sphere: Thought (Thieves, air)
Suggested Powers (PP 250):
A2 Feeblemind 40
B2 Lore 70
B2 Mapmaking 55
C2 Repair normal objects 10
C3 Open locks 25
D2 Memorize +5 spell levels 50

Activation: The lock on the book cannot be opened magically, and open locks attempts suffer a +50% penalty to the roll. Anyone who fails to pick the lock can never succeed in opening it. The contents of the book cannot be examined until the lock and book are opened. The first page of the book explains all of its powers, their PP costs, and the page references where the command words and instructions for each power can be found. The tome can be read easily by anyone.
Use of Powers: The tome's contents explain how the user, drawing on the power of the tome, can produce the effects of the given powers. The pages of the book cannot be used as materials for the effects, such as mapping.
Suggested Handicaps (2):
1. When first used the user suffers a -6 penalty to Strength score.
2. Body part change: The user becomes hunchbacked, and suffers a +4 penalty to Armor Class and a -4 penalty to all Hit rolls because of this deformity.
Suggested Penalties (3, standard chances):
1. User involuntarily assumes gaseous form.
2. Memory lapse: The user immediately forgets any 1st level spells memorized.
3. Service: The user is suddenly compelled to map an entire level of a nearby dungeon, using the tome, and will assemble an expedition to do so, leaving within 3 days. This effect ends when the map is completed.
Source: Ssu-ma Ch'ien, an historical figure.
Further Research: Shih chi (Records of the Historian) by Ssu-ma Ch'ien (145-90 B.C.) is called the first major Chinese historical work. For more information on this scholar, see Ssu-ma Ch'ien: Grand Historian of China, by Burton Watson (1958). For details of Chinese mythology, see Asiatic Mythology by James Hackin et alia, and Chinese Mythology by Anthony Christie.

VERTHANDI'S INVINCIBLE HOURGLASS
Verthandi, a very powerful Immortal of Time, gave mortals the ability to control Time itself, through this marvelous creation. Its powers are said to be unlimited, both in scope and danger.

Description: This item is a 3-foot-tall construction of glass and wood, identical to a normal hourglass, wooden frame around a wasp-waist glass containing sand, except for its size.
Magnitude: Lesser artifact.
Power Limits: 3/A, 2/B, 2/C, 5/D
Sphere: Time (Clerics, water)
Suggested Powers (PP 250):
A2 Sleep 15
A3 Slow 25
B1 Timekeeping 10
C2 Timestop 100
C3 Wish 100

Activation: The hourglass is active when found. The powers are automatically and magically revealed to the user, in time, and never otherwise. Powers are revealed in order of their PP costs, timestop coming before wish. One power is revealed during sleep at each full moon, every 28 days. One additional power may, 25% chance, be revealed if the user is affected by haste or a potion of speed.
Use of Powers: Any power is activated by inverting the hourglass and concentrating on the power desired while watching the flowing sand. The power is granted to the user after watching for a number of seconds equal to the PP cost. If concentration is broken before the power is acquired, the PP cost is still deducted, although no power is gained.
Suggested Handicaps (2):
1. When first used: A 10' cubic white mist issues from the hourglass, collecting around the user only. The user is immune to the mist's effects. Any victim within the gas must make a Saving Throw vs. Spells, with a -4 penalty, or age 10-40 years.
2. When either 100 point power is used, forgetfulness occurs. After memorizing spells, the user forgets 1-4 randomly selected spells. These are immediately revealed. If the user memorizes them again, to fill the loss, another 1-4 randomly selected spells vanish in the same way.
Suggested Penalties (3; 10% chance of occurrence whenever either 100 point power is used; equal chances for each):
1. Aging: The user ages 1-6 years; no saving throw applies.
2. Disintegrate: The user must make a Saving Throw vs. Spells or suffer a variation of the normal spell effect, appearing to wither, age extremely rapidly, and crumble to dust. The body may be recovered by a wish, and the user then restored to normal form by applying a raise dead fully.
3. Ability score penalty: The user loses 6-11 (1d6 + 5) points of Strength, to a minimum Strength of 3.
Source: Norse mythology.
Further Research: See standard works, referring to the following names. Verthandi is one of the Norns of Norse legend, the immortal beings who rule the fates of men and gods alike. Verthandi rules the Present, Urdur (or Urdhr, or Urth) the Past, and Skuld, who wears a veil, the Future. Each of the Norns may provide ideas for other artifacts.

WIFE OF ILMARINEN
The legendary Immortal craftsman Ilmarinen once used his great skills to create a companion entirely of gold and silver. However, the result was too cold to even be approached. Appearing as a metallic golem, it was given special powers when freed, and is said to reside in far northern reaches, either alone or with its current master.

Description: The wife appears to be a metal statue of an extremely attractive human female clad in robes. The entire statue is made of a sparkling mixture of gold and silver.
Magnitude: Minor artifact.
Power Limits: 2/A, 1/B, 2/C, 3/D
Sphere: Matter (Fighters, earth)
Suggested Powers (PP 100):
A1 Ice breath 55
A1 Ice storm 45

Activation: The wife is always active.
Use of Powers: The powers of the wife are used by the artifact alone, not granted to the user. The wife can speak any language it hears, and will explain its powers to any who ask, unless ordered not to. However, the artifact cannot be controlled until a special command word is uttered. Once this command is spoken, the wife will obey either mental or verbal commands from the user. The command word can only be obtained from Ilmarinen himself, by using a commune or contact other plane, from a previous user of the artifact, or by a wish.
Suggested Handicap (1): When control is gained, the user becomes aware that the wife cannot recharge itself. It can eat gold or silver. For each 100 gp value of those metals eaten, the artifact recharges 1 PP.
Suggested Penalty (1; 1 in 6 chance of occurrence whenever a power is used): Instead of attacking as directed, the wife aims her attack at the user; normal saving throws apply, but the user gains a +4 bonus for the second and subsequent appearances of this effect.
Other Details: AC -20; hp 100; AT 1 power; D by power; MV 90' (30'); AL N. The wife will not attack by any means other than its powers.
Source: Finnish mythology.
Further Research: See the Finnish national epic poem Kalevala, compiled by Elias Lonnrott in the late 19th century.
TXT

  printf '\n```\n\n' >> "$OUT"
}

master_other_magic_items_block_named() {
  local label="$1"
  local note="$2"
  local pdf="$3"

  printf '### %s\n\n' "$label" >> "$OUT"
  printf -- '- Extraction note: %s\n\n' "$note" >> "$OUT"
  printf '```text\n' >> "$OUT"
  cat >> "$OUT" <<'TXT'
[Master pages 63-64: Other Magic Items appendix]
Other Magic Items
The following legendary magic items are mentioned in history, myths, legends, and literature. You may easily develop them into either artifacts or powerful but standard magic items. Further research is recommended.

Consumables and Sustainers

Ambrosia: This is a potion of Immortality, but with a short duration. Repeated drinks are needed to maintain Immortal status.

Apples of Bragi: In Scandinavian legend, Bragi, son of Odin, had a magically inexhaustible supply of these items. Each can cure weariness, decay of power, ill temper, or failing health.

Elixir: In Arabic legend, this powder was sprinkled on wounds of battle, curing them. Treat as a potion of healing, but applied instead of consumed.

Holy Grail: This vessel of literary fame was the cup at the Last Supper, carried to England by Joseph of Arimathea. It was said to provide food, drink, and spiritual sustenance for the life of the custodian. This term may have originally been used in reference to the platter of the Paschal lamb, again at the Last Supper.

Travel, Motion, and Conveyance

Arrow of Abaris: Abaris the Hyperborean, a Greek sage in the 6th century BC, once received a magic arrow from the god Apollo. The arrow enabled him to become invisible, cure disease, fly by riding the arrow as if it were a broom, and divine the future.

Bag of Aeolus: In Homer's Odyssey, this bag, named for the god of winds, contains a divine essence. When opened, it blows Odysseus' ship back to its starting point.

Carpet, Solomon's Magic: This item, made of green silk, was legended to have carried not only Solomon and his great throne but also all of his army.

Horse, flying: Clavileno, an enchanted wooden rocking horse described in Cervantes' Don Quixote, could fly and carry an armed rider. It was guided by a pin in its forehead.

Prophecy, Memory, and Fortune Items

Books, Sibylline: These were written prophecies, carefully preserved in ancient Rome and occasionally consulted on matters of great import. There were nine scrolls at first, offered for sale to Rome by the seeress Almathaea. The Romans refused her price, so she burned three and offered the rest again at the same price. After another refusal, she burned three more and sold the remaining three at the original price. They were preserved in a stone chest, with two custodians at first and later 10 and then 15. Finally placed in gilt cases at the base of the statue of Apollo on Palatine Hill, they were burned in the great fire of Nero's fame.

Necklace of Harmonia: Harmonia, daughter of the Greek gods Ares and Aphrodite, was given a magical necklace when she married Cadmus. Though relatively unremarkable at the time, the necklace brought disaster to all subsequent owners.

Odrovir: In Norse legend, a great war took place between the Aesir, the 24 gods of heaven, Asgard, and the Vanir, the nature gods of Noatun. At its peaceful conclusion both sides spat into a jar, providing their mixed essences as hostage to peace. Kvasir, the wisest of all men, was made of the spittle. His blood, mixed with honey, was called Odrovir, or Odhrevir; all who partook of it became poets.

Ring of Amasis: Amasis, King of Egypt, advised his incredibly lucky friend Polycrates, King of Samos, to discard something of great value to balance the Fates. Polycrates threw a prized ring into the sea, but it was later found in a fish on the king's dinner table. Amasis promptly recognized this sign from the gods and broke off relations with his friend; shortly thereafter, Polycrates was brutally slain.

Ring of the Nibelungen: Made famous by Richard Wagner's 1876 opera, this item comes from several Scandinavian legends, including the Volsunga Saga, Nibelungenlied, Elder and Younger Eddas, and the Eckelied. The ring was part of an entire hoard in the Rhine river, guarded by the Rhine Maidens until Alberich gained it by foreswearing love. The greedy dwarf cursed the item, and when the ring was later taken by gods and heroes for various uses, it brought doom to all, resulting even in the destruction of Asgard and the gods.

Productive and Hoard Items

Mill: A magic mill in the Finnish Kalevala, called the Sampo, could grind out meal, salt, or gold from straw on command.

Draupnir: In Scandinavian legend, the famed magic ring made by Odin for the dwarves. Every nine nights it produced eight non-magical rings equal in size and beauty to itself, and is thus a fertility symbol.

Named Sword Corpus

Swords: Many magical swords can be found in myth and literature. The following list is only a sampling; further research is recommended to ascertain appropriate powers.
Angurvadal, Stream of Anguish, was owned by the hero of Frithiofs Saga, a 13th century Scandinavian work.
Arondight, sword of Launcelot of the Lake, was mentioned in several Arthurian legends.
Balisarda, a sword of slicing, was made by the witch Falerina in the 1487 romance epic Orlando Innamorato, Roland in Love, by Matteo Maria Boiardo.
Balmung was the sword of Siegfried in Scandinavian legend. It was made by Wieland, a Germanic name for the immortal blacksmith Volund, known as Wayland Smith to the English.
Colada was the sword of the Spanish hero El Cid, first described in a poem of an unknown Castilian bard in 1140. The hero was Ruy Diaz de Bivar, 1043-1099, also called el Campeador, the Champion.
Courtain, the Short Sword, was used by Ogier the Dane, a Paladin of Charlemagne and the folk hero of Denmark. The smith Munifican took three years to make Courtain.
Durandan, also Durandal, Durandana, or the Inflexible, was the sword of Roland, given him by Charlemagne. It once belonged to Hector, the noble chieftain of Homer's Iliad, and Roland, also called Orlando, is the hero of several literary works including the Chanson de Roland and later Italian romances.
Excalibur, or Escalibor in the Old French, was the fabled sword of King Arthur. It was also referred to as Caliburn by Geoffrey of Monmouth and Caledvwlch in the Mabinogion, or Caladbolg in Irish legend, meaning hard belly. The name is linked to the Latin ex calce liberare, to liberate from the stone.
Flarnberge, or Floberge, meaning Flame Cutter, was a sword of Charlemagne.
Glorius, sword of the hero Oliver, broke nine swords made by the famed smiths Ansias, Galas, and Munifican.
Gram, German for grief, was another famous sword of Siegfried.
Joyeuse, French for joyous, was a greatsword of Charlemagne and took three years to make, by the smith Gallas.
Mimung, sword of the hero Wittich, was loaned to Siegfried for a time.
Morglay, Big Glaive, was the sword of Sir Bevis of English lore. Morglay was then a common generic term for sword.
Nagelring, Nail-Ring, was the sword of Dietrich of Bern, a hero in the Germanic Heldenbuch and Nibelungenlied.
Philippan was the sword of Mark Antony, a member of the Second Triumvirate of Rome, 43 BC.
Sauvagine was another of Ogier's swords, also made by Munifican.
TXT

  printf '\n```\n\n' >> "$OUT"
}

extract_pdf "$MASTER_PDF" "$MASTER_TXT"
OUT="$MASTER_OUT"
write_header 'TODO: BECMI Spell Material Staging - Master' 'TSR 1021 - Set 4 Master Rules.pdf'
master_spell_block_named 'Master Cleric, Druid, and Magic-User Spell Material' 'section-aware Master spell extraction using anchored TSV reflow across the actual cleric, druid, and magic-user pages instead of one broad line-range block. The section is split into cleric, druid, and magic-user sub-blocks so high-level spell lists and descriptions remain attached to the right class pages.' "$MASTER_PDF"
master_nonhuman_block_named 'Non-Human Spellcasters and Special Spellcaster Procedures' 'section-aware Master extraction using anchored TSV reflow across the actual Spell Casters (Non-Human), special monster spellcaster, undead spellcaster, and undead-control pages instead of the earlier broad procedures slice.' "$MASTER_PDF"
master_procedures_block_named 'Anti-Magic Effects and Dispel Magic Procedures' 'targeted Master procedures extraction using column crops from the actual Procedures pages so the anti-magic doctrine, examples, touch-dispel rules, and item-interaction notes remain readable without the section index or dominion spill.' "$MASTER_PDF"
master_artifact_chapter_context_named 'Artifact Chapter Context and Witnesses' 'Master-specific continuous artifact chapter extraction spanning pages 45-64 so doctrine, power tables, explanations, named artifacts, and the post-catalog appendix remain in one staged run for downstream witness use and manual review.' 
cleanup_output
perl -0pi -e '
  s/^\x27[[:space:]]*\n//mg;
  s/\(B41, X11 \)/\(B41, X11\)/g;
  s/\bpowcr\b/power/g;
  s/effectand/effect and/g;
  s/area o f/area of/g;
  s/^ Save/Save/mg;
  s/Cure Light Wounds[^\n]*\(B26, X5\)/Cure Light Wounds* \(B26, X5\)/g;
  s/Teleport any Object \(EF 1 cr\/obj\/lO\x27/Teleport any Object \(EF 1 cr\/obj\/10\x27/g;
  s/Resist Fire \(DR 6T, EF \+ 2ST, -1ldie D;/Resist Fire \(DR 6T, EF \+ 2ST, -1\/die D;/g;
  s/Mindmask\x27\(R Touch/Mindmask \(R Touch/g;
  s/WaterBreathing\(R30\x27/Water Breathing \(R 30\x27/g;
  s/Protection from Evil IO\x27 Radius/Protection from Evil 10\x27 Radius/g;
  s/Invisibility lO\x27radius\(R 120\x27; X12\)/Invisibility 10\x27 radius \(R 120\x27; X12\)/g;
  s/skel\netons/skeletons/g;
  s/DM Com-\npanion/DM Companion/g;
  s/Intelligence sec\ntion/Intelligence section/g;
  s/freewilled/free-willed/g;
  s/If the Turn succeeds, the control link is broken, but\nthere is no other effect\./If the Turn succeeds, the control link is broken, but there is no other effect./g;
  s/this case, the new undead creature has all the\nhit points of the original living victim \(not\n\nof these created undead may thus vary widely/this case, the new undead creature has all the\nhit points of the original living victim \(not one-half\), and has the same Hit Dice as well. Its Armor Class and movement rate change to match the new undead form. Such details of these created undead may thus vary widely/g;
  s/arti-\nfact/artifact/g;
  s/abili-\nties/abilities/g;
  s/sens-\ning/sensing/g;
  s/perma-\nnently/permanently/g;
  s/spe-\ncial/special/g;
  s/dis-\ncovered/discovered/g;
  s/pur-\npose/purpose/g;
  s/activa-\ntion/activation/g;
  s/sum-\nmons/summons/g;
  s/ad-\nverse/adverse/g;
  s/pregen-\nerated/pregenerated/g;
  s/generat-\ning/generating/g;
  s/Proce-\ndures/Procedures/g;
  s/cre-\nating/creating/g;
  s/sam-\nple/sample/g;
  s/abbrevi-\nations/abbreviations/g;
  s/dura-\ntion/duration/g;
  s/indes-\ntructable/indestructable/g;
  s/possi-\nble/possible/g;
  s/charac-\nter/character/g;
  s/catas-\ntrophe/catastrophe/g;
  s/\[Master artifact pages 48-54: power tables and artifact effect descriptions\]\nArtifacts\n/\[Master artifact pages 48-54: power tables and artifact effect descriptions\]\n/g;
  s/\bA l \./A1./g;
  s/20 L i g h \(R 120\x27, DR46T, EF 30\x27 dia;/20 Light* \(R 120\x27, DR 46T, EF 30\x27 dia;/g;
  s/Silence15\x27radius/Silence 15\x27 radius/g;
  s/DispelMagic/Dispel Magic/g;
  s/Polymorph Other\(R/Polymorph Other \(R/g;
  s/Appear\+/Appear*/g;
  s/Spell damage bonus,-\+ 4\/die/Spell damage bonus, + 4\/die/g;
  s/Spdll damige bonus,-\+ 4\/die/Spell damage bonus, + 4\/die/g;
  s/\bR l\x27/R 1\x27/g;
  s/\bR lT\b/R 1T/g;
  s/\bR lo\x27/R 10\x27/g;
  s/\bgo\x27/90\x27/g;
  s/Locate Object\(DR/Locate Object \(DR/g;
  s/Truesight \(DR 5T, EF 120\x27; \x27212\)/Truesight \(DR 5T, EF 120\x27; C12\)/g;
  s/Find the Path \(DR 46T; XU\)/Find the Path \(DR 46T; X9\)/g;
  s/Teleport any Object \(EF 1 cr\/obj\/10\x27\n      cube or seif safe/Teleport any Object \(EF 1 cr\/obj\/10\x27\n      cube or self safe/g;
  s/DR46T/DR 46T/g;
  s/EF30\x27 dia/EF 30\x27 dia/g;
  s/20 L i g h \(R 120\x27, DR 46T, EF 30\x27 dia;\n\s*B40\)/20 Light* \(R 120\x27, DR 46T, EF 30\x27 dia; B40\)/g;
  s/\n\s*20 L i g h \(R 120\x27, DR 46T, EF 30\x27 dia;\n\s*B40\)/\n  20 Light* \(R 120\x27, DR 46T, EF 30\x27 dia; B40\)/g;
  s/\n\s*20 L i g h \(R 120\x27, DR 46T, EF 30\x27 dia;\n/\n  20 Light* \(R 120\x27, DR 46T, EF 30\x27 dia;\n/g;
  s/Silence 15\x27 radius\(R/Silence 15\x27 radius \(R/g;
  s/Dispel Magic\(R/Dispel Magic \(R/g;
  s/\bEF l0\x27cube/EF 10\x27 cube/g;
  s/\bDR lr\b/DR 1r/g;
  s/\+ id6/\+ 1d6/g;
  s/\+ l\/die/\+ 1\/die/g;
  s/WizardEye\(R 240\x27, DR 6I\x27, MV 120\x27; X14\)/Wizard Eye \(R 240\x27, DR 6T, MV 120\x27; X14\)/g;
  s/HoldAnimal\(R/Hold Animal \(R/g;
  s/Charm Monster\(R/Charm Monster \(R/g;
  s/Turn Wood\(R/Turn Wood \(R/g;
  s/Predict Weather\(DR/Predict Weather \(DR/g;
  s/Clairvoyance\(R/Clairvoyance \(R/g;
  s/ESP\(R/ESP \(R/g;
  s/Detect Danger \(R 200 \x27/Detect Danger \(R 200\x27/g;
  s/\x27Find Traps/Find Traps/g;
  s/DR ZOT/DR 20T/g;
  s/4\n      c1\n       \./4\n      cr/g;
  s/Hold Person \(R 120 I ,/Hold Person \(R 120\x27,/g;
  s/Finger o f D e a t h \* \( R60\x27;X9, C12\)/Finger of Death* \(R 60\x27; X9, C12\)/g;
  s/D R /DR /g;
  s/R 240 \x27 /R 240\x27 /g;
  s/Appear\* \(R 240\x27, DR lT, EF 20\x27cube;/Appear* \(R 240\x27, DR 1T, EF 20\x27 cube;/g;
  s/Striking \(R 30\x27, DR lT, EF \+ ld6 D;/Striking \(R 30\x27, DR 1T, EF \+ 1d6 D;/g;
  s/WizardEye\(R 240\x27, DR 6I\x27, MV 120\x27;/Wizard Eye \(R 240\x27, DR 6T, MV 120\x27;/g;
  s/Power WordBlind/Power Word Blind/g;
  s/Bless\(R60\x27,DR6T,EF20\x27sq,/Bless \(R 60\x27, DR 6T, EF 20\x27 sq,/g;
  s/Charm Monster \(R 120\x27, EF 18 at 3 HD\n\s*or 1 at 3 \+ HD; X13\)/Charm Monster \(R 120\x27, EF 1 at 3 HD or 1 at 3\+ HD; X13\)/g;
  s/90 Anti-Magic Ray \(DR lT, EF 100%\)/90 Anti-Magic Ray \(DR 1T, EF 100%\)/g;
  s/55 Mapmaking \(DR lT, EF Sense 60\x27/55 Mapmaking \(DR 1T, EF Sense 60\x27/g;
  s/45 Cloudkill \(R l \x27 , DR 6T, EF 1 pth,/45 Cloudkill \(R 1\x27, DR 6T, EF 1 pth,/g;
  s/75 Explosive Cloud \(R l \x27 , DR 6T,EF/75 Explosive Cloud \(R 1\x27, DR 6T, EF/g;
  s/Disintegrate \(R 60\x27,EF/Disintegrate \(R 60\x27, EF/g;
  s/90 Obliterate\* \(R 60\x27,EF/90 Obliterate* \(R 60\x27, EF/g;
  s/12 H D S T at -4, 12 \+ H D 6d10/12 HD ST at -4, 12\+ HD 6d10/g;
  s/\n\s*85 Control Giants \(DR 20T, EF one type, 4\n\s*c1\n\s*\.\s*\n/\n   85 Control Giants \(DR 20T, EF one type, 4 cr\)\n/g;
  s/Power Word Blind\(R 120\x27, DR up to 40/Power Word Blind \(R 120\x27, DR up to 40/g;
  s/Speak with Plants\(R 30\x27/Speak with Plants \(R 30\x27/g;
  s/70 Life Drain\x27 \(R Touch; EF Drains 1\n\s*level; C13\)/70 Life Drain* \(R Touch; EF drains 1 level; C13\)/g;
  s/20hplr/20 hp\/r/g;
  s/20 Light\* \(R 120\x27, DR 46T, EF 30\x27 dia;\n\s*B40\)/20 Light* \(R 120\x27, DR 46T, EF 30\x27 dia; B40\)/g;
  s/15 Sleep \(R 240\x27, DR 20 T,/15 Sleep \(R 240\x27, DR 20T,/g;
  s/20T; X61/20T; X16/g;
  s/80 Open Mind\x27 \(R Touch, EF -8ST; C24\)/80 Open Mind* \(R Touch, EF -8 ST; C24\)/g;
  s/85 Control Giants \(DR 20T, EF one type, 4\n\s*c1\n\s*\.\s*\n/85 Control Giants \(DR 20T, EF one type, 4 cr\)\n/g;
  s/45 Cloudkill \(R 1\x27, DR 6T, EF 1 pth,\n\s*5HD or less Save vs\. Poison, 30\x27 x\n\s*20\x27; X14\)/45 Cloudkill \(R 1\x27, DR 6T, EF 1 pth, 5 HD or less Save vs. Poison, 30\x27 x 20\x27; X14\)/g;
  s/55 Dispel Magic \(R 120\x27, EF 20\x27cube; X8\)/55 Dispel Magic \(R 120\x27, EF 20\x27 cube; X8\)/g;
  s/60 Appear\* \(R 240\x27, DR 1T, EF 20\x27 cube;\n\s*C22\)/60 Appear* \(R 240\x27, DR 1T, EF 20\x27 cube; C22\)/g;
  s/45 Speak with the Dead \(R 30\x27, EF 3 ques-\n\s*tions; X7\)/45 Speak with the Dead \(R 30\x27, EF 3 questions; X7\)/g;
  s/80 Open Mind\* \(R Touch, EF -8 ST; C24\)/80 Open Mind* \(R Touch, EF -8 ST; C24\)/g;
  s/100 Life Trapping\n\s*100 Maze/100 Life Trapping\n  100 Maze/g;
  s/80 Find the Path \(DR 46T; X9\)/80 Find the Path \(DR 46T; X9\)/g;
  s/lOT/10T/g;
  s/AnimateDead\(R60\x27, EF40 HD; X14\)/Animate Dead \(R 60\x27, EF 40 HD; X14\)/g;
  s/Sword\(R 30\x27, DR 40r, EF as 2-Handed,\n\s*2 atWr; C24\)/Sword \(R 30\x27, DR 40r, EF as 2-Handed, 2 at\/r; C24\)/g;
  s/CreateAnyMonster\(R 90\x27, DR 4T, EF/Create Any Monster \(R 90\x27, DR 4T, EF/g;
  s/Pass-U\x27all/Pass-Wall/g;
  s/DR 6 T C21/DR 6T; C21/g;
  s/C 4/C24/g;
  s/C 15/C15/g;
  s/C 16/C16/g;
  s/EF 50 degrees; C15\)/EF 50 degrees; C15\)/g;
  s/20 Light\* \(R 120\x27, DR 46T, EF 30\x27 dia;\n\s*B40\)\s+B\. Information & Movement/20 Light* \(R 120\x27, DR 46T, EF 30\x27 dia; B40\)\n\nB. Information & Movement/g;
  s/25 Speak with the Dead \(R 30\x27, EF 3 ques-\n\s*tions; X7\)/25 Speak with the Dead \(R 30\x27, EF 3 questions; X7\)/g;
  s/85 Control Giants \(DR 20T, EF one type, 4\n\s*c1\n\s*\.\s*95 Turn Undead/85 Control Giants \(DR 20T, EF one type, 4 cr\)\n   95 Turn Undead/g;
  s/60 Appear\* \(R 240\x27, DR 1T, EF 20\x27 cube;\n\s*C22\)\s+30 Speak with Plants/60 Appear* \(R 240\x27, DR 1T, EF 20\x27 cube; C22\)\n   30 Speak with Plants/g;
  s/20 Infravision \(R Touch, DR 1 day, EF see\n\s*60\x27; X12\)/20 Infravision \(R Touch, DR 1 day, EF see 60\x27; X12\)/g;
  s/70 Tracking \(DR 6 hours, EF 90% any-\n\s*where\)/70 Tracking \(DR 6 hours, EF 90% anywhere\)/g;
  s/10 Bless \(R 60\x27, DR 6T, EF 20\x27 sq, \+ 1ML\/\n\s*Hit\/Dmg; X5\)/10 Bless \(R 60\x27, DR 6T, EF 20\x27 sq, \+1 ML\/Hit\/Dmg; X5\)/g;
  s/30 Striking \(R 30\x27, DR 1T, EF \+ 1d6 D;\n\s*X7\)/30 Striking \(R 30\x27, DR 1T, EF \+1d6 D; X7\)/g;
  s/60 Turn Undead bonus \+ 6 to roll, \+3d6\n\s*HD \(DR 1T\)/60 Turn Undead bonus \+6 to roll, \+3d6 HD \(DR 1T\)/g;
  s/\n\s*Artifacts\n\nB3\. Aids to Movement/\n\nB3. Aids to Movement/g;
  s/70 Sword\(R 30\x27, DR 40r, EF as 2-Handed,\n\s*2 atWr; C24\)/70 Sword \(R 30\x27, DR 40r, EF as 2-Handed, 2 at\/r; C24\)/g;
  s/\n\s*80 Clone \(R 10\x27; M6\)\n\s*C24/\n   80 Clone \(R 10\x27; M6\)\n/g;
  s/cube or seif safe/cube or self safe/g;
  s/Travel\(DR/Travel \(DR/g;
  s/Plant Door\(DR/Plant Door \(DR/g;
  s/Teleport any Object \(EF 1 cr\/obj\/10\x27\n\s*cube or self safe, -2 save other; C24\)/Teleport any Object \(EF 1 cr\/obj\/10\x27 cube or self safe, -2 save other; C24\)/g;
  s/25 Speak with the Dead \(R 30\x27, EF 3 ques-\n\s*tions; X7\)\s+60 Control Animals/25 Speak with the Dead \(R 30\x27, EF 3 questions; X7\)\n   60 Control Animals/g;
  s/85 Control Giants \(DR 20T, EF one type, 4\n\s*c1\n\s*\.\s*\)\s+95 Turn Undead/85 Control Giants \(DR 20T, EF one type, 4 cr\)\n   95 Turn Undead/g;
  s/20 Infravision \(R Touch, DR 1 day, EF see\n\s*60\x27; X12\)\s+45 Charm Plant/20 Infravision \(R Touch, DR 1 day, EF see 60\x27; X12\)\n   45 Charm Plant/g;
  s/60 Appear\* \(R 240\x27, DR 1T, EF 20\x27 cube;\n\s*C22\)\s+30 Speak with Plants/60 Appear* \(R 240\x27, DR 1T, EF 20\x27 cube; C22\)\n   30 Speak with Plants/g;
  s/70 Tracking \(DR 6 hours, EF 90% any-\n\s*where\)\s+95 Control Dragons/70 Tracking \(DR 6 hours, EF 90% anywhere\)\n   95 Control Dragons/g;
  s/10 Bless \(R 60\x27, DR 6T, EF 20\x27 sq, \+ 1ML\/\n\s*Hit\/Dmg; X5\)\s+B2\. Additional Senses/10 Bless \(R 60\x27, DR 6T, EF 20\x27 sq, \+1 ML\/Hit\/Dmg; X5\)\nB2. Additional Senses/g;
  s/30 Striking \(R 30\x27, DR 1T, EF \+ 1d6 D;\n\s*X7\)\s+25 ESP/30 Striking \(R 30\x27, DR 1T, EF \+1d6 D; X7\)\n   25 ESP/g;
  s/60 Turn Undead bonus \+ 6 to roll, \+3d6\n\s*HD \(DR 1T\)\s+100 Life Trapping/60 Turn Undead bonus \+6 to roll, \+3d6 HD \(DR 1T\)\n  100 Life Trapping/g;
  s/70 Sword\(R 30\x27, DR 40r, EF as 2-Handed,\n\s*2 atWr; C24\)\s+25 Dimension Door/70 Sword \(R 30\x27, DR 40r, EF as 2-Handed, 2 at\/r; C24\)\n   25 Dimension Door/g;
  s/80 Clone \(R 10\x27; M6\)\s+30 Haste/80 Clone \(R 10\x27; M6\)\n   30 Haste/g;
  s/80 Travel \(DR 40T, MV 360\x27\/720\x27 gaseous;/80 Travel \(DR 40T, MV 360\x27\/720\x27 gaseous; M8\)/g;
  s/20 Cure Disease \(R 30 \x27 ; X6\)/20 Cure Disease \(R 30\x27; X6\)/g;
  s/35 Cure Wounds, Critical\(EF 21 hp; C12\)/35 Cure Wounds, Critical \(EF 21 hp; C12\)/g;
  s/B4\. A\.ids to offset Encumbrance/B4. Aids to Offset Encumbrance/g;
  s/10    FloatingDisc\(DR 6T, EF 5,000 cn; B39\)/10    Floating Disc \(DR 6T, EF 5,000 cn; B39\)/g;
  s/15    Bouyancy/15    Buoyancy/g;
  s/30    Container\./30    Container,/g;
  s/^\s*0 2 \. /D2. /mg;
  s/^\s*0 3 \. /D3. /mg;
  s/^\s*0 4 \. /D4. /mg;
  s/^\s*0 5 \. /D5. /mg;
  s/Mindmask[’\x27]\(R Touch/Mindmask \(R Touch/g;
  s/WaterBreathing\(R ?30[’\x27]/Water Breathing \(R 30\x27/g;
  s/Invisibility lO[’\x27]radius\(R 120[’\x27]; X12\)/Invisibility 10\x27 radius \(R 120\x27; X12\)/g;
  s/Ventriloquism \(R go\x27/Ventriloquism \(R 90\x27/g;
  s/MassInvisibility/Mass Invisibility/g;
  s/MirrorImage/Mirror Image/g;
  s/PhantasmalForce/Phantasmal Force/g;
  s/Wall ofFire/Wall of Fire/g;
  s/WallofIron/Wall of Iron/g;
  s/AnimateDead\(R60\x27/Animate Dead \(R 60\x27/g;
  s/CreateAnyMonster\(R 90\x27/Create Any Monster \(R 90\x27/g;
  s/Pass-U\x27all/Pass-Wall/g;
  s/Pass-Wall\(R/Pass-Wall \(R/g;
  s/Plant Door\(DR/Plant Door \(DR/g;
  s/Travel\(DR/Travel \(DR/g;
  s/FloatingDisc/Floating Disc/g;
  s/Bouyancy/Buoyancy/g;
  s/B4\. A\.ids to offset Encumbrance/B4. Aids to Offset Encumbrance/g;
  s/Container\. to/Container, to/g;
  s/Control Giants \(DR 20T, EF one type, 4\n\s*cr\n\s*90/Control Giants \(DR 20T, EF one type, 4 cr\)\n   90/g;
  s/Polymorph Any Object \(R 240\x27, DR 40-\n\s*240T/Polymorph Any Object \(R 240\x27, DR 40-240T/g;
  s/75 Create normal objects \(EF up to 1,000\n\s*C ?4/75 Create normal objects \(EF up to 1,000 cn; C24\)/g;
  s/50 Immune to Aging attacks \(R Touch, DR\n\s*18\b/50 Immune to Aging attacks \(R Touch, DR 18T\)/g;
  s/20 Cure Disease \(R 30 ?\x27 ?; X6\)/20 Cure Disease \(R 30\x27; X6\)/g;
  s/Cure Wounds, Critical\(EF/Cure Wounds, Critical \(EF/g;
  s/Stone to Flesh \(R 120\x27, EF l0\x27cube/Stone to Flesh \(R 120\x27, EF 10\x27 cube/g;
  s/Reverse Gravity \(R 90\x27, EF 30\x27cube;/Reverse Gravity \(R 90\x27, EF 30\x27 cube;/g;
  s/20\x27cube:/20\x27 cube:/g;
  s/Raise Dead FulJy/Raise Dead Fully/g;
  s/^\s*I\s+,\s*$\n//mg;
  s/^\s*\(R Touch;\s*$\n//mg;
  s/Anti-Animal SheJJ/Anti-Animal Shell/g;
  s/\bCl6\b/C16/g;
  s/telepathicallly/telepathically/g;
  s/M8\) M8\)/M8\)/g;
  s/coinsider/consider/g;
  s/revealr3/reveals/g;
  s/fu ture/future/g;
  s/ofcreatures/of creatures/g;
  s/&he/the/g;
  s/ConfuseAlignment\*/Confuse Alignment*/g;
  s/Confuse Alignment\*\(/Confuse Alignment* \(/g;
  s/\b400fsq\/40\x27high\b/400 sq.ft.\/40\x27 high/g;
  s/Phantasmal Force \(R 240\x27, EF 40\x27cube;/Phantasmal Force \(R 240\x27, EF 40\x27 cube;/g;
  s/\b40\x27cube\b/40\x27 cube/g;
  s/DR 12T X12/DR 12T; X12/g;
  s/Anti-Animal Shell \(DR 40T C16\)/Anti-Animal Shell \(DR 40T; C16\)/g;
  s/10\x27radius/10\x27 radius/g;
  s/\bt h e\b/the/g;
  s/to l turn/to 1 turn/g;
  s/See "Thief Ability\s*\.\.\s*\n\s*3,/See "Thief Ability"/g;
  s/at up to 112 normal rate/at up to 1\/2 normal rate/g;
  s/Animals: U p to/Animals: Up to/g;
  s/D M /DM /g;
  s/60 Container, to 30,000 cn \(DR 6 hours\)\x27/60 Container, to 30,000 cn \(DR 6 hours\)/g;
  s/75 Create normal objects \(EF up to 1,000\n\s*C24/75 Create normal objects \(EF up to 1,000 cn; C24\)/g;
  s/50 Immune to Aging attacks \(R Touch, DR\n\s*55 Anti-Magic 30%/50 Immune to Aging attacks \(R Touch, DR 18T\)\n  55 Anti-Magic 30%/g;
  s/\n\s*I\s+,\s*\n/\n/g;
  s/\n\s*\(R Touch;\s*\n/\n/g;
  s/Mass Invisibility\(R/Mass Invisibility \(R/g;
  s/Wall of Iron\(R/Wall of Iron \(R/g;
  s/Create Any Monster \(R 90\x27, DR 4T, EF\n\s*40 HD; M8\)/Create Any Monster \(R 90\x27, DR 4T, EF 40 HD; M8\)/g;
  s/Wall of Fire\(R/Wall of Fire \(R/g;
  s/DRConc\./DR Conc./g;
  s/EF500sq\. ft\.;C21/EF 500 sq.ft.; C21/g;
  s/up to 15HD/up to 15 HD/g;
  s/RDR 6T/R DR 6T/g;
  s/Growth ofAn;ma\]/Growth of Animal/g;
  s/Mirror Image\(DR/Mirror Image \(DR/g;
  s/Phantasmal Force\(R/Phantasmal Force \(R/g;
  s/Wall of Iron \(R120\x27/Wall of Iron \(R 120\x27/g;
  s/EF \+ 6 SAve/EF \+6 Save/g;
  s/years dead; C 13\)/years dead; C13\)/g;
  s/EF 3hP\x27r for IT/EF 3 hp\/r for 1T/g;
  s/\bDR lT\b/DR 1T/g;
  s/\b([0-9]+)\x27sq\b/$1\x27 sq/g;
  s/\b60\x27sq, 300\n\s*man-size/60\x27 sq, 300 man-size/g;
  s/Massmorph \(R 240\x27, EF 100 mansize;/Massmorph \(R 240\x27, EF 100 man-size;/g;
  s/EF \+ 2ST/EF \+2 ST/g;
  s/\bL1 -3\b/L1-3/g;
  s/\bL4,L5\b/L4, L5/g;
  s/EF 5000\n\s*sq\.ft\.; M8/EF 5,000 sq.ft.; M8/g;
  s/x 9 , C12/X9, C12/g;
  s/Hit points bonus \+ 1 per Hit Die \(DR\n\s*IT\)/Hit points bonus \+ 1 per Hit Die \(DR 1T\)/g;
  s/Hit points bonus \+ 3 per Hit Die \(DR\n\s*IT\)/Hit points bonus \+ 3 per Hit Die \(DR 1T\)/g;
  s/40\x27\/4000cn/40\x27\/4,000 cn/g;
  s/automatic Destroy, 366 Hit Dice/automatic Destroy, 3d6 Hit Dice/g;
  s/\nSpells by Spell Level\nA human or demi-human clone is rare/\nA human or demi-human clone is rare/g;
  s/\brate of 360 feet \(1 20 feet\)\./rate of 360 feet \(120 feet\)./g;
  s/\bUnliie\b/Unlike/g;
  s/Note thatheat damage dis-/Note that heat damage dis-/g;
  s/\bsirnulacrum\b/simulacrum/g;
  s/\bthathe\b/that he/g;
  s/\bish at the end of the spell duration\./vanish at the end of the spell duration./g;
  s/creatures of '\'' \/ z Hit Die or less are counted as '\'' \/ z Hit Die each\./creatures of 1\/2 Hit Die or less are counted as 1\/2 Hit Die each./g;
  s/Creatures of 1-1 Hit Die are counted as 1 Hit Die; creatures of '\'' \/ z Hit Die or less are counted as '\'' \/ z Hit Die/Creatures of 1-1 Hit Die are counted as 1 Hit Die; creatures of 1\/2 Hit Die or less are counted as 1\/2 Hit Die/g;
  s/Creatures of 1-1 Hit\nDie are counted as 1 Hit Die; creatures of '\'' \/ z\nHit Die or less are counted as '\'' \/ z Hit Die\neach\./Creatures of 1-1 Hit Die are counted as 1 Hit Die; creatures of 1\/2 Hit Die or less are counted as 1\/2 Hit Die each./g;
  # --- MU9 pages 11-12: page header injections ---
  s/^Characters - Magic-User\s*\n//mg;
  s/^Spells by Spell Level\s*\n//mg;
  # --- MU9 pages 11-12: OCR letter substitutions ---
  s/\bmaqic\b/magic/g;
  s/\bFlane\b/Plane/g;
  s/\x27\/e\s*inch/1\/8 inch/g;
  # --- MU9 pages 11-12: spacing artifacts ---
  s/\bX P\b/XP/g;
  s/\bD M\b/DM/g;
  s/\+ ([0-9])/+$1/g;
  s/([0-9]) , ([0-9])/$1, $2/g;
  s/([0-9]+(?:th|st|nd|rd))- (?=level)/$1-/g;
  s/DM ,/DM,/g;
  s/^" ([A-Z])/"\1/mg;
  s/eyes-without eyelids-/eyes\xe2\x80\x94without eyelids\xe2\x80\x94/g;
  # --- MU9 pages 11-12: artifact table OCR ---
  s/\bfro\b/for/g;
  s/to - ([0-9])/to -$1/g;
' "$MASTER_OUT"
master_cleanup_postbuild
master_dedupe_top_sections

master_spell_lists_appendix() {
  local pdf="$1"

  printf '\n## Spell Lists Appendix\n\n' >> "$MASTER_OUT"
  printf -- '- Note: these are raw numbered spell lists from the Master Set (with cross-references to the Companion Set). They are appendix-only \x2014 the per-spell description extraction above is the authoritative witness source. Multi.py strips this section before scanning for spell witnesses.\n\n' >> "$MASTER_OUT"

  printf '### Master: Cleric Spell Lists (pages 5-6)\n\n' >> "$MASTER_OUT"
  printf -- '- Extraction note: TSV column reflow of Master cleric spell list pages (7th-level cleric spells with Companion cross-references).\n\n' >> "$MASTER_OUT"
  printf '```text\n' >> "$MASTER_OUT"
  render_tsv_cols_pages "$pdf" 5 6 '185,370' \
    | awk '
        started {
          if (/^Druid$/) exit
          print
          next
        }
        /SEVENTH-LEVEL CLERIC SPELLS|Seventh.Level Cleric/ { started = 1; print }
      ' \
    | spell_list_smart_filter >> "$MASTER_OUT"
  printf '\n```\n\n' >> "$MASTER_OUT"

  printf '### Master: Druid Spell Lists (pages 6-7)\n\n' >> "$MASTER_OUT"
  printf -- '- Extraction note: TSV column reflow of Master druid spell list pages (with Companion cross-references).\n\n' >> "$MASTER_OUT"
  printf '```text\n' >> "$MASTER_OUT"
  render_tsv_cols_pages "$pdf" 6 7 '185,370' \
    | awk '
        started {
          if (/^Magic-user$/) exit
          print
          next
        }
        /^Druid$/ { started = 1; print }
      ' \
    | spell_list_smart_filter >> "$MASTER_OUT"
  printf '\n```\n\n' >> "$MASTER_OUT"

  printf '### Master: Magic-User Spell Lists (pages 8-12)\n\n' >> "$MASTER_OUT"
  printf -- '- Extraction note: TSV column reflow of Master magic-user 8th-9th level spell lists (with Companion cross-references).\n\n' >> "$MASTER_OUT"
  printf '```text\n' >> "$MASTER_OUT"
  render_tsv_cols_pages "$pdf" 8 12 '185,370' \
    | awk '
        started {
          if (/^Weapon Mastery$/) exit
          print
          next
        }
        /EIGHTH-LEVEL MAGIC-USER SPELLS/ { started = 1; print }
      ' \
    | spell_list_smart_filter >> "$MASTER_OUT"
  printf '\n```\n\n' >> "$MASTER_OUT"
}

master_spell_lists_appendix "$MASTER_PDF"
