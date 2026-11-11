/**
 * override-fork-remembers-base — A WORKING OVERRIDE REMEMBERS THE CANON TEXT IT FORKED FROM.
 *
 * A wiki composes its working layer over its canon bag. A hand that saves a title canon holds forks an override: the
 * working record lands naming the hash of canon's text at that moment (`meta.overrideBase`, `override-base.ts`), so a
 * later canon change can tell a stale untouched copy (its text still says the base) from a hand's edit.
 *
 *   F1  a fork names the canon record's carrier identity (`carrierHash` over its canonical carrier form, tagged
 *       `sha256:<hex>`), compared through `digestsEqual`; the base rides the meta envelope, never a tiddler field
 *   F2  a later edit of the override keeps the base the fork named (the writer names none)
 *   F3  a working-only title, and a write into the canon layer itself, name no base
 *   F5  a family write forks each member the same way
 *   F6  a working write NEVER waits on a read: over a lower layer that offers no synchronous read (a folded stage, a store
 *       behind a worker, a held document whose read waits), the write still begins inside the composite's call, so the
 *       island reads it at once (the joined page's save route), and the base stays unknown rather than awaited
 */
import { describe, expect, test } from "vitest";
import { Repo } from "@automerge/automerge-repo";
import { AutomergeDocStore } from "../src/automerge-doc-store.js";
import { CompositeStore } from "../src/composite-store.js";
import { emptyLarDoc, type LarDoc } from "../src/base-doc.js";
import { OVERRIDE_BASE_META, overrideBaseOf, overrideCarrierHash, canonicalCarrierForm, basesEqual, workingLayerOfCanon, canonOfWorkingLayer } from "../src/override-base.js";
import { carrierHash } from "../src/crypto.js";
import type { LarTiddlerStore } from "../src/tiddler-store.js";

/** The carrier identity of one record as a store holds it now. */
const identityOf = async (store: LarTiddlerStore, title: string): Promise<string> => overrideCarrierHash((await store.get(title))!.tiddler);

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

  test("F1 — a fork names the canon record's carrier identity on its meta envelope", async () => {
    const r = await rig();
    const canonIdentity = await identityOf(r.canon, "T");
    expect(canonIdentity).toBe(carrierHash(canonicalCarrierForm((await r.canon.get("T"))!.tiddler)));
    expect(canonIdentity).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(canonicalCarrierForm({ title: "T", text: "canon words", tags: ["a b", "c"] })).toBe("tags: [[a b]] c\ntitle: T\n\ncanon words");
    await r.composite.put({ tiddler: { title: "T", text: "a hand's words" } }, hand);
    const held = await r.working.get("T");
    expect(overrideBaseOf(held)).toBe(canonIdentity);
    expect(basesEqual(overrideBaseOf(held), canonIdentity.slice("sha256:".length))).toBe(false);   // a bare hex matches nothing
    expect(held!.tiddler).not.toHaveProperty(OVERRIDE_BASE_META);
  });

  test("F2 — a later edit keeps the base the fork named", async () => {
    const r = await rig();
    const forked = await identityOf(r.canon, "T");
    await r.composite.put({ tiddler: { title: "T", text: "first edit" } }, hand);
    await r.canon.put({ tiddler: { title: "T", text: "canon moved" } }, hand);
    await r.composite.put({ tiddler: { title: "T", text: "second edit" } }, hand);
    expect(overrideBaseOf(await r.working.get("T"))).toBe(forked);
    expect(basesEqual(forked, await identityOf(r.canon, "T"))).toBe(false);
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
    expect(overrideBaseOf(await r.working.get("T"))).toBe(await identityOf(r.canon, "T"));
    expect(overrideBaseOf(await r.working.get("T#a"))).toBe(await identityOf(r.canon, "T#a"));
  });

  test("F6 — over a lower layer with no synchronous read, the write never waits on it and names no base", async () => {
    const { working } = await rig();
    // A stage that folds at read, as the joined page's kahua layer does: no `readNow`, and its `get` waits on a lit face.
    const waits = { get: () => new Promise<never>(() => {}), listVisible: async () => [] };
    const stacked = new CompositeStore();
    stacked.addLayer({ bagId: "lar:///ha.ka.ba/bags/stage", store: waits as never, writable: false, defaultWritable: false });
    stacked.addLayer({ bagId: WORKING, store: working, writable: true, defaultWritable: true });
    const landing = stacked.put({ tiddler: { title: "page-new", text: "a page's new words" } }, hand);
    const raced = await Promise.race([landing.then(() => "landed"), new Promise((r) => setTimeout(() => r("waited"), 2_000))]);
    expect(raced).toBe("landed");
    expect((await working.get("page-new"))?.tiddler["text"]).toBe("a page's new words");
    expect(overrideBaseOf(await working.get("page-new"))).toBeNull();
  });
});
