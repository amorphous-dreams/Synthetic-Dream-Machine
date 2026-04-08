#!/usr/bin/env python3
"""survey_spell_completeness.py — Cross-corpus BECMI/RC spell completeness survey.

For every canonical spell name (all 196 ✓ rows in the crosswalk) and its known aliases,
searches all 6 BECMI/RC extraction files for every line-level hit, classifies each hit by
tier, checks whether the context is already captured in the per-lane staging files, and
outputs a triageable Markdown hit report.

ArtifactLog(Annotator) — pdftotext -layout extraction artifacts:
  1. Multi-column horizontal interleave: Three-column pages produce very wide lines (~200+ chars)
     where column 1, 2, and 3 text appears on the same line separated by large whitespace gaps.
     Filter: lines wider than 180 chars containing 3+ spell-name-format tokens → classify as
     `spell-list`. Most two-column pages produce lines in the 90–150-char range.
  2. Soft-hyphen line breaks: Some words are broken across lines with a trailing hyphen
     ("dis-\\npel magic"). The context-window join normalises this — adjacent lines are
     concatenated with a space before classification so compound forms are caught.
  3. Page headers/footers: Appear as standalone short lines with a chapter title or page
     number. Lines under 20 chars that are purely numeric, or whose normalised form matches
     a known chapter-title fragment, can be ignored during triage (not auto-classified here;
     human reviewer handles them via context window).
  4. TOC dotted-leader rows: Contain the pattern <text>.....\\d+ (spell name then dot-fill
     then page number). Filter: re.search(r'\\.{2,}\\s*\\d+', line) applied to the matched line.
  5. Wide spell-list table rows: Basic/Expert use two or three columns. In the extraction
     these produce lines where the matched alias name appears far from column 0 (character
     offset > 50 in the raw line). This is the secondary `spell-list` heuristic.
  Book-specific extraction notes:
  - basic:     8,314 lines; "Fire Ball" spelled as two words; two-column description chapters.
  - expert:    6,202 lines; "Fire Ball" two words; some pages extract as single wide line.
  - companion: 7,132 lines; "Fire Ball" two words; Immortals content stub in appendix.
  - master:    7,813 lines; "Fire Ball" two words; numbered spell lists and artifact tables.
  - immortals: 7,384 lines; PP-scaling sections reference many spells with Immortal-tier rules.
  - rc:       20,841 lines; "Fireball" one word; 49+ Dispel Magic hits; Ch.13 DM procedure
              section at ~line 10309 carries high-value Charm Person duration rules not in
              any primary staging block; Wand of Fireballs item entry at ~line 17170 carries
              new activation mechanics.

Usage:
    python3 scripts/survey_spell_completeness.py check [options]
    python3 scripts/survey_spell_completeness.py write [options]

Flags:
    --spell SPELL       Filter to a specific spell name (partial, case-insensitive match).
    --book BOOK,...     Limit to specific books: basic,expert,companion,master,immortals,rc
    --min-class CLASS   Only report hits at or above this tier.
                        Valid values (ascending): toc, spell-list, primary, cross-ref,
                        rules-note, item-monster  (default: cross-ref)
    --module MODULE     Filter by class/level substring from the crosswalk
                        (e.g. "cleric", "magic-user", "druid", "M 3").
    --terms TERM,...    Comma-separated terms for world-ontology / mechanics-as-metaphysics
                        scan. Bypasses the crosswalk spell list entirely; --spell and
                        --module are inactive in this mode. Example:
                        --terms 'anti-magic,magical nature,astral,ethereal,Power Points'

Modes:
    check   Print the hit report to stdout only.
    write   Write the hit report to _todo/TODO_Completeness_Survey_Hits.md
            (overwrites any existing file) and also print to stdout.
"""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

# Pull in sibling script so we can reuse norm() and spell_aliases().
sys.path.insert(0, str(Path(__file__).parent))
import build_becmi_spell_staging_multi as multi  # noqa: E402

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------

ROOT = Path("/home/joshu/Synthetic-Dream-Machine")
CROSSWALK = ROOT / "_todo/TODO_BECMI_Spell_Effect_Crosswalk.md"
HIT_REPORT = ROOT / "_todo/TODO_Completeness_Survey_Hits.md"
COVERAGE_REPORT = ROOT / "_todo/TODO_Completeness_Survey_Coverage.md"

EXTRACTIONS: dict[str, Path] = {
    "basic":     ROOT / "_becmi/extractions/basic_full.txt",
    "expert":    ROOT / "_becmi/extractions/expert_full.txt",
    "companion": ROOT / "_becmi/extractions/companion_full.txt",
    "master":    ROOT / "_becmi/extractions/master_full.txt",
    "immortals": ROOT / "_becmi/extractions/immortals_full.txt",
    "rc":        ROOT / "_becmi/extractions/rc_full.txt",
}

# Maps extraction key → PLAIN_LANE_PATHS key (for already-staged lookup)
BOOK_TO_LANE: dict[str, str] = {
    "basic":     "Basic",
    "expert":    "Expert",
    "companion": "Companion",
    "master":    "Master",
    "immortals": "Immortals",
    "rc":        "Rules Cyclopedia",
}

# Tier order (ascending — higher index = more interesting)
TIER_ORDER = ["toc", "spell-list", "primary", "cross-ref", "rules-note", "item-monster"]

CONTEXT_RADIUS = 6  # lines above and below the matched line

# ---------------------------------------------------------------------------
# OCR alias extension (Option 1)
#
# pdftotext -layout can produce corrupted character sequences in spell names.
# Confirmed OCR variants are added here as explicit search aliases so they are
# caught even when normalize_for_search() (Option 2) doesn't apply.
#
# Adding a variant here does NOT claim it will appear in every book — the search
# loop checks all aliases against all requested books; zero hits for a variant
# in a given book is fine.  Only add confirmed sightings or high-probability
# candidates (i.e. the character sequence is in a known OCR-vulnerable position).
# ---------------------------------------------------------------------------

_OCR_SPELL_ALIASES: dict[str, list[str]] = {
    # 'g' → 'q' OCR corruption in the sequence 'ight'/'ight' (pdftotext artifact).
    # Confirmed: basic_full.txt contains 'Continual Liqht' and 'Liqht' (1 hit each).
    "Light":                    ["Liqht"],
    "Continual Light":          ["Continual Liqht"],
    "Dancing Lights":           ["Dancing Liqhts"],
    "Lightning Bolt":           ["Liqhtning Bolt"],
    "Call Lightning":           ["Call Liqhtning"],
    "Protection from Lightning": ["Protection from Liqhtning"],
}

# ---------------------------------------------------------------------------
# Alias suppression and extension (survey-layer overrides)
#
# These adjustments apply in the survey script only — they do not affect
# build_becmi_spell_staging_multi.py's spell_aliases() function.
# ---------------------------------------------------------------------------

# Aliases produced by multi.spell_aliases() slash-split that are too broad
# for corpus search. Keyed by classic_name → set of aliases to remove.
_SUPPRESS_ALIASES: dict[str, set[str]] = {
    # "Wall" alone matches dungeon wall descriptions everywhere; replace with "Wall of Ice"
    "Ice Storm/Wall": {"Wall"},
}

# Narrower replacement aliases to add after suppression. Keyed by classic_name.
_ADD_ALIASES: dict[str, list[str]] = {
    "Ice Storm/Wall": ["Wall of Ice"],
}

# Alias-level exclusion patterns: if the matched line also matches this pattern,
# skip the hit. Keyed by alias (lowercase).
_ALIAS_LINE_EXCLUSIONS: dict[str, re.Pattern[str]] = {
    # "Fly" in compound monster name "Robber Fly" — not a spell reference
    "fly": re.compile(r"\brobber\s+fly\b", re.I),
}


def survey_aliases(classic_name: str) -> list[str]:
    """Return all search aliases for a spell: canonical + card-heading + alias overrides + OCR variants.

    Wraps multi.spell_aliases(), applies survey-layer suppressions and additions,
    then appends any confirmed OCR-corrupted forms from _OCR_SPELL_ALIASES.
    """
    aliases = multi.spell_aliases(classic_name, classic_name)
    # Remove over-broad alias fragments (e.g. bare 'Wall' from 'Ice Storm/Wall')
    suppress = _SUPPRESS_ALIASES.get(classic_name, set())
    if suppress:
        aliases = [a for a in aliases if a not in suppress]
    # Add narrower replacement aliases
    for extra in _ADD_ALIASES.get(classic_name, []):
        if extra not in aliases:
            aliases.append(extra)
    # Append OCR variants
    for ocr_variant in _OCR_SPELL_ALIASES.get(classic_name, []):
        if ocr_variant not in aliases:
            aliases.append(ocr_variant)
    return aliases


# ---------------------------------------------------------------------------
# In-memory OCR normalization (Option 2)
#
# Applied to a *copy* of each extraction line before pattern matching.  The
# original raw_line is always preserved for context display and line numbers.
#
# Rules are deliberately narrow — only transform sequences with confirmed
# pdftotext artifact patterns and low false-positive risk:
#   1. 'q' → 'g' in the trigraph [a-z]q[ht] — catches 'liqht' → 'light',
#      'liqhtning' → 'lightning'.  The sequence [a-z]q[ht] is vanishingly rare
#      in real English text so the false-positive risk is essentially zero.
#   2. (Reserved for future confirmed patterns — add here with a comment.)
# ---------------------------------------------------------------------------

_OCR_NORM_SUBS: list[tuple[re.Pattern[str], str]] = [
    # 'q' → 'g' before 'ht' (trigraph [a-z]qht): liqht → light, Liqhtning → Lightning
    (re.compile(r"(?<=[A-Za-z])q(?=ht)"), "g"),
]


def normalize_for_search(line: str) -> str:
    """Return a normalized copy of *line* for use in pattern matching only.

    Applies targeted in-memory OCR correction rules.  The returned string is
    only used for regex matching; the original line is always used for display,
    context windows, and line-number reporting.
    """
    result = line
    for pattern, replacement in _OCR_NORM_SUBS:
        result = pattern.sub(replacement, result)
    return result

# ---------------------------------------------------------------------------
# Dataclass for a single hit
# ---------------------------------------------------------------------------

from dataclasses import dataclass, field  # noqa: E402


@dataclass
class Hit:
    spell: str
    book: str
    line_no: int          # 1-based
    matched_alias: str
    context: list[str]    # CONTEXT_RADIUS*2+1 lines (or fewer at file edges)
    tier: str             # auto-classification
    staged_match: bool    # True if context likely already in staging file
    decision: str = ""    # filled in by human reviewer


# ---------------------------------------------------------------------------
# Crosswalk parsing (simple — does not require Chapter 06 card map)
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class SurveyRow:
    classic_name: str
    class_level: str   # e.g. "M 3", "C 1", "D 2"
    source_lanes: list[str]


_LANE_NORMALISE = {
    "Basic": "basic",
    "Expert": "expert",
    "Companion": "companion",
    "Master": "master",
    "Immortals": "immortals",
    "Rules Cyclopedia": "rc",
}


def _norm_lane(raw: str) -> str | None:
    """Normalise a source-book label from the crosswalk to an extraction key."""
    t = raw.strip()
    # Direct match
    if t in _LANE_NORMALISE:
        return _LANE_NORMALISE[t]
    # Alias variants that appear in the crosswalk
    lookup: dict[str, str] = {
        "basic rules": "basic",
        "basic set": "basic",
        "expert set": "expert",
        "companion set": "companion",
        "master set": "master",
        "immortals set": "immortals",
        "rules cyclopedia": "rc",
        "rc": "rc",
    }
    return lookup.get(t.lower())


def parse_survey_rows(crosswalk_text: str) -> list[SurveyRow]:
    """Extract all ✓ spell rows from the crosswalk table."""
    rows: list[SurveyRow] = []
    seen: set[str] = set()
    for line in crosswalk_text.splitlines():
        if not line.startswith("| ") or line.startswith("| ---"):
            continue
        parts = [p.strip() for p in line.strip("|").split("|")]
        # 7 columns: Classic Name | Class/Level | Source Book(s) | Anchor | Type | Ch06 | osr
        if len(parts) < 6:
            continue
        if parts[4] != "spell" or parts[5] != "✓":
            continue
        classic_name = parts[0]
        if not classic_name or classic_name in seen:
            continue
        seen.add(classic_name)
        class_level = parts[1]
        source_lanes = [
            lane
            for chunk in parts[2].split(",")
            for lane in [_norm_lane(chunk)]
            if lane is not None
        ]
        rows.append(SurveyRow(
            classic_name=classic_name,
            class_level=class_level,
            source_lanes=source_lanes,
        ))
    return rows


# ---------------------------------------------------------------------------
# Staging content loader (for already-staged filter)
# ---------------------------------------------------------------------------

def load_staging_text() -> dict[str, str]:
    """Return normalised full text of each per-lane staging file keyed by extraction key."""
    result: dict[str, str] = {}
    for book_key, lane_name in BOOK_TO_LANE.items():
        path = multi.PLAIN_LANE_PATHS.get(lane_name)
        if path and path.exists():
            raw = path.read_text(encoding="utf-8")
            result[book_key] = multi.norm(raw)
        else:
            result[book_key] = ""
    return result


def load_staging_raw() -> dict[str, str]:
    """Return raw (un-normalised) full text of each per-lane staging file keyed by extraction key."""
    result: dict[str, str] = {}
    for book_key, lane_name in BOOK_TO_LANE.items():
        path = multi.PLAIN_LANE_PATHS.get(lane_name)
        if path and path.exists():
            result[book_key] = path.read_text(encoding="utf-8")
        else:
            result[book_key] = ""
    return result


# ---------------------------------------------------------------------------
# Hit classifiers
# ---------------------------------------------------------------------------

# Patterns for TOC / index dotted-leader lines.
# Handles both adjacent dots ("......  65") and spaced dots (". . . . . . 65") as
# produced by pdftotext from multi-column index pages.  Page references may use
# letter+digit codes ("D14", "P23", "C7") as well as plain integers.  Does NOT
# require end-of-line because multi-column TOC pages carry multiple entries per line.
_TOC_RE = re.compile(r"(?:\.{2,}|\.(?:\s+\.){2,})\s*[A-Z]?\d+")

# Item/monster activation keywords (used for item-monster tier)
_ITEM_KEYWORDS_RE = re.compile(
    r"\b(wand|staff|ring|rod|scroll|potion|sword|armor|helm|amulet|bracelet|"
    r"necklace|cloak|girdle|boots|gloves|manual|tome|gem|stone|sphere|orb|"
    r"mirror|crystal|chest|bag|bottle|flask|horn|instrument|medallion|"
    r"dragon|undead|demon|devil|elemental|giant|golem|lich|vampire|wraith|"
    r"ghost|spectre|banshee|shadow|skeleton|zombie|mummy|wight|ghoul|"
    r"creature|monster|beast|fiend)\b",
    re.I,
)

# Rules-note keywords (save tables, procedure text, duration extensions)
_RULES_NOTE_RE = re.compile(
    r"\b(saving throw|save|intelligence|wisdom|duration|caster level|"
    r"level of the caster|dispelled|dispel|anti.magic|area of effect|"
    r"procedure|concentration|number of targets|range of the spell|"
    r"charm person spell|charm monster spell|sleep and unconscious|"
    r"unconsciousness|damage per level|hit points? of damage|"
    r"rounds? per level|turns? per level|table|score|bonus|penalty|"
    r"at.will|per day|charges?|activation)\b",
    re.I,
)

# Spell-primary description header indicators
_PRIMARY_HEADER_RE = re.compile(
    r"^(Range|Duration|Effect|Area of Effect|Casting Time|Components?|"
    r"Reversible|Save)\s*:",
    re.I | re.M,
)

# Wide-line heuristic for multi-column spell lists
_KNOWN_SPELL_WORDS_RE = re.compile(
    r"\b(charm|sleep|fireball|fire ball|dispel|magic|light|darkness|"
    r"fly|haste|slow|hold|fear|confusion|polymorph|teleport|invisib|"
    r"protection|continual|animate|create|pass|wall|web|mirror|stone|"
    r"curse|bless|cure|cause|silence|detect|locate|remove|neutralize|"
    r"transmute|control|weather|death|raise|speak|commune|contact|wish|"
    r"power word)\b",
    re.I,
)

# Common-word spell names require spell-mechanics vocabulary in context
# before their tier may be elevated above cross-ref.
_COMMON_WORD_SPELLS: frozenset[str] = frozenset({
    "Strength", "Dance", "Gate", "Statue", "Symbol", "Barrier",
    "Immunity", "Travel", "Wish", "Slow", "Shield", "Telekinesis",
})

# Must find at least one of these tokens in the context window for a
# common-word spell hit to qualify above cross-ref tier.
_SPELL_CONTEXT_GUARD_RE = re.compile(
    r"\b(cast|caster|magic.user|magic user|elf|cleric|druid|illusionist|spell|"
    r"duration|effect|range|saving throw|hit dice|memorize|memoris|scroll|"
    r"dweomer|magical effect|antimagic|anti.magic|enchant)\b",
    re.I,
)


def _context_str(context: list[str]) -> str:
    """Join context window lines into a single normalised comparison string."""
    return " ".join(line.strip() for line in context)


def classify_hit(line: str, line_no: int, context: list[str], alias: str) -> str:
    """Return the tier label for a hit given its line text and surrounding context."""
    # 1. TOC / index — dotted leader to page number
    if _TOC_RE.search(line):
        return "toc"

    # 2. Wide line heuristic — multi-column spell-list row
    #    a) Line is wider than 180 chars (extraction artifact)
    if len(line) > 180:
        return "spell-list"
    #    b) Matched alias is indented far from column 0 (appears in col 2/3 of a table)
    alias_pos = line.lower().find(alias.lower())
    if alias_pos > 50:
        return "spell-list"
    #    c) Line contains 3+ distinct known-spell fragments (multi-spell table row)
    spell_hits = _KNOWN_SPELL_WORDS_RE.findall(line)
    if len(set(w.lower() for w in spell_hits)) >= 4:
        return "spell-list"

    ctx = _context_str(context)

    # 3. Primary description block — has Range:/Duration:/Effect: headers nearby
    if len(_PRIMARY_HEADER_RE.findall(ctx)) >= 2:
        return "primary"

    # 4. Item / monster entry — keywords in context
    if _ITEM_KEYWORDS_RE.search(ctx):
        return "item-monster"

    # 5. Standalone rules-note section — save tables, procedure text, duration rules
    if _RULES_NOTE_RE.search(ctx):
        return "rules-note"

    # 6. Fallback — incidental cross-reference
    return "cross-ref"


def is_staged(context: list[str], book_key: str, staging: dict[str, str]) -> bool:
    """Return True if a meaningful chunk of the context appears in the staging text."""
    staged_norm = staging.get(book_key, "")
    if not staged_norm:
        return False
    # Take the central line (the matched line itself) and its immediate neighbours.
    # Build a normalised 12-word fingerprint and check for occurrence in staged text.
    centre_idx = len(context) // 2
    sample_lines = context[max(0, centre_idx - 1): centre_idx + 2]
    sample_text = " ".join(line.strip() for line in sample_lines)
    sample_norm = multi.norm(sample_text)
    # Need at least 12 normalised chars to be meaningful
    if len(sample_norm) < 12:
        return False
    # Sliding-window: check 14-char substrings of the sample against the staging blob
    window = 14
    matches = 0
    total = max(1, len(sample_norm) - window + 1)
    checks = min(total, 8)  # limit probe count for speed
    step = max(1, total // checks)
    for i in range(0, total, step):
        chunk = sample_norm[i: i + window]
        if chunk in staged_norm:
            matches += 1
    # If >60% of probed chunks appear in the staged text → already staged
    return (matches / checks) > 0.6


# ---------------------------------------------------------------------------
# Core search loop
# ---------------------------------------------------------------------------

def search_book(
    rows: list[SurveyRow],
    book_key: str,
    staging: dict[str, str],
    spell_filter: str | None,
    min_tier: int,
    module_filter: str | None,
) -> list[Hit]:
    path = EXTRACTIONS[book_key]
    if not path.exists():
        print(f"  WARNING: extraction file not found: {path}", file=sys.stderr)
        return []

    # Use split('\n') rather than splitlines() so line numbers match grep / wc -l.
    # splitlines() also splits on form feeds (\x0c page separators embedded by
    # pdftotext), which would cause all line numbers to drift above the grep values.
    lines = path.read_text(encoding="utf-8").split("\n")
    hits: list[Hit] = []

    for row in rows:
        # --spell filter
        if spell_filter and spell_filter.lower() not in row.classic_name.lower():
            continue
        # --module filter (vs. class_level field)
        if module_filter and module_filter.lower() not in row.class_level.lower():
            continue

        aliases = survey_aliases(row.classic_name)
        # Build compiled patterns for all aliases (case-insensitive, word-boundary aware)
        alias_patterns: list[tuple[str, re.Pattern[str]]] = []
        for alias in aliases:
            # Use word-boundary matching; handle special chars in alias names safely
            escaped = re.escape(alias)
            pattern = re.compile(r"(?<![A-Za-z])" + escaped + r"(?![A-Za-z])", re.I)
            alias_patterns.append((alias, pattern))

        for line_idx, raw_line in enumerate(lines):
            # Apply in-memory OCR normalization to a search copy only.
            # raw_line is always used for context display and line numbers.
            search_line = normalize_for_search(raw_line)
            for alias, pattern in alias_patterns:
                if not pattern.search(search_line):
                    continue
                # Alias-level line exclusion (e.g. 'fly' in 'Robber Fly')
                excl = _ALIAS_LINE_EXCLUSIONS.get(alias.lower())
                if excl and excl.search(search_line):
                    continue
                # Extract context window
                start = max(0, line_idx - CONTEXT_RADIUS)
                end = min(len(lines), line_idx + CONTEXT_RADIUS + 1)
                context = lines[start:end]

                tier = classify_hit(raw_line, line_idx + 1, context, alias)

                # Common-word spell guard: cap tier at cross-ref unless spell-mechanics
                # vocabulary appears in the context window
                if row.classic_name in _COMMON_WORD_SPELLS:
                    if not _SPELL_CONTEXT_GUARD_RE.search(_context_str(context)):
                        if TIER_ORDER.index(tier) > TIER_ORDER.index("cross-ref"):
                            tier = "cross-ref"

                # Check already-staged
                staged = is_staged(context, book_key, staging)
                if staged and tier == "primary":
                    pass  # keep — confirms capture
                elif staged and TIER_ORDER.index(tier) < TIER_ORDER.index("cross-ref"):
                    # auto-skip noise that's also staged
                    break  # no need to check other aliases for this line

                # Apply min-tier filter
                if TIER_ORDER.index(tier) < min_tier:
                    break  # skip this line entirely

                hits.append(Hit(
                    spell=row.classic_name,
                    book=book_key,
                    line_no=line_idx + 1,
                    matched_alias=alias,
                    context=context,
                    tier=tier,
                    staged_match=staged,
                ))
                break  # first matching alias wins for this line

    return hits


# ---------------------------------------------------------------------------
# Terms search (world-ontology / mechanics-as-metaphysics mode)
# ---------------------------------------------------------------------------

def search_book_terms(
    terms: list[str],
    book_key: str,
    staging: dict[str, str],
    min_tier: int,
) -> list[Hit]:
    """Search for arbitrary keyword terms in an extraction file.

    Used for world-ontology and mechanics-as-metaphysics scans — finds DM-facing
    procedure text, cosmological rules, and metaphysical framing that is not
    anchored to a specific named spell.  Output uses Hit.spell = '[term: TERM]'
    to distinguish from spell-crosswalk hits.
    """
    path = EXTRACTIONS[book_key]
    if not path.exists():
        print(f"  WARNING: extraction file not found: {path}", file=sys.stderr)
        return []

    lines = path.read_text(encoding="utf-8").split("\n")
    hits: list[Hit] = []

    for term in terms:
        escaped = re.escape(term.strip())
        # Word-boundary aware; terms may be multi-word phrases
        pattern = re.compile(r"(?<![A-Za-z])" + escaped + r"(?![A-Za-z])", re.I)
        for line_idx, raw_line in enumerate(lines):
            search_line = normalize_for_search(raw_line)
            if not pattern.search(search_line):
                continue
            start = max(0, line_idx - CONTEXT_RADIUS)
            end = min(len(lines), line_idx + CONTEXT_RADIUS + 1)
            context = lines[start:end]
            tier = classify_hit(raw_line, line_idx + 1, context, term)
            staged = is_staged(context, book_key, staging)
            if TIER_ORDER.index(tier) < min_tier:
                continue
            hits.append(Hit(
                spell=f"[term: {term}]",
                book=book_key,
                line_no=line_idx + 1,
                matched_alias=term,
                context=context,
                tier=tier,
                staged_match=staged,
            ))

    return hits


# ---------------------------------------------------------------------------
# Report renderer
# ---------------------------------------------------------------------------

_CONTEXT_PREVIEW_MAX = 220  # chars max for the Context Preview column


def _format_context_preview(context: list[str], line_no: int, start_line_no: int) -> str:
    centre_idx = line_no - start_line_no
    if 0 <= centre_idx < len(context):
        raw = context[centre_idx].strip()
    else:
        raw = " / ".join(c.strip() for c in context[:3])
    # Escape pipe chars so they don't break the Markdown table
    preview = raw.replace("|", "·")
    if len(preview) > _CONTEXT_PREVIEW_MAX:
        preview = preview[:_CONTEXT_PREVIEW_MAX - 3] + "..."
    return preview


def render_report(hits: list[Hit], books: list[str]) -> str:
    lines: list[str] = []
    lines.append("# Completeness Survey — Hit Report\n")
    lines.append(
        f"Books surveyed: {', '.join(books)}  \n"
        f"Total hits: {len(hits)}\n"
    )
    lines.append(
        "| Spell | Book | Line # | Tier | Staged? | Alias Matched | Context Preview | Decision |"
    )
    lines.append(
        "| --- | --- | --- | --- | --- | --- | --- | --- |"
    )
    for h in hits:
        start_line_no = h.line_no - CONTEXT_RADIUS
        preview = _format_context_preview(h.context, h.line_no, start_line_no)
        staged_str = "✓" if h.staged_match else ""
        lines.append(
            f"| {h.spell} | {h.book} | {h.line_no} | `{h.tier}` "
            f"| {staged_str} | {h.matched_alias} | {preview} | {h.decision} |"
        )
    return "\n".join(lines) + "\n"


# ---------------------------------------------------------------------------
# Coverage report (--coverage mode)
# ---------------------------------------------------------------------------

# Matches Range: / Duration: / Effect: header lines in staging files.
# Handles both bare ("Range: Touch") and markdown-prefixed variants.
_COVERAGE_HEADER_RE = re.compile(
    r"(?m)^[ \t-]*(?:\*\*)?(?:Range|Duration|Effect|Area of Effect)\s*[:\*]",
    re.I,
)

# Number of lines to scan after a spell-name match when looking for description headers.
_COVERAGE_WINDOW = 15

_ALL_BOOKS = ["basic", "expert", "companion", "master", "immortals", "rc"]
_BOOK_LABELS = {"basic": "Basic", "expert": "Expert", "companion": "Companion",
                "master": "Master", "immortals": "Immortals", "rc": "RC"}


def _coverage_status(
    spell_name: str,
    book_key: str,
    source_lanes: list[str],
    staging_lines: dict[str, list[str]],
) -> str:
    """Return coverage status for one spell × book pair.

    Returns:
        "✓ desc"  — a description body (Range/Duration/Effect headers) is staged
        "~ list"  — spell name appears but no description headers nearby
        "✗"       — spell name not found in staging lane
        ""        — book is not a source lane for this spell (n/a)
    """
    if book_key not in source_lanes:
        return ""
    lines = staging_lines.get(book_key, [])
    if not lines:
        return "✗"

    aliases = survey_aliases(spell_name)
    alias_patterns: list[re.Pattern[str]] = []
    for alias in aliases:
        escaped = re.escape(alias)
        alias_patterns.append(
            re.compile(r"(?<![A-Za-z])" + escaped + r"(?![A-Za-z])", re.I)
        )

    best = "✗"
    for i, line in enumerate(lines):
        for pat in alias_patterns:
            if not pat.search(line):
                continue
            # Found the spell name — scan the next _COVERAGE_WINDOW lines for description headers
            window_text = "\n".join(lines[i: i + _COVERAGE_WINDOW + 1])
            header_count = len(_COVERAGE_HEADER_RE.findall(window_text))
            if header_count >= 2:
                return "✓ desc"  # description body confirmed — no need to keep searching
            elif header_count == 1:
                best = "~ list"  # partial match — may be upgraded by a later occurrence
            elif best == "✗":
                best = "~ list"  # name found but no headers; mark at least list-only
            break  # first matching alias wins for this line

    return best


def coverage_report(rows: list[SurveyRow], staging_raw: dict[str, str]) -> str:
    """Produce a per-spell × per-lane description-coverage matrix as Markdown."""
    # Pre-split staging files into lines for O(n) window scanning.
    staging_lines: dict[str, list[str]] = {
        book_key: text.split("\n") for book_key, text in staging_raw.items()
    }

    # Counters per book lane
    desc_counts   = {b: 0 for b in _ALL_BOOKS}
    list_counts   = {b: 0 for b in _ALL_BOOKS}
    absent_counts = {b: 0 for b in _ALL_BOOKS}

    # Story 8b classification buckets
    zero_desc: list[str] = []   # description-gap: known source lanes but none have descriptions
    no_std_source: list[str] = []  # no standard BECMI/RC source lane (Holmes-only, etc.)
    all_present: list[str] = []    # full-multi-lane: description in 3+ lanes

    table_rows: list[str] = []
    for row in rows:
        statuses = {
            b: _coverage_status(row.classic_name, b, row.source_lanes, staging_lines)
            for b in _ALL_BOOKS
        }
        for b, s in statuses.items():
            if s == "✓ desc":
                desc_counts[b] += 1
            elif s == "~ list":
                list_counts[b] += 1
            elif s == "✗":
                absent_counts[b] += 1

        # 8b: classify per-row
        desc_lane_count = sum(1 for b in row.source_lanes if statuses[b] == "✓ desc")
        if not row.source_lanes:
            no_std_source.append(row.classic_name)
        elif desc_lane_count == 0:
            # Has known source lanes but none contain a description body
            if any(statuses[b] == "✗" for b in row.source_lanes):
                zero_desc.append(row.classic_name)
        if desc_lane_count >= 3:
            all_present.append(row.classic_name)

        cells = [statuses[b] if statuses[b] else "—" for b in _ALL_BOOKS]
        table_rows.append(f"| {row.classic_name} | " + " | ".join(cells) + " |")

    # Build report
    header_row = "| Spell | " + " | ".join(_BOOK_LABELS[b] for b in _ALL_BOOKS) + " |"
    sep_row    = "| --- | " + " | ".join("---" for _ in _ALL_BOOKS) + " |"
    summary_cells = [
        f"✓{desc_counts[b]} ~{list_counts[b]} ✗{absent_counts[b]}"
        for b in _ALL_BOOKS
    ]
    summary_row = "| **TOTALS** | " + " | ".join(summary_cells) + " |"

    report_lines: list[str] = [
        "# Staging Coverage Report\n",
        "Legend: `✓ desc` = description body present  `~ list` = list-only  "
        "`✗` = absent  `—` = not a source lane for this spell\n",
        header_row,
        sep_row,
        *table_rows,
        sep_row,
        summary_row,
        "",
    ]

    if zero_desc:
        report_lines.append("## Description-Gap Spells (source lane present but no verbatim description staged)\n")
        for spell in zero_desc:
            report_lines.append(f"- {spell}")
        report_lines.append("")

    if no_std_source:
        report_lines.append(
            "## No Standard BECMI/RC Source Lane (Holmes-only or unlisted — check pre-add staging)\n"
        )
        for spell in no_std_source:
            report_lines.append(f"- {spell}")
        report_lines.append("")

    if all_present:
        report_lines.append(
            f"## Full-Multi-Lane Spells (description in 3+ source lanes): {len(all_present)}\n"
        )
        for spell in all_present:
            report_lines.append(f"- {spell}")
        report_lines.append("")

    return "\n".join(report_lines)


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("mode", choices=["check", "write"])
    parser.add_argument("--spell", default=None, help="Filter to spells matching this substring")
    parser.add_argument("--book", default=None, help="Comma-separated book keys: basic,expert,companion,master,immortals,rc")
    parser.add_argument("--min-class", dest="min_class", default="cross-ref",
                        choices=TIER_ORDER, help="Minimum tier to report (default: cross-ref)")
    parser.add_argument("--module", default=None, help="Filter by class/level substring from crosswalk")
    parser.add_argument(
        "--terms", default=None,
        help=(
            "Comma-separated keyword terms for world-ontology / mechanics-as-metaphysics scan. "
            "Bypasses the crosswalk spell list entirely. "
            "Example: --terms 'anti-magic,magical nature,astral,ethereal,Power Points,divine intervention'"
        ),
    )
    parser.add_argument(
        "--coverage", action="store_true",
        help=(
            "Emit a per-spell × per-lane description-coverage matrix instead of the hit report. "
            "For each of the 196 crosswalk spells, reports whether each staging lane contains a "
            "full description body (Range/Duration/Effect headers present), a list-only entry, "
            "or no presence at all."
        ),
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()

    # --coverage: generate per-spell × per-lane description-coverage matrix
    if args.coverage:
        print("Loading crosswalk…", file=sys.stderr)
        crosswalk_text = CROSSWALK.read_text(encoding="utf-8")
        rows = parse_survey_rows(crosswalk_text)
        print(f"  {len(rows)} canonical spell rows loaded.", file=sys.stderr)
        print("Loading staging files (raw)…", file=sys.stderr)
        staging_raw = load_staging_raw()
        print("Building coverage matrix…", file=sys.stderr)
        report = coverage_report(rows, staging_raw)
        print(report)
        if args.mode == "write":
            COVERAGE_REPORT.write_text(report, encoding="utf-8")
            print(f"\nWrote coverage report → {COVERAGE_REPORT}", file=sys.stderr)
        return

    # Determine which books to search
    if args.book:
        books = [b.strip().lower() for b in args.book.split(",")]
        invalid = [b for b in books if b not in EXTRACTIONS]
        if invalid:
            print(f"ERROR: unknown book keys: {invalid}", file=sys.stderr)
            sys.exit(1)
    else:
        books = list(EXTRACTIONS.keys())

    min_tier = TIER_ORDER.index(args.min_class)

    rows: list[SurveyRow] = []
    if not args.terms:
        print(f"Loading crosswalk\u2026", file=sys.stderr)
        crosswalk_text = CROSSWALK.read_text(encoding="utf-8")
        rows = parse_survey_rows(crosswalk_text)
        print(f"  {len(rows)} canonical spell rows loaded.", file=sys.stderr)
    else:
        print(f"Terms mode \u2014 crosswalk not loaded.", file=sys.stderr)

    print(f"Loading staging files\u2026", file=sys.stderr)
    staging = load_staging_text()

    all_hits: list[Hit] = []
    if args.terms:
        terms_list = [t.strip() for t in args.terms.split(",") if t.strip()]
        print(f"Terms ({len(terms_list)}): {', '.join(terms_list)}", file=sys.stderr)
        for book_key in books:
            print(f"Searching {book_key}\u2026", file=sys.stderr)
            term_hits = search_book_terms(terms_list, book_key, staging, min_tier)
            print(f"  {len(term_hits)} hits (tier \u2265 {args.min_class})", file=sys.stderr)
            all_hits.extend(term_hits)
    else:
        for book_key in books:
            print(f"Searching {book_key}\u2026", file=sys.stderr)
            book_hits = search_book(rows, book_key, staging, args.spell, min_tier, args.module)
            print(f"  {len(book_hits)} hits (tier \u2265 {args.min_class})", file=sys.stderr)
            all_hits.extend(book_hits)

    print(f"\nTotal hits: {len(all_hits)}", file=sys.stderr)

    report = render_report(all_hits, books)

    print(report)

    if args.mode == "write":
        HIT_REPORT.write_text(report, encoding="utf-8")
        print(f"\nWrote hit report → {HIT_REPORT}", file=sys.stderr)


if __name__ == "__main__":
    main()
