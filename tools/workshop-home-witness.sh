#!/usr/bin/env bash
# workshop-home-witness — does the workshop wiki's home hold exactly the carriers its waves landed, each at its own address?
#
# The workshop history moves wave by wave from `scratch/` into the `workshop` wiki under `wikis/`, landing in that wiki's working
# layer through INGEST (lar:///ha.ka.ba/kahua/memory/research/workshop-home). The wikis siting rule reads the first segment under
# `wikis/` as the slug and the interior as the name, so `wikis/workshop/<interior>.mem` answers at `lar:///<interior>`. This
# witness holds three readings over that home:
#
#   ADDRESS / TITLE — each carrier's head sigil (read by the shore, never by a regex here) and its meta `title` name the address
#                     its path derives; a carrier whose own title names another address would land under one name and speak another.
#   UNLISTED / MISSING — the carriers on disk equal the wave manifest (`tools/workshop-home.manifest`, one path per line under the
#                     shelf, `.mem` dropped): a carrier no wave named, or a named one gone, reads red by name.
#   TWO-HOME — no workshop address also stands as a carrier in another home (`bags/<holding>/` or another `wikis/<slug>/`).
#
# `REPO` names the corpus tree (default: this checkout); the shore always loads from this checkout.
# Exit 0 = the home holds its manifest, every carrier at its own address. Exit 1 = the reds, listed. Exit 2 = no manifest.
# Self-test: node --test tools/workshop-home-witness.test.mjs
set -uo pipefail
cd "$(dirname "$0")/.."
export SHORE_DIR="$PWD"

python3 - <<'PY'
import json, os, pathlib, re, subprocess, sys

repo = pathlib.Path(os.environ.get("REPO") or ".")
shelf = "ha.ka.ba/lares/docs/history/workshop"
home = repo / "wikis" / "workshop"
manifest_path = repo / "tools" / "workshop-home.manifest"

if not manifest_path.is_file():
    print(f"[workshop-home] no manifest at {manifest_path} — the waves name what they land there, one path per line", file=sys.stderr)
    sys.exit(2)

def heads(paths):
    if not paths:
        return {}
    out = subprocess.run(["node", os.path.join(os.environ["SHORE_DIR"], "tools/carrier-head.mjs"), "--stdin"],
                         input="\n".join(str(p) for p in paths), capture_output=True, text=True)
    if out.returncode != 0:
        print(out.stderr.strip() or "[workshop-home] the shore did not answer"); sys.exit(1)
    return {r["file"]: r for r in (json.loads(l) for l in out.stdout.splitlines() if l.strip())}

def derived(plane_dir, f):
    """The address the siting rule derives: the interior under the slug folder, its extension dropped."""
    interior = f.relative_to(plane_dir).parts[1:]
    return "lar:///" + "/".join(interior)[: -len(".mem")]

carriers = sorted(home.rglob("*.mem")) if home.is_dir() else []
others = sorted(p for plane in ("bags", "wikis") for p in (repo / plane).rglob("*.mem")
                if not (plane == "wikis" and home in p.parents))
read = heads(carriers + others)
reds = []

# ADDRESS / TITLE
mine = {}
for f in carriers:
    want = derived(repo / "wikis", f)
    rel = os.path.relpath(f, repo)
    got = read.get(str(f), {}).get("uri")
    if got != want:
        reds.append(f"ADDRESS  {rel} head names {got}, the path derives {want}")
    t = re.search(r'(?m)^title\s*=\s*"(.*?)"', f.read_text(errors="replace"))
    if t and t.group(1) != want:
        reds.append(f"TITLE    {rel} meta title {t.group(1)}, the path derives {want}")
    mine[want] = rel

# UNLISTED / MISSING
listed = [l.strip() for l in manifest_path.read_text().splitlines() if l.strip() and not l.strip().startswith("#")]
on_disk = {os.path.relpath(f, home / shelf)[: -len(".mem")] for f in carriers}
for p in sorted(on_disk - set(listed)):
    reds.append(f"UNLISTED {p}.mem stands in the home and no wave manifest row names it")
for p in sorted(set(listed) - on_disk):
    reds.append(f"MISSING  {p} the manifest names it and no carrier stands at wikis/workshop/{shelf}/{p}.mem")

# TWO-HOME
for f in others:
    u = read.get(str(f), {}).get("uri")
    if u in mine:
        reds.append(f"TWO-HOME {mine[u]} and {os.path.relpath(f, repo)} both carry {u}")

print(f"[workshop-home] {len(carriers)} carrier(s) · manifest {len(listed)} · {len(reds)} red")
for r in reds:
    print(f"  {r}")
if reds:
    sys.exit(1)
print("[workshop-home] every workshop carrier stands at its own address, listed once, in one home")
PY
