#!/usr/bin/env bash
# direct-repo-witness — exactly TWO places open a fresh Automerge Repo over the node's store.
#
# ── WHY TWO, AND WHY A WITNESS RATHER THAN A REVIEW ─────────────────────────────────────────────
# ONE STORE, ONE HOLDER, AT EVERY INSTANT (`owned-store.ts`'s own law). A door that opened its OWN
# second Repo beside a standing vessel's never saw that vessel's live replica and was never seen by
# its peers — the exact fault `nexus-refresh.ts` existed only to paper over with a bounded-staleness
# poll, now retired because every door routes through the ONE held Repo instead. That leaves exactly
# two lawful openers, and only two:
#   · `open-node-vessel.ts` — the standing vessel's OWN Repo, opened once at boot and held for its
#     whole life;
#   · `owned-store.ts`'s `ownedStore` — the direct holder's Repo, opened for the moment of ONE act
#     with no vessel standing, and shut down before the claim releases.
# A review catches this once. A new command written next month, copying an older command's shape
# from before this law landed, would not know to avoid `new Repo(`, and nothing short of a build
# witness notices before its FIRST live-peer bug report. So this scans the real source, not memory
# of a review, every time the house asks.
#
# ── WHAT IT SCANS ────────────────────────────────────────────────────────────────────────────────
# Every `.ts` file under `packages/lararium-node/src` AND `packages/lares-cli/src` (dist and tests
# excluded — a test may plant a Repo of its own to inspect a fixture, which is not a door), with
# comments stripped so a docblock that NAMES the old shape to explain why it is wrong never counts as
# a site. `DIRECT_REPO_ROOT` overrides the scan root for a self-test fixture; default is the repo
# this script sits in.
#
# A site counts under whatever LOCAL NAME each file imports `Repo` from `@automerge/automerge-repo`
# AS — `import { Repo as R } from "@automerge/automerge-repo"` then `new R(` is the same door as
# `new Repo(`, read PER FILE because two files may alias it differently. A file that imports no such
# binding falls back to the literal `Repo`, so a planted `new Repo(` with no import still counts.
#
# Exit 0 = exactly the two named sites, and no other. Exit 1 = named, every site found, with the two
# lawful ones marked and every other flagged as the drift this witness exists to catch.
set -uo pipefail
cd "$(dirname "$0")/.."

ROOT="${DIRECT_REPO_ROOT:-$(pwd)}"

python3 - "$ROOT" <<'PY'
import pathlib, re, sys

root = pathlib.Path(sys.argv[1])
scan_roots = [
    root / "packages" / "lararium-node" / "src",
    root / "packages" / "lares-cli" / "src",
]
scan_roots = [p for p in scan_roots if p.is_dir()]
if not scan_roots:
    print(f"[direct-repo] no source tree found under {root}")
    sys.exit(1)

LAWFUL = {
    "lararium-node/src/open-node-vessel.ts": "the standing vessel's own Repo, opened once at boot",
    "lararium-node/src/owned-store.ts":      "the direct holder's Repo (`ownedStore`), opened for one act",
}

def strip_comments(text: str) -> str:
    text = re.sub(r"/\*[\s\S]*?\*/", "", text)
    text = re.sub(r"^\s*//.*$", "", text, flags=re.MULTILINE)
    return text

IMPORT = re.compile(r"""import\s*\{([^}]*)\}\s*from\s*["']@automerge/automerge-repo["']""")

def repo_local_name(code: str) -> str:
    """The local binding this file's `@automerge/automerge-repo` import gives `Repo` — its own alias
    if one stands, else the literal `Repo` (also the fallback for a file with no such import, so a
    planted bare `new Repo(` still counts)."""
    for m in IMPORT.finditer(code):
        for spec in m.group(1).split(","):
            spec = spec.strip()
            if not spec:
                continue
            parts = re.split(r"\s+as\s+", spec)
            if parts[0].strip() == "Repo":
                return parts[1].strip() if len(parts) > 1 else "Repo"
    return "Repo"

found: dict[str, int] = {}
for src in scan_roots:
    pkg_label = src.parent.name  # "lararium-node" / "lares-cli"
    for path in sorted(src.rglob("*.ts")):
        if "/tests/" in str(path) or path.name.endswith(".test.ts"):
            continue
        code = strip_comments(path.read_text(encoding="utf8"))
        local = repo_local_name(code)
        site = re.compile(r"\bnew\s+" + re.escape(local) + r"\s*\(")
        n = len(site.findall(code))
        if n > 0:
            found[f"{pkg_label}/src/{path.relative_to(src).as_posix()}"] = n

total = sum(found.values())
status = 0
print(f"[direct-repo] {total} `new Repo(` site(s) under {', '.join(str(p) for p in scan_roots)}")
for name, n in sorted(found.items()):
    if name in LAWFUL:
        print(f"  ok      {name} ×{n} — {LAWFUL[name]}")
    else:
        print(f"  DRIFT   {name} ×{n} — a door that opens its OWN Repo never reaches a standing vessel's live peers")
        status = 1

for name, why in LAWFUL.items():
    if name not in found:
        print(f"  MISSING {name} — expected exactly one lawful site here ({why}), found none")
        status = 1
    elif found[name] != 1:
        print(f"  DRIFT   {name} carries {found[name]} sites, expected exactly 1")
        status = 1

if total != len(LAWFUL):
    print(f"[direct-repo] expected exactly {len(LAWFUL)} site(s) total, found {total}")
    status = 1

sys.exit(status)
PY
