/**
 * A residency MOVE whose source record stands as a tombstone carries that tombstone down. Into a bag that
 * holds the title the delete takes place there and the source tombstone retracts; into a bag that holds
 * nothing the move refuses by name unless the hand asks for a shadow; the tombstone stays an ordinary
 * record naming the title alone.
 */
import { describe, expect, test } from "vitest";
import { Repo } from "./wiki-shore-rig.js";
import { AutomergeDocStore, CompositeStore, emptyLarDoc, type Verb } from "@lararium/mesh";
import { makeActionReactorFor, TombstoneTargetHoldsNothingRefusal } from "../src/action-handler.js";
import { makeResolveReactor } from "../src/worker-data-verbs.js";
import type { VerbContext } from "../src/verb-dispatcher.js";

const canonBag = "lar:///test/canon";
const workingBag = "lar:///test/working";
const otherBag = "lar:///test/other";
const live = (title: string) => ({ tiddler: { title, text: title }, meta: { changeId: `change:${title}` } });
const hand = { kind: "tw-local", instanceId: "test" } as const;

async function rig() {
  const repo = new Repo({ network: [] });
  const stores = new Map<string, AutomergeDocStore>();
  const composite = new CompositeStore();
  for (const bag of [canonBag, workingBag, otherBag]) {
    const store = new AutomergeDocStore(repo.create(emptyLarDoc()), bag);
    stores.set(bag, store);
    composite.addLayer({ bagId: bag, store, writable: true, defaultWritable: bag === workingBag });
  }
  const reactor = makeActionReactorFor("MOVE", { composite });
  const run = async (from: string, to: string, title = "T", shadow = false, dryRun = false) => {
    const invocation = { requestId: "move-request", title: "move", action: "MOVE", args: {}, targets: [], batchMode: "best-effort", status: "pending", requestedBy: "test", requestedAt: "2026-10-12" } as unknown as Verb;
    const ctx = { daemon: composite, invocation, cap: async () => ({ ok: true }) } as unknown as VerbContext;
    return reactor({ title, "from-bag": from, "to-bag": to, "change-id": "move-change", ...(shadow ? { shadow: true } : {}), ...(dryRun ? { "dry-run": true } : {}) }, ctx);
  };
  return { repo, stores, composite, run };
}

describe("MOVE carries an ordinary tombstone to the chosen holder", () => {
  test("the destination CRDT takes the delete and the source tombstone retracts", async () => {
    const r = await rig();
    try {
      await r.stores.get(canonBag)!.put(live("T"), { kind: "tw-local", instanceId: "test" });
      await r.stores.get(workingBag)!.tombstone("T", hand);
      const before = r.stores.get(canonBag)!.headsNow();
      const result = await r.run(workingBag, canonBag);
      expect(result).toMatchObject({ carried: "tombstone", moved: 1, shadow: false });
      expect(r.stores.get(canonBag)!.headsNow()).not.toEqual(before);
      expect(await r.stores.get(canonBag)!.get("T")).toMatchObject({ meta: { deleted: true } });
      expect(await r.stores.get(workingBag)!.get("T")).toBeNull();
      expect(await r.composite.resolveLayered("T")).toMatchObject({ bagId: canonBag, record: { meta: { deleted: true } } });

      // CONTROL: a live record still moves as a live record and its source retracts to absent.
      await r.stores.get(workingBag)!.put(live("L"), hand);
      const control = await r.run(workingBag, canonBag, "L");
      expect(control).not.toHaveProperty("carried");
      expect(await r.stores.get(canonBag)!.get("L")).toMatchObject({ tiddler: { text: "L" } });
      expect((await r.stores.get(canonBag)!.get("L"))?.meta?.deleted).not.toBe(true);
      expect(await r.stores.get(workingBag)!.get("L")).toBeNull();
      // CONTROL: a shadow ask on a live source refuses by name.
      await r.stores.get(workingBag)!.put(live("L2"), hand);
      await expect(r.run(workingBag, otherBag, "L2", true)).rejects.toMatchObject({ name: "ShadowRequiresTombstoneRefusal" });
    } finally { await r.repo.shutdown(); }
  });

  test("an empty target refuses before any bag heads move", async () => {
    const r = await rig();
    try {
      await r.stores.get(canonBag)!.put(live("T"), { kind: "tw-local", instanceId: "test" });
      await r.stores.get(workingBag)!.tombstone("T", hand);
      const heads = [canonBag, workingBag, otherBag].map((bag) => r.stores.get(bag)!.headsNow());
      await expect(r.run(workingBag, otherBag)).rejects.toMatchObject({
        name: "TombstoneTargetHoldsNothingRefusal",
        message: expect.stringContaining("this bag does not hold the title; to hide it for everyone who composes this bag above its holders, ask for a shadow (--shadow)"),
      });
      expect([canonBag, workingBag, otherBag].map((bag) => r.stores.get(bag)!.headsNow())).toEqual(heads);
    } finally { await r.repo.shutdown(); }
  });

  test("an explicit shadow hides the lower live record only in its composition", async () => {
    const r = await rig();
    try {
      await r.stores.get(canonBag)!.put(live("T"), { kind: "tw-local", instanceId: "test" });
      await r.stores.get(workingBag)!.tombstone("T", hand);
      await r.run(workingBag, otherBag, "T", true);
      expect(await r.stores.get(otherBag)!.get("T")).toMatchObject({ meta: { deleted: true } });
      expect(await r.stores.get(workingBag)!.get("T")).toBeNull();
      const shadowed = new CompositeStore();
      shadowed.addLayer({ bagId: canonBag, store: r.stores.get(canonBag)!, writable: false });
      shadowed.addLayer({ bagId: otherBag, store: r.stores.get(otherBag)!, writable: false });
      expect(await shadowed.getLive("T")).toBeNull();
      expect(await makeResolveReactor(shadowed)({ tiddler: "T" }, {} as VerbContext)).toMatchObject({ hiddenBy: otherBag, winningBag: null });
      const unshadowed = new CompositeStore();
      unshadowed.addLayer({ bagId: canonBag, store: r.stores.get(canonBag)!, writable: false });
      expect(await unshadowed.getLive("T")).toMatchObject({ tiddler: { title: "T" } });
    } finally { await r.repo.shutdown(); }
  });

  test("the named refusal exposes its stable code", () => {
    expect(new TombstoneTargetHoldsNothingRefusal("T", otherBag).code).toBe("TOMBSTONE_TARGET_HOLDS_NOTHING");
  });

  test("the source tombstone group follows the root into the destination", async () => {
    const r = await rig();
    try {
      for (const title of ["R", "R#/a", "R#/b"]) {
        await r.stores.get(canonBag)!.put(live(title), { kind: "tw-local", instanceId: "test" });
        await r.stores.get(workingBag)!.tombstone(title, hand);
      }
      const result = await r.run(workingBag, canonBag, "R");
      expect(result).toMatchObject({ moved: 3, carried: "tombstone" });
      for (const title of ["R", "R#/a", "R#/b"]) {
        expect(await r.stores.get(canonBag)!.get(title)).toMatchObject({ meta: { deleted: true } });
        expect(await r.stores.get(workingBag)!.get(title)).toBeNull();
      }
    } finally { await r.repo.shutdown(); }
  });

  test("a tombstoned member the target does not hold stays in the source and the answer names it", async () => {
    const r = await rig();
    try {
      for (const title of ["R", "R#/a"]) await r.stores.get(canonBag)!.put(live(title), hand);
      for (const title of ["R", "R#/a", "R#/only-in-source"]) await r.stores.get(workingBag)!.tombstone(title, hand);
      const result = await r.run(workingBag, canonBag, "R");
      expect(result).toMatchObject({ moved: 2, carried: "tombstone", left: ["R#/only-in-source"] });
      expect(await r.stores.get(canonBag)!.get("R#/only-in-source"), "the target takes no tombstone for a title it never held").toBeNull();
      expect(await r.stores.get(workingBag)!.get("R#/only-in-source")).toMatchObject({ meta: { deleted: true } });
      expect(await r.stores.get(workingBag)!.get("R#/a")).toBeNull();
    } finally { await r.repo.shutdown(); }
  });

  test("a move naming one bag as source and target refuses by name and writes nothing", async () => {
    const r = await rig();
    try {
      await r.stores.get(canonBag)!.put(live("T"), hand);
      await r.stores.get(workingBag)!.tombstone("T", hand);
      await r.stores.get(workingBag)!.put(live("L"), hand);
      const heads = [canonBag, workingBag].map((bag) => r.stores.get(bag)!.headsNow());
      await expect(r.run(workingBag, workingBag)).rejects.toMatchObject({ name: "MoveWithinOneBagRefusal" });
      await expect(r.run(workingBag, workingBag, "L")).rejects.toMatchObject({ name: "MoveWithinOneBagRefusal" });
      expect([canonBag, workingBag].map((bag) => r.stores.get(bag)!.headsNow())).toEqual(heads);
      expect(await r.stores.get(workingBag)!.get("L")).toMatchObject({ tiddler: { text: "L" } });
    } finally { await r.repo.shutdown(); }
  });

  test("dry-run captures destination tombstones and source retracts without moving heads", async () => {
    const r = await rig();
    try {
      await r.stores.get(canonBag)!.put(live("T"), { kind: "tw-local", instanceId: "test" });
      await r.stores.get(workingBag)!.tombstone("T", hand);
      const heads = [canonBag, workingBag].map((bag) => r.stores.get(bag)!.headsNow());
      const result = await r.run(workingBag, canonBag, "T", false, true);
      expect(result).toMatchObject({ carried: "tombstone", wouldTombstone: ["T"], wouldRemove: ["T"] });
      expect([canonBag, workingBag].map((bag) => r.stores.get(bag)!.headsNow())).toEqual(heads);
    } finally { await r.repo.shutdown(); }
  });

  test("resolve names the top tombstone and clears the winning surface", async () => {
    const r = await rig();
    try {
      await r.stores.get(canonBag)!.put(live("T"), { kind: "tw-local", instanceId: "test" });
      await r.stores.get(workingBag)!.tombstone("T", hand);
      await r.run(workingBag, canonBag);
      const resolved = await makeResolveReactor(r.composite)({ tiddler: "T" }, {} as VerbContext);
      expect(resolved).toMatchObject({ hiddenBy: canonBag, winningBag: null });
      await r.stores.get(canonBag)!.put(live("plain"), { kind: "tw-local", instanceId: "test" });
      const plain = await makeResolveReactor(r.composite)({ tiddler: "plain" }, {} as VerbContext);
      expect(plain).toMatchObject({ hiddenBy: null, winningBag: canonBag });
    } finally { await r.repo.shutdown(); }
  });
});
