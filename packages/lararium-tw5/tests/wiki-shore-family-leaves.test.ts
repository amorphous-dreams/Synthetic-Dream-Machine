/**
 * engine-root-delete-one-change (wiki-surface-scout #/meme-aware-actions, lane 0).
 *
 * A root's delete through the ENGINE (`$tw.wiki.deleteTiddler`, a `tm-delete-tiddler`, the meme door over a
 * live wiki) lands the root and its component slots as ONE store change. The shore once tombstoned the
 * root, then deleted each child in the engine, and each child's delete flushed as its own tombstone: a
 * window where a peer saw a dead root over live children.
 *
 * Driven over a real wiki, a real `CompositeStore` and real Automerge documents (`wiki-shore-rig`): the
 * count of document changes answers "one change", never a spy's opinion of it.
 */
import { describe, expect, test } from "vitest";
import { wikiSkip, skipNote } from "./test-wiki.js";
import {
  afterDispatch, canonBag, ManualBoundary, openDraft, remote, saveSequence, shoreRig, storeAbsent, storeDeleted, storeText, turns, typeInto, workingBag, type Rig,
} from "./wiki-shore-rig.js";
import { removeMeme, renameFamilyInWiki, wikiMemeSink } from "../src/place-meme.js";

const CARRIER = "text/memetic-wikitext+tiddlywiki";
const hand = async (r: Rig, boundary: ManualBoundary): Promise<void> => {
  await afterDispatch();
  boundary.fire();
  await turns(48);
  await r.adaptor.landingIdle();
};

const family = (root: string) => [
  { tiddler: { title: root, type: CARRIER, text: "intro\n\n<<~ kahea ahu slot=`#/a`>>\n\n<<~ kahea ahu slot=`#/b`>>\n\n<<~ kahea ahu slot=`#/c`>>\n" } },
  { tiddler: { title: `${root}#/a`, type: CARRIER, text: "a body\n\n<<~ kahea ahu slot=`#/a/deep`>>\n", "$fragment-parent": root, "$slot": "#/a" } },
  { tiddler: { title: `${root}#/a/deep`, type: CARRIER, text: "deep body", "$fragment-parent": `${root}#/a`, "$slot": "#/a/deep" } },
  { tiddler: { title: `${root}#/b`, type: CARRIER, text: "b body", "$fragment-parent": root, "$slot": "#/b" } },
  { tiddler: { title: `${root}#/c`, type: CARRIER, text: "c body", "$fragment-parent": root, "$slot": "#/c" } },
];
const titlesOf = (root: string): string[] => family(root).map((r) => r.tiddler.title).sort();

async function seeded(r: Rig, store: Rig["working"], root: string, extra: Array<{ tiddler: Record<string, unknown> & { title: string } }> = []): Promise<void> {
  await store.writeFamily([...family(root), ...extra], [], remote);
  await turns();
  await r.adaptor.armSeedCheckpoint();
  await r.adaptor.landingIdle();
}

describe.skipIf(wikiSkip)(`the family leaves as one change${skipNote}`, () => {
  test("★ an engine delete of a root lands the root and every slot as ONE change of the bag's document ★", async () => {
    const boundary = new ManualBoundary();
    const r = await shoreRig({ boundary });
    const root = "lar:///t/family/engine-delete";
    const pathChild = `${root}/path`;
    await seeded(r, r.working, root, [{ tiddler: { title: pathChild, type: CARRIER, text: "its own meme" } }]);
    const mark = r.calls.length;
    const changesBefore = r.changes(workingBag);

    r.wiki.deleteTiddler(root);
    await hand(r, boundary);

    // Nothing lies beneath the family, so it retracts plainly: no kāpae rises over any member.
    const issued = r.calls.slice(mark).filter((c) => (c.retracts?.length ?? 0) > 0 || c.deletes.length > 0);
    expect(issued.map((c) => [...(c.retracts ?? [])].sort()), "one store call carries the whole family").toEqual([titlesOf(root)]);
    expect(issued.flatMap((c) => c.deletes), "no tombstone rises").toEqual([]);
    expect(r.changes(workingBag) - changesBefore, "one change of the working document").toBe(1);
    for (const title of titlesOf(root)) {
      expect(storeAbsent(r, workingBag, title), title).toBe(true);
      expect(r.wiki.getTiddler(title), title).toBeUndefined();
    }
    expect(r.wiki.getTiddler(pathChild), "a path child stands as its own meme").toBeDefined();
    expect(storeText(r, workingBag, pathChild)).toBe("its own meme");
    await r.stop();
  }, 120_000);

  test("control: a plain tiddler's delete lands one plain retract and no tombstone", async () => {
    const boundary = new ManualBoundary();
    const r = await shoreRig({ boundary });
    const plain = "lar:///t/family/plain-note";
    await r.working.put({ tiddler: { title: plain, text: "a note" } }, remote);
    await turns();
    await r.adaptor.armSeedCheckpoint();
    await r.adaptor.landingIdle();
    const mark = r.calls.length;
    r.wiki.deleteTiddler(plain);
    await hand(r, boundary);
    expect(r.calls.slice(mark).map((c) => ({ kind: c.kind, deletes: c.deletes, ...(c.retracts ? { retracts: c.retracts } : {}) }))).toEqual([{ kind: "family", deletes: [], retracts: [plain] }]);
    await r.stop();
  }, 120_000);

  test("★ the meme door over a live wiki removes the family in ONE change ★", async () => {
    const boundary = new ManualBoundary();
    const r = await shoreRig({ boundary });
    const root = "lar:///t/family/meme-door";
    await seeded(r, r.working, root);
    const changesBefore = r.changes(workingBag);
    const receipt = await removeMeme({ uri: root }, wikiMemeSink(r.wiki as never));
    await hand(r, boundary);
    expect([...receipt.tombstoned].sort()).toEqual(titlesOf(root));
    expect(r.changes(workingBag) - changesBefore).toBe(1);
    for (const title of titlesOf(root)) expect(storeAbsent(r, workingBag, title), title).toBe(true);
    await r.stop();
  }, 120_000);

  test("★ a canon family's delete shadows every member from the working layer, as ONE change there ★", async () => {
    const boundary = new ManualBoundary();
    const r = await shoreRig({ boundary });
    const root = "lar:///t/family/canon-root";
    await seeded(r, r.canon as never, root);
    const canonChanges = r.changes(canonBag);
    const changesBefore = r.changes(workingBag);
    r.wiki.deleteTiddler(root);
    await hand(r, boundary);
    expect(r.changes(canonBag), "canon takes no write").toBe(canonChanges);
    expect(r.changes(workingBag) - changesBefore).toBe(1);
    for (const title of titlesOf(root)) expect(storeDeleted(r, workingBag, title), title).toBe(true);
    await r.stop();
  }, 120_000);

  test("★ rename-root-carries-family: the slots re-title with their root and no body leaves the store ★", async () => {
    const boundary = new ManualBoundary();
    const r = await shoreRig({ boundary });
    const root = "lar:///t/family/rename-from";
    const to = "lar:///t/family/rename-to";
    await seeded(r, r.working, root);
    const read = renameFamilyInWiki(r.wiki as never, root, to);
    await hand(r, boundary);
    expect(read.refusals).toEqual([]);
    for (const title of titlesOf(root)) {
      expect(r.wiki.getTiddler(title), `${title} left the wiki`).toBeUndefined();
      expect(storeAbsent(r, workingBag, title), `${title} left the store`).toBe(true);
    }
    expect(storeText(r, workingBag, `${to}#/a/deep`)).toBe("deep body");
    expect(storeText(r, workingBag, `${to}#/b`)).toBe("b body");
    expect(r.wiki.getTiddler(`${to}#/a`)?.fields["$fragment-parent"]).toBe(to);
    expect(r.wiki.getTiddler(`${to}#/a/deep`)?.fields["$fragment-parent"]).toBe(`${to}#/a`);
    expect(String(r.wiki.getTiddler(to)?.fields["text"])).toContain("<<~ kahea ahu slot=`#/a`>>");
    await r.stop();
  }, 120_000);

  test("★ a draft saved under a new title carries the root's slots to the new address; no slot body leaves the store ★", async () => {
    const boundary = new ManualBoundary();
    const r = await shoreRig({ boundary });
    const root = "lar:///t/family/draft-rename";
    const to = `${root}-renamed`;
    await seeded(r, r.working, root);
    const text = "renamed root\n\n<<~ kahea ahu slot=`#/a`>>\n\n<<~ kahea ahu slot=`#/b`>>\n\n<<~ kahea ahu slot=`#/c`>>\n";
    const d = openDraft(r, root, text);
    typeInto(r, d, text, { "draft.title": to });
    await afterDispatch(); boundary.fire(); await turns(24);
    saveSequence(r, d);
    await afterDispatch(); await turns(48);
    // The slots land under the target as a hand's own writes, after the source's removal stood acknowledged.
    await hand(r, boundary);
    expect(r.wiki.getTiddler(root), "the source left").toBeUndefined();
    expect(r.wiki.getTiddler(`${root}#/a`), "the old slot title left the wiki").toBeUndefined();
    expect(storeAbsent(r, workingBag, `${root}#/a`), "the old slot title left the store").toBe(true);
    expect(r.wiki.getTiddler(`${to}#/a/deep`)?.fields["text"], "the slot body stands under the new address").toBe("deep body");
    expect(r.wiki.getTiddler(`${to}#/a/deep`)?.fields["$fragment-parent"]).toBe(`${to}#/a`);
    expect(storeText(r, workingBag, `${to}#/a/deep`)).toBe("deep body");
    expect(storeText(r, workingBag, `${to}#/b`)).toBe("b body");
    await r.stop();
  }, 120_000);
});
