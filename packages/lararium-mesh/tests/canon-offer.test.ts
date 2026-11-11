/**
 * canon-offer.test.ts — THE OFFERING DOOR into house canon (lar:///ha.ka.ba/lares/docs/pono/offering#/the-canon-offer).
 *
 * REDS, each with its control:
 *   · an unadmitted face offers, and canon stays unmoved (no canon write, no canon byte);
 *   · a non-steward promote refuses `kahu-reach` before anything lands;
 *   · the steward promotes: canon carries the offered bytes, and the offer retires by a record keyed to its CID (the row stays);
 *   · a moved base warns "canon is fresher" in the listing, refuses a bare promote, and promotes on the explicit choice;
 *   · a replayed offer and a replayed promotion land nothing;
 *   · withheld and `cap/**` titles refuse to be offered, and a forged row carrying one is set aside;
 *   · the whole loop: h1 offers → h0 promotes → a floor cut from live canon → release → h1's vessel accepts → h1 reads the record;
 *   · node and browser bindings (an Automerge board and canon document, plain memory) reach one decision.
 */
import { beforeAll, describe, expect, test } from "vitest";
import * as ed from "@noble/ed25519";
import { Repo } from "@automerge/automerge-repo";
import { hex, carrierHash } from "../src/crypto.js";
import { emptyLarDoc, type LarDoc } from "../src/base-doc.js";
import { carrierHashOf } from "../src/carrier-form.js";
import { OVERRIDE_BASE_META } from "../src/override-base.js";
import { requireKahuReach, type KahuReachSource } from "../src/kahu-canon-reach.js";
import { AutomergeDocStore } from "../src/automerge-doc-store.js";
import { storedLarRecord } from "../src/stored-record.js";
import {
  CANON_OFFER_PREFIX, CANON_OFFER_RETIRED_PREFIX, CanonOfferRefused, foldCanonOffers, offerCanonRecords, offerWithheldTitle,
  promoteCanonOffer, readCanonOffers, showCanonOffer, canonOfferCid, openCanonOffer, signCanonOffer, cutReleaseFloor,
  retireCanonOffer, signCanonOfferRetire, writeCanonOfferRetire, CANON_OFFER_RETIRE_DOMAIN, type OfferSteward,
  type CanonOfferBoard, type CanonOfferPorts, type OfferRecordReader, type OfferRecordWriter, type OfferSigner,
} from "../src/canon-offer.js";
import { cutFloorSnapshot, floorManifestBytes, floorReadFace, floorRowsInOrder, resolveFloor, type FloorManifest } from "../src/floor-manifest.js";
import { assembleFloorRelease, openFloorReleaseBody } from "../src/floor-release.js";
import { acceptFloorRelease, type FloorPinPorts } from "../src/floor-pin.js";
import { sha256HexBytesSync } from "../src/crypto.js";
import type { LarTiddlerRecord } from "../src/tiddler-store.js";
import { kahuHand, strangerHand } from "./kahu-reach-fixture.js";
import { seatedCharter, type SeatedCharter } from "./charter-fixture.js";

/** The Nexus is a charter's AID (its genesis epoch's address), so a retire's lineage proves its seat against it. */
let CH: SeatedCharter;
let NEXUS: string;
beforeAll(async () => { CH = await seatedCharter({ seats: 3, threshold: 1 }); NEXUS = CH.aid; });

/** A seat of the Nexus's charter, as the steward's vessel holds it: its key, its hand, its epoch and the lineage that proves it. */
async function seat(c: SeatedCharter = CH, i = 0): Promise<OfferSteward> {
  const [held] = await c.signers([i]);
  return { key: held!.signer, sign: held!.sign, epoch: c.head.epochCid, lineage: c.chain };
}
const BAG = "lar:///ha.ka.ba/bags/lares";
const T1 = "lar:///ha.ka.ba/lares/docs/pono/offered-one";
const T2 = "lar:///ha.ka.ba/lares/docs/pono/offered-two";

async function signer(fill: number): Promise<OfferSigner> {
  const seed = new Uint8Array(32).fill(fill);
  return { key: hex(await ed.getPublicKeyAsync(seed)), sign: async (b) => hex(await ed.signAsync(b, seed)) };
}

const rec = (title: string, text: string, base?: string): LarTiddlerRecord =>
  ({ tiddler: { title, text, type: "text/vnd.tiddlywiki", tags: ["docs/pono"] }, ...(base ? { meta: { [OVERRIDE_BASE_META]: base } } : {}) }) as LarTiddlerRecord;

/** A memory store: what a browser binding reads and writes, counting each canon write. */
function memoryStore(rows: Record<string, LarTiddlerRecord> = {}): OfferRecordReader & OfferRecordWriter & { puts: number; rows: Record<string, LarTiddlerRecord> } {
  return {
    rows, puts: 0,
    async get(title) { return rows[title] ?? null; },
    async put(record) { this.puts += 1; rows[String(record.tiddler.title)] = record; },
  };
}

function memoryBoard(doc: LarDoc = emptyLarDoc()): CanonOfferBoard & { changes: number } {
  return { changes: 0, doc: () => doc, change(fn) { this.changes += 1; fn(doc); } };
}

const reachOf = (source: KahuReachSource) => (bag: string) => requireKahuReach(bag, source, "offer promote");

function ports(board: CanonOfferBoard, canon: OfferRecordReader & OfferRecordWriter): CanonOfferPorts {
  return { nexus: NEXUS, board, canon: async () => canon };
}

describe("the offer", () => {
  test("RED: an unadmitted face offers, and canon stays unmoved", async () => {
    const canonBefore = rec(T1, "canon says one");
    const canon = memoryStore({ [T1]: canonBefore });
    const base = carrierHashOf(canonBefore.tiddler as Record<string, unknown>);
    const working = memoryStore({ [T1]: rec(T1, "the engineer says one", base), [T2]: rec(T2, "a new page") });
    const board = memoryBoard();
    const h1 = await signer(11);
    const out = await offerCanonRecords({ ...ports(board, canon), source: working, signer: h1, face: "aa".repeat(32) }, { bag: "lares", titles: [T2, T1] });
    expect(out.landed).toBe(true);
    expect(canon.puts).toBe(0);
    expect(canon.rows[T1]).toBe(canonBefore);
    expect(canon.rows[T2]).toBeUndefined();
    // The offer names each record's digest and fork base: the canon carrier for T1, none for the new T2.
    const [one, two] = out.offer.body.records;
    expect(one).toMatchObject({ title: T1, base });
    expect(two).toMatchObject({ title: T2, base: null });
    expect(one!.digest).toBe(carrierHashOf(one!.fields));
    expect(Object.keys(board.doc()!.tiddlers)).toEqual([`${CANON_OFFER_PREFIX}${out.offer.cid}`]);
    // CONTROL: the listing reads it open, the base holding for T1, T2 new.
    const listed = await readCanonOffers(ports(board, canon));
    expect(listed.offers).toHaveLength(1);
    expect(listed.offers[0]!.records.map((r) => r.freshness)).toEqual(["base-holds", "new"]);
    expect(listed.offers[0]!.fresher).toBe(false);
  });

  test("RED: withheld and cap/** titles refuse to be offered; a forged row carrying one is set aside", async () => {
    for (const title of ["lar:///ha.ka.ba/bags/daemon/cap/abc", "lar:///ha.ka.ba/bags/secret/cap/face/x", "$:/temp/scratch", "lar:///ha.ka.ba/bags/control/floor-pin/x", "lar:///ha.ka.ba/bags/lares/../daemon/cap/y"]) {
      expect(offerWithheldTitle(title)).toBe(true);
      const working = memoryStore({ [title]: rec(title, "secret") });
      const board = memoryBoard();
      await expect(offerCanonRecords({ ...ports(board, memoryStore()), source: working, signer: await signer(11), face: "aa" }, { bag: "lares", titles: [title] }))
        .rejects.toMatchObject({ refusal: "offer-withheld-title" });
      expect(Object.keys(board.doc()!.tiddlers)).toEqual([]);
    }
    // A row forged past the door (signed, CID-true, but carrying a cap title) never counts on the board.
    const h1 = await signer(11);
    const body = { ...openCanonOffer({ nexus: NEXUS, bag: "lares", face: "aa", offerer: h1.key, records: [{ record: rec(T1, "x"), base: null }] }) };
    const forgedRecord = { title: "lar:///ha.ka.ba/bags/daemon/cap/zz", fields: { title: "lar:///ha.ka.ba/bags/daemon/cap/zz", text: "k" }, digest: carrierHashOf({ title: "lar:///ha.ka.ba/bags/daemon/cap/zz", text: "k" }), base: null };
    const forged = await signCanonOffer({ ...body, records: [forgedRecord] }, h1);
    const doc = emptyLarDoc();
    doc.tiddlers[`${CANON_OFFER_PREFIX}${forged.cid}`] = storedLarRecord(`${CANON_OFFER_PREFIX}${forged.cid}`, { text: JSON.stringify(forged) }, "t");
    const folded = foldCanonOffers(doc, NEXUS);
    expect(folded.offers).toHaveLength(0);
    expect(folded.setAside).toEqual([{ key: forged.cid, reason: "withheld-title" }]);
    // CONTROL: a non-canon bag refuses by its own name.
    await expect(offerCanonRecords({ ...ports(memoryBoard(), memoryStore()), source: memoryStore({ [T1]: rec(T1, "x") }), signer: h1, face: "aa" }, { bag: "crossroads", titles: [T1] }))
      .rejects.toMatchObject({ refusal: "offer-not-canon" });
  });

  test("RED: a replayed offer lands nothing", async () => {
    const working = memoryStore({ [T2]: rec(T2, "a new page") });
    const board = memoryBoard();
    const h1 = await signer(11);
    const first = await offerCanonRecords({ ...ports(board, memoryStore()), source: working, signer: h1, face: "aa" }, { bag: "lares", titles: [T2] });
    const before = JSON.stringify(board.doc());
    const again = await offerCanonRecords({ ...ports(board, memoryStore()), source: working, signer: h1, face: "aa" }, { bag: "lares", titles: [T2] });
    expect(again).toMatchObject({ landed: false, offer: { cid: first.offer.cid } });
    expect(Object.keys(board.doc()!.tiddlers)).toHaveLength(1);
    expect(JSON.stringify(board.doc())).toBe(before);
  });
});

describe("the promotion", () => {
  async function offered() {
    const canonBefore = rec(T1, "canon says one");
    const canon = memoryStore({ [T1]: canonBefore });
    const base = carrierHashOf(canonBefore.tiddler as Record<string, unknown>);
    const working = memoryStore({ [T1]: rec(T1, "the engineer says one", base), [T2]: rec(T2, "a new page") });
    const board = memoryBoard();
    const out = await offerCanonRecords({ ...ports(board, canon), source: working, signer: await signer(11), face: "aa" }, { bag: "lares", titles: [T1, T2] });
    return { canon, board, offer: out.offer, working };
  }

  test("RED: a non-steward promote refuses, and nothing lands", async () => {
    const { canon, board, offer } = await offered();
    for (const kind of ["joined-without-admission", "admitted-not-joined", "removed", "no-cabal"] as const) {
      const changes = board.changes;
      await expect(promoteCanonOffer({ ...ports(board, canon), requireReach: reachOf(await strangerHand(kind)), canonWrite: async () => canon }, { cid: offer.cid }))
        .rejects.toMatchObject({ reason: "kahu-reach" });
      expect(canon.puts).toBe(0);
      expect(board.changes).toBe(changes);
    }
    expect(Object.keys(board.doc()!.tiddlers).some((k) => k.startsWith(CANON_OFFER_RETIRED_PREFIX))).toBe(false);
  });

  test("RED: the steward promotes; canon carries the offered bytes, and a charter seat retires the offer by a record keyed to its CID", async () => {
    const { canon, board, offer } = await offered();
    // A retire never runs ahead of the canon write it records.
    await expect(retireCanonOffer({ ...ports(board, canon), steward: await seat() }, { cid: offer.cid })).rejects.toMatchObject({ refusal: "offer-not-landed" });
    const out = await promoteCanonOffer({ ...ports(board, canon), requireReach: reachOf(await kahuHand()), canonWrite: async () => canon }, { cid: offer.cid });
    expect(out).toMatchObject({ moved: true, wrote: [T1, T2], already: [], over: [] });
    for (const r of offer.body.records) expect(carrierHashOf(canon.rows[r.title]!.tiddler as Record<string, unknown>)).toBe(r.digest);
    // Promoted, not yet retired: the offer still reads open.
    expect((await readCanonOffers(ports(board, canon))).offers).toHaveLength(1);
    const retired = await retireCanonOffer({ ...ports(board, canon), steward: await seat() }, { cid: offer.cid });
    expect(retired).toMatchObject({ retired: true, cid: offer.cid });
    // The offer row stays; the retire rides beside it, keyed to the offer's CID and its own.
    expect(board.doc()!.tiddlers[`${CANON_OFFER_PREFIX}${offer.cid}`]).toBeDefined();
    expect(board.doc()!.tiddlers[`${CANON_OFFER_RETIRED_PREFIX}${offer.cid}/${(retired as { retire: string }).retire}`]).toBeDefined();
    const folded = foldCanonOffers(board.doc(), NEXUS);
    expect(folded.offers[0]!.retired?.body).toMatchObject({ offer: offer.cid, steward: (await seat()).key, epoch: CH.head.epochCid });
    // CONTROL: the open listing drops it; `all` names it retired, every record landed.
    expect((await readCanonOffers(ports(board, canon))).offers).toHaveLength(0);
    const all = await readCanonOffers(ports(board, canon), { all: true });
    expect(all.offers[0]!.retired).not.toBeNull();
    expect(all.offers[0]!.records.map((r) => r.freshness)).toEqual(["landed", "landed"]);
  });

  test("RED: a replayed promotion lands nothing", async () => {
    const { canon, board, offer } = await offered();
    const p = { ...ports(board, canon), requireReach: reachOf(await kahuHand()), canonWrite: async () => canon };
    await promoteCanonOffer(p, { cid: offer.cid });
    const puts = canon.puts;
    // Before the retire, a replay writes nothing: every record reads landed.
    expect(await promoteCanonOffer(p, { cid: offer.cid })).toMatchObject({ moved: true, wrote: [], already: [T1, T2] });
    expect(canon.puts).toBe(puts);
    await retireCanonOffer({ ...ports(board, canon), steward: await seat() }, { cid: offer.cid });
    const rows = Object.keys(board.doc()!.tiddlers).length;
    expect(await promoteCanonOffer(p, { cid: offer.cid })).toMatchObject({ moved: false, why: "retired" });
    expect(await retireCanonOffer({ ...ports(board, canon), steward: await seat(CH, 1) }, { cid: offer.cid })).toMatchObject({ retired: false, why: "retired" });
    expect(canon.puts).toBe(puts);
    expect(Object.keys(board.doc()!.tiddlers)).toHaveLength(rows);
  });

  test("RED: a moved base warns 'canon is fresher', refuses a bare promote, and promotes on the explicit choice", async () => {
    const { canon, board, offer } = await offered();
    canon.rows[T1] = rec(T1, "the steward moved canon meanwhile");
    const moved = carrierHashOf(canon.rows[T1]!.tiddler as Record<string, unknown>);
    const listed = await readCanonOffers(ports(board, canon));
    expect(listed.offers[0]!.fresher).toBe(true);
    expect(listed.offers[0]!.records.find((r) => r.title === T1)!.freshness).toBe("canon-is-fresher");
    const shown = await showCanonOffer(ports(board, canon), offer.cid);
    expect(shown.diffs.find((d) => d.title === T1)!.fields).toEqual([{ field: "text", canon: "the steward moved canon meanwhile", offered: "the engineer says one" }]);
    const p = { ...ports(board, canon), requireReach: reachOf(await kahuHand()), canonWrite: async () => canon };
    const err = await promoteCanonOffer(p, { cid: offer.cid }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(CanonOfferRefused);
    expect((err as CanonOfferRefused).refusal).toBe("offer-base-moved");
    expect((err as Error).message).toContain("canon is fresher");
    expect(canon.puts).toBe(0);
    // CONTROL: the explicit choice promotes, and the retire names the fresher canon it overrode.
    const out = await promoteCanonOffer(p, { cid: offer.cid, overFresher: true });
    expect(out).toMatchObject({ moved: true, over: [{ title: T1, canon: moved }] });
    await retireCanonOffer({ ...ports(board, canon), steward: await seat() }, { cid: offer.cid, over: out.moved ? out.over : [] });
    expect(foldCanonOffers(board.doc(), NEXUS).offers[0]!.retired!.body.over).toEqual([{ title: T1, canon: moved }]);
  });
});

describe("the retire's authority", () => {
  async function promoted() {
    const canon = memoryStore();
    const working = memoryStore({ [T2]: rec(T2, "a new page") });
    const board = memoryBoard();
    const out = await offerCanonRecords({ ...ports(board, canon), source: working, signer: await signer(11), face: "aa" }, { bag: "lares", titles: [T2] });
    await promoteCanonOffer({ ...ports(board, canon), requireReach: reachOf(await kahuHand()), canonWrite: async () => canon }, { cid: out.offer.cid });
    return { canon, board, offer: out.offer };
  }
  const forge = async (offerCid: string, steward: OfferSteward) => signCanonOfferRetire({
    kind: CANON_OFFER_RETIRE_DOMAIN, nexus: NEXUS, offer: offerCid, steward: steward.key, epoch: steward.epoch, landed: [], over: [],
  }, steward);

  test("RED: a stranger-signed retire leaves the offer open, and show names it retire-unauthorised", async () => {
    const { canon, board, offer } = await promoted();
    const stranger = await signer(66);
    // Three forgeries: a stranger's key beside the true lineage, a stranger's own charter's lineage, and a seat of another Nexus.
    const other = await seatedCharter({ seats: 1, threshold: 1, seed: 9 });
    const forgeries = [
      await forge(offer.cid, { ...stranger, epoch: CH.head.epochCid, lineage: CH.chain }),
      await forge(offer.cid, { ...(await seat(other)), epoch: other.head.epochCid }),
    ];
    for (const f of forgeries) board.change((d) => { writeCanonOfferRetire(d, f); });
    const folded = foldCanonOffers(board.doc(), NEXUS);
    expect(folded.offers[0]!.retired).toBeNull();
    expect(folded.offers[0]!.refusedRetires.map((r) => r.reason)).toEqual(["retire-unauthorised", "retire-unauthorised"]);
    expect((await readCanonOffers(ports(board, canon))).offers.map((o) => o.cid)).toEqual([offer.cid]);
    const shown = await showCanonOffer(ports(board, canon), offer.cid);
    expect(shown.retired).toBeNull();
    expect(shown.refusedRetires).toContainEqual(expect.objectContaining({ reason: "retire-unauthorised", steward: stranger.key }));
    // The door itself refuses an unseated key before it signs.
    await expect(retireCanonOffer({ ...ports(board, canon), steward: { ...stranger, epoch: CH.head.epochCid, lineage: CH.chain } }, { cid: offer.cid }))
      .rejects.toMatchObject({ refusal: "offer-retire-unseated" });
    // CONTROL: a forgery written first takes no key the steward needs; the seat's retire still retires the offer.
    expect(await retireCanonOffer({ ...ports(board, canon), steward: await seat() }, { cid: offer.cid })).toMatchObject({ retired: true });
    expect(foldCanonOffers(board.doc(), NEXUS).offers[0]!.retired?.body.steward).toBe((await seat()).key);
    expect((await readCanonOffers(ports(board, canon))).offers).toHaveLength(0);
  });
});

describe("the loop", () => {
  test("RED: h1 offers → h0 promotes → a floor cut from live canon → release → h1's vessel accepts → h1 reads the record", async () => {
    // Genesis: canon holds T1; the floor every vessel stands on names it.
    const genesisLares = { [T1]: rec(T1, "canon says one") };
    const genesisLararium = { "lar:///ha.ka.ba/lararium/x": rec("lar:///ha.ka.ba/lararium/x", "x") };
    const cas = new Map<string, Uint8Array>();
    const gl = cutFloorSnapshot(genesisLares), gr = cutFloorSnapshot(genesisLararium);
    const genesis: FloorManifest = { format: "lararium-floor", engine: "e".repeat(64), grammar: "a".repeat(64), plugins: "b".repeat(64), snapshots: { lares: gl.cid, lararium: gr.cid } };
    const gBytes = floorManifestBytes(genesis), gCid = sha256HexBytesSync(gBytes);
    for (const [c, b] of [[gl.cid, gl.bytes], [gr.cid, gr.bytes], [gCid, gBytes]] as const) cas.set(c, b);

    // The steward's live canon (an Automerge document, as the Kahu realm holds it), and h1's workbench over it.
    const repo = new Repo();
    const canonStore = new AutomergeDocStore(repo.create<LarDoc>(emptyLarDoc()), BAG);
    const origin = { kind: "lares-verb", requestId: "genesis" } as const;
    await canonStore.put({ tiddler: { ...genesisLares[T1]!.tiddler } }, origin);
    const base = carrierHashOf((await canonStore.get(T1))!.tiddler as Record<string, unknown>);
    const workbench = memoryStore({ [T1]: rec(T1, "the referee's revised page", base) });
    const board = memoryBoard();
    const canonPorts: CanonOfferPorts = { nexus: NEXUS, board, canon: async () => canonStore };

    // 1 · h1 OFFERS (unadmitted).
    const { offer } = await offerCanonRecords({ ...canonPorts, source: workbench, signer: await signer(21), face: "11".repeat(32) }, { bag: "lares", titles: [T1] });
    // 2 · h0 PROMOTES under the Kahu reach.
    await promoteCanonOffer({ ...canonPorts, requireReach: reachOf(await kahuHand()),
      canonWrite: async () => ({ put: (r) => canonStore.put(r, { kind: "lares-verb", requestId: "promote" }) }) }, { cid: offer.cid });
    await retireCanonOffer({ ...canonPorts, steward: await seat() }, { cid: offer.cid });
    expect((await readCanonOffers(canonPorts)).offers).toHaveLength(0);
    // 3 · RELEASE: cut the floor from live canon through the release wiring (lares re-cut, lararium kept: no document here).
    const cut = await cutReleaseFloor({
      prior: async () => ({ manifestCid: gCid, bytes: gBytes }),
      canonRows: async (slug) => {
        if (slug !== "lares") return null;
        const live: Record<string, LarTiddlerRecord> = {};
        for (const t of await canonStore.listVisible()) live[t] = (await canonStore.get(t))!;
        return live;
      },
      stage: async (blobs) => { for (const b of blobs) cas.set(b.cid, b.bytes); },
    });
    expect(cut).toMatchObject({ prior: gCid, cut: ["lares"], kept: ["lararium"], moved: ["lares"] });
    expect(cas.get(cut.manifestCid)).toEqual(cut.manifestBytes);
    const c = CH;
    const [steward] = await c.signers([0]);
    const release = await assembleFloorRelease({
      body: openFloorReleaseBody({ nexus: c.aid, epoch: c.head.epochCid, prior: null, manifest: cut.manifestCid }),
      lineage: c.chain, manifestBytes: cut.manifestBytes, steward: steward!, approvers: [...await c.signers()],
    });
    // 4 · h1's VESSEL ACCEPTS through Leap 1's door.
    const home = { doc: () => controlDoc, change(fn: (d: LarDoc) => void) { fn(controlDoc); } };
    const controlDoc = emptyLarDoc();
    const local = new Map<string, Uint8Array>([[gl.cid, gl.bytes], [gr.cid, gr.bytes], [gCid, gBytes]]);
    const pinPorts: FloorPinPorts = {
      home, nexus: c.aid, genesisManifest: gCid,
      rows: async () => [{ keyCid: release.cid, record: JSON.parse(JSON.stringify(release)) as unknown }],
      fetchCas: async (cid) => local.get(cid) ?? cas.get(cid) ?? null,
      stage: async (blobs) => { for (const b of blobs) local.set(b.cid, b.bytes); },
      mount: { floorSwap: false, alert: () => {} },
    };
    const accepted = await acceptFloorRelease(pinPorts);
    expect(accepted).toMatchObject({ ok: true, moved: true, pin: { release: release.cid, manifest: cut.manifestCid } });
    // 5 · h1 READS the promoted record on its floor.
    const floor = await resolveFloor(cut.manifestCid, async (cid) => local.get(cid) ?? null);
    if ("refusal" in floor) throw new Error(floor.refusal);
    const face = floorReadFace({ rows: floorRowsInOrder(floor) });
    const read = await face.get(T1);
    expect(read?.tiddler.text).toBe("the referee's revised page");
    expect(carrierHashOf(read!.tiddler as Record<string, unknown>)).toBe(offer.body.records[0]!.digest);
    // CONTROL: a cut over unmoved canon answers the prior's own CID (a replayed cut lands nothing new).
    const again = await cutReleaseFloor({ prior: async () => ({ manifestCid: gCid, bytes: gBytes }), canonRows: async (slug) => (slug === "lares" ? genesisLares : null), stage: async () => {} });
    expect(again).toMatchObject({ manifestCid: gCid, moved: [] });
    // CONTROL: the genesis floor still reads the old page (the pin moved, the old floor did not).
    const old = await resolveFloor(gCid, async (cid) => local.get(cid) ?? null);
    if ("refusal" in old) throw new Error(old.refusal);
    expect((await floorReadFace({ rows: floorRowsInOrder(old) }).get(T1))?.tiddler.text).toBe("canon says one");
  });
});

describe("both hosts", () => {
  test("RED: an Automerge binding (node) and a memory binding (browser) reach one decision", async () => {
    const canonRow = rec(T1, "canon says one");
    const base = carrierHashOf(canonRow.tiddler as Record<string, unknown>);
    const h1 = await signer(31), h0 = await seat();
    const steward = await kahuHand();

    async function run(binding: "node" | "browser") {
      let board: CanonOfferBoard;
      let canon: OfferRecordReader & OfferRecordWriter;
      if (binding === "node") {
        const repo = new Repo();
        const handle = repo.create<LarDoc>(emptyLarDoc());
        board = { doc: () => handle.doc(), change: (fn) => handle.change(fn) };
        const store = new AutomergeDocStore(repo.create<LarDoc>(emptyLarDoc()), BAG);
        await store.put({ tiddler: { ...canonRow.tiddler } }, { kind: "lares-verb", requestId: "seed" });
        canon = { get: (t) => store.get(t), put: (r) => store.put(r, { kind: "lares-verb", requestId: "promote" }) };
      } else {
        board = memoryBoard();
        canon = memoryStore({ [T1]: { tiddler: { ...canonRow.tiddler } } });
      }
      const p: CanonOfferPorts = { nexus: NEXUS, board, canon: async () => canon };
      const working = memoryStore({ [T1]: rec(T1, "offered", base), [T2]: rec(T2, "new") });
      const { offer } = await offerCanonRecords({ ...p, source: working, signer: h1, face: "aa" }, { bag: "lares", titles: [T1, T2] });
      const listed = await readCanonOffers(p);
      const promoted = await promoteCanonOffer({ ...p, requireReach: reachOf(steward), canonWrite: async () => canon }, { cid: offer.cid });
      const retired = await retireCanonOffer({ ...p, steward: h0 }, { cid: offer.cid });
      const replay = await promoteCanonOffer({ ...p, requireReach: reachOf(steward), canonWrite: async () => canon }, { cid: offer.cid });
      const digests = await Promise.all([T1, T2].map(async (t) => carrierHashOf((await canon.get(t))!.tiddler as Record<string, unknown>)));
      return { cid: offer.cid, listed: listed.offers, promoted, retired, replay, digests };
    }
    const node = await run("node"), browser = await run("browser");
    expect(node).toEqual(browser);
    expect(node.promoted).toMatchObject({ moved: true, wrote: [T1, T2] });
    expect(node.replay).toMatchObject({ moved: false });
    // CONTROL: the CID re-derives from the body alone, the same on either host.
    expect(canonOfferCid(openCanonOffer({ nexus: NEXUS, bag: "lares", face: "aa", offerer: h1.key, records: [{ record: rec(T1, "offered", base), base }, { record: rec(T2, "new"), base: null }] }))).toBe(node.cid);
  });
});

// carrierHash stays the one digest a record carries (a guard that this suite reads the house's identity, not a fresh hash).
test("the offered digest is the carrier identity", () => {
  expect(carrierHashOf({ title: "t", text: "x" })).toBe(carrierHash("title: t\n\nx"));
});
