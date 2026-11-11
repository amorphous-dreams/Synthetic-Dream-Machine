/**
 * canon-offer-verbs.test — the daemon island's skins of the offering door (offering#/the-canon-offer), the reactors node and
 * browser both register. One rig: a working layer (`wikis/lares/working`) over the canon bag (`bags/lares`), an offer table.
 *
 * REDS:
 *   · `offer-make` from an unadmitted face lands a signed offer and moves no canon byte;
 *   · `offer-promote` from a hand outside the Kahu cabal refuses `kahu-reach` and moves no byte;
 *   · `offer-promote` from the steward writes the offered bytes into canon; a replay writes nothing (the retire rides the store door);
 *   · a `cap/**` title refuses as data (`offer-withheld-title`); a faceless floor refuses `waking-floor`.
 */
import { describe, expect, test } from "vitest";
import { Repo } from "./wiki-shore-rig.js";
import { AutomergeDocStore, CompositeStore, bagUri, carrierHashOf, emptyLarDoc, faceAtomKeyFromSeed, isVerbRefusal, OVERRIDE_BASE_META, type LarDoc, type Verb } from "@lararium/mesh";
import type { KahuReachSource, OfferSigner } from "@lararium/mesh";
import { makeOfferMakeReactor, makeOfferListReactor, makeOfferPromoteReactor, makeOfferShowReactor, type CanonOfferVerbOptions } from "../src/canon-offer-verbs.js";
import type { VerbContext } from "../src/verb-dispatcher.js";
import { kahuHand, strangerHand } from "../../lararium-mesh/tests/kahu-reach-fixture.js";

const LARES = bagUri("lares");
const WORKING = "lar:///ha.ka.ba/wikis/lares/working";
const T = "lar:///ha.ka.ba/lares/docs/pono/offered";
const NEXUS = "nexus-" + "12".repeat(32);
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
  const opts = (reach: KahuReachSource | undefined, face: OfferSigner | null, shore: string | null = NEXUS): CanonOfferVerbOptions => ({
    composite, ...(reach ? { kahuReach: reach } : {}),
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
      expect(await makeOfferPromoteReactor(r.opts(await kahuHand(), h0))({ cid }, ctxOf(r.composite))).toMatchObject({ ok: true, moved: true, wrote: [], already: [T] });
      expect(r.canon.headsNow()).toEqual(after);
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
        return { made, promoted, text: (await r.canon.get(T))?.tiddler.text };
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
