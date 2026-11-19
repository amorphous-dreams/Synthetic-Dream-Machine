import json, re, collections, sys
R = json.load(open(sys.argv[1]))
SELF = 'a688ffa1d'
P = {  # in, w5m, w1h, hit, out  (USD/MTok, platform.claude.com pricing, fetched 2026-10-29)
    'claude-fable-5-1': (10, 12.5, 20, 0.25, 50),
    'claude-opus-5-5': (4, 5, 8, 0.20, 20),
    'claude-sonnet-5-5': (2, 2.5, 4, 0.10, 10),
}
NAMES = {'abdb5b830': 'Walk-Wright', 'a601861f0': 'Mirror-Wright', 'a8c6bef52': 'Founding-Wright', 'a0a25924b': 'Spec-Crucible',
         'a6bccf59f': 'Hive-Wright', 'a10b58a41': 'Realm-Scout', 'a51ee03e8': 'Spec-Scout', 'a39a6e698': 'True-Hand',
         'aea01390f': 'Contract-Clerk', 'aaa96950e': 'Relay-Wright', 'a55ab3f14': 'Porch-Wright', 'accb35cd9': 'Test-Wright'}

def role(r):
    d = r['desc'] or ''
    if re.search(r'Migrate|Fold reader C fixes|Artifact seat|Ink-|true-up|consolidate|tier stats', d): return 'helper'
    if re.search(r'[Rr]ead|Crucible|crucible|Aftermath', d) and 'Wright' not in d.split(':')[0]: return 'reader'
    if 'Wright' in d.split(':')[0] and not re.search(r'frozen spirit scout', d): return 'lead'
    return 'scout'

def model(r):
    m = {k: v for k, v in r['models'].items() if k != '<synthetic>'}
    return max(m, key=m.get) if m else None

def cost(r):
    p = P.get(model(r))
    if not p: return None
    u = r['usage']
    cw = u.get('cache_creation_input_tokens', 0)
    w1h = u.get('w1h', 0); w5m = u.get('w5m', 0) + max(0, cw - w1h - u.get('w5m', 0))
    parts = dict(inp=u.get('input_tokens', 0) * p[0], w5m=w5m * p[1], w1h=w1h * p[2], hit=u.get('cache_read_input_tokens', 0) * p[3], out=u.get('output_tokens', 0) * p[4])
    return {k: v / 1e6 for k, v in parts.items()}

def era(r):
    return 'today' if r['t0'] >= 1761728400 - 0 and False else None

rows = []
for r in R:
    if r['id'].startswith(SELF): continue
    r['role'] = role(r); r['model'] = model(r); r['cost'] = cost(r)
    r['name'] = NAMES.get(r['id'][:9], '')
    r['ntools'] = sum(r['tools'].values())
    rows.append(r)
json.dump(rows, open(sys.argv[2], 'w'))
