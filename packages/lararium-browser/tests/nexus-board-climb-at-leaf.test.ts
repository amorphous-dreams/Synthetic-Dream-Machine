/**
 * nexus-board-climb-at-leaf — THE LEAF BRICKS THE WAY THE NODE BRICKED, and these vectors measure it.
 *
 * ── PHASE ONE, ANSWERED FROM THE BROWSER BOOT'S OWN SOURCE ──────────────────────────────────────────
 * `open-browser-vessel` stands the IDENTICAL fail-closed Binding Gate the node halt came from:
 *
 *     "FAIL-CLOSED: a chain the replica does not carry HALTS the boot (never a global lookup, never a
 *      fall-through to the raw signer pin)."
 *     … if (!personaKelChain || personaKelChain.length === 0) throw new Error(…"absent from the local
 *      board — the Binding Gate cannot reach a head (fail-closed)."…)
 *
 * So the answer is (A): the leaf HALTS, and it halted for the same reason on a walk no less ordinary than
 * the node's. A leaf founds at a PRIVATE NEXUS OF ONE (`nexusIdentity` → `own`, because a founding leaf
 * dials no anchor), the founding ceremony seats its inception on the board keyed by THAT island, the
 * operator later configures the hearth the page dials, and `nexusIdentity` resolves the ANCHOR. The KEL
 * board re-keys, the gate reads a blank board, and the vessel stops opening.
 *
 * The LEAF is the worse half of the pair. A node operator holds `lares vessel found --force` and a
 * re-found; a leaf's anchor key arrives from the page's own configuration, so there is no knob the
 * operator can turn — the vessel simply never boots again.
 *
 * ── AND THE LEAF IS THE ONLY SHORE THAT REACHES THE THIRD RUNG ─────────────────────────────────────
 * `open-browser-vessel` is the only boot that supplies `explicitScope` (off `inviteNexusPubkey`), so a
 * leaf's gradient runs THREE deep — own → anchor → explicit — where the node's runs two. These vectors
 * ride the gradient the leaf boot composes, never a hand-written one.
 *
 * ── WHAT THE LEAF STRUCTURALLY CANNOT CARRY ────────────────────────────────────────────────────────
 * A leaf keeps no seal home, so it holds no charter, so `realmIdOfCharter` has no analogue and the
 * crossroads RE-ANNOUNCE has nothing to re-derive from — `reAnnounceRealmBooksAtIsland` reads
 * "a vessel outside every realm announces nothing — it registers nothing either" and returns inert. That
 * is a fact about the leaf, not a gap in the wiring, and the vector below pins it as inert rather than
 * faking a realm id onto a vessel that holds none.
 *
 * ── THE FAULT-PIN READS THE BOOT'S SOURCE, because no behavioural vector can ───────────────────────
 * `openBrowserVessel` founds a vessel and cannot stand in a unit test. Worse, `priorIslands: []` kills
 * both carries outright while every behavioural vector here stays GREEN — each control asserts what must
 * NOT happen, and an inert call satisfies all of them. So the wiring's red reads the boot file: two calls,
 * each at its own depth, each over the leaf's real sources, naming none of the three refused boards.
 *
 * Meme: lar:///ha.ka.ba/lararium/mesh/nexus-identity
 */
import { describe, test, expect } from "vitest";
import { Repo, type AutomergeUrl } from "@automerge/automerge-repo";
import * as ed from "@noble/ed25519";
import {
  climbNexusBoards, carryPersonaKelUpTheGradient,
  nexusIdentity, nexusIslandsBelow, nexusScopeOrThrow, type NexusIdentityAt,
  materializeSharedLarDoc,
  kapaeAntigenDocUrl, crossroadsDocUrl,
  personaKelBoardDocUrl,
  writeAntigenEntry, antigenEntriesFromBoard, signAntigenEntry,
  writePersonaKelEvent, personaKelChainForPrefix, mintPersonaInception,
  publicRealmBooksFromDoc,
  hex,
} from "@lararium/mesh";
// The boot's own source — the fault-pin's only reachable witness. `?raw` because this suite runs in a
// real chromium and holds no fs; the text is the same text `tsc` compiles.
import bootSrc from "../src/open-browser-vessel.ts?raw";

const seedOf = (n: number): Uint8Array => new Uint8Array(32).fill(n);
const signer = (s: Uint8Array) => (b: Uint8Array) => ed.signAsync(b, s).then(hex);
const pubOf  = (s: Uint8Array) => ed.getPublicKeyAsync(s).then(hex);
const repo = () => new Repo({ sharePolicy: async () => true });
const board = (r: Repo, url: AutomergeUrl) => materializeSharedLarDoc(r, url, "test:board");
async function keysOn(r: Repo, url: AutomergeUrl): Promise<string[]> {
  return Object.keys((await board(r, url)).doc()?.tiddlers ?? {}).sort();
}

/** The epoch a leaf's acts rooted on while it stood alone — ranked BELOW anything the island knows. */
const PRE_EPOCH = `epoch0-${"11".repeat(32)}`;

/**
 * THE LEAF BOOT'S OWN COMPOSITION — `open-browser-vessel.ts`'s `nexusStandsAt`, verbatim in shape.
 *
 * Three terms and no more: a leaf supplies `explicitScope` off the carried invite, `anchorGateKey` off the
 * relay gate key it dials, and its own vessel key. It passes NO `genesisEpochCid` and NO `charterStands` —
 * structurally, because a leaf keeps no seal home, which is exactly what the boot's own comment says.
 */
function leafStandsAt(
  ownVesselKey: string,
  anchorGateKey: string | null = null,
  explicitScope: string | null = null,
): NexusIdentityAt {
  return { explicitScope, anchorGateKey, ownVesselKey };
}

/** The leaf boot's board-climb call, composed exactly as the wiring composes it. */
function leafClimb(r: Repo, at: NexusIdentityAt) {
  return climbNexusBoards({
    repo:         r,
    nexusPubkey:  nexusScopeOrThrow(nexusIdentity(at)),
    priorIslands: nexusIslandsBelow(at),
    realmId:      null,   // a leaf keeps no seal home, so it stands in no realm
  });
}

/** The leaf boot's KEL carry, composed exactly as the wiring composes it. */
function leafKelCarry(r: Repo, at: NexusIdentityAt, prefix: string) {
  return carryPersonaKelUpTheGradient({
    repo:         r,
    nexusPubkey:  nexusScopeOrThrow(nexusIdentity(at)),
    priorIslands: nexusIslandsBelow(at),
    prefix,
  });
}

// ════════════════════════════════════════════════════════════════════════════════════════════════════
// ① THE GRADIENT THE LEAF ACTUALLY STANDS ON — verified, never assumed
// ════════════════════════════════════════════════════════════════════════════════════════════════════
describe("the leaf's gradient — own → anchor → explicit", () => {
  test("a founding leaf stands a PRIVATE NEXUS OF ONE and offers no source", async () => {
    const own = await pubOf(seedOf(101));
    const at  = leafStandsAt(own);
    expect(nexusIdentity(at).kind, "a founding leaf dials no anchor").toBe("own");
    expect(nexusScopeOrThrow(nexusIdentity(at))).toBe(own);
    expect(nexusIslandsBelow(at), "the bottom of the gradient offers no source").toEqual([]);
  });

  test("a leaf that dials an anchor reads the OWN island below it", async () => {
    const own    = await pubOf(seedOf(102));
    const anchor = await pubOf(seedOf(202));
    const at     = leafStandsAt(own, anchor);
    expect(nexusIdentity(at).kind).toBe("anchor");
    expect(nexusScopeOrThrow(nexusIdentity(at))).toBe(anchor);
    expect(nexusIslandsBelow(at), "own → anchor, the leaf's brick walk").toEqual([own]);
  });

  test("★ a leaf carrying an INVITE reads BOTH rungs below — the third rung no other shore reaches", async () => {
    const own      = await pubOf(seedOf(103));
    const anchor   = await pubOf(seedOf(203));
    const explicit = await pubOf(seedOf(303));
    const at       = leafStandsAt(own, anchor, explicit);
    expect(nexusIdentity(at).kind).toBe("explicit");
    expect(nexusScopeOrThrow(nexusIdentity(at))).toBe(explicit);
    expect(nexusIslandsBelow(at), "`nexusIslandsBelow` answers the leaf's gradient, high to low")
      .toEqual([anchor, own]);
  });

  test("a leaf whose anchor key reads as NO key names no island at all", () => {
    const at = leafStandsAt("de".repeat(32), "not-a-key");
    expect(nexusIdentity(at).kind, "PRESENCE ⊥ READABILITY — a malformed scope reads TORN").toBe("torn");
    expect(nexusIslandsBelow(at)).toEqual([]);
  });
});

// ════════════════════════════════════════════════════════════════════════════════════════════════════
// ② THE RED — the brick, measured at the leaf, and the carry that clears it
// ════════════════════════════════════════════════════════════════════════════════════════════════════
describe("★ RED — the LEAF BRICKS: the Binding Gate's own read goes blank when the island climbs", () => {
  test("RED — the pinned chain seated at the leaf's own island is ABSENT on the anchor it dials", async () => {
    const r      = repo();
    const own    = await pubOf(seedOf(111));
    const anchor = await pubOf(seedOf(211));

    // ① the leaf founds OFFLINE. `runFoundingCeremony({…, nexusPubkey})` seats the inception on the board
    //    keyed by the island resolved AT THAT MOMENT — for a founding leaf, its own key.
    const before = leafStandsAt(own);
    expect(nexusScopeOrThrow(nexusIdentity(before))).toBe(own);
    const inception = mintPersonaInception(await pubOf(seedOf(51)), "ab".repeat(32));
    const prefix    = inception.prefix;
    (await board(r, personaKelBoardDocUrl(own))).change((d) => writePersonaKelEvent(d, inception));
    expect(personaKelChainForPrefix((await board(r, personaKelBoardDocUrl(own))).doc(), prefix))
      .toHaveLength(1);

    // ② the operator configures the hearth this page dials. The island CLIMBS.
    const at     = leafStandsAt(own, anchor);
    const island = nexusScopeOrThrow(nexusIdentity(at));
    expect(island).toBe(anchor);
    expect(island).not.toBe(own);

    // THE BRICK, measured on the exact read the browser boot's gate makes — `personaKelChainForPrefix`
    // over `personaKelBoardDocUrl(nexusPubkey)`. Null here IS the throw at open-browser-vessel's gate.
    expect(personaKelChainForPrefix((await board(r, personaKelBoardDocUrl(island))).doc(), prefix),
      "the gate reads a blank board and HALTS — the vessel never boots again").toBeNull();

    // ③ the boot carries.
    const carry = await leafKelCarry(r, at, prefix);
    expect(carry.carried, "one inception event moved").toBe(1);
    expect(carry.from, "the carry names the island it read").toBe(own);

    // ④ and the gate's read stands — the same bytes, the same cid, judged by the same verifier.
    const carried = personaKelChainForPrefix((await board(r, personaKelBoardDocUrl(island))).doc(), prefix);
    expect(carried).toHaveLength(1);
    expect(carried![0]!.eventCid, "the bytes moved VERBATIM; nothing re-signed").toBe(inception.eventCid);
    expect(carried![0]!.prefix).toBe(prefix);
  }, 30_000);

  test("RED — the leaf's antigen reaches the island it dials, verbatim and unjudged", async () => {
    const r      = repo();
    const own    = await pubOf(seedOf(113));
    const anchor = await pubOf(seedOf(213));
    const victim = "ff".repeat(32);

    const entry = await signAntigenEntry(
      { nym: victim, action: "kapae", version: 1, sealEpochCid: PRE_EPOCH },
      [{ signer: await pubOf(seedOf(1)), sign: signer(seedOf(1)) }]);
    (await board(r, kapaeAntigenDocUrl(own))).change((d) => writeAntigenEntry(d, entry));

    const at     = leafStandsAt(own, anchor);
    const island = nexusScopeOrThrow(nexusIdentity(at));
    expect(antigenEntriesFromBoard((await board(r, kapaeAntigenDocUrl(island))).doc()),
      "the harm: an empty antigen bans nobody, so a Kapae'd presenter is re-admitted").toEqual([]);

    const climb = await leafClimb(r, at);
    expect(climb.acts.find((a) => a.board === "antigen")!.landed).toBe(1);
    const carried = antigenEntriesFromBoard((await board(r, kapaeAntigenDocUrl(island))).doc());
    expect(carried).toHaveLength(1);
    expect(carried[0]!.nym).toBe(victim);
  }, 30_000);

  test("the crossroads RE-ANNOUNCE stands INERT at a leaf — it holds no charter, so no realm", async () => {
    const r        = repo();
    const own      = await pubOf(seedOf(115));
    const anchor   = await pubOf(seedOf(215));
    const at       = leafStandsAt(own, anchor);
    const island   = nexusScopeOrThrow(nexusIdentity(at));

    const climb = await leafClimb(r, at);
    const act   = climb.acts.find((a) => a.board === "crossroads")!;
    expect(act.act).toBe("re-announce");
    expect(act.landed, "no realm → nothing to re-derive; a leaf registers nothing either").toBe(0);
    expect(act.from, "and it read no realm doc at all").toEqual([]);
    expect(publicRealmBooksFromDoc((await board(r, crossroadsDocUrl(island))).doc())).toEqual([]);
  }, 30_000);
});

// ════════════════════════════════════════════════════════════════════════════════════════════════════
// ③ THE CONTROLS — every refusal holds at this shore too
// ════════════════════════════════════════════════════════════════════════════════════════════════════
describe("the gradient law holds AT THE LEAF", () => {
  test("CONTROL — a TORN anchor re-keys nothing: the leaf HALTS rather than falling to its own board", async () => {
    const r    = repo();
    const own  = await pubOf(seedOf(121));
    const inception = mintPersonaInception(await pubOf(seedOf(52)), "cd".repeat(32));
    (await board(r, personaKelBoardDocUrl(own))).change((d) => writePersonaKelEvent(d, inception));
    const beforeKel     = await keysOn(r, personaKelBoardDocUrl(own));

    // An admission RECORD stands at this leaf and the anchor key it names reads as no key at all.
    const at = leafStandsAt(own, "not-a-key-at-all");
    expect(nexusIdentity(at).kind).toBe("torn");

    // THE HALT. A THROW at the scope door, SYNCHRONOUSLY — before the call is even a promise, so no
    // window exists in which a board could be addressed on a torn reading.
    expect(() => nexusScopeOrThrow(nexusIdentity(at))).toThrow(/torn/i);
    expect(() => leafClimb(r, at), "the leaf's own composition must THROW, never return quietly")
      .toThrow(/torn/i);
    expect(() => leafKelCarry(r, at, inception.prefix), "and the KEL carry halts at the same door")
      .toThrow(/torn/i);
    expect(nexusIslandsBelow(at), "a torn standing names no island, so it offers no source").toEqual([]);

    // Nothing moved, and the leaf's own boards stand exactly as they stood.
    expect(await keysOn(r, personaKelBoardDocUrl(own))).toEqual(beforeKel);
  }, 30_000);

  test("CONTROL — a leaf that never climbs writes nothing, on either carry", async () => {
    const r   = repo();
    const own = await pubOf(seedOf(122));
    const at  = leafStandsAt(own);   // no anchor dialled, no invite carried
    expect(nexusIslandsBelow(at)).toEqual([]);

    const inception = mintPersonaInception(await pubOf(seedOf(53)), "ef".repeat(32));
    const climb = await leafClimb(r, at);
    const carry = await leafKelCarry(r, at, inception.prefix);
    expect(climb.landed).toBe(0);
    for (const act of climb.acts) expect(act.from).toEqual([]);
    expect(carry).toEqual({ carried: 0, from: null });
    for (const url of [kapaeAntigenDocUrl(own), crossroadsDocUrl(own), personaKelBoardDocUrl(own)]) {
      expect(await keysOn(r, url)).toEqual([]);
    }
  }, 30_000);

  test("CONTROL — three boots, ONE effect (the board and KEL carries run every boot)", async () => {
    const r      = repo();
    const own    = await pubOf(seedOf(123));
    const anchor = await pubOf(seedOf(223));

    const entry = await signAntigenEntry(
      { nym: "ea".repeat(32), action: "kapae", version: 1, sealEpochCid: PRE_EPOCH },
      [{ signer: await pubOf(seedOf(1)), sign: signer(seedOf(1)) }]);
    const inception = mintPersonaInception(await pubOf(seedOf(54)), "12".repeat(32));
    (await board(r, kapaeAntigenDocUrl(own))).change((d) => writeAntigenEntry(d, entry));
    (await board(r, personaKelBoardDocUrl(own))).change((d) => writePersonaKelEvent(d, inception));

    const at     = leafStandsAt(own, anchor);
    const island = nexusScopeOrThrow(nexusIdentity(at));

    expect((await leafClimb(r, at)).landed, "the antigen entry carries").toBe(1);
    expect((await leafKelCarry(r, at, inception.prefix)).carried).toBe(1);
    const after = {
      antigen: await keysOn(r, kapaeAntigenDocUrl(island)),
      kel:     await keysOn(r, personaKelBoardDocUrl(island)),
    };
    for (const pass of [2, 3]) {
      expect((await leafClimb(r, at)).landed, `boot ${pass} must write nothing`).toBe(0);
      expect((await leafKelCarry(r, at, inception.prefix)).carried, `boot ${pass}: the KEL carry too`).toBe(0);
    }
    expect(await keysOn(r, kapaeAntigenDocUrl(island))).toEqual(after.antigen);
    expect(await keysOn(r, personaKelBoardDocUrl(island))).toEqual(after.kel);
  }, 45_000);

});

// ════════════════════════════════════════════════════════════════════════════════════════════════════
// ④ THE OTHER BOARDS STAY OUT OF THE LEAF CLIMB
// ════════════════════════════════════════════════════════════════════════════════════════════════════
describe("the leaf climb stays scoped to antigen and crossroads", () => {
  // ══════════════════════════════════════════════════════════════════════════════════════════════════
  // ★ THE FAULT-PIN — it bites a WEAKENING, not only an absence
  // ══════════════════════════════════════════════════════════════════════════════════════════════════
  test("★ FAULT-PIN — the LEAF BOOT calls each carry ONCE, over its OWN sources, naming no refused board", () => {
    // ⓪ ONE statement of the inputs. The node boot records why: "A second copy of this object would
    //    drift from the first the day a term is added, and the carry would then read a gradient the boot
    //    does not stand on." So the leaf must NAME its standing and hand the same object to both carries.
    expect(bootSrc, "the leaf's island inputs must stand as one named object")
      .toMatch(/const nexusStandsAt: NexusIdentityAt = \{/);
    expect(bootSrc, "and the resolution must read THAT object, never a second literal")
      .toContain("nexusIdentity(nexusStandsAt)");

    // ① exactly one call site each. Two would re-key twice, and a second could carry different arguments.
    expect((bootSrc.match(/climbNexusBoards\(\{/g) ?? []).length, "one boot, one climb").toBe(1);
    expect((bootSrc.match(/carryPersonaKelUpTheGradient\(\{/g) ?? []).length, "one boot, one KEL carry").toBe(1);

    const climbCall = /await climbNexusBoards\(\{[\s\S]*?\}\);/.exec(bootSrc)?.[0] ?? "";
    const kelCall   = /await carryPersonaKelUpTheGradient\(\{[\s\S]*?\}\);/.exec(bootSrc)?.[0] ?? "";
    expect(climbCall, "the climb call must be findable").not.toBe("");
    expect(kelCall,   "the KEL carry call must be findable").not.toBe("");

    // ② THE WEAKENING THIS PIN EXISTS TO BITE. `priorIslands: []` leaves every behavioural vector above
    //    GREEN while both carries die — each control asserts what must NOT happen, and an inert call
    //    satisfies all of them. So each call must read the boot's OWN gradient, at the right DEPTH.
    for (const [name, call] of [["climb", climbCall], ["KEL carry", kelCall]] as const) {
      expect(call, `the ${name} must read the leaf's OWN gradient, never a literal`)
        .toContain("nexusIslandsBelow(nexusStandsAt)");
      expect(call, `the ${name} must key on the island \`nexusScopeOrThrow\` resolved`)
        .toContain("nexusPubkey");
      expect(call, `the ${name} passed an EMPTY source list — the carry would be inert and every vector green`)
        .not.toMatch(/priorIslands:\s*\[\s*\]/);
    }

    // ③ THE LEAF'S OWN SHAPE. A leaf keeps no seal home, so it stands in no realm — the crossroads
    //    re-announce must be handed NOTHING, never a borrowed or invented realm id.
    expect(climbCall, "a leaf holds no charter, so it may pass no realm but null")
      .toMatch(/realmId:\s*null/);
    expect(climbCall, "and it must never reach for a charter reader it has no seal home for")
      .not.toContain("realmIdOfCharter");

    // ④ THE THREE REFUSALS. A hand passing one more board here would compile a COMPILED ABOUT-SET at a
    //    new address — `nexus-board-climb`'s header carries the reason for each.
    for (const forbidden of ["whoBoardDocUrl", "carriageDocUrl", "realmVouchBoardDocUrl"]) {
      for (const [name, call] of [["climb", climbCall], ["KEL carry", kelCall]] as const) {
        expect(call, `the leaf's ${name} reached for ${forbidden}`).not.toContain(forbidden);
      }
    }

    // ⑤ NESTING + ORDER. The board climb rides at the boot function's own depth (2 spaces) so a FACELESS
    //    leaf still carries its antigen. The KEL carry rides inside `openDaemon`, which is the only place
    //    the pinned prefix is known.
    expect(bootSrc, "a climb nested under a face guard would stop a FACELESS leaf from carrying")
      .toMatch(/\n {2}await climbNexusBoards\(\{/);
    expect(bootSrc, "the KEL carry rides where the pinned prefix is read")
      .toMatch(/\n {6}await carryPersonaKelUpTheGradient\(\{/);

    // ⑥ ORDER. Every index reads POSITIVE first — `indexOf` answers -1 for an absent call, and -1 is
    //    less than everything, so an ordering assertion over an absent call passes VACUOUSLY.
    const scopeDoor  = bootSrc.indexOf("nexusScopeOrThrow(nexusStanding)");
    const climbAt    = bootSrc.indexOf("await climbNexusBoards");
    const kelCarryAt = bootSrc.indexOf("await carryPersonaKelUpTheGradient");
    const crossroads = bootSrc.indexOf("await registerCrossroadsInOracle");
    const gateReadAt = bootSrc.indexOf("personaKelChainForPrefix(kelBoard.doc()");
    for (const [what, at] of [["the scope door", scopeDoor], ["the board climb", climbAt],
                              ["the KEL carry", kelCarryAt], ["the crossroads register", crossroads],
                              ["the Binding Gate's read", gateReadAt]] as const) {
      expect(at, `${what} stands nowhere in the leaf boot`).toBeGreaterThan(-1);
    }

    // Both carries run AFTER the scope door, so a TORN anchor halts before a board is addressed …
    expect(scopeDoor).toBeLessThan(climbAt);
    expect(scopeDoor).toBeLessThan(kelCarryAt);
    // … the board climb BEFORE the crossroads plane registers …
    expect(climbAt, "before the crossroads plane registers").toBeLessThan(crossroads);
    // … and the KEL carry BEFORE the Binding Gate reads, which is the whole cure.
    expect(kelCarryAt, "the carry must land BEFORE the gate walks the board — after it, the halt stands")
      .toBeLessThan(gateReadAt);
  });
});

describe("★ ADMIT-AWARE ISLAND — an admitted leaf resolves the FOUNDER'S island, not merely its raw gate key", () => {
  // The node closed the identical defect at its own admit door (`aa15cfb3b`, `admittedJoineeIsland` —
  // now `@lararium/mesh/nexus-identity.ts`): an admit payload carries the founder's RESOLVED
  // `hearthIslandKind`/`hearthIslandScope`, a SNAPSHOT at mint time, so a CLIMBED founder's joinee seats
  // on the board the founder actually stands on rather than always reading `kind: "anchor"` off the raw
  // `hearthGatePubKey`/`relayGatePubKey`. This leaf inherited the SAME defect (the follow-on `aa15cfb3b`
  // itself flagged, "not built"). `openBrowserVessel` needs a real IndexedDB + WebCrypto substrate and
  // cannot stand in a unit test (same limitation the fault-pin above already works around), so this reads
  // the boot's own source — the ONLY reachable witness, same method as the pin above.
  test("★ FAULT-PIN — the admit branch composes admittedJoineeIsland over the CARRIED island fields, not relayGatePubKey alone", () => {
    // RED — the admit-aware resolution must exist and must read the carried island fields, beside the
    // unchanged anti-relay binding (hearthGatePubKey stays byte-identical to before — Option A, node-side).
    expect(bootSrc, "an admit must resolve through admittedJoineeIsland, the SAME ruling the node's init.ts composes")
      .toContain("admittedJoineeIsland({");
    expect(bootSrc, "the admit branch must read the carried hearthIslandKind")
      .toContain("hearthIslandKind:  admit.hearthIslandKind");
    expect(bootSrc, "the admit branch must read the carried hearthIslandScope")
      .toContain("hearthIslandScope: admit.hearthIslandScope");
    expect(bootSrc, "the admit branch must still carry the anti-relay binding beside the island fields")
      .toContain("hearthGatePubKey:  admit.hearthGatePubKey");

    // The admit-aware resolution must land INSIDE the `if (admit)` branch, not merely exist somewhere in
    // the file unreachable from it.
    const admitBranch = /if \(admit\) \{[\s\S]*?\n {2}\} else \{/.exec(bootSrc)?.[0] ?? "";
    expect(admitBranch, "the admit branch must be findable").not.toBe("");
    expect(admitBranch, "admittedJoineeIsland must be called from WITHIN the admit branch")
      .toContain("admittedJoineeIsland({");

    // CONTROL — the founding (no-admit) branch is UNCHANGED: it still resolves via nexusIdentity over
    // nexusStandsAt (`relayGatePubKey ?? null`), and never reaches for admittedJoineeIsland.
    const elseBranch = /\} else \{[\s\S]*?\n {2}\}\n/.exec(bootSrc.slice(bootSrc.indexOf("if (admit) {")))?.[0] ?? "";
    expect(elseBranch, "the founding branch must be findable").not.toBe("");
    expect(elseBranch, "the founding branch must still resolve via nexusIdentity(nexusStandsAt)")
      .toContain("nexusIdentity(nexusStandsAt)");
    expect(elseBranch, "the founding branch must NOT reach for admittedJoineeIsland — an OLDER payload with no "
      + "island fields, or no admit at all, resolves EXACTLY as it did before this fix")
      .not.toContain("admittedJoineeIsland");

    // ORDER — the admit-aware resolution must land BEFORE climbNexusBoards AND runApplyAdmitPayload, since
    // both consume the ONE nexusPubkey (the file's own "ONE statement of the inputs" law, restated for the
    // admit-aware branch: a second, later-computed nexusPubkey would let the climb and the apply disagree).
    const resolvedAt    = bootSrc.indexOf("if (admit) {");
    const climbAt2      = bootSrc.indexOf("await climbNexusBoards");
    const applyAdmitAt  = bootSrc.indexOf("await runApplyAdmitPayload");
    expect(resolvedAt, "the admit-aware resolution must stand in the boot").toBeGreaterThan(-1);
    expect(resolvedAt, "before the climb consumes nexusPubkey").toBeLessThan(climbAt2);
    expect(resolvedAt, "before runApplyAdmitPayload consumes nexusPubkey").toBeLessThan(applyAdmitAt);
  });
});
