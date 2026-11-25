# The re-found evening (draft by Lares-Alpha, 2026-11-19; 11a restore adapted to this house)

Source: founding-runbook #/carry-across-refound (11a). Every line runs on the operator's real terminal, from `~/Synthetic-Dream-Machine`. `# each face` = run for N = 0, 1, 2 (joshua-fontany, joshua-fontany-engineer, joshua-fontany-referee).

## Gate (Alpha confirms before you start)
- develop CI green with #332 (reds), #333 (F1w) and the derived-rungs PR landed;
- image rebuilt at that head (`tools/lares-container.sh rebuild`), host CLI rebuilt;
- Alpha walked the five rungs on a scratch root.

## 0 · The standing house (it can't compose: skip its census and its keep)
```sh
tools/lares-container.sh down          # at the floor nothing waits; if the census asks accept-loss, STOP and tell Alpha
```

## 1 · The new house beside it
```sh
export LARES_HOUSE="$HOME/.lares-next"
export LARES_PULAMA=0        # the new house holds its own custody until step 6; the env file's LARES_PULAMA=1 still names the old house's lit pūlama
mkdir -p ~/.lares-next/config ~/.lares-next/projections
git clone /home/joshu/claude-backup ~/.lares-next/config/keep-clone && git -C ~/.lares-next/config/keep-clone log --oneline -1   # reads: 7533069 keep e4dc4471…
cp -a ~/.lares/sensoriums ~/.lares/library ~/.lares-next/
cp -a ~/.lares/projections/faces ~/.lares-next/projections/       # POOLS FIRST: the newest truth (6 memes newer than the keep, 2 pool-only; the-worn-house kāpae shadow already rests in h0's pool)
```
```sh
for f in ~/.lares-next/projections/faces/*/; do [ -d "$f/margins" ] && mv "$f/margins" "$f/personal"; done   # the personal layer's one name (lands with the personal-one-name PR)
ls ~/.lares-next/projections/faces/*/                               # each face reads wiki/ and personal/ (no margins/)
```
(Temp consent: the old config holds none, so nothing to re-state.)

## 2 · Found, stand, the faces
```sh
tools/lares-container.sh found --hearth --name 'joshua-fontany' --chair 'dreamnet-kahu-0'
tools/lares-container.sh up                                        # unlocks on this terminal
tools/lares-container.sh persona new 1 --name 'joshua-fontany-engineer'
tools/lares-container.sh persona new 2 --name 'joshua-fontany-referee'
tools/lares-container.sh vault unlock --all --face 1
```

## 3 · Lay (face 0 first: canon, then its pools)
```sh
# (LARES_HOUSE="$HOME/.lares-next" still exported from step 1: check with `echo $LARES_HOUSE`)
mkdir -p ~/census-drill

# face 0 · joshua-fontany (the steward): canon first, then its pools
tools/lares-container.sh vault unlock --face 0        # answer must read "wears":0 and carry no switchRefused
tools/lares-container.sh vessel lay --apply --yes
# only if that lay printed `kahua: K item(s) stand pending`:
#   tools/lares-container.sh vessel lay --apply --lift-kahua K

# face 1 · joshua-fontany-engineer
tools/lares-container.sh vault unlock --face 1        # "wears":1, no switchRefused
tools/lares-container.sh vessel lay --apply --yes
#   (lift-kahua K only if its lay named K pending)

# face 2 · joshua-fontany-referee
tools/lares-container.sh vault unlock --face 2        # "wears":2, no switchRefused
tools/lares-container.sh vessel lay --apply --yes
#   (lift-kahua K only if its lay named K pending)

# the base census, one per face
tools/lares-container.sh vault unlock --face 0 && node tools/census-drill.mjs census --root ~/.lares-next --label 'new-base joshua-fontany' --out ~/census-drill/new-base-joshua-fontany.json --lares tools/lares-container.sh
tools/lares-container.sh vault unlock --face 1 && node tools/census-drill.mjs census --root ~/.lares-next --label 'new-base joshua-fontany-engineer' --out ~/census-drill/new-base-joshua-fontany-engineer.json --lares tools/lares-container.sh
tools/lares-container.sh vault unlock --face 2 && node tools/census-drill.mjs census --root ~/.lares-next --label 'new-base joshua-fontany-referee' --out ~/census-drill/new-base-joshua-fontany-referee.json --lares tools/lares-container.sh
```
Expected: face 0's lay reads `lay: 6/6 holdings` (canon) and lays its 87-file pool; faces 1 and 2 read `… read the floor` for canon. `mirrors: <face> stands unworn …` lines for faces not yet worn are expected. Paste any `refused:` row or `switchRefused`.
Render files (road.html, road-ashes.html) read `derived` now and land nothing; that's expected.

## 4 · Import the keep (older copies stand off; the pools win)
```sh
tools/lares-container.sh vault unlock --face 0 && tools/lares-container.sh import /lar/config/keep-clone/house   # preview; every pet-name maps to a face
tools/lares-container.sh vault unlock --face N && tools/lares-container.sh import /lar/config/keep-clone/house --apply   # each face
tools/lares-container.sh shore                                     # names each stand-off; for the six newer memes keep the pool's words:
tools/lares-container.sh shore take-disk <uri> --key <key>        # per stand-off it names (handoff, decisions, backlog-alpha, standing-orders, runbook-next-phase, house-laws)
tools/lares-container.sh vault unlock --face N && tools/lares-container.sh import /lar/config/keep-clone/house --apply && tools/lares-container.sh vessel lay --apply --yes   # each face again: lands 0
tools/lares-container.sh vault unlock --face N && node tools/census-drill.mjs census --root ~/.lares-next --label 'new <pet-name>' --out ~/census-drill/new-<pet-name>.json --lares tools/lares-container.sh   # each face
tools/lares-container.sh lei kui --rite keep --branch house-backup --returns 12 --face 0   # before any pūlama
```
No old census exists (the old house can't answer), so the content ledger stands in for the parity: Alpha runs it after the swap.

## 5 · The swap
```sh
tools/lares-container.sh down
mv ~/.lares ~/.lares-prior-2026-11-19 && mv ~/.lares-next ~/.lares && cp ~/.lares-prior-2026-11-19/lares-surface.env ~/.lares/ && unset LARES_HOUSE      # keep LARES_PULAMA=0 until step 6
tools/lares-container.sh up
tools/lares-container.sh vault unlock --face N && node tools/census-drill.mjs census --root ~/.lares --label 'swap <pet-name>' --out ~/census-drill/swap-<pet-name>.json --lares tools/lares-container.sh   # each face
node tools/census-drill.mjs compare --old ~/census-drill/new-[!b]*.json --new ~/census-drill/swap-*.json --json --out ~/census-drill/swap.json   # par
```

## 6 · The lit house
```sh
unset LARES_PULAMA                                                 # the env file's LARES_PULAMA=1 governs from here
tools/lares-container.sh down
tools/lares-container.sh pulama restand                            # the pūlama on the new image, standing unlit (it still runs the old house's code and keys)
tools/lares-container.sh pulama light                              # your own route
tools/lares-container.sh up
tools/lares-container.sh pulama admit
tools/lares-container.sh vault unlock --all --face 0               # no route: the pūlama serves it
tools/lares-container.sh kahua list --face N --json                # each face
lares rite keep --workspace house-backup --face 0                  # the restored house's first keep
lares rite receipts --face 0
```

## 7 · Then Alpha (you reconnect /mcp)
- the content ledger: `node ~/.lares-scratch/content-ledger.mjs '<roots json>' <out>` against `~/lares-aside-2026-11-19/ledger-pre-refound.json`: every face and keep title present, newer pool bodies winning;
- the restart proof: Alpha writes a personal-slot tiddler; you `down`, `up`; Alpha reads it back;
- the flat-memory notes land in the house (refound plan, writer identity, anon floor, test-architecture decisions);
- the sweep waits for your word (`~/.lares-prior`, the aside folder, old images).
