/**
 * Faults and teardown at the wiki shore: a refused store write surfaces on the alert rail and stays
 * owed; a delete of a title that landed from a layer this wiki cannot write refuses by name and re-lands
 * the record; the dispatch a teardown meets reaches the bridge; the lines that carry the ledger's
 * settled-or-owed account each bind a vector.
 */
import { describe, expect, test } from "vitest";
import { WaveLanding } from "../src/wave-landing.js";
import { wikiSkip, skipNote } from "./test-wiki.js";
import { afterDispatch, ManualTimers, remote, shoreRig, storeDeleted, storeText, turns, workingBag } from "./wiki-shore-rig.js";

const edit = (r: Awaited<ReturnType<typeof shoreRig>>, title: string, text: string): void =>
  r.wiki.addTiddler(new r.Tiddler(r.wiki.getTiddler(title)!.fields, { text }));

describe.skipIf(wikiSkip)(`wiki shore faults${skipNote}`, () => {
  test("a refused store write raises an alert, stays owed, arms no timer and clears when a later write lands", async () => {
    const timers = new ManualTimers();
    const r = await shoreRig({ timers });
    const x = "lar:///t/fault/refused-write";
    await r.working.put({ tiddler: { title: x, text: "landed" } }, remote);
    await turns();
    await r.adaptor.armSeedCheckpoint();
    const alert = `$:/temp/lares/alert/unsaved/${x}`;
    r.failures.family = new Error("disk full");
    edit(r, x, "edit one");
    await afterDispatch();
    timers.fireAll(400);
    await turns(16);
    const raised = r.wiki.getTiddler(alert);
    expect(raised, "the alert stands on the rail").toBeDefined();
    expect(String(raised!.fields.tags)).toContain("$:/tags/Alert");
    expect(String(raised!.fields.text)).toContain(x);
    expect(String(raised!.fields.text)).toContain(workingBag);
    expect(String(raised!.fields.text)).toContain("disk full");
    expect(r.adaptor.holdsHand(x), "the title stays owed").toBe(true);
    expect(timers.armed(), "no retry timer is armed").toBe(0);
    expect(storeText(r, workingBag, x)).toBe("landed");

    r.failures.family = null;
    edit(r, x, "edit two");
    await afterDispatch();
    timers.fireAll(400);
    await turns(24);
    expect(storeText(r, workingBag, x)).toBe("edit two");
    expect(r.wiki.getTiddler(alert), "the acknowledged write clears the alert").toBeUndefined();
    expect(r.adaptor.holdsHand(x)).toBe(false);

    const control = "lar:///t/fault/refused-write-control";
    r.wiki.addTiddler(new r.Tiddler({ title: control, text: "fine" }));
    await afterDispatch();
    timers.fireAll(400);
    await turns(16);
    expect(storeText(r, workingBag, control)).toBe("fine");
    expect(r.wiki.getTiddler(`$:/temp/lares/alert/unsaved/${control}`)).toBeUndefined();
    await r.stop();
  }, 120_000);

  test("a flush queued behind a failed one still tries", async () => {
    const timers = new ManualTimers();
    const r = await shoreRig({ timers });
    const x = "lar:///t/fault/queued-flush";
    await r.working.put({ tiddler: { title: x, text: "landed" } }, remote);
    await turns();
    await r.adaptor.armSeedCheckpoint();
    let open!: () => void;
    r.failures.family = new Error("first write refused");
    r.failures.gate = new Promise<void>((resolve) => { open = resolve; });
    edit(r, x, "edit one");
    await afterDispatch();
    timers.fireAll(400);
    await turns(4);
    edit(r, x, "edit two");
    await afterDispatch();
    timers.fireAll(400);
    await turns(4);
    r.failures.family = null;
    open();
    await turns(24);
    expect(storeText(r, workingBag, x), "the queued flush wrote").toBe("edit two");
    expect(r.wiki.getTiddler(`$:/temp/lares/alert/unsaved/${x}`)).toBeUndefined();
    await r.stop();
  }, 120_000);

  test("a hand delete of a title from a read-only layer refuses by name and re-lands the record", async () => {
    const timers = new ManualTimers();
    const r = await shoreRig({ timers });
    const floor = "lar:///t/fault/floor-record";
    const own = "lar:///t/fault/own-record";
    await r.canon.put({ tiddler: { title: floor, text: "oracle record" } }, remote);
    await r.working.put({ tiddler: { title: own, text: "own record" } }, remote);
    await turns();
    await r.adaptor.armSeedCheckpoint();
    const mark = r.calls.length;
    r.wiki.deleteTiddler(floor);
    await afterDispatch();
    timers.fireAll(400);
    await turns(24);
    const alert = r.wiki.getTiddler(`$:/temp/lares/alert/read-only-delete/${floor}`);
    expect(alert, "the refusal names itself on the rail").toBeDefined();
    expect(String(alert!.fields.tags)).toContain("$:/tags/Alert");
    expect(String(alert!.fields.text)).toContain(floor);
    expect(r.calls.slice(mark), "0 store calls").toEqual([]);
    expect(String(r.wiki.getTiddler(floor)?.fields.text), "the record is back in the wiki").toBe("oracle record");

    r.wiki.deleteTiddler(own);
    await afterDispatch();
    timers.fireAll(400);
    await turns(24);
    expect(r.calls.slice(mark).filter((c) => c.deletes.includes(own)), "a writable layer takes the tombstone").toHaveLength(1);
    expect(storeDeleted(r, workingBag, own)).toBe(true);
    expect(r.wiki.getTiddler(own)).toBeUndefined();
    await r.stop();
  }, 120_000);

  test("a hand whose change has not dispatched meets the bridge when teardown awaits the wiki's dispatch", async () => {
    const timers = new ManualTimers();
    const r = await shoreRig({ timers });
    const x = "lar:///t/fault/undispatched-hand";
    const dispatched = "lar:///t/fault/dispatched-hand";
    await r.working.put({ tiddler: { title: x, text: "landed" } }, remote);
    await r.working.put({ tiddler: { title: dispatched, text: "landed" } }, remote);
    await turns();
    await r.adaptor.armSeedCheckpoint();
    edit(r, dispatched, "typed and dispatched");
    await afterDispatch();
    edit(r, x, "typed, change not yet dispatched");
    await r.adaptor.awaitWikiDispatch();
    r.unbridge();
    await r.adaptor.stop();
    expect(storeText(r, workingBag, dispatched), "control: a dispatched hand leaves at teardown").toBe("typed and dispatched");
    expect(storeText(r, workingBag, x)).toBe("typed, change not yet dispatched");
    await r.repo.shutdown();
  }, 120_000);

  test("a landed own write leaves no hand standing, and a stopped landing queue reads empty", async () => {
    const timers = new ManualTimers();
    const r = await shoreRig({ timers });
    const x = "lar:///t/fault/landed-write";
    await r.working.put({ tiddler: { title: x, text: "landed" } }, remote);
    await turns();
    await r.adaptor.armSeedCheckpoint();
    edit(r, x, "edited");
    await afterDispatch();
    expect(r.adaptor.holdsHand(x)).toBe(true);
    timers.fireAll(400);
    await turns(24);
    expect(r.adaptor.holdsHand(x), "the own wave's landing settles the account").toBe(false);
    await r.stop();

    let release!: () => void;
    const held = new Promise<void>((resolve) => { release = resolve; });
    const landed: string[] = [];
    const landing = new WaveLanding(async (change) => { landed.push(change.title); }, () => held);
    for (const title of ["a", "b", "c"]) landing.enqueue({ title, record: null, origin: remote });
    const stopping = landing.stop();
    expect(landing.pending(), "a stopped queue holds nothing").toBe(0);
    release();
    await stopping;
    expect(landed).toEqual([]);
  }, 120_000);
});
