/**
 * seat-canon-reach.test — the AI seat never writes house canon live (reach-mu decision T4-2). The daemon mount holds the Kahu
 * chair and every seat call acts as the mount, so the Kahu predicate alone lets a seat-asked `lares put bag=lares` land. The
 * asker's hand rides the verb context (`ctx.asker`, set by the vessel's door, never read off args), and a seat asker on a house
 * canon bag refuses `seat-canon-reach` before the Kahu read, naming the copy-up and offer road.
 *
 * CONTROLS: the operator's CLI hand and a context naming no asker land the same put under the Kahu hand; a seat put to a user
 * bag lands; a seat put into a wiki's working layer, addressed as a bag, lands there (no house canon bag resolves there).
 */
import { describe, test, expect } from "vitest";
import { Repo } from "./wiki-shore-rig.js";
import { AutomergeDocStore } from "@lararium/mesh/automerge-doc-store";
import { CompositeStore } from "@lararium/mesh/composite-store";
import { bagUri, recipeUri } from "@lararium/mesh/lar-uris";
import { emptyLarDoc } from "@lararium/mesh/base-doc";
import { isVerbRefusal } from "@lararium/mesh/verb-refusal";
import { type LarTiddlerRecord } from "@lararium/mesh/tiddler-store";
import { type Verb } from "@lararium/mesh/verb-tiddler";
import type { Hand } from "@lararium/mesh/session-contract";
import { type MemeVerbOptions } from "../src/meme-verbs.js";
import { makeTiddlerPutReactor, makeTiddlerDeleteReactor } from "../src/tiddler-verbs.js";
import { makeDraftReactor } from "../src/wiki-draft-handlers.js";
import { makeActionReactorFor } from "../src/action-handler.js";
import { VerbDispatcher, VerbTable } from "../src/verb-dispatcher.js";
import type { VerbContext } from "../src/verb-dispatcher.js";
import { kahuHand } from "../../lararium-mesh/tests/kahu-reach-fixture.js";

const LARES = bagUri("lares");
const GARDEN = bagUri("garden");
const WORKING = "lar:///ha.ka.ba/wikis/trove/working";
const hand = { kind: "tw-local", instanceId: "test" } as const;
const URI = "lar:///t/ford";
const meme = (slot: string): string =>
  `<<^ code=\`&#x0001;\` from=\`?\` to=\`${URI}\`>>\n` +
  `<<^ code=\`&#x0002;\`>>\n\n\`\`\`toml meta\nuri-path = "t/ford"\n\`\`\`\n\n<<~ ahu slot=\`#${slot}\`>>\n\n! ${slot}\n\n<<~/ahu>>\n\n` +
  `<<^ code=\`&#x0003;\`>>\n\n<<^ code=\`&#x0004;\` to=\`?\`>>\n`;

const ctxOf = (composite: CompositeStore, action: string, asker?: Hand): VerbContext => ({
  daemon: composite,
  invocation: { requestId: "r", title: "t", action, args: {}, targets: [], batchMode: "best-effort", status: "pending", requestedBy: "test", requestedAt: "" } as unknown as Verb,
  cap: async () => ({ ok: true }),
  ...(asker ? { asker } : {}),
} as VerbContext);

async function rig() {
  const repo = new Repo({ network: [] });
  const stores = new Map<string, AutomergeDocStore>();
  const composite = new CompositeStore();
  for (const bag of [LARES, GARDEN, WORKING]) {
    const store = new AutomergeDocStore(repo.create(emptyLarDoc()), bag);
    stores.set(bag, store);
    composite.addLayer({ bagId: bag, store, writable: true, defaultWritable: bag === WORKING });
  }
  await stores.get(LARES)!.put({ tiddler: { title: "T", text: "T" }, meta: { changeId: "change:T" } }, hand);
  const recipes = new Map<string, LarTiddlerRecord>([[recipeUri("catalog", "trove"), { tiddler: { title: recipeUri("catalog", "trove"), "bag-stack": `${LARES} ${WORKING}`, "writable-bag": WORKING } }]]);
  const opts = async (): Promise<MemeVerbOptions> => ({
    composite,
    tw5: { $tw: { wiki: { getTiddlerText: () => "" } } } as unknown as MemeVerbOptions["tw5"],
    recipeOf: async (slug) => recipes.get(recipeUri("catalog", slug)) ?? null,
    slotStore: async (_slug, kind) => (kind === "working" ? stores.get(WORKING)! : null),
    kahuReach: await kahuHand(),
  });
  const heads = () => [...stores.values()].map((s) => s.headsNow());
  return { repo, stores, composite, opts, heads };
}

const reasonOf = async (go: () => Promise<unknown>): Promise<string | null> => {
  try { await go(); return null; } catch (e) { return isVerbRefusal(e) ? e.reason : `(${e instanceof Error ? e.message : String(e)})`; }
};

describe("seat-canon-reach — the AI seat never writes house canon live", () => {
  test("RED: a seat-asked put bag=lares under the mount's Kahu chair refuses seat-canon-reach and moves no byte", async () => {
    const r = await rig();
    try {
      const before = r.heads();
      const put = async () => makeTiddlerPutReactor(await r.opts())({ title: URI, bag: "lares", text: meme("/a") }, ctxOf(r.composite, "tiddler-put", "seat"));
      expect(await reasonOf(put)).toBe("seat-canon-reach");
      expect(r.heads()).toEqual(before);
      expect(await r.stores.get(LARES)!.get(URI)).toBeNull();
    } finally { await r.repo.shutdown(); }
  });

  test("RED: the refusal names the copy-up and offer road, never a vault unlock", async () => {
    const r = await rig();
    try {
      let message = "";
      try { await makeTiddlerPutReactor(await r.opts())({ title: URI, bag: "lares", text: meme("/a") }, ctxOf(r.composite, "tiddler-put", "seat")); }
      catch (e) { message = e instanceof Error ? e.message : String(e); }
      expect(message).toMatch(/recipe=/);
      expect(message).toMatch(/lar:\/\/\/realm\.offer\.signs/);
      expect(message).not.toMatch(/vault unlock/);
    } finally { await r.repo.shutdown(); }
  });

  test("RED: a seat-asked family delete and draft into house canon refuse seat-canon-reach", async () => {
    const r = await rig();
    try {
      await makeTiddlerPutReactor(await r.opts())({ title: URI, bag: "lares", text: meme("/a") }, ctxOf(r.composite, "tiddler-put", "cli"));
      const before = r.heads();
      expect(await reasonOf(async () => makeTiddlerDeleteReactor(await r.opts())({ title: URI, bag: "lares", family: true }, ctxOf(r.composite, "tiddler-delete", "seat")))).toBe("seat-canon-reach");
      expect(await reasonOf(async () => makeDraftReactor({ composite: r.composite, kahuReach: await kahuHand() })({ tiddler: "T", toBag: LARES }, ctxOf(r.composite, "draft", "seat")))).toBe("seat-canon-reach");
      expect(r.heads()).toEqual(before);
    } finally { await r.repo.shutdown(); }
  });

  test("RED: a seat-asked residency ADD into house canon refuses seat-canon-reach; CONTROL: a seat COPY OUT of canon lands", async () => {
    const r = await rig();
    try {
      const run = async (verb: "ADD" | "COPY", args: Record<string, unknown>) =>
        makeActionReactorFor(verb, { composite: r.composite, kahuReach: await kahuHand() })(args, ctxOf(r.composite, verb, "seat"));
      await r.stores.get(WORKING)!.put({ tiddler: { title: "W", text: "W" }, meta: { changeId: "change:W" } }, hand);
      const before = r.heads();
      expect(await reasonOf(() => run("ADD", { title: "W", "from-bag": WORKING, "to-bag": LARES, "change-id": "c1" }))).toBe("seat-canon-reach");
      expect(r.heads()).toEqual(before);
      await run("COPY", { title: "T", "from-bag": LARES, "to-bag": GARDEN, "change-id": "c2" });
      expect(await r.stores.get(GARDEN)!.get("T")).toMatchObject({ tiddler: { text: "T" } });
    } finally { await r.repo.shutdown(); }
  });

  test("RED: a routed act the island clears for main refuses a seat asker naming a house canon bag, with or without a verifier; CONTROL: a COPY OUT, a cli asker and a face row pass", async () => {
    const dispatcher = (asker?: Hand) => new VerbDispatcher({
      daemonVm: {} as never, daemon: new CompositeStore(), control: new CompositeStore(), registry: new VerbTable(),
      routeFn: async () => ({}), localOf: () => true, surfaceOf: () => false, askerOf: () => asker,
    });
    const routed = (verb: string, args: Record<string, unknown>) =>
      ({ requestId: "w1", title: "t", action: "wiki-act", args: { wiki: "trove", verb, args }, targets: [], batchMode: "best-effort", status: "pending", requestedBy: "me", requestedAt: "" }) as unknown as Verb;
    const into = routed("ADD", { title: "W", "from-bag": WORKING, "to-bag": LARES });
    const out = routed("COPY", { title: "T", "from-bag": LARES, "to-bag": GARDEN });
    expect(await reasonOf(() => dispatcher("seat").clearRouted(into))).toBe("seat-canon-reach");
    expect(await reasonOf(() => dispatcher("seat").clearRouted(out))).toBeNull();
    expect(await reasonOf(() => dispatcher("cli").clearRouted(into))).toBeNull();
    expect(await reasonOf(() => dispatcher("seat").clearRouted(into, { local: true, presenter: "me" }))).toBeNull();
  });

  test("CONTROL: the operator's CLI hand, and a context naming no asker, land the same put under the Kahu hand", async () => {
    for (const asker of ["cli", undefined] as const) {
      const r = await rig();
      try {
        expect((await makeTiddlerPutReactor(await r.opts())({ title: URI, bag: "lares", text: meme("/a") }, ctxOf(r.composite, "tiddler-put", asker)))["decision"]).toBe("put");
        expect(await r.stores.get(LARES)!.get(URI)).not.toBeNull();
      } finally { await r.repo.shutdown(); }
    }
  });

  test("CONTROL: a seat put to a user bag lands, and a seat put into a wiki's working layer addressed as a bag lands there", async () => {
    const r = await rig();
    try {
      expect((await makeTiddlerPutReactor(await r.opts())({ title: URI, bag: "garden", text: meme("/g") }, ctxOf(r.composite, "tiddler-put", "seat")))["decision"]).toBe("put");
      const up = await makeTiddlerPutReactor(await r.opts())({ title: URI, bag: WORKING, text: meme("/w") }, ctxOf(r.composite, "tiddler-put", "seat"));
      expect(up).toMatchObject({ decision: "put", bag: WORKING, layer: "working" });
      expect(await r.stores.get(LARES)!.get(URI)).toBeNull();
    } finally { await r.repo.shutdown(); }
  });
});

describe("seat-canon-reach guards shared tiers only (operator ruling 2026-11-28, fork 1)", () => {
  test("RED: a household's canon takes a seat's disk wave (INGEST); its put still refuses; CONTROL: a shared tier refuses the seat's INGEST", async () => {
    const { refuseSeatCanonReach, seatHouseCanon, houseCanonSlugsSeated } = await import("@lararium/mesh/kahu-canon-reach");
    const seated = houseCanonSlugsSeated();
    try {
      seatHouseCanon(seated, { household: true });
      expect(() => refuseSeatCanonReach(LARES, "INGEST", "seat")).not.toThrow();
      expect(() => refuseSeatCanonReach(LARES, "tiddler put", "seat")).toThrow(/seat-canon-reach/);
      seatHouseCanon(seated);
      expect(() => refuseSeatCanonReach(LARES, "INGEST", "seat")).toThrow(/seat-canon-reach/);
    } finally { seatHouseCanon(seated); }
  });
});
