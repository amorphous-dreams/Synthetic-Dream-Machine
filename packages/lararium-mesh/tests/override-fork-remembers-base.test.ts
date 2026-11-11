/**
 * override-fork-remembers-base — A WORKING OVERRIDE REMEMBERS THE CANON TEXT IT FORKED FROM.
 *
 * A wiki composes its working layer over its canon bag. A hand that saves a title canon holds forks an override: the
 * working record lands naming the hash of canon's text at that moment (`meta.overrideBase`, `override-base.ts`), so a
 * later canon change can tell a stale untouched copy (its text still says the base) from a hand's edit.
 *
 *   F1  a fork names the canon text hash; the base rides the meta envelope, never a tiddler field
 *   F2  a later edit of the override keeps the base the fork named (the writer names none)
 *   F3  a working-only title, and a write into the canon layer itself, name no base
 *   F5  a family write forks each member the same way
 */
import { describe, expect, test } from "vitest";
import { Repo } from "@automerge/automerge-repo";
import { AutomergeDocStore } from "../src/automerge-doc-store.js";
import { CompositeStore } from "../src/composite-store.js";
import { emptyLarDoc, type LarDoc } from "../src/base-doc.js";
import { OVERRIDE_BASE_META, overrideBaseOf, overrideTextHash, workingLayerOfCanon, canonOfWorkingLayer } from "../src/override-base.js";

const CANON = "lar:///ha.ka.ba/bags/probe";
const WORKING = "lar:///ha.ka.ba/wikis/probe/working";
const hand = { kind: "tw-local", instanceId: "test" } as const;

async function rig() {
  const repo = new Repo({ network: [] });
  const canon = new AutomergeDocStore(repo.create<LarDoc>(emptyLarDoc()), CANON);
  const working = new AutomergeDocStore(repo.create<LarDoc>(emptyLarDoc()), WORKING);
  const composite = new CompositeStore();
  composite.addLayer({ bagId: CANON, store: canon, writable: true, defaultWritable: false });
  composite.addLayer({ bagId: WORKING, store: working, writable: true, defaultWritable: true });
  await canon.put({ tiddler: { title: "T", text: "canon words" } }, hand);
  return { canon, working, composite };
}

describe("a working override remembers its base", () => {
  test("the slug law maps a canon bag and its working layer both ways", () => {
    expect(workingLayerOfCanon(CANON)).toBe(WORKING);
    expect(canonOfWorkingLayer(WORKING)).toBe(CANON);
    expect(workingLayerOfCanon(WORKING)).toBeNull();
  });

  test("F1 — a fork names the canon text hash on its meta envelope", async () => {
    const r = await rig();
    await r.composite.put({ tiddler: { title: "T", text: "a hand's words" } }, hand);
    const held = await r.working.get("T");
    expect(overrideBaseOf(held)).toBe(overrideTextHash({ text: "canon words" }));
    expect(held!.tiddler).not.toHaveProperty(OVERRIDE_BASE_META);
  });

  test("F2 — a later edit keeps the base the fork named", async () => {
    const r = await rig();
    await r.composite.put({ tiddler: { title: "T", text: "first edit" } }, hand);
    await r.canon.put({ tiddler: { title: "T", text: "canon moved" } }, hand);
    await r.composite.put({ tiddler: { title: "T", text: "second edit" } }, hand);
    expect(overrideBaseOf(await r.working.get("T"))).toBe(overrideTextHash({ text: "canon words" }));
  });

  test("F3 — a working-only title and a write into canon name no base", async () => {
    const r = await rig();
    await r.composite.put({ tiddler: { title: "W", text: "only here" } }, hand);
    expect(overrideBaseOf(await r.working.get("W"))).toBeNull();
    await r.composite.put({ tiddler: { title: "T", text: "canon again" } }, hand, { bag: CANON });
    expect(overrideBaseOf(await r.canon.get("T"))).toBeNull();
  });

  test("F5 — a family write forks each member", async () => {
    const r = await rig();
    await r.canon.put({ tiddler: { title: "T#a", text: "canon a" } }, hand);
    await r.composite.writeFamily([{ tiddler: { title: "T", text: "x" } }, { tiddler: { title: "T#a", text: "y" } }], [], hand);
    expect(overrideBaseOf(await r.working.get("T"))).toBe(overrideTextHash({ text: "canon words" }));
    expect(overrideBaseOf(await r.working.get("T#a"))).toBe(overrideTextHash({ text: "canon a" }));
  });
});
