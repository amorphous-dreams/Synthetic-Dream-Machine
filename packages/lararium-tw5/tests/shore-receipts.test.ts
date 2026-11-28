/**
 * RECEIPTS WHERE AN ACT OR A VOTUM MOVES A RECORD; THE CRDT REMEMBERS EVERY HAND (comms-ux-enacts landing 13), over the real
 * island shore: a real TiddlyWiki, the real `IslandAdaptor` and bridge over automerge documents (`wiki-shore-rig`), a scratch
 * store per test.
 *
 * A hand's save and state flicker stamp nothing and digest nothing; a write an act moved answers its receipt to that act; a
 * votum records its handoff on the holder's plane; a carrier's act runs live and its answer carries its receipts; a writing
 * message through an act runs through the rename door; a dry act lands nothing.
 */
import { describe, expect, test } from "vitest";
import type { CompositeStore } from "@lararium/mesh/composite-store";
import { afterDispatch, draftBag, plainDoc, shoreRig, turns, workingBag, type Rig } from "./wiki-shore-rig.js";
import { toLarTiddlerRecord } from "@lararium/mesh/tiddler-store";
import { wikiSkip, skipNote } from "./test-wiki.js";
import { HAND_ACT, shoreRecordHash, shoreRecordHashRuns, type ShoreVotum } from "../src/island-adaptor.js";
import { makeCarrierActReactor, type TiddlerVerbOptions } from "../src/tiddler-verbs.js";
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

/** The fields the store holds for a title in the working layer, as a receipt hashes them. */
function workingFields(r: Rig, title: string): Record<string, string> | null {
  const held = plainDoc(r.workingHandle.doc()).tiddlers[title];
  return held ? Object.fromEntries(Object.entries(held.tiddler).map(([k, v]) => [k, String(v)])) : null;
}

describe.skipIf(wikiSkip)(`receipts where an act or a votum moves a record${skipNote}`, () => {
  test("RED: a burst of 500 hand saves and state flickers stamps zero receipts and computes no receipt digest; CONTROL: they all land", async () => {
    const r = await shoreRig();
    try {
      r.adaptor.wornFace = FACE;
      const handsAsked = r.adaptor.collectReceipts(HAND_ACT);
      const digests = shoreRecordHashRuns();
      for (let i = 0; i < 500; i++) {
        r.wiki.addTiddler(new r.Tiddler({ title: `Burst ${i % 50}`, text: `hand ${i}` }));
        r.wiki.addTiddler(new r.Tiddler({ title: "$:/state/burst/flicker", text: String(i) }));
        r.wiki.addTiddler(new r.Tiddler({ title: "$:/temp/burst/flicker", text: String(i) }));
      }
      await settle(r);
      expect(await handsAsked.done(), "a hand stamps nothing, even where something asks").toEqual([]);
      expect(shoreRecordHashRuns() - digests, "no receipt digest on an ordinary save").toBe(0);
      expect(workingFields(r, "Burst 49")?.["text"]).toBe("hand 499");
    } finally { await r.stop(); }
  }, 120_000);

  test("RED: a write an act moved answers its receipt to that act, the face, the bag and both hashes; CONTROL: an act that asked nothing keeps nothing", async () => {
    const r = await shoreRig();
    try {
      r.adaptor.wornFace = FACE;
      const asked = r.adaptor.collectReceipts("acts/stamp#r9");
      r.adaptor.wearNext("Act note", undefined, "acts/stamp#r9");
      r.wiki.addTiddler(new r.Tiddler({ title: "Act note", text: "by the act" }));
      const receipts = await asked.done();
      expect(receipts).toEqual([expect.objectContaining({ kind: "save", title: "Act note", face: FACE, before: null, bag: workingBag, act: "acts/stamp#r9" })]);
      expect(receipts[0]!.after).toBe(shoreRecordHash(workingFields(r, "Act note")));
      const digests = shoreRecordHashRuns();
      r.adaptor.wearNext("Unasked note", undefined, "acts/other#r2");
      r.wiki.addTiddler(new r.Tiddler({ title: "Unasked note", text: "by an act that asked nothing" }));
      await settle(r);
      expect(shoreRecordHashRuns() - digests, "no act asked, so no digest").toBe(0);
      expect(r.adaptor.collects("acts/other#r2")).toBe(false);
    } finally { await r.stop(); }
  }, 120_000);

  test("RED: the act binds to the value it wrote: a person's hand of the same title before the flush leaves as the hand's, no receipt; CONTROL: with no later hand the act's value answers its receipt", async () => {
    for (const later of [true, false]) {
      const r = await shoreRig();
      try {
        r.unbridge();
        const title = later ? "Shared title" : "Act title";
        const asked = r.adaptor.collectReceipts("acts/stamp#r3");
        r.adaptor.wearNext(title, undefined, "acts/stamp#r3");
        const byAct = new r.Tiddler({ title, text: "by the act" });
        r.wiki.addTiddler(byAct);
        void r.adaptor.saveTiddler(byAct).catch(() => {});
        if (later) {
          const byHand = new r.Tiddler({ title, text: "by a person" });
          r.wiki.addTiddler(byHand);
          void r.adaptor.saveTiddler(byHand).catch(() => {});
        }
        const receipts = await asked.done();
        expect(receipts.filter((receipt) => receipt.title === title), later ? "the person's state answers no act" : "the act's state").toHaveLength(later ? 0 : 1);
      } finally { await r.stop(); }
    }
  }, 120_000);

  test("RED: a write into a layer another face holds saves nothing as the worn face and records its handoff as a votum to the holder; CONTROL: with no holder named, the same write saves", async () => {
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
      expect(vota, "the handoff records on the holder's plane").toEqual([expect.objectContaining({ holder: "face-b", vower: FACE, verb: "tiddler-put", act: HAND_ACT,
        args: expect.objectContaining({ bag: workingBag, title: "Crossing note", fields: expect.objectContaining({ text: "into b's layer" }), create: true }) })]);
      holder = null;
      r.wiki.addTiddler(new r.Tiddler({ title: "Own note", text: "the face's own layer" }));
      await settle(r);
      expect(workingFields(r, "Own note")?.["text"]).toBe("the face's own layer");
    } finally { await r.stop(); }
  }, 120_000);

  test("RED: a surfaced parallel draft bound for a draft bag another face holds rides as a votum there, nothing persisted as the worn face; CONTROL: with no holder it persists", async () => {
    for (const held of [true, false]) {
      const r = await shoreRig();
      try {
        r.adaptor.wornFace = FACE;
        const vota: ShoreVotum[] = [];
        r.adaptor.caps = { ...r.adaptor.caps, custody: { holderOf: (bag) => (held && bag === draftBag ? "face-b" : null), vow: async (votum) => { vota.push(votum); return "votum-draft"; } } };
        const title = "Draft of 'Conflicted' by peer";
        const draft = toLarTiddlerRecord({ title, "draft.of": "Conflicted", "draft.title": "Conflicted", text: "theirs", "lar-conflict-fields": "text", "lar-conflict-live": "" });
        await r.adaptor.onParallelDrafts({ title: "Conflicted", bag: workingBag, drafts: [draft] });
        if (held) {
          expect(plainDoc(r.draftHandle.doc()).tiddlers[title], "nothing persisted as the worn face").toBeUndefined();
          expect(vota).toEqual([expect.objectContaining({ holder: "face-b", verb: "tiddler-put", args: expect.objectContaining({ bag: draftBag, title }) })]);
        } else {
          expect(plainDoc(r.draftHandle.doc()).tiddlers[title]?.tiddler["text"]).toBe("theirs");
          expect(vota).toEqual([]);
        }
      } finally { await r.stop(); }
    }
  }, 120_000);
});

describe.skipIf(wikiSkip)(`a carrier's own act runs live${skipNote}`, () => {
  const ACT = "acts/stamp";

  test("RED: a live act's write lands in the store and its answer carries the receipt naming its act; the bound params ride as variables", async () => {
    const r = await shoreRig();
    try {
      r.wiki.addTiddler(new r.Tiddler({ title: ACT, text: "<$action-setfield $tiddler=<<target>> status=<<status>>/>" }));
      await settle(r);
      seatShore(r.engine, r.adaptor);
      const opts: TiddlerVerbOptions = { composite: r.composite, tw5: r.engine };
      const out = await makeCarrierActReactor(opts)({ act: ACT, address: "lar:///lantern.wick.trims", params: { target: "Acted note", status: "done" } }, ctx("r7"));
      expect(out).toMatchObject({ decision: "acted", act: ACT, wrote: ["Acted note"], receipt: `${ACT}#r7` });
      expect(out["receipts"]).toEqual([expect.objectContaining({ kind: "save", title: "Acted note", act: `${ACT}#r7`, bag: workingBag })]);
      expect(workingFields(r, "Acted note")?.["status"]).toBe("done");
    } finally { await r.stop(); }
  }, 120_000);

  test("RED: a tm-rename-tiddler an act sends runs through the rename door and its answer carries the receipt naming the act", async () => {
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
      expect(out["receipts"]).toEqual(expect.arrayContaining([expect.objectContaining({ kind: "save", title: "New name", act: "acts/rename#r8" })]));
      expect(workingFields(r, "New name")?.["text"]).toBe("moves");
    } finally { await r.stop(); }
  }, 120_000);

  test("RED: a dry act lands nothing: it lists the write it would make and runs no message; CONTROL: the wiki and the store stay as they stood", async () => {
    const r = await shoreRig();
    try {
      r.wiki.addTiddler(new r.Tiddler({ title: ACT, text: "<$action-setfield $tiddler=<<target>> status=\"done\"/><$action-sendmessage $message=\"tm-notify\" $param=\"Elsewhere\"/>" }));
      await settle(r);
      const calls = r.calls.length;
      seatShore(r.engine, r.adaptor);
      const opts: TiddlerVerbOptions = { composite: r.composite, tw5: r.engine };
      const out = await makeCarrierActReactor(opts)({ act: ACT, params: { target: "Dry note" }, dry: "summary" }, ctx());
      expect(out).toMatchObject({ decision: "dry", writes: [{ title: "Dry note", fields: expect.objectContaining({ status: "done" }) }],
        messages: [expect.objectContaining({ type: "tm-notify" })] });
      expect(out).not.toHaveProperty("receipts");
      await settle(r);
      expect(r.wiki.getTiddler("Dry note")).toBeUndefined();
      expect(r.calls.length).toBe(calls);
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
