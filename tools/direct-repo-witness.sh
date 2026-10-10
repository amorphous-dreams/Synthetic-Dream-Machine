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
# Every `.ts` file under `packages/lararium-node/src` (dist and tests excluded — a test may plant a
# Repo of its own to inspect a fixture, which is not a door), with comments stripped so a docblock
# that NAMES the old shape to explain why it is wrong never counts as a site. `DIRECT_REPO_ROOT`
# overrides the scan root for a self-test fixture; default is the repo this script sits in.
#
# Exit 0 = exactly the two named sites, and no other. Exit 1 = named, every site found, with the two
# lawful ones marked and every other flagged as the drift this witness exists to catch.
set -uo pipefail
cd "$(dirname "$0")/.."

ROOT="${DIRECT_REPO_ROOT:-$(pwd)}"

python3 - "$ROOT" <<'PY'
import pathlib, re, sys

root = pathlib.Path(sys.argv[1])
src = root / "packages" / "lararium-node" / "src"
if not src.is_dir():
    print(f"[direct-repo] no source tree at {src}")
    sys.exit(1)

LAWFUL = {
    "open-node-vessel.ts": "the standing vessel's own Repo, opened once at boot",
    "owned-store.ts":      "the direct holder's Repo (`ownedStore`), opened for one act",
}

def strip_comments(text: str) -> str:
    text = re.sub(r"/\*[\s\S]*?\*/", "", text)
    text = re.sub(r"^\s*//.*$", "", text, flags=re.MULTILINE)
    return text

SITE = re.compile(r"\bnew\s+Repo\s*\(")

found: dict[str, int] = {}
for path in sorted(src.rglob("*.ts")):
    if "/tests/" in str(path) or path.name.endswith(".test.ts"):
        continue
    code = strip_comments(path.read_text(encoding="utf8"))
    n = len(SITE.findall(code))
    if n > 0:
        found[path.relative_to(src).as_posix()] = n

total = sum(found.values())
status = 0
print(f"[direct-repo] {total} `new Repo(` site(s) under {src}")
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
