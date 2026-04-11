"""
uri_wrapper_verification.py

Automated test for enforcing URI wrapper compliance in Lares grammar files.
Checks that each file starts with a valid opening URI wrapper and ends with a valid closing wrapper.
"""
import re
import sys
from pathlib import Path

def extract_uri_from_wrapper(line: str) -> str:
    """Extract the lares: URI from a wrapper comment line."""
    m = re.search(r'lares://[^ >]+', line)
    return m.group(0) if m else None

def check_uri_wrappers(file_path: Path) -> bool:
    with file_path.open('r', encoding='utf-8') as f:
        lines = f.readlines()
    if not lines:
        return False
    start_pattern = re.compile(r'^<!--\s*∞\s*→\s*lares:///.+-->')
    end_pattern = re.compile(r'^<!--\s*→\s*\?\s*-->')
    start_ok = bool(start_pattern.match(lines[0].strip()))
    end_ok = bool(end_pattern.match(lines[-1].strip()))
    # Canonical URI validation (start wrapper only)
    uri = extract_uri_from_wrapper(lines[0].strip()) if start_ok else None
    if uri:
        # Import and call validate_lares_uri from parse_uri.py
        import importlib.util
        import os
        parse_uri_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "uri", "parse_uri.py")
        spec = importlib.util.spec_from_file_location("parse_uri", parse_uri_path)
        parse_uri = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(parse_uri)
        ok, msg = parse_uri.validate_lares_uri(uri)
        if not ok:
            print(f"[FAIL] {file_path} wrapper URI not canonical: {msg}")
            return False
    return start_ok and end_ok

def main():
    if len(sys.argv) < 2:
        print('Usage: python uri_wrapper_verification.py <file>')
        sys.exit(1)
    file_path = Path(sys.argv[1])
    if not file_path.exists():
        print(f'File not found: {file_path}')
        sys.exit(1)
    if check_uri_wrappers(file_path):
        print(f'[PASS] {file_path} has valid URI wrappers.')
        sys.exit(0)
    else:
        print(f'[FAIL] {file_path} is missing required URI wrappers.')
        sys.exit(2)

if __name__ == '__main__':
    main()
