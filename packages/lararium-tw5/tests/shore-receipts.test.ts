/**
 * THE RECEIPT AT THE SHORE AND THE CARRIER'S OWN ACT (comms-ux-enacts landing 13), over the real island shore: a real
 * TiddlyWiki, the real `IslandAdaptor` and bridge over automerge documents (`wiki-shore-rig`), a scratch store per test.
 *
 * Every write the shore makes stamps a receipt (face, title, hash before and after, bag, the act that moved it), whatever
 * path wrote; a carrier's act runs live on the engine and its writes read as that act; a writing message through an act runs
 * through the rename door and leaves its receipt; a dry act lands nothing; a write into another face's layer rides as a votum.
 */
import { describe, expect, test } from "vitest";
import type { CompositeStore } from "@lararium/mesh/composite-store";
import { afterDispatch, plainDoc, shoreRig, turns, workingBag, type Rig } from "./wiki-shore-rig.js";
import { wikiSkip, skipNote } from "./test-wiki.js";
import { HAND_ACT, shoreRecordHash, type ShoreVotum } from "../src/island-adaptor.js";
import { makeCarrierActReactor, makeTiddlerPutReactor, type TiddlerVerbOptions } from "../src/tiddler-verbs.js";
import { seatShore } from "../src/island-recipe.js";
import type { VerbContext } from "../src/verb-dispatcher.js";

const FACE = "face-a";
const ctx = (requestId = "r1"): VerbContext => ({
  daemon: {} as CompositeStore,
  invocation: { requestId, action: "call" } as VerbContext["invocation"],
  cap: async () => ({ ok: true }),
});

/** Let the wiki's dispatch reach the bridge, the drain write every owed title, and the store's own waves land back. */
async function settle(r: Rig): Promise<void> {
  await afterDispatch();
  await r.adaptor.boundary();
  await turns();
}

/** The shore's receipts for one title. */
const receiptsOf = (r: Rig, title: string) => r.adaptor.receipts().filter((receipt) => receipt.title === title);

/** The fields the store holds for a title in the working layer, as a receipt hashes them. */
function workingFields(r: Rig, title: string): Record<string, string> | null {
  const held = plainDoc(r.workingHandle.doc()).tiddlers[title];
  return held ? Object.fromEntries(Object.entries(held.tiddler).map(([k, v]) => [k, String(v)])) : null;
}

describe.skipIf(wikiSkip)(`the receipt at the shore${skipNote}`, () => {
  test("RED: a hand in the wiki saves with a receipt naming the engine's worn face, no prior hash, the hash that left and `hand`; a delete names the hash it replaced", async () => {
    const r = await shoreRig();
    try {
      r.adaptor.wornFace = FACE;
      r.wiki.addTiddler(new r.Tiddler({ title: "Plain note", text: "first" }));
      await settle(r);
      const [save] = receiptsOf(r, "Plain note");
      expect(save).toMatchObject({ kind: "save", title: "Plain note", face: FACE, before: null, bag: workingBag, act: HAND_ACT });
      expect(save!.after).toBe(shoreRecordHash(workingFields(r, "Plain note")));
      r.wiki.deleteTiddler("Plain note");
      await settle(r);
      const gone = receiptsOf(r, "Plain note").at(-1);
      expect(gone).toMatchObject({ kind: "delete", face: FACE, before: save!.after, after: null, act: HAND_ACT });
    } finally { await r.stop(); }
  }, 120_000);

  test("RED: a write a door names its act for carries that act on its receipt; CONTROL: the next hand of the title names `hand` again", async () => {
    const r = await shoreRig();
    try {
      // The rig's documents hold no face actor door, so the door names no face here and the receipt names the engine's.
      r.adaptor.wornFace = FACE;
      r.adaptor.wearNext("Door note", undefined, "tiddler-put#r9");
      r.wiki.addTiddler(new r.Tiddler({ title: "Door note", text: "by the door" }));
      await settle(r);
      expect(receiptsOf(r, "Door note")).toEqual([expect.objectContaining({ kind: "save", face: FACE, act: "tiddler-put#r9" })]);
      r.wiki.addTiddler(new r.Tiddler({ title: "Door note", text: "by hand" }));
      await settle(r);
      expect(receiptsOf(r, "Door note").at(-1)).toMatchObject({ kind: "save", act: HAND_ACT });
    } finally { await r.stop(); }
  }, 120_000);

  test("RED: the act binds to the value it wrote: a person's hand of the same title before the flush stamps as `hand`; CONTROL: with no later hand the act's own value stamps as the act", async () => {
    for (const later of [true, false]) {
      const r = await shoreRig();
      try {
        r.unbridge();
        const title = later ? "Shared title" : "Act title";
        r.adaptor.wearNext(title, undefined, "acts/stamp#r3");
        const byAct = new r.Tiddler({ title, text: "by the act" });
        r.wiki.addTiddler(byAct);
        void r.adaptor.saveTiddler(byAct).catch(() => {});
        if (later) {
          const byHand = new r.Tiddler({ title, text: "by a person" });
          r.wiki.addTiddler(byHand);
          void r.adaptor.saveTiddler(byHand).catch(() => {});
        }
        await r.adaptor.boundary();
        expect(receiptsOf(r, title).at(-1), later ? "the person's state" : "the act's state").toMatchObject({ kind: "save", act: later ? HAND_ACT : "acts/stamp#r3" });
      } finally { await r.stop(); }
    }
  }, 120_000);

  test("RED: a bag= put passes by the shore and still stamps a receipt naming its act and hashes", async () => {
    const r = await shoreRig();
    try {
      seatShore(r.engine, r.adaptor);
      r.adaptor.wornFace = FACE;
      const opts: TiddlerVerbOptions = { composite: r.composite, tw5: r.engine };
      const out = await makeTiddlerPutReactor(opts)({ bag: workingBag, title: "Bag note", text: "through the bag" }, ctx("r5"));
      expect(out).toMatchObject({ decision: "put", bag: workingBag });
      expect(receiptsOf(r, "Bag note")).toEqual([expect.objectContaining({ kind: "save", face: FACE, before: null, after: out["hash"], bag: workingBag, act: "call#r5" })]);
    } finally { await r.stop(); }
  }, 120_000);

  test("RED: a write into a layer another face holds saves nothing as the worn face and rides as a votum to the holder; CONTROL: with no holder named, the same write saves", async () => {
    const r = await shoreRig();
    try {
      r.adaptor.wornFace = FACE;
      const vota: ShoreVotum[] = [];
      let holder: string | null = "face-b";
      r.adaptor.caps = { ...r.adaptor.caps, custody: { holderOf: (bag) => (bag === workingBag ? holder : null), vow: async (votum) => { vota.push(votum); return `votum-${vota.length}`; } } };
      r.wiki.addTiddler(new r.Tiddler({ title: "Crossing note", text: "into b's layer" }));
      await settle(r);
      expect(r.calls.filter((call) => call.puts.includes("Crossing note")), "nothing saves as the worn face").toEqual([]);
      expect(plainDoc(r.workingHandle.doc()).tiddlers["Crossing note"]).toBeUndefined();
      expect(vota).toEqual([expect.objectContaining({ holder: "face-b", vower: FACE, verb: "tiddler-put", act: HAND_ACT,
        args: expect.objectContaining({ bag: workingBag, title: "Crossing note", fields: expect.objectContaining({ text: "into b's layer" }), create: true }) })]);
      expect(receiptsOf(r, "Crossing note")).toEqual([expect.objectContaining({ kind: "votum", face: FACE, bag: workingBag, votum: { id: "votum-1", holder: "face-b" } })]);
      holder = null;
      r.wiki.addTiddler(new r.Tiddler({ title: "Own note", text: "the face's own layer" }));
      await settle(r);
      expect(workingFields(r, "Own note")?.["text"]).toBe("the face's own layer");
      expect(receiptsOf(r, "Own note")).toEqual([expect.objectContaining({ kind: "save", face: FACE })]);
    } finally { await r.stop(); }
  }, 120_000);
});

describe.skipIf(wikiSkip)(`a carrier's own act runs live${skipNote}`, () => {
  const ACT = "acts/stamp";

  test("RED: a live act's write lands in the store with a receipt naming its act; the bound params ride as variables", async () => {
    const r = await shoreRig();
    try {
      r.wiki.addTiddler(new r.Tiddler({ title: ACT, text: "<$action-setfield $tiddler=<<target>> status=<<status>>/>" }));
      await settle(r);
      seatShore(r.engine, r.adaptor);
      const opts: TiddlerVerbOptions = { composite: r.composite, tw5: r.engine };
      const out = await makeCarrierActReactor(opts)({ act: ACT, address: "lar:///lantern.wick.trims", params: { target: "Acted note", status: "done" } }, ctx("r7"));
      expect(out).toMatchObject({ decision: "acted", act: ACT, wrote: ["Acted note"], receipt: `${ACT}#r7` });
      await settle(r);
      expect(workingFields(r, "Acted note")?.["status"]).toBe("done");
      expect(receiptsOf(r, "Acted note")).toEqual([expect.objectContaining({ kind: "save", act: `${ACT}#r7`, bag: workingBag })]);
    } finally { await r.stop(); }
  }, 120_000);

  test("RED: a tm-rename-tiddler an act sends runs through the rename door and leaves a receipt naming the act", async () => {
    const r = await shoreRig();
    try {
      r.wiki.addTiddler(new r.Tiddler({ title: "Old name", text: "moves" }));
      r.wiki.addTiddler(new r.Tiddler({ title: "acts/rename", text: "<$action-sendmessage $message=\"tm-rename-tiddler\" from=<<from>> to=<<to>>/>" }));
      await settle(r);
      expect(r.wiki.getTiddler("Old name")?.fields["$origin-bag"], "the record rests in the working layer by its stamp").toBe(workingBag);
      seatShore(r.engine, r.adaptor);
      const opts: TiddlerVerbOptions = { composite: r.composite, tw5: r.engine };
      const out = await makeCarrierActReactor(opts)({ act: "acts/rename", params: { from: "Old name", to: "New name" } }, ctx("r8"));
      expect(out["messages"]).toEqual([expect.objectContaining({ type: "tm-rename-tiddler", from: "Old name", to: "New name", decision: "renamed" })]);
      await settle(r);
      expect(workingFields(r, "New name")?.["text"]).toBe("moves");
      expect(receiptsOf(r, "New name").at(-1)).toMatchObject({ kind: "save", act: "acts/rename#r8" });
    } finally { await r.stop(); }
  }, 120_000);

  test("RED: a dry act lands nothing: it lists the write it would make and runs no message; CONTROL: the wiki and the store stay as they stood", async () => {
    const r = await shoreRig();
    try {
      r.wiki.addTiddler(new r.Tiddler({ title: ACT, text: "<$action-setfield $tiddler=<<target>> status=\"done\"/><$action-sendmessage $message=\"tm-rename-tiddler\" from=<<target>> to=\"Elsewhere\"/>" }));
      await settle(r);
      const before = r.adaptor.receipts().length;
      const calls = r.calls.length;
      seatShore(r.engine, r.adaptor);
      const opts: TiddlerVerbOptions = { composite: r.composite, tw5: r.engine };
      const out = await makeCarrierActReactor(opts)({ act: ACT, params: { target: "Dry note" }, dry: "summary" }, ctx());
      expect(out).toMatchObject({ decision: "dry", writes: [{ title: "Dry note", fields: expect.objectContaining({ status: "done" }) }],
        messages: [expect.objectContaining({ type: "tm-rename-tiddler", to: "Elsewhere" })] });
      await settle(r);
      expect(r.wiki.getTiddler("Dry note")).toBeUndefined();
      expect(r.wiki.getTiddler("Elsewhere")).toBeUndefined();
      expect(r.calls.length).toBe(calls);
      expect(r.adaptor.receipts().length).toBe(before);
    } finally { await r.stop(); }
  }, 120_000);

  test("RED: an act no tiddler holds refuses act-missing with a cure naming the carrier's skins", async () => {
    const r = await shoreRig();
    try {
      seatShore(r.engine, r.adaptor);
      const opts: TiddlerVerbOptions = { composite: r.composite, tw5: r.engine };
      await expect(makeCarrierActReactor(opts)({ act: "acts/none", address: "lar:///lantern.wick.trims" }, ctx()))
        .rejects.toThrow(/act-missing: .*cure: <<~ get title=`lar:\/\/\/lantern\.wick\.trims#\/skins`>>/);
    } finally { await r.stop(); }
  }, 120_000);
});
