#!/usr/bin/env bash
set -euo pipefail

ROOT='/home/joshu/Synthetic-Dream-Machine'
OUT="$ROOT/_todo/TODO_BECMI_Spell_Material_Staging.md"
TMPDIR=$(mktemp -d)
trap 'rm -rf "$TMPDIR"' EXIT

extract_pdf() {
  local pdf="$1"
  local out="$2"
  pdftotext -layout -nodiag -nopgbrk "$pdf" "$out" 2>/dev/null
}

start_section() {
  local title="$1"
  printf '## %s\n\n' "$title" >> "$OUT"
}

range_block() {
  local txt="$1"
  local start="$2"
  local end="$3"
  printf '### Extracted Section\n\n' >> "$OUT"
  printf -- '- Extraction note: section boundary inferred from line-range review of `pdftotext -layout -nodiag -nopgbrk` output.\n\n' >> "$OUT"
  printf '```text\n' >> "$OUT"
  sed -n "${start},${end}p" "$txt" | sed '/^[[:space:]]*[0-9][0-9]*[[:space:]]*$/d' >> "$OUT"
  printf '\n```\n\n' >> "$OUT"
}

range_block_named() {
  local label="$1"
  local txt="$2"
  local start="$3"
  local end="$4"
  local note="$5"
  printf '### %s\n\n' "$label" >> "$OUT"
  printf -- '- Extraction note: %s\n\n' "$note" >> "$OUT"
  printf '```text\n' >> "$OUT"
  sed -n "${start},${end}p" "$txt" | sed '/^[[:space:]]*[0-9][0-9]*[[:space:]]*$/d' >> "$OUT"
  printf '\n```\n\n' >> "$OUT"
}

anchored_range_block_named() {
  local label="$1"
  local txt="$2"
  local start="$3"
  local end="$4"
  local note="$5"
  local anchor="$6"
  printf '### %s\n\n' "$label" >> "$OUT"
  printf -- '- Extraction note: %s\n\n' "$note" >> "$OUT"
  printf '```text\n' >> "$OUT"
  sed -n "${start},${end}p" "$txt" \
    | sed '/^[[:space:]]*[0-9][0-9]*[[:space:]]*$/d' \
    | awk -v anchor="$anchor" 'started || index($0, anchor) { started=1; print }' >> "$OUT"
  printf '\n```\n\n' >> "$OUT"
}

manual_block() {
  local label="$1"
  local note="$2"
  local body="$3"
  printf '### %s\n\n' "$label" >> "$OUT"
  printf -- '- Extraction note: %s\n\n' "$note" >> "$OUT"
  printf '```text\n%s\n```\n\n' "$body" >> "$OUT"
}

render_layout_pages() {
  local pdf="$1"
  local start_page="$2"
  local end_page="$3"
  local colspacing="$4"

  pdftotext -layout -nodiag -nopgbrk -colspacing "$colspacing" -f "$start_page" -l "$end_page" "$pdf" - 2>/dev/null \
    | sed '/^[[:space:]]*[0-9][0-9]*[[:space:]]*$/d'
}

render_layout_page_chars() {
  local pdf="$1"
  local page="$2"
  local colspacing="$3"
  local start_char="$4"
  local end_char="$5"

  pdftotext -layout -nodiag -nopgbrk -colspacing "$colspacing" -f "$page" -l "$page" "$pdf" - 2>/dev/null \
    | cut -c"${start_char}-${end_char}" \
    | sed 's/[[:space:]]*$//'
}

render_layout_page_chars_lines() {
  local pdf="$1"
  local page="$2"
  local colspacing="$3"
  local start_char="$4"
  local end_char="$5"
  local start_line="$6"
  local end_line="$7"

  render_layout_page_chars "$pdf" "$page" "$colspacing" "$start_char" "$end_char" \
    | sed -n "${start_line},${end_line}p"
}

render_layout_page_lines() {
  local pdf="$1"
  local page="$2"
  local colspacing="$3"
  local start_line="$4"
  local end_line="$5"

  pdftotext -layout -nodiag -nopgbrk -colspacing "$colspacing" -f "$page" -l "$page" "$pdf" - 2>/dev/null \
    | nl -ba \
    | sed -n "${start_line},${end_line}p" \
    | sed 's/^[[:space:]]*[0-9][0-9]*[[:space:]]*//'
}

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

render_tsv_cols_pages() {
  local pdf="$1"
  local start_page="$2"
  local end_page="$3"
  local bounds="$4"
  local tmp
  tmp=$(mktemp)
  pdftotext -tsv -f "$start_page" -l "$end_page" "$pdf" "$tmp" 2>/dev/null
  awk -F '\t' -v bounds="$bounds" '
function flush() {
  if (have_line && text != "") {
    col = 1
    n = split(bounds, b, ",")
    for (i = 1; i <= n; i++) if ((line_left + 0) >= (b[i] + 0)) col = i + 1
    printf "%d\t%d\t%f\t%d\t%s\n", page, col, line_top, seq++, text
  }
  text = ""
  have_line = 0
}
NR == 1 { next }
$1 == 1 { flush(); page = $2 + 0; next }
$1 == 4 { flush(); have_line = 1; line_left = $7 + 0; line_top = $8 + 0; text = ""; next }
$1 == 5 && have_line { text = (text == "" ? $12 : text " " $12); next }
END { flush() }
  ' "$tmp" \
    | sort -t $'\t' -k1,1n -k2,2n -k3,3n -k4,4n \
    | cut -f5-
  rm -f "$tmp"
}

render_tsv_cols_pages_anchored() {
  local pdf="$1"
  local start_page="$2"
  local end_page="$3"
  local bounds="$4"
  local anchor="$5"

  render_tsv_cols_pages "$pdf" "$start_page" "$end_page" "$bounds" \
    | awk -v anchor="$anchor" 'started || index($0, anchor) { started=1; print }'
}

render_tsv_cols_pages_anchored_until() {
  local pdf="$1"
  local start_page="$2"
  local end_page="$3"
  local bounds="$4"
  local anchor="$5"
  local stop_anchor="$6"

  render_tsv_cols_pages_anchored "$pdf" "$start_page" "$end_page" "$bounds" "$anchor" \
    | awk -v stop_anchor="$stop_anchor" '
        stopped { next }
        index($0, stop_anchor) { stopped=1; next }
        { print }
      '
}

page_layout_block_named() {
  local label="$1"
  local note="$2"
  local pdf="$3"
  local start_page="$4"
  local end_page="$5"
  local colspacing="$6"

  printf '### %s\n\n' "$label" >> "$OUT"
  printf -- '- Extraction note: %s\n\n' "$note" >> "$OUT"
  printf '```text\n' >> "$OUT"
  render_layout_pages "$pdf" "$start_page" "$end_page" "$colspacing" >> "$OUT"
  printf '\n```\n\n' >> "$OUT"
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

tsv_cols_block_named() {
  local label="$1"
  local note="$2"
  local pdf="$3"
  local start_page="$4"
  local end_page="$5"
  local bounds="$6"
  local anchor="${7:-}"

  printf '### %s\n\n' "$label" >> "$OUT"
  printf -- '- Extraction note: %s\n\n' "$note" >> "$OUT"
  printf '```text\n' >> "$OUT"
  if [ -n "$anchor" ]; then
    render_tsv_cols_pages_anchored "$pdf" "$start_page" "$end_page" "$bounds" "$anchor" >> "$OUT"
  else
    render_tsv_cols_pages "$pdf" "$start_page" "$end_page" "$bounds" >> "$OUT"
  fi
  printf '\n```\n\n' >> "$OUT"
}

tsv_cols_block_named_until() {
  local label="$1"
  local note="$2"
  local pdf="$3"
  local start_page="$4"
  local end_page="$5"
  local bounds="$6"
  local anchor="$7"
  local stop_anchor="$8"

  printf '### %s\n\n' "$label" >> "$OUT"
  printf -- '- Extraction note: %s\n\n' "$note" >> "$OUT"
  printf '```text\n' >> "$OUT"
  render_tsv_cols_pages_anchored_until "$pdf" "$start_page" "$end_page" "$bounds" "$anchor" "$stop_anchor" >> "$OUT"
  printf '\n```\n\n' >> "$OUT"
}

text_anchored_until() {
  local file="$1"
  local start="$2"
  local stop="$3"

  awk -v start="$start" -v stop="$stop" '
    started {
      if (stop != "" && index($0, stop)) exit
      print
      next
    }
    index($0, start) { started = 1; print }
  ' "$file"
}

page_layout_anchor_block_named() {
  local label="$1"
  local note="$2"
  local pdf="$3"
  local start_page="$4"
  local end_page="$5"
  local colspacing="$6"
  local anchor="$7"

  printf '### %s\n\n' "$label" >> "$OUT"
  printf -- '- Extraction note: %s\n\n' "$note" >> "$OUT"
  printf '```text\n' >> "$OUT"

  pdftotext -layout -nodiag -nopgbrk -colspacing "$colspacing" -f "$start_page" -l "$end_page" "$pdf" - 2>/dev/null \
    | sed '/^[[:space:]]*[0-9][0-9]*[[:space:]]*$/d' \
    | awk -v anchor="$anchor" 'started || index($0, anchor) { started=1; print }' \
    >> "$OUT"

  printf '\n```\n\n' >> "$OUT"
}

page_cols_block_named() {
  local label="$1"
  local note="$2"
  local pdf="$3"
  local start_page="$4"
  local end_page="$5"
  shift 5

  printf '### %s\n\n' "$label" >> "$OUT"
  printf -- '- Extraction note: %s\n\n' "$note" >> "$OUT"
  printf '```text\n' >> "$OUT"

  local p spec x y w h
  for p in $(seq "$start_page" "$end_page"); do
    for spec in "$@"; do
      read -r x y w h <<<"$spec"
      pdftotext -nodiag -nopgbrk -f "$p" -l "$p" -x "$x" -y "$y" -W "$w" -H "$h" "$pdf" - 2>/dev/null
      printf '\n'
    done
  done \
    | sed '/^[[:space:]]*[0-9][0-9]*[[:space:]]*$/d' \
    | awk 'BEGIN{blank=0} /^[[:space:]]*$/ {blank++; if (blank <= 1) print ""; next} {blank=0; print}' \
    >> "$OUT"

  printf '```\n\n' >> "$OUT"
}

write_header() {
  local title="$1"
  local pdf="$2"
  cat > "$OUT" <<HDR
# $title

This staging document captures spell material and associated magical-context text from \`$pdf\`.

Rules for this artifact:
- Raw classic terminology is preserved.
- This is a staging artifact, not a final crosswalk.
- \`pdftotext -layout -nodiag -nopgbrk\` remains the primary extractor unless a section note says otherwise.
- Parser warnings from PDF extraction stderr were suppressed and are not part of this document.
- Section methods may mix anchored line slices, page-layout extraction, cropped columns, TSV reflow, and small curated stitching when that is necessary to preserve reading order.
- Cleanup is conservative: spacing, OCR scars, and broken line wraps may be normalized, but source terminology is not converted.

Source PDF:
- \`$pdf\`

## Table Check QA Pass

- Status: pending iterative QA
- Verify all visible tables, spell lists, saving throw matrices, capacity/result tables, and other row/column layouts against source pages.
- Confirm rows are not interleaved across columns, headings stay attached to the correct table, and no row/value pairs are dropped or duplicated.
HDR
}

set_table_qa_note() {
  local file="$1"
  local status="$2"
  local scope="$3"
  local result="$4"
  local old new

  old=$(cat <<'EOF'
## Table Check QA Pass

- Status: pending iterative QA
- Verify all visible tables, spell lists, saving throw matrices, capacity/result tables, and other row/column layouts against source pages.
- Confirm rows are not interleaved across columns, headings stay attached to the correct table, and no row/value pairs are dropped or duplicated.
EOF
)

  new=$(cat <<EOF
## Table Check QA Pass

- Status: $status
- Scope checked: $scope
- Result: $result
EOF
)

  OLD_BLOCK="$old" NEW_BLOCK="$new" perl -0pi -e 'BEGIN { $old = $ENV{OLD_BLOCK}; $new = $ENV{NEW_BLOCK}; } s/\Q$old\E/$new/s' "$file"
}

append_table_qa_lines() {
  local file="$1"
  local extra
  local tmp

  extra=$(cat)
  tmp=$(mktemp)
  awk -v extra="$extra" '
    {
      print
      if (!done && $0 ~ /^- Result:/) {
        print ""
        print extra
        done = 1
      }
    }
  ' "$file" > "$tmp"
  mv "$tmp" "$file"
}

cleanup_output() {
  perl -0pi -e '
  s/DUNGEONS 8c DRAGONS[@”’"]?characters/DUNGEONS & DRAGONS characters/g;
  s/DUNGEONS 8c DRAGONS[@”’"] characters/DUNGEONS & DRAGONS characters/g;
  s/DUNGEONS & DRAGONS[”’"] characters/DUNGEONS & DRAGONS characters/g;
  s/DUNGEONS & DRAGONS[”’"]characters/DUNGEONS & DRAGONS characters/g;
  s/you\x27?1l/you\x27ll/g;
  s/Mag\.ic-User/Magic-User/g;
  s/payier/paper/g;
  s/ma5\$tal/magical/g;
  s/rnust/must/g;
  s/thc3/the/g;
  s/SIcroll/scroll/g;
  s/IElf/elf/g;
  s/polyrnorphed/polymorphed/g;
  s/clericcal/Clerical/g;
  s/Mibunds/Wounds/g;
  s/Moristers/Monsters/g;
  s/D&D\@/D&D/g;
  s/\(C([1-9])\)/\(C $1\)/g;
  s/\(Dr([1-9])\)/\(Dr $1\)/g;
  s/\(MU([1-9])\)/\(MU $1\)/g;
  s/\(C([1-9]), M U ([1-9]) \)/\(C $1, MU $2\)/g;
  s/light \(C l \. M U 1\)/light \(C 1, MU 1\)/g;
  s/Protection from Evil Sleep/Protection from Evil    Sleep/g;
  s/statue for, though/statue form, though/g;
  s/lightning boh/lightning bolt/g;
  s/spellcasters\x27s home/spellcaster\x27s home/g;
  s/will effect an area/will affect an area/g;
  s/1dl2 \+ 20/1d12 + 20/g;
  s/can refers to the tables/can refer to the tables/g;
  s/2 0 \x27 X 2 5 \x27/20\x27 x 25\x27/g;
  s/10\x27X50\x27/10\x27 x 50\x27/g;
  s/6 months\(see below\)/6 months \(see below\)/g;
  s/1 \/ 2 Hit Die/1\/2 Hit Die/g;
  s/saving throw vs\. spells is made at a -4 penalty to/the saving throw vs. spells is made at a -4 penalty to/g;
  s/Duration: 1d10 x 10\(l-l00\) turns or 1 turn/Duration: 1d10 x 10 \(1-100\) turns or 1 turn/g;
  s/1d6\( 1-6\) turns/1d6 \(1-6\) turns/g;
  s/ld4 days/1d4 days/g;
  s/or ld4 rounds/or 1d4 rounds/g;
  s/1d6 \+ l/1d6 + 1/g;
  s/3d6\.3/3d6+3/g;
  s/Duration: 1 turn 1 round per level of caster\.\n\+\nEffect:/Duration: 1 turn + 1 round per level of caster\nEffect:/g;
  s/MAGIC ITEM PRICE SUGGES\x27/MAGIC ITEM PRICE SUGGESTIONS/g;
  s/100t the local magic shop/loot the local magic shop/g;
  s/should not be able to 100t the local magic shop/should not be able to loot the local magic shop/g;
  s/any one creature within IO\x27\. The spell may/any one creature within 10\x27. The spell may/g;
  s/pic-\ntures of creatures within loo\x27, in any area/pic-\ntures of creatures within 100\x27, in any area/g;
  s/pictures of creatures within loo\x27, in any area/pictures of creatures within 100\x27, in any area/g;
  s/wall o f/wall of/g;
  s/wall ofiron/wall of iron/g;
  s/112 damage/1\/2 damage/g;
  s/amount ofelectrical/amount of electrical/g;
  s/pointsofdamage/points of damage/g;
  s/ofdamage/of damage/g;
  s/ifthe/if the/g;
  s/ofthis/of this/g;
  s/ofspell/of spell/g;
  s/scrolI/scroll/g;
  s/spdl/spell/g;
  s/staffdoes/staff does/g;
  s/staffcan/staff can/g;
  s/staffof([a-z])/staff of $1/g;
  s/staff ofhealing/staff of healing/g;
  s/s t a f f/staff/g;
  s/s t a q /staff/g;
  s/ldlO/1d10/g;
  s/SrafE/Staff/g;
  s/loo\x27/100\x27/g;
  s/Farenheit/Fahrenheit/g;
  s/see page ZO/see page 20/g;
  s/1-5076/1-50%/g;
  s/51-7576/51-75%/g;
  s/76-90%/76-90%/g;
  s/25 7%/25%/g;
  s/\b100king into\b/looking into/g;
  s/\b100ks like\b/looks like/g;
  s/\b100ks identi-/looks identi-/g;
  s/\b100ks for\b/looks for/g;
  s/\bb100d\b/blood/g;
  s/\b100p and knot\b/loop and knot/g;
  s/\b100p\b/loop/g;
  s/\b100k into\b/look into/g;
  s/\b100k similar\b/look similar/g;
  s/\b100k and act\b/look and act/g;
  s/\b100k, smell, and taste\b/look, smell, and taste/g;
  s/\b100k\b/look/g;
  s/\bover100ked\b/overlooked/g;
  s/\bf100r\b/floor/g;
  s/\bD&D set\b/D&D@ set/g;
  s/\bs 4 , w 2\b/S4, W2/g;
  s/\bDragon a\b/Dragon a/g;
  s/\bSi0\b/S10/g;
  s/\bW 4\b/W4/g;
  s/\bW 6\b/W6/g;
  s/\bW 8\b/W8/g;
  s/\bNixie e\b/Nixie/g;
  s/\n\x27\nOgre/\nOgre/g;
  s/\n\x27\n/\n/g;
  s/^[\x27`‘’][[:space:]]*\n//mg;
  s/Cure Light Wounds["”]/Cure Light Wounds*/g;
  s/Cure Light Wounds\*[\x80-\xFF]+/Cure Light Wounds*/g;
  s/Cure Light Wounds\*\(B26, X5\)/Cure Light Wounds* \(B26, X5\)/g;
  s/Cure Disease\x27/Cure Disease*/g;
  s/Cure Disease\* \( X6\)/Cure Disease* \(X6\)/g;
  s/Third Level cleric cal Spells/Third Level Clerical Spells/g;
  s/Fourth Level Cler ical Spells/Fourth Level Clerical Spells/g;
  s/Cure Serious W ounds/Cure Serious Wounds/g;
  s/Dispel Magic \(> 8 \)/Dispel Magic \(X8\)/g;
  s/Neutralize poiso \)n/Neutralize poison/g;
  s/Speak with Plan its/Speak with Plants/g;
  s/Fifth Level Cleric\. a1 Spells/Fifth Level Clerical Spells/g;
  s/Create Food \( X 8\)/Create Food \(X8\)/g;
  s/Cure Critical Mi bunds/Cure Critical Wounds/g;
  s/Dispel Evil \(X8: 1/Dispel Evil \(X8\)/g;
  s/Insect Plague \(> 8 \)/Insect Plague \(X8\)/g;
  s/Sixth Level Cleric a1 Spells/Sixth Level Clerical Spells/g;
  s/Find the Path \(: C9\)/Find the Path \(C9\)/g;
  s/Speak with Mor isters/Speak with Monsters/g;
  s/Word of Recall I \(X9\)/Word of Recall \(X9\)/g;
  s/Druid Spells: All i ire usable/Druid Spells: All are usable/g;
  s/Spells Usable b by Wiccas/Spells Usable by Wiccas/g;
  s/Detect Magic \(I %39\)/Detect Magic \(B39\)/g;
  s/Read Language s/Read Languages/g;
  s/Read Magic \(Bx \$0\)/Read Magic \(B40\)/g;
  s/First Level Magic -User Spells/First Level Magic-User Spells/g;
  s/Second Level Mag :ic-User Spells/Second Level Magic-User Spells/g;
  s/Continual Lighi t \*/Continual Light*/g;
  s/Continual Light \* \(B41, X l l \)/Continual Light* \(B41, X11\)/g;
  s/Continual Light\* \(B41, X11 \)/Continual Light* \(B41, X11\)/g;
  s/X l l/X11/g;
  s/\(\s*X11\s*\)/(X11)/g;
  s/Detect Evil \(B4 1\)/Detect Evil \(B41\)/g;
  s/Detect Invisible \(B4\.1\)/Detect Invisible \(B41\)/g;
  s/Invisibility \(B41 \)/Invisibility \(B41\)/g;
  s/Third Level Magi \.c-User Spells/Third Level Magic-User Spells/g;
  s/Clairvoyance \(> \(1 1\)\)/Clairvoyance \(X11\)/g;
  s/Clairvoyance \(>\s*\(1 1\)\)/Clairvoyance \(X11\)/g;
  s/Clairvoyance \(\>\s*\(\s*1\s*1\s*\)\)/Clairvoyance \(X11\)/g;
  s/Clairvoyance \([^\n]*1 1[^\n]*\)/Clairvoyance \(X11\)/g;
  s/Dispel Magic \(I 51 1\)/Dispel Magic \(X11\)/g;
  s/Fire Ball \( X l l \)/Fire Ball \(X11\)/g;
  s/Fire Ball \(\s*X11\s*\)/Fire Ball \(X11\)/g;
  s/Lightning Bolt I \(Xl2\)/Lightning Bolt \(X12\)/g;
  s/Water Breathin! e; \(X12\)/Water Breathing \(X12\)/g;
  s/Fourth Level Mas :ic-User Spells/Fourth Level Magic-User Spells/g;
  s/Charm Monste r/Charm Monster/g;
  s/Growth of Plan ts/Growth of Plants/g;
  s/Massmorph \(X 13\)/Massmorph \(X13\)/g;
  s/Remove Curse\x27 \(X14\)/Remove Curse* \(X14\)/g;
  s/Wall of Fire \( X 14\)/Wall of Fire \(X14\)/g;
  s/Fifth Level Magic :-User Spells/Fifth Level Magic-User Spells/g;
  s/Animate Dead I \(X14\)/Animate Dead \(X14\)/g;
  s/Cloudkill \(X14: 1/Cloudkill \(X14\)/g;
  s/Dissolve\* \(\(220: 1/Dissolve* \(X20\)/g;
  s/Pass-Wall \(X15 \)/Pass-Wall \(X15\)/g;
  s/Wall of Stone \(: Y15\)/Wall of Stone \(X15\)/g;
  s/Char act ers\n//g;
  s/30 \x27\./30\x27./g;
  s/10\s+\x27\s+radius/10\x27 radius/g;
  s/Control Temperature 10 \x27 radius/Control Temperature 10\x27 radius/g;
  s/if the Sav-\ning Throw/if the Saving Throw/g;
  s/69-7 1/69-71/g;
  s/statue\nfor, though/statue form, though/g;
  s/light-\nning boh/light-\nning bolt/g;
  s/spellcas-\nters\x27s home/spellcast-\ner\x27s home/g;
  s/successfully makes a\nsaving throw vs\. spells is made at a -4 penalty to\n/the effects if it successfully makes a\nsaving throw vs. spells at a -4 penalty to\n/g;
  s/may avoid the effects if it successfully makes a\nthe saving throw vs\. spells is made at a -4 penalty to\nthe roll\./may avoid the effects if it successfully makes a\nsaving throw vs. spells at a -4 penalty to\nthe roll./g;
  s/\n[ ]+The cleric can meditate in a certain amount\n\n\[RC page 33: learning spells\]/\n\n[RC page 33: learning spells]/g;
  s/cause critical wounds: cure critical wounds \(reversed\)\n\(C 5\)/cause critical wounds: cure critical wounds \(reversed\) \(C 5\)/g;
  s/cause light wounds: cure light wounds \(reversed\)\n\(C 1\)/cause light wounds: cure light wounds \(reversed\) \(C 1\)/g;
  s/cause serious wounds: cure serious wounds \(reversed\)\n\n\(C 4\)/cause serious wounds: cure serious wounds \(reversed\) \(C 4\)/g;
  s/continual darkness: continual light \(reversed\)\n\(C 3, MU 2\)/continual darkness: continual light \(reversed\) \(C 3, MU 2\)/g;
  s/detect magic \(C 1, MU 1\)\n\ndimension door \(MU 4\)/detect magic \(C 1, MU 1\)\ndimension door \(MU 4\)/g;
  s/magic door \(MU 7\)\n\nmagic jar \(MU 5\)/magic door \(MU 7\)\nmagic jar \(MU 5\)/g;
  s/\n\npower word stun \(MU 7\)/\npower word stun \(MU 7\)/g;
  s/locate object \(C 3, MU 2\)\n\nlore \(MU 7\)/locate object \(C 3, MU 2\)\nlore \(MU 7\)/g;
  s/polymorph self \(MU 4\)\n\npower word blind \(MU 8\)/polymorph self \(MU 4\)\npower word blind \(MU 8\)/g;
  s/There are four types of this scroll; roll\n1d10 to determine the capacity\.\n1-4\n1st or 2nd level spells\n1st to 4th level spells\n5-7\n1st to 6th level spells\n8-9\n1st to 8th level spells\n10\n/There are four types of this scroll; roll 1d10 to determine the capacity.\n\nRoll   Capacity\n1-4    1st or 2nd level spells\n5-7    1st to 4th level spells\n8-9    1st to 6th level spells\n10     1st to 8th level spells\n\n/g;
  s/There are four types of this scroll; roll\n1d10 to determine the capacity:\n1-4\n1st or 2nd level spells\n5-7\n1st to 4th level spells\n8-9\n1st to 6th level spells\n10\n1st to 8th level spells\n/There are four types of this scroll; roll 1d10 to determine the capacity:\n\nRoll   Capacity\n1-4    1st or 2nd level spells\n5-7    1st to 4th level spells\n8-9    1st to 6th level spells\n10     1st to 8th level spells\n\n/g;
  s/There are four types of this scroll; roll\n1d10 to determine the capacity:\n1-4\n1st or 2nd level spells\n5-7\n1st to 4th level spells\n1st to 6th level spells\n8-9\n1st to 8th level spells\n/There are four types of this scroll; roll 1d10 to determine the capacity:\n\nRoll   Capacity\n1-4    1st or 2nd level spells\n5-7    1st to 4th level spells\n8-9    1st to 6th level spells\n10     1st to 8th level spells\n\n/g;
  s/T h e/The/g;
  s/N o/No/g;
  s/P r i m e/Prime/g;
  s/T h r o w s/Throws/g;
  s/hevc:1/level/g;
  s/Cure Light Wounds"/Cure Light Wounds*/g;
  s/Remove Curse"/Remove Curse*/g;
  s/Cure Serious Wounds"/Cure Serious Wounds*/g;
  s/Growth of Plants"/Growth of Plants*/g;
  s/^fly$/Fly/mg;
  s/Cure Light Wounds"\nRange: Touch/Cure Light Wounds*\nRange: Touch/g;
  s/cure 2-7 \( 1d6 \+ 1\) points of damage/cure 2-7 \(1d6 + 1\) points of damage/g;
  s/self \(or herself if desired\./self \(or herself\) if desired./g;
  s/2-7 \( 1d6 \+ 1\) points of damage/2-7 \(1d6 + 1\) points of damage/g;
  s/\bu p\b/up/g;
  s/\bYz\b/1\/2/g;
  s/\bY2\b/1\/2/g;
  s/\+ I\b/+1/g;
  s/theif/thief/g;
  s/a c h u m/charm/g;
  s/a c h a m/charm/g;
  s/barier/barrier/g;
  s/dispel mgk/dispel magic/g;
  s/dispel ma&c/dispel magic/g;
  s/lzght/light/g;
  s/mgz\x27c/magic/g;
  s/exumpk/example/g;
  s/trylng/trying/g;
  s/Thefire/The fire/g;
  s/afire ball/a fire ball/g;
  s/FIlTH/FIFTH/g;
  s/hold momter/hold monster/g;
  s/m g x j a r/magic jar/g;
  s/body Znd/body and/g;
  s/until ,gntil the illusion is touched/until the illusion is touched/g;
  s/Growth of Plants."/Growth of Plants*/g;
  s/Duration: 1 turnilevel/Duration: 1 turn\/level/g;
  s/,gntil/until/g;
  s/Ice Stormiwall/Ice Storm\/Wall/g;
  s/\b2 \+ 1\b/2+1/g;
  s/9- 12/9-12/g;
  s/penalty o n/penalty on/g;
  s/twice the amount\npoints of damage/twice the amount of\npoints of damage/g;
  s/twice the amount of\npoints of damage/twice the amount of damage\n/g;
  s/"enchanted\x27 creatures/"enchanted" creatures/g;
  s/as with charm spell/as with a charm spell/g;
  s/prime requi-\nsite reduced to \$5 normal/prime requi-\nsite reduced to 1\/2 normal/g;
  s/10%chance/10% chance/g;
  s/\?4damage/1\/2 damage/g;
  s/o r /or /g;
  s/a r e/are/g;
  s/l d 6/1d6/g;
  s/l d 8/1d8/g;
  s/l d 1 0/1d10/g;
  s/l d 2 0/1d20/g;
  s/hersel0/herself/g;
  s/mag-\nically/magically/g;
  s/crea-\nture’s/creature’s/g;
  s/a p -\npearance/appearance/g;
  s/‘|’/\x27/g;
  s/“|”/"/g;
  s/Growth of Plants"/Growth of Plants*/g;
  s/"enchanted\x27 creatures/"enchanted" creatures/g;
  s/ u sed / used /g;
  s/ u sed,/ used,/g;
  s/ u sed\./ used./g;
  s/recipients a\n\+\n1 bonus/recipients a\n+1 bonus/g;
  s/gains a\n\+\n2 bonus/gains a\n+2 bonus/g;
  s/“erased,”just/“erased,” just/g;
  s/turns\.\s+The spell/turns. The spell/g;
  s/\n\+\nThe recipient also gains a 2 bonus/\nThe recipient also gains a +2 bonus/g;
  s/\n\+\nally favorable \( 2 bonus to reaction roll\),/\nusually favorable \(\+2 bonus to reaction roll\),/g;
  s/^DUNGEONS .*characters \(character class - human\)[[:space:]]*\n//mg;
  s/^Character Classes - ?Human[[:space:]]*\n//mg;
  s/^(Characters|Treasures|Procedures)[[:space:]]*\n//mg;
  s/^a n a is anic to[[:space:]]*\n//mg;
  s/^[[:space:]]*[0-9][0-9]*[[:space:]]*\n//mg;
  s/\n\+\nDuration: 6 turns 1 turn per Level of/\nDuration: 6 turns + 1 turn per Level of/g;
  s/\n\+\nDuration: 1-6 turns 1 turn per level of/\nDuration: 1-6 turns + 1 turn per level of/g;
  s/\n\+\nDuration: 6 turns 1 turn per level of/\nDuration: 6 turns + 1 turn per level of/g;
  s/\n\+\ngains a 1 bonus/\ngains a +1 bonus/g;
  s/\n\+\ntures with 4 1 Hit Dice or less/\ncreatures with 4\+1 Hit Dice or less/g;
  s/\n\+\nless than 2 1 Hit Dice are not allowed a/\nless than 2\+1 Hit Dice are not allowed a/g;
  s/affect crea-\ncreatures with 4\+1 Hit Dice or less/affect creatures with 4+1 Hit Dice or less/g;
  s/Range: 60[‘’']\n\+\n10[‘’'] per Level of the\nmagic-user/Range: 60'\'' + 10'\'' per Level of the\nmagic-user/g;
  s/mgz. c/magic/g;
  s/mgz. c are/magic are/g;
  s/exumpk/example/g;
  s/trylng/trying/g;
  s/Thefire/The fire/g;
  s/afire ball/a fire ball/g;
  s/c h a m/charm/g;
  s/m g x j a r/magic jar/g;
  # General: OCR lowercase-l swapped for digit-1 in dice notation (ld6, ld6T, ld4r etc.)
  s/\bld([0-9]+)/1d$1/g;
  # General: split "H D" from three-column PDF extraction (16 H D -> 16 HD)
  s/\b([0-9\/]+) H D\b/$1 HD/g;
  s/\bH D\b/HD/g;
  # General: common short-word column splits
  s/ o f / of /g;
  s/\bi f\b/if/g;
  s/\bi t\b/it/g;
  # Companion item-description column-split regressions
  s/6-2 1\b/6-21/g;
  s/\(1d8\.5\)/(1d8+5)/g;
  s/rod 4 , and inflicts/rod +4, and inflicts/g;
  s/ring ofprotection \+[f1]/ring of protection +1/g;
  s/Protection e l , \x272, \x273, or \+4\)/Protection (+1, +2, +3, or +4)/g;
  s/ \+f\b/ +1/g;
  s/\bsuccessfull\b/successful/g;
  s/: 1-4 \x271; 5-7 = 2; 8-9 = 3; 10 = 4\./: 1-4 = 1; 5-7 = 2; 8-9 = 3; 10 = 4./g;
  # Master artifact power table column-split regressions
  s/missiles, 1d6 \+ 1\n\s+D each;/missiles, 1d6 + 1 damage each;/g;
  s/EF 1 pth,/EF 1 pt,/g;
  s/7 \+ ; X16\)/7+; X16)/g;
  s/1d20, subtracts any/1d20, subtract any/g;
  # Master named-artifact catalog OCR cleanup
  s/\birito\b/into/g;
  s/\bMag;ic\b/Magic/g;
  s/\b10 7%\b/10%/g;
  s/\biirtifact\b/artifact/g;
  s/\bRechiarging\b/Recharging/g;
  s/\bVal1ue\b/Value/g;
  s/\bfriom\b/from/g;
  s/the: user acquires/the user acquires/g;
  s/\bChaotiIC\b/Chaotic/g;
  s/\brecharced\b/recharged/g;
  s/\bfir:st\b/first/g;
  s/\brequirir ig\b/requiring/g;
  s/\bArt ifacts\b/Artifacts/g;
  s/\b1the\b/the/g;
  s/\bgerieral\b/general/g;
  s/\b4lA\b/4\/A/g;
  s/\b3lB\b/3\/B/g;
  s/\b41D\b/4\/D/g;
  s/\bYour No:\b/Your Notes:/g;
  s/\n{3,}/\n\n/g;
' "$OUT"
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
    | awk 'started || /Spell Books:/ { started = 1; print }' \
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

basic_higher_level_spells_block_named() {
  local label="$1"
  local note="$2"

  printf '### %s\n\n' "$label" >> "$OUT"
  printf -- '- Extraction note: %s\n\n' "$note" >> "$OUT"
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

  printf '### %s\n\n' "$label" >> "$OUT"
  printf -- '- Extraction note: %s\n\n' "$note" >> "$OUT"
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

[Basic treasure pages 42-45: item operation, potions, wands, staves, rods, and miscellaneous devices]
Identifying Magic Items

The only way to identify exactly what an item does is by testing it: trying on the ring, sipping the potion, and so forth. If a retainer does this testing, the retainer will expect to keep the item. A high level NPC magic-user may be asked to identify an item, but will want money or a service in advance and may take several weeks of game time to do it.

Types of Magic Items

There are two basic types of magic items:
- Permanent items, which are not used up, such as swords and armor
- Temporary items, which are used either once, such as potions, or one charge at a time, such as wands

Using Magic Items

Any magic item must be properly used to have any effect. A magic shield has no effect unless it is carried normally, and a ring must be worn on a finger to gain its magical effect.

Some Permanent items are simply for protection. No concentration is required to use these items. Magic weapons also function automatically.

All Temporary items are either consumed by drinking or eating, or used by concentrating. If not consumed, the item must be held while the user concentrates. While using the item, the user may not move, cast a spell, or take any other action during that round.

Charges in Magic Items

Many Temporary items have a limited number of charges or uses. When the last charge is used, the item is no longer magical. It is not possible to find out how many charges an item has, and such items cannot be recharged.

Additional Consumables

Holy Water: This is water specially prepared by a cleric for use against undead creatures. It can be used by any character. Holy Water must be kept in small, specially prepared glass bottles known as vials for it to remain Holy. The effect of one vial of Holy Water on an undead creature is 1-8 points of damage. To cause damage, it must successfully strike the target, thus breaking the vial. It may either be thrown using missile fire rules or used in hand-to-hand combat using normal combat rules.

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
  render_tsv_cols_pages_anchored_until "$pdf" 5 6 '185,370' 'Cleric' 'Characters - Cleric, Druid' \
    | awk 'started || /^Survival$/ { started = 1; print }' >> "$OUT"
  printf '\n[Master pages 6-7: druid spell material]\n' >> "$OUT"
  render_tsv_cols_pages_anchored_until "$pdf" 6 7 '185,370' 'Druid' 'Characters - Fighter, Magic-User' >> "$OUT"
  printf '\n[Master pages 8-10: magic-user spell material]\n' >> "$OUT"
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
  render_tsv_cols_pages_anchored_until "$pdf" 8 10 '185,370' 'Magic-user' 'Weapon Mastery' \
    | awk 'started || /^Clone$/ { started = 1; print }' >> "$OUT"
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
  render_tsv_cols_pages_anchored_until "$pdf" 59 61 '185,370' 'A non-human cleric or druid is known as a' 'UNDEAD ATTEMPTS To CONTROL O T H E R UNDEAD' >> "$OUT"
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

master_artifacts_block_named() {
  local label="$1"
  local note="$2"
  local pdf="$3"
  local page
  local source_page

  printf '### %s\n\n' "$label" >> "$OUT"
  printf -- '- Extraction note: %s\n\n' "$note" >> "$OUT"
  printf '```text\n' >> "$OUT"
  printf '[Master artifact pages 45-47: doctrine overview and creation rules]\n' >> "$OUT"
  {
    pdftotext -nodiag -nopgbrk -f 83 -l 83 -x 0 -y 40 -W 185 -H 700 "$pdf" - 2>/dev/null
    printf '\n'
    pdftotext -nodiag -nopgbrk -f 83 -l 83 -x 200 -y 40 -W 185 -H 700 "$pdf" - 2>/dev/null
    printf '\n'
    render_layout_page_chars "$pdf" 83 0.2 104 180 \
      | sed \
          -e '1{/^[[:space:]]*Art[[:space:]]*ifact[[:space:]]*s[[:space:]]*$/d;}' \
          -e 's/^[[:space:]]*item should activate when picked up/The item should activate when picked up/' \
          -e 's/^[[:space:]]*Fighter\./fighter./'
    printf '\n'
    render_layout_page_chars "$pdf" 84 0.2 1 52
    printf '\n'
    render_layout_page_chars "$pdf" 84 0.2 53 104 | sed '/^[[:space:]]*46[[:space:]]*$/d'
    printf '\n'
    render_layout_page_chars "$pdf" 84 0.2 104 180
    printf '\n'
    render_layout_page_chars "$pdf" 85 0.2 1 52
    printf '\n'
    render_layout_page_chars "$pdf" 85 0.2 53 104
    printf '\n'
    render_layout_page_chars "$pdf" 85 0.2 104 180 | sed '1{/^[[:space:]]*Artifacts[[:space:]]*$/d;}'
    printf '\n'
  } \
    | sed '/^[[:space:]]*[0-9][0-9]*[[:space:]]*$/d' \
    | awk 'started || /This section introduces the greatest and most/ { started = 1; print }' \
    | sed \
        -e '/^[[:space:]]*Artifacts[[:space:]]*$/d' \
        -e 's/\ba n artifact\b/an artifact/g' \
        -e 's/\bfunctionof\b/function of/g' \
        -e 's/\beffectand\b/effect and/g' \
        -e 's/area o f effect/area of effect/g' \
        -e 's/\bpowcr\b/power/g' \
        -e 's/\bseventy of the/severity of the/g' \
        -e 's/Damage to a n artifact/Damage to an artifact/g' \
        -e 's/might-such[[:space:]]\+as/might-such as/g' \
    >> "$OUT"
  printf '\n[Master artifact pages 48-54: power tables and artifact effect descriptions]\n' >> "$OUT"
  for page in $(seq 86 92); do
    source_page=$((page - 38))
    printf '\n[Master artifact page %s]\n' "$source_page"
    pdftotext -layout -nodiag -nopgbrk -f "$page" -l "$page" -x 10 -y 40 -W 185 -H 730 "$pdf" - 2>/dev/null
    printf '\n'
    pdftotext -layout -nodiag -nopgbrk -f "$page" -l "$page" -x 200 -y 40 -W 185 -H 730 "$pdf" - 2>/dev/null
    printf '\n'
    pdftotext -layout -nodiag -nopgbrk -f "$page" -l "$page" -x 390 -y 40 -W 180 -H 730 "$pdf" - 2>/dev/null
    printf '\n'
  done \
    | sed '/^[[:space:]]*[0-9][0-9]*[[:space:]]*$/d' \
    | sed '/^[[:space:]]*Artifacts[[:space:]]*$/d' \
    | awk 'BEGIN{blank=0} /^[[:space:]]*$/ {blank++; if (blank <= 1) print ""; next} {blank=0; print}' \
    >> "$OUT"

  printf '\n```\n\n' >> "$OUT"
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

BASIC_TXT="$TMPDIR/basic.txt"
EXPERT_TXT="$TMPDIR/expert.txt"
COMP_TXT="$TMPDIR/companion.txt"
MASTER_TXT="$TMPDIR/master.txt"
IMM_TXT="$TMPDIR/immortals.txt"
RC_TXT="$TMPDIR/rc.txt"

BASIC_PDF="$ROOT/_becmi/TSR 1011B - Set 1 Basic Rules.pdf"
EXPERT_PDF="$ROOT/_becmi/TSR 1012B - Set 2 Expert Rules.pdf"
COMP_PDF="$ROOT/_becmi/TSR 1013 - Set 3 Companion Set.pdf"
MASTER_PDF="$ROOT/_becmi/TSR 1021 - Set 4 Master Rules.pdf"
IMM_PDF="$ROOT/_becmi/TSR 1017 - Set 5 Immortals Rules.pdf"
RC_PDF="$ROOT/_becmi/TSR 1071 - The D&D Rules Cyclopedia.pdf"

INDEX_OUT="$ROOT/_todo/TODO_BECMI_Spell_Material_Staging.md"
BASIC_OUT="$ROOT/_todo/TODO_BECMI_Spell_Material_Staging_Basic.md"
EXPERT_OUT="$ROOT/_todo/TODO_BECMI_Spell_Material_Staging_Expert.md"
COMP_OUT="$ROOT/_todo/TODO_BECMI_Spell_Material_Staging_Companion.md"
MASTER_OUT="$ROOT/_todo/TODO_BECMI_Spell_Material_Staging_Master.md"
IMM_OUT="$ROOT/_todo/TODO_BECMI_Spell_Material_Staging_Immortals.md"
RC_OUT="$ROOT/_todo/TODO_BECMI_Spell_Material_Staging_Rules_Cyclopedia.md"

extract_pdf "$BASIC_PDF" "$BASIC_TXT"
extract_pdf "$EXPERT_PDF" "$EXPERT_TXT"
extract_pdf "$COMP_PDF" "$COMP_TXT"
extract_pdf "$MASTER_PDF" "$MASTER_TXT"
extract_pdf "$IMM_PDF" "$IMM_TXT"
extract_pdf "$RC_PDF" "$RC_TXT"

OUT="$BASIC_OUT"
write_header 'TODO: BECMI Spell Material Staging - Basic' 'TSR 1011B - Set 1 Basic Rules.pdf'
basic_cleric_rules_block_named 'Cleric Rules, Turning, and First-Level Spell Procedures' 'page-aware Basic extraction from the actual cleric special-abilities page, split by column so Turning Undead procedure, the undead table, and spellcasting guidance stay in readable source order.' "$BASIC_PDF"
basic_spell_lists_and_descriptions_block_named 'Spell Lists and Basic Spell Descriptions' 'iterative Basic extraction: the page 35 spell-list page is rebuilt as a curated readable list from the source page, the clerical description pages use TSV column reflow, and the magic-user spell-book plus spell-description pages now use page-aware TSV reflow instead of the earlier anchored text slice.' "$BASIC_PDF"
basic_higher_level_spells_block_named 'Higher Level Spells, Magic-User Spell Allocation, and Lost Spell Books' 'curated Basic reconstruction from DM pages 17-18 for higher-level cleric and magic-user spell guidance, plus a short player-facing spell-book/lost-book carryover from the earlier magic-user section so this staging block keeps the spell-allocation and lost-book procedures attached to the higher-level guidance.'
basic_scrolls_block_named 'Scrolls and Spell-Adjacent Treasure Text' 'curated Basic reconstruction from treasure pages 42-45, combining the scroll/ring material with the surrounding item-operation rules that matter for later spell and magic-item curation: identification, permanent vs. temporary behavior, concentration and charge rules, potion duration and interaction rules, wand/staff/rod use restrictions, and selected miscellaneous devices with strong spell-adjacent procedures.'
cleanup_output
set_table_qa_note "$BASIC_OUT" 'reviewed 2026-03-22; confidence survey updated 2026-03-23' 'Turning Undead table, spell lists, and adjacent structured spell-property blocks.' 'no blocking row/column defects found in the visible Basic table and list regions.'
append_table_qa_lines "$BASIC_OUT" <<'EOF'
- Capture confidence: **0.93**
- Coverage note: Player spell content, DM higher-level spell guidance, lost spell books, and scroll/ring/item-operation procedures are all staged from the Basic source. Remaining issues are OCR texture and ordinary line-wrap scars, not structural coverage gaps.
- ToC cross-check: Basic spell and treasure sections remain fully accounted for in staging, including player spell pages, DM higher-level spell guidance, and the treasure/magic-item wrapper pages.
- Gap priority: LOW — no material source-evidence gap found during the 2026-03-23 survey.
EOF

OUT="$EXPERT_OUT"
write_header 'TODO: BECMI Spell Material Staging - Expert' 'TSR 1012B - Set 2 Expert Rules.pdf'
expert_spell_expansions_block_named 'Clerical and Magic-User Spell Expansions' 'stitched Expert spell extraction: clerical spell pages 7-11 and magic-user spell pages 13-18 use separate TSV coordinate reflow passes so the real spell sections stay in source order and the intervening fighter/thief class tables are excluded.' "$EXPERT_PDF"
expert_research_block_named 'Research and Lost Spell Books' 'curated Expert reconstruction from pages 27-28, replacing the contaminated line-range slice with the actual research procedures, item-creation examples, and lost spell-book recovery guidance.'
expert_magic_items_block_named 'Scrolls, Rings, Wands, Staves, Rods, and Spell-Adjacent Treasure Text' 'curated Expert reconstruction from treasure pages 60-65, combining cursed-item doctrine, general magic-item operation notes, scroll procedures, ring procedures, wand/staff/rod procedures, and selected miscellaneous magic items with strong spell-adjacent relevance.'
cleanup_output
set_table_qa_note "$EXPERT_OUT" 'reviewed 2026-03-22; confidence survey updated 2026-03-23' 'leveled spell lists, spell-expansion sections, and structured spell-property blocks.' 'no blocking row/column defects found in the visible Expert table and list regions.'
append_table_qa_lines "$EXPERT_OUT" <<'EOF'
- Capture confidence: **0.89**
- Coverage note: Core Expert cleric and magic-user spell expansions, research, and lost-book procedures are staged cleanly. The miscellaneous magic-item run is intentionally selective rather than exhaustive, with RC acting as the canonical item-property backstop for omitted non-spell-adjacent entries.
- ToC cross-check: Expert CONTENTS review found the spell sections and research/lost-book procedures accounted for. The remaining omission is partial coverage of the page 65 miscellaneous magic-item list.
- Gap priority: MEDIUM-LOW — remaining gap is secondary item-catalog completeness, not core spell procedure coverage.
EOF
perl -0pi -e 's/any one creature within IO\x27\. The spell may/any one creature within 10\x27. The spell may/g;' "$EXPERT_OUT"

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

OUT="$MASTER_OUT"
write_header 'TODO: BECMI Spell Material Staging - Master' 'TSR 1021 - Set 4 Master Rules.pdf'
master_spell_block_named 'Master Cleric, Druid, and Magic-User Spell Material' 'section-aware Master spell extraction using anchored TSV reflow across the actual cleric, druid, and magic-user pages instead of one broad line-range block. The section is split into cleric, druid, and magic-user sub-blocks so high-level spell lists and descriptions remain attached to the right class pages.' "$MASTER_PDF"
master_nonhuman_block_named 'Non-Human Spellcasters and Special Spellcaster Procedures' 'section-aware Master extraction using anchored TSV reflow across the actual Spell Casters (Non-Human), special monster spellcaster, undead spellcaster, and undead-control pages instead of the earlier broad procedures slice.' "$MASTER_PDF"
master_procedures_block_named 'Anti-Magic Effects and Dispel Magic Procedures' 'targeted Master procedures extraction using column crops from the actual Procedures pages so the anti-magic doctrine, examples, touch-dispel rules, and item-interaction notes remain readable without the section index or dominion spill.' "$MASTER_PDF"
master_artifacts_block_named 'Artifact Power Doctrine and Artifact Effect Procedures' 'final targeted Master addition from the actual artifact-doctrine pages, capturing artifact purpose, activation, power limits, recharging, intelligence, adverse effects, attack/destruction rules, and power-category guidance that Immortals explicitly relies on for non-spell magical effects. The named-artifact catalog is emitted separately below as its own staged section.' "$MASTER_PDF"
master_named_artifacts_block_named 'Named Artifact Catalog' 'targeted Master expansion across the known-artifact catalog pages, now rebuilt as a curated source-derived block so the full artifact packaging, activation framing, power bundles, drawbacks, and reference notes remain readable and complete as source evidence.' "$MASTER_PDF"
master_other_magic_items_block_named 'Other Legendary Magic Items Appendix' 'targeted Master appendix addition from pages 63-64, curating the post-catalog legendary-item list so mythic item seeds and reference examples remain attached to the artifact section as readable source evidence.' "$MASTER_PDF"
cleanup_output
set_table_qa_note "$MASTER_OUT" 'reviewed 2026-03-22; confidence survey updated 2026-03-23' 'cleric and magic-user experience tables, saving throw matrices, turning tables, and artifact power tables.' 'the top cleric and magic-user matrices are now reconstructed into readable text tables, and no blocking row/column defects remain in the reviewed Master table regions.'
append_table_qa_lines "$MASTER_OUT" <<'EOF'
- Capture confidence: **0.95** (UP from 0.91 after staging the Master procedure gap)
- Coverage note: Master spell lists, non-human spellcaster procedures, anti-magic doctrine, dispel/item-interaction procedures, artifact doctrine, named artifacts, and the post-catalog appendix are now staged from Master source text. Remaining issues are ordinary OCR texture and later cleanup, not major source-evidence gaps.
- ToC cross-check: Core spell, procedures, and artifact sections are now accounted for in the Master lane, including `Anti-Magic Effects` and `Dispel Magic` from the Procedures section.
- Gap priority: LOW — the previously documented Master procedure gap is closed.
EOF
perl -0pi -e '
  s/^\x27[[:space:]]*\n//mg;
  s/\(B41, X11 \)/\(B41, X11\)/g;
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
' "$MASTER_OUT"

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

OUT="$RC_OUT"
write_header 'TODO: BECMI Spell Material Staging - Rules Cyclopedia' 'TSR 1071 - The D&D Rules Cyclopedia.pdf'
mixed_chapter3_block_named 'Chapter 3: Spells and Spellcasting' 'hybrid RC extraction: pages 33-34 are split into labeled layout-column slices for readable setup prose and spell-list presentation, while pages 35-59 use TSV coordinate reflow with three reading-order columns to eliminate left/right interleave in spell descriptions.' "$RC_PDF"
mixed_monster_spellcasters_block_named 'Monster Spellcasters' 'hybrid RC extraction: page 215 uses TSV coordinate reflow for prose, page 216 is rebuilt from separate coordinate-driven table, right-column spell-list, and left-column notes extracts, and page 217 returns to TSV reflow plus a preserved layout splice for the undead-control table.' "$RC_PDF"
tsv_cols_block_named 'Scrolls' 'TSV coordinate reflow across the RC scroll section to remove three-column interleave while preserving bullet lists and long descriptions.' "$RC_PDF" 234 235 '185,370' 'Scrolls'
tsv_cols_block_named 'Spell Research' 'anchored TSV coordinate reflow from the actual RC spell-research page to replace the earlier mis-extracted line-range block.' "$RC_PDF" 255 255 '185,370' 'Spell Research'
rc_item_enchantment_block_named 'Magic Item Enchantment, Recharging, and Item Damage Procedures' 'targeted RC Chapter 16 and procedure-layer addition from the magical-item creation pages plus the dedicated item-damage page, capturing spell-effect requirements, specialist and component requirements, chance of success, enchantment time, multiple-enchantment handling, recharge costs, dispel relevance, and damage/destruction handling for magical items.' "$RC_PDF"
rc_constructs_block_named 'Construct Enchantment and Magical Constructs' 'targeted RC Chapter 16 addition from the actual Magical Constructs pages, capturing construct creation prerequisites, spell gates, cost and time, success chance, HD and immunity guidance, healing rules, damage ceilings, reproduction limits, special attacks, and the nondispellable-frame requirement referenced by Create Any Monster.' "$RC_PDF"
tsv_cols_block_named_until 'Chapter 16 Item Description Catalog (Potions, Wands/Staves/Rods, Rings, Miscellaneous Items, and Swords)' 'anchored TSV coordinate reflow across RC Chapter 16 item-description pages, starting at the Potions heading and stopping before the Chapter 16 wrap-up/cashout section to preserve the canonical item-property descriptions in reading order.' "$RC_PDF" 232 249 '185,370' 'Potions' 'Cashing Treasure'
page_cols_block_named 'Index to Spells' 'three-column extraction from the RC appendix index page using cropped per-column text to preserve alphabetical reading order.' "$RC_PDF" 300 300 "15 15 175 770" "195 15 180 770" "380 15 175 770"
cleanup_output
set_table_qa_note "$RC_OUT" 'reviewed 2026-03-22; confidence survey updated 2026-03-23' 'clerical, magical, and druidic spell lists plus the later reconstructed spellcaster and scroll tables.' 'no blocking row/column defects found in the visible Rules Cyclopedia table and list regions.'
append_table_qa_lines "$RC_OUT" <<'EOF'
- Capture confidence: **0.95** (UP from 0.90 after staging the RC Chapter 16 item-description catalog)
- Coverage note: RC spell descriptions, research, scrolls, item enchantment, construct procedures, and the Chapter 16 item-description catalog (potions, wands/staves/rods, rings, miscellaneous items, swords) are now staged from RC source text. Remaining concerns are OCR texture and optional cleanup, not source-evidence coverage gaps.
- ToC cross-check: RC Chapter 16 procedure and item-description sections are now represented in staging, including the item-property description run that was previously missing.
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
' "$RC_OUT"

cat > "$INDEX_OUT" <<'HDR'
# TODO: BECMI Spell Material Staging

This staging corpus is now split into one file per source book.

Active staging files:
- `TODO_BECMI_Spell_Material_Staging_Basic.md`
- `TODO_BECMI_Spell_Material_Staging_Expert.md`
- `TODO_BECMI_Spell_Material_Staging_Companion.md`
- `TODO_BECMI_Spell_Material_Staging_Master.md`
- `TODO_BECMI_Spell_Material_Staging_Immortals.md`
- `TODO_BECMI_Spell_Material_Staging_Rules_Cyclopedia.md`

Notes:
- Basic and Expert were upgraded in this phase with cleaner section boundaries and more selective extraction modes.
- Companion, Master, Immortals, and Rules Cyclopedia remain available as separate staging files under the same naming scheme.
- This index file is a manifest only; the source text now lives in the per-book staging files.
HDR
