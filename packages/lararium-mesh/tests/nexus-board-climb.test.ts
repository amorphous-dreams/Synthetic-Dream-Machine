/**
 * nexus-board-climb — the boards a climb moves, and the three it must NOT move.
 *
 * ── THE FAULT `nexusScopeMoved` NAMES AND CALLS UNBUILT ─────────────────────────────────────────────
 * "A vessel that climbs from a private nexus of one to a seated charter re-keys every per-Nexus board it
 * stands on… Nothing carries across on its own: the old board keeps every announce it ever held and the new
 * one mints blank." `carryPersonaKelUpTheGradient` cured the ONE board that refuses rather than degrades.
 * These vectors take the remaining step, and correct the design's own reading of what "degrades gracefully"
 * means: the shadow board and the antigen both fail OPEN when they mint blank.
 *
 * Every RED here rides ONE board. Two writers, two reds — a single red over three boards would go green on
 * the first one built and hide the other two.
 *
 * ── AND THE REFUSALS ARE PINNED, not merely documented ──────────────────────────────────────────────
 * WHO, carriage and vouch are left un-migrated on purpose. Each refusal carries a behavioural pin (content
 * on an island below does NOT arrive) AND a source pin (the module names none of those three board
 * addresses), so a later hand cannot quietly add one and stay green. A red alone may not hold a derivation.
 *
 * Meme: lar:///ha.ka.ba/lararium/mesh/nexus-identity
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test, expect } from "vitest";
import { Repo, type AutomergeUrl } from "@automerge/automerge-repo";
import * as ed from "@noble/ed25519";
import {
  climbNexusBoards, carryAntigenUpTheGradient, carryEdgeShadowsUpTheGradient,
  reAnnounceRealmBooksAtIsland,
  nexusIdentity, nexusIslandsBelow, nexusScopeOrThrow,
  materializeSharedLarDoc, kapaeAntigenDocUrl, edgeKapaeBoardDocUrl, crossroadsDocUrl,
  whoBoardDocUrl, carriageDocUrl, vouchBoardDocUrl,
  writeAntigenEntry, antigenEntriesFromBoard, signAntigenEntry, foldAntigenSet,
  makeMultiSigQuorumVerifier, type KahuRoster,
  writeEdgeKapae, signEdgeKapae, shadowSetFromBoard, type EpochOrder,
  signRealmBagRegistration, writeRealmBagRegistration, realmDocUrl, realmBagAnnounceKey,
  publicRealmBooksFromDoc, crossroadsAnnounceOf,
  HANDLE_ANNOUNCE_PREFIX, CARRIAGE_ENTRY_PREFIX, VOUCH_ENTRY_PREFIX,
  mutableLarRecord,
} from "../src/index.js";
import { hex, hexToBytes } from "../src/crypto.js";

// ── THE GRADIENT, three rungs ───────────────────────────────────────────────────────────────────────
const OWN      = "ab".repeat(32);
const CHARTER  = `epoch0-${"7a".repeat(32)}`;
const EXPLICIT = "ee".repeat(32);
/** An epoch this vessel rooted acts on BEFORE it held the charter — the roster below never names it. */
const OLD_EPOCH = `epoch0-${"11".repeat(32)}`;

/** own → charter: the founding walk. ONE island below. */
const AT_CHARTER = { genesisEpochCid: CHARTER, charterStands: true, ownVesselKey: OWN };
/** charter → explicit: the reachable climb that keeps the CHARTER standing. TWO islands below. */
const AT_EXPLICIT = { explicitScope: EXPLICIT, genesisEpochCid: CHARTER, charterStands: true, ownVesselKey: OWN };

const seedOf  = (n: number): Uint8Array => new Uint8Array(32).fill(n);
const signer  = (s: Uint8Array) => (b: Uint8Array) => ed.signAsync(b, s).then(hex);
const pubOf   = (s: Uint8Array) => ed.getPublicKeyAsync(s).then(hex);
const verify  = (b: Uint8Array, sig: string, did: string) =>
  ed.verifyAsync(hexToBytes(sig), b, hexToBytes(did)).catch(() => false);

const repo = (): Repo => new Repo({ sharePolicy: async () => true });

/** Open one board for one island — the exact read a boot performs. */
const board = (r: Repo, url: AutomergeUrl) => materializeSharedLarDoc(r, url, "test:board");

/** Every tiddler key a board carries — the coarse "did anything move" read. */
async function keysOn(r: Repo, url: AutomergeUrl): Promise<string[]> {
  return Object.keys((await board(r, url)).doc()?.tiddlers ?? {}).sort();
}

// ════════════════════════════════════════════════════════════════════════════════════════════════════
// ① THE ANTIGEN — a deny may be shared, and losing it FAILS OPEN
// ════════════════════════════════════════════════════════════════════════════════════════════════════
const KAHU = [seedOf(1), seedOf(2), seedOf(3)];

async function roster(epoch: string): Promise<KahuRoster> {
  return { keys: await Promise.all(KAHU.map(pubOf)), threshold: 2, sealEpochCid: epoch };
}

async function ban(nym: string, epoch: string, version = 1) {
  const signers = await Promise.all(KAHU.slice(0, 2).map(async (s) => ({ signer: await pubOf(s), sign: signer(s) })));
  return signAntigenEntry({ nym, action: "kapae", version, sealEpochCid: epoch }, signers);
}

describe("① the antigen carries — the immune memory a climb would drop", () => {
  test("RED — a quorum-signed ban on the island below reaches the island the boot resolved", async () => {
    const r = repo();
    const victim = "ff".repeat(32);
    const entry  = await ban(victim, CHARTER);

    // The ban stands on the CHARTER board — the island below the explicit one.
    const below = await board(r, kapaeAntigenDocUrl(CHARTER));
    below.change((d) => writeAntigenEntry(d, entry));

    // The island CLIMBS to an explicit scope, and the new antigen board mints BLANK.
    const island = nexusScopeOrThrow(nexusIdentity(AT_EXPLICIT));
    expect(island).toBe(EXPLICIT);
    expect(antigenEntriesFromBoard((await board(r, kapaeAntigenDocUrl(island))).doc()))
      .toEqual([]);   // ← the harm, measured: an empty antigen bans nobody

    const act = await carryAntigenUpTheGradient({
      repo: r, nexusPubkey: island, priorIslands: nexusIslandsBelow(AT_EXPLICIT),
    });
    expect(act.landed, "the ban must reach the board this island actually reads").toBe(1);
    expect(act.from).toContain(CHARTER);

    const carried = antigenEntriesFromBoard((await board(r, kapaeAntigenDocUrl(island))).doc());
    expect(carried).toHaveLength(1);
    expect(carried[0]!.nym).toBe(victim);
  }, 30_000);

  test("RED — the carried ban still BANS at the new island: the verdict travels with the bytes", async () => {
    const r = repo();
    const victim = "fd".repeat(32);
    const entry  = await ban(victim, CHARTER);
    (await board(r, kapaeAntigenDocUrl(CHARTER))).change((d) => writeAntigenEntry(d, entry));

    const island = nexusScopeOrThrow(nexusIdentity(AT_EXPLICIT));
    await carryAntigenUpTheGradient({ repo: r, nexusPubkey: island, priorIslands: nexusIslandsBelow(AT_EXPLICIT) });

    // THE CHARTER STANDS ACROSS THIS CLIMB, so the roster epoch is unchanged and the quorum still counts.
    const set = await foldAntigenSet(
      antigenEntriesFromBoard((await board(r, kapaeAntigenDocUrl(island))).doc()),
      await roster(CHARTER), makeMultiSigQuorumVerifier(),
    );
    expect(set.has(victim), "the carry moved bytes; the destination's own fold judged them").toBe(true);
  }, 30_000);

  test("CONTROL — the EPOCH LAW makes the carry self-limiting: an entry rooted elsewhere grants nothing", async () => {
    const r = repo();
    const victim = "fc".repeat(32);
    // An act this vessel rooted on an epoch its NEW charter's roster does not name.
    const entry = await ban(victim, OLD_EPOCH);
    (await board(r, kapaeAntigenDocUrl(OWN))).change((d) => writeAntigenEntry(d, entry));

    const island = nexusScopeOrThrow(nexusIdentity(AT_CHARTER));
    const act = await carryAntigenUpTheGradient({
      repo: r, nexusPubkey: island, priorIslands: nexusIslandsBelow(AT_CHARTER),
    });
    expect(act.landed, "the bytes move — a carry never adjudicates").toBe(1);

    const set = await foldAntigenSet(
      antigenEntriesFromBoard((await board(r, kapaeAntigenDocUrl(island))).doc()),
      await roster(CHARTER), makeMultiSigQuorumVerifier(),
    );
    expect(set.has(victim), "and the FOLD refuses it — roots on an unknown epoch → deny").toBe(false);
  }, 30_000);
});

// ════════════════════════════════════════════════════════════════════════════════════════════════════
// ② THE EDGE-KĀPAE — the board the design counted as graceful, and which RE-ADMITS when it mints blank
// ════════════════════════════════════════════════════════════════════════════════════════════════════
const EDGE_AUTH = seedOf(21);
/** The chain the reader walks — both the charter epoch and the old one rank, so a fold can order them. */
const ORDER: EpochOrder = (e) => (e === OLD_EPOCH ? 0 : e === CHARTER ? 1 : null);

describe("② the shadows carry — an empty shadow board lowers every shadow", () => {
  test("RED — a raised shadow on the island below STANDS at the island the boot resolved", async () => {
    const r = repo();
    const authority = await pubOf(EDGE_AUTH);
    const act = await signEdgeKapae(
      { edgeId: "edge-set-aside", raised: true, version: 1, epochCid: CHARTER }, signer(EDGE_AUTH));
    (await board(r, edgeKapaeBoardDocUrl(CHARTER))).change((d) => writeEdgeKapae(d, act));

    const island = nexusScopeOrThrow(nexusIdentity(AT_EXPLICIT));
    // THE HARM, measured: the new board mints blank, so the relationship reads RE-ADMITTABLE.
    expect(await shadowSetFromBoard(
      (await board(r, edgeKapaeBoardDocUrl(island))).doc(), () => authority, verify, ORDER))
      .toEqual(new Set());

    const moved = await carryEdgeShadowsUpTheGradient({
      repo: r, nexusPubkey: island, priorIslands: nexusIslandsBelow(AT_EXPLICIT),
    });
    expect(moved.landed).toBe(1);

    const shadows = await shadowSetFromBoard(
      (await board(r, edgeKapaeBoardDocUrl(island))).doc(), () => authority, verify, ORDER);
    expect(shadows.has("edge-set-aside"), "a hand set this relationship aside — the marker must hold").toBe(true);
  }, 30_000);

  test("FAULT-PIN — an accretive set UNIONS every island below; it never takes the first match", async () => {
    const r = repo();
    const authority = await pubOf(EDGE_AUTH);
    // Two islands below the explicit one, each holding a shadow the other never saw.
    const onCharter = await signEdgeKapae(
      { edgeId: "edge-from-charter", raised: true, version: 1, epochCid: CHARTER }, signer(EDGE_AUTH));
    const onOwn = await signEdgeKapae(
      { edgeId: "edge-from-own", raised: true, version: 1, epochCid: OLD_EPOCH }, signer(EDGE_AUTH));
    (await board(r, edgeKapaeBoardDocUrl(CHARTER))).change((d) => writeEdgeKapae(d, onCharter));
    (await board(r, edgeKapaeBoardDocUrl(OWN))).change((d) => writeEdgeKapae(d, onOwn));

    const below = nexusIslandsBelow(AT_EXPLICIT);
    expect(below, "the resolver states the ranking; this vector rides it rather than re-stating it")
      .toEqual([CHARTER, OWN]);

    const moved = await carryEdgeShadowsUpTheGradient({ repo: r, nexusPubkey: EXPLICIT, priorIslands: below });
    // A first-match-wins carry (the CHAIN's shape) lands ONE here and passes the RED above. This is the pin.
    expect(moved.landed, "a chain takes the first island; a monotone SET unions all of them").toBe(2);
    expect(moved.from).toEqual([CHARTER, OWN]);

    const shadows = await shadowSetFromBoard(
      (await board(r, edgeKapaeBoardDocUrl(EXPLICIT))).doc(), () => authority, verify, ORDER);
    expect(shadows).toEqual(new Set(["edge-from-charter", "edge-from-own"]));
  }, 30_000);

  test("CONTROL — a carried LOWER cannot beat a shadow raised on a chain the reader walks", async () => {
    const r = repo();
    const authority = await pubOf(EDGE_AUTH);
    // The island below carries a LOWER rooted on an epoch the reader cannot rank.
    const lower = await signEdgeKapae(
      { edgeId: "edge-contested", raised: false, version: 9, epochCid: "epoch0-unknown" }, signer(EDGE_AUTH));
    (await board(r, edgeKapaeBoardDocUrl(OWN))).change((d) => writeEdgeKapae(d, lower));
    // The destination already stands a RAISE on the chain the reader does walk.
    const raise = await signEdgeKapae(
      { edgeId: "edge-contested", raised: true, version: 1, epochCid: CHARTER }, signer(EDGE_AUTH));
    (await board(r, edgeKapaeBoardDocUrl(EXPLICIT))).change((d) => writeEdgeKapae(d, raise));

    await carryEdgeShadowsUpTheGradient({
      repo: r, nexusPubkey: EXPLICIT, priorIslands: nexusIslandsBelow(AT_EXPLICIT),
    });
    const shadows = await shadowSetFromBoard(
      (await board(r, edgeKapaeBoardDocUrl(EXPLICIT))).doc(), () => authority, verify, ORDER);
    expect(shadows.has("edge-contested"), "an unknown epoch ranks below every known one — fail-closed").toBe(true);
  }, 30_000);
});

// ════════════════════════════════════════════════════════════════════════════════════════════════════
// ③ THE CROSSROADS — a PROJECTION, so it RE-ANNOUNCES and must never be copied
// ════════════════════════════════════════════════════════════════════════════════════════════════════
const STEWARD = seedOf(31);
const BOOK_DOC = "automerge:2j9knpCseyhnK8izDmiCN3RDzC7x";

async function publicBook(realmId: string, bagUri: string) {
  const nym = await pubOf(STEWARD);
  return signRealmBagRegistration(
    { realmId, bagUri, docUrl: BOOK_DOC, readTier: "public" },
    [{ signer: nym, sign: signer(STEWARD) }],
  );
}

describe("③ the crossroads RE-ANNOUNCES — the announce carries no signature to re-check", () => {
  test("RED — a PUBLIC book the realm keeps reaches the crossroads board of the island the boot resolved", async () => {
    const r = repo();
    const bag = "lar:///ha.ka.ba/books/the-offering";
    const rec = await publicBook(CHARTER, bag);
    // The realm doc keeps the n-of-n-signed registration. Its id IS the charter's genesis epoch.
    (await board(r, realmDocUrl(CHARTER))).change((d) => writeRealmBagRegistration(d, rec));

    const island = nexusScopeOrThrow(nexusIdentity(AT_EXPLICIT));
    // THE HARM, measured: the crossroads board the island reads announces nothing, so the book is invisible.
    expect(publicRealmBooksFromDoc((await board(r, crossroadsDocUrl(island))).doc())).toEqual([]);

    const act = await reAnnounceRealmBooksAtIsland({ repo: r, nexusPubkey: island, realmId: CHARTER });
    expect(act.act, "a projection is RE-ANNOUNCED, never carried").toBe("re-announce");
    expect(act.landed).toBe(1);

    const books = publicRealmBooksFromDoc((await board(r, crossroadsDocUrl(island))).doc());
    expect(books).toEqual([{ bagUri: bag, docUrl: BOOK_DOC }]);
  }, 30_000);

  test("FAULT-PIN — the re-announce RE-DERIVES: a stale row on the board below never travels", async () => {
    const r = repo();
    const ghost = "lar:///ha.ka.ba/books/never-registered";
    // A row that once stood on the LOWER island's crossroads and names a book no registration counts.
    const key = realmBagAnnounceKey(ghost);
    const stale = JSON.stringify(crossroadsAnnounceOf(await publicBook(CHARTER, ghost)));
    (await board(r, crossroadsDocUrl(CHARTER))).change((d) => {
      d.tiddlers[key] = mutableLarRecord(key, { text: stale }, "test:stale");
    });
    // And a live registration for a DIFFERENT realm on the realm doc — the realm filter must drop it too.
    const foreign = await publicBook("epoch0-someotherrealm", "lar:///ha.ka.ba/books/another-realm");
    (await board(r, realmDocUrl(CHARTER))).change((d) => writeRealmBagRegistration(d, foreign));

    await reAnnounceRealmBooksAtIsland({ repo: r, nexusPubkey: EXPLICIT, realmId: CHARTER });

    const books = publicRealmBooksFromDoc((await board(r, crossroadsDocUrl(EXPLICIT))).doc());
    expect(books, "a copy would launder the stale row and the foreign realm's book; a re-derivation cannot")
      .toEqual([]);
    // And the island below keeps its own row — a migration never edits what it read.
    expect(await keysOn(r, crossroadsDocUrl(CHARTER))).toContain(key);
  }, 30_000);

  test("CONTROL — a vessel in NO realm announces nothing (it registers nothing either)", async () => {
    const r = repo();
    const act = await reAnnounceRealmBooksAtIsland({ repo: r, nexusPubkey: OWN, realmId: null });
    expect(act).toEqual({ board: "crossroads", act: "re-announce", landed: 0, from: [] });
    expect(await keysOn(r, crossroadsDocUrl(OWN))).toEqual([]);
  }, 30_000);
});

// ════════════════════════════════════════════════════════════════════════════════════════════════════
// ④ THE THREE REFUSALS — pinned behaviourally AND at the source
// ════════════════════════════════════════════════════════════════════════════════════════════════════
describe("④ WHO · carriage · vouch stay where they are", () => {
  test("CONTROL — a climb moves NOTHING onto the WHO, carriage or vouch boards of the new island", async () => {
    const r = repo();
    // Content stands on all three boards of the island below, each under its own live prefix.
    const seeded: Array<[AutomergeUrl, string]> = [
      [whoBoardDocUrl(CHARTER),      `${HANDLE_ANNOUNCE_PREFIX}${await pubOf(seedOf(41))}`],
      [carriageDocUrl(CHARTER),      `${CARRIAGE_ENTRY_PREFIX}${await pubOf(seedOf(42))}/admit/1`],
      [vouchBoardDocUrl(CHARTER),    `${VOUCH_ENTRY_PREFIX}${CHARTER}/voucher/joiner`],
    ];
    for (const [url, key] of seeded) {
      (await board(r, url)).change((d) => { d.tiddlers[key] = mutableLarRecord(key, { text: "{}" }, "test"); });
    }

    await climbNexusBoards({
      repo: r, nexusPubkey: EXPLICIT, priorIslands: nexusIslandsBelow(AT_EXPLICIT), realmId: CHARTER,
    });

    expect(await keysOn(r, whoBoardDocUrl(EXPLICIT)),
      "a card announced at a private nexus of one must not be DISCLOSED to a shared island by a boot").toEqual([]);
    expect(await keysOn(r, carriageDocUrl(EXPLICIT)),
      "an allow wants a fresh consent — the operator re-contracts by an act").toEqual([]);
    expect(await keysOn(r, vouchBoardDocUrl(EXPLICIT)),
      "the vouch board is unfederated; a carried partial replica would read as the whole lineage").toEqual([]);
    // And every island below keeps what it held — a refusal is not a deletion.
    for (const [url, key] of seeded) expect(await keysOn(r, url)).toEqual([key]);
  }, 30_000);

  test("FAULT-PIN — the climb module names none of the three refused board addresses", () => {
    const src = readFileSync(join(import.meta.dirname, "..", "src", "nexus-board-climb.ts"), "utf8");
    // The header may DISCUSS them; the code may not ADDRESS them. Split the file at the header's close.
    const code = src.slice(src.indexOf("*/") + 2);
    for (const forbidden of ["whoBoardDocUrl", "carriageDocUrl", "vouchBoardDocUrl"]) {
      expect(code, `the climb reached for ${forbidden} — read the header before adding it`)
        .not.toContain(forbidden);
    }
    expect(src, "the refusals must stay REASONED in the header, not merely absent")
      .toMatch(/DELIBERATELY NEITHER/);
  });
});

// ════════════════════════════════════════════════════════════════════════════════════════════════════
// ⑤ THE GRADIENT LAW AND IDEMPOTENCE — every boot runs this
// ════════════════════════════════════════════════════════════════════════════════════════════════════
describe("⑤ the climb runs every boot, and ratchets on INTENT alone", () => {
  test("CONTROL — a vessel that never climbs is UNTOUCHED", async () => {
    const r = repo();
    const at = { ownVesselKey: OWN };
    const island = nexusScopeOrThrow(nexusIdentity(at));
    expect(island).toBe(OWN);
    expect(nexusIslandsBelow(at), "the bottom of the gradient offers no source").toEqual([]);

    const climb = await climbNexusBoards({ repo: r, nexusPubkey: island, priorIslands: nexusIslandsBelow(at) });
    expect(climb.landed).toBe(0);
    for (const url of [kapaeAntigenDocUrl(OWN), edgeKapaeBoardDocUrl(OWN), crossroadsDocUrl(OWN)]) {
      expect(await keysOn(r, url)).toEqual([]);
    }
  }, 30_000);

  test("CONTROL — an UNREADABLE charter re-keys NOTHING: the boot refuses before a board is addressed", async () => {
    const r = repo();
    const at   = { genesisEpochCid: "epoch0-truncated", charterStands: true, ownVesselKey: OWN };
    const torn = nexusIdentity(at);
    expect(torn.kind).toBe("torn");
    // WHAT IT DOES INSTEAD: it HALTS, loudly, at the scope door — never descending to its own board.
    expect(() => nexusScopeOrThrow(torn)).toThrow(/torn/i);
    expect(nexusIslandsBelow(at), "a torn standing names no island, so it offers no source").toEqual([]);
    // Even called directly (a caller that swallowed the refusal), the climb moves nothing.
    const climb = await climbNexusBoards({ repo: r, nexusPubkey: OWN, priorIslands: nexusIslandsBelow(at) });
    expect(climb.landed).toBe(0);
  }, 30_000);

  test("CONTROL — the climb runs THREE times with ONE effect", async () => {
    const r = repo();
    const entry = await ban("ea".repeat(32), CHARTER);
    const shadow = await signEdgeKapae(
      { edgeId: "edge-thrice", raised: true, version: 1, epochCid: CHARTER }, signer(EDGE_AUTH));
    const rec = await publicBook(CHARTER, "lar:///ha.ka.ba/books/thrice");
    (await board(r, kapaeAntigenDocUrl(CHARTER))).change((d) => writeAntigenEntry(d, entry));
    (await board(r, edgeKapaeBoardDocUrl(CHARTER))).change((d) => writeEdgeKapae(d, shadow));
    (await board(r, realmDocUrl(CHARTER))).change((d) => writeRealmBagRegistration(d, rec));

    const run = () => climbNexusBoards({
      repo: r, nexusPubkey: EXPLICIT, priorIslands: nexusIslandsBelow(AT_EXPLICIT), realmId: CHARTER,
    });

    const first = await run();
    expect(first.landed, "one entry per board, all three boards").toBe(3);
    const after = {
      antigen: await keysOn(r, kapaeAntigenDocUrl(EXPLICIT)),
      shadows: await keysOn(r, edgeKapaeBoardDocUrl(EXPLICIT)),
      cross:   await keysOn(r, crossroadsDocUrl(EXPLICIT)),
    };

    for (const pass of [2, 3]) {
      const again = await run();
      expect(again.landed, `boot ${pass} must write nothing`).toBe(0);
    }
    expect(await keysOn(r, kapaeAntigenDocUrl(EXPLICIT))).toEqual(after.antigen);
    expect(await keysOn(r, edgeKapaeBoardDocUrl(EXPLICIT))).toEqual(after.shadows);
    expect(await keysOn(r, crossroadsDocUrl(EXPLICIT))).toEqual(after.cross);
  }, 45_000);

  test("CONTROL — the ISLAND BELOW keeps its content: a carry copies, it never empties", async () => {
    const r = repo();
    const entry  = await ban("eb".repeat(32), CHARTER);
    const shadow = await signEdgeKapae(
      { edgeId: "edge-copied", raised: true, version: 1, epochCid: CHARTER }, signer(EDGE_AUTH));
    (await board(r, kapaeAntigenDocUrl(CHARTER))).change((d) => writeAntigenEntry(d, entry));
    (await board(r, edgeKapaeBoardDocUrl(CHARTER))).change((d) => writeEdgeKapae(d, shadow));
    const beforeAntigen = await keysOn(r, kapaeAntigenDocUrl(CHARTER));
    const beforeShadows = await keysOn(r, edgeKapaeBoardDocUrl(CHARTER));

    await climbNexusBoards({
      repo: r, nexusPubkey: EXPLICIT, priorIslands: nexusIslandsBelow(AT_EXPLICIT), realmId: CHARTER,
    });

    expect(await keysOn(r, kapaeAntigenDocUrl(CHARTER))).toEqual(beforeAntigen);
    expect(await keysOn(r, edgeKapaeBoardDocUrl(CHARTER))).toEqual(beforeShadows);
  }, 30_000);

  test("CONTROL — a key already standing at the destination is never OVERWRITTEN", async () => {
    const r = repo();
    const shadow = await signEdgeKapae(
      { edgeId: "edge-standing", raised: true, version: 1, epochCid: CHARTER }, signer(EDGE_AUTH));
    (await board(r, edgeKapaeBoardDocUrl(OWN))).change((d) => writeEdgeKapae(d, shadow));
    // The destination already holds that exact key, carrying DIFFERENT bytes (a torn or forged variant).
    const key = Object.keys((await board(r, edgeKapaeBoardDocUrl(OWN))).doc()!.tiddlers)[0]!;
    (await board(r, edgeKapaeBoardDocUrl(CHARTER))).change((d) => {
      d.tiddlers[key] = mutableLarRecord(key, { text: "{torn}" }, "test:standing");
    });

    const moved = await carryAntigenUpTheGradient({
      repo: r, nexusPubkey: CHARTER, priorIslands: nexusIslandsBelow(AT_CHARTER),
    });
    expect(moved.landed).toBe(0);
    const shadows = await carryEdgeShadowsUpTheGradient({
      repo: r, nexusPubkey: CHARTER, priorIslands: nexusIslandsBelow(AT_CHARTER),
    });
    expect(shadows.landed, "the destination's own bytes stand — a migration never adjudicates").toBe(0);
    const doc = (await board(r, edgeKapaeBoardDocUrl(CHARTER))).doc();
    expect(doc!.tiddlers[key]!.tiddler["text"]).toBe("{torn}");
  }, 30_000);
});
