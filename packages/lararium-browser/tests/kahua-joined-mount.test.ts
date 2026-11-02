/**
 * kahua-joined-mount — a joined browser of the face mounts the founder's kahua stage under its own daemon top.
 *
 * The walk runs the real pieces a joined page boots through: the founder's root pins the stage with a signed `plane`
 * act, the admit bundle carries it into the joinee's daemon doc (`runApplyAdmitPayload`), the face proof folds it
 * (`proveFaceFromLog` over `faceRecordsOf`), the adoption reads the pin against the catalog hint (`adoptKahuaPlane`),
 * the island resolves `bags/kahua` from the grant alone (`librarySlotUrl`), and the daemon recipe stacks the device's
 * own top over the stage over canon (`kahuaRecipe`, `buildIslandRecipe`, the `kahuaLayerStore` seam).
 *
 * SECURITY CLASS. Reds: the joinee obtains the founder's stage url from the verified bundle and mounts it; a page
 * draft over a stage title casts the shadow mark; a page write lands in the top, never the stage. Controls: a catalog
 * row naming another stage refuses by name and mounts nothing; a face with no pin boots with the layer absent and the
 * page stands on top + canon.
 *
 * Meme: lar:///ha.ka.ba/lares/docs/pono/kahua-memory-stage
 */
import { describe, expect, test } from "vitest";
import {
  AutomergeDocStore, KAHUA_BAG, KAHUA_PLANE, ORACLE_BAG, actCid, adoptKahuaPlane, adoptedKahuaUrl, ed25519SignerFromSeed,
  ed25519VerifyingKeyFromSeed, emptyLarDoc, faceRecordsOf, groupSecretOpenerFromSeed, kahuaCatalogRow, kahuaRecipe, makeIslandRepo,
  materializeSharedLarDoc, mintFaceAnchor, personaKelBoardDocUrl, personaKelChainForPrefix, proveFaceFromLog, seedDaemonDoc,
  signPersonaAct, storedLarRecord, CompositeStore, wikiSlotUri,
  type ChangeOrigin, type DocHandle, type LarDoc, type SlotUri,
} from "@lararium/mesh";
import { foundTheFace, foundThePlace, runApplyAdmitPayload, runDeviceAdmitEdge } from "@lararium/keyhive";
import { buildIslandRecipe, kahuaShadowOf, librarySlotUrl, type TW5Engine } from "@lararium/tw5";
import { founderAndJoineeActs, frontierFromFoundingSeed } from "../../lararium-keyhive/tests/admit-acts.js";

const key = (seed: Uint8Array) => groupSecretOpenerFromSeed(seed).deviceKey;
const newRepo = () => makeIslandRepo({ syncPort: new MessageChannel().port1 });
const origin: ChangeOrigin = { kind: "canon-hydrate", receipt: "system" };
const rec = (title: string, text: string) => ({ tiddler: { title, text } });
const TOP = wikiSlotUri("daemon", "working");

function fakeTw5(): TW5Engine {
  class FakeTiddler { constructor(readonly fields: Record<string, unknown>) {} getFieldStrings() { return {}; } isEqual() { return false; } }
  return { $tw: { Tiddler: FakeTiddler, rootWidget: { invokeActionsByTag: () => {} },
    wiki: { getTiddlerText: () => "", getTiddler: () => undefined, addTiddler: () => {}, deleteTiddler: () => {}, filterTiddlers: () => [], addEventListener: () => {}, removeEventListener: () => {}, transact: (fn: () => void) => fn() },
    lares: { applyNalu: () => {}, isApplyingNalu: () => false } } } as unknown as TW5Engine;
}

/** A founder pins (or not) a stage, admits the joinee, and the joinee's page boots its daemon recipe under `catalogRow`. */
async function joinedPage(opts: { readonly pin: boolean; readonly catalogRow?: (stageUrl: string) => string }) {
  const founderRepo = newRepo(), joineeRepo = newRepo();
  const founderSeed = new Uint8Array(32).fill(71), signerSeed = new Uint8Array(32).fill(72);
  const atomSeed = new Uint8Array(32).fill(73), joineeAtom = new Uint8Array(32).fill(74);
  const founder = await foundThePlace({ repo: founderRepo, vesselSeed: founderSeed, hearthTrueName: "hearth" });
  const face = await foundTheFace({
    repo: founderRepo, daemonHandle: founder.daemonHandle, placeVerifyingKey: key(founderSeed), vesselDisplayName: "founder",
    binding: { mode: "self-stood", signerSeed }, hearthTrueName: "hearth", nexusPubkey: key(founderSeed), atomSeed,
  });
  const board = await materializeSharedLarDoc(founderRepo, personaKelBoardDocUrl(key(founderSeed)), "board:persona-kel");
  const chain = personaKelChainForPrefix(board.doc(), face.personaKelPrefix)!;
  // The stage as the joinee's replica holds it once synced: one lifted item and one item canon shares.
  const stage = joineeRepo.create<LarDoc>(emptyLarDoc());
  await new AutomergeDocStore(stage, KAHUA_BAG).put(rec("Item", "kahua-item"), origin);
  await new AutomergeDocStore(stage, KAHUA_BAG).put(rec("Both", "kahua-both"), origin);
  const base = await founderAndJoineeActs({ face, signerSeed, founderAtomSeed: atomSeed, joineeKey: key(joineeAtom), chain }) as Array<{ body: { seq: number } }>;
  const last = base.reduce((m, a) => (a.body.seq > m.body.seq ? a : m));
  const pinAct = opts.pin ? [await signPersonaAct({ seq: last.body.seq, cid: actCid(last.body as never) },
    { group: face.personaGroupId, act: "plane", epoch: chain[chain.length - 1]!.seq, fields: { plane: KAHUA_PLANE, url: stage.url } },
    { key: await ed25519VerifyingKeyFromSeed(signerSeed), sign: ed25519SignerFromSeed(signerSeed) })] : [];
  const payload = await runDeviceAdmitEdge({
    signerSeed, joineeVerifyingKey: key(joineeAtom), personaKelPrefix: face.personaKelPrefix, personaKelChain: chain, personaActs: [...base, ...pinAct],
    edgeFrontier: await frontierFromFoundingSeed(signerSeed), hearthTrueName: "hearth", personaGroupId: face.personaGroupId,
    meshCabalDocIdHex: face.meshCabalDocIdHex, syncUrl: null, hearthDaemonUrl: founder.daemonUrl, personaUrl: face.personaUrl,
  });
  const daemonHandle = seedDaemonDoc(joineeRepo);
  const applied = await runApplyAdmitPayload({ repo: joineeRepo, daemonHandle, atomSeed: joineeAtom, vesselDisplayName: "joinee", payload, nexusPubkey: key(founderSeed) });
  // THE PAGE'S BOOT: the face proof over the daemon doc the admit wrote, then the adoption against the catalog hint.
  const anchor = mintFaceAnchor({ personaGroup: face.personaGroupId, personaKelPrefix: face.personaKelPrefix, personaRootDid: face.founderEdge.personaRootDid, edge: applied.deviceEdge, leaseEpoch: 0 });
  const proof = proveFaceFromLog({ records: faceRecordsOf([daemonHandle.doc()], face.personaGroupId), chain, group: face.personaGroupId, anchor,
    deviceKey: key(joineeAtom), planes: { intents: applied.intentsUrl, kahua: applied.kahuaUrl } });
  if (!proof.ok) throw new Error(`face proof refused: ${proof.refusal.why}`);
  const catalog = emptyLarDoc();
  if (opts.catalogRow) (catalog.tiddlers as Record<string, unknown>)[KAHUA_BAG] = storedLarRecord(KAHUA_BAG, { text: opts.catalogRow(stage.url), kind: "oracle" }, "vessel-boot");
  const adoption = adoptKahuaPlane(proof.projection, kahuaCatalogRow(catalog));
  const asked: string[] = [];
  const kahuaUrl = await librarySlotUrl(KAHUA_BAG, { kahuaUrl: adoptedKahuaUrl(adoption) }, async (slot) => { asked.push(slot); return kahuaCatalogRow(catalog); });
  // The daemon recipe: the device's own top, the stage when granted, the canon floor.
  const handles = new Map<SlotUri, DocHandle<LarDoc>>([[ORACLE_BAG, joineeRepo.create<LarDoc>(emptyLarDoc())], [TOP, joineeRepo.create<LarDoc>(emptyLarDoc())]]);
  await new AutomergeDocStore(handles.get(ORACLE_BAG)!, ORACLE_BAG).put(rec("Both", "canon-both"), origin);
  await new AutomergeDocStore(handles.get(ORACLE_BAG)!, ORACLE_BAG).put(rec("OnlyCanon", "canon"), origin);
  if (kahuaUrl) handles.set(KAHUA_BAG, await joineeRepo.find<LarDoc>(kahuaUrl as never));
  const composite = new CompositeStore();
  buildIslandRecipe({ tw5: fakeTw5(), composite, recipe: kahuaRecipe({ wikiSlug: "daemon" }), ready: [...handles].map(([slot, handle]) => ({ slot, handle })) });
  return { applied, adoption, kahuaUrl, asked, composite, stage, stageUrl: stage.url, top: new AutomergeDocStore(handles.get(TOP)!, TOP) };
}

describe("a joined browser mounts the face's kahua stage", () => {
  test("RED: the joinee obtains the founder's stage url from the verified admit bundle and mounts it, never asking the catalog", async () => {
    const p = await joinedPage({ pin: true });
    expect(p.applied.kahuaUrl).toBe(p.stageUrl);
    expect(p.adoption).toEqual({ mount: p.stageUrl });
    expect(p.kahuaUrl).toBe(p.stageUrl);
    expect(p.asked).toEqual([]);
    expect(p.composite.hasBag(KAHUA_BAG)).toBe(true);
    expect((await p.composite.get("Item"))?.tiddler.text).toBe("kahua-item");
    expect((await p.composite.get("Both"))?.tiddler.text).toBe("kahua-both");
  });

  test("RED: a page draft over a stage title casts the shadow mark; a page write lands in the top, never in the stage doc", async () => {
    const p = await joinedPage({ pin: true, catalogRow: (url) => url });
    await p.composite.put(rec("Item", "page-draft"), origin);
    await p.composite.put(rec("Both", "page-edit"), origin, { bag: KAHUA_BAG });
    expect(await kahuaShadowOf(p.composite, "Item")).toEqual({ draftBag: TOP, shared: "kahua-item" });
    expect((await p.top.get("Item"))?.tiddler.text).toBe("page-draft");
    expect((await p.top.get("Both"))?.tiddler.text).toBe("page-edit");
    const stage = new AutomergeDocStore(p.stage, KAHUA_BAG);
    expect((await stage.get("Item"))?.tiddler.text).toBe("kahua-item");
    expect((await stage.get("Both"))?.tiddler.text).toBe("kahua-both");
  });

  test("CONTROL: a catalog row naming another stage than the plane act refuses by name and mounts nothing", async () => {
    const p = await joinedPage({ pin: true, catalogRow: () => "automerge:2fgQ6TqcYk8m4v8T1oS8kqvW7Lm" });
    expect(p.adoption).toMatchObject({ refused: "kahua-catalog-mismatch", pinned: p.stageUrl });
    expect(p.kahuaUrl).toBeNull();
    expect(p.composite.hasBag(KAHUA_BAG)).toBe(false);
    expect((await p.composite.get("Item"))).toBeNull();
  });

  test("CONTROL: a face with no pinned stage boots with the layer absent, by name, and the page stands on top + canon", async () => {
    const p = await joinedPage({ pin: false });
    expect(p.applied.kahuaUrl).toBeNull();
    expect(p.adoption).toEqual({ absent: "kahua-unpinned" });
    expect(p.composite.hasBag(KAHUA_BAG)).toBe(false);
    await p.composite.put(rec("Fresh", "typed"), origin);
    expect((await p.top.get("Fresh"))?.tiddler.text).toBe("typed");
    expect((await p.composite.get("Both"))?.tiddler.text).toBe("canon-both");
    expect((await p.composite.get("OnlyCanon"))?.tiddler.text).toBe("canon");
  });
});
