#!/usr/bin/env bash
# submission-currency-staged — refuse a commit that lets a submission pair drift from its source.
#
# The shelf (`bags/lares/ha.ka.ba/lares/api/pono/submissions/`) holds `<name>.md` + `<name>.md.meta`
# PAIRS, each meta naming its `source: lar:///…` — the memetic-wikitext carrier the pair was projected
# from. Nothing enforced that a source edit carried its pair forward until `lares meme project --to md
# --check` folded `tools/submission-parity.mjs`'s proof into one door (`lar:///submission-parity.folds-
# into-project-check`). This script fires that door FROM THE SOURCE SIDE, beside `meme-check-staged` —
# a commit that edits a pair's source, its `.md`, or its `.md.meta` must carry a pair that still
# re-projects byte-identical, or it refuses.
#
# THE PAIR SET IS DERIVED, NEVER HARDCODED. Every `.md.meta` on the shelf already NAMES its own source
# (the `source:` line) — reading that field IS the trigger set, so a fifth pair joins the gate the
# moment its meta exists, with no list here to fall out of step. Read from the STAGED blob where the
# meta itself is staged (the commit's own claim of what its source is), the WORKING TREE otherwise (a
# meta this commit does not touch still names its live source correctly).
#
# THE GATE FIRES ONLY WHEN A STAGED PATH TOUCHES AN INVOLVED FILE — a source `.mem`, a pair `.md`, or
# its `.md.meta` — so a commit that never goes near the shelf exits 0 fast and silent, the same
# discipline `meme-check-staged` holds for a commit with no staged `.mem`.
#
# THE CHECK RUNS OVER A SCRATCH MIRROR OF WHAT THE COMMIT CARRIES, never the dirty working tree: staged
# blobs for every involved file that IS staged, HEAD's blob for one that is not (the commit leaves that
# file's committed content unchanged, so HEAD — not a dirty edit sitting unstaged — is what the commit
# actually produces for it; a file with no HEAD blob yet, e.g. brand new and unstaged, falls back to
# reading it off disk since there is no committed version to prefer). `lares meme project --to md
# --check` resolves a source through `repoRoot` (`@lararium/mesh/node`), which anchors on the BUILT
# MODULE'S OWN on-disk location and never on `cwd` — so a scratch mirror needs `--root <scratch>` to be
# read from at all; `meme.ts` grew that door for exactly this seat.
#
# FAIL CLOSED, same as `meme-check-staged`: a missing binary refuses with the build named.
# `git commit --no-verify` remains the operator's override, and says so in the refusal.
#
#   install:  git config core.hooksPath .githooks        (`.githooks/pre-commit` execs this beside meme-check-staged)
#   witness:  tools/submission-currency-hook-witness.sh
set -uo pipefail
REPO="$(git rev-parse --show-toplevel)" || exit 1
cd "$REPO" || exit 1
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LARES="${LARES_BIN:-$HERE/packages/lares-cli/dist/src/bin/lares.js}"
SHELF="bags/lares/ha.ka.ba/lares/api/pono/submissions"

mapfile -d '' STAGED < <(git diff --cached --name-only --diff-filter=ACMR -z)

is_staged() {
  local needle="$1" f
  for f in "${STAGED[@]}"; do [ "$f" = "$needle" ] && return 0; done
  return 1
}

shopt -s nullglob
METAS=("$SHELF"/*.md.meta)
shopt -u nullglob

# The involved set: parallel arrays over every pair whose source, `.md`, or `.md.meta` is staged.
INVOLVED_MD=()
INVOLVED_META=()
INVOLVED_SRC=()

for meta in "${METAS[@]}"; do
  if is_staged "$meta"; then content="$(git show ":$meta")"; else content="$(cat "$meta")"; fi
  source_uri="$(printf '%s\n' "$content" | sed -n 's/^source: //p')"
  [ -z "$source_uri" ] && continue
  src="bags/lares/${source_uri#lar:///}.mem"
  md="${meta%.meta}"

  if is_staged "$src" || is_staged "$md" || is_staged "$meta"; then
    INVOLVED_MD+=("$md")
    INVOLVED_META+=("$meta")
    INVOLVED_SRC+=("$src")
  fi
done

[ "${#INVOLVED_MD[@]}" -eq 0 ] && exit 0

if [ ! -f "$LARES" ]; then
  echo "[submission-currency-staged] REFUSED — a submission source/pair staged and no built CLI at $LARES" >&2
  echo "  build it (pnpm --filter @lares/cli build), or commit with --no-verify to skip the check." >&2
  exit 1
fi

SCRATCH="$(mktemp -d "${TMPDIR:-/tmp}/submission-currency-staged-XXXXXX")" || exit 1
trap 'rm -rf "$SCRATCH"' EXIT

# Mirror one involved file: the staged blob where staged, else HEAD's blob, else the disk copy (a file
# with no committed version yet — the last resort, never preferred over a committed one).
mirror() {
  local f="$1"
  mkdir -p "$SCRATCH/$(dirname "$f")"
  if is_staged "$f"; then
    if git cat-file -e ":$f" 2>/dev/null; then git show ":$f" > "$SCRATCH/$f"; fi
  elif git cat-file -e "HEAD:$f" 2>/dev/null; then
    git show "HEAD:$f" > "$SCRATCH/$f"
  elif [ -f "$f" ]; then
    cp "$f" "$SCRATCH/$f"
  fi
}

# A FROZEN `aka`/`shadow`/`snapshot` edge in a mirrored source pins its target's own text (weave
# resolves it through `bagsResolver`, read-only over `--root`) — so the scratch mirror needs that
# target too, or the check re-projects the unresolved fallback against a shelf pair the real weave
# (over the whole repo) pinned for real, and reads a false DRIFT on every commit that never touched
# the aka'd file at all. One level deep, matching weave's own resolver: an aka target's OWN aka edges
# do not chase further.
mirror_aka_targets() {
  local mirrored_src="$1"
  [ -f "$mirrored_src" ] || return 0
  grep -oE '<<~[[:space:]]*(aka|shadow|snapshot)[[:space:]]+"?lar:///[^">[:space:]]+' "$mirrored_src" \
    | sed -E 's/^<<~[[:space:]]*(aka|shadow|snapshot)[[:space:]]+"?//' \
    | while IFS= read -r uri; do
        path="${uri#lar:///}"
        path="${path%%#*}"
        [ -z "$path" ] && continue
        mirror "bags/lares/${path}.mem"
      done
}

declare -A NAME_TO_SRC=()
for i in "${!INVOLVED_MD[@]}"; do
  mirror "${INVOLVED_MD[$i]}"
  mirror "${INVOLVED_META[$i]}"
  mirror "${INVOLVED_SRC[$i]}"
  mirror_aka_targets "$SCRATCH/${INVOLVED_SRC[$i]}"
  name="$(basename "${INVOLVED_MD[$i]}" .md)"
  NAME_TO_SRC["$name"]="${INVOLVED_SRC[$i]}"
done

OUT="$(cd "$SCRATCH" && node "$LARES" meme project "$SCRATCH/$SHELF" --to md --check --root "$SCRATCH" 2>&1)"
CODE=$?
if [ "$CODE" -eq 0 ]; then
  echo "[submission-currency-staged] ${#INVOLVED_MD[@]} involved submission pair(s) current"
  exit 0
fi

echo "[submission-currency-staged] REFUSED — a submission pair drifted from its source:" >&2
printf '%s\n' "$OUT" | grep -E '^  [A-Za-z0-9_.-]+: ' | while IFS= read -r line; do
  echo "  $line" >&2
  name="$(printf '%s' "$line" | sed -E 's/^  ([A-Za-z0-9_.-]+):.*/\1/')"
  src="${NAME_TO_SRC[$name]:-}"
  [ -z "$src" ] && continue
  echo "    cure: lares meme project --to md $src --out $SHELF --title-base lar:///ha.ka.ba/lares/api/pono/submissions" >&2
  echo "          then re-stage: git add $SHELF/$name.md $SHELF/$name.md.meta" >&2
done
echo "  (or commit with --no-verify to skip the check.)" >&2
exit 1
