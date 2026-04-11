# ∞ → lares:///grammar.detect-alignment.defines/detect_alignment/
"""
detect_alignment.py

Batch scanner for lares URI wrapper and consecration alignment in Lares grammar and code files.
Scans all Markdown, code, and text files in a target directory for required start/end lares URI wrappers.
Prompts the operator with a summary of failures and options for next steps.
"""
import re
import sys
import json
from pathlib import Path

# Operator stream URI emission surfaces:
#   Markdown/HTML ahu markers:  <!-- ahu lares:///... -->
#   Code ahu markers:           # ahu lares:///...   (Python/sh)
#                               // ahu lares:///...  (JS/TS)
#   Bare pointers in Markdown prose (not in backtick/code-fence spans)
#   Bare pointers in comment lines of code files (not in string literals)
# Both surfaces require stances= query param AND a chronometer fragment.
AHU_MD_PATTERN     = re.compile(r'<!--\s*ahu\s+(lares:///[^\s>]+)\s*-->')
AHU_HASH_PATTERN   = re.compile(r'^#\s+ahu\s+(lares:///\S+)')    # Python/sh comment
AHU_SLASH_PATTERN  = re.compile(r'^//\s+ahu\s+(lares:///\S+)')   # JS/TS comment
# Valid ha.ka.ba URI segment — must start with word chars (excludes regex/template fragments)
_VALID_URI = r'(lares:///[a-zA-Z0-9_][a-zA-Z0-9_\-]*\.[a-zA-Z0-9_][a-zA-Z0-9_\-]*\.[a-zA-Z0-9_][^\s\'"<>`\])\}]*)'
# Bare in Markdown: not inside backtick spans
BARE_MD_PATTERN    = re.compile(r'(?<!`)' + _VALID_URI + r'(?!`)')
# Bare in code: only on comment lines
BARE_HASH_PATTERN  = re.compile(r'^\s*#\s+' + _VALID_URI)
BARE_SLASH_PATTERN = re.compile(r'^\s*//\s+' + _VALID_URI)
CHRONOMETER_REGEX  = re.compile(r'^(O|Ø|D|A|Å)\d+(\.(O|Ø|D|A|Å)\d+){4}$')

# Per-extension stream scanner config: (ahu_pattern, bare_pattern)
_STREAM_PATTERNS: dict[str, tuple] = {
    '.md':   (AHU_MD_PATTERN,    BARE_MD_PATTERN),
    '.py':   (AHU_HASH_PATTERN,  BARE_HASH_PATTERN),
    '.sh':   (AHU_HASH_PATTERN,  BARE_HASH_PATTERN),
    '.js':   (AHU_SLASH_PATTERN, BARE_SLASH_PATTERN),
    '.ts':   (AHU_SLASH_PATTERN, BARE_SLASH_PATTERN),
    '.c':    (AHU_SLASH_PATTERN, BARE_SLASH_PATTERN),
    '.cpp':  (AHU_SLASH_PATTERN, BARE_SLASH_PATTERN),
    '.java': (AHU_SLASH_PATTERN, BARE_SLASH_PATTERN),
}


def _uri_stream_issues(uri: str) -> list[str]:
    """Return list of missing stream fields for an operator-stream URI."""
    issues = []
    has_stances = bool(re.search(r'[?&]stances=', uri))
    frag_m = re.search(r'#([^#\s]+)\s*$', uri)
    has_chrono = bool(frag_m and CHRONOMETER_REGEX.match(frag_m.group(1)))
    if not has_stances:
        issues.append('missing stances=')
    if not has_chrono:
        issues.append('missing chronometer fragment')
    return issues


def scan_stream_uris(lines: list[str], ext: str = '.md') -> list[dict]:
    """
    Scan file lines for operator-stream URI emission points (ahu markers and
    bare lares:/// pointers) and return violations missing stances or chronometer.
    Lines 1 and last are start/end wrappers — skipped.
    Uses per-extension patterns so Python string literals are not matched.
    """
    ahu_pat, bare_pat = _STREAM_PATTERNS.get(ext, (AHU_MD_PATTERN, BARE_MD_PATTERN))
    violations = []
    body = lines[1:-1] if len(lines) > 2 else []
    for offset, line in enumerate(body, start=2):
        raw = line.rstrip('\n')
        for m in ahu_pat.finditer(raw):
            uri = m.group(1)
            issues = _uri_stream_issues(uri)
            if issues:
                violations.append({'line': offset, 'surface': 'ahu', 'uri': uri, 'issues': issues})
        if not ahu_pat.search(raw):
            for m in bare_pat.finditer(raw):
                uri = m.group(1).rstrip('.,;)')
                issues = _uri_stream_issues(uri)
                if issues:
                    violations.append({'line': offset, 'surface': 'bare', 'uri': uri, 'issues': issues})
    return violations


COMMENT_PATTERNS = {
    '.md':   (r'^<!--\s*∞\s*→\s*lares:///.+-->$',    r'^<!--\s*→\s*\?\s*-->$'),
    '.py':   (r'^#\s*∞\s*→\s*lares:///.+',            r'^#\s*→\s*\?\s*$'),
    '.sh':   (r'^#\s*∞\s*→\s*lares:///.+',            r'^#\s*→\s*\?\s*$'),
    '.js':   (r'^//\s*∞\s*→\s*lares:///.+',           r'^//\s*→\s*\?\s*$'),
    '.ts':   (r'^//\s*∞\s*→\s*lares:///.+',           r'^//\s*→\s*\?\s*$'),
    '.c':    (r'^/\*\s*∞\s*→\s*lares:///.+\*/$',      r'^/\*\s*→\s*\?\s*\*/$'),
    '.cpp':  (r'^/\*\s*∞\s*→\s*lares:///.+\*/$',      r'^/\*\s*→\s*\?\s*\*/$'),
    '.java': (r'^/\*\s*∞\s*→\s*lares:///.+\*/$',      r'^/\*\s*→\s*\?\s*\*/$'),
}

# Canonical wrapper templates — start uses PLACEHOLDER for the URI path
CANONICAL_WRAPPERS = {
    '.md':   ('<!-- ∞ → lares:///PLACEHOLDER -->\n', '<!-- → ? -->'),
    '.py':   ('# ∞ → lares:///PLACEHOLDER\n',         '# → ?'),
    '.sh':   ('# ∞ → lares:///PLACEHOLDER\n',         '# → ?'),
    '.js':   ('// ∞ → lares:///PLACEHOLDER\n',        '// → ?'),
    '.ts':   ('// ∞ → lares:///PLACEHOLDER\n',        '// → ?'),
    '.c':    ('/* ∞ → lares:///PLACEHOLDER */\n',     '/* → ? */'),
    '.cpp':  ('/* ∞ → lares:///PLACEHOLDER */\n',     '/* → ? */'),
    '.java': ('/* ∞ → lares:///PLACEHOLDER */\n',     '/* → ? */'),
}

URI_PLACEHOLDER = 'ha.ka.ba'


def _extract_existing_uri(line: str) -> str | None:
    """Return the lares:/// path from an existing start wrapper, or None."""
    m = re.search(r'lares:///([^ >*]+)', line)
    return m.group(1).rstrip() if m else None


def _canonical_start(ext: str, uri_path: str | None = None) -> str:
    tmpl, _ = CANONICAL_WRAPPERS[ext]
    path = uri_path if uri_path else URI_PLACEHOLDER
    return tmpl.replace('PLACEHOLDER', path)


def _canonical_end(ext: str) -> str:
    _, end = CANONICAL_WRAPPERS[ext]
    return end


def check_uri_wrappers(lines, ext):
    start_pat, end_pat = COMMENT_PATTERNS.get(ext, (None, None))
    if not start_pat or not end_pat:
        return True, True  # Ignore unknown types
    start_ok = bool(lines and re.match(start_pat, lines[0].strip()))
    end_ok = bool(lines and re.match(end_pat, lines[-1].strip()))
    return start_ok, end_ok


def suggested_fix(lines, ext) -> dict:
    """Return suggested start/end wrapper strings for a file."""
    start_ok, end_ok = check_uri_wrappers(lines, ext)
    existing_uri = _extract_existing_uri(lines[0].strip()) if lines else None
    return {
        'start': _canonical_start(ext, existing_uri) if not start_ok else None,
        'end': _canonical_end(ext) if not end_ok else None,
    }


def fix_file(file_path: Path, lines: list[str], ext: str) -> bool:
    """Insert missing wrappers in-place. Returns True if the file was modified."""
    start_ok, end_ok = check_uri_wrappers(lines, ext)
    if start_ok and end_ok:
        return False

    existing_uri = _extract_existing_uri(lines[0].strip()) if lines else None

    if not start_ok:
        lines.insert(0, _canonical_start(ext, existing_uri))

    if not end_ok:
        # Ensure file ends with a newline before appending the end wrapper
        if lines and not lines[-1].endswith('\n'):
            lines[-1] += '\n'
        lines.append(_canonical_end(ext) + '\n')

    with file_path.open('w', encoding='utf-8') as f:
        f.writelines(lines)
    return True


def scan_directory(target_dir, check_stream=False):
    failures = []
    SKIP_DIRS = {'__pycache__', '.git', 'node_modules'}

    # Check for missing LOCI.md in each nested directory
    for dir_path in Path(target_dir).rglob('*'):
        if dir_path.is_dir() and dir_path.name not in SKIP_DIRS:
            loci_file = dir_path / 'LOCI.md'
            if not loci_file.exists():
                failures.append({
                    'path': str(loci_file),
                    'type': 'dir',
                    'issue': 'MISSING_LOCI',
                    'start_ok': None,
                    'end_ok': None,
                    'lines': None,
                })
    # Check file wrappers (and optionally stream URI fields)
    for file_path in Path(target_dir).rglob('*'):
        if not file_path.is_file():
            continue
        if any(p in SKIP_DIRS for p in file_path.parts):
            continue
        ext = file_path.suffix.lower()
        if ext not in COMMENT_PATTERNS:
            continue
        with file_path.open('r', encoding='utf-8') as f:
            lines = f.readlines()
        start_ok, end_ok = check_uri_wrappers(lines, ext)
        if not (start_ok and end_ok):
            failures.append({
                'path': str(file_path),
                'type': ext,
                'issue': 'WRAPPER',
                'start_ok': start_ok,
                'end_ok': end_ok,
                'lines': lines,
            })
        if check_stream:
            violations = scan_stream_uris(lines, ext)
            for v in violations:
                failures.append({
                    'path': str(file_path),
                    'type': ext,
                    'issue': 'STREAM_FIELDS',
                    'line': v['line'],
                    'surface': v['surface'],
                    'uri': v['uri'],
                    'issues': v['issues'],
                    'lines': None,
                })
    return failures


def prompt_operator(failures, as_json=False, do_fix=False):
    result = {
        'failures': [],
        'operator_options': [
            'Auto-fix all missing wrappers (insert standard tags)',
            'Review and fix manually',
            'Ignore for now',
        ],
    }
    for fail in failures:
        if fail['issue'] == 'MISSING_LOCI':
            entry = {
                'path': fail['path'],
                'type': 'dir',
                'issue': 'MISSING_LOCI',
                'message': f"[DIR] MISSING LOCI.md file: {fail['path']}",
            }
            result['failures'].append(entry)
        elif fail['issue'] == 'STREAM_FIELDS':
            entry = {
                'path': fail['path'],
                'type': fail['type'],
                'issue': 'STREAM_FIELDS',
                'line': fail['line'],
                'surface': fail['surface'],
                'uri': fail['uri'],
                'issues': fail['issues'],
                'message': (
                    f"{fail['path']}:{fail['line']} [{fail['surface']}] "
                    f"{fail['uri']} — {', '.join(fail['issues'])}"
                ),
            }
            result['failures'].append(entry)
        else:
            fix = suggested_fix(fail['lines'], fail['type'])
            entry = {
                'path': fail['path'],
                'type': fail['type'],
                'issue': 'WRAPPER',
                'start_ok': fail['start_ok'],
                'end_ok': fail['end_ok'],
                'message': (
                    f"{fail['path']} ({fail['type']}) | "
                    f"Start: {'OK' if fail['start_ok'] else 'MISSING'} | "
                    f"End: {'OK' if fail['end_ok'] else 'MISSING'}"
                ),
                'suggested_fix': {k: v for k, v in fix.items() if v is not None},
            }

            if do_fix:
                fixed = fix_file(Path(fail['path']), fail['lines'], fail['type'])
                entry['fixed'] = fixed

            result['failures'].append(entry)

    if as_json:
        print(json.dumps(result, indent=2))
    else:
        print("\n[SCAN RESULT] Alignment/Consecration Failures:")
        for f in result['failures']:
            print(f"- {f['message']}")
            fix_hints = f.get('suggested_fix', {})
            if fix_hints.get('start'):
                print(f"  Suggested start: {fix_hints['start'].rstrip()}")
            if fix_hints.get('end'):
                print(f"  Suggested end:   {fix_hints['end']}")
            if do_fix:
                status = 'FIXED' if f.get('fixed') else 'unchanged'
                print(f"  [{status}]")
        if not do_fix:
            print("\nOperator options:")
            for i, opt in enumerate(result['operator_options'], 1):
                print(f"{i}. {opt}")
            print("\nWhat would you like to do? (1/2/3)")
    return result


def main():
    import argparse
    parser = argparse.ArgumentParser(
        description='Detect alignment and LOCI.md compliance in Lares grammar/code files.'
    )
    parser.add_argument('target_dir', help='Target directory to check')
    parser.add_argument('--json',   action='store_true', help='Output results as JSON for AI/agent consumption')
    parser.add_argument('--report', type=str, default=None, help='Write full JSON batch report to file')
    parser.add_argument('--fix',    action='store_true', help='Auto-insert missing wrappers in-place')
    parser.add_argument('--stream', action='store_true',
                        help='Also check ahu markers and bare lares:/// URIs for required stances= and chronometer fragment')
    args = parser.parse_args()

    failures = scan_directory(args.target_dir, check_stream=args.stream)
    if failures:
        result = prompt_operator(failures, as_json=args.json, do_fix=args.fix)
        if args.report:
            with open(args.report, 'w', encoding='utf-8') as f:
                json.dump(result, f, indent=2)
        sys.exit(2)
    else:
        pass_result = {'status': 'PASS', 'message': 'All files have valid lares URI wrappers and LOCI.md files.'}
        if args.report:
            with open(args.report, 'w', encoding='utf-8') as f:
                json.dump(pass_result, f, indent=2)
        if args.json:
            print(json.dumps(pass_result, indent=2))
        else:
            print('[PASS] All files have valid lares URI wrappers and LOCI.md files.')
        sys.exit(0)


if __name__ == '__main__':
    main()
# → ?
