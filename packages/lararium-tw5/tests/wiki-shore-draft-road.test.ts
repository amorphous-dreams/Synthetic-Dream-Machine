/**
 * The draft road of the wiki shore. A draft is an ordinary tiddler carrying `draft.of`; the shore reads
 * from it only which base a save carries and which titles form one discrete act. Each vector drives the
 * wiki as TiddlyWiki does (`addTiddler` of the draft, then the synchronous save sequence), asserts the
 * store calls SYNCHRONOUSLY after the one `change` dispatch with every timer unfired, and pairs with a
 * control in the same test.
 */
import { describe, expect, test } from "vitest";
import { type LarTiddlerRecord } from "@lararium/mesh";
import { wikiSkip, skipNote } from "./test-wiki.js";
import { sameHeads } from "../src/draft-book.js";
import { parallelDraftAlertTitle, unroutedSaveAlertTitle } from "../src/island-adaptor.js";
import {
  afterDispatch, arrived, atDispatch, canonBag, draftBag, draftTitleOf, ManualBoundary, openDraft, peerWrite, remote, saveSequence,
  shoreRig, storeDeleted, storeText, turns, typeInto, workingBag, type Rig,
} from "./wiki-shore-rig.js";

const seedRecords = async (r: Rig, records: readonly Record<string, unknown>[]): Promise<void> => {
  const before = r.arrivals.length;
  for (const tiddler of records) await r.working.put({ tiddler } as LarTiddlerRecord, remote);
  await arrived(r, before, records.map((tiddler) => String(tiddler["title"])));
};
const touching = (r: Rig, since: number, title: string) => r.calls.slice(since).filter((c) => c.puts.includes(title) || c.deletes.includes(title));
const textsOf = async (r: Rig, title: string): Promise<string[]> =>
  (await r.working.parallelDrafts(title)).map((d) => String(d.tiddler.text)).sort();
const keptDrafts = (r: Rig, target: string): Array<Record<string, unknown>> =>
  Object.values(r.doc(draftBag).tiddlers).filter((rec) => !rec.meta?.deleted && rec.tiddler["lar-conflict-fields"] !== undefined && rec.tiddler["draft.of"] === target).map((rec) => rec.tiddler as Record<string, unknown>);

describe.skipIf(wikiSkip)(`wiki shore draft road${skipNote}`, () => {
  test("R + control: a save act leaves in the dispatch turn with the draft-open base and no timer", async () => {
    const boundary = new ManualBoundary();
    const r = await shoreRig({ boundary });
    const x = "lar:///t/road/R";
    await seedRecords(r, [{ title: x, text: "landed" }]);
    await r.adaptor.armSeedCheckpoint();
    const base = r.adaptor.ledger.landedOf(x)!.heads!;
    const d = openDraft(r, x, "keystroke 0");
    await afterDispatch();
    for (let i = 1; i <= 20; i++) { typeInto(r, d, `keystroke ${i}`); await turns(1); }
    boundary.fire();
    await turns(16);
    expect(touching(r, 0, x), "no write for X before the save").toEqual([]);
    const draftRecord = r.doc(draftBag).tiddlers[d]!.tiddler;
    expect({ bag: draftRecord["lar-draft-base-bag"], heads: draftRecord["lar-draft-base-heads"] }).toEqual({ bag: workingBag, heads: base.join(" ") });

    expect(r.wiki.getTiddler(d)!.fields["lar-draft-base-bag"], "the wiki's draft never holds the base fields").toBeUndefined();
    expect(r.wiki.getTiddler(d)!.fields["lar-draft-base-heads"]).toBeUndefined();
    const mark = r.calls.length;
    const during = atDispatch(r);
    saveSequence(r, d);
    await afterDispatch();
    expect(r.calls.slice(mark, during.seen()).filter((c) => c.puts.includes(x)), "issued inside the dispatch itself").toHaveLength(1);
    const act = touching(r, mark, x);
    expect(act, "X leaves in the turn of the dispatch, before any timer fires").toHaveLength(1);
    expect(act[0]!.bag).toBe(workingBag);
    expect(act[0]!.base).toEqual(base);
    expect(boundary.pending(), "no boundary stays pending for D or X").toBe(0);
    await turns(20);
    expect(touching(r, mark, x)).toHaveLength(1);
    expect(storeText(r, workingBag, x)).toBe("keystroke 20");
    expect(storeDeleted(r, draftBag, d), "D reads deleted in the draft layer").toBe(true);
    expect(r.wiki.getTiddler(d)).toBeUndefined();

    const z = "lar:///t/road/R-control";
    const markZ = r.calls.length;
    r.wiki.addTiddler(new r.Tiddler({ title: z, text: "ordinary hand" }));
    await afterDispatch();
    expect(touching(r, markZ, z), "an ordinary hand still rides the gate").toEqual([]);
    boundary.fire();
    await turns(16);
    expect(touching(r, markZ, z)).toHaveLength(1);
    await r.stop();
  }, 120_000);

  test("S + control: a target that moved while the draft stood surfaces both values; another field merges clean", async () => {
    const boundary = new ManualBoundary();
    const r = await shoreRig({ boundary });
    const x = "lar:///t/road/S";
    const clean = "lar:///t/road/S-clean";
    await seedRecords(r, [{ title: x, text: "landed" }, { title: clean, text: "landed" }]);
    await r.adaptor.armSeedCheckpoint();
    const base = r.adaptor.ledger.landedOf(x)!.heads!;
    const d = openDraft(r, x, "hand value");
    const dClean = openDraft(r, clean, "hand value");
    await afterDispatch();
    boundary.fire();
    await turns(16);
    await peerWrite(r, workingBag, [{ tiddler: { title: x, text: "remote value" } }, { tiddler: { title: clean, text: "landed", type: "text/x-other" } }]);
    await turns(16);
    expect(r.adaptor.ledger.landedOf(x)!.heads, "the ledger moved with the remote wave").not.toEqual(base);

    const mark = r.calls.length;
    saveSequence(r, d);
    saveSequence(r, dClean);
    await afterDispatch();
    expect(touching(r, mark, x)[0]!.base, "the draft-open base, never the ledger's current heads").toEqual(base);
    await turns(24);
    expect(await textsOf(r, x)).toEqual(["hand value", "remote value"]);
    expect(keptDrafts(r, x), "the off-live value persists in the draft layer").toHaveLength(1);
    expect(await textsOf(r, clean)).toEqual([]);
    expect(storeText(r, workingBag, clean)).toBe("hand value");
    expect(keptDrafts(r, clean)).toEqual([]);
    expect(r.doc(workingBag).tiddlers[clean]!.tiddler.type).toBe("text/x-other");
    await r.stop();
  }, 120_000);

  test("T + control: a rename to an absent title is one change in the target bag and one in the draft bag", async () => {
    const boundary = new ManualBoundary();
    const r = await shoreRig({ boundary });
    const x = "lar:///t/road/T-from";
    const y = "lar:///t/road/T-to";
    const plain = "lar:///t/road/T-plain";
    await seedRecords(r, [{ title: x, text: "landed" }, { title: plain, text: "landed" }]);
    await r.adaptor.armSeedCheckpoint();
    const base = r.adaptor.ledger.landedOf(x)!.heads!;
    const d = openDraft(r, x, "renamed text");
    typeInto(r, d, "renamed text", { "draft.title": y });
    const dPlain = openDraft(r, plain, "plain text");
    await afterDispatch();
    boundary.fire();
    await turns(16);

    const working = r.changes(workingBag);
    const drafts = r.changes(draftBag);
    const mark = r.calls.length;
    const during = atDispatch(r);
    saveSequence(r, d);
    await afterDispatch();
    expect(r.calls.slice(mark, during.seen()), "all of the act is issued inside the dispatch itself").toHaveLength(2);
    const act = r.calls.slice(mark);
    const family = act.filter((c) => c.bag === workingBag);
    expect(family, "Y's family and X's tombstone ride ONE call at the draft-open base").toHaveLength(1);
    expect(family[0]!.puts).toEqual([y]);
    expect(family[0]!.deletes).toEqual([x]);
    expect(family[0]!.base).toEqual(base);
    expect(act.filter((c) => c.bag === draftBag && c.deletes.includes(d))).toHaveLength(1);
    await turns(24);
    expect(r.changes(workingBag) - working, "one Automerge change in the target bag").toBe(1);
    expect(r.changes(draftBag) - drafts, "one Automerge change in the draft bag").toBe(1);
    expect(storeText(r, workingBag, y)).toBe("renamed text");
    expect(storeDeleted(r, workingBag, x)).toBe(true);
    expect(storeDeleted(r, draftBag, d)).toBe(true);
    expect(r.wiki.getTiddler(d)).toBeUndefined();

    const markPlain = r.calls.length;
    const workingPlain = r.changes(workingBag);
    saveSequence(r, dPlain);
    await afterDispatch();
    await turns(24);
    expect(touching(r, markPlain, plain)).toHaveLength(1);
    expect(r.changes(workingBag) - workingPlain, "a plain save is one change too").toBe(1);
    await r.stop();
  }, 120_000);

  test("RED: y's landed base does not stand while its landing is held — CONTROL: it stands, distinct from x's, once landingIdle resolves", async () => {
    const boundary = new ManualBoundary();
    let hold = false;
    let release!: () => void;
    const held = new Promise<void>((resolve) => { release = resolve; });
    const r = await shoreRig({ boundary, yieldHost: async () => { if (hold) await held; } });
    const x = "lar:///t/road/T2-ledger-from";
    const y = "lar:///t/road/T2-ledger-to";
    await seedRecords(r, [{ title: x, text: "landed x" }]);
    await r.adaptor.armSeedCheckpoint();
    await r.adaptor.landingIdle();
    const xBase = r.adaptor.ledger.landedOf(x)!.heads!;
    hold = true;
    await r.working.put({ tiddler: { title: y, text: "landed y" } }, remote);
    expect(r.adaptor.ledger.landedOf(y)?.heads, "the landing is held: the ledger holds no base for y yet").toBeUndefined();
    hold = false;
    release();
    await r.adaptor.landingIdle();
    const yBase = r.adaptor.ledger.landedOf(y)?.heads;
    expect(yBase, "after landingIdle y's base stands").toBeDefined();
    expect(yBase).not.toEqual(xBase);
    await r.stop();
  }, 120_000);

  test("T2 + control: a rename onto a standing title proceeds on Y's landed base; a Y that moved surfaces both values", async () => {
    for (const moved of [false, true]) {
      const boundary = new ManualBoundary();
      let hold = false;
      let release!: () => void;
      const held = new Promise<void>((resolve) => { release = resolve; });
      const r = await shoreRig({ boundary, yieldHost: async () => { if (hold) await held; } });
      const x = `lar:///t/road/T2-${moved}-from`;
      const y = `lar:///t/road/T2-${moved}-to`;
      await seedRecords(r, [{ title: x, text: "landed x" }]);
      await r.adaptor.armSeedCheckpoint();
      await r.adaptor.landingIdle();
      expect(r.adaptor.ledger.landedOf(x)).toBeDefined();
      const yMark = r.arrivals.length;
      await r.working.put({ tiddler: { title: y, text: "landed y" } }, remote);
      // The base is read once the store has raised y and the landing ledger says every queued landing finished.
      await arrived(r, yMark, [y]);
      await r.adaptor.landingIdle();
      const xBase = r.adaptor.ledger.landedOf(x)!.heads!;
      const yBase = r.adaptor.ledger.landedOf(y)!.heads!;
      expect(yBase).not.toEqual(xBase);
      const d = openDraft(r, x, "hand value");
      typeInto(r, d, "hand value", { "draft.title": y });
      const draftMark = r.arrivals.length;
      await afterDispatch();
      boundary.fire();
      await arrived(r, draftMark, [d]);
      await r.adaptor.landingIdle();
      if (moved) {
        hold = true;
        await peerWrite(r, workingBag, [{ tiddler: { title: y, text: "peer value" } }]);
      }
      const mark = r.calls.length;
      saveSequence(r, d);
      await afterDispatch();
      const act = r.calls.slice(mark).filter((c) => c.bag === workingBag);
      expect(act.map((c) => c.puts.concat(c.deletes)), "Y first, then X").toEqual([[y], [x]]);
      expect(act[0]!.base, "Y carries its landed base").toEqual(yBase);
      expect(act[1]!.base, "X's tombstone carries the draft-open base").toEqual(xBase);
      if (moved) { hold = false; release(); }
      await turns(24);
      expect(storeDeleted(r, workingBag, x)).toBe(true);
      expect(storeDeleted(r, draftBag, d), "D reads deleted in the draft layer").toBe(true);
      if (moved) {
        expect(await textsOf(r, y), "both values of the raced field surface").toEqual(["hand value", "peer value"]);
      } else {
        expect(storeText(r, workingBag, y)).toBe("hand value");
        expect(await textsOf(r, y)).toEqual([]);
      }
      await r.stop();
    }
  }, 120_000);

  test("U + control: a cancel writes nothing for X; a draft that never left produces no store call", async () => {
    const boundary = new ManualBoundary();
    const r = await shoreRig({ boundary });
    const x = "lar:///t/road/U";
    const quick = "lar:///t/road/U-quick";
    await seedRecords(r, [{ title: x, text: "landed" }, { title: quick, text: "landed" }]);
    await r.adaptor.armSeedCheckpoint();
    const d = openDraft(r, x, "abandoned");
    await afterDispatch();
    boundary.fire();
    await turns(24);
    const dHeads = r.adaptor.ledger.landedOf(d)!.heads!;
    const workingChanges = r.changes(workingBag);

    const mark = r.calls.length;
    const during = atDispatch(r);
    r.wiki.deleteTiddler(d);
    await afterDispatch();
    expect(r.calls.slice(mark, during.seen()), "the tombstone is issued inside the dispatch itself").toHaveLength(1);
    expect(touching(r, mark, x), "0 writes for X").toEqual([]);
    const cancel = r.calls.slice(mark);
    expect(cancel).toHaveLength(1);
    expect(cancel[0]!.bag).toBe(draftBag);
    expect(cancel[0]!.deletes).toEqual([d]);
    expect(cancel[0]!.base, "D's own landed base").toEqual(dHeads);
    await turns(16);
    expect(storeDeleted(r, draftBag, d)).toBe(true);
    expect(r.changes(workingBag)).toBe(workingChanges);

    const dQuick = openDraft(r, quick, "never left");
    await afterDispatch();
    const markQuick = r.calls.length;
    r.wiki.deleteTiddler(dQuick);
    await afterDispatch();
    boundary.fire();
    await turns(16);
    expect(r.calls.slice(markQuick), "a draft that never reached the store leaves nothing").toEqual([]);
    expect(boundary.pending()).toBe(0);
    await r.stop();
  }, 120_000);

  test("V + control: a draft opened on one device is saved on another with the base the draft record carries", async () => {
    for (const moved of [true, false]) {
      const boundaryA = new ManualBoundary();
      const boundaryB = new ManualBoundary();
      const a = await shoreRig({ instanceId: "shore-A", boundary: boundaryA });
      const x = `lar:///t/road/V-${moved}`;
      await seedRecords(a, [{ title: x, text: "landed" }]);
      await a.adaptor.armSeedCheckpoint();
      const openedAt = a.adaptor.ledger.landedOf(x)!.heads!;
      const d = openDraft(a, x, "written on A");
      await afterDispatch();
      boundaryA.fire();
      await turns(24);
      expect(a.doc(draftBag).tiddlers[d]!.tiddler["lar-draft-base-heads"]).toBe(openedAt.join(" "));
      if (moved) await peerWrite(a, workingBag, [{ tiddler: { title: x, text: "remote value" } }]);
      await turns(8);

      const b = await shoreRig({ instanceId: "shore-B", boundary: boundaryB, docs: a.saved() });
      b.canon.emitInitialReplay(); b.working.emitInitialReplay(); b.draft.emitInitialReplay();
      await b.adaptor.armSeedCheckpoint();
      expect(b.wiki.getTiddler(d), "the draft arrived by a wave").toBeDefined();
      if (moved) expect(b.adaptor.ledger.landedOf(x)!.heads).not.toEqual(openedAt);

      const mark = b.calls.length;
      saveSequence(b, d);
      await afterDispatch();
      const act = touching(b, mark, x);
      expect(act).toHaveLength(1);
      expect(act[0]!.base, "the base A persisted on the draft record").toEqual(openedAt);
      await turns(24);
      if (moved) {
        expect(await textsOf(b, x)).toEqual(["remote value", "written on A"]);
        expect(keptDrafts(b, x), "the off-live value persists in B's draft layer").toHaveLength(1);
      } else {
        expect(storeText(b, workingBag, x)).toBe("written on A");
        expect(await textsOf(b, x)).toEqual([]);
      }
      await b.stop();
      await a.stop();
    }
  }, 120_000);

  test("pacing control: thirty keystrokes on a draft end at the last text and never leave as more writes than keystrokes", async () => {
    const boundary = new ManualBoundary();
    const r = await shoreRig({ boundary });
    const x = "lar:///t/road/pacing";
    await seedRecords(r, [{ title: x, text: "landed" }]);
    await r.adaptor.armSeedCheckpoint();
    const d = openDraft(r, x, "k0");
    await afterDispatch();
    // Marks gather while no boundary crosses; the store's own landings are the boundaries that release them,
    // so a burst that outruns the store leaves in fewer writes than keystrokes.
    for (let i = 1; i <= 30; i++) { typeInto(r, d, `k${i}`); }
    await afterDispatch();
    expect(touching(r, 0, d), "a burst inside one dispatch turn leaves nothing before a boundary").toEqual([]);
    boundary.fire();
    await turns(16);
    expect(touching(r, 0, d), "thirty keystrokes of one burst leave as one write").toHaveLength(1);
    expect(storeText(r, draftBag, d)).toBe("k30");
    await r.stop();
  }, 120_000);

  test("a save act right after opening the draft writes X once and leaves no draft behind", async () => {
    const boundary = new ManualBoundary();
    const r = await shoreRig({ boundary });
    const x = "lar:///t/road/quick-save";
    await seedRecords(r, [{ title: x, text: "landed" }]);
    await r.adaptor.armSeedCheckpoint();
    const d = openDraft(r, x, "quick");
    await afterDispatch();
    const mark = r.calls.length;
    saveSequence(r, d);
    await afterDispatch();
    expect(touching(r, mark, x)).toHaveLength(1);
    boundary.fire();
    await turns(24);
    expect(touching(r, 0, d), "D never reached the store, so nothing is written for it").toEqual([]);
    expect(r.doc(draftBag).tiddlers[d]).toBeUndefined();
    expect(r.wiki.getTiddler(d)).toBeUndefined();
    expect(storeText(r, workingBag, x)).toBe("quick");
    await r.stop();
  }, 120_000);

  test("family: a save act over a carrier body lands root and child in one change and tombstones the orphan", async () => {
    const boundary = new ManualBoundary();
    const r = await shoreRig({ boundary });
    const x = "lar:///t/road/carrier";
    const orphan = `${x}#/gone`;
    await seedRecords(r, [{ title: x, text: "plain" }, { title: orphan, text: "old child", "$fragment-parent": x }]);
    await r.adaptor.armSeedCheckpoint();
    const body = `<<^ code="&#x0001;" from="?" -> to="${x}">>\n<<^ code="&#x0002;">>\n\n\`\`\`toml meta\nuri-path = "${x.slice(7)}"\n\`\`\`\n\n<<~ ahu #/a>>\n\n! body\n\n<<~/ahu>>\n\n<<^ code="&#x0003;">>\n\n<<^ code="&#x0004;" -> to="?">>\n`;
    const d = openDraft(r, x, "");
    await afterDispatch();
    typeInto(r, d, body);
    await afterDispatch();
    boundary.fire();
    await turns(24);
    const working = r.changes(workingBag);
    const mark = r.calls.length;
    saveSequence(r, d);
    await afterDispatch();
    const act = r.calls.slice(mark).filter((c) => c.bag === workingBag);
    expect(act, "root, child and orphan tombstone ride one call").toHaveLength(1);
    expect(act[0]!.puts).toContain(x);
    expect(act[0]!.puts.some((p) => p.startsWith(`${x}#`) && p !== orphan)).toBe(true);
    expect(act[0]!.deletes).toEqual([orphan]);
    await turns(24);
    expect(r.changes(workingBag) - working).toBe(1);
    const stored = r.doc(workingBag).tiddlers[x]!.tiddler;
    expect(stored["$origin-bag"], "the host stamp never persists").toBeUndefined();
    expect(stored["lar-draft-base-bag"], "a non-draft carries no draft-base field").toBeUndefined();
    expect(stored["lar-draft-base-heads"]).toBeUndefined();
    expect(storeDeleted(r, workingBag, orphan)).toBe(true);
    await r.stop();
  }, 120_000);

  test("navigator: TiddlyWiki's own edit, save, rename and cancel handlers drive the same acts", async () => {
    const boundary = new ManualBoundary();
    const r = await shoreRig({ boundary });
    const x = "lar:///t/road/nav";
    const y = "lar:///t/road/nav-renamed";
    const z = "lar:///t/road/nav-cancel";
    await seedRecords(r, [{ title: x, text: "landed" }, { title: z, text: "landed" }]);
    await r.adaptor.armSeedCheckpoint();
    interface NavWidget { render(parent: unknown, next: unknown): void; children?: NavWidget[]; dispatchEvent(e: unknown): void; handleEditTiddlerEvent?: unknown }
    const $tw = r.engine.$tw as unknown as {
      wiki: { parseText(type: string, text: string): unknown; makeWidget(parser: unknown, options: unknown): NavWidget };
      fakeDocument: { createElement(tag: string): unknown };
    };
    const parser = $tw.wiki.parseText("text/vnd.tiddlywiki", `<$navigator story="$:/StoryList" history="$:/HistoryList"/>`);
    const widget = $tw.wiki.makeWidget(parser, { document: $tw.fakeDocument });
    widget.render($tw.fakeDocument.createElement("div"), null);
    const find = (w: NavWidget): NavWidget | null => { if (typeof w.handleEditTiddlerEvent === "function") return w; for (const c of w.children ?? []) { const f = find(c); if (f) return f; } return null; };
    const navigator = find(widget)!;
    const event = (type: string, tiddlerTitle: string) => ({ type, tiddlerTitle });

    navigator.dispatchEvent(event("tm-edit-tiddler", x));
    const d = draftTitleOf(x);
    await afterDispatch();
    typeInto(r, d, "edited through the navigator", { "draft.title": y });
    boundary.fire();
    await turns(16);
    const mark = r.calls.length;
    navigator.dispatchEvent(event("tm-save-tiddler", d));
    await afterDispatch();
    expect(r.calls.slice(mark).filter((c) => c.bag === workingBag && c.puts.includes(y) && c.deletes.includes(x)), "the rename leaves in the turn").toHaveLength(1);
    await turns(24);
    expect(storeText(r, workingBag, y)).toBe("edited through the navigator");
    expect(storeDeleted(r, workingBag, x)).toBe(true);
    expect(storeDeleted(r, draftBag, d)).toBe(true);

    navigator.dispatchEvent(event("tm-edit-tiddler", z));
    const dz = draftTitleOf(z);
    await afterDispatch();
    boundary.fire();
    await turns(24);
    const markCancel = r.calls.length;
    navigator.dispatchEvent(event("tm-cancel-tiddler", dz));
    await afterDispatch();
    expect(touching(r, markCancel, z)).toEqual([]);
    expect(r.calls.slice(markCancel).filter((c) => c.bag === draftBag && c.deletes.includes(dz))).toHaveLength(1);
    await turns(16);
    expect(storeDeleted(r, draftBag, dz)).toBe(true);
    expect(storeText(r, workingBag, z)).toBe("landed");
    await r.stop();
  }, 120_000);
});

let releaseHeld!: () => void;
describe.skipIf(wikiSkip)(`wiki shore draft road, bases and acts${skipNote}`, () => {
  test("a save over a canon title whose copy-up a peer made surfaces both values; an equal copy-up lands clean", async () => {
    for (const [real, queued] of [[true, false], [true, true], [false, false]] as const) {
      const boundary = new ManualBoundary();
      let hold = false;
      let releaseQueue!: () => void;
      const heldQueue = new Promise<void>((resolve) => { releaseQueue = resolve; });
      const r = await shoreRig({ boundary, yieldHost: async () => { if (hold) await heldQueue; } });
      const x = `lar:///t/road/copyup-${real}-${queued}`;
      await r.canon.put({ tiddler: { title: x, text: "canon text" } }, remote);
      await turns();
      await r.adaptor.armSeedCheckpoint();
      const d = openDraft(r, x, "phone draft");
      await afterDispatch();
      boundary.fire();
      await turns(24);
      // `queued`: the desktop's copy-up merges into the document while its wave still waits in the landing queue.
      hold = queued;
      await peerWrite(r, workingBag, [{ tiddler: { title: x, text: real ? "desktop edit" : "canon text" } }]);
      if (queued) expect(r.adaptor.ledger.landedOf(x)!.bag, "the ledger still says canon").toBe(canonBag);
      else if (real) {
        for (let turn = 0; turn < 400 && r.adaptor.ledger.landedOf(x)!.bag !== workingBag; turn++) await new Promise<void>((resolve) => setTimeout(resolve, 5));
        expect(r.adaptor.ledger.landedOf(x)!.bag, "the desktop's copy-up landed on the phone").toBe(workingBag);
      } else {
        for (let turn = 0; turn < 400 && r.adaptor.ledger.landedOf(x)!.bag !== workingBag; turn++) await new Promise<void>((resolve) => setTimeout(resolve, 5));
        expect(r.adaptor.ledger.landedOf(x)!.bag, "the equal copy-up landed too").toBe(workingBag);
      }
      const mark = r.calls.length;
      saveSequence(r, d);
      await afterDispatch();
      const writes = touching(r, mark, x).filter((c) => c.bag === workingBag);
      await turns(24);
      if (queued) { hold = false; releaseQueue(); await turns(48); }
      if (real) {
        expect(writes, "no write lands over the desktop's edit").toEqual([]);
        expect(storeText(r, workingBag, x)).toBe("desktop edit");
        const kept = keptDrafts(r, x);
        expect(kept, "the phone's value stands in the draft layer").toHaveLength(1);
        expect(kept[0]!.text).toBe("phone draft");
        expect(String(r.wiki.getTiddler(x)!.fields.text)).toBe("desktop edit");
      } else {
        expect(writes).toHaveLength(1);
        expect(storeText(r, workingBag, x)).toBe("phone draft");
        expect(keptDrafts(r, x)).toEqual([]);
      }
      await r.stop();
    }
  }, 120_000);

  test("a save and a rename whose title never persists take zero store calls for that member", async () => {
    const boundary = new ManualBoundary();
    const r = await shoreRig({ boundary });
    const volatile = "lar:///lararium.local.vm/road/scratch";
    const rail = "$:/temp/lares/alert/road";
    const source = "lar:///t/road/volatile-source";
    await seedRecords(r, [{ title: source, text: "landed" }]);
    await r.adaptor.armSeedCheckpoint();
    for (const target of [volatile, rail]) {
      const d = openDraft(r, target, "typed");
      await afterDispatch();
      boundary.fire();
      await turns(16);
      const mark = r.calls.length;
      saveSequence(r, d);
      await afterDispatch();
      await turns(16);
      expect(touching(r, mark, target), `${target} reaches no store`).toEqual([]);
      expect(storeDeleted(r, draftBag, d), "the draft follows the ordinary law: its record is tombstoned").toBe(true);
    }
    const d = openDraft(r, source, "renamed");
    typeInto(r, d, "renamed", { "draft.title": volatile });
    await afterDispatch();
    boundary.fire();
    await turns(16);
    const mark = r.calls.length;
    saveSequence(r, d);
    await afterDispatch();
    await turns(16);
    expect(touching(r, mark, volatile)).toEqual([]);
    expect(storeDeleted(r, workingBag, source), "the source's tombstone still stands").toBe(true);
    await r.stop();
  }, 120_000);

  test("a draft retitled on one device and saved on another saves under the new title", async () => {
    const boundaryA = new ManualBoundary();
    const a = await shoreRig({ instanceId: "shore-A", boundary: boundaryA });
    const x = "lar:///t/road/retitle-from";
    const y = "lar:///t/road/retitle-to";
    await seedRecords(a, [{ title: x, text: "landed" }]);
    await a.adaptor.armSeedCheckpoint();
    const d = openDraft(a, x, "v1");
    await afterDispatch();
    boundaryA.fire();
    await turns(24);
    const b = await shoreRig({ instanceId: "shore-B", boundary: new ManualBoundary(), docs: a.saved() });
    b.canon.emitInitialReplay(); b.working.emitInitialReplay(); b.draft.emitInitialReplay();
    await b.adaptor.armSeedCheckpoint();
    typeInto(a, d, "v2", { "draft.title": y });
    await afterDispatch();
    boundaryA.fire();
    await turns(24);
    const before = b.arrivals.length;
    b.draftHandle.merge(a.draftHandle);
    await arrived(b, before, [d]);
    await b.adaptor.landingIdle();
    expect(b.wiki.getTiddler(d)!.fields["draft.title"]).toBe(y);
    const mark = b.calls.length;
    saveSequence(b, d);
    await afterDispatch();
    expect(touching(b, mark, y).filter((c) => c.puts.includes(y)), "a rename, not a cancel").toHaveLength(1);
    await turns(24);
    expect(storeText(b, workingBag, y)).toBe("v2");
    await b.stop();
    await a.stop();
  }, 120_000);

  test("the base fields ride the store record only: an untouched draft cancels without a confirm, and a second draft opened before the first wave lands builds on this shore's own write", async () => {
    const boundary = new ManualBoundary();
    let hold = false;
    let release!: () => void;
    const held = new Promise<void>((resolve) => { release = resolve; });
    const r = await shoreRig({ boundary, yieldHost: async () => { if (hold) await held; } });
    const x = "lar:///t/road/untouched";
    const z = "lar:///t/road/two-drafts";
    // The draft and target both land in working here, isolating the store-only draft-base fields.
    r.wiki.addTiddler(new r.Tiddler({ title: "lar:///ha.ka.ba/lararium/config/current-wiki-draft", text: workingBag }));
    await seedRecords(r, [{ title: x, text: "landed" }, { title: z, text: "landed" }]);
    await r.adaptor.armSeedCheckpoint();
    interface NavWidget { render(parent: unknown, next: unknown): void; children?: NavWidget[]; dispatchEvent(e: unknown): void; handleEditTiddlerEvent?: unknown }
    const $tw = r.engine.$tw as unknown as { wiki: { parseText(t: string, x: string): unknown; makeWidget(p: unknown, o: unknown): NavWidget }; fakeDocument: { createElement(t: string): unknown } };
    const widget = $tw.wiki.makeWidget($tw.wiki.parseText("text/vnd.tiddlywiki", `<$navigator story="$:/StoryList" history="$:/HistoryList"/>`), { document: $tw.fakeDocument });
    widget.render($tw.fakeDocument.createElement("div"), null);
    const find = (w: NavWidget): NavWidget | null => { if (typeof w.handleEditTiddlerEvent === "function") return w; for (const c of w.children ?? []) { const f = find(c); if (f) return f; } return null; };
    const navigator = find(widget)!;
    const asked = (): string[] => (r.engine.$tw as unknown as { wiki: { getTiddlersWithTag(tag: string): string[] } }).wiki.getTiddlersWithTag("$:/tags/Confirmation");
    const event = (type: string, tiddlerTitle: string) => ({ type, tiddlerTitle });

    navigator.dispatchEvent(event("tm-edit-tiddler", x));
    const d = draftTitleOf(x);
    await afterDispatch();
    boundary.fire();
    await turns(24);
    expect(storeText(r, workingBag, d), "the draft reached the store and its wave returned").toBeDefined();
    expect(r.doc(workingBag).tiddlers[d]!.tiddler["lar-draft-base-bag"], "the store record carries the base").toBe(workingBag);
    expect(r.wiki.getTiddler(d)!.fields["lar-draft-base-bag"], "the wiki's draft does not").toBeUndefined();
    navigator.dispatchEvent(event("tm-cancel-tiddler", d));
    await afterDispatch();
    await turns(16);
    expect(asked(), "TiddlyWiki's own isDraftModified reads an untouched draft as unmodified, so no question parks").toEqual([]);
    expect(storeDeleted(r, workingBag, d)).toBe(true);

    navigator.dispatchEvent(event("tm-edit-tiddler", z));
    const d1 = draftTitleOf(z);
    await afterDispatch();
    typeInto(r, d1, "first save");
    boundary.fire();
    await turns(24);
    hold = true;
    saveSequence(r, d1);
    await afterDispatch();
    await turns(8);
    expect(r.adaptor.ledger.landedOf(z)!.heads, "the first wave has not landed").not.toEqual(r.workingHandle.heads());
    navigator.dispatchEvent(event("tm-edit-tiddler", z));
    await afterDispatch();
    typeInto(r, d1, "second save");
    boundary.fire();
    await turns(24);
    saveSequence(r, d1);
    await afterDispatch();
    await turns(16);
    hold = false;
    release();
    await turns(32);
    expect(await textsOf(r, z), "both saves stand in order, no parallel draft").toEqual([]);
    expect(storeText(r, workingBag, z)).toBe("second save");
    await r.stop();
  }, 120_000);

  test("an act whose refusal crosses a host task stays owed: a wave for the saved title cannot land over it", async () => {
    const boundary = new ManualBoundary();
    const r = await shoreRig({ boundary });
    const x = "lar:///t/road/refused-act";
    await seedRecords(r, [{ title: x, text: "landed" }]);
    await r.adaptor.armSeedCheckpoint();
    const d = openDraft(r, x, "hand text");
    await afterDispatch();
    boundary.fire();
    await turns(24);
    let open!: () => void;
    const draftOpenBase = r.adaptor.ledger.landedOf(x)!.heads!;
    await peerWrite(r, workingBag, [{ tiddler: { title: x, text: "peer before" } }]);
    for (let turn = 0; turn < 400 && sameHeads(r.adaptor.ledger.landedOf(x)!.heads, draftOpenBase); turn++) await new Promise<void>((resolve) => setTimeout(resolve, 5));
    expect(r.adaptor.ledger.landedOf(x)!.heads, "the ledger moved past the draft-open base").not.toEqual(draftOpenBase);
    r.failures.gate = new Promise<void>((resolve) => { open = resolve; });
    r.failures.family = new Error("refused across a host task");
    const mark = r.calls.length;
    saveSequence(r, d);
    await afterDispatch();
    await peerWrite(r, workingBag, [{ tiddler: { title: x, text: "peer text" } }]);
    r.failures.family = null;
    open();
    await turns(48);
    expect(r.wiki.getTiddler(`$:/temp/lares/alert/unsaved/${x}`), "the acknowledged retry clears the alert").toBeUndefined();
    expect(r.adaptor.holdsHand(x)).toBe(false);
    expect(await textsOf(r, x), "the saved value reached the store and meets the peer's as a conflict").toContain("hand text");
    const retry = touching(r, mark, x).filter((c) => c.puts.includes(x)).at(-1)!;
    expect(retry.base, "the retry builds on the act's own base").toEqual(draftOpenBase);
    await r.stop();
  }, 120_000);

  test("a refused rename leaves the source's slot children in the wiki", async () => {
    for (const refuse of [true, false]) {
      const boundary = new ManualBoundary();
      const r = await shoreRig({ boundary });
      const x = `lar:///t/road/slots-${refuse}`;
      const y = `${x}-renamed`;
      const child = `${x}#/c`;
      await seedRecords(r, [{ title: x, text: "landed" }, { title: child, text: "child", "$fragment-parent": x }]);
      await r.adaptor.armSeedCheckpoint();
      const d = openDraft(r, x, "renamed");
      typeInto(r, d, "renamed", { "draft.title": y });
      await afterDispatch();
      boundary.fire();
      await turns(24);
      // The store refuses every write while the refusal stands, a retry included: a wave the store redelivers
      // late lawfully retries the owed tombstone, and the vector reads the refused state, never that retry.
      if (refuse) { r.failures.family = new Error("refused"); r.failures.tombstone = new Error("refused"); }
      saveSequence(r, d);
      await afterDispatch();
      await turns(24);
      await r.adaptor.landingIdle();
      expect(r.wiki.getTiddler(child) !== undefined, refuse ? "the refused tombstone leaves the child" : "the acknowledged tombstone removes the child").toBe(refuse);
      r.failures.family = null;
      r.failures.tombstone = null;
      await r.stop();
    }
  }, 120_000);

  test("a hand no draft layer holds stands on the alert rail before the source's record lands over it", async () => {
    const boundary = new ManualBoundary();
    let hold = false;
    const held = new Promise<void>((resolve) => { releaseHeld = resolve; });
    const r = await shoreRig({ boundary, yieldHost: async () => { if (hold) await held; } });
    const x = "lar:///t/road/unheld";
    await r.canon.put({ tiddler: { title: x, text: "canon text" } }, remote);
    await turns();
    await r.adaptor.armSeedCheckpoint();
    hold = true;
    await peerWrite(r, canonBag, [{ tiddler: { title: x, text: "canon moved" } }]);
    r.wiki.addTiddler(new r.Tiddler({ title: "lar:///ha.ka.ba/lararium/config/current-wiki-draft", text: "" }));
    r.wiki.addTiddler(new r.Tiddler(r.wiki.getTiddler(x)!.fields, { text: "hand text" }));
    await afterDispatch();
    boundary.fire();
    await turns(32);
    hold = false;
    releaseHeld();
    await turns(32);
    const alert = r.wiki.getTiddler(parallelDraftAlertTitle(`Draft of '${x}' by shore-road`));
    expect(alert, "the hand's text survives on the rail").toBeDefined();
    expect(String(alert!.fields["draft-text"])).toBe("hand text");
    expect(r.wiki.getTiddler(unroutedSaveAlertTitle("lar:///ha.ka.ba/lararium/config/current-wiki-draft"))).toBeDefined();
    expect(String(r.wiki.getTiddler(x)!.fields.text)).toBe("canon moved");
    await r.stop();
  }, 120_000);

  test("a draft of an absent title renamed on save tombstones the draft and no source", async () => {
    const boundary = new ManualBoundary();
    const r = await shoreRig({ boundary });
    const x = "lar:///t/road/never-existed";
    const y = "lar:///t/road/created-by-rename";
    await r.adaptor.armSeedCheckpoint();
    const d = openDraft(r, x, "fresh");
    typeInto(r, d, "fresh", { "draft.title": y });
    await afterDispatch();
    boundary.fire();
    await turns(24);
    const mark = r.calls.length;
    saveSequence(r, d);
    await afterDispatch();
    await turns(24);
    expect(touching(r, mark, x), "no tombstone for a source that never stood").toEqual([]);
    expect(storeText(r, workingBag, y)).toBe("fresh");
    expect(storeDeleted(r, draftBag, d)).toBe(true);
    await r.stop();
  }, 120_000);

  test("a cancel of a draft that never reached the store clears its stale unsaved alert", async () => {
    const boundary = new ManualBoundary();
    const r = await shoreRig({ boundary });
    const x = "lar:///t/road/stale-alert";
    await seedRecords(r, [{ title: x, text: "landed" }]);
    await r.adaptor.armSeedCheckpoint();
    r.failures.family = new Error("refused");
    const d = openDraft(r, x, "typing");
    await afterDispatch();
    boundary.fire();
    await turns(16);
    expect(r.wiki.getTiddler(`$:/temp/lares/alert/unsaved/${d}`)).toBeDefined();
    r.failures.family = null;
    r.wiki.deleteTiddler(d);
    await afterDispatch();
    await turns(16);
    expect(r.wiki.getTiddler(`$:/temp/lares/alert/unsaved/${d}`)).toBeUndefined();
    await r.stop();
  }, 120_000);

  test("a draft whose target has no bag persists, the target's refusal stands on the rail, and the draft carries no base", async () => {
    const boundary = new ManualBoundary();
    const r = await shoreRig({ boundary });
    await r.adaptor.armSeedCheckpoint();
    r.wiki.addTiddler(new r.Tiddler({ title: "lar:///ha.ka.ba/lararium/config/current-wiki-bag", text: "" }));
    const x = "lar:///t/road/unroutable-target";
    const d = openDraft(r, x, "typing");
    await afterDispatch();
    boundary.fire();
    await turns(24);
    expect(storeText(r, draftBag, d)).toBe("typing");
    expect(r.doc(draftBag).tiddlers[d]!.tiddler["lar-draft-base-bag"]).toBeUndefined();
    expect(r.wiki.getTiddler(unroutedSaveAlertTitle("lar:///ha.ka.ba/lararium/config/current-wiki-bag"))).toBeDefined();
    await r.stop();
  }, 120_000);

  test("stop waits for a parallel-draft persistence still in flight", async () => {
    const boundary = new ManualBoundary();
    let hold = false;
    const held = new Promise<void>((resolve) => { releaseHeld = resolve; });
    const r = await shoreRig({ boundary, yieldHost: async () => { if (hold) await held; } });
    const x = "lar:///t/road/stop-waits";
    await r.canon.put({ tiddler: { title: x, text: "canon text" } }, remote);
    await turns();
    await r.adaptor.armSeedCheckpoint();
    hold = true;
    await peerWrite(r, canonBag, [{ tiddler: { title: x, text: "canon moved" } }]);
    let open!: () => void;
    r.failures.hold = new Promise<void>((resolve) => { open = resolve; });
    r.wiki.addTiddler(new r.Tiddler(r.wiki.getTiddler(x)!.fields, { text: "hand text" }));
    await afterDispatch();
    boundary.fire();
    await turns(8);
    r.unbridge();
    let stopped = false;
    const stopping = r.adaptor.stop().then(() => { stopped = true; });
    await turns(16);
    expect(stopped, "stop is still waiting on the surfacing").toBe(false);
    hold = false;
    releaseHeld();
    open();
    await stopping;
    expect(keptDrafts(r, x), "the surfaced draft reached the draft layer before stop returned").toHaveLength(1);
    await r.repo.shutdown();
  }, 120_000);
});

describe.skipIf(wikiSkip)(`wiki shore draft road, retries and shadows${skipNote}`, () => {
  test("a rename of a draft whose source overrides a shadow writes the shadow state the wiki shows", async () => {
    const boundary = new ManualBoundary();
    const r = await shoreRig({ boundary });
    const x = "lar:///t/road/shadowed";
    const y = "lar:///t/road/shadowed-renamed";
    const $tw = r.engine.$tw as unknown as { wiki: { addTiddler(t: unknown): void; readPluginInfo(): void; registerPluginTiddlers(t: string): void; unpackPluginTiddlers(): void } };
    $tw.wiki.addTiddler(new r.Tiddler({ title: "$:/plugins/test/shadow", "plugin-type": "plugin", type: "application/json", text: JSON.stringify({ tiddlers: { [x]: { title: x, text: "shadow text" } } }) }));
    $tw.wiki.readPluginInfo(); $tw.wiki.registerPluginTiddlers("plugin"); $tw.wiki.unpackPluginTiddlers();
    await seedRecords(r, [{ title: x, text: "override text" }]);
    await r.adaptor.armSeedCheckpoint();
    const d = openDraft(r, x, "renamed");
    typeInto(r, d, "renamed", { "draft.title": y });
    await afterDispatch();
    boundary.fire();
    await turns(24);
    saveSequence(r, d);
    await afterDispatch();
    expect(String(r.wiki.getTiddler(x)!.fields.text), "the delete reveals the shadow").toBe("shadow text");
    boundary.fire();
    await turns(32);
    expect(storeText(r, workingBag, y)).toBe("renamed");
    expect(storeText(r, workingBag, x), "the store's source equals what the wiki shows at next boot").toBe("shadow text");
    await r.stop();
  }, 120_000);

  test("a refused stray tombstone stays owed as absent and the retry leaves it", async () => {
    const boundary = new ManualBoundary();
    const r = await shoreRig({ boundary });
    const x = "lar:///t/road/stray-root";
    const orphan = `${x}#/gone`;
    await r.working.put({ tiddler: { title: x, text: "plain" } }, remote);
    await r.draft.put({ tiddler: { title: orphan, text: "old child", "$fragment-parent": x } }, remote);
    await turns();
    await r.adaptor.armSeedCheckpoint();
    const body = `<<^ code="&#x0001;" from="?" -> to="${x}">>\n<<^ code="&#x0002;">>\n\n\`\`\`toml meta\nuri-path = "${x.slice(7)}"\n\`\`\`\n\n<<~ ahu #/a>>\n\n! body\n\n<<~/ahu>>\n\n<<^ code="&#x0003;">>\n\n<<^ code="&#x0004;" -> to="?">>\n`;
    const d = openDraft(r, x, "");
    await afterDispatch();
    typeInto(r, d, body);
    await afterDispatch();
    boundary.fire();
    await turns(24);
    r.failures.tombstone = new Error("stray refused");
    saveSequence(r, d);
    await afterDispatch();
    await turns(24);
    expect(r.wiki.getTiddler(`$:/temp/lares/alert/unsaved/${orphan}`), "the refusal stands on the rail").toBeDefined();
    expect(r.adaptor.holdsHand(orphan)).toBe(true);
    r.failures.tombstone = null;
    const mark = r.calls.length;
    r.unbridge();
    await r.adaptor.stop();
    expect(r.calls.slice(mark).filter((c) => c.bag === draftBag && c.deletes.includes(orphan)), "the retry leaves a tombstone").toHaveLength(1);
    await r.repo.shutdown();
  }, 120_000);

  test("a refused cross-bag act retries on the draft-open source base and surfaces a peer's copy-up", async () => {
    const boundary = new ManualBoundary();
    const r = await shoreRig({ boundary });
    const x = "lar:///t/road/refused-cross";
    await r.canon.put({ tiddler: { title: x, text: "canon text" } }, remote);
    await turns();
    await r.adaptor.armSeedCheckpoint();
    const d = openDraft(r, x, "phone draft");
    await afterDispatch();
    boundary.fire();
    await turns(24);
    r.failures.family = new Error("refused");
    saveSequence(r, d);
    await afterDispatch();
    await turns(24);
    r.failures.family = null;
    await peerWrite(r, workingBag, [{ tiddler: { title: x, text: "desktop edit" } }]);
    await turns(64);
    expect(storeText(r, workingBag, x), "the retry never wrote over the desktop's edit").toBe("desktop edit");
    expect(keptDrafts(r, x).map((k) => k.text)).toEqual(["phone draft"]);
    await r.stop();
  }, 120_000);
});
