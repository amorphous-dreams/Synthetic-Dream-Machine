/**
 * THE SHADOW LAYER NEVER REACHES A STORE. A record laid into TiddlyWiki's shadow layer (`setShadowTiddlers`: the daemon's
 * UI surfaces, re-laid each boot and whenever a face's planes arrive) rests in memory alone, and TiddlyWiki's `getTiddler`
 * answers a shadow where no ordinary tiddler stands. A bridge that read every notified title through `getTiddler` saved
 * each re-laid shadow as an ordinary record into the working layer, whose mirror then projected the daemon's UI surfaces
 * under `<projections>/wikis/daemon-<F>` (the stage walk's S7 read fourteen of them). And a hand's delete of an override
 * left the shadow showing, which the bridge saved back as the override's content instead of the tombstone the hand made.
 */
import { describe, expect, test } from "vitest";
import { wikiSkip, skipNote } from "./test-wiki.js";
import { afterDispatch, ManualBoundary, shoreRig, storeDeleted, turns, workingBag } from "./wiki-shore-rig.js";

describe.skipIf(wikiSkip)(`the bridge and the shadow layer${skipNote}`, () => {
  test("a shadow laid after the shore stands resident writes no record to any bag", async () => {
    const boundary = new ManualBoundary();
    const r = await shoreRig({ boundary });
    await r.adaptor.armSeedCheckpoint();
    const mark = r.calls.length;
    const surface = "$:/lares/ui/shadow-layer-probe";
    r.engine.setShadowTiddlers("$:/temp/lares/daemon-seed/probe", [{ title: surface, type: "text/vnd.tiddlywiki", text: "a surface" }]);
    await afterDispatch();
    boundary.fire();
    await turns(48);
    expect(String((r.wiki.getTiddler(surface) as { fields: { text: string } } | undefined)?.fields.text), "CONTROL: the shadow reads in the wiki").toBe("a surface");
    expect(r.calls.slice(mark).filter((c) => c.puts.includes(surface) || c.deletes.includes(surface)), "a shadow reached a store").toEqual([]);
    // Re-laying it (a face's planes arriving) writes nothing either.
    r.engine.setShadowTiddlers("$:/temp/lares/daemon-seed/probe", [{ title: surface, type: "text/vnd.tiddlywiki", text: "a surface, again" }]);
    await afterDispatch();
    boundary.fire();
    await turns(48);
    expect(r.calls.slice(mark).filter((c) => c.puts.includes(surface) || c.deletes.includes(surface)), "a re-laid shadow reached a store").toEqual([]);
    await r.stop();
  }, 120_000);

  test("a hand's delete of an override lands a tombstone, never the shadow's content", async () => {
    const boundary = new ManualBoundary();
    const r = await shoreRig({ boundary });
    await r.adaptor.armSeedCheckpoint();
    const surface = "lar:///t/shadow-layer/override";
    r.engine.setShadowTiddlers("$:/temp/lares/daemon-seed/override", [{ title: surface, text: "shipped" }]);
    await afterDispatch();
    boundary.fire();
    await turns(48);
    r.wiki.addTiddler(new r.Tiddler({ title: surface, text: "the hand's override" }));
    await afterDispatch();
    boundary.fire();
    await turns(48);
    const mark = r.calls.length;
    r.wiki.deleteTiddler(surface);
    await afterDispatch();
    boundary.fire();
    await turns(48);
    const issued = r.calls.slice(mark);
    expect(issued.filter((c) => c.puts.includes(surface)), "the shadow's content saved over the hand's delete").toEqual([]);
    expect(issued.filter((c) => c.deletes.includes(surface)).map((c) => c.bag)).toEqual([workingBag]);
    expect(storeDeleted(r, workingBag, surface)).toBe(true);
    await r.stop();
  }, 120_000);
});
