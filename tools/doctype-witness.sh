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
# The fresh-build gate reads `packages/lararium-tw5` under the SCRATCH root (the symlink's lexical
# parent, never the real tree it points at), so the scratch sandbox carries no source to digest and
# reads stale by construction. Stamp it in place: the same writer the real build uses, over the same
# bytes the real build already proved fresh, just filed under the scratch package.json-less dir.
node tools/stamp-build.mjs "$scratch" --pkg lararium-tw5 >/dev/null
git -C "$scratch" init -q
# A CANONICAL MINIMAL CARRIER, shaped the way the frame writer builds one — DOCTYPE, then an SOH
# bearing a real target, an STX, a one-field meta body, an ETX naming the body's checksum, and an EOT
# resolving back to "?". A bare DOCTYPE+SOH with no STX/ETX/EOT is not a carrier the writer would ever
# emit, so a control built that way measures nothing the writer's own shape would produce.
META='title = "lar:///x/y/z"
type  = "text/memetic-wikitext+tiddlywiki"'
BODY='```toml meta
'"$META"'
```'
BCC="ni:///sha-256;$(printf '%s' "$BODY" | sha256sum | cut -d' ' -f1)"
printf '<<!DOCTYPE "memetic-wikitext+tiddlywiki" "lar:///ha.ka.ba/lares/api/pono/memetic-wikitext">>\n\n<<^ code="&#x0001;" from="?" -> to="lar:///x/y/z">>\n<<^ code="&#x0002;">>\n\n%s\n\n<<^ code="&#x0003;">>%s\n\n<<^ code="&#x0004;" -> to="?">>\n' "$BODY" "$BCC" > "$scratch/control.mem"
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
