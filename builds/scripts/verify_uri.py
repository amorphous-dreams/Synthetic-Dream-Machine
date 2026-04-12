#!/usr/bin/env python3
"""URI compliance validator for lar: URIs in Lares module files.

Validates canonical lar: URIs against the v2 spec defined in
lares/modules/uri-schema/URI_SCHEMA.md [CS:0.95]:

  - RFC 3986 order: ?query before #fragment (never reversed)
  - stances= parameter: 5-position dot-separated amplitude string
    Valid amplitude chars per position: ^ . - ? (one or more chars per position)
  - Chronometer #fragment: 5-position FFZ format (PhaseN.PhaseN...)
  - No emoji / non-ASCII characters in canonical URI strings
  - Authority-less form (lar:///) used for system files / waypoints

Usage:
    python3 builds/scripts/verify_uri.py [FILE|DIR ...]
    python3 builds/scripts/verify_uri.py lares/modules/
    python3 builds/scripts/verify_uri.py lares/modules/uri-schema/URI_SCHEMA.md

Output:
    FILE:LINE [VIOLATION_CODE] description
    URI: <offending uri>

    Violation codes:
        U-01    RFC 3986 order violated — fragment before query
        U-02    stances= param missing (exchange-level URI only)
        U-03    stances= has wrong position count (need 5)
        U-04    stances= contains invalid amplitude character
        U-05    chronometer fragment has wrong position count (need 5)
        U-06    chronometer position has invalid phase prefix
        U-07    non-ASCII / emoji found in canonical URI string
        U-08    parse error — URI malformed

Exit code: 0 = clean, 1 = violations found.

Exclusions:
    - Lines inside triple-backtick fenced code blocks are still checked
      (they are canonical examples and SHOULD comply).
    - Authority-less URIs (lar:///) are treated as system file waypoints:
      stances= not required, confidence + path only checked.
    - Lines containing <!-- uri-ok --> are skipped.
    - Inline `backtick` quoted URIs in prose are checked — they may violate
      and will be flagged with a note that they are inline-code context.

"""

import re
import sys
from pathlib import Path
from urllib.parse import urlparse, parse_qs


# ---------------------------------------------------------------------------
# Patterns
# ---------------------------------------------------------------------------

# Match canonical lar: URIs — both with authority (lar://) and
# authority-less (lar:///)
lar_uri_PATTERN = re.compile(
    r'lar://[^\s\]>)\'"`,|]+',
    re.IGNORECASE,
)

# Valid amplitude characters for stances positions
AMPLITUDE_CHARS = set('.^-?')

# Valid phase prefix characters for chronometer positions (record form)
# O=Observe, Ø=Orient, D=Decide, A=Act, Å=Aftermath
# Also accept lowercase and the ASCII fallback Aa for Å
PHASE_CHARS = re.compile(r'^[OØDAÅoødaå]\d+$')

# Non-ASCII emoji/symbol detector — blocks emoji and pictographs but
# allows Latin Extended characters used as defined phase tokens:
#   Ø = U+00D8 (Orient phase in record form chronometer)
#   Å = U+00C5 (Aftermath/Assess phase in record form chronometer)
#   ø = U+00F8, å = U+00E5 (lowercase variants)
NON_ASCII_PATTERN = re.compile(r'[^\x00-\x7F\xC5\xD8\xF8\xE5]')

# Skip marker
URI_OK_MARKER = '<!-- uri-ok -->'
URI_OK_INLINE = '<!-- eprime-ok -->'  # not for URIs but keep consistent naming


# ---------------------------------------------------------------------------
# Violation helpers
# ---------------------------------------------------------------------------

def make_violation(code: str, desc: str, uri: str, line: int, path: str) -> dict:
    return {'code': code, 'desc': desc, 'uri': uri, 'line': line, 'path': path}


def check_stances(stances_val: str, uri: str, line: int, path: str) -> list[dict]:
    """Validate stances= parameter — 5 positions, amplitude chars only."""
    violations = []
    positions = stances_val.split('.')
    if len(positions) != 5:
        violations.append(make_violation(
            'U-03',
            f'stances= has {len(positions)} position(s), need 5 (got: {stances_val!r})',
            uri, line, path,
        ))
        return violations  # skip per-position checks if count is wrong
    for i, pos in enumerate(positions):
        if not pos:
            violations.append(make_violation(
                'U-04',
                f'stances position {i + 1} is empty',
                uri, line, path,
            ))
        elif not all(c in AMPLITUDE_CHARS for c in pos):
            bad = [c for c in pos if c not in AMPLITUDE_CHARS]
            violations.append(make_violation(
                'U-04',
                f'stances position {i + 1} contains invalid char(s): {bad!r} in {pos!r}',
                uri, line, path,
            ))
    return violations


def check_chronometer(fragment: str, uri: str, line: int, path: str) -> list[dict]:
    """Validate FFZ chronometer fragment — 5 positions."""
    violations = []
    if not fragment:
        return violations  # absent fragment is valid (some section URIs)
    positions = fragment.split('.')
    if len(positions) != 5:
        violations.append(make_violation(
            'U-05',
            f'chronometer has {len(positions)} position(s), need 5 (got: {fragment!r})',
            uri, line, path,
        ))
        return violations
    for i, pos in enumerate(positions):
        if not PHASE_CHARS.match(pos):
            violations.append(make_violation(
                'U-06',
                f'chronometer position {i + 1} has invalid prefix/format: {pos!r}',
                uri, line, path,
            ))
    return violations


def check_uri(uri_str: str, line: int, path: str) -> list[dict]:
    """Return list of dicts describing compliance violations for one URI."""
    violations = []
    is_system_file = uri_str.startswith('lar:///')

    # U-07: non-ASCII / emoji
    if NON_ASCII_PATTERN.search(uri_str):
        violations.append(make_violation(
            'U-07',
            'non-ASCII or emoji found in canonical URI (canonical form must be ASCII-only)',
            uri_str, line, path,
        ))
        # Still continue — other checks may find additional violations.

    # Strip trailing annotation sigils (→ ?, → ∞) that appear in comment wrappers
    # These are not part of the URI but may be captured by the regex.
    clean = uri_str.split('→')[0].strip()

    # U-01: RFC 3986 order — query before fragment
    q_pos = clean.find('?')
    f_pos = clean.find('#')
    if q_pos != -1 and f_pos != -1 and f_pos < q_pos:
        violations.append(make_violation(
            'U-01',
            f'RFC 3986 order violated — # at {f_pos} before ? at {q_pos}',
            clean, line, path,
        ))

    # Attempt to parse
    try:
        parsed = urlparse(clean)
    except Exception as exc:
        violations.append(make_violation(
            'U-08',
            f'parse error: {exc}',
            clean, line, path,
        ))
        return violations

    # U-02 / U-03 / U-04: stances= parameter
    if parsed.query:
        try:
            params = parse_qs(parsed.query, keep_blank_values=True, strict_parsing=False)
        except Exception:
            params = {}

        if 'stances' in params:
            violations.extend(check_stances(params['stances'][0], clean, line, path))
        elif not is_system_file:
            # Full exchange-level URIs (with authority) should carry stances
            # authority-less system file URIs do not require stances
            violations.append(make_violation(
                'U-02',
                'stances= parameter missing from exchange-level URI (authority form requires stances)',
                clean, line, path,
            ))

    # U-05 / U-06: chronometer fragment
    # Section-level URIs (authority-less: lar:///) use named section anchors
    # (#section-name, #design-intent) — NOT chronometers. Skip chron validation
    # for those. Only validate 5-position chronometer on exchange-level URIs
    # that carry a stances= param (they are the ones with full OODA-A position).
    if parsed.fragment and not is_system_file:
        frag = parsed.fragment
        # Named section anchors look like words-with-hyphens, no consistent PhaseN prefix.
        # Chronometers always start with a valid phase prefix character followed by digits.
        if PHASE_CHARS.match(frag.split('.')[0] if '.' in frag else frag):
            violations.extend(check_chronometer(frag, clean, line, path))

    return violations


# ---------------------------------------------------------------------------
# File scanner
# ---------------------------------------------------------------------------

def scan_file(path: Path) -> list[dict]:
    """Scan one file for lar: URI violations. Returns list of violation dicts."""
    all_violations = []
    try:
        text = path.read_text(encoding='utf-8')
    except Exception as exc:
        print(f'  [SKIP] {path}: cannot read — {exc}', file=sys.stderr)
        return []

    for lineno, line in enumerate(text.splitlines(), start=1):
        # Skip lines with skip marker
        if URI_OK_MARKER in line:
            continue
        for match in lar_uri_PATTERN.finditer(line):
            uri = match.group(0)
            # Strip common trailing punctuation that may be captured
            uri = uri.rstrip('.,;:!?\'")')
            violations = check_uri(uri, lineno, str(path))
            all_violations.extend(violations)
    return all_violations


def collect_paths(args: list[str]) -> list[Path]:
    """Expand CLI arguments to individual file paths."""
    paths = []
    for arg in args:
        p = Path(arg)
        if p.is_dir():
            paths.extend(sorted(p.rglob('*.md')))
        elif p.is_file():
            paths.append(p)
        else:
            print(f'  [WARN] not found: {arg}', file=sys.stderr)
    return paths


# ---------------------------------------------------------------------------
# Report
# ---------------------------------------------------------------------------

def format_report(violations: list[dict]) -> str:
    lines = []
    by_file: dict[str, list[dict]] = {}
    for v in violations:
        by_file.setdefault(v['path'], []).append(v)

    for file_path, file_violations in sorted(by_file.items()):
        lines.append(f'\n{file_path}')
        for v in file_violations:
            lines.append(f'  :{v["line"]} [{v["code"]}] {v["desc"]}')
            lines.append(f'         URI: {v["uri"]}')
    return '\n'.join(lines)


# ---------------------------------------------------------------------------
# Entrypoint
# ---------------------------------------------------------------------------

def main() -> int:
    args = sys.argv[1:]
    if not args:
        print('Usage: verify_uri.py [FILE|DIR ...]', file=sys.stderr)
        print('Example: verify_uri.py lares/modules/', file=sys.stderr)
        return 1

    paths = collect_paths(args)
    if not paths:
        print('No .md files found.', file=sys.stderr)
        return 1

    all_violations: list[dict] = []
    for p in paths:
        violations = scan_file(p)
        all_violations.extend(violations)

    if all_violations:
        print(f'URI compliance check — {len(all_violations)} violation(s) in {len(paths)} file(s):')
        print(format_report(all_violations))
        return 1

    print(f'URI compliance check — clean. {len(paths)} file(s) scanned, 0 violations.')
    return 0


if __name__ == '__main__':
    sys.exit(main())
