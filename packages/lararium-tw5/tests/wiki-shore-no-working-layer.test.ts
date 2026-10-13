/**
 * THE FOUR HAND ROUTES OF A WIKI THAT MOUNTS NO WORKING LAYER.
 *
 * A hand's save lands where the cascade routes it. With no working layer mounted:
 *   · a route into a MOUNTED named layer lands (the draft slot, the personal slot, the temp slot);
 *   · a route through the working-layer pointer refuses by name;
 *   · a route into a named layer the composition does not mount refuses by name.
 * A refusal raises its alert, keeps the person's words in the page and writes no store.
 *
 * Control: the same ordinary save with the working layer mounted lands there.
 */
import { describe, expect, test } from "vitest";
import { unroutedSaveAlertTitle } from "../src/island-adaptor.js";
import { wikiSkip, skipNote } from "./test-wiki.js";
import { afterDispatch, draftBag, ManualTimers, personalBag, shoreRig, storeText, tempBag, turns, workingBag, type Rig } from "./wiki-shore-rig.js";

const POINTER = (slot: string): string => `lar:///ha.ka.ba/lararium/config/current-wiki-${slot}`;
const hand = async (r: Rig, timers: ManualTimers): Promise<void> => {
  await afterDispatch();
  timers.fireAll(400);
  await turns(48);
  await r.adaptor.landingIdle();
};
const end = async (r: Rig): Promise<void> => { r.unbridge(); await r.adaptor.stop().catch(() => undefined); await r.repo.shutdown(); };
const ORDINARY = "lar:///t/no-working/ordinary";
const FOLDED = "$:/state/folded/lar:///t/no-working/ordinary";
const TEMP = "$:/temp/no-working/scratch";
const DRAFT = `Draft of '${ORDINARY}'`;

describe.skipIf(wikiSkip)(`a wiki with no working layer${skipNote}`, () => {
  test("a route into a mounted named layer lands; the route through the working pointer refuses by name", async () => {
    const timers = new ManualTimers();
    const r = await shoreRig({ timers, noWorking: true, upperSlots: true });
    await r.adaptor.armSeedCheckpoint();
    await r.adaptor.landingIdle();
    expect(r.composite.defaultWritableBagId(), "the composition names no working layer").toBeNull();

    r.wiki.addTiddler(new r.Tiddler({ title: DRAFT, "draft.of": ORDINARY, "draft.title": ORDINARY, text: "a draft" }));
    r.wiki.addTiddler(new r.Tiddler({ title: FOLDED, text: "hide" }));
    r.wiki.addTiddler(new r.Tiddler({ title: TEMP, text: "scratch" }));
    r.wiki.addTiddler(new r.Tiddler({ title: ORDINARY, text: "an ordinary save" }));
    await hand(r, timers);

    expect(storeText(r, draftBag, DRAFT), "the draft slot takes the draft").toBe("a draft");
    expect(storeText(r, personalBag, FOLDED), "the personal slot takes view state").toBe("hide");
    expect((await r.temp.get(TEMP))?.tiddler.text, "the temp slot takes the scratch title").toBe("scratch");

    const calls = r.calls.filter((c) => c.puts.includes(ORDINARY));
    expect(calls, "no store call carries the ordinary save").toEqual([]);
    const alert = r.wiki.getTiddler(unroutedSaveAlertTitle(POINTER("bag")));
    expect(alert, "the refusal stands on the alert rail, named by its pointer").toBeDefined();
    expect(String(alert!.fields.text)).toContain(ORDINARY);
    expect(String(alert!.fields.text)).toContain("this wiki mounts no working layer");
    expect(r.wiki.getTiddler(ORDINARY)!.fields.text, "the page keeps what the person wrote").toBe("an ordinary save");
    expect(r.adaptor.holdsHand(ORDINARY), "the save stays owed").toBe(true);
    await end(r);
  }, 120_000);

  test("a route into a named layer the composition does not mount refuses by name", async () => {
    const timers = new ManualTimers();
    const r = await shoreRig({ timers, noWorking: true });
    await r.adaptor.armSeedCheckpoint();
    await r.adaptor.landingIdle();

    r.wiki.addTiddler(new r.Tiddler({ title: FOLDED, text: "hide" }));
    await hand(r, timers);

    expect(r.calls.filter((c) => c.puts.includes(FOLDED))).toEqual([]);
    expect(storeText(r, personalBag, FOLDED)).toBeUndefined();
    const alert = r.wiki.getTiddler(unroutedSaveAlertTitle(POINTER("personal")));
    expect(alert, "the refusal names the personal pointer").toBeDefined();
    expect(String(alert!.fields.text)).toContain(FOLDED);
    expect(String(alert!.fields.text)).toContain(`it names ${personalBag}, a bag this wiki does not mount`);
    // CONTROL inside the same wiki: the draft slot stands mounted, and a draft still lands.
    r.wiki.addTiddler(new r.Tiddler({ title: DRAFT, "draft.of": ORDINARY, "draft.title": ORDINARY, text: "a draft" }));
    await hand(r, timers);
    expect(storeText(r, draftBag, DRAFT)).toBe("a draft");
    await end(r);
  }, 120_000);

  test("CONTROL: with the working layer mounted the ordinary save lands there and raises nothing", async () => {
    const timers = new ManualTimers();
    const r = await shoreRig({ timers, upperSlots: true });
    await r.adaptor.armSeedCheckpoint();
    await r.adaptor.landingIdle();
    r.wiki.addTiddler(new r.Tiddler({ title: ORDINARY, text: "an ordinary save" }));
    await hand(r, timers);
    expect(storeText(r, workingBag, ORDINARY)).toBe("an ordinary save");
    expect(r.wiki.getTiddler(unroutedSaveAlertTitle(POINTER("bag")))).toBeUndefined();
    expect(tempBag).toContain("/temp");
    await end(r);
  }, 120_000);
});
