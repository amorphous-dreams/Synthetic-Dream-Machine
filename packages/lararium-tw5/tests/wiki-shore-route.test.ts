/**
 * Where a hand's save and delete land. The cascade and its pointers choose among the layers a hand may
 * write (the working layer and the layers above it); the composition's own layer order answers which
 * those are. A save lands where the title lives when that layer sits above the cascade's choice; a delete
 * of a title living beneath the working layer lands where its save would; a parent whose edit removes a
 * child reference tombstones that child.
 */
import { describe, expect, test } from "vitest";
import { unroutedSaveAlertTitle } from "../src/island-adaptor.js";
import { wikiSkip, skipNote } from "./test-wiki.js";
import {
  afterDispatch, canonBag, draftBag, ManualBoundary, personalBag, remote, shoreRig, storeDeleted, storeText,
  tempBag, turns, workingBag, type Rig,
} from "./wiki-shore-rig.js";

const WORKING_POINTER = "lar:///ha.ka.ba/lararium/config/current-wiki-bag";
const heads = (r: Rig, bag: string): string => JSON.stringify(r.handles[bag]!.heads());
const hand = async (r: Rig, boundary: ManualBoundary): Promise<void> => {
  await afterDispatch();
  boundary.fire();
  await turns(48);
  await r.adaptor.landingIdle();
};

describe.skipIf(wikiSkip)(`wiki shore routing${skipNote}`, () => {
  test("a write-layer pointer naming a writable canon bag steers no save there: the save refuses by name and canon stands unchanged", async () => {
    const boundary = new ManualBoundary();
    const r = await shoreRig({ boundary, canonWritable: true, upperSlots: true });
    const x = "lar:///t/route/steered";
    const control = "lar:///t/route/steered-control";
    await r.canon.put({ tiddler: { title: x, text: "canon text" } }, remote);
    await turns();
    await r.adaptor.armSeedCheckpoint();
    await r.adaptor.landingIdle();

    // CONTROL: with the pointer naming the working layer a canon title's save lands in the working layer.
    const controlMark = r.calls.length;
    r.wiki.addTiddler(new r.Tiddler({ title: control, text: "ordinary" }));
    await hand(r, boundary);
    expect(r.calls.slice(controlMark).filter((c) => c.puts.includes(control)).map((c) => c.bag)).toEqual([workingBag]);

    r.wiki.addTiddler(new r.Tiddler({ title: WORKING_POINTER, text: canonBag }));
    await hand(r, boundary);
    const canonBefore = heads(r, canonBag);
    const workingBefore = heads(r, workingBag);
    const mark = r.calls.length;
    r.wiki.addTiddler(new r.Tiddler(r.wiki.getTiddler(x)!.fields, { text: "edited by hand" }));
    await hand(r, boundary);
    expect(r.calls.slice(mark).filter((c) => c.puts.includes(x)), "no store call carries the save").toEqual([]);
    expect(heads(r, canonBag), "canon's heads stand unchanged").toBe(canonBefore);
    expect(heads(r, workingBag)).toBe(workingBefore);
    const alert = r.wiki.getTiddler(unroutedSaveAlertTitle(WORKING_POINTER));
    expect(alert, "the refusal stands on the alert rail").toBeDefined();
    expect(String(alert!.fields.text)).toContain(x);
    expect(String(alert!.fields.text)).toContain("beneath this wiki's working layer");
    expect(r.wiki.getTiddler(x)!.fields.text, "the wiki keeps what the person wrote").toBe("edited by hand");
    expect(r.adaptor.holdsHand(x), "the title stays owed").toBe(true);
    r.unbridge();
    await r.adaptor.stop().catch(() => undefined);
    await r.repo.shutdown();
  }, 120_000);

  test("a save of a title the personal layer holds lands in the personal layer and the wiki shows the edit", async () => {
    const boundary = new ManualBoundary();
    const r = await shoreRig({ boundary, upperSlots: true });
    const mine = "lar:///t/route/held-by-personal";
    const canonTitle = "lar:///t/route/held-by-canon";
    await r.personal.put({ tiddler: { title: mine, text: "personal text" } }, remote);
    await r.canon.put({ tiddler: { title: canonTitle, text: "canon text" } }, remote);
    await turns();
    await r.adaptor.armSeedCheckpoint();
    await r.adaptor.landingIdle();
    expect(r.adaptor.ledger.landedOf(mine)!.bag).toBe(personalBag);
    const workingBefore = heads(r, workingBag);

    const mark = r.calls.length;
    r.wiki.addTiddler(new r.Tiddler(r.wiki.getTiddler(mine)!.fields, { text: "edited by hand" }));
    await hand(r, boundary);
    expect(r.calls.slice(mark).filter((c) => c.puts.includes(mine)).map((c) => c.bag), "the save lands where the title lives").toEqual([personalBag]);
    expect(storeText(r, personalBag, mine)).toBe("edited by hand");
    expect(heads(r, workingBag), "the working layer takes nothing").toBe(workingBefore);
    expect(r.wiki.getTiddler(mine)!.fields.text, "the wiki shows the edit").toBe("edited by hand");
    expect((await r.composite.resolveLayered(mine))!.record.tiddler.text).toBe("edited by hand");

    // CONTROL: a canon title's save lands in the working layer.
    const canonBefore = heads(r, canonBag);
    const controlMark = r.calls.length;
    r.wiki.addTiddler(new r.Tiddler(r.wiki.getTiddler(canonTitle)!.fields, { text: "copied up" }));
    await hand(r, boundary);
    expect(r.calls.slice(controlMark).filter((c) => c.puts.includes(canonTitle)).map((c) => c.bag)).toEqual([workingBag]);
    expect(heads(r, canonBag)).toBe(canonBefore);
    expect(r.wiki.getTiddler(canonTitle)!.fields.text).toBe("copied up");
    await r.stop();
  }, 120_000);

  test("a title a tombstone hides from the personal layer is re-created there, so the wiki keeps showing it", async () => {
    const boundary = new ManualBoundary();
    const r = await shoreRig({ boundary, upperSlots: true });
    const x = "lar:///t/route/hidden-then-recreated";
    await r.personal.put({ tiddler: { title: x, text: "personal text" } }, remote);
    await turns();
    await r.adaptor.armSeedCheckpoint();
    await r.adaptor.landingIdle();
    r.wiki.deleteTiddler(x);
    await hand(r, boundary);
    expect(storeDeleted(r, personalBag, x)).toBe(true);
    r.wiki.addTiddler(new r.Tiddler({ title: x, text: "back again" }));
    await hand(r, boundary);
    expect(storeText(r, personalBag, x)).toBe("back again");
    expect(r.doc(workingBag).tiddlers[x], "the working layer holds no record").toBeUndefined();
    expect(r.wiki.getTiddler(x)!.fields.text).toBe("back again");
    await r.stop();
  }, 120_000);

  test("view state a canon bag ships is hidden from the layer its save lands in, never from canon or the working layer", async () => {
    const boundary = new ManualBoundary();
    const r = await shoreRig({ boundary, canonWritable: true, upperSlots: true });
    const session = "$:/state/shipped-by-canon";
    const folded = "$:/state/folded/shipped-by-canon";
    const story = "$:/StoryList";
    await r.canon.put({ tiddler: { title: session, text: "open" } }, remote);
    await r.canon.put({ tiddler: { title: folded, text: "hide" } }, remote);
    await turns();
    await r.adaptor.armSeedCheckpoint();
    await r.adaptor.landingIdle();
    const canonBefore = heads(r, canonBag);
    const workingBefore = heads(r, workingBag);

    const mark = r.calls.length;
    r.wiki.deleteTiddler(session);
    r.wiki.deleteTiddler(folded);
    await hand(r, boundary);
    const deletes = r.calls.slice(mark);
    expect(deletes.filter((c) => c.deletes.includes(session)).map((c) => c.bag), "session state hides from the temp layer").toEqual([tempBag]);
    expect(deletes.filter((c) => c.deletes.includes(folded)).map((c) => c.bag), "a person's view state hides from the personal layer").toEqual([personalBag]);
    expect((await r.temp.get(session))?.meta?.deleted).toBe(true);
    expect(storeDeleted(r, personalBag, folded)).toBe(true);
    expect(heads(r, canonBag), "canon takes no tombstone").toBe(canonBefore);
    expect(heads(r, workingBag), "the working layer takes no tombstone").toBe(workingBefore);
    expect(r.wiki.getTiddler(session)).toBeUndefined();
    expect(r.wiki.getTiddler(folded)).toBeUndefined();

    // CONTROL: the story list routes to the personal layer; ordinary canon content hides from working.
    const storyMark = r.calls.length;
    r.wiki.addTiddler(new r.Tiddler({ title: story, list: "HelloThere" }));
    await hand(r, boundary);
    expect(r.calls.slice(storyMark).filter((c) => c.puts.includes(story)).map((c) => c.bag)).toEqual([personalBag]);
    expect(heads(r, workingBag)).toBe(workingBefore);
    const plain = "lar:///t/route/plain-canon";
    await r.canon.put({ tiddler: { title: plain, text: "canon text" } }, remote);
    await turns(16);
    await r.adaptor.landingIdle();
    r.wiki.deleteTiddler(plain);
    await hand(r, boundary);
    expect(storeDeleted(r, workingBag, plain)).toBe(true);
    await r.stop();
  }, 120_000);

  test("a parent whose edit removes its last child reference tombstones that child through the one router", async () => {
    for (const childBag of [workingBag, canonBag]) {
      const boundary = new ManualBoundary();
      const r = await shoreRig({ boundary, upperSlots: true });
      const root = `lar:///t/route/last-child-${childBag === canonBag ? "canon" : "working"}`;
      const child = `${root}#/a`;
      const bare = `${root}-never-had-children`;
      const store = childBag === canonBag ? r.canon : r.working;
      await store.writeFamily([
        { tiddler: { title: root, text: "intro\n\n<<~ kahea ahu slot=`#/a`>>\n", type: "text/memetic-wikitext+tiddlywiki" } },
        { tiddler: { title: child, text: "slot body", "$fragment-parent": root, "$slot": "#/a" } },
        { tiddler: { title: bare, text: "prose", type: "text/memetic-wikitext+tiddlywiki" } },
      ], [], remote);
      await turns();
      await r.adaptor.armSeedCheckpoint();
      await r.adaptor.landingIdle();
      const canonBefore = heads(r, canonBag);

      const mark = r.calls.length;
      r.wiki.addTiddler(new r.Tiddler(r.wiki.getTiddler(root)!.fields, { text: "intro alone\n" }));
      await hand(r, boundary);
      const issued = r.calls.slice(mark);
      expect(issued.filter((c) => c.deletes.includes(child)).map((c) => c.bag), "the orphan's tombstone lands in the working layer").toEqual([workingBag]);
      expect(storeDeleted(r, workingBag, child)).toBe(true);
      expect(heads(r, canonBag), "canon takes no write").toBe(canonBefore);
      expect(r.wiki.getTiddler(child), "the wiki sheds the child").toBeUndefined();
      expect(storeText(r, workingBag, root)).toBe("intro alone\n");

      // CONTROL: a parent that never referenced a child writes no tombstone.
      const bareMark = r.calls.length;
      r.wiki.addTiddler(new r.Tiddler(r.wiki.getTiddler(bare)!.fields, { text: "prose, edited" }));
      await hand(r, boundary);
      expect(r.calls.slice(bareMark).flatMap((c) => c.deletes)).toEqual([]);
      // CONTROL: an edit that keeps the reference keeps the child.
      await r.stop();
    }
  }, 120_000);

  test("a parent edit that keeps its child reference writes no tombstone", async () => {
    const boundary = new ManualBoundary();
    const r = await shoreRig({ boundary });
    const root = "lar:///t/route/keeps-child";
    const child = `${root}#/a`;
    await r.working.writeFamily([
      { tiddler: { title: root, text: "intro\n\n<<~ kahea ahu slot=`#/a`>>\n", type: "text/memetic-wikitext+tiddlywiki" } },
      { tiddler: { title: child, text: "slot body", "$fragment-parent": root, "$slot": "#/a" } },
    ], [], remote);
    await turns();
    await r.adaptor.armSeedCheckpoint();
    await r.adaptor.landingIdle();
    const mark = r.calls.length;
    r.wiki.addTiddler(new r.Tiddler(r.wiki.getTiddler(root)!.fields, { text: "intro, edited\n\n<<~ kahea ahu slot=`#/a`>>\n" }));
    await hand(r, boundary);
    expect(r.calls.slice(mark).flatMap((c) => c.deletes)).toEqual([]);
    expect(storeText(r, workingBag, child)).toBe("slot body");
    expect(storeDeleted(r, workingBag, child)).toBe(false);
    await r.stop();
  }, 120_000);

  test("a reference quoted inside a code fence names no child: removing the quote tombstones nothing", async () => {
    const boundary = new ManualBoundary();
    const r = await shoreRig({ boundary });
    const root = "lar:///t/route/quotes-a-reference";
    const child = `${root}#/a`;
    const fenced = "prose\n\n```\n<<~ kahea ahu slot=`#/a`>>\n```\n";
    await r.working.writeFamily([
      { tiddler: { title: root, text: fenced, type: "text/memetic-wikitext+tiddlywiki" } },
      { tiddler: { title: child, text: "a record at the quoted address", "$fragment-parent": "lar:///t/route/another-parent" } },
    ], [], remote);
    await turns();
    await r.adaptor.armSeedCheckpoint();
    await r.adaptor.landingIdle();
    const mark = r.calls.length;
    r.wiki.addTiddler(new r.Tiddler(r.wiki.getTiddler(root)!.fields, { text: "prose alone\n" }));
    await hand(r, boundary);
    expect(r.calls.slice(mark).flatMap((c) => c.deletes)).toEqual([]);
    expect(storeText(r, workingBag, child)).toBe("a record at the quoted address");
    await r.stop();
  }, 120_000);

  test("a removed child takes its own slot children with it", async () => {
    const boundary = new ManualBoundary();
    const r = await shoreRig({ boundary });
    const root = "lar:///t/route/nested";
    const child = `${root}#/a`;
    const grandchild = `${root}#/a/b`;
    await r.working.writeFamily([
      { tiddler: { title: root, text: "intro\n\n<<~ kahea ahu slot=`#/a`>>\n", type: "text/memetic-wikitext+tiddlywiki" } },
      { tiddler: { title: child, text: "<<~ kahea ahu slot=`#/a/b`>>", "$fragment-parent": root, "$slot": "#/a" } },
      { tiddler: { title: grandchild, text: "deep body", "$fragment-parent": child, "$slot": "#/a/b" } },
    ], [], remote);
    await turns();
    await r.adaptor.armSeedCheckpoint();
    await r.adaptor.landingIdle();
    r.wiki.addTiddler(new r.Tiddler(r.wiki.getTiddler(root)!.fields, { text: "intro alone\n" }));
    await hand(r, boundary);
    expect(storeDeleted(r, workingBag, child)).toBe(true);
    expect(storeDeleted(r, workingBag, grandchild)).toBe(true);
    expect(r.wiki.getTiddler(grandchild)).toBeUndefined();
    await r.stop();
  }, 120_000);

  test("a title a residency move retracted from the personal layer draws no save back there", async () => {
    const boundary = new ManualBoundary();
    let hold = false;
    let release!: () => void;
    const held = new Promise<void>((resolve) => { release = resolve; });
    const r = await shoreRig({ boundary, upperSlots: true, yieldHost: async () => { if (hold) await held; } });
    const x = "lar:///t/route/retracted-from-personal";
    await r.personal.put({ tiddler: { title: x, text: "personal text" } }, remote);
    await turns();
    await r.adaptor.armSeedCheckpoint();
    await r.adaptor.landingIdle();
    expect(r.adaptor.ledger.landedOf(x)!.bag).toBe(personalBag);
    // The retraction stands in the store while its wave waits in the queue: the ledger still names personal.
    hold = true;
    await r.personal.remove(x, remote);
    await turns(4);
    expect(r.doc(personalBag).tiddlers[x], "the personal layer holds no record").toBeUndefined();
    expect(r.adaptor.ledger.landedOf(x)!.bag).toBe(personalBag);
    const mark = r.calls.length;
    r.wiki.addTiddler(new r.Tiddler({ title: x, text: "edited by hand" }));
    await afterDispatch();
    boundary.fire();
    hold = false;
    release();
    await turns(48);
    await r.adaptor.landingIdle();
    expect(r.calls.slice(mark).filter((c) => c.bag === personalBag), "no write reaches the personal layer").toEqual([]);
    expect(r.doc(personalBag).tiddlers[x], "nothing recreates the retracted record").toBeUndefined();
    // The hand built on a record that left: its value surfaces as a parallel draft, and nothing gets lost.
    const kept = Object.values(r.doc(draftBag).tiddlers).filter((rec) => !rec.meta?.deleted && rec.tiddler["draft.of"] === x);
    expect(kept.map((rec) => rec.tiddler.text)).toEqual(["edited by hand"]);
    await r.stop();
  }, 120_000);
});
