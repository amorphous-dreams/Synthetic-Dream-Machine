#!/usr/bin/env bash
# contract-witness — the operator handshake across TWO vessels that share no key.
#
# ── WHAT A ONE-VESSEL WALK CANNOT SEE ─────────────────────────────────────────────────
# Walking movement ⑦ on one hearth runs both halves of the handshake there, so the joiner's
# contract-in gets signed by a persona that same vessel holds. Every byte verifies, and the one property
# the whole ceremony exists for goes unmeasured: that a Nexus admits a key it has NEVER HELD.
#
# So this stands two roots. Vessel A founds a Nexus and seats its quorum. Vessel B founds independently —
# its own device key, its own persona roots, its own vault passphrase — and A holds no seed of B's. The
# handshake then has to cross a real custody boundary, which is the only boundary this ceremony defends.
#
# ── THE PREREQUISITE THE ONE-VESSEL RUN HID ─────────────────────────────────────────────────────
# `nexus accept-carriage` reads the roster from the JOINER'S OWN seal home, because a contract-in binds to
# the charter epoch it consents under. On one vessel that read is invisible — one seal home serves both
# hands. Across two it becomes a step somebody has to perform: B cannot consent to a Nexus whose charter
# it has never seen. This harness carries A's `founding-roster.mem` to B by hand and SAYS that it did,
# because a witness that quietly satisfies a prerequisite has measured a system that does not exist.
#
# The charter carries public material only — seated verifying keys, threshold, epoch lineage. Holding it
# lets B name the epoch it consents under; it grants B no quorum, since B holds no kahu signing key.
#
# ── WHAT STAYS UNMEASURED, NAMED ────────────────────────────────────────────────────────────────
# Both vessels sit on one filesystem, and the two artifacts move by `cp`. That matches the CLI's own
# instruction — `hand this to a founding kahu` — so the token IS an out-of-band bearer artifact by design.
# What this does not walk is a NETWORK carry, nor two machines with two clocks. `herm-mesh-witness` and
# the container harness cover the wire; this one covers CUSTODY.
#
# ── THE PRESENTED ADMIT (S6), AND THE RAISE DOOR THAT READS IT ───────────────────────────────────────
# Once A admits B, B's admit is a PRESENTATION: the counted admit head for B's leaf and its closed, tight
# lineage, derived off A's board by `presentedAdmitFromBoard` — the same derivation a dial presents after
# sync. A small node helper (written to the transfer dir, importing the BUILT dist of @lararium/mesh and
# @lararium/node) reads it against A's own replica with `verifyPresentedAdmit`: HELD after the admit, DENIED
# after a descending revoke, WRONG-EPOCH after the charter rolls. It checks that only B's leaf proves the
# admit to a socket, and that the wire guard refuses the admit beside a root edge. The raise door then
# walks: `lares raise sign` signs as a held persona's LEAF with the leaf's admit attached, and
# `verifyRaiseGrant` raises it against A's readings; a foreign signer carrying the same admit refuses.
#
# ── THE EPOCH ROLL ARMS WITH THE KEY-SET IT REVEALS ─────────────────────────────────────────────────────
# `seal rotate` reveals the personas STANDING in the vault, and the reveal must hash to the head's
# pre-commitment. The reserve's commit names three keys derived off a separate reserve seed, and no verb
# provisions those keys into the vault, so a genesis armed with the reserve's commit can never rotate.
# The witness arms with `seal commit` over the roster it will reveal, and says so.
#
# Exit 0 = the door opened for a foreign key, refused every forgery, the presented admit read held, denied
# and wrong-epoch where it should, the raise door raised a leaf and refused a stranger, and the board closed
# by supersession.
set -uo pipefail
cd "$(dirname "$0")/.."
REPO_ROOT=$(pwd)
LARES="$REPO_ROOT/packages/lares-cli/dist/src/bin/lares.js"

FAILED=0
say()  { printf '\n\033[1m%s\033[0m\n' "$*"; }
step() { printf '  %-52s' "$*"; }
ok()   { printf '\033[32mok\033[0m\n'; }
bad()  { printf '\033[31mFAILED (%s)\033[0m\n' "$1"; FAILED=$((FAILED + 1)); }
note() { printf '      \033[90m%s\033[0m\n' "$*"; }

A_ROOT=$(mktemp -d /tmp/lares-contract-A-XXXXXX)
B_ROOT=$(mktemp -d /tmp/lares-contract-B-XXXXXX)
XFER=$(mktemp -d /tmp/lares-contract-xfer-XXXXXX)
cleanup() { rm -rf "$A_ROOT" "$B_ROOT" "$XFER"; }
trap cleanup EXIT

# Each vessel runs in its OWN environment. A subshell per call keeps A's LAR_ROOT from leaking into B's —
# a single exported root would silently make this a one-vessel test again, which is the exact failure the
# harness exists to rule out.
as_a() { ( export LAR_ROOT="$A_ROOT" LAR_PORT=8097 LARES_ARCHIVE_PASSPHRASE_NEW="witness-A"; node "$LARES" "$@" ); }
as_b() { ( export LAR_ROOT="$B_ROOT" LAR_PORT=8098 LARES_ARCHIVE_PASSPHRASE_NEW="witness-B"; node "$LARES" "$@" ); }
run_a() { step "$1"; shift; if out=$(as_a "$@" 2>&1); then ok; else bad "$?"; printf '%s\n' "$out" | tail -5 | sed 's/^/      /'; fi; }
run_b() { step "$1"; shift; if out=$(as_b "$@" 2>&1); then ok; else bad "$?"; printf '%s\n' "$out" | tail -5 | sed 's/^/      /'; fi; }
# `as_a` PREFIXES the binary, so a pipeline cannot ride it — `as_a sh -c ...` hands `sh` to the CLI as a
# subcommand. A grep-the-output check needs a shell that inherits the vessel's environment instead.
sh_a() { ( export LAR_ROOT="$A_ROOT" LAR_PORT=8097 LARES_ARCHIVE_PASSPHRASE_NEW="witness-A"; sh -c "$1" ); }
run_sh_a() { step "$1"; if out=$(sh_a "$2" 2>&1); then ok; else bad "$?"; printf '%s\n' "$out" | tail -5 | sed 's/^/      /'; fi; }

say "contract-witness — two vessels, no shared key"
echo "  A (the Nexus):  $A_ROOT"
echo "  B (the joiner): $B_ROOT"

say "⓪ preflight"
step "the binary answers"
if node "$LARES" help >/dev/null 2>&1; then ok; else bad "build first: pnpm build"; exit 1; fi

# ── ① VESSEL A — found the Nexus, seat the quorum ────────────────────────────────────────────────
# THE SEED EACH FOUNDING READS. `lares vessel found` resolves the hearth true-name (the engine CID) from the
# tracked genesis tree, so an isolated root must carry it before a founding can stand. Its own error names
# this step verbatim — the harness performs it rather than making a reader discover it.
# SEED FROM DISK, NEVER FROM THE INDEX. `git ls-files` names what the index tracks, and a genesis rebake
# writes new content-addressed blobs while the old ones stay listed until someone commits the change. A
# seed built from that list fails on files the disk no longer holds — and worse, when it succeeds it
# founds from a genesis no vessel would ever read, because a vessel reads the disk.
seed_genesis() {
  ( cd "$REPO_ROOT" && find genesis -type f -print0 | xargs -0 -I{} cp --parents "{}" "$1/" ) 2>/dev/null
}

say "① vessel A — the Nexus founds and seats its quorum"
step "seed A's genesis (the hearth true-name lives there)"
if seed_genesis "$A_ROOT"; then ok; else bad "cp genesis"; fi
run_a "A founds"                        vessel stand --install
# A FAILED FOUNDING ENDS THE RUN. Many verbs below answer off disk, so a broken founding fills the report
# with green that means nothing — the cascade a founding check must refuse.
if [ "$FAILED" -ne 0 ]; then
  say "ABANDONED — A's founding failed; every check below would measure an unfounded vessel."
  exit "$FAILED"
fi
KAHU_KEYS=""
for spec in "0:adc-0:Kahu Alpha" "1:adc-1:Kahu Beta" "2:adc-2:Kahu Gamma"; do
  IFS=: read -r idx name handle <<<"$spec"
  step "A mints kahu $idx"
  if MINT=$(as_a persona new "$idx" --name "$name" --handle "$handle" --seat --json 2>&1); then
    ok; KAHU_KEYS="$KAHU_KEYS${KAHU_KEYS:+,}$(printf '%s' "$MINT" | grep -oE '"verifyingKey":"[0-9a-f]{64}"' | head -1 | cut -d'"' -f4)"
  else bad "$?"; printf '%s\n' "$MINT" | tail -4 | sed 's/^/      /'; fi
done
step "A forges the pre-rotation reserve"
if RESERVE=$(as_a nexus seal reserve --guardian-a 'guardian-a' --guardian-b 'guardian-b' --json 2>&1); then
  ok; RESERVE_COMMIT=$(printf '%s' "$RESERVE" | grep -oE '"nextKeyCommit":"[0-9a-f]{64}"' | head -1 | cut -d'"' -f4)
else bad "$?"; printf '%s\n' "$RESERVE" | tail -4 | sed 's/^/      /'; RESERVE_COMMIT=""; fi
# ARM WITH WHAT THE ROTATE WILL REVEAL. The rotate reveals the three kahu standing in A's vault at the
# majority threshold; the commit names exactly that set (see the header).
step "A commits to the key-set the rotate will reveal"
if COMMIT=$(as_a nexus seal commit --keys "$KAHU_KEYS" --threshold 2 --json 2>&1 | grep -oE '"digest":"[0-9a-f]{64}"' | cut -d'"' -f4) && [ -n "$COMMIT" ]; then
  ok
  if [ "$COMMIT" != "$RESERVE_COMMIT" ]; then
    note "measured: the reserve's commit (${RESERVE_COMMIT:0:16}…) ≠ the standing roster's (${COMMIT:0:16}…)"
    note "— a genesis armed with the reserve's commit fails the rotate's reveal."
  fi
else bad "no digest"; COMMIT=""; fi
if [ -n "$COMMIT" ]; then
  run_a "A seats the genesis epoch"     nexus seal seat --next-key-commit "$COMMIT"
else step "A seats the genesis epoch"; bad "no commit from reserve"; fi
step "A's quorum STANDS"
if as_a nexus seal show --json 2>/dev/null | grep -q '"quorumSeated":true'; then ok; else bad "quorum not seated"; fi

# ── ② VESSEL B — found independently ─────────────────────────────────────────────────────────────
say "② vessel B — an INDEPENDENT operator founds their own hearth"
step "seed B's genesis"
if seed_genesis "$B_ROOT"; then ok; else bad "cp genesis"; fi
BEFORE=$FAILED
run_b "B founds (own device key, own vault)"  vessel stand --install
if [ "$FAILED" -ne "$BEFORE" ]; then
  say "ABANDONED — B's founding failed; the handshake has no second vessel to cross to."
  exit "$FAILED"
fi
# The name doubles as the ABSENCE PROBE below, so it must not collide with ordinary prose. A bare
# "joiner" matched "zero-width joiner" inside vendored engine text and read A's root as leaking B's
# key. A probe that can appear by accident measures the corpus, never the boundary.
B_PROBE="bjoiner-$$-xqz"
run_b "B mints its own persona"               persona new 0 --name "$B_PROBE" --handle 'Independent Operator'

step "★ B's key is FOREIGN to A — no shared seed on disk ★"
# The whole ceremony defends one boundary; measure it rather than assume it. If any of B's persona
# material sat under A's root, every signature below would verify for the wrong reason.
#
# THE PROBE MUST BE FINDABLE FIRST. An absence claim over a name nothing ever wrote reads green by
# vacancy, so B's own root answers for the grep before A's root answers for the boundary.
if ! grep -rqs "$B_PROBE" "$B_ROOT" 2>/dev/null; then bad "the probe names nothing under B — the absence below would measure the grep"
elif [ -d "$A_ROOT" ] && ! grep -rqs "$B_PROBE" "$A_ROOT" 2>/dev/null; then ok
else bad "B's material reachable from A's root"; fi

# ── ③ THE PREREQUISITE — carry A's public charter to B ───────────────────────────────────────────
say "③ the prerequisite the one-vessel run hid"
note "accept-carriage reads the roster from the JOINER'S OWN seal home."
note "B cannot consent to a charter epoch it has never seen — so the charter must travel FIRST."
step "B refuses to consent with no charter in hand"
if as_b nexus accept-carriage --index 0 --json >/dev/null 2>&1; then
  bad "B signed a contract-in with no seated charter — fail-closed did not hold"
else ok; fi

step "carry A's founding-roster.mem → B (public material)"
A_SEAL=$(find "$A_ROOT" -name founding-roster.mem -print -quit 2>/dev/null)
if [ -n "$A_SEAL" ]; then
  B_SEAL_DIR=$(dirname "${A_SEAL/$A_ROOT/$B_ROOT}")
  mkdir -p "$B_SEAL_DIR" && cp "$A_SEAL" "$B_SEAL_DIR/" && ok
  note "from ${A_SEAL#$A_ROOT/}  →  B's seal home"
else bad "A wrote no founding-roster.mem"; fi

step "★ the charter grants B no QUORUM — it carries public material only ★"
# B now holds A's charter. If that alone let B sign quorum acts, the public charter would BE the key.
if as_b nexus contract 0000000000000000000000000000000000000000000000000000000000000000 --json 2>&1 | grep -q '"ok":true'; then
  bad "B raised a quorum act holding only the public charter"
else ok; fi

# ── ④ THE HANDSHAKE ──────────────────────────────────────────────────────────────────────────────
say "④ the handshake — B consents, A's quorum admits"
step "B signs its contract-in (the joiner's half)"
if CARRIAGE=$(as_b nexus accept-carriage --index 0 --json 2>&1); then
  ok
  B_NYM=$(printf '%s' "$CARRIAGE" | grep -oE '"nym":"[0-9a-fx]+"' | head -1 | cut -d'"' -f4)
  B_SIG=$(printf '%s' "$CARRIAGE" | grep -oE '"contractSig":"[0-9a-f]+"' | head -1 | cut -d'"' -f4)
  printf '%s\n%s\n' "$B_NYM" "$B_SIG" > "$XFER/contract-in.txt"
  note "token written to the transfer dir — the out-of-band hand-off the CLI instructs"
else bad "$?"; printf '%s\n' "$CARRIAGE" | tail -4 | sed 's/^/      /'; B_NYM=""; B_SIG=""; fi

step "★ A has never held this key ★"
if [ -n "$B_NYM" ] && ! as_a persona list --json 2>/dev/null | grep -q "${B_NYM#0x}"; then ok
elif [ -z "$B_NYM" ]; then bad "no nym to check"
else bad "B's nym appears among A's own personas"; fi

if [ -n "$B_NYM" ] && [ -n "$B_SIG" ]; then
  run_sh_a "★ A's quorum ADMITS a foreign key ★" \
    "node '$LARES' nexus contract '$B_NYM' --sig '$B_SIG' --json | grep -q '\"memberHeld\":true'"
  step "A's members board folds B IN"
  if as_a nexus members --list --json 2>/dev/null | grep -q "${B_NYM#0x}"; then ok; else bad "B absent from the fold"; fi
else
  step "A's quorum admits a foreign key"; bad "no token captured"
fi

# ── THE S6 HELPER — public reads over the BUILT dist, run inside one vessel's environment ─────────────
# Written to the transfer dir, which links the node package's dependency tree so the bare specifiers
# resolve to the same builds the binary runs. Every mode READS a vessel's replica and seal home; none writes.
ln -s "$REPO_ROOT/packages/lararium-node/node_modules" "$XFER/node_modules"
S6="$XFER/s6.mjs"
cat > "$S6" <<'JSEOF'
import { randomBytes } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import * as M from "@lararium/mesh";
import { Repo } from "@automerge/automerge-repo";
import { NodeFSStorageAdapter } from "@automerge/automerge-repo-storage-nodefs";
const D = `${process.env.REPO_ROOT}/packages/lararium-node/dist/src`;
const { larSealHome, larDataDir } = await import(`${D}/vessel-paths.js`);
const { readNexusDoc }            = await import(`${D}/nexus-doc.js`);
const { nodeNexusIsland }         = await import(`${D}/nexus-standing.js`);
const { heldNexusLeaves }         = await import(`${D}/nexus-leaf.js`);
const { loadVesselVerifyingKey }  = await import(`${D}/node-vessel-identity.js`);

/** This vessel's reading of the Nexus at its primary charter: roster head, board as deny board, antigen. */
async function reading() {
  const sealHome = larSealHome();
  const doc    = readNexusDoc(sealHome);
  const roster = M.foundingRoster(doc);
  const island = nodeNexusIsland({ ownVesselKey: await loadVesselVerifyingKey(), sealHome });
  const repo   = new Repo({ storage: new NodeFSStorageAdapter(larDataDir()) });
  try {
    const board   = await M.materializeSharedLarDoc(repo, M.carriageDocUrl(island), "board:carriage-contracts");
    const antigen = await M.materializeSharedLarDoc(repo, M.kapaeAntigenDocUrl(island), "board:kapae-antigen");
    return { aid: M.realmIdOfCharter(doc), roster, denyBoard: M.carriageEntriesFromBoard(board.doc()),
             antigen: M.antigenEntriesFromBoard(antigen.doc()), antigenRoster: roster };
  } finally { await repo.flush().catch(() => {}); }
}
const verdictOf = async (p, r) => M.verifyPresentedAdmit({ admit: p.admit, lineage: p.lineage, roster: r.roster,
  denyBoard: r.denyBoard, antigen: r.antigen, antigenRoster: r.antigenRoster, antigenVerifier: M.makeMultiSigQuorumVerifier() });
const json = (f) => JSON.parse(readFileSync(f, "utf8"));
const hex32 = () => randomBytes(32).toString("hex");

const [mode, a1, a2] = process.argv.slice(2);
switch (mode) {
  case "present": {            // the presentation a nym's admit head makes off this replica
    const r = await reading();
    const p = await M.presentedAdmitFromBoard(r.denyBoard, a1, r.roster);
    if (!p) { console.log("none"); process.exit(1); }
    writeFileSync(a2, JSON.stringify(p));
    console.log("captured");
    break;
  }
  case "verdict": {            // verifyPresentedAdmit against this replica, as of now
    console.log((await verdictOf(json(a1), await reading())).state);
    break;
  }
  case "leafproof": {          // only the admit's own leaf proves it to a socket
    const p = json(a1);
    const aid = M.realmIdOfCharter(readNexusDoc(larSealHome()));
    const leaf = (await heldNexusLeaves(aid)).find((l) => l.verifyingKey === p.admit.nym.toLowerCase());
    if (!leaf) { console.log("no-held-leaf"); process.exit(1); }
    const bind = { nonce: hex32(), gatePubKey: hex32(), vesselKey: await loadVesselVerifyingKey() };
    const proof = async (seed) => M.signLeafProof({ admit: p.admit, ...bind, sign: M.ed25519SignerFromSeed(seed) });
    const honest = await M.verifyLeafProof({ presentedAdmit: { ...p, leafProof: await proof(leaf.seed) }, ...bind });
    const forged = await M.verifyLeafProof({ presentedAdmit: { ...p, leafProof: await proof(randomBytes(32)) }, ...bind });
    console.log(`honest=${honest} forged=${forged}`);
    break;
  }
  case "wire": {               // one socket, one face: the admit never rides beside a root edge
    const p = json(a1);
    const base = { type: "lar:auth", contactCard: "{}", nonce: hex32(), presentedAdmit: p };
    console.log(`alone=${M.isLarAuthMsg(base)} beside-edge=${M.isLarAuthMsg({ ...base, edge: { deviceVerifyingKey: hex32() } })}`);
    break;
  }
  case "challenge": {          // what a herm carrying this Nexus would emit
    const r = await reading();
    console.log(JSON.stringify(M.mintRaiseChallenge({ vesselId: hex32(), nexus: r.aid, epoch: 0, nonce: hex32() })));
    break;
  }
  case "raise": {              // the door's verifier route over this replica's reading
    const live = json(a1);
    const grant = json(a2);
    const r = await M.verifyRaiseGrant({ grant, live, readings: [await reading()],
      verify: (nym, bytes, sig) => M.ed25519VerifyHex(sig, bytes, nym) });
    console.log(r.ok ? `raised by=${r.caps.byNym}` : `refused ${r.why} ${r.detail}`);
    break;
  }
  case "stranger-grant": {     // the same admit, carried by a key that is not its leaf
    const live = json(a1);
    const grant = json(a2);
    const seed = randomBytes(32);
    const byNym = M.hex(await (await import("@noble/ed25519")).getPublicKeyAsync(seed));
    writeFileSync(a2 + ".stranger", JSON.stringify(await M.signRaiseGrant({
      challenge: live, byNym, presentedAdmit: grant.presentedAdmit, sign: M.ed25519SignerFromSeed(seed) })));
    console.log("written");
    break;
  }
  default: console.error(`s6: unknown mode ${mode}`); process.exit(2);
}
JSEOF
s6_a() { ( export LAR_ROOT="$A_ROOT" LAR_PORT=8097 LARES_ARCHIVE_PASSPHRASE_NEW="witness-A" REPO_ROOT="$REPO_ROOT"; node "$S6" "$@" ); }
s6_b() { ( export LAR_ROOT="$B_ROOT" LAR_PORT=8098 LARES_ARCHIVE_PASSPHRASE_NEW="witness-B" REPO_ROOT="$REPO_ROOT"; node "$S6" "$@" ); }
PRESENTED="$XFER/presented-admit.json"

# ── ⑤ S6 — B's admit as a PRESENTATION ───────────────────────────────────────────────────────────────
say "⑤ S6 — B's admit, presented"
note "the presentation derives off A's board (presentedAdmitFromBoard) — what B presents once it holds the board"
step "B's admit head and lineage derive off A's replica"
if [ -n "$B_NYM" ] && out=$(s6_a present "$B_NYM" "$PRESENTED" 2>&1) && [ "$out" = "captured" ]; then ok
else bad "${out:-no nym}"; fi

step "★ (1) B's presented admit reads HELD at A ★"
if [ -s "$PRESENTED" ] && [ "$(s6_a verdict "$PRESENTED" 2>&1)" = "held" ]; then ok
else bad "$(s6_a verdict "$PRESENTED" 2>&1 | tail -1)"; fi

step "★ (2) a leaf proof by ANOTHER key refuses — B's own leaf proves ★"
# CONTROL inside the check: the honest proof by B's own leaf (derived in B's environment) must verify,
# or a refusing forged proof would measure a verifier that refuses everything.
LP=$(s6_b leafproof "$PRESENTED" 2>&1)
if [ "$LP" = "honest=true forged=false" ]; then ok; else bad "$LP"; fi

step "★ (5) the admit beside a root edge fails the wire guard ★"
WG=$(s6_a wire "$PRESENTED" 2>&1)
if [ "$WG" = "alone=true beside-edge=false" ]; then ok; else bad "$WG"; fi

# ── ⑥ THE REFUSALS ───────────────────────────────────────────────────────────────────────────────
say "⑥ the refusals — a gate only shown saying yes is no gate"
step "a foreign nym with NO contract-in refuses"
if as_a nexus contract 1111111111111111111111111111111111111111111111111111111111111111 --json 2>&1 | grep -q '"ok":true'; then
  bad "admitted without consent"; else ok; fi

step "a FORGED signature refuses"
if [ -n "$B_NYM" ]; then
  FORGED=$(printf '%0128d' 0 | tr '0' 'a')
  if as_a nexus contract "$B_NYM" --sig "$FORGED" --json 2>&1 | grep -q '"ok":true'; then
    bad "a forged contract-in verified"; else ok; fi
else bad "no nym"; fi

# ── ⑦ THE RAISE DOOR (O9) — the verifier reads the presented admit ───────────────────────────────────
say "⑦ the raise door — a leaf raises through its presented admit"
note "A's kahu-0 consents as its own LEAF and A's quorum admits it, so A's replica holds a leaf admit to sign with"
step "A's kahu-0 leaf is admitted on A's board"
if SELF=$(as_a nexus accept-carriage --index 0 --json 2>&1); then
  A_LEAF=$(printf '%s' "$SELF" | grep -oE '"nym":"[0-9a-f]{64}"' | head -1 | cut -d'"' -f4)
  A_LEAF_SIG=$(printf '%s' "$SELF" | grep -oE '"contractSig":"[0-9a-f]+"' | head -1 | cut -d'"' -f4)
  if as_a nexus contract "$A_LEAF" --sig "$A_LEAF_SIG" --json 2>&1 | grep -q '"memberHeld":true'; then ok
  else bad "the leaf admit did not land"; fi
else bad "$?"; A_LEAF=""; fi

CHALLENGE="$XFER/raise-challenge.json"; GRANT="$XFER/raise-grant.json"
step "a challenge names A's Nexus by its AID"
if s6_a challenge > "$CHALLENGE" 2>&1 && grep -q '"nexus"' "$CHALLENGE"; then ok; else bad "$(tail -1 "$CHALLENGE")"; fi

step "lares raise sign signs as the LEAF, carrying its admit"
if as_a raise sign "$(cat "$CHALLENGE")" --as 0 --json > "$XFER/raise-sign.out" 2>&1 \
   && node -e 'const o=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")); if(!o.ok) process.exit(1); require("fs").writeFileSync(process.argv[2], JSON.stringify(o.data));' "$XFER/raise-sign.out" "$GRANT" \
   && grep -q "\"byNym\":\"$A_LEAF\"" "$GRANT"; then ok
else bad "$(tail -c 300 "$XFER/raise-sign.out")"; fi

step "★ the door RAISES the leaf's grant ★"
RAISE=$(s6_a raise "$CHALLENGE" "$GRANT" 2>&1)
if [ "$RAISE" = "raised by=$A_LEAF" ]; then ok; else bad "$RAISE"; fi

step "★ CONTROL: a stranger carrying the same admit refuses ★"
if s6_a stranger-grant "$CHALLENGE" "$GRANT" >/dev/null 2>&1; then
  STRANGER=$(s6_a raise "$CHALLENGE" "$GRANT.stranger" 2>&1)
  case "$STRANGER" in "refused rejected signer-is-not-the-admit-leaf") ok ;; *) bad "$STRANGER" ;; esac
else bad "no stranger grant"; fi

# ── ⑧ SUPERSESSION ───────────────────────────────────────────────────────────────────────────────
say "⑧ closing — non-renewal, never deletion"
if [ -n "$B_NYM" ]; then
  run_sh_a "A revokes — the board SUPERSEDES" \
    "node '$LARES' nexus revoke '$B_NYM' --json | grep -q '\"memberHeld\":false'"
else step "A revokes"; bad "no nym"; fi

step "★ (3) a revoke descending from the admit reads DENIED ★"
VD=$(s6_a verdict "$PRESENTED" 2>&1)
if [ "$VD" = "denied" ]; then ok; else bad "$VD"; fi

# ── ⑨ THE EPOCH ROLL ─────────────────────────────────────────────────────────────────────────────
say "⑨ the epoch roll — consent to one epoch is not consent to the next"
# THE CONTROL FIRST: before the roll, B's same token re-admits, so the refusal after the roll is the roll's.
step "CONTROL: before the roll, B's token re-admits"
if [ -n "$B_NYM" ] && [ -n "$B_SIG" ] && as_a nexus contract "$B_NYM" --sig "$B_SIG" --json 2>&1 | grep -q '"memberHeld":true'; then ok
else bad "the token did not re-admit before the roll"; fi

step "A rotates the charter (the armed reveal)"
if ROT=$(as_a nexus seal rotate --next-key-commit "$COMMIT" --json 2>&1) && printf '%s' "$ROT" | grep -q '"ok":true'; then ok
else bad "$(printf '%s' "$ROT" | grep -oE '"message":"[^"]+"' | head -1)"; fi

step "★ a REPLAY across an epoch roll refuses ★"
# The sharpest property: a contract-in binds to the epoch it consented under. Roll A's charter and the
# old token must stop verifying — consent to one epoch is not consent to the next.
if [ -n "$B_NYM" ] && [ -n "$B_SIG" ]; then
  if as_a nexus contract "$B_NYM" --sig "$B_SIG" --json 2>&1 | grep -q '"ok":true'; then
    bad "a contract-in signed under the PRIOR epoch still verified"
  else ok; fi
else bad "no token"; fi

step "★ (4) after the roll, the old admit reads WRONG-EPOCH ★"
VE=$(s6_a verdict "$PRESENTED" 2>&1)
if [ "$VE" = "wrong-epoch" ]; then ok; else bad "$VE"; fi

say "═══ RESULT ═══"
if [ "$FAILED" -eq 0 ]; then
  echo "  the door opened for a key A never held, refused every forgery, read the presented admit held,"
  echo "  denied and wrong-epoch, raised a leaf through it, and closed by supersession."
  # THE CARRY NOW STANDS WALKED. `herm-mesh-witness` carries a dial across three hops between four
  # containers, pointer-signed and hash-matched at the last — so naming it unwalked here would send a
  # reader to build an instrument that already passes. What this witness still does NOT reach is the
  # part no single machine can stage: two machines, two clocks, and a partition between them.
  echo "  This runs in ONE process-space. WALKED ELSEWHERE: the network carry (herm-mesh-witness,"
  echo "  three hops, verified). UNWALKED ANYWHERE: two machines with two clocks."
else
  echo "  $FAILED check(s) failed."
fi
exit "$FAILED"
