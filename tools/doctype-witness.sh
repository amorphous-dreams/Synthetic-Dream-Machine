#!/usr/bin/env bash
# doctype-witness — every carrier opens by naming the grammar that reads it, at the one address that does.
set -uo pipefail
cd "$(dirname "$0")/.."
REPO="$PWD" node tools/doctype.mjs || exit 1

# THE DECLARATION DECIDES, NEVER THE EXTENSION. A file hiding its declaration inside a comment declares
# to nobody, whatever its name — and a witness that never provokes that proves nothing about it. The
# provocation stands in a throwaway repository, so the tree it guards never holds the fault.
scratch="$(mktemp -d)"
trap 'rm -rf "$scratch"' EXIT
mkdir -p "$scratch/packages/lararium-tw5"
ln -s "$PWD/packages/lararium-tw5/dist" "$scratch/packages/lararium-tw5/dist"
git -C "$scratch" init -q
printf '<<!DOCTYPE "memetic-wikitext+tiddlywiki" "lar:///ha.ka.ba/lares/api/pono/memetic-wikitext">>\n\n<<^ code="&#x0001;" from="?" -> to="lar:///x/y/z">>\n' > "$scratch/control.mem"
git -C "$scratch" add -A

# CONTROL: a carrier declaring bare, at the one address, passes.
if ! REPO="$scratch" node tools/doctype.mjs >/dev/null 2>&1; then
  echo "[doctype-witness] the control failed — a bare declaration at the one address read as a fault"; exit 1
fi

# PROVOCATION: the same address hidden in a comment, in a file of another extension, fails.
printf '<!-- <<!DOCTYPE "memetic-wikitext+tiddlywiki" "lar:///ha.ka.ba/lares/api/pono/memetic-wikitext">> -->\n\n# notes\n' > "$scratch/notes.md"
git -C "$scratch" add -A
if REPO="$scratch" node tools/doctype.mjs >/dev/null 2>&1; then
  echo "[doctype-witness] a declaration hidden in a comment passed the gate — it declares to nobody"; exit 1
fi
echo "[doctype-witness] a hidden declaration fails whatever the file's extension, and the control passes"
