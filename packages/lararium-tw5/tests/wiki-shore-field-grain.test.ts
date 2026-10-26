/**
 * A hand's write of a title that already stands reads at FIELD grain against that title's last landed
 * state: each field either changed, stayed the same, or left. TiddlyWiki replaces a tiddler whole; the
 * store receives only the fields that differ, at the landed base, so a concurrent change to a field the
 * hand left the same merges clean and a concurrent change to a field the hand changed surfaces both values.
 * A rename onto a standing title is that same ordinary write of the standing title.
 */
import { describe, expect, test } from "vitest";
import { wikiSkip, skipNote } from "./test-wiki.js";
import {
  afterDispatch, draftBag, ManualBoundary, openDraft, peerWrite, remote, saveSequence, shoreRig, storeDeleted,
  turns, typeInto, workingBag, type Rig,
} from "./wiki-shore-rig.js";

const stored = (r: Rig, title: string): Record<string, unknown> => ({ ...(r.doc(workingBag).tiddlers[title]?.tiddler ?? {}) });
const surfaced = async (r: Rig, title: string, field: string): Promise<string[]> =>
  (await r.working.parallelDrafts(title)).map((d) => String(d.tiddler[field])).sort();

describe.skipIf(wikiSkip)(`wiki shore field grain${skipNote}`, () => {
  for (const raced of ["none", "a", "b", "c"] as const) {
    test(`a rename onto a standing title writes the fields that differ from its landed state (concurrent change: ${raced})`, async () => {
      const boundary = new ManualBoundary();
      let hold = false;
      let release!: () => void;
      const held = new Promise<void>((resolve) => { release = resolve; });
      const r = await shoreRig({ boundary, yieldHost: async () => { if (hold) await held; } });
      const x = `lar:///t/grain/${raced}-from`;
      const y = `lar:///t/grain/${raced}-to`;
      await r.working.put({ tiddler: { title: x, text: "t", a: "1", b: "9" } }, remote);
      await turns();
      await r.adaptor.armSeedCheckpoint();
      await r.adaptor.landingIdle();
      await r.working.put({ tiddler: { title: y, text: "t", a: "1", b: "2", c: "3" } }, remote);
      await turns(16);
      await r.adaptor.landingIdle();
      const yBase = r.adaptor.ledger.landedOf(y)!.heads!;
      const d = openDraft(r, x, "t");
      typeInto(r, d, "t", { "draft.title": y });
      await afterDispatch();
      boundary.fire();
      await turns(16);
      if (raced !== "none") {
        hold = true;
        await peerWrite(r, workingBag, [{ tiddler: { title: y, text: "t", a: "1", b: "2", c: "3", [raced]: "remote" } }]);
        await turns(4);
        expect(r.wiki.getTiddler(y)!.fields[raced], "the concurrent change stands in the store and has not landed in the wiki").not.toBe("remote");
      }
      const changesBefore = r.changes(workingBag);
      const mark = r.calls.length;
      saveSequence(r, d);
      await afterDispatch();
      const act = r.calls.slice(mark).filter((c) => c.bag === workingBag);
      // Y's write and X's tombstone ride one call when their bases agree, else one call each, Y first.
      expect(act.flatMap((c) => c.puts.concat(c.deletes)), "Y's write, then X's tombstone").toEqual([y, x]);
      expect(act[0]!.puts).toEqual([y]);
      expect(act[0]!.base, "Y's write carries Y's landed base").toEqual(yBase);
      if (raced !== "none") { hold = false; release(); }
      await turns(24);
      await r.adaptor.landingIdle();
      const now = stored(r, y);
      expect(storeDeleted(r, workingBag, x), "X reads deleted").toBe(true);
      expect(storeDeleted(r, draftBag, d)).toBe(true);
      if (raced === "none") {
        expect({ a: now.a, b: now.b, c: now.c }).toEqual({ a: "1", b: "9", c: undefined });
        expect(await surfaced(r, y, "b")).toEqual([]);
        expect(r.changes(workingBag) - changesBefore, "one change per base the act builds on").toBe(act.length);
      }
      if (raced === "a") {
        expect({ a: now.a, b: now.b, c: now.c }, "the remote a, the hand's b, no c").toEqual({ a: "remote", b: "9", c: undefined });
        expect(await r.working.parallelDrafts(y), "a field the hand left the same raises no conflict").toEqual([]);
        expect(r.wiki.getTiddler(y)!.fields.a, "the wiki shows the merged record").toBe("remote");
      }
      if (raced === "b") {
        expect(await surfaced(r, y, "b"), "both values of the raced field surface").toEqual(["9", "remote"]);
        expect(now.c).toBeUndefined();
      }
      if (raced === "c") {
        // A removal against a concurrent edit of the removed field: Automerge keeps the concurrent value
        // (a delete removes only the value it saw), and nothing surfaces.
        expect({ a: now.a, b: now.b, c: now.c }).toEqual({ a: "1", b: "9", c: "remote" });
        expect(await r.working.parallelDrafts(y)).toEqual([]);
      }
      await r.stop();
    }, 120_000);
  }
});
