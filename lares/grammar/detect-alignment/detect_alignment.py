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

COMMENT_PATTERNS = {
    '.md': (r'^<!--\s*∞\s*→\s*lares:///.+-->$', r'^<!--\s*→\s*\?\s*-->$'),
    '.py': (r'^#\s*∞\s*→\s*lares:///.+', r'^#\s*→\s*\?\s*$'),
    '.sh': (r'^#\s*∞\s*→\s*lares:///.+', r'^#\s*→\s*\?\s*$'),
    '.js': (r'^//\s*∞\s*→\s*lares:///.+', r'^//\s*→\s*\?\s*$'),
    '.ts': (r'^//\s*∞\s*→\s*lares:///.+', r'^//\s*→\s*\?\s*$'),
    '.c': (r'^/\*\s*∞\s*→\s*lares:///.+\*/$', r'^/\*\s*→\s*\?\s*\*/$'),
    '.cpp': (r'^/\*\s*∞\s*→\s*lares:///.+\*/$', r'^/\*\s*→\s*\?\s*\*/$'),
    '.java': (r'^/\*\s*∞\s*→\s*lares:///.+\*/$', r'^/\*\s*→\s*\?\s*\*/$'),
}

def check_uri_wrappers(lines, ext):
    start_pat, end_pat = COMMENT_PATTERNS.get(ext, (None, None))
    if not start_pat or not end_pat:
        return True, True  # Ignore unknown types
    start_ok = bool(lines and re.match(start_pat, lines[0].strip()))
    end_ok = bool(lines and re.match(end_pat, lines[-1].strip()))
    return start_ok, end_ok

def scan_directory(target_dir):
    failures = []
    # Check for missing LOCI.md in each nested directory
    for dir_path in Path(target_dir).rglob('*'):
        if dir_path.is_dir():
            loci_file = dir_path / 'LOCI.md'
            if not loci_file.exists():
                failures.append({
                    'path': str(loci_file),
                    'type': 'dir',
                    'issue': 'MISSING_LOCI',
                    'start_ok': None,
                    'end_ok': None
                })
    # Check file wrappers
    for file_path in Path(target_dir).rglob('*'):
        if not file_path.is_file():
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
                'end_ok': end_ok
            })
    return failures

def prompt_operator(failures, as_json=False):
    result = {
        'failures': [],
        'operator_options': [
            'Auto-fix all missing wrappers (insert standard tags)',
            'Review and fix manually',
            'Ignore for now'
        ]
    }
    for fail in failures:
        if fail['issue'] == 'MISSING_LOCI':
            result['failures'].append({
                'path': fail['path'],
                'type': 'dir',
                'issue': 'MISSING_LOCI',
                'message': f"[DIR] MISSING LOCI.md file: {fail['path']}"
            })
        else:
            result['failures'].append({
                'path': fail['path'],
                'type': fail['type'],
                'issue': 'WRAPPER',
                'start_ok': fail['start_ok'],
                'end_ok': fail['end_ok'],
                'message': f"{fail['path']} ({fail['type']}) | Start: {'OK' if fail['start_ok'] else 'MISSING'} | End: {'OK' if fail['end_ok'] else 'MISSING'}"
            })
    if as_json:
        print(json.dumps(result, indent=2))
    else:
        print("\n[SCAN RESULT] Alignment/Consecration Failures:")
        for f in result['failures']:
            print(f"- {f['message']}")
        print("\nOperator options:")
        for i, opt in enumerate(result['operator_options'], 1):
            print(f"{i}. {opt}")
        print("\nWhat would you like to do? (1/2/3)")
    return result

def main():
    import argparse
    parser = argparse.ArgumentParser(description='Detect alignment and LOCI.md compliance in Lares grammar/code files.')
    parser.add_argument('target_dir', help='Target directory to check')
    parser.add_argument('--json', action='store_true', help='Output results as JSON for AI/agent consumption')
    parser.add_argument('--report', type=str, default=None, help='Write full JSON batch report to file')
    args = parser.parse_args()
    failures = scan_directory(args.target_dir)
    if failures:
        result = prompt_operator(failures, as_json=args.json)
        if args.report:
            with open(args.report, 'w', encoding='utf-8') as f:
                json.dump(result, f, indent=2)
        if args.json:
            sys.exit(2)
        else:
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
