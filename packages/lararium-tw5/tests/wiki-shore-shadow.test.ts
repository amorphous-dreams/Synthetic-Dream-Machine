/**
 * A hand's delete shadows canon from the working layer. A title that landed from any bag other than this
 * wiki's own slots is never written there: the tombstone lands in the working layer and the composition
 * reads the title absent (kāpae). The wiki shows what the composition resolves, wave by wave and across a
 * reload.
 */
import { describe, expect, test, vi } from "vitest";
import { CompositeStore, emptyLarDoc, type LarDoc, wikiBagUri } from "@lararium/mesh";
import { bridgeWikiToAdaptor } from "../src/outbound-bridge.js";
import { buildIslandRecipe, seedDrained } from "../src/island-recipe.js";
import { unroutedSaveAlertTitle } from "../src/island-adaptor.js";
import { bootTestWiki, wikiSkip, skipNote } from "./test-wiki.js";
import {
  Repo, afterDispatch, canonBag, draftBag, ManualBoundary, openDraft, peerWrite, remote, saveSequence,
  shoreRig, storeDeleted, storeText, turns, typeInto, workingBag, type Rig,
} from "./wiki-shore-rig.js";

const WORKING_POINTER = "lar:///ha.ka.ba/lararium/config/current-wiki-bag";
const heads = (r: Rig, bag: string): string => JSON.stringify(r.handles[bag]!.heads());
/** A fresh engine and adaptor over the same docs; the layers replay in `order`, the landing queue draining after each. */
async function reload(r: Rig, order: ReadonlyArray<"canon" | "working" | "draft">): Promise<Rig> {
  const again = await shoreRig({ instanceId: "shore-reload", boundary: new ManualBoundary(), docs: r.saved() });
  for (const name of order) { again[name].emitInitialReplay(); await again.adaptor.landingIdle(); }
  return again;
}

describe.skipIf(wikiSkip)(`wiki shore shadowing${skipNote}`, () => {
  test("a delete of a canon-landed title shadows from the working layer, canon untouched, and stays absent across a reload", async () => {
    for (const canonWritable of [false, true]) {
      const boundary = new ManualBoundary();
      const r = await shoreRig({ boundary, canonWritable });
      const x = `lar:///t/shadow/delete-${canonWritable}`;
      await r.canon.put({ tiddler: { title: x, text: "canon text" } }, remote);
      await turns();
      await r.adaptor.armSeedCheckpoint();
      const canonBefore = heads(r, canonBag);
      const mark = r.calls.length;
      r.wiki.deleteTiddler(x);
      await afterDispatch();
      boundary.fire();
      await turns(48);
      const calls = r.calls.slice(mark).filter((c) => c.deletes.includes(x));
      expect(calls, "one tombstone, in the working layer").toHaveLength(1);
      expect(calls[0]!.bag).toBe(workingBag);
      expect(calls[0]!.base, "a canon bag's heads never reach the working document").toBeUndefined();
      expect(heads(r, canonBag), "canon's heads are equal before and after").toBe(canonBefore);
      expect(storeDeleted(r, workingBag, x)).toBe(true);
      expect(r.wiki.getTiddler(x)).toBeUndefined();
      expect((await r.composite.getLive(x))).toBeNull();
      expect(r.adaptor.ledger.landedOf(x)!.bag, "the ledger names the working tombstone").toBe(workingBag);

      for (const order of [["canon", "working", "draft"], ["working", "draft", "canon"]] as const) {
        const again = await reload(r, order);
        expect(again.wiki.getTiddler(x), `absent after a reload replaying ${order.join(",")}`).toBeUndefined();
        await again.stop();
      }
      await r.stop();
    }
  }, 120_000);

  test("a write-layer pointer that names a writable canon bag cannot steer a delete into it", async () => {
    const boundary = new ManualBoundary();
    const r = await shoreRig({ boundary, canonWritable: true });
    const x = "lar:///t/shadow/pointer-names-canon";
    await r.canon.put({ tiddler: { title: x, text: "canon text" } }, remote);
    await r.adaptor.armSeedCheckpoint();
    // The pointer changes with the bridge unhooked, so the change itself is no hand's save.
    r.unbridge();
    r.wiki.addTiddler(new r.Tiddler({ title: WORKING_POINTER, text: canonBag }));
    await afterDispatch();
    const rebridged = bridgeWikiToAdaptor(r.engine, r.adaptor);
    expect(String(r.wiki.getTiddler(WORKING_POINTER)?.fields.text)).toBe(canonBag);
    const canonBefore = heads(r, canonBag);
    const mark = r.calls.length;
    r.wiki.deleteTiddler(x);
    await afterDispatch();
    boundary.fire();
    await turns(48);
    const calls = r.calls.slice(mark).filter((c) => c.deletes.includes(x));
    expect(calls.map((c) => c.bag)).toEqual([workingBag]);
    expect(heads(r, canonBag), "canon's heads are equal before and after").toBe(canonBefore);
    expect(storeDeleted(r, workingBag, x)).toBe(true);
    expect(storeDeleted(r, canonBag, x)).toBe(false);
    expect(r.wiki.getTiddler(x)).toBeUndefined();
    rebridged();
    await r.stop();
  }, 120_000);

  test("a marked slot child the wiki dropped never rides its root's family beneath the working layer", async () => {
    const boundary = new ManualBoundary();
    const r = await shoreRig({ boundary, canonWritable: true });
    const root = "lar:///t/shadow/placed-root";
    const child = `${root}#/a`;
    await r.canon.writeFamily([
      { tiddler: { title: root, text: "<<~ kahea ahu slot=`#/a`>>", type: "text/memetic-wikitext+tiddlywiki" } },
      { tiddler: { title: child, text: "slot body", "$fragment-parent": root } },
    ], [], remote, { bag: canonBag });
    await r.adaptor.armSeedCheckpoint();
    await r.adaptor.landingIdle();
    expect(r.adaptor.ledger.landedOf(child)?.bag).toBe(canonBag);
    // The write-layer pointer names the writable canon bag; the composition's layer order still decides.
    r.unbridge();
    r.wiki.addTiddler(new r.Tiddler({ title: WORKING_POINTER, text: canonBag }));
    await afterDispatch();
    const rebridged = bridgeWikiToAdaptor(r.engine, r.adaptor);
    const mark = r.calls.length;
    // One hand turn: the root changes and its slot child goes.
    r.wiki.addTiddler(new r.Tiddler(r.wiki.getTiddler(root)!.fields, { caption: "edited by hand" }));
    r.wiki.deleteTiddler(child);
    await afterDispatch();
    boundary.fire();
    await turns(48);
    const issued = r.calls.slice(mark);
    expect(issued.filter((c) => c.bag === canonBag).flatMap((c) => c.deletes), "no tombstone reaches the canon bag").toEqual([]);
    expect(issued.filter((c) => c.deletes.includes(child)).map((c) => c.bag), "the child's tombstone lands in the working layer").toEqual([workingBag]);
    expect(storeDeleted(r, canonBag, child)).toBe(false);
    expect(storeDeleted(r, workingBag, child)).toBe(true);
    expect(r.wiki.getTiddler(child)).toBeUndefined();
    // The root's own save refuses by name: a pointer steers nothing beneath the working layer.
    expect(issued.filter((c) => c.puts.includes(root))).toEqual([]);
    expect(String(r.wiki.getTiddler(unroutedSaveAlertTitle(WORKING_POINTER))?.fields.text)).toContain(root);
    rebridged();
    r.unbridge();
    await r.adaptor.stop().catch(() => undefined);
    await r.repo.shutdown();
  }, 120_000);

  test("a later re-create lands in the working layer over the tombstone and the composition shows it", async () => {
    const boundary = new ManualBoundary();
    const r = await shoreRig({ boundary });
    const x = "lar:///t/shadow/recreate";
    await r.canon.put({ tiddler: { title: x, text: "canon text" } }, remote);
    await turns();
    await r.adaptor.armSeedCheckpoint();
    r.wiki.deleteTiddler(x);
    await afterDispatch();
    boundary.fire();
    await turns(48);
    const tombstoneHeads = r.adaptor.ledger.landedOf(x)!.heads!;
    const canonBefore = heads(r, canonBag);
    const mark = r.calls.length;
    r.wiki.addTiddler(new r.Tiddler({ title: x, text: "re-created" }));
    await afterDispatch();
    boundary.fire();
    await turns(48);
    const writes = r.calls.slice(mark).filter((c) => c.puts.includes(x));
    expect(writes).toHaveLength(1);
    expect(writes[0]!.bag).toBe(workingBag);
    expect(writes[0]!.base, "the re-create builds on the working tombstone").toEqual(tombstoneHeads);
    expect(storeText(r, workingBag, x)).toBe("re-created");
    expect(storeDeleted(r, workingBag, x)).toBe(false);
    expect((await r.composite.getLive(x))?.tiddler.text).toBe("re-created");
    expect(String(r.wiki.getTiddler(x)!.fields.text)).toBe("re-created");
    expect(r.wiki.getTiddler(x)!.fields["$origin-bag"]).toBe(workingBag);
    expect(heads(r, canonBag)).toBe(canonBefore);
    await r.stop();
  }, 120_000);

  test("control: a working-layer title tombstones in the working layer at its landed base, and a draft in the draft layer", async () => {
    const boundary = new ManualBoundary();
    const r = await shoreRig({ boundary });
    const own = "lar:///t/shadow/own";
    const target = "lar:///t/shadow/draft-target";
    await r.working.put({ tiddler: { title: own, text: "own" } }, remote);
    await r.working.put({ tiddler: { title: target, text: "landed" } }, remote);
    await turns();
    await r.adaptor.armSeedCheckpoint();
    const ownHeads = r.adaptor.ledger.landedOf(own)!.heads;
    const mark = r.calls.length;
    r.wiki.deleteTiddler(own);
    await afterDispatch();
    boundary.fire();
    await turns(32);
    const calls = r.calls.slice(mark).filter((c) => c.deletes.includes(own));
    expect(calls).toHaveLength(1);
    expect(calls[0]!.bag).toBe(workingBag);
    expect(calls[0]!.base).toEqual(ownHeads);
    const d = openDraft(r, target, "typing");
    await afterDispatch();
    boundary.fire();
    await turns(32);
    const markDraft = r.calls.length;
    const draftBase = r.adaptor.ledger.landedOf(d)!.heads;
    r.wiki.deleteTiddler(d);
    await afterDispatch();
    await turns(32);
    expect(r.calls.slice(markDraft).filter((c) => c.deletes.includes(d)).map((c) => [c.bag, c.base])).toEqual([[draftBag, draftBase]]);
    await r.stop();
  }, 120_000);

  test("a canon wave that changes a shadowed title does not resurrect it; with no shadow the same wave lands", async () => {
    const boundary = new ManualBoundary();
    const r = await shoreRig({ boundary });
    const shadowed = "lar:///t/shadow/wave-shadowed";
    const open = "lar:///t/shadow/wave-open";
    await r.canon.put({ tiddler: { title: shadowed, text: "canon text" } }, remote);
    await r.canon.put({ tiddler: { title: open, text: "canon text" } }, remote);
    await turns();
    await r.adaptor.armSeedCheckpoint();
    r.wiki.deleteTiddler(shadowed);
    await afterDispatch();
    boundary.fire();
    await turns(48);
    const mark = r.calls.length;
    await peerWrite(r, canonBag, [{ tiddler: { title: shadowed, text: "canon moved" } }, { tiddler: { title: open, text: "canon moved" } }]);
    await r.adaptor.landingIdle();
    await r.adaptor.landingIdle();
    await turns(32);
    expect(String(r.wiki.getTiddler(open)!.fields.text), "control: the unshadowed wave lands").toBe("canon moved");
    expect(r.wiki.getTiddler(shadowed), "the shadowed title stays absent").toBeUndefined();
    expect(r.adaptor.ledger.landedOf(shadowed)!.bag).toBe(workingBag);
    expect(r.calls.slice(mark), "no hand is surfaced or written").toEqual([]);
    await r.stop();
  }, 120_000);

  test("a canon wave under a live working copy-up leaves the copy-up in the wiki", async () => {
    const boundary = new ManualBoundary();
    const r = await shoreRig({ boundary });
    const x = "lar:///t/shadow/copy-up";
    await r.canon.put({ tiddler: { title: x, text: "canon text" } }, remote);
    await r.working.put({ tiddler: { title: x, text: "copy-up text" } }, remote);
    await turns();
    await r.adaptor.armSeedCheckpoint();
    expect(String(r.wiki.getTiddler(x)!.fields.text)).toBe("copy-up text");
    const sentinel = "lar:///t/shadow/copy-up-sentinel";
    await peerWrite(r, canonBag, [{ tiddler: { title: x, text: "canon moved" } }, { tiddler: { title: sentinel, text: "canon sentinel" } }]);
    await r.adaptor.landingIdle();
    await turns(48);
    expect(String(r.wiki.getTiddler(sentinel)!.fields.text), "the canon wave was heard and landed").toBe("canon sentinel");
    expect(String(r.wiki.getTiddler(x)!.fields.text)).toBe("copy-up text");
    expect(r.adaptor.ledger.landedOf(x)!.bag).toBe(workingBag);
    await r.stop();
  }, 120_000);

  test("a rename whose source lives in canon lands the target in working and shadows the source in the same change", async () => {
    const boundary = new ManualBoundary();
    const r = await shoreRig({ boundary });
    const x = "lar:///t/shadow/rename-from";
    const y = "lar:///t/shadow/rename-to";
    await r.canon.put({ tiddler: { title: x, text: "canon text" } }, remote);
    await turns();
    await r.adaptor.armSeedCheckpoint();
    const d = openDraft(r, x, "renamed");
    typeInto(r, d, "renamed", { "draft.title": y });
    await afterDispatch();
    boundary.fire();
    await turns(32);
    const canonBefore = heads(r, canonBag);
    const working = r.changes(workingBag);
    const draftBase = r.adaptor.ledger.landedOf(d)!.heads;
    expect(draftBase, "the draft reached the store and landed").toBeDefined();
    const mark = r.calls.length;
    saveSequence(r, d);
    await afterDispatch();
    // THE WHOLE ACT, issued in the dispatch turn: Y and the shadow of X share one working group with no
    // base (a canon bag's heads never reach the working document); the draft's own tombstone rides the
    // draft layer at the draft's landed base. Nothing else is written, and nothing beneath working.
    expect(r.calls.slice(mark)).toEqual([
      { kind: "family", bag: workingBag, puts: [y], deletes: [x], base: undefined },
      { kind: "family", bag: draftBag, puts: [], deletes: [d], base: draftBase },
    ]);
    expect(r.wiki.getTiddler(y)?.fields.text).toBe("renamed");
    await turns(32);
    expect(r.changes(workingBag) - working).toBe(1);
    expect(heads(r, canonBag)).toBe(canonBefore);
    expect(storeText(r, workingBag, y)).toBe("renamed");
    expect(storeDeleted(r, workingBag, x)).toBe(true);
    expect(r.wiki.getTiddler(x)).toBeUndefined();
    await r.stop();
  }, 120_000);

  test("a delete with no working layer refuses by name through the real recipe, and when the pointer names an unmounted slot", async () => {
    // The recipe seeds an EMPTY write-layer pointer when it binds no working slot.
    const engine = await bootTestWiki();
    const wiki = engine.$tw.wiki as unknown as {
      getTiddler(t: string): { fields: Record<string, unknown> } | undefined;
      addTiddler(t: unknown): void;
      deleteTiddler(t: string): void;
      addEventListener(type: "change", fn: (changes: Record<string, unknown>) => void): void;
      removeEventListener(type: "change", fn: (changes: Record<string, unknown>) => void): void;
    };
    const Tiddler = (engine.$tw as unknown as { Tiddler: new (...f: Array<Record<string, unknown>>) => unknown }).Tiddler;
    const alertTitle = unroutedSaveAlertTitle(WORKING_POINTER);
    /** Resolves when the refusal alert next changes: the observed refusal, never a fixed wait. */
    const refusalRaised = (): Promise<void> => new Promise<void>((resolve) => {
      const onChange = (changes: Record<string, unknown>): void => {
        if (!(alertTitle in changes)) return;
        wiki.removeEventListener("change", onChange);
        resolve();
      };
      wiki.addEventListener("change", onChange);
    });
    const repo = new Repo({ network: [] });
    const slug = "shadow-recipe";
    const canonHandle = repo.create<LarDoc>(emptyLarDoc());
    const x = "lar:///t/shadow/no-working-recipe";
    canonHandle.change((doc) => { doc.tiddlers[x] = { tiddler: { title: x, text: "canon text" } }; });
    const composite = new CompositeStore();
    const { adaptor } = buildIslandRecipe({ tw5: engine, composite, recipe: { wikiSlug: slug }, ready: [{ slot: wikiBagUri(slug), handle: canonHandle }] });
    const writes: string[] = [];
    vi.spyOn(composite, "tombstoneInBag").mockImplementation(async (bag) => { writes.push(bag); });
    vi.spyOn(composite, "writeFamily").mockImplementation(async (_p, _d, _o, options) => { writes.push(String(options?.bag)); });
    const unbridge = bridgeWikiToAdaptor(engine, adaptor);
    await seedDrained(engine);
    expect(wiki.getTiddler(x)?.fields.text).toBe("canon text");
    const canonBefore = JSON.stringify(canonHandle.heads());

    // A hand's SAVE of the title: the cascade routes through the empty pointer and refuses.
    const saveRefused = refusalRaised();
    wiki.addTiddler(new Tiddler(wiki.getTiddler(x)!.fields, { text: "a hand's edit" }));
    void adaptor.handsRested().catch(() => {});   // the next act crosses a boundary
    await saveRefused;
    expect(String(wiki.getTiddler(alertTitle)!.fields.text)).toContain("that tiddler holds nothing");
    expect(adaptor.holdsHand(x), "the edit stays owed").toBe(true);

    // The hand's DELETE of the same owed title: the refusal's reason changes and the alert follows it.
    const deleteRefused = refusalRaised();
    wiki.deleteTiddler(x);
    void adaptor.handsRested().catch(() => {});
    await deleteRefused;
    const alert = String(wiki.getTiddler(alertTitle)!.fields.text);
    expect(alert).toContain("this wiki mounts no working layer");
    expect(alert).not.toContain("that tiddler holds nothing");
    expect(alert.match(/lar:\/\/\/t\/shadow\/no-working-recipe/g), "the owed title is listed once").toHaveLength(1);
    expect(wiki.getTiddler(x), "the wiki stands as the hand left it").toBeUndefined();
    expect(writes, "no store call was issued").toEqual([]);
    expect(JSON.stringify(canonHandle.heads())).toBe(canonBefore);
    expect(adaptor.holdsHand(x), "the title stays owed").toBe(true);
    unbridge();
    vi.spyOn(console, "warn").mockImplementation(() => {});
    await adaptor.stop();
    await repo.shutdown();
    vi.restoreAllMocks();

    // The pointer names the working slot and the composition does not mount it.
    const boundary = new ManualBoundary();
    const r = await shoreRig({ boundary, noWorking: true });
    const y = "lar:///t/shadow/unmounted-working";
    await r.canon.put({ tiddler: { title: y, text: "canon text" } }, remote);
    await turns();
    await r.adaptor.armSeedCheckpoint();
    expect(String(r.wiki.getTiddler(WORKING_POINTER)?.fields.text)).toBe(workingBag);
    const canonBefore2 = heads(r, canonBag);
    const mark = r.calls.length;
    r.wiki.deleteTiddler(y);
    await afterDispatch();
    boundary.fire();
    await turns(32);
    expect(r.calls.slice(mark), "no store call was issued").toEqual([]);
    expect(String(r.wiki.getTiddler(alertTitle)!.fields.text), "the sentence is true for a composition without a working layer").toContain("this wiki mounts no working layer");
    expect(r.wiki.getTiddler(y), "the wiki stands as the hand left it").toBeUndefined();
    expect(heads(r, canonBag)).toBe(canonBefore2);
    expect(r.adaptor.holdsHand(y)).toBe(true);
    vi.spyOn(console, "warn").mockImplementation(() => {});
    await r.stop();
    vi.restoreAllMocks();
  }, 120_000);

  test("a hand edit that drops a slot child shadows the orphan from working in the family's own change, canon untouched", async () => {
    for (const canonWritable of [false, true]) {
      const boundary = new ManualBoundary();
      const r = await shoreRig({ boundary, canonWritable });
      const root = `lar:///t/shadow/orphan-root-${canonWritable}`;
      const kept = `${root}#/a`;
      const orphan = `${root}#/b`;
      await r.canon.put({ tiddler: { title: root, text: "plain" } }, remote);
      await r.canon.put({ tiddler: { title: kept, text: "kept child", "$fragment-parent": root } }, remote);
      await r.canon.put({ tiddler: { title: orphan, text: "orphan child", "$fragment-parent": root } }, remote);
      await turns();
      await r.adaptor.armSeedCheckpoint();
      const canonBefore = heads(r, canonBag);
      const working = r.changes(workingBag);
      const mark = r.calls.length;
      const body = `<<^ code=\`&#x0001;\` from=\`?\` to=\`${root}\`>>\n<<^ code=\`&#x0002;\`>>\n\n\`\`\`toml meta\nuri-path = "${root.slice(7)}"\n\`\`\`\n\n<<~ ahu slot=\`#/a\`>>\n\n! body\n\n<<~/ahu>>\n\n<<^ code=\`&#x0003;\`>>\n\n<<^ code=\`&#x0004;\` to=\`?\`>>\n`;
      r.wiki.addTiddler(new r.Tiddler(r.wiki.getTiddler(root)!.fields, { text: body }));
      await afterDispatch();
      boundary.fire();
      await turns(48);
      const writes = r.calls.slice(mark).filter((c) => c.puts.includes(root));
      expect(writes, "one family call").toHaveLength(1);
      expect(writes[0]!.bag).toBe(workingBag);
      expect(writes[0]!.puts).toContain(kept);
      expect(writes[0]!.deletes, "the orphan's shadow rides the family").toEqual([orphan]);
      expect(r.changes(workingBag) - working).toBe(1);
      expect(heads(r, canonBag)).toBe(canonBefore);
      expect(storeDeleted(r, workingBag, orphan)).toBe(true);
      expect(r.wiki.getTiddler(orphan)).toBeUndefined();
      expect(r.adaptor.ledger.landedOf(orphan)?.bag).toBe(workingBag);
      await r.stop();
    }
  }, 120_000);
});
