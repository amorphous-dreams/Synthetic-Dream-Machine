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

render_layout_pages_anchored() {
  local pdf="$1"
  local start_page="$2"
  local end_page="$3"
  local colspacing="$4"
  local anchor="$5"

  render_layout_pages "$pdf" "$start_page" "$end_page" "$colspacing" \
    | awk -v anchor="$anchor" 'started || index($0, anchor) { started=1; print }'
}

render_layout_pages_anchored_until() {
  local pdf="$1"
  local start_page="$2"
  local end_page="$3"
  local colspacing="$4"
  local anchor="$5"
  local stop_anchor="$6"

  render_layout_pages_anchored "$pdf" "$start_page" "$end_page" "$colspacing" "$anchor" \
    | awk -v stop_anchor="$stop_anchor" '
        stopped { next }
        index($0, stop_anchor) { stopped=1; next }
        { print }
      '
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
    if (text ~ /^[0-9]+$/ && (line_top + 0) >= 720) {
      text = ""
      have_line = 0
      return
    }
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

render_tsv_col_pages() {
  local pdf="$1"
  local start_page="$2"
  local end_page="$3"
  local bounds="$4"
  local target_col="$5"
  local tmp
  tmp=$(mktemp)
  pdftotext -tsv -f "$start_page" -l "$end_page" "$pdf" "$tmp" 2>/dev/null
  awk -F '\t' -v bounds="$bounds" -v target_col="$target_col" '
function flush() {
  if (have_line && text != "") {
    if (text ~ /^[0-9]+$/ && (line_top + 0) >= 720) {
      text = ""
      have_line = 0
      return
    }
    col = 1
    n = split(bounds, b, ",")
    for (i = 1; i <= n; i++) if ((line_left + 0) >= (b[i] + 0)) col = i + 1
    if (col == target_col) {
      printf "%d\t%f\t%d\t%s\n", page, line_top, seq++, text
    }
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
    | sort -t $'\t' -k1,1n -k2,2n -k3,3n \
    | cut -f4-
  rm -f "$tmp"
}

render_tsv_col_pages_anchored() {
  local pdf="$1"
  local start_page="$2"
  local end_page="$3"
  local bounds="$4"
  local target_col="$5"
  local anchor="$6"

  render_tsv_col_pages "$pdf" "$start_page" "$end_page" "$bounds" "$target_col" \
    | awk -v anchor="$anchor" 'started || index($0, anchor) { started=1; print }'
}

render_tsv_col_pages_anchored_until() {
  local pdf="$1"
  local start_page="$2"
  local end_page="$3"
  local bounds="$4"
  local target_col="$5"
  local anchor="$6"
  local stop_anchor="$7"

  render_tsv_col_pages_anchored "$pdf" "$start_page" "$end_page" "$bounds" "$target_col" "$anchor" \
    | awk -v stop_anchor="$stop_anchor" '
        stopped { next }
        index($0, stop_anchor) { stopped=1; next }
        { print }
      '
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

text_substring_anchored_until() {
  local file="$1"
  local start="$2"
  local stop="$3"

  awk -v start="$start" -v stop="$stop" '
    started {
      if (stop != "" && index($0, stop)) exit
      print
      next
    }
    index($0, start) {
      started = 1
      print substr($0, index($0, start))
    }
  ' "$file"
}

fail_staging_validation() {
  local message="$1"
  printf 'staging validation failed: %s\n' "$message" >&2
  exit 1
}

assert_file_contains() {
  local file="$1"
  local pattern="$2"
  local description="$3"

  if ! rg -q --multiline "$pattern" "$file"; then
    fail_staging_validation "$description"
  fi
}

assert_file_not_contains() {
  local file="$1"
  local pattern="$2"
  local description="$3"

  if rg -q --multiline "$pattern" "$file"; then
    fail_staging_validation "$description"
  fi
}

assert_heading_count() {
  local file="$1"
  local heading="$2"
  local expected_count="$3"
  local description="$4"
  local actual_count

  actual_count=$(rg -c "^### ${heading}\$" "$file")
  if [ "$actual_count" -ne "$expected_count" ]; then
    fail_staging_validation "$description (expected $expected_count, found $actual_count)"
  fi
}

section_between_markers_to_tmp() {
  local file="$1"
  local start_marker="$2"
  local stop_marker="$3"
  local tmp

  tmp=$(mktemp)
  awk -v start_marker="$start_marker" -v stop_marker="$stop_marker" '
    started {
      if (stop_marker != "" && index($0, stop_marker)) exit
      print
      next
    }
    index($0, start_marker) { started = 1; print }
  ' "$file" > "$tmp"
  printf '%s\n' "$tmp"
}

assert_section_contains() {
  local file="$1"
  local start_marker="$2"
  local stop_marker="$3"
  local pattern="$4"
  local description="$5"
  local tmp

  tmp=$(section_between_markers_to_tmp "$file" "$start_marker" "$stop_marker")
  if ! rg -q --multiline "$pattern" "$tmp"; then
    rm -f "$tmp"
    fail_staging_validation "$description"
  fi
  rm -f "$tmp"
}

assert_section_not_contains() {
  local file="$1"
  local start_marker="$2"
  local stop_marker="$3"
  local pattern="$4"
  local description="$5"
  local tmp

  tmp=$(section_between_markers_to_tmp "$file" "$start_marker" "$stop_marker")
  if rg -q --multiline "$pattern" "$tmp"; then
    rm -f "$tmp"
    fail_staging_validation "$description"
  fi
  rm -f "$tmp"
}

assert_patterns_in_order() {
  local file="$1"
  local description="$2"
  shift 2

  python3 - "$file" "$description" "$@" <<'PY'
import re
import sys

path = sys.argv[1]
description = sys.argv[2]
patterns = sys.argv[3:]

with open(path, "r", encoding="utf-8") as fh:
    text = fh.read()

pos = 0
for pattern in patterns:
    match = re.search(pattern, text[pos:], re.MULTILINE)
    if not match:
        print(f"staging validation failed: {description} (missing or out of order: {pattern})", file=sys.stderr)
        sys.exit(1)
    pos += match.end()
PY
}

assert_section_patterns_in_order() {
  local file="$1"
  local start_marker="$2"
  local stop_marker="$3"
  local description="$4"
  shift 4
  local tmp

  tmp=$(section_between_markers_to_tmp "$file" "$start_marker" "$stop_marker")
  assert_patterns_in_order "$tmp" "$description" "$@"
  rm -f "$tmp"
}

assert_section_count_at_least() {
  local file="$1"
  local start_marker="$2"
  local stop_marker="$3"
  local pattern="$4"
  local minimum="$5"
  local description="$6"
  local tmp
  local count

  tmp=$(section_between_markers_to_tmp "$file" "$start_marker" "$stop_marker")
  count=$(rg -c --multiline "$pattern" "$tmp" || true)
  rm -f "$tmp"
  if [ "$count" -lt "$minimum" ]; then
    fail_staging_validation "$description (expected at least $minimum, found $count)"
  fi
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

## Audit Rubric

- Coverage: the staged block should account for the claimed source section without silently dropping major witnesses.
- Reading order: columns, tables, and continuation text should preserve source order rather than left/right interleave.
- Continuation: multi-page and multi-column blocks should retain start, middle, and end states without orphaned fragments.
- Table/list survivability: representative table rows and list entries should remain readable and attached to the correct headings.
- Manual-reconstruction burden: curated or stitched text should be minimized, reproducible, and explicitly validated when unavoidable.

HDR
}

apply_common_safe_cleanup() {
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

apply_common_ocr_rescue() {
  perl -0pi -e '
  s/\x{2018}|\x{2019}/'\''/g;
  s/\x{201C}|\x{201D}/"/g;
  s/\bld([0-9]+)\b/1d$1/g;
  s/\bloo\x27/100\x27/g;
  s/\bloo\b/100/g;
  s/\n\+\n([0-9])/\n+$1/g;
  s/\b([[:alpha:]])-\n([[:alpha:]])\b/$1$2/g;
  s/\b([[:alpha:]])\s{2,}([[:alpha:]])\b/$1 $2/g;
  s/\b([[:alpha:]]) ([[:alpha:]]) ([[:alpha:]])\b/$1$2$3/g if /(?:^|\n)(?:[A-Z][a-z]+|[a-z]+) (?:[A-Z][a-z]+|[a-z]+) (?:[A-Z][a-z]+|[a-z]+)/;
  ' "$OUT"
}

cleanup_output() {
  apply_common_safe_cleanup
  apply_common_ocr_rescue
}


if [[ "${BECMI_STAGING_HELPERS_ONLY:-0}" == "1" ]]; then
  return 0 2>/dev/null || exit 0
fi

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)

bash "$SCRIPT_DIR/build_becmi_spell_staging_basic.sh"
bash "$SCRIPT_DIR/build_becmi_spell_staging_expert.sh"
bash "$SCRIPT_DIR/build_becmi_spell_staging_companion.sh"
bash "$SCRIPT_DIR/build_becmi_spell_staging_master.sh"
bash "$SCRIPT_DIR/build_becmi_spell_staging_immortals.sh"
bash "$SCRIPT_DIR/build_becmi_spell_staging_rc.sh"

python3 "$SCRIPT_DIR/build_becmi_spell_staging_multi.py" write
