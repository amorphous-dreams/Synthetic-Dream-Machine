/**
 * unbuilt-laws — the register of laws these models hold and NOTHING YET ENFORCES.
 *
 * ── WHY A REGISTER, AND WHY IT IS SKIPPED ───────────────────────────────────────────────────────
 * This tree's own record names one failure six times: a hand-written enumeration cannot notice what it
 * missed. The cure it reaches for is derivation — the coverage witness reads the code's unions rather
 * than a list. But a law nobody has built declares itself in no union, so derivation cannot find it
 * either. It has to be written down, and the honest place is a test that fails.
 *
 * Every test here is SKIPPED and every one is meant to be UNSKIPPED, never deleted. A green suite that
 * silently omits its own gaps is the shape this house keeps finding; a skipped test with the claim in
 * its title is the shape it keeps choosing (`meta-sidecar-roundtrip`, the deferred front-matter family).
 *
 * ── HOW TO READ ONE ─────────────────────────────────────────────────────────────────────────────
 * The title carries the LAW and what must land first. Where the surface exists, the body asserts the
 * behaviour we want from it and fails on today's behaviour. Where the surface does NOT exist, the body
 * asserts the export, and those NAMES ARE INDICATIVE — an implementer who picks a better one should
 * change the assertion with it. The law is the title; the name is a placeholder.
 *
 * ── THE THREE PLANES THESE SORT BY ──────────────────────────────────────────────────────────────
 * A CABAL is the shared relation over its realm's resources — any community, read as the humans behind
 * its shared Handle cloud. A REALM is that cabal's shared CRDT and other resources. A NEXUS is the
 * federated mesh of hardware many cabals live on. An act belongs to exactly one, and canon #112 rules
 * that fusing two "mis-sites every seat it names".
 */
import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import * as mesh from "../src/index.js";
import { realmFeedPrefix } from "../src/cabal-realm.js";
import { crossingDirection } from "../src/crossing-direction.js";
import { resolveDiskMirrors } from "../src/vessel-island-pool-core.js";
// `../tests/` so the witness's stripped copy under `.unbuilt-laws/` resolves the fixture too.
import { seatedCharter } from "../tests/charter-fixture.js";
import { kahuHand, strangerHand } from "../tests/kahu-reach-fixture.js";
import * as ed25519 from "@noble/ed25519";
import { mintDelegatedHostingAct, signHostingDelegation, verifyDelegatedHostingAct } from "../src/hosting-delegation.js";
import { grantPublicHalf, issueWalkerGrant, verifyWalkerGrant } from "../src/walker-grant.js";
import { hex } from "../src/crypto.js";

const REALM_A = "0x" + "aa".repeat(32);
const FACE_1  = "0x" + "11".repeat(32);

// ════════════════════════════════════════════════════════════════════════════════════════════════
// ② THE REALM'S FEED MUST CROSS — a realm-plane fact on a Nexus-plane board
// ════════════════════════════════════════════════════════════════════════════════════════════════
describe("② the feed crosses its members", () => {
  test("the feed's address carries NO board — it can follow a realm anywhere", () => {
    expect(realmFeedPrefix(REALM_A)).not.toContain("lar:///");
    expect(realmFeedPrefix(REALM_A)).not.toContain("bags/daemon");
  });

  test("A REALM RESOLVES ITS OWN SUBSTRATE FROM ITS ID, PER FACE — faceScopedRealmIndex keeps the mapping the founding ceremony returned (resolution-only, never a discovery roster; face-scoped so one persona takes the blame). Behaviour in realm-index.test.ts; recordFoundedRealm closes the founding→resolution loop", () => {
    expect(Object.keys(mesh)).toContain("faceScopedRealmIndex");
  });

  test("A PEER'S OFFERING ARRIVES — the MESH substrate now stands: faceScopedRealmIndex resolves a realm's shared board by id, and verifiedMaintenanceFromBoard folds a peer's sealed slot off it (a forgery ignored). The remaining red is the DAEMON WIRE: a vessel reading a realm off its resolved shared substrate rather than its own bootstrap board, PROVEN by tools/mesh-scenarios.sh realm-crossing (still measured red in docker)", () => {
    expect(Object.keys(mesh)).toContain("faceScopedRealmIndex");
    expect(Object.keys(mesh)).toContain("verifiedMaintenanceFromBoard");
  });

  test("A SHARED BOARD IGNORES AN UNVERIFIABLE SLOT — verifiedMaintenanceFromBoard stands beside the plain sync fold: async, it folds only a slot whose seal proves its writer rolled it; an unsealed or mis-sealed slot reads ignored, never fatal. Behaviour + a plain-fold CONTROL in realm-verified-fold.test.ts", () => {
    expect(Object.keys(mesh)).toContain("verifiedMaintenanceFromBoard");
  });

  test("A FORGED FEED SLOT CANNOT LIFT THE MAINTENANCE READING — verifiedMaintenanceFromBoard folds only sealed+verified feed slots, so a forged large number reads ignored and the feed maximum holds at the sealed max. The forged-slot CONTROL (the plain feed fold takes the forgery) stands in realm-verified-fold.test.ts", () => {
    expect(Object.keys(mesh)).toContain("verifiedMaintenanceFromBoard");
  });
});

// ════════════════════════════════════════════════════════════════════════════════════════════════
// ④ THE PRIESTHOOD PROMOTES, AND IS RECORDED — the kahu act on the canon bags
// ════════════════════════════════════════════════════════════════════════════════════════════════
describe("④ promotion into canon", () => {
  test("the ladder ranks canon below what shadows it", () => {
    expect(crossingDirection({ from: "public", to: "veil" }).direction).toBe("inward");
    expect(crossingDirection({ from: "veil", to: "public" }).direction).toBe("outward");
  });

  test.skip("A SESSION-FORM TITLE ARRIVING BY SYNC SURFACES TO THE OPERATOR — DEFERRED: lar-uri#/security binds a userinfo-bearing title that reaches stable storage to surface as a violation. The store's WRITE door refuses one by name (`title-law.ts`, every put, family and tombstone). A record a PEER's change carries merges into the document beneath that door, so a session-form key a peer wrote arrives unremarked. Wakes when the sync boundary gains a rail: a reader over an arriving change that names each session-form title on the ward-alert rail, with a durable audit row, and leaves the record where it stands.", () => {
    expect(Object.keys(mesh)).toContain("sessionFormTitlesArrivedIn");
  });

  test.skip("A PROMOTION EMITS A PROPOSAL AND A RECEIPT — DEFERRED: tiddler-store states 'canon promotion is disabled until a Keyhive-backed proposal/receipt graph exists'. The cap gate PERMITS the act (every verb demands admin on the destination bag) and nothing RECORDS it, so a promotion into canon leaves no artifact a later reader can audit or revoke against. Keyhive alpha.8 supplies the delegation surface this was waiting on", () => {
    expect(Object.keys(mesh)).toContain("promotionReceipt");
  });

  test.skip("A PROMOTION WITHOUT A RECEIPT IS NOT DURABLE — DEFERRED: the other half of the graph above. A write that lands in canon carrying no receipt must be refusable after the fact, or the receipt is decoration rather than the record", () => {
    expect(Object.keys(mesh)).toContain("promotionReceipt");
  });

  test("A NON-KAHU MOVE INTO A CANON BAG REFUSES — BUILT (W26 slice 6): every door into `bags/lares` and `bags/lararium` calls the ONE predicate, `requireKahuReach` over `kahuCabalCanonAccess`, before it writes. This floor pins the predicate against each stranger the cabal names; `packages/lararium-tw5/tests/kahu-reach-doors.test.ts` walks every door by name", async () => {
    for (const bag of mesh.SYSTEM_CANON_BAGS) {
      for (const kind of ["joined-without-admission", "admitted-not-joined", "removed", "no-cabal"] as const) {
        await expect(mesh.requireKahuReach(bag, await strangerHand(kind), "MOVE")).rejects.toMatchObject({ reason: "kahu-reach" });
      }
      await expect(mesh.requireKahuReach(bag, undefined, "MOVE")).rejects.toMatchObject({ reason: "kahu-reach" });   // fail closed
      await expect(mesh.requireKahuReach(bag, await kahuHand(), "MOVE")).resolves.toBeUndefined();                  // CONTROL: the Kahu hand
    }
  });

  test.skip("A NON-KAHU COPY OUT OF CANON SUCCEEDS — DEFERRED: the shadow copy must stay cheap (operator ruling), and canon's read-only mount carries it by copy-up on the overlay path. The RESIDENCY path reaches a bag's own doc and mounts nothing, so no test proves the cheap direction stays cheap there", () => {
    expect(Object.keys(mesh)).toContain("promotionReceipt");
  });
});

// ════════════════════════════════════════════════════════════════════════════════════════════════
// ⑤ THE OUTWARD CROSSING WANTS A TIER — the rule exists and the gate cannot reach it
// ════════════════════════════════════════════════════════════════════════════════════════════════
describe("⑤ the outward gate", () => {
  test("the rule already knows outward wants the quorum", () => {
    expect(crossingDirection({ from: "veil", to: "public" }).needsQuorum).toBe(true);
    expect(crossingDirection({ from: "public", to: "veil" }).needsQuorum).toBe(false);
  });

  // KEPT 2026-09-05 — both ⑤ reds greened by the wire, and their vectors live where the layers do:
  //   · A GATE CAN READ A BAG'S TIER — the injection landed as `ActionHandlerOptions.bagTier`
  //     (lararium-tw5/action-handler), supplied by node's hearth-manifest reader
  //     (lararium-node/src/vessel-bag-tier.ts, witnessed in tests/vessel-bag-tier.test.ts) through
  //     keyhive's fs-blind door (DaemonExtra.bagTier). Mesh stays pure — the reader could never live
  //     here, which is why this file cannot assert it directly.
  //   · AN OUTWARD COPY WITHOUT A QUORUM SIGNATURE REFUSES — witnessed at the gate in
  //     lararium-node/tests/action-handler-crossing.test.ts (outward COPY and MOVE refuse; inward
  //     stays cheap; an unthreaded vessel prices lateral). The quorum-SIGNED outward crossing stays
  //     future work: today every outward refuses, fail-closed, until a quorum signature surface exists.
});

// ════════════════════════════════════════════════════════════════════════════════════════════════
// ⑨ THE DYAD IS SPECIFIED IN CODE AND CALLED BY NOTHING
// ════════════════════════════════════════════════════════════════════════════════════════════════
// `mesh/dyad.ts` carries the identity model whole — the vessel×veil relationship made first-class,
// the three names (binding / internal name / Handle), the fleet as a query that never instantiates,
// and the tiering argument against the membership-CRDT family. It is written, typed and tested.
//
// ⚠ ITS ONLY CONSUMER IS ITS OWN TEST. `index.ts` re-exports it; no live path reaches for it. That is
// the same state `crossingDirection` and the recovery keel stand in, and it is a state worth naming
// rather than counting as built: a law specified in code is stronger than a design meme and weaker
// than a wired path, and the corpus keeps mistaking the first for the third.
  test.skip("A KYC RECORD LIVES AT THE BRIDGE, NEVER IN CARRIAGE — DOCTRINE 2026-09-08 (field-collision#standing-tensions): beneficial-ownership law (CTA/AMLD) demands a who-is-who record where a Handle touches money/contracts; the sovereign carriage NEVER holds it (the registry filter is absolute inside the plane) and the legal record lives ENTIRELY at the web2 bridge (bridge-and-reach-plane, foreign creds as #has caps behind the island wall). UNBUILT: no contract-plane KYC artifact exists at the bridge, and no gate refuses a money-touching Handle that lacks one", () => {
    expect(Object.keys(mesh)).toContain("contractPlaneKycAtBridge");
  });

describe("⑨ the dyad, specified and unwired", () => {
  test("the model exports what the doctrine claims of it", () => {
    for (const sym of ["dyadId", "fleetOfGroup", "signDyadBinding", "vesselDyads"]) {
      expect(Object.keys(mesh)).toContain(sym);
    }
  });

  test.skip("A LIVE PATH GATHERS A FLEET — DEFERRED: `fleetOfGroup` and `verifiedFleet` are called by tests/dyad.test.ts and by nothing else, so no vessel ever gathers its own dyads at runtime. The property the model rests on — that a captured vessel spills the dyads admitted TO IT and never the human's map of themselves — is unwitnessed on any real store", () => {
    expect(Object.keys(mesh)).toContain("gatherFleetAtBoot");
  });

  // KEPT 2026-09-08 — A HANDLE CARRIES A CHAIN TO BURN greened (G3 core): the handle-KEL stands as a
  // SIBLING grammar on the frozen persona-KEL primitives — its own domain (HANDLE_KEL_DOMAIN), armed
  // inception carrying the owner-binding (the persona AID inside the prefix hash — the bidirectional
  // proof IS the name), rotation authorized by the owner's head (an injected resolver, so the module
  // never imports the persona grammar), a TERMINAL burn after which any successor refuses forever,
  // and attestations as signed STATEMENTS under the head (no lineage bloat, no board — carried ON the
  // card, registry-filter clean). Witnessed in tests/handle-kel.test.ts (burn-terminality, superseded-
  // owner-rotates-nothing, owner-binding-survives-rotation, attestation end-to-end + the no-roster
  // fence, armed inception). The NYM RETIREMENT (wiring handle-card + antigen onto it) rides G3's
  // build; ruling 4 is TWO lifts (the antigen shedding rides the persona-KEL pin-move, not this).
  test("the handle-KEL grammar is exported and burns", () => {
    for (const sym of ["mintHandleInception", "mintHandleRotation", "mintHandleBurn", "verifyHandleKel", "isBurned", "attestUnderHead"]) {
      expect(Object.keys(mesh)).toContain(sym);
    }
  });

  // KEPT 2026-09-08 — A VETO RIDES THE CHAIN, NEVER A ROSTER greened by the G2 settlement: the
  // provisional marker + the veto kind landed as the persona-KEL's last untyped bytes-change (mintVeto ·
  // foldPersonaContests · headOpKey's provisional restraint · the board's {prefix}/{seq}/{eventCid}
  // contest keying with the veto-beats-provisional fold). All four walked clauses stand witnessed in
  // tests/provisional-veto.test.ts — including the late veto killing a hardened provisional's
  // descendants, and the idle observer whose patience is the resting state. THE GRAMMAR IS FROZEN
  // for the alpha but for one ruled kind, the typed first guardian enrolment, whose absence leaves every
  // other event's bytes as they stood; the handle-KEL builds as a sibling on these primitives (G3).

  test.skip("A PRE-COMMITMENT NEVER EXPIRES UNNOTICED — the quorum's OUTPUT freshness fails before its keys do (a root-metadata expiry took clients down while every key stood healthy); no epoch, pre-commit, or rolling recovery commitment in this stack carries a freshness horizon a reader surfaces BEFORE a gate fails on it", () => {
    expect(Object.keys(mesh)).toContain("commitmentFreshness");
  });

  test.skip("THE RITE SURVIVES A JAMMED SAFE — the ceremony APPARATUS fails before the keys do (a jammed lock postponed the world's most audited signing ceremony); no rite in this stack names its rehearsed contingency path, so an apparatus failure at a real crossing improvises under pressure", () => {
    expect(Object.keys(mesh)).toContain("riteContingency");
  });

  // KEPT — ONE GUARDIAN SET NEVER SPANS COMPARTMENTS: `lares persona guardian enrol` gathers every other face's set off
  // this vessel's own rows and refuses a key one of them holds (`guardian-key-serves-another-face`,
  // persona-policy#/distinct-recovery). Witnessed in mesh tests/guardian-enrolment.test.ts and node
  // tests/guardian-enrolment.test.ts (G2).
  test("the guardian compartment check is exported", () => {
    expect(Object.keys(mesh)).toContain("guardianCompartmentCheck");
  });

  // KEPT 2026-09-06 — A GUARDIAN CAN ROTATE greened by the ROLLING RECOVERY COMMITMENT (operator-
  // approved, the KERI shape): the prefix binds the GENESIS set (anti-swap), while each rotation
  // reveals against its predecessor's `nextRecoverySetHash` and grafts the next — guardian sets
  // turn over log-wise, no delegation needed. Witnessed in tests/rolling-recovery.test.ts (the
  // graft · the grafted set authorizes · the retired set refuses · the tampered graft breaks).

  // KEPT 2026-09-05 — A DYAD IS MINTED WHEN A FACE MEETS A DEVICE greened under the Stage 0 ruling:
  // both ceremony sites write the slot (`foundTheFace` binding-signed at the genesis epoch;
  // `runApplyAdmitPayload` binding:null — no root stands on the joinee, the absence travels), the
  // veil derived off the VESSEL seed per group (`deriveDyadVeil`, dyad-veil.test.ts). Witnessed in
  // lararium-node/tests/dyad-mint-ceremony.test.ts. The fleet-gather red above stands unchanged.
});

// ════════════════════════════════════════════════════════════════════════════════════════════════
// ⑧ ONE CROSSROADS SERVES ONE NEXUS — and a joined node reads the wrong one
// ════════════════════════════════════════════════════════════════════════════════════════════════
// `crossroads#open` settles the model: "One crossroads serves ONE Nexus… the reach is the Nexus,
// never the DreamNet: no confederation-wide floor exists, by design, because a bulletin belongs to
// the body that keeps it." So a board per Nexus is CORRECT, and a founder deriving its own board
// from its own key is correct with it.
//
// ⚠ THE GRAIN IS THE WHOLE POINT, and today's node has the wrong one. Deriving the board from the
// vessel's own key yields ONE BOARD PER VESSEL; the law says one per NEXUS. Those coincide for a
// founder and diverge for everyone else, so the defect is invisible in a fleet of one and structural
// in a community. A vessel does one of two things (operator ruling, 2026-09-03): it FOUNDS a Nexus,
// and its key names that Nexus; or it JOINS one, and adopts that Nexus's key. Standing up a fresh
// Nexus rather than joining a local civic one stays a LAWFUL CHOICE — it is simply a choice, and
// right now every vessel makes it by accident on every boot.
//
// THE LEG IS UNWALKED, not undesigned. A node has no path to any key but its own
// (`nexusPubkey: vesselIdentity.verifyingKey`, seven sites). The BROWSER leaf already walks it:
// its admitted island (`admittedJoineeIsland`), gated on its admit. And the key already travels —
// `lares herm` prints the dial URL(s) AND the gate pubkey "to hand a hearth". Nothing on the
// receiving side keeps it.
describe("⑧ a joined vessel reads its Nexus's board", () => {
  test("the board is derived from a key, so adopting a Nexus is adopting its key", () => {
    // Not a gap — the derivation is total and pure, which is what makes the adoption a one-value
    // change rather than a new mechanism.
    const a = mesh.crossroadsDocUrl("0x" + "aa".repeat(32));
    const b = mesh.crossroadsDocUrl("0x" + "bb".repeat(32));
    expect(a).not.toBe(b);
    expect(mesh.crossroadsDocUrl("0x" + "aa".repeat(32))).toBe(a);
  });

  /**
   * GREENED 2026-09-13 — and, like the dial-pin law above, the ASSERTION NAMED A SHAPE THAT NEVER CAME.
   * It expected a mesh export called `adoptedNexusPubkey`; the cure arrived as `nexusIdentity` — a RANKING
   * (explicit scope → the charter's genesis epoch → the anchor gate key → this vessel's own key) that had
   * stood written and unwired in this package the whole time. So this asserts the LAW: a board keys on the
   * ISLAND, and every vessel class composes ONE ruling to find it.
   */
  test("A NODE THAT JOINS A NEXUS READS THAT NEXUS'S BOARD, NOT ITS OWN — one ruling, every shore", () => {
    const GENESIS = `nexus-${"9e".repeat(32)}`;
    // Two vessels holding ONE charter derive ONE scope, and neither key appears in it.
    const a = mesh.nexusIdentity({ genesisEpochCid: GENESIS, charterStands: true, ownVesselKey: "aa".repeat(32) });
    const b = mesh.nexusIdentity({ genesisEpochCid: GENESIS, charterStands: true, ownVesselKey: "bb".repeat(32) });
    expect(mesh.crossroadsDocUrl(mesh.nexusScopeOrThrow(b))).toBe(mesh.crossroadsDocUrl(mesh.nexusScopeOrThrow(a)));
    // And BOTH shores compose it — a node off its charter, a browser leaf off the anchor it dials.
    for (const shore of ["lararium-node/src/open-node-vessel.ts", "lararium-browser/src/open-browser-vessel.ts"]) {
      const src = readFileSync(join(import.meta.dirname, "..", "..", shore), "utf8");
      expect(src, `${shore} stopped composing the island ruling`).toMatch(/nexusScopeOrThrow\(/);
      expect(src, `${shore} keys a board on its own vessel key again`).not.toMatch(/nexusPubkey: vesselIdentity\.verifyingKey/);
    }
  });

  /**
   * ⚠ AND IT COMPOUNDS ACROSS THREE BOARDS, not one. Every deterministic per-Nexus board derives from
   * the same key — the crossroads bulletin, the WHO face, and the PERSONA-KEL board that maps an
   * identifier to its current op-key head. `federation-gate` federates the KEL board deliberately, so
   * the boards are MEANT to be shared; federating boards derived from different keys federates boards
   * that name different things.
   *
   * The KEL one carries the sharpest consequence: the Binding Gate walks a LOCAL replica and
   * FAIL-CLOSES when a chain is absent. A vessel on the wrong board therefore cannot walk a fellow
   * member's identifier to its head — it halts. So the grain error is not only "reads the wrong
   * bulletin"; it is "cannot verify the people it is federated with."
   */
  test("all three per-Nexus boards derive from the SAME key, so the grain error is one error in three places", () => {
    const a = "0x" + "aa".repeat(32), b = "0x" + "bb".repeat(32);
    for (const mint of [mesh.crossroadsDocUrl, mesh.personaKelBoardDocUrl]) {
      expect(mint(a)).not.toBe(mint(b));
      expect(mint(a)).toBe(mint(a));
    }
  });

  /** GREENED 2026-09-13 by the same cure — the KEL board rides the island scope like every other board. */
  test("A JOINED NODE WALKS ITS NEXUS'S PERSONA-KEL BOARD — the identifier→head map is one map per island", () => {
    const GENESIS = `nexus-${"7c".repeat(32)}`;
    const scopeOf = (own: string): string =>
      mesh.nexusScopeOrThrow(mesh.nexusIdentity({ genesisEpochCid: GENESIS, charterStands: true, ownVesselKey: own }));
    expect(mesh.personaKelBoardDocUrl(scopeOf("aa".repeat(32)))).toBe(mesh.personaKelBoardDocUrl(scopeOf("bb".repeat(32))));
    // AND THE THIRD STATE holds it honest: a charter that STANDS and reads torn resolves NO board at all,
    // rather than descending a serving vessel to a private one it would read as agreement.
    const torn = mesh.nexusIdentity({ genesisEpochCid: null, charterStands: true, ownVesselKey: "aa".repeat(32) });
    expect(torn.kind).toBe("torn");
    expect(() => mesh.nexusScopeOrThrow(torn)).toThrow(/torn/i);
  });

  /**
   * GREENED 2026-09-13 — the first law in this register to flip, and the register never noticed.
   *
   * The deferral read: "nothing on the receiving side stores it… the leg that keeps what was handed over
   * does not exist, so a hearth re-learns its Nexus by hand every boot or not at all." That leg EXISTS
   * now — an admission packs `HEARTH_SYNC_URL_TIDDLER` + `HEARTH_GATE_KEY_TIDDLER` into the joinee's
   * bootstrap, `readHearthDialPin` reads both back fail-closed on any tear, and `open-node-vessel` reads
   * the pin at boot. `packages/lararium-node/tests/hearth-dial-pin.test.ts` proves the round trip.
   *
   * THE ASSERTION NAMED A SHAPE THAT NEVER CAME. It expected a mesh export called `adoptedNexusPubkey`;
   * the cure arrived as a PINNED PAIR read by the node boot instead. A red law asserting a guessed symbol
   * stays red forever after the capability lands under another name — the register measures the guess, not
   * the law. So this asserts the LAW: the two halves of a dial travel together or neither does.
   *
   * The pin's own module lives in `@lararium/node` and mesh may not import it (node imports mesh, never the
   * reverse), so the shape is read from source — the honest reach from this side of the boundary.
   */
  test("THE HERM'S GATE PUBKEY REACHES THE HEARTH THAT DIALS IT — the pinned pair a joinee keeps across boots", () => {
    const pin = readFileSync(
      join(import.meta.dirname, "..", "..", "lararium-node", "src", "hearth-dial-pin.ts"), "utf8");
    // BOTH HALVES OR NEITHER: a url with no gate key dials a door it cannot prove, and a key with no url
    // names no door — the packer returns `{}` unless it holds both.
    expect(pin).toMatch(/HEARTH_SYNC_URL_TIDDLER/);
    expect(pin).toMatch(/HEARTH_GATE_KEY_TIDDLER/);
    expect(pin, "the packer lets a half pin through").toMatch(/if \(!syncUrl \|\| !gatePubKey\) return \{\};/);
    // And the boot READS it — a pin nothing consults leaves the hearth re-learning by hand, which is the
    // deferral's own words.
    const boot = readFileSync(
      join(import.meta.dirname, "..", "..", "lararium-node", "src", "open-node-vessel.ts"), "utf8");
    expect(boot, "the boot stopped reading the dial pin").toMatch(/readHearthDialPin\(/);
  });
});

// ════════════════════════════════════════════════════════════════════════════════════════════════
// ⑦ THE DAEMON WIKI USES THE SHARED WORKING-LAYER ONTOLOGY
// ════════════════════════════════════════════════════════════════════════════════════════════════
// The daemon uses its wiki's working slot as the writable layer. The daemon bag carries private
// control records. The working slot projects under `wikis/daemon`; the private daemon bag's missing
// mirror is held where the daemon's mirrors are built (node `daemon-working-mirror.test.ts`).
describe("⑦ the daemon wiki, held to the laws every other wiki obeys", () => {
  test("the recipe already NAMES the slots the daemon is not granted", () => {
    // Not a gap in the model — `expandRecipe` mints the same five slots for every slug, daemon
    // included. The absence is entirely in the grants, which is what makes this a small change.
    const slots = mesh.expandRecipe({ wikiSlug: "daemon" });
    for (const kind of ["temp", "draft", "personal", "working"] as const) {
      expect(slots).toContain(mesh.wikiSlotUri("daemon", kind));
    }
    expect(slots).toContain(mesh.wikiBagUri("daemon"));
  });

  test("the default writable of a wiki is always its working slot — temp never", () => {
    expect(mesh.defaultWritableSlot("daemon")).toBe(mesh.wikiSlotUri("daemon", "working"));
    expect(mesh.slotLayerFlags(mesh.wikiSlotUri("daemon", "working"), "daemon").defaultWritable).toBe(true);
    expect(mesh.slotLayerFlags(mesh.wikiSlotUri("daemon", "temp"), "daemon").defaultWritable).toBe(false);
  });

  // `resolveDiskMirrors` resolves a `wikiSlot` grant (working → bag `wikis/{slug}/working`, disk
  // `wikis/{slug}`) separately from a `selfCanon` grant (`bags/{slug}` → disk `bags/{slug}`), so a
  // recipe may designate the daemon's working layer for disk WITHOUT designating the bag beneath it.
  // The control plane — verb tiddlers, outcomes, flows, binding records — stays off the operator's
  // tracked tree by designating one and not the other, and no new mechanism is owed.
  test("the mirror resolver already separates a wiki's working slot from its canon bag", () => {
    const grant = [
      { bagId: "", mirrorRoot: "wikis", wikiSlot: "working" as const },
      { bagId: "", mirrorRoot: "bags",  selfCanon: true },
    ];
    const workingOnly = resolveDiskMirrors(grant, [mesh.wikiSlotUri("daemon", "working")], "daemon");
    expect(workingOnly.map((g) => g.bagId)).toEqual([mesh.wikiSlotUri("daemon", "working")]);
    expect(workingOnly[0]?.mirrorRoot).toBe("wikis/daemon");
  });
});

// ════════════════════════════════════════════════════════════════════════════════════════════════
// ⑪ ONE FACE'S SESSIONS — a view and a resolver that stand specified, and the doors that still bypass them
// ════════════════════════════════════════════════════════════════════════════════════════════════
// The session-scoped document view, the one recipe resolver and the pool's surface door stand in code
// (`session-document-view.ts`, `surface-recipe.ts`, `mountSurface`). No production caller mounts a surface:
// each waits on a session that wears a verified face. Until then every wiki island rides a broad port.
describe("⑪ one face's sessions", () => {
  const stripped = (path: string[]): string => {
    const source = readFileSync(join(import.meta.dirname, "..", "..", ...path), "utf8");
    const code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    expect(code.length, "the strip left the module's code standing").toBeGreaterThan(source.length / 10);
    return code;
  };

  test("the surface door stands, and it attaches through the view", () => {
    const pool = stripped(["lararium-mesh", "src", "vessel-island-pool-core.ts"]);
    expect(pool).toMatch(/async mountSurface\(/);
    expect(pool).toMatch(/view\.attach\(this\._mainRepo, mainPort\)/);
  });

  test.skip("NO ISLAND RIDES A BROAD PORT INTO A SESSION — DEFERRED: the pool's wiki door (`mountWiki`) still attaches its island's port with `attachMessageChannelSync`, and every production wiki mounts through it (`mountPrimaryWiki`, the residency collector's `ensureWiki`). Lands when a session wears a verified face (session-contract debt three) and the node and browser callers hold sessions (debts five and seven): each interactive surface then mounts through `mountSurface`, and the wiki door's broad attach leaves the pool. The vessel's own face-blind daemon keeps its broad port through `daemon-vm-core`, which stays outside this pool.", () => {
    const pool = stripped(["lararium-mesh", "src", "vessel-island-pool-core.ts"]);
    expect(pool).not.toMatch(/attachMessageChannelSync\(/);
  });

  test("the browser selects plugins through the one function", () => {
    const browser = stripped(["lararium-browser", "src", "open-browser-vessel.ts"]);
    expect(browser).not.toMatch(/selectPluginBlobs\(/);
    expect(browser).toMatch(/resolveRecipePluginCids\(/);
  });

  test("an admitted leaf wears the one-way gate over its hearth's canon", () => {
    const browser = stripped(["lararium-browser", "src", "open-browser-vessel.ts"]);
    expect(browser).toMatch(/new GatedSyncLeg\(adapter, oneWayDocumentsGate\(\{ receiveOnly: canonIds \}\)\)/);
  });

  test.skip("A HEARTH TAKES NO CHANGE TO ITS CANON FROM A LEAF — DEFERRED: the leaf wears the one-way gate over its hearth's canon (`open-browser-vessel.ts`), which keeps an honest leaf from sending a change. The hearth's own socket still takes one: no `sendOnly` twin wraps its adapter (`open-node-vessel.ts`), so a leaf that drops its gate still writes the hearth's canon. Lands when the hearth knows which peers stand as its admitted leaves at the adapter (the share verdict's peer classes) and wraps its socket with `oneWayDocumentsGate({ sendOnly })`.", () => {
    const node = stripped(["lararium-node", "src", "open-node-vessel.ts"]);
    expect(node).toMatch(/oneWayDocumentsGate\(/);
  });
});

// ════════════════════════════════════════════════════════════════════════════════════════════════
// ⑥ THE INDEPENDENT OPERATOR — a principal class the fleet has never stood
// ════════════════════════════════════════════════════════════════════════════════════════════════
describe("⑥ the node runner without grammar caps", () => {
  test.skip("A VESSEL BOOTS AND RELAYS WITHOUT CAPS ON THE BASE GRAMMAR — DEFERRED: every docker vessel is a full-caps founder or joiner. An independent operator runs metal for the Nexus and holds no cabal-cap on the lares/lararium bags; nothing proves such a vessel boots, syncs and relays rather than failing closed on a grammar read it cannot make", () => {
    expect(Object.keys(mesh)).toContain("independentOperatorBoot");
  });

  test.skip("AN INDEPENDENT OPERATOR CANNOT WRITE CANON AND CAN HOLD ITS OWN CABAL — DEFERRED: the two halves that make the class worth having. Running infrastructure must not confer authorship of the grammar, and lacking that authorship must not deny a vessel its own cabal and realm", () => {
    expect(Object.keys(mesh)).toContain("independentOperatorBoot");
  });
});

// ══════════════════════════════════════════════════════════════════════════
// ⑩ REMOVAL'S REACH — the parts of kapae#/reach and #/keys no code enforces
// ══════════════════════════════════════════════════════════════════════════
describe("⑩ removal's reach, past the gates that stand built", () => {
  test("A SEAT WITHOUT STANDING GETS REVOKED — kapae#/keys. A pure planner reads a fold of the edge boards and names each seat that outlived its standing, and each counted raise that still owes one roll of the seat it names; a seat no counted raise names owes nothing, and a reading with no counted raise behind it moves no key.", () => {
    const seat = { group: "0xgroup", member: "0xmember" };
    const row = { scope: "s", edgeId: "e", seat, aside: true, raiseCids: ["r1"], seatStands: true };
    const plan = (rows: (typeof row)[], rolled: string[] = []) => mesh.planSeatDuties({ seats: rows, rolled: () => new Set(rolled), selfAside: () => false });
    expect(plan([row])).toEqual([{ kind: "revoke", scope: "s", edgeId: "e", seat, raiseCids: ["r1"], then: "leave-out" }]);
    expect(plan([{ ...row, raiseCids: [] }])).toEqual([]);
    expect(plan([{ ...row, seatStands: false }])).toEqual([{ kind: "settled", scope: "s", edgeId: "e", seat, raiseCids: ["r1"] }]);
  });

  test("A LIFT SEATS AFRESH AND RETURNS NO EARLIER KEY — kapae#/re-admission. A raise and its lift read together still revoke the earlier seat and name a fresh one after it; a lifted raise reads `owing` until the vessel answers it, and `returned` from then on.", () => {
    const seat = { group: "0xgroup", member: "0xmember" };
    const lifted = { scope: "s", edgeId: "e", seat, aside: false, raiseCids: ["r1"], seatStands: true };
    expect(mesh.planSeatDuties({ seats: [lifted], rolled: () => new Set(), selfAside: () => false }))
      .toEqual([{ kind: "revoke", scope: "s", edgeId: "e", seat, raiseCids: ["r1"], then: "seat-afresh" }]);
    const reading = { verdict: "withdrawn" as const, stands: false, raiseCids: ["r1"] };
    expect(mesh.edgeStandingOf(reading, new Set())).toBe("owing");
    expect(mesh.edgeStandingOf(reading, new Set(["r1"]))).toBe("returned");
  });

  test("A VESSEL UNDER ITS OWN SHADOW MINTS NO KEY EPOCH, AND THE FORK SURFACES — kapae#/keys, mutual removal. The plan holds one forked row for a scope where this vessel reads a shadow over its own edge, and `forkStandsOver` names two parties that each stand set aside under a raise the other signed.", () => {
    const seat = { group: "0xgroup", member: "0xmember" };
    const row = { scope: "s", edgeId: "e", seat, aside: true, raiseCids: ["r1"], seatStands: true };
    expect(mesh.planSeatDuties({ seats: [row], rolled: () => new Set(), selfAside: () => true })).toEqual([{ kind: "forked", scope: "s" }]);
    expect(Object.keys(mesh)).toContain("forkStandsOver");
  });

  test("A QUORUM EDGE ACT CROSSES BETWEEN VESSELS AS A PARTIAL — STANDING edge primitive; Nexus admit, revoke, kapae and roll-anchor callers remain owed. A partial carries the whole edge act and subject, and its reader refuses mismatched bytes.", () => {
    for (const name of ["edgeActPartial", "readEdgeActPartial", "judgeEdgeActPartial", "cosignEdgeActPartial"]) expect(Object.keys(mesh)).toContain(name);
    expect(mesh.readEdgeActPartial({ kind: "edge-act-partial", scope: "ab".repeat(32), subject: { kind: "member", member: "cd".repeat(32) }, act: {} })).toBeNull();
  });

  // WAVE-THREE PREP. Each row names one unbuilt law; its separately named behavioral file runs a green
  // control by default and the red under LAR_UNBUILT_REDS=1. No production source or signed bytes move here.
  test("A GENESIS READS ONLY WITH EVERY SEAT'S INCEPTION SIGNATURE — COFOUND_REQUIRES_TWO_INCEPTION_SIGNATURES; nexus-cofound-law.test.ts holds the one-signature, split-image, doubled and foreign vectors.", async () => {
    const { inception, ...bare } = (await seatedCharter({ seats: 2, threshold: 2, seed: 77 })).chain[0]!;
    expect(mesh.verifySealLineage([bare])).toBe(false);
    expect(mesh.verifySealLineage([{ ...bare, inception: { ...inception!, signatures: inception!.signatures.slice(0, 1) } }])).toBe(false);
    expect(mesh.verifySealLineage([{ ...bare, inception }])).toBe(true);
  });
  test("A HOUSEHOLD SEED NEVER BECOMES A JOINT NEXUS — COFOUND_OFFER_IS_NOT_A_CHARTER; nexus-cofound-law.test.ts. The cofound door keeps both seed charter homes byte-identical while the joint charter files under its own AID (node cofound-ceremony.test.ts W1, CLI seal-cofound.test.ts C1).", () => {
    for (const name of ["readCofoundOffer", "cofoundCharterDoc", "verifyCadenceInception"]) expect(Object.keys(mesh)).toContain(name);
    expect(mesh.readCofoundOffer({ kind: "cofound-offer" })).toBeNull();
  });
  test("A NEXUS QUORUM PARTIAL IS JUDGED BEFORE A SECOND SEAT SIGNS — PARTIAL_COSIGN_JUDGES_BEFORE_SIGNING; nexus-partial-law.test.ts. The edge primitive stands; admission, revocation, kapae and roll-anchor callers must each judge their own exact image and causal fence.", () => {
    expect(Object.keys(mesh)).toContain("judgeNexusActPartial");
  });
  test.skip("TWO VAULTS SIGN EACH FOUNDER'S SELF-CONTRACT — TWO_VAULT_SELF_CONTRACTS; nexus-contract-two-root design only until K14 releases nexus-contract.ts and its tests: each root consents once, neither holds two seat seeds, both sign the same act, and both independently fold both contracts after file courier and restart.", () => {
    expect(Object.keys(mesh)).toContain("cosignNexusContractPartial");
  });
  test("A JOINED VESSEL CERTIFIES ITS OWN FACE-SCOPED KEY — JOINED_VESSEL_CERTIFIES_OWN_KEY; session-face-reissue.test.ts. A borrowed certificate must not open that vessel's session.", () => {
    expect(Object.keys(mesh)).toContain("openJoinedFaceSession");
  });
  test("A VERIFIED GATE HOLDS THE FIRST APPLICATION FRAME UNTIL ITS SESSION OPENS — VERDICT_OPENS_BEFORE_FIRST_SYNC_FRAME; gate-session-order.test.ts drives a real gate and dial with an immediate frame against a held seat, and `@lararium/node` face-gate-server.test.ts drives the same law over a live WebSocket. The seat channel buffers across verdict then open.", () => {
    for (const name of ["seatedChannel", "dialedChannel", "channelSessionTable"]) expect(Object.keys(mesh)).toContain(name);
  });
  test("EVERY PRODUCTION DIAL SPEAKS ONE HANDSHAKE — the Noise IK flight, a sealed presentation and the gate's signed verdict. One client transport dials and one face gate answers, and a sealed gate answers a text frame by cutting the socket (the node gate server's text-frame vector).", () => {
    for (const name of ["LarWSClientAdapter", "makeFaceGate", "presentedAdmitReader"]) expect(Object.keys(mesh)).toContain(name);
  });
  test("THE FLOOR ANNOUNCEMENT AND GATE SHARE ONE PIN — ANNOUNCEMENT_AND_GATE_SHARE_PIN; gate-announcement-law.test.ts and floor-announcement.test.ts. The floor bundle signs `waking-floor-announce`, and the reader refuses any pin but the one it already holds; the socket and relay carriers have no caller yet.", () => {
    for (const name of ["gateAnnouncementImage", "signFloorAnnouncement", "readFloorAnnouncement"]) expect(Object.keys(mesh)).toContain(name);
  });
  test.skip("THE BROWSER'S IK FIRST FLIGHT SURVIVES THE TERMINATOR — BROWSER_IK_FIRST_FLIGHT_SURVIVES_TERMINATOR. Design only until the browser/proxy witness exists: fixed selected subprotocol, bounded header, no pre-finish application effect, no retained token in proxy logs.", () => {
    expect(Object.keys(mesh)).toContain("browserIkUpgradeWitness");
  });

  test("A BAG'S CONTENT KEY ROLLS AT THE SEAT'S ROLL — kapae#/keys, the content-key seam. One production subscriber stands: the daemon island seats the content-key holder beside its Keyhive identities (`seatContentKeys`), that seat subscribes the content-key roll to the island's own seat rolls, and the node hands the island its sealed-store shore. The roll itself runs in `@lararium/node` `tests/sealed-store-vessel.test.ts` (through `announceSeatRoll`, over a founded island) and in `@lararium/keyhive` `tests/content-key-seat.test.ts` (through the real executor on real identities).", () => {
    const code = (...parts: string[]): string => readFileSync(join(import.meta.dirname, "..", "..", ...parts), "utf8").replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, "");
    const seat = code("lararium-keyhive", "src", "content-key-seat.ts");
    const island = code("lararium-keyhive", "src", "operator-daemon-behavior.ts");
    const shore = code("lararium-node", "src", "node-daemon-island.ts");
    expect(seat.length).toBeGreaterThan(1000);                      // the strip left the module's code
    // A census, never a mention: one subscription in the seat, one seat in the island, one shore handed in.
    expect(seat.match(/subscribeSeatRolls\)\(sink\)/g)?.length).toBe(1);
    expect(seat.match(/contentKeyRollSink\(holder\.rollerPorts\(/g)?.length).toBe(1);
    expect(island.match(/contentKeys = seatContentKeys\(\{/g)?.length).toBe(1);
    expect(shore.match(/sealedStore: nodeSealedStoreShore\(/g)?.length).toBe(1);
    expect(Object.keys(mesh)).toContain("contentKeyRollSink");
    // CONTROL: the same census reads zero in a module that subscribes nothing.
    expect(code("lararium-keyhive", "src", "keyhive-lockbox.ts").match(/subscribeSeatRolls/g)).toBeNull();
  });

  test("THE PERSONAGROUP STANDS AS A GROUP, AND ITS REVOCATION ROLLS EVERY BAG IT REACHES — kapae#/keys. A face's PersonaGroup founds as a Keyhive group, and Keyhive carries a removal down to every document the group reaches (`seat-roll-substrate`, probes 8 and 9). Behaviour in `@lararium/node` `tests/persona-group-roll.test.ts`; this census reads the founding door.", () => {
    const provider = readFileSync(join(import.meta.dirname, "..", "..", "lararium-keyhive", "src", "keyhive-provider.ts"), "utf8");
    expect(provider).toMatch(/generateGroup\(/);
  });

  test.skip("A REALM'S KEY GROUP SEATS ITS MEMBERS, AND A MEMBER EDGE MOVES A KEY — DEFERRED: kapae#/keys. The plan and the executor serve any seat; no production path seats a member in a realm's group, so only a dyad's raise moves a key. Lands with the realm's own admission act.", () => {
    expect(Object.keys(mesh)).toContain("realmSeatFacts");
  });

  test.skip("MUTUAL REMOVAL EXITS BY AN EXPLICIT FORK ACT — DEFERRED: kapae#/keys. The fork surfaces at every reading and no key moves under it; no door founds the fresh realm, with its own roots and a fresh key epoch, that an exit takes. Lands once a realm seats roots of its own.", () => {
    expect(Object.keys(mesh)).toContain("signRealmFork");
  });

  test.skip("A HOLDER HANDS A MISSED SPAN OVER BY A SEPARATE ACT — DEFERRED: kapae#/re-admission. A device that returns takes a fresh seat with no re-seal; no door lets a holder re-seal the span it missed by a named, explicit act.", () => {
    const join_ = readFileSync(join(import.meta.dirname, "..", "..", "lararium-keyhive", "src", "face-join.ts"), "utf8");
    expect(join_).toMatch(/handOverPast/);
  });
});

// ════════════════════════════════════════════════════════════════════════════════════════════════
// ⑫ SESSION, SEALED REST AND HOSTING — the launch-kit reds awaiting production callers
// ════════════════════════════════════════════════════════════════════════════════════════════════
describe("⑫ session, sealed rest and hosting launch gates", () => {
  const stripped = (path: string[]): string => {
    const source = readFileSync(join(import.meta.dirname, "..", "..", ...path), "utf8");
    return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  };

  test.skip("PRODUCTION_SURFACES_USE_SCOPED_VIEW — DEFERRED: `open-node-vessel.ts` and `open-browser-vessel.ts` still mount wiki islands through `mountWiki`; O1 moves both production callers to `mountSurface` after W hands over verified sessions.", () => {
    const node = stripped(["lararium-node", "src", "open-node-vessel.ts"]);
    const browser = stripped(["lararium-browser", "src", "open-browser-vessel.ts"]);
    expect(node).toMatch(/\.mountSurface\(/);
    expect(browser).toMatch(/\.mountSurface\(/);
  });

  test("BROWSER_SECRET_ROWS_REST_UNDER_THE_SLOT — cleartext lives in the live wiki and the person's projected files alone: a browser face's per-Nexus keys, face-scoped keys, address secret, pending join and walk records rest as custody rows under the slot tree, and the schema keeps no clear store for them. `packages/lararium-browser/tests/browser-secret-census.test.ts` measures the whole database.", () => {
    const identity = stripped(["lararium-browser", "src", "browser-vessel-identity.ts"]);
    expect(identity).not.toMatch(/createObjectStore\((NEXUS_KEY_STORE|VESSEL_FACE_KEY_STORE|WALK_STORE)\)/);
    const join = stripped(["lararium-browser", "src", "browser-fleet-join.ts"]);
    expect(join).not.toMatch(/`secret:\$\{/);
  });

  test.skip("FRESH_BASE_PRECEDES_FROM_NOW_CHANGE — DEFERRED: `content-key-holder.ts` already refuses an admission without `freshBase`, but the node document store supplies no production callback that writes a fresh checkpoint before the new version's first change; sealed-store step 3 connects and witnesses that callback.", () => {
    const node = stripped(["lararium-node", "src", "node-daemon-island.ts"]);
    expect(node).toMatch(/freshBase\s*:/);
  });

  test("HOSTING_ACT_BINDS_OPERATOR_SEAT_AND_THREE_DIALS — the pure act stands in `hosting-delegation.ts`: the seat's delegation and the hosting key's signature bind the Nexus, the epoch parent and the three dials, so a moved seat or dial refuses. Behaviour and the vector set in hosting-delegation.test.ts; the live cut of issuer, reader, store and sorter waits on W", async () => {
    const seat = new Uint8Array(32).fill(41), hostingSeed = new Uint8Array(32).fill(42), nexusAid = "nexus-" + "a".repeat(64);
    const hostingKey = hex(await ed25519.getPublicKeyAsync(hostingSeed));
    const delegation = await signHostingDelegation({ seatSeed: seat, nexusAid, hostingKey });
    const epoch = await mintDelegatedHostingAct({ hostingSeed, delegation, prev: null, dials: { openIntroductions: 1, preAnswered: 3, strangersHeld: 0 } });
    const mutations: Record<string, unknown>[] = [
      { seat: hex(await ed25519.getPublicKeyAsync(new Uint8Array(32).fill(43))) },
      { dials: { ...epoch.act.dials, openIntroductions: 2 } },
      { dials: { ...epoch.act.dials, preAnswered: 4 } },
      { dials: { ...epoch.act.dials, strangersHeld: 1 } },
    ];
    expect(verifyDelegatedHostingAct(epoch.act)).toBe(true);
    for (const mutation of mutations) {
      expect(verifyDelegatedHostingAct({ ...epoch.act, ...mutation })).toBe(false);
    }
  });

  test("SERVING_CHECKS_WALKER_GRANT_WITH_PUBLIC_HALF — H8's signed grant stands in `walker-grant.ts`: the epoch's grant key signs it and a serving checker reads it under the public half alone, holding no minting secret. Behaviour per axis in walker-grant.test.ts; E's walker arm and the serving rows wait on the live cut", async () => {
    const hostingSeed = new Uint8Array(32).fill(42), nexusAid = "nexus-" + "a".repeat(64);
    const hostingKey = hex(await ed25519.getPublicKeyAsync(hostingSeed));
    const delegation = await signHostingDelegation({ seatSeed: new Uint8Array(32).fill(41), nexusAid, hostingKey });
    const epoch = await mintDelegatedHostingAct({ hostingSeed, delegation, prev: null, dials: { openIntroductions: 1, preAnswered: 3, strangersHeld: 0 } });
    const grant = await issueWalkerGrant(epoch, { leaf: "d75a980182b10ab7d54bfed3c964073a0ee172f3daa62325af021a68f707511a", lineage: "d".repeat(64), survived: 0, from: "walker" });
    const publicOnly = grantPublicHalf(epoch);
    expect(Object.keys(publicOnly).sort()).toEqual(["epoch", "grantKey", "nexusAid"]);
    expect(verifyWalkerGrant(publicOnly, grant)).toBe(true);
  });

});
