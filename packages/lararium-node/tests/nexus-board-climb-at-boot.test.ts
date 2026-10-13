/**
 * nexus-board-climb-at-boot — the climb the NODE BOOT actually stands, and the refusals that survive wiring it.
 *
 * `nexus-board-climb` (mesh) proves each act over a hand-written gradient. These vectors ride the gradient the
 * BOOT composes — `open-node-vessel`'s own `nexusStandsAt`, whose terms come off a charter ON DISK — and pin
 * the wiring itself, because that is the only joint the module's own tests cannot reach.
 *
 * ── THE BOOT'S REACHABLE CLIMB, measured rather than assumed ────────────────────────────────────────
 * `nexus-board-climb`'s header names the crossroads' reachable case as "an explicit scope named above a
 * standing charter". The NODE boot never supplies `explicitScope` — only `open-browser-vessel` does, off an
 * invite. So the climb this boot stands is the founding walk the persona-KEL fault was measured on:
 *
 *     own (a private nexus of one) → charter (the genesis epoch of a seated charter)
 *
 * and that walk carries the antigen and re-announces crossroads books onto the resolved island.
 *
 * ── THE HALT IS THE OTHER HALF ─────────────────────────────────────────────────────────────────────
 * A charter that STANDS on disk and reads TORN must not re-key anything, and must not skip quietly either:
 * `nexusScopeOrThrow` throws at the scope door, before any board is addressed. These vectors assert the
 * THROW, not an empty result — a boot that swallowed it would descend a serving vessel to a private board.
 *
 * ── AND THE FAULT-PIN READS THE BOOT'S SOURCE ──────────────────────────────────────────────────────
 * Every behavioural vector below is green against the module alone, so none of them can witness the WIRING.
 * `openNodeVessel` founds a hearth and cannot stand in a unit test (`node-who-face-parity` records the same
 * constraint). The wiring's red therefore reads the boot file: one call, at the boot's own nesting depth,
 * over the boot's own gradient, naming none of the three refused boards. It bites a WEAKENING — a fourth
 * board passed in, a `priorIslands: []` that would leave every vector here green while the carry died, or a
 * climb nested under the persona-KEL guard so a faceless vessel stopped carrying its antigen.
 *
 * Meme: lar:///ha.ka.ba/lararium/mesh/nexus-identity
 */
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, test, expect } from "vitest";
import { Repo, type AutomergeUrl } from "@automerge/automerge-repo";
import * as ed from "@noble/ed25519";
import {
  climbNexusBoards,
  nexusIdentity, nexusIslandsBelow, nexusScopeOrThrow, type NexusIdentityAt,
  realmIdOfCharter, realmDocUrl,
  materializeSharedLarDoc,
  kapaeAntigenDocUrl, crossroadsDocUrl,
  writeAntigenEntry, antigenEntriesFromBoard, signAntigenEntry,
  signRealmBagRegistration, writeRealmBagRegistration, publicRealmBooksFromDoc,
  NEXUS_DOC_DOMAIN, genesisCharterEpoch,
  hex,
} from "@lararium/mesh";
import { readNexusDoc, nexusCharterStands, writeNexusDoc, nexusCharterDocPath } from "../src/nexus-doc.js";

const seedOf = (n: number): Uint8Array => new Uint8Array(32).fill(n);
const signer = (s: Uint8Array) => (b: Uint8Array) => ed.signAsync(b, s).then(hex);
const pubOf  = (s: Uint8Array) => ed.getPublicKeyAsync(s).then(hex);
const repo = (): Repo => new Repo({ sharePolicy: async () => true });
const board = (r: Repo, url: AutomergeUrl) => materializeSharedLarDoc(r, url, "test:board");
async function keysOn(r: Repo, url: AutomergeUrl): Promise<string[]> {
  return Object.keys((await board(r, url)).doc()?.tiddlers ?? {}).sort();
}

/** The steward key `seatCharter` seats: a REAL key from a fixed seed, since a charter seats only a key the
 *  Ed25519 door reads lawful (no signature ever checks against it; its presence in `kahu` + the genesis
 *  lineage below matters to `foundingRoster`). */
const CHARTER_KEY = Buffer.from(await ed.getPublicKeyAsync(new Uint8Array(32).fill(0x7a))).toString("hex");
/** A real genesis seal lineage over that steward — there is no legacy bare-`sealEpochCid` path any
 *  more, so a "the charter STANDS" fixture must carry a verifiable one-epoch lineage. */
const CHARTER_GENESIS = genesisCharterEpoch([CHARTER_KEY], 1, "");
const CHARTER   = CHARTER_GENESIS.epochCid;
/** The epoch a vessel's acts rooted on while it stood alone — the reader ranks it BELOW the charter's. */
const PRE_EPOCH = `epoch0-${"11".repeat(32)}`;

/** A fresh seal home — never `~/.local/share/lares`. A charter stands here or it does not. */
function sealHomeAt(): string {
  const home = mkdtempSync(join(tmpdir(), "climb-boot-"));
  mkdirSync(home, { recursive: true });
  return home;
}

/** Seat a readable charter whose genesis epoch names the island — what `nexus rite quorum` leaves on disk. */
async function seatCharter(sealHome: string): Promise<void> {
  writeNexusDoc(sealHome, {
    kind: NEXUS_DOC_DOMAIN, threshold: 1, sealEpochCid: CHARTER, sealLineage: [CHARTER_GENESIS],
    kahu: [{ displayName: "steward", verifyingKey: CHARTER_KEY }],
  });
}

/**
 * THE BOOT'S OWN COMPOSITION — `open-node-vessel.ts`'s `nexusStandsAt`, verbatim in shape.
 *
 * The terms come off the seal home the same way the boot reads them, so a vector here stands on the gradient
 * the boot stands on rather than a hand-written one.
 */
function bootStandsAt(sealHome: string, ownKey: string, anchorGateKey: string | null = null): NexusIdentityAt {
  return {
    genesisEpochCid: realmIdOfCharter(readNexusDoc(sealHome)),
    charterStands:   nexusCharterStands(sealHome),
    anchorGateKey,
    ownVesselKey:    ownKey,
  };
}

/** The boot's climb call, composed exactly as the wiring composes it. */
function bootClimb(r: Repo, at: NexusIdentityAt) {
  return climbNexusBoards({
    repo:         r,
    nexusPubkey:  nexusScopeOrThrow(nexusIdentity(at)),
    priorIslands: nexusIslandsBelow(at),
    realmId:      at.genesisEpochCid ?? null,
  });
}

// ════════════════════════════════════════════════════════════════════════════════════════════════════
// THE RED — a boot whose island climbs carries onto the island the boot RESOLVED
// ════════════════════════════════════════════════════════════════════════════════════════════════════
describe("the boot's own climb — own → charter, the founding walk", () => {
  test("RED — the antigen's bytes reach the resolved island too, verbatim and unjudged", async () => {
    const r      = repo();
    const ownKey = await pubOf(seedOf(12));
    const home   = sealHomeAt();
    const victim = "ff".repeat(32);

    const entry = await signAntigenEntry(
      { nym: victim, action: "kapae", parents: [], sealEpochCid: PRE_EPOCH },
      [{ signer: await pubOf(seedOf(1)), sign: signer(seedOf(1)) }]);
    (await board(r, kapaeAntigenDocUrl(ownKey))).change((d) => writeAntigenEntry(d, entry));

    await seatCharter(home);
    const at     = bootStandsAt(home, ownKey);
    const island = nexusScopeOrThrow(nexusIdentity(at));
    expect(antigenEntriesFromBoard((await board(r, kapaeAntigenDocUrl(island))).doc()),
      "the harm: an empty antigen bans nobody, so a Kapae'd presenter is re-admitted").toEqual([]);

    const climb = await bootClimb(r, at);
    const act   = climb.acts.find((a) => a.board === "antigen")!;
    expect(act.landed).toBe(1);
    const carried = antigenEntriesFromBoard((await board(r, kapaeAntigenDocUrl(island))).doc());
    expect(carried).toHaveLength(1);
    expect(carried[0]!.nym).toBe(victim);
    // The bytes moved; the destination's own fold decides. The epoch law's self-limiting is proven in
    // `nexus-board-climb.test` and is deliberately not re-derived here.
  }, 30_000);

  test("RED — the crossroads RE-ANNOUNCES the realm's books onto the resolved island", async () => {
    const r      = repo();
    const ownKey = await pubOf(seedOf(13));
    const home   = sealHomeAt();
    const bag    = "lar:///ha.ka.ba/books/the-offering";

    await seatCharter(home);
    const at     = bootStandsAt(home, ownKey);
    expect(at.genesisEpochCid, "the realm id the boot passes IS the charter's genesis epoch").toBe(CHARTER);
    const island = nexusScopeOrThrow(nexusIdentity(at));

    const rec = await signRealmBagRegistration(
      { realmId: CHARTER, bagUri: bag, docUrl: "automerge:2j9knpCseyhnK8izDmiCN3RDzC7x", readTier: "public" },
      [{ signer: await pubOf(seedOf(31)), sign: signer(seedOf(31)) }]);
    (await board(r, realmDocUrl(CHARTER))).change((d) => writeRealmBagRegistration(d, rec));

    expect(publicRealmBooksFromDoc((await board(r, crossroadsDocUrl(island))).doc())).toEqual([]);
    const climb = await bootClimb(r, at);
    const act   = climb.acts.find((a) => a.board === "crossroads")!;
    expect(act.act, "a projection is RE-ANNOUNCED — a copy would launder an unsigned row").toBe("re-announce");
    expect(act.landed).toBe(1);
    expect(publicRealmBooksFromDoc((await board(r, crossroadsDocUrl(island))).doc()).map((b) => b.bagUri))
      .toEqual([bag]);
  }, 30_000);
});

// ════════════════════════════════════════════════════════════════════════════════════════════════════
// THE CONTROLS
// ════════════════════════════════════════════════════════════════════════════════════════════════════
describe("the gradient law holds AT THE BOOT", () => {
  test("CONTROL — a charter that STANDS and reads TORN re-keys nothing: the boot HALTS, loudly", async () => {
    const r      = repo();
    const ownKey = await pubOf(seedOf(14));
    const home   = sealHomeAt();

    // A charter RECORD stands on disk and reads torn — a half-written seat.
    writeFileSync(nexusCharterDocPath(home), "half a charter and no fence at all\n", "utf8");
    const at = bootStandsAt(home, ownKey);
    expect(nexusCharterStands(home), "PRESENCE ⊥ READABILITY — the record stands").toBe(true);
    expect(readNexusDoc(home), "and it reads as nothing at all").toBeNull();
    expect(at.genesisEpochCid).toBeNull();
    expect(nexusIdentity(at).kind).toBe("torn");

    // THE HALT. Not an empty result, not a skipped act — a THROW at the scope door, before any board is
    // addressed. A boot that absorbed this would announce into a private room and call it the crossroads.
    expect(() => nexusScopeOrThrow(nexusIdentity(at))).toThrow(/torn/i);
    // SYNCHRONOUSLY, before the call even becomes a promise — the scope door stands ahead of every board
    // read, so there is no window in which a board could be addressed on a torn fence.
    expect(() => bootClimb(r, at), "the boot's own composition must THROW, never return quietly")
      .toThrow(/torn/i);
    expect(nexusIslandsBelow(at), "a torn standing names no island, so it offers no source").toEqual([]);

  }, 30_000);

  test("CONTROL — a vessel that never climbs calls the climb with EMPTY sources and writes nothing", async () => {
    const r      = repo();
    const ownKey = await pubOf(seedOf(15));
    const home   = sealHomeAt();   // no charter seated, no anchor dialled

    const at = bootStandsAt(home, ownKey);
    expect(at.charterStands).toBe(false);
    expect(nexusScopeOrThrow(nexusIdentity(at))).toBe(ownKey);
    expect(nexusIslandsBelow(at), "the bottom of the gradient offers no source").toEqual([]);

    const climb = await bootClimb(r, at);
    expect(climb.landed).toBe(0);
    for (const act of climb.acts) expect(act.from).toEqual([]);
    for (const url of [kapaeAntigenDocUrl(ownKey), crossroadsDocUrl(ownKey)]) {
      expect(await keysOn(r, url)).toEqual([]);
    }
  }, 30_000);

  test("CONTROL — three boots, ONE effect (the climb runs every boot)", async () => {
    const r      = repo();
    const ownKey = await pubOf(seedOf(16));
    const home   = sealHomeAt();

    const entry = await signAntigenEntry(
      { nym: "ea".repeat(32), action: "kapae", parents: [], sealEpochCid: PRE_EPOCH },
      [{ signer: await pubOf(seedOf(1)), sign: signer(seedOf(1)) }]);
    (await board(r, kapaeAntigenDocUrl(ownKey))).change((d) => writeAntigenEntry(d, entry));

    await seatCharter(home);
    const at     = bootStandsAt(home, ownKey);
    const island = nexusScopeOrThrow(nexusIdentity(at));

    const first = await bootClimb(r, at);
    expect(first.landed, "the antigen entry carries").toBe(1);
    const after = await keysOn(r, kapaeAntigenDocUrl(island));
    for (const pass of [2, 3]) {
      const again = await bootClimb(r, at);
      expect(again.landed, `boot ${pass} must write nothing`).toBe(0);
    }
    expect(await keysOn(r, kapaeAntigenDocUrl(island))).toEqual(after);
  }, 45_000);

});

// ════════════════════════════════════════════════════════════════════════════════════════════════════
// ★ THE OTHER BOARDS STAY OUT OF THE CLIMB
// ════════════════════════════════════════════════════════════════════════════════════════════════════
describe("the boot climb stays scoped to antigen and crossroads", () => {
  test("FAULT-PIN — the BOOT calls the climb ONCE, over its own gradient, naming no refused board", () => {
    const src = readFileSync(join(import.meta.dirname, "..", "src", "open-node-vessel.ts"), "utf8");

    // ① exactly one call site. Two would re-key twice, and a second could carry different arguments.
    const calls = src.match(/climbNexusBoards\(\{/g) ?? [];
    expect(calls.length, "one boot, one climb").toBe(1);

    // ② the call's own arguments. `priorIslands: []` would leave every behavioural vector above GREEN while
    //    the carry silently died — this is the weakening the pin exists to bite.
    const call = /await climbNexusBoards\(\{[\s\S]*?\}\);/.exec(src)?.[0] ?? "";
    expect(call, "the climb must read the boot's OWN gradient, never a literal")
      .toContain("nexusIslandsBelow(nexusStandsAt)");
    expect(call, "the island is the one `nexusScopeOrThrow` resolved").toContain("nexusPubkey");
    expect(call, "the crossroads re-announce needs the realm the charter names")
      .toMatch(/realmId:\s*realmIdOfCharter\(readNexusDoc\(sealHome\)\)/);

    // ③ THE THREE REFUSALS, at the boot. A hand passing one more board here would be compiling a
    //    COMPILED ABOUT-SET at a new address — read `nexus-board-climb`'s header before adding one.
    for (const forbidden of ["whoBoardDocUrl", "carriageDocUrl", "realmVouchBoardDocUrl"]) {
      expect(call, `the boot's climb reached for ${forbidden}`).not.toContain(forbidden);
    }

    // ④ NESTING. The climb sits at the boot's own depth (4 spaces), not inside the `if (personaKelPrefix)`
    //    guard (6) — a faceless vessel holds an antigen too, and must still carry it.
    expect(src, "a climb nested under the persona-KEL guard would stop a FACELESS vessel from carrying")
      .toMatch(/\n {4}await climbNexusBoards\(\{/);

    // ⑤ and the climb runs AFTER the scope door, so a torn charter halts before a board is addressed.
    expect(src.indexOf("nexusScopeOrThrow(nexusStanding)"))
      .toBeLessThan(src.indexOf("await climbNexusBoards"));
    expect(src.indexOf("await climbNexusBoards"), "before the crossroads plane registers")
      .toBeLessThan(src.indexOf("await registerCrossroadsInOracle"));
  });
});
