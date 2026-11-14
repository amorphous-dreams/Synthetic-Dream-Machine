/**
 * canon-offer-verbs.test — the daemon island's skins of the offering door (offering#/the-canon-offer), the reactors node and
 * browser both register. One rig: a working layer (`wikis/lares/working`) over the canon bag (`bags/lares`), an offer table.
 *
 * REDS:
 *   · `offer-make` from an unadmitted face lands a signed offer and moves no canon byte;
 *   · `offer-promote` from a hand outside the Kahu cabal refuses `kahu-reach` and moves no byte;
 *   · `offer-promote` from the steward writes the offered bytes into canon; a replay writes nothing (the retire rides the store door);
 *   · `offer-promote` on a vessel that lends no charter seat refuses `offer-retire-unseated` at the verb, canon unmoved;
 *   · a canon read that fails during a promotion refuses `offer-canon-unread`, never reading the record as new;
 *   · a `cap/**` title refuses as data (`offer-withheld-title`); a faceless floor refuses `waking-floor`.
 */
import { beforeAll, describe, expect, test } from "vitest";
import { Repo } from "./wiki-shore-rig.js";
import { AutomergeDocStore, CompositeStore, bagUri, carrierHashOf, emptyLarDoc, faceAtomKeyFromSeed, isVerbRefusal, OVERRIDE_BASE_META, type LarDoc, type Verb } from "@lararium/mesh";
import type { KahuReachSource, OfferSeat, OfferSigner } from "@lararium/mesh";
import { seatedCharter, type SeatedCharter } from "../../lararium-mesh/tests/charter-fixture.js";
import { makeOfferMakeReactor, makeOfferListReactor, makeOfferPromoteReactor, makeOfferShowReactor, type CanonOfferVerbOptions } from "../src/canon-offer-verbs.js";
import type { VerbContext } from "../src/verb-dispatcher.js";
import { kahuHand, strangerHand } from "../../lararium-mesh/tests/kahu-reach-fixture.js";
import { placeMeme, readMeme } from "../src/place-meme.js";
import { storeMemeSink } from "../src/meme-sinks.js";
import { storedLarRecord } from "@lararium/mesh";

/** A meme of two slots: its root record calls two slot records, so the root alone renders hollow. */
const MEME_URI = "lar:///ha.ka.ba/lares/docs/pono/offered-whole";
const MEME = [
  "<<!DOCTYPE type=`memetic-wikitext+tiddlywiki` spec=`lar:///ha.ka.ba/lares/api/pono/memetic-wikitext`>>", "",
  `<<^ code=\`&#x0001;\` from=\`?\` to=\`${MEME_URI}\`>>`, "<<^ code=`&#x0002;`>>", "",
  "```toml meta", `title = "${MEME_URI}"`, 'type  = "text/memetic-wikitext+tiddlywiki"', "```", "",
  "<<~ ahu slot=`#/head`>>", "", "! The head", "", "The first slot speaks.", "", "<<~/ahu>>", "",
  "<<~ ahu slot=`#/what-crossed`>>", "", "!! What crossed", "", "The second slot speaks.", "", "<<~/ahu>>", "",
  "<<^ code=`&#x0003;`>>", "", "<<^ code=`&#x0004;` to=`?`>>", "",
].join("\n");

const LARES = bagUri("lares");
const WORKING = "lar:///ha.ka.ba/wikis/lares/working";
const T = "lar:///ha.ka.ba/lares/docs/pono/offered";
/** The Nexus is a charter's AID, so the seat a vessel holds proves itself off the charter's lineage. */
let CH: SeatedCharter;
let NEXUS: string;
let SEAT: OfferSeat;
beforeAll(async () => { CH = await seatedCharter({ seats: 3, threshold: 1 }); NEXUS = CH.aid; SEAT = { key: CH.keys[0]!, epoch: CH.head.epochCid, lineage: CH.chain }; });
const hand = { kind: "tw-local", instanceId: "test" } as const;

const ctxOf = (composite: CompositeStore): VerbContext => ({
  daemon: composite,
  invocation: { requestId: "r", title: "t", action: "offer", args: {}, targets: [], batchMode: "best-effort", status: "pending", requestedBy: "test", requestedAt: "x" } as unknown as Verb,
  cap: async () => ({ ok: true }),
});

async function atom(fill: number): Promise<OfferSigner> {
  const a = faceAtomKeyFromSeed(new Uint8Array(32).fill(fill), "aa".repeat(32));
  return { key: a.key, sign: a.sign };
}

async function rig() {
  const repo = new Repo({ network: [] });
  const composite = new CompositeStore();
  const canon = new AutomergeDocStore(repo.create(emptyLarDoc()), LARES);
  const working = new AutomergeDocStore(repo.create(emptyLarDoc()), WORKING);
  composite.addLayer({ bagId: LARES, store: canon, writable: true, defaultWritable: false });
  composite.addLayer({ bagId: WORKING, store: working, writable: true, defaultWritable: true });
  await canon.put({ tiddler: { title: T, text: "canon says" } }, hand);
  const base = carrierHashOf((await canon.get(T))!.tiddler as Record<string, unknown>);
  await working.put({ tiddler: { title: T, text: "the engineer says" }, meta: { [OVERRIDE_BASE_META]: base } }, hand);
  await working.put({ tiddler: { title: "lar:///ha.ka.ba/bags/daemon/cap/x", text: "k" } }, hand);
  const boardHandle = repo.create<LarDoc>(emptyLarDoc());
  const opts = (reach: KahuReachSource | undefined, face: OfferSigner | null, shore: string | null = NEXUS, seat: OfferSeat | null = SEAT): CanonOfferVerbOptions => ({
    composite, ...(reach ? { kahuReach: reach } : {}),
    ...(seat ? { seat: async () => seat } : {}),
    nexus: async () => shore,
    board: async () => ({ doc: () => boardHandle.doc(), change: (fn) => { boardHandle.change(fn); } }),
    signer: () => (face ? { face: "aa".repeat(32), atom: face } : null),
  });
  return { repo, composite, canon, working, opts };
}

const reasonOf = async (go: () => Promise<unknown>): Promise<string | null> => {
  try { await go(); return null; } catch (e) { return isVerbRefusal(e) ? e.reason : `(${e instanceof Error ? e.message : String(e)})`; }
};

describe("the offer verbs", () => {
  test("RED: an unadmitted face offers; a stranger's promote refuses kahu-reach; the steward promotes and retires; a replay lands nothing", async () => {
    const r = await rig();
    try {
      const h1 = await atom(41), h0 = await atom(40);
      const canonHeads = r.canon.headsNow();
      const made = await makeOfferMakeReactor(r.opts(await strangerHand("joined-without-admission"), h1))({ bag: "lares", titles: [T] }, ctxOf(r.composite));
      expect(made).toMatchObject({ ok: true, landed: true, nexus: NEXUS });
      expect(r.canon.headsNow()).toEqual(canonHeads);
      const cid = String(made["cid"]);
      const listed = await makeOfferListReactor(r.opts(undefined, h1))({ bag: "lares" }, ctxOf(r.composite));
      expect((listed["offers"] as Array<{ cid: string; records: Array<{ freshness: string }> }>)[0]).toMatchObject({ cid, records: [{ freshness: "base-holds" }] });
      const shown = await makeOfferShowReactor(r.opts(undefined, h1))({ cid }, ctxOf(r.composite));
      expect(shown["diffs"]).toEqual([{ title: T, fields: [{ field: "text", canon: "canon says", offered: "the engineer says" }] }]);

      expect(await reasonOf(async () => makeOfferPromoteReactor(r.opts(await strangerHand("admitted-not-joined"), h1))({ cid }, ctxOf(r.composite)))).toBe("kahu-reach");
      expect(await reasonOf(async () => makeOfferPromoteReactor(r.opts(undefined, h1))({ cid }, ctxOf(r.composite)))).toBe("kahu-reach");   // fail closed
      expect(r.canon.headsNow()).toEqual(canonHeads);

      const promoted = await makeOfferPromoteReactor(r.opts(await kahuHand(), h0))({ cid }, ctxOf(r.composite));
      expect(promoted).toMatchObject({ ok: true, moved: true, wrote: [T] });
      expect((await r.canon.get(T))?.tiddler.text).toBe("the engineer says");
      const after = r.canon.headsNow();
      // The answer names the canon document's heads after the write: the retire's door waits on them.
      expect(promoted["canonHeads"]).toEqual([...after!]);
      expect(await makeOfferPromoteReactor(r.opts(await kahuHand(), h0))({ cid }, ctxOf(r.composite))).toMatchObject({ ok: true, moved: true, wrote: [], already: [T] });
      expect(r.canon.headsNow()).toEqual(after);
    } finally { await r.repo.shutdown(); }
  });

  test("RED: the offer-promote verb refuses offer-retire-unseated on a vessel that lends no charter seat, whoever calls it, and canon stays unmoved", async () => {
    const r = await rig();
    try {
      const made = await makeOfferMakeReactor(r.opts(undefined, await atom(41)))({ bag: "lares", titles: [T] }, ctxOf(r.composite));
      const cid = String(made["cid"]);
      const heads = r.canon.headsNow();
      const stranger = (await seatedCharter({ seats: 3, threshold: 1, seed: 7 })).keys[0]!;
      // The steward's own Kahu hand, on a vessel that holds no seat row, and on one whose key the charter seats nowhere.
      for (const seat of [null, { ...SEAT, key: stranger }]) {
        const out = await makeOfferPromoteReactor(r.opts(await kahuHand(), await atom(40), NEXUS, seat))({ cid }, ctxOf(r.composite));
        expect(out).toMatchObject({ ok: false, refusal: "offer-retire-unseated" });
      }
      expect(r.canon.headsNow()).toEqual(heads);
      expect((await r.canon.get(T))?.tiddler.text).toBe("canon says");
      // The reach answers first: a hand outside the cabal reads kahu-reach on a seatless vessel too.
      expect(await reasonOf(async () => makeOfferPromoteReactor(r.opts(await strangerHand("removed"), await atom(40), NEXUS, null))({ cid }, ctxOf(r.composite)))).toBe("kahu-reach");
      // CONTROL: the same call on a vessel that holds a charter seat writes canon.
      expect(await makeOfferPromoteReactor(r.opts(await kahuHand(), await atom(40)))({ cid }, ctxOf(r.composite))).toMatchObject({ ok: true, moved: true, wrote: [T] });
    } finally { await r.repo.shutdown(); }
  });

  test("RED: a canon read that fails during a promotion refuses offer-canon-unread, and the record another hand added to canon stands", async () => {
    const r = await rig();
    try {
      const NEW = "lar:///ha.ka.ba/lares/docs/pono/offered-new";
      const island = new CompositeStore();
      const realm = r.repo.create<LarDoc>(emptyLarDoc());
      const realmStore = new AutomergeDocStore(realm, LARES);
      await realmStore.put({ tiddler: { title: NEW, text: "another hand wrote this" } }, hand);
      const workingDoc = r.repo.create<LarDoc>(emptyLarDoc());
      await new AutomergeDocStore(workingDoc, WORKING).put({ tiddler: { title: NEW, text: "the engineer's new page" } }, hand);   // no fork base: offered as new
      let reads = 0, failing = 0;
      const reach = { repo: r.repo, catalogUrl: null, oracleUrl: null, slotDocUrl: async () => workingDoc.url,
        systemCanonUrl: async () => { reads += 1; if (failing > 0) { failing -= 1; throw new Error("the realm's document did not answer"); } return realm.url; } };
      const opts = (hand: KahuReachSource | undefined, face: OfferSigner): CanonOfferVerbOptions => ({ ...r.opts(hand, face), composite: island, reach } as unknown as CanonOfferVerbOptions);
      const made = await makeOfferMakeReactor(opts(undefined, await atom(41)))({ bag: "lares", titles: [NEW] }, ctxOf(island));
      expect(made).toMatchObject({ ok: true, records: [{ title: NEW, base: null }] });
      // The read fails once (the write that follows would have reached the document): the promotion must not read "no canon record".
      failing = 1;
      const out = await makeOfferPromoteReactor(opts(await kahuHand(), await atom(40)))({ cid: made["cid"] }, ctxOf(island));
      expect(out).toMatchObject({ ok: false, refusal: "offer-canon-unread" });
      expect((await realmStore.get(NEW))?.tiddler.text).toBe("another hand wrote this");
      // CONTROL: with the read answering, the same promotion meets the other hand's record and refuses by ITS name (canon is fresher).
      expect(await makeOfferPromoteReactor(opts(await kahuHand(), await atom(40)))({ cid: made["cid"] }, ctxOf(island))).toMatchObject({ ok: false, refusal: "offer-base-moved" });
      expect(reads).toBeGreaterThan(1);
    } finally { await r.repo.shutdown(); }
  });

  test("RED: an offered meme of several slots arrives in canon whole: canon reads back the text the working layer read before the offer", async () => {
    const r = await rig();
    try {
      const origin = { kind: "lares-verb", requestId: "put" } as const;
      const placed = await placeMeme({ uri: MEME_URI, text: MEME }, storeMemeSink(r.working, WORKING, origin));
      expect(placed.landed.length).toBeGreaterThan(1);   // the root and its slot records
      const before = await readMeme(MEME_URI, storeMemeSink(r.working, WORKING, origin));
      expect(before?.text).toContain("The second slot speaks.");
      const made = await makeOfferMakeReactor(r.opts(undefined, await atom(41)))({ bag: "lares", titles: [MEME_URI] }, ctxOf(r.composite));
      expect((made["records"] as Array<{ title: string }>).map((x) => x.title).sort()).toEqual([...placed.landed].sort());
      const promoted = await makeOfferPromoteReactor(r.opts(await kahuHand(), await atom(40)))({ cid: made["cid"] }, ctxOf(r.composite));
      expect(promoted).toMatchObject({ ok: true, moved: true });
      expect(await readMeme(MEME_URI, storeMemeSink(r.canon, LARES, origin))).toEqual(before);
      // CONTROL: the working copy stands as it stood; a promotion reads the offer's own bytes and clears nothing.
      expect(await readMeme(MEME_URI, storeMemeSink(r.working, WORKING, origin))).toEqual(before);
    } finally { await r.repo.shutdown(); }
  });

  test("RED: a promotion lands in the Kahu realm's standing document, the one the retire reads, never in a document a registry row names for the bag", async () => {
    const r = await rig();
    try {
      // The island mounts no canon layer; a catalog row names a stray document for the bag, and the realm names its own.
      const island = new CompositeStore();
      const realm = r.repo.create<LarDoc>(emptyLarDoc()), stray = r.repo.create<LarDoc>(emptyLarDoc());
      const catalog = r.repo.create<LarDoc>(emptyLarDoc());
      for (const doc of [realm, stray]) await new AutomergeDocStore(doc, LARES).put({ tiddler: { title: T, text: "canon says" } }, hand);
      const workingDoc = r.repo.create<LarDoc>(emptyLarDoc());
      await new AutomergeDocStore(workingDoc, WORKING).put((await r.working.get(T))!, hand);
      catalog.change((d) => { d.tiddlers[LARES] = storedLarRecord(LARES, { text: stray.url, kind: "oracle" }, "test"); });
      const reach = { repo: r.repo, catalogUrl: catalog.url, oracleUrl: null, systemCanonUrl: async () => realm.url, slotDocUrl: async () => workingDoc.url };
      const opts = (hand: KahuReachSource | undefined, face: OfferSigner): CanonOfferVerbOptions => ({ ...r.opts(hand, face), composite: island, reach } as CanonOfferVerbOptions);
      const made = await makeOfferMakeReactor(opts(undefined, await atom(41)))({ bag: "lares", titles: [T] }, ctxOf(island));
      expect(made).toMatchObject({ ok: true, landed: true });
      const promoted = await makeOfferPromoteReactor(opts(await kahuHand(), await atom(40)))({ cid: made["cid"] }, ctxOf(island));
      expect(promoted).toMatchObject({ ok: true, moved: true, wrote: [T] });
      expect((await new AutomergeDocStore(realm, LARES).get(T))?.tiddler.text).toBe("the engineer says");
      // CONTROL: the stray document takes no byte, and the listing reads the record landed off the realm's document.
      expect((await new AutomergeDocStore(stray, LARES).get(T))?.tiddler.text).toBe("canon says");
      const listed = await makeOfferListReactor(opts(undefined, await atom(41)))({ bag: "lares" }, ctxOf(island));
      expect((listed["offers"] as Array<{ records: Array<{ freshness: string }> }>)[0]!.records[0]!.freshness).toBe("landed");
    } finally { await r.repo.shutdown(); }
  });

  test("RED: a cap/** title refuses as data; a faceless floor refuses waking-floor", async () => {
    const r = await rig();
    try {
      const out = await makeOfferMakeReactor(r.opts(undefined, await atom(41)))({ bag: "lares", titles: ["lar:///ha.ka.ba/bags/daemon/cap/x"] }, ctxOf(r.composite));
      expect(out).toMatchObject({ ok: false, refusal: "offer-withheld-title" });
      expect(await reasonOf(() => makeOfferMakeReactor(r.opts(undefined, null))({ bag: "lares", titles: [T] }, ctxOf(r.composite)))).toBe("waking-floor");
    } finally { await r.repo.shutdown(); }
  });

  test("RED: node (the charter names the Nexus) and browser (the page names it) reach one decision through the one reactor", async () => {
    const decide = async (host: "node" | "browser") => {
      const r = await rig();
      try {
        const shore = host === "node" ? NEXUS : null;
        const named = host === "browser" ? { nexus: NEXUS } : {};
        const made = await makeOfferMakeReactor(r.opts(undefined, await atom(41), shore))({ bag: "lares", titles: [T], ...named }, ctxOf(r.composite));
        const promoted = await makeOfferPromoteReactor(r.opts(await kahuHand(), await atom(40), shore))({ cid: made["cid"], ...named }, ctxOf(r.composite));
        // The heads name each rig's own canon document (its actors), never the decision: they stay out of the comparison.
        const { canonHeads, ...decision } = promoted;
        expect(canonHeads).toEqual([...r.canon.headsNow()!]);
        return { made, promoted: decision, text: (await r.canon.get(T))?.tiddler.text };
      } finally { await r.repo.shutdown(); }
    };
    expect(await decide("browser")).toEqual(await decide("node"));
    // CONTROL: a page naming a Nexus other than the charter's refuses by name; naming none where no charter stands refuses too.
    const r = await rig();
    try {
      expect(await makeOfferMakeReactor(r.opts(undefined, await atom(41)))({ bag: "lares", titles: [T], nexus: "nexus-other" }, ctxOf(r.composite))).toMatchObject({ ok: false, refusal: "offer-foreign-nexus" });
      expect(await makeOfferMakeReactor(r.opts(undefined, await atom(41), null))({ bag: "lares", titles: [T] }, ctxOf(r.composite))).toMatchObject({ ok: false, refusal: "offer-no-nexus" });
    } finally { await r.repo.shutdown(); }
  });
});
