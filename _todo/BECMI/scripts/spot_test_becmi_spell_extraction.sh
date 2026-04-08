#!/usr/bin/env bash
set -euo pipefail

ROOT='/home/joshu/Synthetic-Dream-Machine'
OUT="$ROOT/_todo/BECMI/TODO_BECMI_Spell_Extraction_Spot_Check.md"
TMPDIR=$(mktemp -d)
trap 'rm -rf "$TMPDIR"' EXIT

count_formfeeds() {
  tr -cd '\f' < "$1" | wc -c | tr -d ' '
}

extract_pair() {
  local pdf="$1"
  local raw_txt="$2"
  local clean_txt="$3"
  pdftotext -layout "$pdf" "$raw_txt" 2>/dev/null
  pdftotext -layout -nodiag -nopgbrk "$pdf" "$clean_txt" 2>/dev/null
}

write_case() {
  local label="$1"
  local pdf="$2"
  local target_regex="$3"
  local sample_regex="$4"
  local note="$5"
  local slug="$6"
  local raw_txt="$TMPDIR/${slug}.raw.txt"
  local clean_txt="$TMPDIR/${slug}.clean.txt"
  local sample_file="$TMPDIR/${slug}.sample.txt"
  local raw_ff clean_ff raw_hits clean_hits sample_line start_line

  extract_pair "$pdf" "$raw_txt" "$clean_txt"

  raw_ff=$(count_formfeeds "$raw_txt")
  clean_ff=$(count_formfeeds "$clean_txt")
  raw_hits=$(rg -c "$target_regex" "$raw_txt" || true)
  clean_hits=$(rg -c "$target_regex" "$clean_txt" || true)
  sample_line=$(rg -n -m1 "$sample_regex" "$clean_txt" | cut -d: -f1 || true)

  {
    printf '## %s\n\n' "$label"
    printf -- '- Source PDF: `%s`\n' "$(basename "$pdf")"
    printf -- '- Baseline extractor: `pdftotext -layout`\n'
    printf -- '- Clean extractor: `pdftotext -layout -nodiag -nopgbrk`\n'
    printf -- '- Formfeed count: baseline `%s`, clean `%s`\n' "$raw_ff" "$clean_ff"
    printf -- '- Target hit count: baseline `%s`, clean `%s`\n' "$raw_hits" "$clean_hits"
    printf -- '- Assessment: %s\n\n' "$note"
    printf '### Clean Sample\n\n'
    printf '```text\n'
  } >> "$OUT"

  if [ -n "$sample_line" ]; then
    start_line=$(( sample_line > 3 ? sample_line - 3 : 1 ))
    sed -n "${start_line},$((sample_line + 10))p" "$clean_txt" > "$sample_file"
    cat "$sample_file" >> "$OUT"
  else
    printf '[sample regex not found in clean extraction]\n' >> "$OUT"
  fi

  printf '\n```\n\n' >> "$OUT"
}

cat <<'HDR' > "$OUT"
# TODO: BECMI Spell Extraction Spot Check

This report compares the original staging extractor against a cleaner variant before adopting it as the default pipeline.

Comparison:
- Baseline: `pdftotext -layout`
- Clean: `pdftotext -layout -nodiag -nopgbrk`

Evaluation goals:
- reduce page-break formfeed noise
- preserve spell/material searchability
- keep section headings and key spell terms readable
- avoid forcing OCR on PDFs that already contain usable text layers
- spot-check the Companion lane's flow-first heading-to-heading extraction helpers on high-value sections

Note:
- `ocrmypdf` is available locally, but these PDFs already expose searchable text. This pass therefore treats OCR as a fallback for future problem PDFs, not as the default path.
HDR

write_flow_case() {
  local label="$1"
  local pdf="$2"
  local start_page="$3"
  local end_page="$4"
  local bounds="$5"
  local anchor="$6"
  local stop_anchor="$7"
  local expected_regex="$8"
  local note="$9"
  local slug="${10}"
  local sample_file="$TMPDIR/${slug}.flow.txt"
  local status='needs-review'

  BECMI_STAGING_HELPERS_ONLY=1 bash -lc \
    "source '$ROOT/_todo/BECMI/scripts/build_becmi_spell_staging.sh'; render_tsv_cols_pages_anchored_until '$pdf' '$start_page' '$end_page' '$bounds' '$anchor' '$stop_anchor'" \
    > "$sample_file"

  if rg -q "$expected_regex" "$sample_file"; then
    status='pass'
  fi

  {
    printf '## %s\n\n' "$label"
    printf -- '- Source PDF: `%s`\n' "$(basename "$pdf")"
    printf -- '- Flow extractor: `render_tsv_cols_pages_anchored_until`\n'
    printf -- '- Page span: `%s-%s`\n' "$start_page" "$end_page"
    printf -- '- Start anchor: `%s`\n' "$anchor"
    printf -- '- Stop anchor: `%s`\n' "$stop_anchor"
    printf -- '- Validation status: `%s`\n' "$status"
    printf -- '- Assessment: %s\n\n' "$note"
    printf '### Flow Sample\n\n'
    printf '```text\n'
  } >> "$OUT"

  sed -n '1,80p' "$sample_file" >> "$OUT"
  printf '\n```\n\n' >> "$OUT"
}

write_layout_flow_case() {
  local label="$1"
  local pdf="$2"
  local start_page="$3"
  local end_page="$4"
  local colspacing="$5"
  local anchor="$6"
  local stop_anchor="$7"
  local expected_regex="$8"
  local note="$9"
  local slug="${10}"
  local sample_file="$TMPDIR/${slug}.layout.txt"
  local status='needs-review'

  BECMI_STAGING_HELPERS_ONLY=1 bash -lc \
    "source '$ROOT/_todo/BECMI/scripts/build_becmi_spell_staging.sh'; render_layout_pages_anchored_until '$pdf' '$start_page' '$end_page' '$colspacing' '$anchor' '$stop_anchor'" \
    > "$sample_file"

  if rg -q "$expected_regex" "$sample_file"; then
    status='pass'
  fi

  {
    printf '## %s\n\n' "$label"
    printf -- '- Source PDF: `%s`\n' "$(basename "$pdf")"
    printf -- '- Flow extractor: `render_layout_pages_anchored_until`\n'
    printf -- '- Page span: `%s-%s`\n' "$start_page" "$end_page"
    printf -- '- Start anchor: `%s`\n' "$anchor"
    printf -- '- Stop anchor: `%s`\n' "$stop_anchor"
    printf -- '- Validation status: `%s`\n' "$status"
    printf -- '- Assessment: %s\n\n' "$note"
    printf '### Flow Sample\n\n'
    printf '```text\n'
  } >> "$OUT"

  sed -n '1,80p' "$sample_file" >> "$OUT"
  printf '\n```\n\n' >> "$OUT"
}

write_column_flow_case() {
  local label="$1"
  local pdf="$2"
  local start_page="$3"
  local end_page="$4"
  local bounds="$5"
  local target_col="$6"
  local anchor="$7"
  local stop_anchor="$8"
  local expected_regex="$9"
  local note="${10}"
  local slug="${11}"
  local sample_file="$TMPDIR/${slug}.column.txt"
  local status='needs-review'

  BECMI_STAGING_HELPERS_ONLY=1 bash -lc \
    "source '$ROOT/_todo/BECMI/scripts/build_becmi_spell_staging.sh'; render_tsv_col_pages_anchored_until '$pdf' '$start_page' '$end_page' '$bounds' '$target_col' '$anchor' '$stop_anchor'" \
    > "$sample_file"

  if rg -q "$expected_regex" "$sample_file"; then
    status='pass'
  fi

  {
    printf '## %s\n\n' "$label"
    printf -- '- Source PDF: `%s`\n' "$(basename "$pdf")"
    printf -- '- Flow extractor: `render_tsv_col_pages_anchored_until`\n'
    printf -- '- Page span: `%s-%s`\n' "$start_page" "$end_page"
    printf -- '- Column: `%s`\n' "$target_col"
    printf -- '- Start anchor: `%s`\n' "$anchor"
    printf -- '- Stop anchor: `%s`\n' "$stop_anchor"
    printf -- '- Validation status: `%s`\n' "$status"
    printf -- '- Assessment: %s\n\n' "$note"
    printf '### Flow Sample\n\n'
    printf '```text\n'
  } >> "$OUT"

  sed -n '1,80p' "$sample_file" >> "$OUT"
  printf '\n```\n\n' >> "$OUT"
}

write_case \
  'TSR 1011B - Set 1 Basic Rules' \
  "$ROOT/_becmi/TSR 1011B - Set 1 Basic Rules.pdf" \
  'Spell Books:|Lost Spell Books|Read Magic|Rods, Staves or Spells' \
  'Spell Books:|Lost Spell Books|Read Magic' \
  'Searchable spell material is preserved. The clean extractor removes page-break formfeeds but does not fix source-text corruption such as split glyphs in older spell tables.' \
  'basic'

write_case \
  'TSR 1012B - Set 2 Expert Rules' \
  "$ROOT/_becmi/TSR 1012B - Set 2 Expert Rules.pdf" \
  'Dispel Magic|Raise Dead|Spell Books, Lost|spell scrolls' \
  'Dispel Magic|Raise Dead|Spell Books, Lost' \
  'The clean extractor preserves Expert spell list/search terms while cutting page-break noise. Embedded source OCR-style damage remains in places, but not enough to block staging use.' \
  'expert'

write_case \
  'TSR 1013 - Set 3 Companion Set' \
  "$ROOT/_becmi/TSR 1013 - Set 3 Companion Set.pdf" \
  'Raise Dead|Raise Dead Fully|wall o f fire|wizardry' \
  'Raise Dead|Raise Dead Fully' \
  'Companion spell references survive the clean pass and remain searchable. Noise reduction is mostly structural here rather than lexical.' \
  'companion'

write_case \
  'TSR 1021 - Set 4 Master Rules' \
  "$ROOT/_becmi/TSR 1021 - Set 4 Master Rules.pdf" \
  'Raise Dead Fully|travel|wizardry|spells' \
  'Raise Dead Fully|wizardry|spells' \
  'Master remains extractable with the clean flags, with the main benefit again being page-break suppression rather than word recovery.' \
  'master'

write_case \
  'TSR 1017 - Set 5 Immortals Rules' \
  "$ROOT/_becmi/TSR 1017 - Set 5 Immortals Rules.pdf" \
  'Fireball|Lightning Bolt|Raise Dead|Dimension Door' \
  'Fireball|Lightning Bolt|Raise Dead|Dimension Door' \
  'Immortals extracts cleanly enough that OCR is not warranted. Key spell names remain intact under the cleaner flags.' \
  'immortals'

write_case \
  'TSR 1071 - The D&D Rules Cyclopedia' \
  "$ROOT/_becmi/TSR 1071 - The D&D Rules Cyclopedia.pdf" \
  'Spell Research|Monster Spellcasters|Scrolls|Index to Spells|Fireball|Lightning Bolt' \
  'Spell Research|Monster Spellcasters|Scrolls|Index to Spells' \
  'The clean extractor is the right default for the RC PDF: it preserves the late-book spell-context sections while dropping page-break clutter from the staging output.' \
  'rules_cyclopedia'

write_flow_case \
  'Companion flow check: Damage To Magic Items' \
  "$ROOT/_becmi/TSR 1013 - Set 3 Companion Set.pdf" \
  59 \
  60 \
  '185,370' \
  'Damage To Magic Items' \
  'Demi-Human Crafts' \
  'any potion or scroll as a \+ ?[I1] item;' \
  'The flow-first helper should recover the complete damage-to-magic-items procedure without bleeding into the following demi-human craft section.' \
  'companion_damage_flow'

write_flow_case \
  'Companion flow check: Buying And Selling Magic Items' \
  "$ROOT/_becmi/TSR 1013 - Set 3 Companion Set.pdf" \
  64 \
  65 \
  '185,370' \
  'B. Buying and Selling Magic Items' \
  'Planning and Placing Treasure' \
  'Armor|Missile Device|Wand' \
  'The flow-first helper should recover the full buying/selling procedure and keep the price table attached while stopping before treasure-planning bleed.' \
  'companion_buying_flow'

write_flow_case \
  'Companion flow check: Scrolls Through Miscellaneous Items' \
  "$ROOT/_becmi/TSR 1013 - Set 3 Companion Set.pdf" \
  86 \
  91 \
  '185,370' \
  '6. Scrolls' \
  '10. Armor and Shields' \
  'Spell Catching|1st to 8th level spells' \
  'The flow-first helper should preserve the spell-catching capacity table and contiguous item-description run without spilling into armor/shield rules.' \
  'companion_scrolls_flow'

write_column_flow_case \
  'Companion flow check: Demi-Human Crafts' \
  "$ROOT/_becmi/TSR 1013 - Set 3 Companion Set.pdf" \
  59 \
  61 \
  '185,370' \
  3 \
  'Demi-Human Crafts' \
  'Hit Points Maximum' \
  'Dwarf: By using the Forge of Power|Tree of Life|Crucible of Blackflame' \
  'The right-column TSV helper should recover the full demi-human crafting section while stopping before the Hit Points Maximum section.' \
  'companion_demi_human_crafts_flow'

write_column_flow_case \
  'Companion flow check: Poison' \
  "$ROOT/_becmi/TSR 1013 - Set 3 Companion Set.pdf" \
  60 \
  61 \
  '185,370' \
  3 \
  'Poison' \
  'Hit Roll Charts' \
  'The use of poison is evil, and may cause|potion of poison|poison sacs or glands' \
  'The right-column TSV helper should recover the poison procedure while stopping before the Hit Roll Charts section.' \
  'companion_poison_flow'

write_layout_flow_case \
  'Companion flow check: Magic-Item Tables' \
  "$ROOT/_becmi/TSR 1013 - Set 3 Companion Set.pdf" \
  81 \
  84 \
  '0.45' \
  '3b. Types of Jewelry' \
  '10. Armor or Shield' \
  '01-70[[:space:]]+Magic-|Rod of the Wyrm|75-77[[:space:]]+Poison' \
  'The layout-anchored helper should recover the 81-84 magic-item table run without falling back to pasted witness text.' \
  'companion_magic_item_tables_flow'
