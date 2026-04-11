# ∞ → lares:///grammar.parse-uri.defines/parse_uri/
"""
parse_uri.py

Deterministic parser and validator for lares: URIs, enforcing canonical grammar as defined in:
- lares/grammar/uri/LOCI.md
- lares/modules/uri-schema/URI_SCHEMA.md
- lares/modules/uri-schema/URI_SCHEME_SPEC.md
- lares/modules/uri-schema/decide/CONVENTIONS.md
- lares/modules/uri-schema/assess/VERIFICATION.md

Usage:
    python parse_uri.py <uri>
    # Returns PASS/FAIL and error details

This script is intended for use in CI, agent, and batch verification.
"""
import re
import sys

# Canonical regex for lares: URI (record form, authority optional)
LARES_URI_REGEX = re.compile(r'''
^lares://
(?:([a-zA-Z0-9_\-]+:[a-zA-Z0-9_\-]+)@([a-zA-Z0-9_\-]+))? # authority (optional)
/
([a-zA-Z0-9_\-]+)\.([a-zA-Z0-9_\-]+)\.([a-zA-Z0-9_\-]+)   # ha.ka.ba path
(?:/[^?#]*)?                                                  # optional subpath
(?:\?([^#]+))?                                               # query (optional)
(?:\#(.+))?                                                   # fragment (optional)
$
''', re.VERBOSE)

STANCE_REGEX = re.compile(r'^stances=([\^\-\?\.]{5})$')
CONFIDENCE_REGEX = re.compile(r'^confidence=([A-Z]{1,2}:[0-9]+\.[0-9]+)$')
P_REGEX = re.compile(r'^p=([01](?:\.\d+)?)$')
CHRONOMETER_REGEX = re.compile(r'^(O|Ø|D|A|Å)\d+(\.(O|Ø|D|A|Å)\d+){4}$')


def parse_query(query):
    params = dict()
    if not query:
        return params
    for part in query.split('&'):
        if '=' not in part:
            continue
        k, v = part.split('=', 1)
        params[k] = v
    return params

def validate_lares_uri(uri):
    m = LARES_URI_REGEX.match(uri)
    if not m:
        return False, 'URI does not match canonical lares: syntax.'
    authority, host, ha, ka, ba, query, fragment = m.groups()
    # Path must have three slots
    if not (ha and ka and ba):
        return False, 'Path must have three HA.KA.BA slots.'
    # Query params
    params = parse_query(query)
    if params:
        if set(params.keys()) - {'stances', 'confidence', 'p'}:
            return False, f'Unknown query parameters: {set(params.keys()) - {"stances", "confidence", "p"}}'
        if 'stances' in params and not STANCE_REGEX.match(f'stances={params["stances"]}'):
            return False, 'Invalid stances encoding.'
        if 'confidence' in params and not CONFIDENCE_REGEX.match(f'confidence={params["confidence"]}'):
            return False, 'Invalid confidence encoding.'
        if 'p' in params and not P_REGEX.match(f'p={params["p"]}'):
            return False, 'Invalid p encoding.'
    # Fragment
    if fragment:
        if not CHRONOMETER_REGEX.match(fragment):
            return False, 'Fragment must be five dot-separated phase sigils and counters.'
    return True, 'PASS'


def validate_stream_uri(uri):
    """
    Validate a URI for use on the operator stream surface.
    Requires all base canonical rules PLUS stances= query param AND a chronometer fragment.
    """
    ok, msg = validate_lares_uri(uri)
    if not ok:
        return False, msg
    m = LARES_URI_REGEX.match(uri)
    assert m is not None  # guaranteed by validate_lares_uri passing
    _, _, _, _, _, query, fragment = m.groups()
    params = parse_query(query)
    if 'stances' not in params:
        return False, 'Operator stream URI requires stances= query parameter.'
    if not fragment:
        return False, 'Operator stream URI requires a chronometer fragment (#O1.Ø2.D3.A4.Å5 form).'
    if not CHRONOMETER_REGEX.match(fragment):
        return False, 'Fragment must be five dot-separated phase sigils and counters.'
    return True, 'PASS'


def main():
    if len(sys.argv) < 2:
        print('Usage: python parse_uri.py <uri>')
        sys.exit(1)
    uri = sys.argv[1]
    ok, msg = validate_lares_uri(uri)
    if ok:
        print(f'[PASS] {uri}')
        sys.exit(0)
    else:
        print(f'[FAIL] {uri}\nReason: {msg}')
        sys.exit(2)

if __name__ == '__main__':
    main()
# → ?
