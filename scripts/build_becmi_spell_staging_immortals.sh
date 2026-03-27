#!/usr/bin/env bash
set -euo pipefail

ROOT='/home/joshu/Synthetic-Dream-Machine'
SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)

BECMI_STAGING_HELPERS_ONLY=1 source "$SCRIPT_DIR/build_becmi_spell_staging.sh"

TMPDIR=$(mktemp -d)
trap 'rm -rf "$TMPDIR"' EXIT

IMM_TXT="$TMPDIR/immortals.txt"
IMM_PDF="$ROOT/_becmi/TSR 1017 - Set 5 Immortals Rules.pdf"
IMM_OUT="$ROOT/_todo/TODO_BECMI_Spell_Material_Staging_Immortals.md"

crop_layout() {
  local page="$1"
  local x="$2"
  local y="$3"
  local w="$4"
  local h="$5"
  pdftotext -layout -nodiag -nopgbrk -f "$page" -l "$page" -x "$x" -y "$y" -W "$w" -H "$h" "$IMM_PDF" - 2>/dev/null
}

begin_block_named() {
  local label="$1"
  local note="$2"

  printf '### %s\n\n' "$label" >> "$OUT"
  printf -- '- Extraction note: %s\n\n' "$note" >> "$OUT"
  printf '```text\n' >> "$OUT"
}

end_block() {
  printf '\n```\n\n' >> "$OUT"
}

immortals_sections_1_2_block() {
  begin_block_named \
    'Sections 1-2: Power Point Conversion, Rank Progression, Sphere Choice, and Recovery Context' \
    'flow-first Immortals extraction built from heading-anchored page-column reads for the specific Section 1-2 doctrine needed downstream: XP-to-PP conversion, permanent-vs-current PP bookkeeping, rank/level frame, GT advancement costs, sphere selection frame, and planar-bias regeneration context.'
  cat >> "$OUT" <<'EOF'
Section 1: Changes

EOF

  render_tsv_col_pages "$IMM_PDF" 5 5 "0,205,410" 2 \
    | awk '
        started || /The most basic and far-reaching change in/ { started = 1 }
        /Form$/ { exit }
        started { print }
      ' >> "$OUT"
  printf '\n' >> "$OUT"
  render_tsv_col_pages "$IMM_PDF" 5 5 "0,205,410" 3 \
    | awk '
        started || /total in another place as well/ { started = 1 }
        /^Form$/ { exit }
        started { print }
      ' >> "$OUT"
  printf '\n' >> "$OUT"
  render_tsv_col_pages "$IMM_PDF" 6 6 "0,205,410" 2 \
    | awk '
        started || /higher ranks of Immortals in ascending order/ { started = 1 }
        /^Alignment$/ { exit }
        started { print }
      ' >> "$OUT"
  printf '\n' >> "$OUT"
  render_layout_page_chars_lines "$IMM_PDF" 7 0.12 100 160 4 99 \
    | awk '
        /^[[:space:]]*$/ {
          if (!blank++) print ""
          next
        }
        /Reducing Ability Scores/ { exit }
        { blank = 0; print }
      ' >> "$OUT"
  printf '\nSection 2: New Characters Information\n\n' >> "$OUT"
  render_tsv_col_pages "$IMM_PDF" 10 10 "0,205,410" 2 \
    | awk '
        started || /^Spheres$/ { started = 1 }
        /The five Spheres of Power are listed for/ { print; exit }
        started { print }
      ' >> "$OUT"
  printf '\n' >> "$OUT"
  crop_layout 11 400 40 180 730 \
    | awk '
        started || /Bias$/ { started = 1 }
        /^10$/ { next }
        /Bias of Specific Planes/ { exit }
        started { print }
      ' >> "$OUT"
  printf '\n' >> "$OUT"
  render_tsv_col_pages "$IMM_PDF" 11 11 "0,205,410" 3 \
    | awk '
        started || /^Power Point Recovery$/ { started = 1 }
        started { print }
      ' >> "$OUT"
  end_block
}

immortals_section_3_block() {
  begin_block_named \
    'Section 3: Immortal Magic' \
    'whole-section TSV and layout extraction were audited first, but chart-heavy page 18-21 reads still collide across columns and tables. This block therefore uses documented page-column slice fallback to preserve readable doctrine flow, with downstream validation for continuations, table structure, and Section 4 bleed.'
  cat >> "$OUT" <<'EOF'
Section 3: Immortal Magic

EOF

  crop_layout 18 10 40 185 730 \
    | awk '
        started || /An Immortal can recreate cleric, druid, and/ { started = 1; print }
      ' >> "$OUT"
  printf '\n' >> "$OUT"
  crop_layout 18 200 40 185 730 | sed '1{/^Magic$/d;}' >> "$OUT"
  printf '\n' >> "$OUT"
  crop_layout 18 390 40 190 730 >> "$OUT"
  printf '\n' >> "$OUT"
  crop_layout 19 10 40 185 730 >> "$OUT"
  printf '\n' >> "$OUT"
  crop_layout 19 200 40 185 730 >> "$OUT"
  printf '\n' >> "$OUT"
  crop_layout 19 390 40 190 730 >> "$OUT"
  printf '\n' >> "$OUT"
  crop_layout 20 10 40 185 730 >> "$OUT"
  printf '\n' >> "$OUT"
  crop_layout 20 200 40 185 730 >> "$OUT"
  printf '\n' >> "$OUT"
  crop_layout 20 390 40 190 730 >> "$OUT"
  printf '\n' >> "$OUT"
  crop_layout 21 10 40 185 730 >> "$OUT"
  printf '\n' >> "$OUT"
  crop_layout 21 200 40 185 730 >> "$OUT"
  printf '\n' >> "$OUT"
  crop_layout 21 390 40 190 730 >> "$OUT"
  end_block
}

cleanup_immortals_output() {
  perl -0pi -e '
    s/^\s*Immortal Magic\s*\n//mg;
    s/^\s*(18|19)\s*\n//mg;
    s/Average Results of C\n/Average Results of Common Dice Rolls\n/g;
    s/\b1dl2\b/1d12/g;
    s/are spe-\n\s*cifically/are specifically/g;
    s/charac-\nter\x27s/character\x27s/g;
    s/charac-\nter/character/g;
    s/suc-\ncess/success/g;
    s/magi-\n\s*cal/magical/g;
    s/produc-\ning/producing/g;
    s/ele-\nmental/elemental/g;
    s/auto-\nmatically/automatically/g;
    s/automati-\n\s*cally/automatically/g;
    s/cur-\nrent/current/g;
    s/expe-\nrience/experience/g;
    s/maxi-\n\s*mum/maximum/g;
    s/con-\ncentration/concentration/g;
    s/exist-\nence/existence/g;
    s/rela-\ntionship/relationship/g;
    s/effec-\ntive/effective/g;
    s/poly-\nmorphs/polymorphs/g;
    s/fail-\nure/failure/g;
    s/by review-\ning/by reviewing/g;
    s/multiplier trans-\nlates/multiplier translates/g;
    s/effect deter-\nmine/effect determine/g;
    s/on a circu-\nlar/on a circular/g;
    s/The result-\ning/The resulting/g;
    s/effects cre-\n\s*ated/effects created/g;
    s/may be cre-\n\s*ated/may be created/g;
    s/changes logi-\ncal/changes logical/g;
    s/creates multiple rounds of time/creates multiple rounds of time/g;
    s/C = Compan-\nion/C = Companion/g;
    s/simple multi-\nplication/simple multiplication/g;
    s/sim-\nple/simple/g;
    s/determining dam-\nage/determining damage/g;
    s/these modi-\nfiers/these modifiers/g;
    s/cumu-\nlative/cumulative/g;
    s/worm-\nhole/wormhole/g;
    s/summons a crea-\n\s*ture/summons a creature/g;
    s/used on any crea-\n\s*ture/used on any creature/g;
    s/trans-\nplanar summoning/transplanar summoning/g;
    s/if the vic-\ntim can cross/if the victim can cross/g;
    s/devoted to a sin-\ngle Sphere/devoted to a single Sphere/g;
    s/triple nor-\nmal range/triple normal range/g;
    s/instantane-\nous/instantaneous/g;
    s/abil-\n\s*ity score/ability score/g;
    s/abil-\n\s*ity score\(s\)/ability score\(s\)/g;
    s/Immorta\ncreatures/Immortal\ncreatures/g;
    s/telepathically links the char-\nacter/telepathically links the character/g;
    s/value \(including treasure\)\. However, trea-\nsures/value \(including treasure\)\. However, treasures/g;
    s/except when bargaining with mor-\ntals/except when bargaining with mortals/g;
    s/Sphere fac-\ntor x 2/Sphere factor x 2/g;
    s/category of non-\nspell/category of non-spell/g;
    s/Celestial of Thought \(A-\nM 60%\)/Celestial of Thought \(A-M 60%\)/g;
    s/sheer con-\ncentration/sheer concentration/g;
    s/Though speech is nor-\nmally/Though speech is normally/g;
    s/gravitational orienta-\ntion/gravitational orientation/g;
    s/solid non-\nliving object/solid non-living object/g;
    s/often mis-\n\s*leading/often misleading/g;
    s/phenome-\n\s*non/phenomenon/g;
    s/addi-\n\s*tional/additional/g;
    s/sev-\n\s*eral/several/g;
    s/logi-\n\s*cal/logical/g;
    s/avail-\n\s*able/available/g;
    s/Conjur-\n\s*ing/Conjuring/g;
    s/e\)\s+Bias\s*\n\s*\.\n/Bias\n\n/g;
    s/duration of any such effect is 1 hour \(6 turns\)\n/duration of any such effect is 1 hour \(6 turns\).\n/g;
    s/any increase in excess of this is discarded\n/any increase in excess of this is discarded.\n/g;
    s/"pur-\n\s*chased"/"purchased"/g;
    s/ability score\(s\ninvolved/ability score\(s\)\ninvolved/g;
    s/a large\nincrease/a larger\nincrease/g;
    s/\(though a\n10 times the base cost\)/\(though at\n10 times the base cost\)/g;
    s/increase he\nCharisma/increase her\nCharisma/g;
    s/The bes\nway/The best\nway/g;
    s/as tha\nmethod/as that\nmethod/g;
    s/damage i\ncast/damage if\ncast/g;
    s/caster leve\n90\)/caster level\n90)/g;
    s/15 Hi\nDice/15 Hit\nDice/g;
    s/relationship between an Immortal and his\nenvironment/relationship between an Immortal and his environment/g;
    s/other dimensions\nWhen used/other dimensions.\nWhen used/g;
    s/does no\ncause/does not\ncause/g;
    s/usua\ndefenses/usual\ndefenses/g;
    s/this effec\nmay/this effect\nmay/g;
    s/Immortal vic\ntim/Immortal victim/g;
    s/If success\nful/If successful/g;
    s/disintegra\ntion/disintegration/g;
    s/though i\ndoes/though it\ndoes/g;
    s/Dispel Evil: If used against an Immortal\nthis/Dispel Evil: If used against an Immortal,\nthis/g;
    s/successful\nthe effect/successful,\nthe effect/g;
    s/round afte\narriving/round after\narriving/g;
    s/weapons applie\nalso/weapons applies\nalso/g;
    s/modes o\nunarmed/modes of\nunarmed/g;
    s/make th\nusual/make the\nusual/g;
    s/^e\s+vs\. Spell/    vs. Spell/mg;
    s/effect, the Immortal\x27s form is affected nor-\nmally/effect, the Immortal\x27s form is affected normally/g;
    s/instead remain-\ning on the Astral Plane/instead remaining on the Astral Plane/g;
    s/Any effect\s+previously limited to "self can be delivered\s+by touch to any creature when produced by\s+an Immortal\./Any effect previously limited to "self" can be delivered by touch to any creature when produced by an Immortal./g;
    s/\n\n([ ]{3,}\S)/\n$1/g;
    s/Hold Monster: This can affect any living\n\s*mortal creature, but has no effect on Immor-\n\s*tals of any sort/Hold Monster: This can affect any living\nmortal creature, but has no effect on Immortals of any sort/g;
    s/If preceded by a gate spell or sim-\n\s*ilar effect, the insects may indeed be sum-\n\s*moned/If preceded by a gate spell or similar effect, the insects may indeed be summoned/g;
    s/Invisible Stalker: See General Notes \(Con-\n\s*juring and Summoning\)/Invisible Stalker: See General Notes \(Conjuring and Summoning\)/g;
    s/Levitate: In environments lacking gravita-\n\s*tional orientation/Levitate: In environments lacking gravitational orientation/g;
    s/If used by any other\nImmortal, this effect telepathically links the character with the Hierarch of his or her Sphere\. It is\nthus best used sparingly, if at all\./If used by any other Immortal, this effect telepathically links the character with the Hierarch of his or her Sphere. It is thus best used sparingly, if at all./g;
    s/status, including the exact rank if\nImmortal\./status, including the exact rank if Immortal./g;
    s/Conjure Elemental: See General Notes\n\(Conjuring and Summoning\)\./Conjure Elemental: See General Notes \(Conjuring and Summoning\)./g;
    s/Delayed Blast Fire Ball: See General Notes\n\(Damage\)\./Delayed Blast Fire Ball: See General Notes \(Damage\)./g;
    s/Lightning Bolt: See General Notes \(Dam-\nage\)\./Lightning Bolt: See General Notes \(Damage\)./g;
    s/The returning effect of the spell is automatic\nif the Immortal simply waits for the effect to\nend/The returning effect of the spell is automatic if the Immortal simply waits for the effect to end/g;
    s/\nThe five Spheres of Power are listed for\n\nBias/\n\nBias/g;
    s/Anti-Magic: When this category of non-spell magic \(of the Sphere of Time\) is created\s+and used on any creature which already has/Anti-Magic: When this category of non-spell magic \(of the Sphere of Time\) is created and used on any creature which already has/g;
    s/figures are cumula-\ntive/figures are cumulative/g;
    s/^    ([A-Z][A-Za-z -]+:)/$1/mg;
    s/Disintegrate:\s+In addition to the usual/Disintegrate: In addition to the usual/g;
    s/Disintegrate: In addition to the usual\ndefenses/Disintegrate: In addition to the usual defenses/g;
    s/Feeblemind:\s+See General Notes \(Mental\n\s*Effects\)\./Feeblemind: See General Notes \(Mental Effects\)./g;
    s/Insanity:\s+See General Notes \(Mental\n\s*Effects\)\./Insanity: See General Notes \(Mental Effects\)./g;
    s/\n    only within a single plane of existence\./\nonly within a single plane of existence./g;
    s/\n    might malfunction partially or totally if the/\nmight malfunction partially or totally if the/g;
    s/\n    path leads across planar boundaries\./\npath leads across planar boundaries./g;
    s/\n    DM may decide the specific result—whether/\nDM may decide the specific result—whether/g;
    s/\n    the spell seems to have no effect or the path/\nthe spell seems to have no effect or the path/g;
    s/\n    suddenly stops or proceeds in the wrong/\nsuddenly stops or proceeds in the wrong/g;
    s/\n    direction\. It is highly erratic and often misleading or useless when insufficient details of/\ndirection. It is highly erratic and often misleading or useless when insufficient details of/g;
    s/\n    the destination are known\. For example,/\nthe destination are known. For example,/g;
    s/\n    when used to find the seventh dimension, or/\nwhen used to find the seventh dimension, or/g;
    s/\n    the hiding place of the Old Ones, this effect/\nthe hiding place of the Old Ones, this effect/g;
    s/\n    leads in a random direction\./\nleads in a random direction./g;
    s/\n    does not affect the rate of Power use of any/\ndoes not affect the rate of Power use of any/g;
    s/\n    type, nor of any type of regeneration\./\ntype, nor of any type of regeneration./g;
    s/\n    affected by this magic, even if they were/\naffected by this magic, even if they were/g;
    s/\n    "persons" \(by the spell description\) in mortal/\n"persons" \(by the spell description\) in mortal/g;
    s/\n    life\./\nlife./g;
    s/\n    not conjured, and must thus be able to reach/\nnot conjured, and must thus be able to reach/g;
    s/\n    the caster by using their normal form of/\nthe caster by using their normal form of/g;
    s/\n    movement\. If preceded by a gate spell or similar effect, the insects may indeed be summoned from another plane or dimension\./\nmovement. If preceded by a gate spell or similar effect, the insects may indeed be summoned from another plane or dimension./g;
    s/\n    may be freely selected\. The movement rate is/\nmay be freely selected. The movement rate is/g;
    s/\n    still very slow in comparison to fly and other/\nstill very slow in comparison to fly and other/g;
    s/\n    effects, but may be useful in some situations\./\neffects, but may be useful in some situations./g;
    s/\n    If an Immortal applies this effect to another/\nIf an Immortal applies this effect to another/g;
    s/\n    creature, the creator of the effect may retain/\ncreature, the creator of the effect may retain/g;
    s/\n    control of the movement, or may give control/\ncontrol of the movement, or may give control/g;
    s/\n    to the recipient\. Control passes with the/\nto the recipient. Control passes with the/g;
    s/\n    touch required to bestow the effect\. If/\ntouch required to bestow the effect. If/g;
    s/\n    retained, control cannot be given at a later/\nretained, control cannot be given at a later/g;
    s/\n    time\. When this effect is used as a form of/\ntime. When this effect is used as a form of/g;
    s/\n    attack, to restrict or force movement with the/\nattack, to restrict or force movement with the/g;
    s/\n    creator retaining control, the victim may save/\ncreator retaining control, the victim may save/g;
    s/\n    vs\. Spell when touched to avoid the effect\. If/\nvs. Spell when touched to avoid the effect. If/g;
    s/\n    the victim saves, the magic vanishes\./\nthe victim saves, the magic vanishes./g;
    s/\n[ ]+If the victim of this effect is Immortal, he or she may leave the maze in 1 round, and then move freely as desired\. The Immortal need not then return to the point of disappearance\./\nIf the victim of this effect is Immortal, he or she may leave the maze in 1 round, and then move freely as desired. The Immortal need not then return to the point of disappearance./g;
    s/^    If the victim of this effect is Immortal, he or she may leave the maze in 1 round, and then move freely as desired\. The Immortal need not then return to the point of disappearance\./If the victim of this effect is Immortal, he or she may leave the maze in 1 round, and then move freely as desired. The Immortal need not then return to the point of disappearance./mg;
    s/Choose Best Option: This magic has no effect\nwhen used by a Hierarch\. If used by any other Immortal, this effect telepathically links the character with the Hierarch of his or her Sphere\. It is thus best used sparingly, if at all\. The Hierarch\nacts in the same way as would an artifact with this\npower, considering only those parts of a problem\nwhich are specifically presented\./Choose Best Option: This magic has no effect when used by a Hierarch. If used by any other Immortal, this effect telepathically links the character with the Hierarch of his or her Sphere. It is thus best used sparingly, if at all. The Hierarch acts in the same way as would an artifact with this power, considering only those parts of a problem which are specifically presented./g;
    s/If the victim of this effect is Immortal, he or\nshe may leave the maze in 1 round, and then\nfree to move as desired\./If the victim of this effect is Immortal, he or she may leave the maze in 1 round, and then move freely as desired./g;
    s/The Immortal need\nnot then return to the point of disappearance\./The Immortal need not then return to the point of disappearance./g;
    s/^[ ]+(Example:|Limits on Use|Caster Level|General Notes, Charts|Using the Charts)/$1/mg;
    s/^ Magic of any origin,/Magic of any origin,/mg;
    s/^ no effect on an incorporeal being\./no effect on an incorporeal being./mg;
    s/^ effects created by mortals have no effect on/effects created by mortals have no effect on/mg;
    s/^ Immortals in any form\. Magical effects created by Immortals have standard effects on/Immortals in any form. Magical effects created by Immortals have standard effects on/mg;
    s/^ other Immortals—subject to Anti-Magic/other Immortals—subject to Anti-Magic/mg;
    s/^ effects \(q\.v\.\), and with/effects \(q.v.\), and with/mg;
    s/^ his or her physical form,/his or her physical form,/mg;
    s/^ to some other creature or object\./to some other creature or object./mg;
    s/^ scope of many such effects\./scope of many such effects./mg;
    s/^ take one physical action/take one physical action/mg;
    s/^ form or one magical action, but not both\./form or one magical action, but not both./mg;
    s/^ "Action" in this usage/"Action" in this usage/mg;
    s/^ attacks, defense,/attacks, defense,/mg;
    s/^ magical effect\. Multiple physical attacks are/magical effect. Multiple physical attacks are/mg;
    s/^ possible if the Immortal form possesses several natural methods of attack/possible if the Immortal form possesses several natural methods of attack/mg;
    s/^ claw twice, bite, and maybe hug in the same/claw twice, bite, and maybe hug in the same/mg;
    s/^ are located in the Reference Guide, located in/are located in the Reference Guide, located in/mg;
    s/^ given for each spell/given for each spell/mg;
    s/^ effect, along with ranges and durations for/effect, along with ranges and durations for/mg;
    s/^ note in which rule set/note in which rule set/mg;
    s/^ are: B = Basic, X = Expert, C = Companion, and M = Masters\./are: B = Basic, X = Expert, C = Companion, and M = Masters./mg;
    s/^ spells are obvious/spells are obvious/mg;
    s/^ valuable tools in play\./valuable tools in play./mg;
    s/^ described in the Artifact power descriptions/described in the Artifact power descriptions/mg;
    s/^ of the D&D Master Set \(DMR pages 51 -54\)\./of the D&D Master Set \(DMR pages 51 -54\)./mg;
    s/^ extrapolations of those given, and need no/extrapolations of those given, and need no/mg;
    s/^ additional explanation\./additional explanation./mg;
    s/^    An Immortal may apply magical effects to/An Immortal may apply magical effects to/mg;
    s/^    During any one round, an Immortal may/During any one round, an Immortal may/mg;
    s/^ round\)\./round)./mg;
    s/^   A page reference and base PP cost are/A page reference and base PP cost are/mg;
    s/^   Most non-spell magical effects are/Most non-spell magical effects are/mg;
    s/^  The volume of an effect may also be/The volume of an effect may also be/mg;
    s/^   Conjuring refers to a magical effect that/Conjuring refers to a magical effect that/mg;
    s/^   Conjuring and\/or summoning will not/Conjuring and\/or summoning will not/mg;
    s/^  For any effect involving large numbers of/For any effect involving large numbers of/mg;
    s/^   A new rule is used when determining damage/A new rule is used when determining damage/mg;
    s/^   If bonuses or penalties apply to damage/If bonuses or penalties apply to damage/mg;
    s/^   The averages for most common types of/The averages for most common types of/mg;
    s/^   The average roll for a given type of die is/The average roll for a given type of die is/mg;
    s/^   If the Immortal victim\x27s A-M does not/If the Immortal victim\x27s A-M does not/mg;
    s/^    When a new check is allowed, the player/When a new check is allowed, the player/mg;
    s/^ makes a standard Intelligence check,/makes a standard Intelligence check,/mg;
    s/^ character\x27s Intelligence score before being/character\x27s Intelligence score before being/mg;
    s/^ affected by the spell\. If that check succeeds, a/affected by the spell. If that check succeeds, a/mg;
    s/^ new saving throw may be attempted\. The/new saving throw may be attempted. The/mg;
    s/^ effect vanishes without magical curing only if/effect vanishes without magical curing only if/mg;
    s/^ remains if either the check or the saving/remains if either the check or the saving/mg;
    s/^ throw is failed\./throw is failed./mg;
    s/^    Immortals with 76 or greater Intelligence/Immortals with 76 or greater Intelligence/mg;
    s/^ may check once at the start of each round,/may check once at the start of each round,/mg;
    s/^ and again at the midpoint of the round\./and again at the midpoint of the round./mg;
    s/^ Immortals with 91 or greater Intelligence/Immortals with 91 or greater Intelligence/mg;
    s/^ need not make the ability score check at all\./need not make the ability score check at all./mg;
    s/^ round\)\./round)./mg;
    s/2d20-20,\n\na range of -18 to \+20\./2d20-20, a range of -18 to +20./g;
    s/^ score determines the frequency of any/score determines the frequency of any/mg;
    s/^ attempts to non-magically conquer or defeat/attempts to non-magically conquer or defeat/mg;
    s/^ the effect\. This frequency is identical to that/the effect. This frequency is identical to that/mg;
    s/^ given in the D&D Master Set \(MDM page/given in the D&D Master Set \(MDM page/mg;
    s/^ 16\) in reference to charm effects\. The chart/16\) in reference to charm effects. The chart/mg;
    s/^ below adds to that earlier one, and covers the/below adds to that earlier one, and covers the/mg;
    s/^ span of Immortal ability scores\./span of Immortal ability scores./mg;
    s/com-\n paring/comparing/g;
    s/^ the saving throw succeeds\. The effect/the saving throw succeeds. The effect/mg;
    s/^[ ]+If the victim of this effect is Immortal, he or she may leave the maze in 1 round, and then move freely as desired\. The Immortal need not then return to the point of disappearance\./If the victim of this effect is Immortal, he or she may leave the maze in 1 round, and then move freely as desired. The Immortal need not then return to the point of disappearance./mg;
    s/\n```\n*\z/\n/;
  ' "$IMM_OUT"
}

validate_immortals_output() {
  assert_file_contains "$IMM_OUT" '^### Sections 1-2: Power Point Conversion, Rank Progression, Sphere Choice, and Recovery Context$' 'Immortals Sections 1-2 doctrine block heading is missing'
  assert_file_contains "$IMM_OUT" '^### Section 3: Immortal Magic$' 'Immortals Section 3 heading is missing'
  assert_section_contains "$IMM_OUT" '### Sections 1-2: Power Point Conversion, Rank Progression, Sphere Choice, and Recovery Context' '### Section 3: Immortal Magic' 'Each 10,000 XP are worth 1 PP' 'Immortals PP conversion doctrine is missing'
  assert_section_contains "$IMM_OUT" '### Sections 1-2: Power Point Conversion, Rank Progression, Sphere Choice, and Recovery Context' '### Section 3: Immortal Magic' 'permanent PP total' 'Immortals PP bookkeeping flow is truncated'
  assert_section_contains "$IMM_OUT" '### Sections 1-2: Power Point Conversion, Rank Progression, Sphere Choice, and Recovery Context' '### Section 3: Immortal Magic' 'higher ranks of Immortals in ascending order' 'Immortals rank frame is missing'
  assert_section_contains "$IMM_OUT" '### Sections 1-2: Power Point Conversion, Rank Progression, Sphere Choice, and Recovery Context' '### Section 3: Immortal Magic' 'Rank\s+Per Point\s+Score' 'Immortals ability-cost table header is malformed or missing'
  assert_section_contains "$IMM_OUT" '### Sections 1-2: Power Point Conversion, Rank Progression, Sphere Choice, and Recovery Context' '### Section 3: Immortal Magic' 'Hierarch\s+160 PP' 'Immortals ability-cost table is truncated before Hierarch'
  assert_section_contains "$IMM_OUT" '### Sections 1-2: Power Point Conversion, Rank Progression, Sphere Choice, and Recovery Context' '### Section 3: Immortal Magic' 'Greater Talent must be raised to the maxi' 'Immortals GT advancement gate is missing'
  assert_section_contains "$IMM_OUT" '### Sections 1-2: Power Point Conversion, Rank Progression, Sphere Choice, and Recovery Context' '### Section 3: Immortal Magic' '^Spheres$' 'Immortals sphere-choice frame is missing'
  assert_section_contains "$IMM_OUT" '### Sections 1-2: Power Point Conversion, Rank Progression, Sphere Choice, and Recovery Context' '### Section 3: Immortal Magic' '"bias" of the Plane—hostile, neutral, or' 'Immortals bias doctrine is missing'
  assert_section_contains "$IMM_OUT" '### Sections 1-2: Power Point Conversion, Rank Progression, Sphere Choice, and Recovery Context' '### Section 3: Immortal Magic' '^Power Point Recovery$' 'Immortals Power Point recovery doctrine is missing'

  assert_section_contains "$IMM_OUT" '### Section 3: Immortal Magic' '' 'Sphere Factors for Magical Effects' 'Immortals sphere-factor matrix heading is missing'
  assert_section_contains "$IMM_OUT" '### Section 3: Immortal Magic' '' 'Force Field' 'Immortals sample-cost table is truncated before Force Field'
  assert_section_contains "$IMM_OUT" '### Section 3: Immortal Magic' '' 'Remove Fear' 'Immortals sample-cost table is truncated before Remove Fear'
  assert_section_contains "$IMM_OUT" '### Section 3: Immortal Magic' '' '^Changing Range and Duration$' 'Immortals range/duration doctrine is missing'
  assert_section_contains "$IMM_OUT" '### Section 3: Immortal Magic' '' '^Conjuring and Summoning$' 'Immortals conjuring/summoning doctrine is missing'
  assert_section_contains "$IMM_OUT" '### Section 3: Immortal Magic' '' '^Damage$' 'Immortals damage doctrine is missing'
  assert_section_contains "$IMM_OUT" '### Section 3: Immortal Magic' '' 'Average Results of Common Dice Rolls' 'Immortals common-dice table heading is malformed'
  assert_section_contains "$IMM_OUT" '### Section 3: Immortal Magic' '' 'Durations of Mental Effects' 'Immortals mental-effects duration table heading is malformed'
  assert_section_contains "$IMM_OUT" '### Section 3: Immortal Magic' '' '^Undead Curing$' 'Immortals undead/Entropy interaction doctrine is missing'
  assert_section_contains "$IMM_OUT" '### Section 3: Immortal Magic' '' 'Contact Outer Plane: This produces an' 'Immortals Contact Outer Plane override is missing'
  assert_section_contains "$IMM_OUT" '### Section 3: Immortal Magic' '' 'Invisible Stalker: See General Notes \(Conjuring and Summoning\)\.' 'Immortals Invisible Stalker override is malformed'
  assert_section_contains "$IMM_OUT" '### Section 3: Immortal Magic' '' '^Feeblemind: See General Notes \(Mental Effects\)\.$' 'Immortals Feeblemind override is missing'
  assert_section_contains "$IMM_OUT" '### Section 3: Immortal Magic' '' '^Life Trapping: This effect can only be$' 'Immortals Life Trapping override is missing'
  assert_section_contains "$IMM_OUT" '### Section 3: Immortal Magic' '' 'Maze: This has no effect whatsoever if used' 'Immortals effect-explanation flow is truncated before Maze'

  assert_section_not_contains "$IMM_OUT" '### Section 3: Immortal Magic' '' 'Section 4:' 'Immortals Section 3 extraction bled into Section 4'
  assert_file_not_contains "$IMM_OUT" '^\[Immortals page' 'Immortals output still contains inline page markers'
  assert_file_not_contains "$IMM_OUT" 'previously limited to "self can be delivered' 'Immortals cleanup left a broken self-only clause fragment'
  assert_file_not_contains "$IMM_OUT" '\b1dl2\b' 'Immortals cleanup left malformed 1d12 OCR output'
  assert_file_not_contains "$IMM_OUT" 'sim-\n\s*ilar effect' 'Immortals cleanup left a broken continuation join in Insect Swarm'
}

extract_pdf "$IMM_PDF" "$IMM_TXT"
OUT="$IMM_OUT"
write_header 'TODO: BECMI Spell Material Staging - Immortals' 'TSR 1017 - Set 5 Immortals Rules.pdf'
immortals_sections_1_2_block
immortals_section_3_block
cleanup_output
cleanup_immortals_output
validate_immortals_output

set_table_qa_note "$IMM_OUT" 'reviewed 2026-03-27 after flow-first rebuild' 'Section 1-2 doctrinal evidence blocks, the page-7 GT advancement cost table, the sphere-factor matrix, sample-cost table, common-dice and mental-effect tables, undead/Entropy doctrine, and the alphabetical effect-explanation run through Maze.' 'Immortals now rebuild from extracted Section 1-2 evidence plus validated Section 3 slice fallbacks; no blocking continuation, table, or section-bleed defect remains in the audited Immortals lane.'
append_table_qa_lines "$IMM_OUT" <<'EOF'
- Capture confidence: **0.97** (UP from 0.95 after replacing the prior Sections 1-2 summary with extracted evidence and adding Immortals-specific validation gates)
- Coverage note: Immortals Sections 1-3 now stage the doctrinal surfaces needed downstream: PP conversion and bookkeeping, rank/level and GT advancement costs, sphere/bias/recovery context, and the full audited Immortal Magic flow through `Maze`.
- Extraction note: whole-section reads were attempted first; Section 3 still uses documented page-column slice fallback because the chart-heavy pages interleave columns under plain contiguous extraction.
- Gap priority: LOW — no unresolved structural Immortals source-evidence gap remains for the current spell/material scope.
EOF
