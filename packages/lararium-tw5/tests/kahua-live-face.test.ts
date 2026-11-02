/**
 * kahua-live-face — a running island folds its kahua layer under the face's LIVE lineage, never the boot's snapshot.
 *
 * The manifest carries the persona KEL chain as it stood at boot; a rotation merged into the island's own replica of the
 * KEL board after boot must reach the next fold, and the wiki must HEAR the items that drop or return. `liveKahuaFace`
 * reads the board replica the manifest names (falling back to the boot chain until the replica holds the face's chain),
 * and its watch wakes the stage store, so the layer re-folds when the lineage moves and not only when the stage doc does.
 *
 * SECURITY CLASS (authority input: the KEL lineage). Reds: a rotation that lands mid-run drops the rotated-out root's
 * items and the subscriber hears each drop; the new root's carry restores them. Controls: before the rotation the item
 * stands; a board change that moves no lineage tells nothing; with no board named, the boot chain decides.
 *
 * Meme: lar:///ha.ka.ba/lares/docs/pono/kahua-memory-stage
 */
import { describe, expect, test } from "vitest";
import {
  CompositeStore, KAHUA_BAG, ORACLE_BAG, attestAndRotate, ed25519SignerFromSeed, ed25519VerifyingKeyFromSeed, emptyLarDoc, kahuaActCid, makeIslandRepo,
  kahuaRecipe, kahuaStageDocUrl, materializeSharedLarDoc, provisionThresholdRecoveryAtFounding, recoveryContactRegistrationCard,
  signKahuaCarry, signKahuaLift, storedLarRecord, wikiSlotUri, writeKahuaAct, writePersonaKelEvent,
  type DocHandle, type LarDoc, type LarTiddlerChange, type SlotUri,
} from "@lararium/mesh";
import * as tw5src from "../src/index.js";
import { buildIslandRecipe, type TW5Engine } from "../src/index.js";

const GROUP = "0x" + "d7".repeat(16);
const seeds = { opA: new Uint8Array(32).fill(41), opB: new Uint8Array(32).fill(42), g1: new Uint8Array(32).fill(43), g2: new Uint8Array(32).fill(44), g3: new Uint8Array(32).fill(45) };
const pubOf = (s: Uint8Array) => ed25519VerifyingKeyFromSeed(s);
const rootOf = async (s: Uint8Array) => ({ key: await pubOf(s), sign: ed25519SignerFromSeed(s) });
type LiveFace = { read: () => unknown; watch: (fn: () => void) => () => void };
const liveKahuaFace = (input: Record<string, unknown>): LiveFace =>
  (tw5src as unknown as { liveKahuaFace: (i: Record<string, unknown>) => LiveFace }).liveKahuaFace(input);

function fakeTw5(): TW5Engine {
  class FakeTiddler { constructor(readonly fields: Record<string, unknown>) {} getFieldStrings() { return {}; } isEqual() { return false; } }
  return { $tw: { Tiddler: FakeTiddler, rootWidget: { invokeActionsByTag: () => {} },
    wiki: { getTiddlerText: () => "", getTiddler: () => undefined, addTiddler: () => {}, deleteTiddler: () => {}, filterTiddlers: () => [], addEventListener: () => {}, removeEventListener: () => {}, transact: (fn: () => void) => fn() },
    lares: { applyNalu: () => {}, isApplyingNalu: () => false } } } as unknown as TW5Engine;
}

async function island(opts: { readonly board: boolean }) {
  const keys = await Promise.all([pubOf(seeds.g1), pubOf(seeds.g2), pubOf(seeds.g3)]);
  const prov = provisionThresholdRecoveryAtFounding({
    foundingOpKeyDid: `0x${await pubOf(seeds.opA)}`,
    recoveryContacts: keys.map((k, i) => recoveryContactRegistrationCard((["mine", "contact-a", "contact-b"] as const)[i]!, k, null)), recoveryThreshold: 2,
  });
  const signer = async (s: Uint8Array) => ({ signer: await pubOf(s), sign: ed25519SignerFromSeed(s) });
  const rot = await attestAndRotate({
    head: prov.inception, freshOpKeyDid: `0x${await pubOf(seeds.opB)}`, recoveryContactKeys: keys, recoveryThreshold: prov.recoveryThreshold,
    recoveryContactSigners: await Promise.all([signer(seeds.g1), signer(seeds.g2)]),
  });
  if (!rot.ok) throw new Error("fixture rotation refused");
  const repo = makeIslandRepo({ syncPort: new MessageChannel().port1 });
  const board = repo.create<LarDoc>(emptyLarDoc());
  board.change((d) => writePersonaKelEvent(d, prov.inception));
  const stage = await materializeSharedLarDoc(repo, kahuaStageDocUrl(GROUP), "kahua:stage");
  const a = await rootOf(seeds.opA), b = await rootOf(seeds.opB);
  const lifted = await signKahuaLift({ group: GROUP, epoch: 0, title: "t", text: "lifted under the founding root", fields: {}, parent: null,
    origin: { seat: a.key, device: a.key, session: "s" }, taint: [], sources: [{ title: "daemon/t", revision: "r" }] }, a);
  stage.change((d) => writeKahuaAct(d, lifted));
  const live = liveKahuaFace({ group: GROUP, prefix: prov.inception.prefix, bootChain: [prov.inception], anchor: null, board: opts.board ? Promise.resolve(board) : null });
  await Promise.resolve(); await Promise.resolve();
  const TOP = wikiSlotUri("daemon", "working");
  const handles = new Map<SlotUri, DocHandle<LarDoc>>([[ORACLE_BAG, repo.create<LarDoc>(emptyLarDoc())], [TOP, repo.create<LarDoc>(emptyLarDoc())], [KAHUA_BAG, stage]]);
  const composite = new CompositeStore();
  const heard: LarTiddlerChange[] = [];
  composite.subscribe((c) => { if (c.title === "t") heard.push(c); });
  buildIslandRecipe({ tw5: fakeTw5(), composite, recipe: kahuaRecipe({ wikiSlug: "daemon" }), ready: [...handles].map(([slot, handle]) => ({ slot, handle })),
    kahuaFace: live.read as never, kahuaFaceWatch: live.watch } as never);
  const rotate = () => board.change((d) => writePersonaKelEvent(d, rot.event));
  const carry = async () => { const act = await signKahuaCarry({ group: GROUP, epoch: 1, carries: [kahuaActCid(lifted)] }, b); stage.change((d) => writeKahuaAct(d, act)); };
  return { composite, heard, rotate, carry, board, stage };
}
const settle = () => new Promise((r) => setTimeout(r, 20));

describe("the kahua layer folds under the live lineage", () => {
  test("RED: a rotation that lands mid-run drops the rotated-out root's item and the subscriber hears the drop; CONTROL: before it the item stands", async () => {
    const i = await island({ board: true });
    expect((await i.composite.get("t"))?.tiddler.text).toBe("lifted under the founding root");
    i.heard.length = 0;
    i.rotate(); await settle();
    expect(await i.composite.get("t")).toBeNull();
    expect(i.heard.map((c) => c.record)).toEqual([null]);
  });

  test("RED: the new root's carry restores the item mid-run; CONTROL: a board change that moves no lineage tells nothing", async () => {
    const i = await island({ board: true });
    i.heard.length = 0;
    i.board.change((d) => { d.tiddlers["unrelated"] = storedLarRecord("unrelated", { text: "x" }, "hand"); }); await settle();
    expect(i.heard).toEqual([]);
    i.rotate(); await settle();
    await i.carry(); await settle();
    expect((await i.composite.get("t"))?.tiddler.text).toBe("lifted under the founding root");
    expect(i.heard.map((c) => c.record === null)).toEqual([true, false]);
  });

  test("CONTROL: with no board named, the boot chain decides, and the item stands", async () => {
    const i = await island({ board: false });
    i.rotate(); await settle();
    expect((await i.composite.get("t"))?.tiddler.text).toBe("lifted under the founding root");
  });
});
