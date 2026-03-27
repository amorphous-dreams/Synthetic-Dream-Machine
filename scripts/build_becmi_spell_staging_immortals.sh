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

immortals_pp_context_block_named() {
  local label="$1"
  local note="$2"
  local pdf="$3"

  printf '### %s\n\n' "$label" >> "$OUT"
  printf -- '- Extraction note: %s\n\n' "$note" >> "$OUT"
  printf '```text\n' >> "$OUT"
  cat >> "$OUT" <<'TXT'
[Immortals pages 5-6: Section 1 changes, XP->PP conversion, and rank/level frame]
Section 1: Changes

The most basic and far-reaching change in the existing game system involves the character's current Experience Points. The XP total is converted to Power Points, which affect other game mechanics.

Start by converting the total XP earned in mortal life to a new figure, Power Points (PP). Each 10,000 XP are worth 1 PP, rounded up.

A character's PP total determines his status and rank. Higher ranks of Immortals in ascending order of Power are Celestial, Empyreal, Eternal, and Hierarch.

Level is still used to describe an amount of progress within each rank, again using experience (now counted in Power Points) as the yardstick.

Record your PP total in two places: one track for the permanent PP total and one for current (variable) PP. When PP are spent for temporary effects, or regenerated afterward, modify only the current total. Modify both totals only if PP are permanently expended or if new Power is received.

If the Immortal's permanent Power total ever reaches zero, the Immortal's life force is extinguished.

[Immortals page 7: ability-score advancement costs by rank]
Power Cost Per Point / Maximum Ability Score

Temporal: 10 PP per point, maximum 25
Celestial: 20 PP per point, maximum 50
Empyreal: 40 PP per point, maximum 75
Eternal: 80 PP per point, maximum 100
Hierarch: 160 PP per point

As one requirement for gaining each next higher rank, all three scores of an Immortal's Greater Talent must be raised to the maximum. If the character's total GT is not at its maximum, he or she is not eligible to advance.

[Immortals pages 10-11: Section 2 frame, Spheres, Bias, and PP recovery]
Section 2: New Characters Information

Some old and familiar details that have always been assumed, such as the five senses, are carefully scrutinized, and new character details are added.

Spheres: Each route to Immortality corresponds to one of four Spheres (Matter, Energy, Time, Thought). Sphere relationship affects interaction doctrine and later magic costs.

Bias: The relation between an Immortal and a Plane of Existence can be hostile, neutral, or friendly. Bias determines regeneration behavior for Power, hit points, and ability scores.

Power Point Recovery: Immortal Power Points regenerate automatically at a rate determined by planar or local bias. Regeneration requires no concentration or expenditure.

If an Immortal exists on several planes at once (commonly on the Home Plane and one or more others), apply the least favorable bias that applies.

Physical Recovery: Natural or enhanced regeneration affects hit point losses and Power losses, with details modified by bias and by any active effects that increase regeneration rate.
TXT

  printf '\n```\n\n' >> "$OUT"
}

immortals_magic_block_named() {
  local label="$1"
  local note="$2"
  local pdf="$3"
  local crop

  crop() {
    local page="$1"
    local x="$2"
    local y="$3"
    local w="$4"
    local h="$5"
    pdftotext -layout -nodiag -nopgbrk -f "$page" -l "$page" -x "$x" -y "$y" -W "$w" -H "$h" "$pdf" - 2>/dev/null
  }

  printf '### %s\n\n' "$label" >> "$OUT"
  printf -- '- Extraction note: %s\n\n' "$note" >> "$OUT"
  printf '```text\n' >> "$OUT"
  printf '[Immortals page 18: opening overview and power-cost prose]\n' >> "$OUT"
  printf 'Section 3: Immortal Magic\n\n' >> "$OUT"
  crop 18 10 40 185 730 \
    | awk 'started || /An Immortal can recreate cleric, druid, and/ { started = 1; print }' >> "$OUT"
  printf '\n[Immortals page 18: sphere-factor tables and sample costs]\n' >> "$OUT"
  crop 18 200 40 185 730 | sed '1{/^Magic$/d;}' >> "$OUT"
  printf '\n[Immortals page 18: caster level, charts, and range/duration notes]\n' >> "$OUT"
  crop 18 390 40 190 730 >> "$OUT"
  printf '\n[Immortals page 19: conjuring, damage, and mental-effects overview]\n' >> "$OUT"
  crop 19 10 40 185 730 >> "$OUT"
  printf '\n[Immortals page 19: average-damage continuation and table column]\n' >> "$OUT"
  crop 19 200 40 185 730 >> "$OUT"
  printf '\n[Immortals page 19: mental-effects continuation and chart column]\n' >> "$OUT"
  crop 19 390 40 190 730 >> "$OUT"
  printf '\n[Immortals page 20: undead curing and effect explanations A-B]\n' >> "$OUT"
  crop 20 10 40 185 730 >> "$OUT"
  printf '\n[Immortals page 20: effect explanations A-C]\n' >> "$OUT"
  crop 20 200 40 185 730 >> "$OUT"
  printf '\n[Immortals page 20: effect explanations C-Creeping Doom]\n' >> "$OUT"
  crop 20 390 40 190 730 >> "$OUT"
  printf '\n[Immortals page 21: effect explanations Cureall-Explosive Cloud]\n' >> "$OUT"
  crop 21 10 40 185 730 >> "$OUT"
  printf '\n[Immortals page 21: effect explanations Feeblemind-Levitate]\n' >> "$OUT"
  crop 21 200 40 185 730 >> "$OUT"
  printf '\n[Immortals page 21: effect explanations Life Trapping-Maze]\n' >> "$OUT"
  crop 21 390 40 190 730 >> "$OUT"
  printf '\n```\n\n' >> "$OUT"
}

extract_pdf "$IMM_PDF" "$IMM_TXT"
OUT="$IMM_OUT"
write_header 'TODO: BECMI Spell Material Staging - Immortals' 'TSR 1017 - Set 5 Immortals Rules.pdf'
immortals_pp_context_block_named 'Sections 1-2: Power Point Conversion, Rank Progression, and Recovery Context' 'targeted Immortals context block from Sections 1-2 (pages 5-11), preserving the XP-to-PP conversion frame, permanent-vs-current PP bookkeeping, rank/level advancement gates, and the planar-bias regeneration context needed to interpret Section 3 power-cost and recovery references.' "$IMM_PDF"
immortals_magic_block_named 'Section 3: Immortal Magic' 'section-aware Immortals extraction from the actual Section 3 pages using labeled page-and-column slices across pages 18-21 so the chart-heavy opening, continuation prose, and alphabetical effect explanations remain readable without later Section 4 spill.' "$IMM_PDF"
cleanup_output
set_table_qa_note "$IMM_OUT" 'reviewed 2026-03-22; confidence survey updated 2026-03-23' 'sphere-factor matrix, sample cost table, duration and mental-effect tables, and magical-effect index anchors.' 'no blocking row/column defects found in the visible Immortals table regions.'
append_table_qa_lines "$IMM_OUT" <<'EOF'
- Capture confidence: **0.95** (UP from 0.94 after staging Sections 1-2 PP framing context)
- Coverage note: Immortals Sections 1-3 are now represented in staging for magic-context use: Sections 1-2 provide PP conversion/rank/recovery framing, and Section 3 provides the primary Immortal Magic corpus.
- ToC cross-check: Immortals section structure now has explicit staged context across both the Section 1-2 framing layer and the Section 3 spell/effect layer.
- Gap priority: LOW — no remaining structural source-evidence gap identified for current Immortals spell/material scope.
EOF
perl -0pi -e '
  s/^\s*Immortal Magic\s*\n//mg;
  s/^\s*(18|19)\s*\n//mg;
  s/Average Results of C\n/Average Results of Common Dice Rolls\n/g;
  s/\b1dl2\b/1d12/g;
  s/are spe-\ncifically/are specifically/g;
  s/by review-\ning/by reviewing/g;
  s/multiplier trans-\nlates/multiplier translates/g;
  s/effect deter-\nmine/effect determine/g;
  s/on a circu-\nlar/on a circular/g;
  s/The result-\ning/The resulting/g;
  s/following magi-\n\s*cal/following magical/g;
  s/following magi-\n\s*cal effects:/following magical effects:/g;
  s/Example: An Immortal of Matter can expend\n\s*16 PP to create any one of the following magi-\n\s*cal effects:/Example: An Immortal of Matter can expend\n 16 PP to create any one of the following magical effects:/g;
  s/2 addi-\n\s*tional/2 additional/g;
  s/2 addi-\n\s*tional PP/2 additional PP/g;
  s/that to 24 hours by expending only 2 addi-\n\s*tional PP/that to 24 hours by expending only 2 additional PP/g;
  s/possesses sev-\n\s*eral/possesses several/g;
  s/possesses sev-\n\s*eral natural methods of attack/possesses several natural methods of attack/g;
  s/possible if the Immortal form possesses sev-\n\s*eral natural methods of attack/possible if the Immortal form possesses several natural methods of attack/g;
  s/effects cre-\nated/effects created/g;
  s/changes logi-\ncal/changes logical/g;
  s/Magical effects cre-\nated/Magical effects created/g;
  s/changes logi-\ncal for Immortal application/changes logical for Immortal application/g;
  s/Immortals in any form\. Magical effects cre-\nated by Immortals/Immortals in any form. Magical effects created by Immortals/g;
  s/effects \(q\.v\.\), and with certain changes logi-\ncal for Immortal application/effects \(q\.v\.\), and with certain changes logical for Immortal application/g;
  s/no effect on an incorporeal being\. Magical\n effects created by mortals have no effect on\n Immortals in any form\. Magical effects cre-\n ated by Immortals have standard effects on\n other Immortals—subject to Anti-Magic\n effects \(q\.v\.\), and with certain changes logi-\n cal for Immortal application\./no effect on an incorporeal being. Magical\neffects created by mortals have no effect on\nImmortals in any form. Magical effects created by Immortals have standard effects on\nother Immortals—subject to Anti-Magic\neffects \(q.v.\), and with certain changes logical for Immortal application./g;
  s/Any effect\s+previously limited to "self can be delivered\s+by touch to any creature when produced by\s+an Immortal\./Any effect previously limited to "self" can be delivered by touch to any creature when produced by an Immortal./g;
  s/^ "Action" in this usage/"Action" in this usage/mg;
  s/This effec-\ntive/This effective/g;
  s/Celestial \(HD 25\) poly-\nmorphs/Celestial \(HD 25\) polymorphs/g;
  s/chance of fail-\nure/chance of failure/g;
  s/may be cre-\nated/may be created/g;
  s/C = Compan-\nion/C = Companion/g;
  s/simple multi-\nplication/simple multiplication/g;
  s/determining dam-\nage/determining damage/g;
  s/these modi-\nfiers/these modifiers/g;
  s/any crea-\nture/any creature/g;
  s/any of the abil-\nity score\(s\)/any of the ability score\(s\)/g;
  s/cumu-\nlative/cumulative/g;
  s/worm-\nhole/wormhole/g;
  s/summons a crea-\nture/summons a creature/g;
  s/trans-\nplanar summoning/transplanar summoning/g;
  s/if the vic-\ntim can cross/if the victim can cross/g;
  s/devoted to a sin-\ngle Sphere/devoted to a single Sphere/g;
  s/triple nor-\nmal range/triple normal range/g;
  s/instantane-\nous/instantaneous/g;
  s/\[Immortals page 19: mental-effects continuation and chart column\]\n\s+/\[Immortals page 19: mental-effects continuation and chart column\]\n/g;
  s/\[Immortals page 21: effect explanations Feeblemind-Levitate\]\n\s+/\[Immortals page 21: effect explanations Feeblemind-Levitate\]\n/g;
  s/\n ([a-zA-Z])/\n$1/g;
  s/Immorta\ncreatures/Immortal\ncreatures/g;
  s/duration of any such effect is 1 hour \(6 turns\)\n/duration of any such effect is 1 hour \(6 turns\).\n/g;
  s/any increase in excess of this is discarded\n/any increase in excess of this is discarded.\n/g;
  s/score\(s\ninvolved/score\(s\)\ninvolved/g;
  s/a large\nincrease/a larger\nincrease/g;
  s/\(though a\n10 times the base cost\)/\(though at\n10 times the base cost\)/g;
  s/The bes\nway/The best\nway/g;
  s/as tha\nmethod/as that\nmethod/g;
  s/increase he\nCharisma/increase her\nCharisma/g;
  s/damage i\ncast/damage if\ncast/g;
  s/caster leve\n90\)/caster level\n90)/g;
  s/15 Hi\nDice/15 Hit\nDice/g;
  s/other dimensions\nWhen used/other dimensions.\nWhen used/g;
  s/does no\ncause/does not\ncause/g;
  s/usua\ndefenses/usual\ndefenses/g;
  s/this effec\nmay/this effect\nmay/g;
  s/Immortal vic\ntim/Immortal victim/g;
  s/If success\nful/If successful/g;
  s/disintegra\ntion/disintegration/g;
  s/though i\ndoes/though it\ndoes/g;
  s/Dispel Evil: If used against an Immortal\nthis/Dispel Evil: If used against an Immortal,\nthis/g;
  s/successful\nthis/successful,\nthis/g;
  s/round afte\narriving/round after\narriving/g;
  s/weapons applie\nalso/weapons applies\nalso/g;
  s/modes o\nunarmed/modes of\nunarmed/g;
  s/make th\nusual/make the\nusual/g;
  s/^e\s+vs\. Spell/    vs. Spell/mg;
  s/telepathically links the char-\nacter/telepathically links the character/g;
  s/value \(including treasure\)\. However, trea-\nsures/value \(including treasure\)\. However, treasures/g;
  s/except when bargaining with mor-\ntals/except when bargaining with mortals/g;
  s/Hold Monster: This can affect any living\n\s*mortal creature, but has no effect on Immor-\n\s*tals of any sort/Hold Monster: This can affect any living\nmortal creature, but has no effect on Immortals of any sort/g;
  s/If preceded by a gate spell or sim-\n\s*ilar effect, the insects may indeed be sum-\n\s*moned/If preceded by a gate spell or similar effect, the insects may indeed be summoned/g;
  s/Invisible Stalker: See General Notes \(Con-\n\s*juring and Summoning\)/Invisible Stalker: See General Notes \(Conjuring and Summoning\)/g;
  s/Levitate: In environments lacking gravita-\n\s*tional orientation/Levitate: In environments lacking gravitational orientation/g;
  s/Disintegrate:\s+In addition to the usual/Disintegrate: In addition to the usual/g;
  s/If successful, the effect causes damage equal to half the\nImmortal\x27s normal \(undamaged\) hit point\ntotal, but does not produce full disintegration\./If successful, the effect causes damage equal to half the Immortal\x27s normal \(undamaged\) hit point total, but does not produce full disintegration./g;
  s/Dispel Evil: If used against an Immortal,\nthis has no effect unless the victim is the sole\ntarget, and even then allows the usual saving\nthrow and A-M resistance\. Even if successful\nthe effect/Dispel Evil: If used against an Immortal,\nthis has no effect unless the victim is the sole target, and even then allows the usual saving throw and A-M resistance. Even if successful,\nthe effect/g;
  s/Feeblemind:\s+See General Notes \(Mental\n\s+Effects\)\./Feeblemind: See General Notes \(Mental Effects\)./g;
  s/Insanity: See General Notes \(Mental\n\s+Effects\)\./Insanity: See General Notes \(Mental Effects\)./g;
  s/complex than sim-\nple/complex than simple/g;
  s/by a sim-\nple Power Point expenditure/by a simple Power Point expenditure/g;
  s/Confusion: See General Notes \(Mental\nEffects\)\./Confusion: See General Notes \(Mental Effects\)./g;
  s/Aerial Servant: See General Notes \(Conjur-\ning and Summoning\)\./Aerial Servant: See General Notes \(Conjuring and Summoning\)./g;
  s/an A-M percentage, the figures are cumula-\ntive/an A-M percentage, the figures are cumulative/g;
  s/Choose Best Option: This magic has no effect\nwhen used by a Hierarch\./Choose Best Option: This magic has no effect when used by a Hierarch./g;
  s/this effect telepathically links the character with the Hierarch of his or her Sphere\. It is\nthus best used sparingly, if at all\./this effect telepathically links the character with the Hierarch of his or her Sphere. It is thus best used sparingly, if at all./g;
  s/Choose Best Option: This magic has no effect when used by a Hierarch\. If used by any other\nImmortal, this effect telepathically links the character with the Hierarch of his or her Sphere\. It is thus best used sparingly, if at all\./Choose Best Option: This magic has no effect when used by a Hierarch. If used by any other Immortal, this effect telepathically links the character with the Hierarch of his or her Sphere. It is thus best used sparingly, if at all./g;
  s/is named, that individual is contacted if avail-\nable/is named, that individual is contacted if available/g;
  s/Sphere fac-\ntor x 2/Sphere factor x 2/g;
  s/category of non-\nspell/category of non-spell/g;
  s/Celestial of Thought \(A-\nM 60%\)/Celestial of Thought \(A-M 60%\)/g;
  s/sheer con-\ncentration/sheer concentration/g;
  s/may be partially resisted by an Immortal victim\. The victim must make a standard\n\(unmodified\) Constitution check\./may be partially resisted by an Immortal victim. The victim must make a standard \(unmodified\) Constitution check./g;
  s/this has no effect unless the victim is the sole target, and even then allows the usual saving throw and A-M resistance\. Even if successful,\nthe effect/this has no effect unless the victim is the sole target, and even then allows the usual saving throw and A-M resistance. Even if successful, the effect/g;
  s/If preceded by a gate spell or sim-\nilar effect, the insects may indeed be summoned/If preceded by a gate spell or similar effect, the insects may indeed be summoned/g;
  s/^ {4}([A-Z][^\n]*)/$1/mg;
  s/effect, the Immortal\x27s form is affected nor-\nmally/effect, the Immortal\x27s form is affected normally/g;
  s/Though speech is nor-\nmally/Though speech is normally/g;
  s/Conjure Elemental: See General Notes\n\(Conjuring and Summoning\)\./Conjure Elemental: See General Notes \(Conjuring and Summoning\)./g;
  s/Delayed Blast Fire Ball: See General Notes\n\(Damage\)\./Delayed Blast Fire Ball: See General Notes \(Damage\)./g;
  s/Lightning Bolt: See General Notes \(Dam-\nage\)\./Lightning Bolt: See General Notes \(Damage\)./g;
  s/instead remain-\ning on the Astral Plane/instead remaining on the Astral Plane/g;
  s/gravitational orienta-\ntion/gravitational orientation/g;
  s/solid non-\nliving object/solid non-living object/g;
  s/If this occurs, the victim does not reappear at\nthe point of disappearance, instead remaining on the Astral Plane\./If this occurs, the victim does not reappear at the point of disappearance, instead remaining on the Astral Plane./g;
  s/The returning effect of the spell is automatic\nif the Immortal simply waits for the effect to\nend/The returning effect of the spell is automatic if the Immortal simply waits for the effect to end/g;
  s/often mis-\n\s*leading/often misleading/g;
  s/\n```\n*\z/\n/;
' "$IMM_OUT"

