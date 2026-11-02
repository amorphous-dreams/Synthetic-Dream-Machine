/**
 * The kahua recipe — the daemon wiki stacks the face's lift-only kahua bag between its private top and the canon.
 *
 * Reads TOP-DOWN: the daemon working layer (writable), the daemon bag, the kahua bag (lift-only: read-only
 * here, a write copies up into the top; it serves the stage's verified fold, never the doc's titles), the
 * library floor. A device before its face's kahua exists boots with the layer absent.
 *
 * Canon: lar:///ha.ka.ba/lares/docs/pono/kahua-memory-stage#/the-recipe
 */
import { describe, test, expect } from "vitest";
import { createRequire } from "node:module";
import { buildIslandRecipe } from "../src/island-recipe.js";
import { openDaemonVmCore, type DaemonVmHost } from "../src/daemon-vm-core.js";
import {
  CompositeStore, AutomergeDocStore, emptyLarDoc, expandRecipe, kahuaRecipe, slotLayerFlags, wikiBagUri, wikiSlotUri, KAHUA_BAG, ORACLE_BAG,
  ed25519SignerFromSeed, ed25519VerifyingKeyFromSeed, kahuaStageDocUrl, materializeSharedLarDoc, signKahuaLift, storedLarRecord, writeKahuaAct, kahuaStageStore,
} from "@lararium/mesh";
import type { ChangeOrigin, DocHandle, IslandMsg_Manifest, LarDoc, Repo as RepoType, SlotUri } from "@lararium/mesh";
import type { TW5Engine } from "../src/tw5-vm.js";

const Repo = createRequire(import.meta.resolve("@lararium/mesh"))("@automerge/automerge-repo").Repo as new (options: { sharePolicy?: () => Promise<boolean> }) => RepoType;
const origin: ChangeOrigin = { kind: "canon-hydrate", receipt: "system" };
const rec = (title: string, text: string) => ({ tiddler: { title, text } });
const WORKING = wikiSlotUri("daemon", "working");

function fakeTw5(): TW5Engine {
  class FakeTiddler { constructor(readonly fields: Record<string, unknown>) {} getFieldStrings() { return {}; } isEqual() { return false; } }
  return { $tw: { Tiddler: FakeTiddler, rootWidget: { invokeActionsByTag: () => {} },
    wiki: { getTiddlerText: () => "", getTiddler: () => undefined, addTiddler: () => {}, deleteTiddler: () => {}, filterTiddlers: () => [], addEventListener: () => {}, removeEventListener: () => {}, transact: (fn: () => void) => fn() },
    lares: { applyNalu: () => {}, isApplyingNalu: () => false } } } as unknown as TW5Engine;
}

const FACE = "0x" + "6b".repeat(16);

/** The stage stood the way a device holds it: the face's derived doc carrying root-signed lifts, plus whatever a hand wrote. */
async function standStage() {
  const repo = new Repo({ sharePolicy: async () => true });
  const rootSeed = new Uint8Array(32).fill(21), atomSeed = new Uint8Array(32).fill(22);
  const root = { key: await ed25519VerifyingKeyFromSeed(rootSeed), sign: ed25519SignerFromSeed(rootSeed) };
  const atom = await ed25519VerifyingKeyFromSeed(atomSeed);
  const stage = await materializeSharedLarDoc(repo, kahuaStageDocUrl(FACE), "kahua");
  const lift = async (title: string, text: string) => {
    const act = await signKahuaLift({ group: FACE, epoch: 0, title, text, fields: {}, parent: null,
      origin: { seat: atom, device: atom, session: "s" }, taint: [], sources: [{ title: `daemon/${title}`, revision: "r" }] }, root);
    stage.change((d) => writeKahuaAct(d, act));
  };
  const hand = (title: string, text: string) => stage.change((d) => { d.tiddlers[title] = storedLarRecord(title, { title, text }, "hand"); });
  const face = { group: FACE, grant: (key: string) => key === root.key };
  return { repo, stage, lift, hand, face };
}

/** A recipe stood over real doc handles: canon floor, the face's stage when `withKahua` (its items lifted), and the writable top. */
async function stand(withKahua: boolean) {
  const { repo, stage, lift, face } = await standStage();
  const handles = new Map<SlotUri, DocHandle<LarDoc>>();
  for (const slot of [ORACLE_BAG, WORKING] as SlotUri[]) handles.set(slot, repo.create<LarDoc>(emptyLarDoc()));
  handles.set(KAHUA_BAG, stage);
  const store = (slot: SlotUri) => new AutomergeDocStore(handles.get(slot)!, slot);
  await store(ORACLE_BAG).put(rec("OnlyCanon", "canon"), origin);
  await store(ORACLE_BAG).put(rec("Both", "canon-both"), origin);
  await lift("Both", "kahua-both");
  await lift("Item", "kahua-item");
  await store(WORKING).put(rec("Item", "draft-item"), origin);
  const composite = new CompositeStore();
  const ready = [...handles].filter(([slot]) => withKahua || slot !== KAHUA_BAG).map(([slot, handle]) => ({ slot, handle }));
  buildIslandRecipe({ tw5: fakeTw5(), composite, recipe: kahuaRecipe({ wikiSlug: "daemon" }), ready, kahuaFace: () => face });
  const kahua = kahuaStageStore({ handle: stage, face: () => face });
  return { composite, store, repo, kahua };
}

describe("the kahua layer reads the fold", () => {
  test("RED: a plain tiddler a synced member writes into the stage never reads through the recipe; CONTROL: a lifted item reads and shadows canon", async () => {
    const { repo, stage, lift, hand, face } = await standStage();
    const floor = repo.create<LarDoc>(emptyLarDoc());
    await new AutomergeDocStore(floor, ORACLE_BAG).put(rec("Lifted", "canon-lifted"), origin);
    await lift("Lifted", "kahua-lifted");
    hand("Poison", "a member's raw write");
    const composite = new CompositeStore();
    buildIslandRecipe({ tw5: fakeTw5(), composite, recipe: kahuaRecipe({ wikiSlug: "daemon" }), kahuaFace: () => face,
      ready: [{ slot: ORACLE_BAG, handle: floor }, { slot: KAHUA_BAG, handle: stage }] });
    expect(await composite.get("Poison")).toBeNull();
    expect((await composite.listVisible()).filter((t) => t.startsWith("lar:///ha.ka.ba/dreamnet/kahua-act/"))).toEqual([]);
    expect((await composite.get("Lifted"))?.tiddler.text).toBe("kahua-lifted");
    expect((await composite.resolveTopmost("Lifted"))?.bagId).toBe(KAHUA_BAG);
    await repo.shutdown();
  });

  test("GUARD: an island that reads no face mounts the stage empty, and the canon floor still reads", async () => {
    const { repo, stage, lift } = await standStage();
    const floor = repo.create<LarDoc>(emptyLarDoc());
    await new AutomergeDocStore(floor, ORACLE_BAG).put(rec("Lifted", "canon-lifted"), origin);
    await lift("Lifted", "kahua-lifted");
    const composite = new CompositeStore();
    buildIslandRecipe({ tw5: fakeTw5(), composite, recipe: kahuaRecipe({ wikiSlug: "daemon" }),
      ready: [{ slot: ORACLE_BAG, handle: floor }, { slot: KAHUA_BAG, handle: stage }] });
    expect((await composite.get("Lifted"))?.tiddler.text).toBe("canon-lifted");
    await repo.shutdown();
  });
});

describe("the kahua recipe stacks top, kahua, canon", () => {
  test("the recipe lays the kahua bag between the daemon bag and the oracle floor", () => {
    const slots = expandRecipe(kahuaRecipe({ wikiSlug: "daemon" }));
    expect(slots.indexOf(WORKING)).toBeLessThan(slots.indexOf(wikiBagUri("daemon")));
    expect(slots.indexOf(wikiBagUri("daemon"))).toBeLessThan(slots.indexOf(KAHUA_BAG));
    expect(slots.indexOf(KAHUA_BAG)).toBeLessThan(slots.indexOf(ORACLE_BAG));
    expect(slotLayerFlags(KAHUA_BAG, "daemon").writable).toBe(false);
    expect(kahuaRecipe(kahuaRecipe({ wikiSlug: "daemon" }))).toEqual(kahuaRecipe({ wikiSlug: "daemon" }));
  });

  test("(1) a title present only in canon reads through the recipe", async () => {
    const { composite, repo } = await stand(true);
    expect((await composite.get("OnlyCanon"))?.tiddler.text).toBe("canon");
    await repo.shutdown();
  });

  test("(2) a title in the kahua bag shadows canon", async () => {
    const { composite, repo } = await stand(true);
    expect((await composite.get("Both"))?.tiddler.text).toBe("kahua-both");
    expect((await composite.resolveTopmost("Both"))?.bagId).toBe(KAHUA_BAG);
    await repo.shutdown();
  });

  test("(3) a draft in the top shadows the kahua item and the probe names both bags", async () => {
    const { composite, repo } = await stand(true);
    expect((await composite.get("Item"))?.tiddler.text).toBe("draft-item");
    const all = await composite.resolveAll("Item");
    expect(all.map((e) => e.bagId)).toEqual([WORKING, KAHUA_BAG]);
    await repo.shutdown();
  });

  test("(4) a write through the recipe lands in the top, never in the kahua bag", async () => {
    const { composite, store, repo, kahua } = await stand(true);
    await composite.put(rec("Fresh", "typed"), origin);
    await composite.put(rec("Both", "edited"), origin, { bag: KAHUA_BAG });
    expect((await store(WORKING).get("Fresh"))?.tiddler.text).toBe("typed");
    expect((await store(WORKING).get("Both"))?.tiddler.text).toBe("edited");
    expect(await kahua.get("Fresh")).toBeNull();
    expect((await kahua.get("Both"))?.tiddler.text).toBe("kahua-both");
    await repo.shutdown();
  });

  test("CONTROL: with no kahua bag registered the recipe stands and reads top + canon", async () => {
    const { composite, repo } = await stand(false);
    expect(composite.hasBag(KAHUA_BAG)).toBe(false);
    expect((await composite.get("Item"))?.tiddler.text).toBe("draft-item");
    expect((await composite.get("Both"))?.tiddler.text).toBe("canon-both");
    expect((await composite.get("OnlyCanon"))?.tiddler.text).toBe("canon");
    await repo.shutdown();
  });

  test("the daemon VM manifest carries the kahua bag in its recipe, ahead of crossroads", async () => {
    const repo = new Repo({ sharePolicy: async () => true });
    const daemonHandle = repo.create<LarDoc>(emptyLarDoc());
    const ports: MessagePort[] = [];
    const posted: IslandMsg_Manifest[] = [];
    const host: DaemonVmHost = {
      spawnWorker: () => ({ post: (msg) => { posted.push(msg as IslandMsg_Manifest); }, listen: () => () => {}, onError: () => () => {}, terminate: () => {} }),
      newSyncChannel: () => { const { port1, port2 } = new MessageChannel(); ports.push(port1, port2); return { mainPort: port1 as IslandMsg_Manifest["syncPort"], syncPort: port2 as IslandMsg_Manifest["syncPort"] }; },
    };
    const core = openDaemonVmCore(host, { repo, daemonHandle, recipe: { wikiSlug: "daemon" }, grants: { islandUrl: daemonHandle.url }, coreHash: null, workerScriptUrl: new URL("file:///unused"), eaSilenceMs: 2 ** 30 });
    core.workerEa.catch(() => {});
    try {
      await new Promise((r) => setTimeout(r, 10));
      const libs = posted[0]?.recipe.libraryBags ?? [];
      expect(libs[0]).toBe(KAHUA_BAG);
      expect(libs.length).toBeGreaterThan(1);
    } finally { core.dispose(); ports.forEach((p) => p.close()); await repo.shutdown(); }
  });
});
