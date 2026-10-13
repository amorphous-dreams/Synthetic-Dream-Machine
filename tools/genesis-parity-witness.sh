#!/usr/bin/env bash
# genesis-parity-witness — what `genesis/` carries equals what the tree builds today, or the gap stands DECLARED.
#
# ── THE GAP THIS READS ──────────────────────────────────────────────────────────────────────────
# A founded vessel boots its wiki from `genesis/`: the engine blob and the packed plugin blobs the seed
# names, pulled by address from `genesis/cas`. The daemon's own doors run from `dist`. So a cure that
# lands in the tw5 source and its tracked bundle reaches the daemon at the next build, and reaches the
# wiki INSIDE a vessel (the in-VM face, the plain-server routes) only at the next genesis bake. Between
# the two, one tree holds two grammars, and no suite compares them: `build-freshness` reads the bundle
# against a fresh build, never against genesis.
#
# ── WHY A RED HERE NEVER MEANS "BAKE NOW" BY ITSELF ─────────────────────────────────────────────
# A bake counts as an ACT, never a build step. It moves the seed's actor and the grammar address, so a
# store founded on the earlier seed reads a different genesis and re-founds from the bags; where the
# engine blob moved, it moves the hearth true-name too, and every device-delegation edge signs that name.
# So the house bakes ON PURPOSE, in one labelled `GENESIS RE-BAKE` commit, and a lane that changes the
# plugin may lawfully leave the bake to a later hand. This witness exists so that span never stands
# UNSEEN: a bundle running ahead of genesis reads RED until someone either bakes or DECLARES the gap.
#
# ── THE DECLARATION ─────────────────────────────────────────────────────────────────────────────
# `genesis/unbaked.json` (tracked, beside the seed it speaks for) names each source a lane knowingly
# left unbaked: its path, the sha256 of the exact bytes left unbaked, and why.
#
#   { "format": "lararium-genesis-unbaked/v1",
#     "unbaked": [ { "source": "packages/lararium-tw5/plugins/lares-memetic-wikitext.json",
#                    "sha256": "<the tracked bundle's sha256>",
#                    "why":    "<what moved, and which bake carries it>" } ] }
#
# A row answers ONE byte string. The source moves again and the row names an earlier sha: RED, so each
# further change re-declares and no gap widens under an old note. A row whose source genesis already
# carries reads RED as well (a stale note): the bake deletes the file in its own commit. A declared
# gap prints in full on every run and exits 0.
#
# The declaration covers a source that runs AHEAD of genesis. It never covers a torn genesis: a CAS
# member that fails its own name, a blob the seed names and the CAS lacks, a stray CAS file, a blob no
# source builds, or a genesis file git does not track (a fresh bake leaves its new CAS blob untracked,
# and a commit by pathspec skips it).
#
# ── WHAT IT COMPARES ────────────────────────────────────────────────────────────────────────────
#   · the ENGINE: `packages/lararium-tw5/tw5-core/<TW5_CORE_SCRIPT_FILENAME>` (a build output; the
#     filename reads from the tracked `generated-tw5-version.ts`) against the seed's `tiddlywikicore`;
#   · every PACKED PLUGIN FILE: each `.json` at the top of `packages/lararium-tw5/plugins/`, the bake's
#     own rule (`genesisPackedPluginFiles`), which holds the grammar bundle and the boot shadows. A file
#     that declares a plugin envelope answers to its `title`; any other answers to its file name;
#   · the CAS: every blob the seed names stands at `genesis/cas/<sha256>` and hashes to that name, and
#     the directory holds nothing else.
# An engine blob absent from disk reads RED, never skipped: a comparison that did not run proves nothing.
#
# `GENESIS_PARITY_ROOT` overrides the tree for the self-test (`tools/genesis-parity-witness.test.mjs`).
#
# Exit 0 = genesis carries the tree's bytes, or every gap stands declared. Exit 1 = each drifted
# artifact named with both addresses, and the one command that closes it.
set -uo pipefail
cd "$(dirname "$0")/.." || exit 1

ROOT="${GENESIS_PARITY_ROOT:-$(pwd)}"

python3 - "$ROOT" <<'PY'
import hashlib, json, os, pathlib, re, subprocess, sys

root = pathlib.Path(sys.argv[1]).resolve()
TAG = "[genesis-parity]"
BAKE = "pnpm --filter @lararium/node build:genesis"
ENGINE_ID = "tiddlywikicore"
MARKER_FORMAT = "lararium-genesis-unbaked/v1"

genesis = root / "genesis"
seed_path = genesis / "seed.json"
cas_dir = genesis / "cas"
marker_path = genesis / "unbaked.json"
plugins_dir = root / "packages" / "lararium-tw5" / "plugins"
version_ts = root / "packages" / "lararium-tw5" / "src" / "generated-tw5-version.ts"
core_dir = root / "packages" / "lararium-tw5" / "tw5-core"

reds, declared = [], []

def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def rel(path):
    return path.relative_to(root).as_posix()

def fail_early(msg):
    print(f"{TAG} RED  {msg}")
    sys.exit(1)

if not seed_path.is_file():
    fail_early(f"no genesis seed at {seed_path}: nothing to compare. Close it: {BAKE}")
try:
    seed = json.loads(seed_path.read_text())
    blobs = {bid: b["sha256"] for bid, b in seed["blobs"].items()}
except Exception as e:
    fail_early(f"genesis/seed.json does not read as a seed ({e})")
if not blobs:
    fail_early("genesis/seed.json names no blob: an empty seed compares clean against nothing")

# ── the sources the bake reads ──────────────────────────────────────────────────────────────────
sources = {}        # blob id -> (path, sha256 | None)
unread = []
m = re.search(r'TW5_CORE_SCRIPT_FILENAME\s*=\s*"([^"]+)"', version_ts.read_text()) if version_ts.is_file() else None
if not m:
    unread.append(f"the engine's file name: {rel(version_ts)} names no TW5_CORE_SCRIPT_FILENAME")
else:
    core = core_dir / m.group(1)
    if core.is_file():
        sources[ENGINE_ID] = (core, sha(core))
    else:
        unread.append(f"the engine blob: {rel(core)} stands absent (a build output). Build it: pnpm --filter @lararium/tw5 build:tw5-vendor")

packed = sorted(p for p in plugins_dir.glob("*.json") if p.is_file()) if plugins_dir.is_dir() else []
if not packed:
    unread.append(f"the packed plugin files: {rel(plugins_dir)} holds no top-level .json")
for p in packed:
    bid = p.stem
    try:
        parsed = json.loads(p.read_text())
        if isinstance(parsed, dict) and isinstance(parsed.get("title"), str):
            bid = parsed["title"]
    except Exception:
        pass
    if bid in sources:
        reds.append(f"two sources answer to one blob id \"{bid}\": {rel(sources[bid][0])} and {rel(p)}")
        continue
    sources[bid] = (p, sha(p))

for u in unread:
    reds.append(f"UNREAD  {u}")

# ── the declaration ─────────────────────────────────────────────────────────────────────────────
rows = []
if marker_path.is_file():
    try:
        marker = json.loads(marker_path.read_text())
        assert marker.get("format") == MARKER_FORMAT, f"format reads {marker.get('format')!r}, expected {MARKER_FORMAT!r}"
        rows = marker["unbaked"]
        assert isinstance(rows, list) and rows, "it names no row (delete the file where no gap stands)"
        for r in rows:
            assert set(r) == {"source", "sha256", "why"}, f"a row carries keys {sorted(r)}; expected source, sha256, why"
            assert all(isinstance(r[k], str) and r[k].strip() for k in r), "every row value reads as a non-empty string"
    except Exception as e:
        reds.append(f"genesis/unbaked.json does not read as a declaration: {e}")
        rows = []
used = set()

def declaration_for(path, have):
    for i, r in enumerate(rows):
        if r["source"] == rel(path) and r["sha256"] == have:
            used.add(i)
            return r
    return None

# ── source against seed ─────────────────────────────────────────────────────────────────────────
ahead = []          # (id, path, tree sha, genesis sha | None)
for bid, (path, have) in sorted(sources.items()):
    carried = blobs.get(bid)
    if carried == have:
        continue
    ahead.append((bid, path, have, carried))
for bid, path, have, carried in ahead:
    row = declaration_for(path, have)
    was = carried if carried else "(genesis names no such blob)"
    line = f"{bid}\n        tree     {rel(path)}  sha256 {have}\n        genesis  {was}"
    if row:
        declared.append(f"{line}\n        why      {row['why']}")
    else:
        reds.append(f"DRIFT  {line}")

for i, r in enumerate(rows):
    if i in used:
        continue
    path = root / r["source"]
    now = sha(path) if path.is_file() else "(absent)"
    reds.append(
        f"STALE DECLARATION  genesis/unbaked.json names {r['source']} at sha256 {r['sha256']}; the tree holds {now}, "
        "and no gap answers to that row. A bake deletes the file; a source that moved again re-declares its new sha.")

for bid in sorted(set(blobs) - set(sources)):
    if bid == ENGINE_ID and any(u.startswith("the engine") for u in unread):
        continue
    reds.append(f"NO SOURCE  genesis names blob \"{bid}\" ({blobs[bid]}) and no file the bake reads builds it")

# ── the CAS closes under the seed ───────────────────────────────────────────────────────────────
named = set(blobs.values())
held = {p.name for p in cas_dir.iterdir() if p.is_file()} if cas_dir.is_dir() else set()
for bid, want in sorted(blobs.items()):
    member = cas_dir / want
    if not member.is_file():
        reds.append(f"CAS  genesis/cas holds no member {want} for \"{bid}\" (a fresh bake leaves its new blob untracked: git add it)")
    elif sha(member) != want:
        reds.append(f"CAS  genesis/cas/{want} does not hash to its own name")
for stray in sorted(held - named):
    reds.append(f"CAS  genesis/cas/{stray} stands and the seed names no such blob (a bake leaves the superseded blob behind: remove it in the bake commit)")

# ── git holds every genesis file ────────────────────────────────────────────────────────────────
env = {k: v for k, v in os.environ.items() if not k.startswith("GIT_")}
top = subprocess.run(["git", "-C", str(root), "rev-parse", "--show-toplevel"], capture_output=True, text=True, env=env)
if top.returncode == 0 and pathlib.Path(top.stdout.strip()).resolve() == root:
    ls = subprocess.run(["git", "-C", str(root), "ls-files", "--", "genesis"], capture_output=True, text=True, env=env)
    tracked = set(ls.stdout.split("\n"))
    want_tracked = ["genesis/seed.json"] + [f"genesis/cas/{s}" for s in sorted(named & held)]
    if marker_path.is_file():
        want_tracked.append("genesis/unbaked.json")
    for f in want_tracked:
        if f not in tracked:
            reds.append(f"UNTRACKED  {f} stands on disk and git does not track it: git add -- {f}")
    tracked_note = f"git tracks all {len(want_tracked)} genesis file(s)"
else:
    tracked_note = f"tracked-ness unread: {root} stands as no git tree's root"

# ── the verdict ─────────────────────────────────────────────────────────────────────────────────
compared = len(sources)
print(f"{TAG} {compared} source artifact(s) compared against {len(blobs)} genesis blob(s); {tracked_note}")
for bid, (path, have) in sorted(sources.items()):
    if blobs.get(bid) == have:
        print(f"  ok        {bid}  {have[:16]}…  {rel(path)}")
if declared:
    print(f"  {len(declared)} gap(s) stand DECLARED in genesis/unbaked.json (genesis runs behind the tree ON PURPOSE):")
    for d in declared:
        print(f"    DECLARED  {d}")
    print(f"  The next bake carries them and deletes the declaration: {BAKE}")
if reds:
    print(f"  {len(reds)} RED:")
    for r in reds:
        print(f"    {r}")
    print("  A red here says the wiki INSIDE a founded vessel runs other bytes than the tree builds.")
    print(f"  Close it by a bake:  {BAKE}")
    print("    then ONE labelled GENESIS RE-BAKE commit holding genesis/seed.json, the new genesis/cas blob")
    print("    (git add it), the superseded blob's removal, and genesis/unbaked.json's removal where one stands.")
    print("  Or leave the bake to a later hand ON PURPOSE: declare the row in genesis/unbaked.json (shape in this script's header).")
    sys.exit(1)
if compared == 0:
    print("  RED: nothing compared")
    sys.exit(1)
if not declared:
    print("  genesis carries the engine and every packed plugin file the tree holds")
PY
