#!/usr/bin/env bash
# domain-registry-witness — every domain-separation tag is unique, well-formed, and lives in the registry.
#
# ── WHY A DOMAIN TAG NEEDS A WITNESS AND A DOC DOES NOT ─────────────────────────────────────────
# A typo in a domain tag does not fail loudly. It silently mints a SECOND protocol whose signatures verify
# against nothing and whose derived keys open nothing — and every test that signs AND verifies with the
# same typo passes. Nothing surfaces until two vessels that should agree do not.
#
# So the invariant rides here rather than in a reader's care:
#   · UNIQUE      — two purposes never share a tag. Fusing them is the whole failure the tags prevent.
#   · WELL-FORMED — every tag reads `lar:///ha.ka.ba/lares/domain/<name>`, one ontology. The NAME does all
#                   the separating. A NEW domain mints bare through `mint`; the FROZEN set, reproduced
#                   through `frozen`, keeps an opaque `/v1` tail that versions nothing, and may only shrink.
#   · LISTED      — every declared domain sits in `ALL_DOMAINS`, the table the registry claims to be.
#   · REGISTERED  — no domain literal is written outside `domains.ts`. A tag typed at a call site is a
#                   tag nothing can audit, and it is how the two spellings arose in the first place. The
#                   scan reads TypeScript, JavaScript and Python, in double, single, backtick and `b"…"`
#                   quotes, and every spelling a domain has worn: the registry address, `lar-<name>/vN`,
#                   `lar/<name>`, `lares/<name>`, `lar:<name>:vN`, `lares <name> vN`. Comment lines are
#                   skipped: a comment signs nothing.
#
# KNOWN STRAYS stay VISIBLE. A literal already signing live records cannot move without re-keying what it
# signed, so each one sits on an explicit ALLOW list naming the stage that registers it. The witness prints
# every allowed stray on every run, and refuses any stray not on the list — the list is honest, not a mute.
#
# Prior art on the pattern itself: HKDF's `info` (RFC 5869), TLS 1.3's HkdfLabel (RFC 8446 §7.1), MLS's
# labelled signatures (RFC 9420), BIP-340 tagged hashes, EIP-712's domainSeparator. What they share is not
# the string — it is that the TABLE is the artifact, as multiformats makes plainest.
#
# Exit 0 = the registry holds.
set -uo pipefail
cd "$(dirname "$0")/.."

python3 - <<'PY'
import pathlib, re, sys

REG = pathlib.Path("packages/lararium-mesh/src/domains.ts")
if not REG.exists():
    print(f"[domain-registry] no registry at {REG}"); sys.exit(1)

src = REG.read_text()
decls = re.findall(r'^export const (\w+) = (mint|frozen)\("([a-z0-9-]+)"\);', src, re.M)
names = [(export, name) for export, _mint, name in decls]
frozen_names = [export for export, how, _n in decls if how == "frozen"]
root  = re.search(r'const DOMAIN_ROOT = "([^"]+)"', src).group(1)

fail = []

# ── A FLOOR ON THE SUBJECT'S SIZE, BEFORE ANY CLAIM ABOUT ITS MEMBERS ───────────────────────────
# THREE of the four checks below walk `names` and nothing else: UNIQUE finds no duplicate in an empty
# list, WELL-FORMED validates nothing, and USED reports nothing unused. Only the stray-literal scan
# survives an empty registry, and it would then be auditing call sites against a table of no entries.
#
# The list comes off ONE regex binding one exact spelling — `^export const NAME = mint("name");` or
# `frozen("name")`. A
# formatter reflowing a long line, a rename of the `d` helper, a trailing comment, or a declaration
# built from a table all empty it, and this witness would then print `0 domains` and exit 0 over a
# registry it had not read. A typo'd domain tag mints a second protocol whose signatures verify
# against nothing; that is precisely the failure this instrument exists to make loud, so its own
# silence is the worst affordable outcome here.
if not names:
    print(f"[domain-registry] {REG} PARSED TO ZERO DOMAINS — nothing below was checked.")
    print( "      The probe binds `export const NAME = mint|frozen(\"name\");` at the start of a line.")
    print( "      Unique · well-formed · used all walk that list and all pass over an empty one.")
    sys.exit(1)

# ── UNIQUE ──────────────────────────────────────────────────────────────────────────────────────
seen = {}
for export, name in names:
    if name in seen:
        fail.append(f"duplicate domain name {name!r}: {seen[name]} and {export} would share one tag")
    seen[name] = export

# ── WELL-FORMED ─────────────────────────────────────────────────────────────────────────────────
if not root.startswith("lar:///ha.ka.ba/"):
    fail.append(f"DOMAIN_ROOT {root!r} does not ride the stable ha.ka.ba root")
for _export, name in names:
    if not re.fullmatch(r"[a-z][a-z0-9-]*", name):
        fail.append(f"domain name {name!r} is not lowercase-kebab")
# The frozen set signs and derives live material; it shrinks when a re-found re-mints a name, and never
# grows. A new domain that reached for `frozen` would mint a counter that versions nothing.
FROZEN_CEILING = 47
if len(frozen_names) > FROZEN_CEILING:
    fail.append(f"{len(frozen_names)} frozen domains exceed the ceiling of {FROZEN_CEILING} — a NEW domain mints through `mint`, bare")

# ── LISTED — the table holds every declaration ──────────────────────────────────────────────────
table = re.search(r"export const ALL_DOMAINS[^=]*=\s*\[(.*?)\];", src, re.S)
listed = set(re.findall(r"\b([A-Z][A-Z0-9_]+)\b", table.group(1))) if table else set()
unlisted = [e for e, _n in names if e not in listed]
if not table:
    fail.append("no ALL_DOMAINS table found in the registry")
elif unlisted:
    fail.append("declared but missing from ALL_DOMAINS: " + ", ".join(unlisted))

# ── REGISTERED — no literal outside this file ───────────────────────────────────────────────────
# A NEGATIVE test on FOREIGN tags stays legal: `lar-some-other-board/v1` and `lar-test/*` exist to prove
# a wrong domain REFUSES, so they must never be registered. They are recognised by not being ours.
OPEN  = r'(?:b?["\'`])'
SHAPE = (r'(lar:///ha\.ka\.ba/lares/domain/[^"\'`$]*'          # the registry address
         r'|lar-[a-z-]+/v\d+[^"\'`]*'                         # lar-<name>/vN, with or without a |tail
         r'|lar(?:es)?/[a-z][a-z0-9-]*(?:/v\d+)?'              # lar/<name> · lares/<name>/vN
         r'|lar:[a-z][a-z0-9-]*:v\d+'                          # lar:<name>:vN (Python bytes)
         r'|lares [a-z-]+ v\d+)')                             # the retired HMAC-key spelling
LITERAL = re.compile(OPEN + SHAPE + r'(?=["\'`|])')
LEGAL_FOREIGN = re.compile(r"lar-some-other-|lar-test/")
COMMENT = re.compile(r"^\s*(?:\*|/\*|//|#)")

# The known strays: (path, literal prefix) → the act that registers it. Each signs live material under
# its present spelling, so moving it re-keys that material — the re-found's work, not a lint fix.
ALLOW = {
    ("packages/lararium-keyhive/src/face-grant-record.ts",    "lares/face-join-grant/v1"):
        "the face-join grant record's signing domain registers with the re-found",
    ("packages/lararium-mesh/src/cabal-realm-clock.ts",        "lar/realm-feed"):
        "the realm-roll seal's domain registers with the re-found",
    ("packages/lararium-mesh/src/wax-stamp.ts",                "lar-wax-stamp/v1|"):
        "the wax-stamp signing preimage registers with the re-found",
    ("packages/lararium-mesh/src/holder-continuity.ts",        "lar-holder-continuity/v1|"):
        "the holder-continuity signing preimage registers with the re-found",
    ("packages/lararium-mesh/src/persistence-keel.ts",         "lar-witness/v1|"):
        "the keel witness signing preimage registers with the re-found",
    ("packages/lararium-sensorium/scripts/worldline_veil.py",  "lar:worldline-root:v1"):
        "the worldline-root HMAC tag crosses into Python; it registers with the re-found",
}

stray, allowed = [], []
files = []
for ext in ("*.ts", "*.mjs", "*.js", "*.py"):
    files += pathlib.Path("packages").rglob(ext)
for p in sorted(set(files)):
    s = str(p)
    if "/dist" in s or "/node_modules/" in s or "generated" in s or p == REG:
        continue
    for i, line in enumerate(p.read_text(errors="replace").splitlines(), 1):
        if COMMENT.match(line):
            continue
        for m in LITERAL.finditer(line):
            lit = m.group(1)
            if LEGAL_FOREIGN.search(lit):
                continue
            why = next((w for (ap, pre), w in ALLOW.items() if ap == s and lit.startswith(pre)), None)
            (allowed if why else stray).append(f"{s}:{i}  {lit[:60]}" + (f"\n        ↳ {why}" if why else ""))

# An ALLOW row whose stray is gone must leave the list, or the list starts lying about what it covers.
for (ap, pre), _w in ALLOW.items():
    if not any(a.startswith(ap + ":") and f"  {pre}" in a for a in allowed):
        fail.append(f"ALLOW row ({ap}, {pre!r}) matches nothing — the stray moved or registered; drop the row")

# ── USED — a domain nobody signs under is design-time language wearing protocol clothes ─────────
# `delegation-edge` sat here exactly once: minted from a module filename, while that module takes its
# domain as a PARAMETER and callers pass fleet-proof or dyad-binding. A registry that accretes unused
# entries stops being a map of what the house signs.
srcdirs = [q for q in pathlib.Path("packages").rglob("*.ts")
           if "/dist/" not in str(q) and q != REG and "/src/" in str(q)]
blob = "\n".join(q.read_text(errors="replace") for q in srcdirs)
unused = [e for e, _n in names if not re.search(rf"\b{e}\b", blob)]
if unused:
    fail.append("registered but signed under by nothing: " + ", ".join(unused))

print(f"[domain-registry] {len(names)} domains ({len(frozen_names)} frozen, {len(names) - len(frozen_names)} bare), all under {root}")
if allowed:
    print(f"  {len(allowed)} KNOWN STRAY literal(s) outside the registry, allowed until the re-found registers them:")
    for x in allowed:
        print(f"    {x}")
if stray:
    print(f"  {len(stray)} domain literal(s) written OUTSIDE the registry:")
    for x in stray[:20]:
        print(f"    {x}")
    fail.append("literals outside the registry")

if fail:
    for f in fail:
        if f != "literals outside the registry":
            print(f"  {f}")
    sys.exit(1)
print("  unique · well-formed · listed · no UNKNOWN literal outside the registry")
PY
