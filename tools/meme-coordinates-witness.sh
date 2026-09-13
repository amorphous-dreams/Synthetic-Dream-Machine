#!/usr/bin/env bash
# meme-coordinates-witness — do a meme's DERIVED coordinates still name where it stands?
#
# TWO coordinates, TWO different facts, and each mirrors something the meme itself already carries:
#   `file-path` — where the carrier rests on disk.
#   `uri-path`  — the address in the carrier's own head sigil.
#
# Nothing stamps either. The deserializer derives a record's TITLE from the head sigil (a `title` written
# in the TOML is explicitly ignored) and the disk projector sites by that address, so `uri-path` consults
# nothing at ingest — its whole job is to AGREE, and a field whose only job is agreement is exactly the
# field that drifts unnoticed. 351 `file-path` values and 3 `uri-path` values had.
#
# The first pass here checked `file-path` alone, and the second coordinate was left to a reader's eye.
#
# Exit 0 = every coordinate names its own file. Exit 1 = the drift, listed.
set -uo pipefail
cd "$(dirname "$0")/.."

python3 - <<'PY'
import pathlib, re, sys, json, subprocess

# THE HEAD IS READ BY THE SHORE, NEVER BY THIS FILE. Nine spellings of that question stood across the
# tree, and eight stopped matching in one minute when the corpus quoted its control values. One process
# answers for every carrier — spawning node per file would cost 700 starts for a single question.
def heads(paths):
    out = subprocess.run(
        ["node", "tools/carrier-head.mjs", "--stdin"],
        input="\n".join(str(p) for p in paths), capture_output=True, text=True)
    if out.returncode != 0:
        print(out.stderr.strip() or "[meme-coordinates] the shore did not answer"); sys.exit(1)
    return {r["file"]: r for r in (json.loads(l) for l in out.stdout.splitlines() if l.strip())}

drift = []
_carriers = sorted(pathlib.Path("bags").rglob("*.mem"))
_heads = heads(_carriers)
for f in _carriers:
    head = f.read_text(errors="replace")[:4000]

    m = re.search(r'(?m)^file-path\s*=\s*"(.*?)"', head)
    if m and m.group(1) != str(f):
        drift.append((str(f), "file-path", m.group(1), str(f)))

    # `uri-path` answers to the HEAD SIGIL, never to the tree: a root resource may deliberately carry a
    # rootless address (`lar:///AGENTS`), and the field must follow the address rather than the folder.
    u = re.search(r'(?m)^uri-path\s*=\s*"(.*?)"', head)
    _u = _heads.get(str(f), {}).get("uri")
    _hd = _u[len("lar:///"):] if _u and _u.startswith("lar:///") else None
    if u and _hd and u.group(1) != _hd:
        drift.append((str(f), "uri-path", u.group(1), _hd))

if not drift:
    print("[meme-coordinates] every file-path names its own file, and every uri-path its own address")
    sys.exit(0)

print(f"[meme-coordinates] {len(drift)} coordinate(s) name something other than what they mirror:")
for path, field, declared, actual in drift:
    print(f"  {path}")
    print(f"      {field} declares  {declared}")
    print(f"      {' ' * len(field)}   stands as  {actual}")
sys.exit(1)
PY
