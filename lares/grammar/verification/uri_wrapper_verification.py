# ∞ → lares:///grammar.verification.defines/uri_wrapper_verification/
"""
uri_wrapper_verification.py

Automated test for enforcing URI wrapper compliance in Lares grammar files.
Checks that each file starts with a valid opening URI wrapper and ends with a valid closing wrapper.
Supports --fix (in-place repair), --json (structured output), and per-failure suggested fixes.
"""
import re
import sys
import json
import os
import importlib.util
from pathlib import Path

START_PATTERN      = re.compile(r'^<!--\s*∞\s*→\s*lares:///.+-->')
END_PATTERN        = re.compile(r'^<!--\s*→\s*\?\s*-->')

# --- Marker grammar (four kahua surfaces) ---
# locus   <!-- ∞ → lares:///ha.ka.ba[/path][?params] -->          file-level opener
# ahu     <!-- ahu lares:///ha.ka.ba[/path][?params][#section] --> bookmark (no stances/chrono)
# kahea   <!-- kahea lares:///ha.ka.ba[/path][?params][#section] --> transclusion pull
# lares   lares:///ha.ka.ba[/path][?params][#chrono]               bare daemon pointer (needs stances+chrono)
AHU_MARKER_PATTERN   = re.compile(r'<!--\s*ahu\s+(lares:///[^\s>]+?)\s*-->')
KAHEA_MARKER_PATTERN = re.compile(r'<!--\s*kahea\s+(lares:///[^\s>]+?)\s*-->')
AHU_SKIP_PATTERN     = re.compile(r'<!--\s*ahu\s+lares:///')   # excludes ahu lines from bare scan
_HAKABA_URI          = re.compile(
    r'^lares:///[a-zA-Z0-9_\-]+\.[a-zA-Z0-9_\-]+\.[a-zA-Z0-9_\-][^?#\s]*'
    r'(?:\?[^#\s]*)?(?:#[a-zA-Z0-9_\-]+)?$'
)
_VALID_URI         = r'(lares:///[a-zA-Z0-9_][a-zA-Z0-9_\-]*\.[a-zA-Z0-9_][a-zA-Z0-9_\-]*\.[a-zA-Z0-9_][^\s\'"<>`\])\}]*)'
BARE_MD_PATTERN    = re.compile(r'(?<!`)' + _VALID_URI + r'(?!`)')
BARE_HASH_PATTERN  = re.compile(r'^\s*#\s+' + _VALID_URI)
BARE_SLASH_PATTERN = re.compile(r'^\s*//\s+' + _VALID_URI)
CHRONOMETER_REGEX  = re.compile(r'^(O|Ø|D|A|Å)\d+(\.(O|Ø|D|A|Å)\d+){4}$')

_BARE_PATTERNS: dict[str, re.Pattern] = {
    '.md':   BARE_MD_PATTERN,
    '.py':   BARE_HASH_PATTERN,
    '.sh':   BARE_HASH_PATTERN,
    '.js':   BARE_SLASH_PATTERN,
    '.ts':   BARE_SLASH_PATTERN,
    '.c':    BARE_SLASH_PATTERN,
    '.cpp':  BARE_SLASH_PATTERN,
    '.java': BARE_SLASH_PATTERN,
}

URI_PLACEHOLDER      = 'ha.ka.ba'

# Per-extension wrapper patterns and canonical templates
_WRAPPER_PATTERNS = {
    '.md':   (re.compile(r'^<!--\s*∞\s*→\s*lares:///.+-->'),    re.compile(r'^<!--\s*→\s*\?\s*-->'),
              '<!-- ∞ → lares:///PLACEHOLDER -->\n',             '<!-- → ? -->'),
    '.py':   (re.compile(r'^#\s*∞\s*→\s*lares:///.+'),          re.compile(r'^#\s*→\s*\?\s*$'),
              '# ∞ → lares:///PLACEHOLDER\n',                    '# → ?'),
    '.sh':   (re.compile(r'^#\s*∞\s*→\s*lares:///.+'),          re.compile(r'^#\s*→\s*\?\s*$'),
              '# ∞ → lares:///PLACEHOLDER\n',                    '# → ?'),
    '.js':   (re.compile(r'^//\s*∞\s*→\s*lares:///.+'),         re.compile(r'^//\s*→\s*\?\s*$'),
              '// ∞ → lares:///PLACEHOLDER\n',                   '// → ?'),
    '.ts':   (re.compile(r'^//\s*∞\s*→\s*lares:///.+'),         re.compile(r'^//\s*→\s*\?\s*$'),
              '// ∞ → lares:///PLACEHOLDER\n',                   '// → ?'),
}
_DEFAULT_WRAPPER = _WRAPPER_PATTERNS['.md']


def _wrapper_patterns(ext: str):
    return _WRAPPER_PATTERNS.get(ext, _DEFAULT_WRAPPER)


def _canonical_start_for(ext: str, uri_path: str | None = None) -> str:
    _, _, start_tmpl, _ = _wrapper_patterns(ext)
    return start_tmpl.replace('PLACEHOLDER', uri_path if uri_path else URI_PLACEHOLDER)


def _canonical_end_for(ext: str) -> str:
    return _wrapper_patterns(ext)[3]


def _load_parse_uri():
    """Locate and load parse_uri.py relative to this file."""
    candidates = [
        os.path.join(os.path.dirname(os.path.dirname(__file__)), 'parse-uri', 'parse_uri.py'),
        os.path.join(os.path.dirname(os.path.dirname(__file__)), 'uri', 'parse_uri.py'),
    ]
    for path in candidates:
        if os.path.exists(path):
            spec = importlib.util.spec_from_file_location('parse_uri', path)
            mod  = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(mod)
            return mod
    return None


def _uri_stream_issues(uri: str) -> list[str]:
    """Return list of missing operator-stream fields for a lares:/// URI."""
    issues = []
    if not re.search(r'[?&]stances=', uri):
        issues.append('missing stances=')
    frag_m = re.search(r'#([^#\s]+)\s*$', uri)
    if not (frag_m and CHRONOMETER_REGEX.match(frag_m.group(1))):
        issues.append('missing chronometer fragment')
    return issues


def scan_marker_syntax(lines: list[str]) -> list[dict]:
    """
    Validate ahu and kahea marker URIs for canonical ha.ka.ba structure.
    ahu/kahea are bookmarks and transclusion pulls — fragment is a plain section name, not chronometer.
    Returns violations where the URI does not match canonical ha.ka.ba form.
    """
    violations = []
    body = lines[1:-1] if len(lines) > 2 else []
    for offset, line in enumerate(body, start=2):
        raw = line.rstrip('\n')
        for pat, surface in ((AHU_MARKER_PATTERN, 'ahu'), (KAHEA_MARKER_PATTERN, 'kahea')):
            for m in pat.finditer(raw):
                uri = m.group(1)
                if not _HAKABA_URI.match(uri):
                    violations.append({
                        'line': offset, 'surface': surface, 'uri': uri,
                        'issues': ['URI does not match canonical ha.ka.ba form'],
                    })
    return violations


def scan_stream_uris(lines: list[str], ext: str = '.md') -> list[dict]:
    """
    Scan file body for bare lares:/// operator-stream pointers missing stances= or chronometer.
    ahu markers are bookmarks — excluded. Lines 1 and last (wrappers) are skipped.
    """
    bare_pat = _BARE_PATTERNS.get(ext, BARE_MD_PATTERN)
    violations = []
    body = lines[1:-1] if len(lines) > 2 else []
    for offset, line in enumerate(body, start=2):
        raw = line.rstrip('\n')
        if AHU_SKIP_PATTERN.search(raw):
            continue
        for m in bare_pat.finditer(raw):
            uri = m.group(1).rstrip('.,;)')
            issues = _uri_stream_issues(uri)
            if issues:
                violations.append({'line': offset, 'surface': 'bare',
                                   'uri': uri, 'issues': issues})
    return violations


def extract_uri_from_wrapper(line: str) -> str | None:
    """Extract the lares:/// path segment from a wrapper comment line."""
    m = re.search(r'lares:///([^ >]+)', line)
    return m.group(1).rstrip() if m else None


def check_uri_wrappers(file_path: Path) -> dict:
    """
    Return a result dict:
      pass (bool), start_ok (bool), end_ok (bool),
      uri (str|None), uri_valid (bool), uri_error (str|None),
      suggested_fix (dict), lines (list[str])
    """
    with file_path.open('r', encoding='utf-8') as f:
        lines = f.readlines()

    ext = file_path.suffix.lower()
    start_pat, end_pat, _, _ = _wrapper_patterns(ext)

    if not lines:
        return {
            'pass': False, 'start_ok': False, 'end_ok': False,
            'uri': None, 'uri_valid': False, 'uri_error': 'Empty file',
            'suggested_fix': {
                'start': _canonical_start_for(ext),
                'end': _canonical_end_for(ext),
            },
            'lines': lines,
        }

    start_ok = bool(start_pat.match(lines[0].strip()))
    end_ok   = bool(end_pat.match(lines[-1].strip()))

    uri       = extract_uri_from_wrapper(lines[0].strip()) if start_ok else None
    uri_valid = True
    uri_error = None

    if uri:
        parse_uri = _load_parse_uri()
        if parse_uri:
            ok, msg = parse_uri.validate_lares_uri(f'lares:///{uri}')
            if not ok:
                uri_valid = False
                uri_error = msg
                start_ok  = False

    fix: dict = {}
    if not start_ok:
        fix['start'] = _canonical_start_for(ext, uri)
    if not end_ok:
        fix['end'] = _canonical_end_for(ext)

    passed = start_ok and end_ok and uri_valid

    return {
        'pass': passed,
        'start_ok': start_ok,
        'end_ok': end_ok,
        'uri': f'lares:///{uri}' if uri else None,
        'uri_valid': uri_valid,
        'uri_error': uri_error,
        'suggested_fix': fix,
        'lines': lines,
    }


def fix_file(file_path: Path, result: dict) -> bool:
    """Insert/replace missing wrappers in-place. Returns True if modified."""
    if result['pass']:
        return False

    lines = list(result['lines'])
    fix   = result['suggested_fix']

    ext = file_path.suffix.lower()
    start_pat, end_pat, _, _ = _wrapper_patterns(ext)

    if fix.get('start'):
        if lines and start_pat.match(lines[0].strip()):
            lines[0] = fix['start']
        else:
            lines.insert(0, fix['start'])

    if fix.get('end'):
        if lines and not lines[-1].endswith('\n'):
            lines[-1] += '\n'
        if lines and end_pat.match(lines[-1].strip()):
            lines[-1] = fix['end'] + '\n'
        else:
            lines.append(fix['end'] + '\n')

    with file_path.open('w', encoding='utf-8') as f:
        f.writelines(lines)
    return True


def main():
    import argparse
    parser = argparse.ArgumentParser(
        description='Verify (and optionally fix) URI wrapper compliance in a Lares grammar file.'
    )
    parser.add_argument('file', help='Path to the file to verify')
    parser.add_argument('--json', action='store_true', help='Output structured JSON result')
    parser.add_argument('--fix',    action='store_true', help='Auto-insert/correct missing wrappers in-place')
    parser.add_argument('--stream', action='store_true',
                        help='Check bare lares:/// live pointers for required stances= and chronometer fragment')
    parser.add_argument('--markers', action='store_true',
                        help='Check ahu and kahea marker URIs for canonical ha.ka.ba structure')
    args = parser.parse_args()

    file_path = Path(args.file)
    if not file_path.exists():
        msg = f'File not found: {file_path}'
        if args.json:
            print(json.dumps({'pass': False, 'error': msg}))
        else:
            print(msg)
        sys.exit(1)

    result = check_uri_wrappers(file_path)
    fixed  = False

    if args.fix and not result['pass']:
        fixed = fix_file(file_path, result)
        if fixed:
            result = check_uri_wrappers(file_path)

    stream_violations: list[dict] = []
    marker_violations: list[dict] = []
    if args.stream:
        stream_violations = scan_stream_uris(result['lines'], file_path.suffix.lower())
    if args.markers:
        marker_violations = scan_marker_syntax(result['lines'])

    # Strip internal-only fields before output
    output = {k: v for k, v in result.items() if k != 'lines'}
    output['path'] = str(file_path)
    if fixed:
        output['fixed'] = True
    if args.stream:
        output['stream_violations'] = stream_violations
        output['stream_pass'] = len(stream_violations) == 0
    if args.markers:
        output['marker_violations'] = marker_violations
        output['markers_pass'] = len(marker_violations) == 0

    overall_pass = (
        result['pass']
        and (not args.stream  or len(stream_violations)  == 0)
        and (not args.markers or len(marker_violations) == 0)
    )

    if args.json:
        print(json.dumps(output, indent=2))
    else:
        if result['pass']:
            print(f'[PASS] {file_path} — wrapper OK.')
            if fixed:
                print('  (wrappers were auto-inserted)')
        else:
            print(f'[FAIL] {file_path} — wrapper invalid.')
            if not result['start_ok']:
                fix_hint = result['suggested_fix'].get('start', '')
                print(f'  Start: MISSING/INVALID  →  suggested: {fix_hint.rstrip()}')
            if not result['end_ok']:
                fix_hint = result['suggested_fix'].get('end', '')
                print(f'  End:   MISSING/INVALID  →  suggested: {fix_hint}')
            if result['uri_error']:
                print(f'  URI error: {result["uri_error"]}')
        if args.stream:
            if stream_violations:
                print(f'[STREAM FAIL] {len(stream_violations)} bare pointer(s) missing stances/chronometer:')
                for v in stream_violations:
                    print(f'  line {v["line"]} [{v["surface"]}] {v["uri"]}')
                    for issue in v['issues']:
                        print(f'    — {issue}')
            else:
                print('[STREAM PASS] All bare lares:/// pointers carry stances and chronometer.')
        if args.markers:
            if marker_violations:
                print(f'[MARKERS FAIL] {len(marker_violations)} ahu/kahea marker(s) with malformed URI:')
                for v in marker_violations:
                    print(f'  line {v["line"]} [{v["surface"]}] {v["uri"]}')
                    for issue in v['issues']:
                        print(f'    — {issue}')
            else:
                print('[MARKERS PASS] All ahu and kahea markers have canonical ha.ka.ba URIs.')

    sys.exit(0 if overall_pass else 2)


if __name__ == '__main__':
    main()
# → ?
