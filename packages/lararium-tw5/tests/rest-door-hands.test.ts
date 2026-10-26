/**
 * The rest door covers the hands a confirm leaves marked: the story list the navigator rewrites in the same dispatch
 * as the save leaves with the act and rests beside it, so a reload that follows reads the story the person left
 * (dreamdom#/what-a-sink-keeps). Without a rest door the hand waits for its gate's timer, as it always did.
 */
import { describe, expect, test } from "vitest";
import { makeRestDoor } from "../src/rest-door.js";
import { wikiSkip, skipNote } from "./test-wiki.js";
import { afterDispatch, ManualBoundary, openDraft, personalBag, remote, saveSequence, shoreRig, turns, typeInto, workingBag, type Rig } from "./wiki-shore-rig.js";
import type { LarTiddlerRecord } from "@lararium/mesh";

const STORY = "$:/StoryList";

async function standing(r: Rig, title: string): Promise<void> {
  await r.working.put({ tiddler: { title, text: "landed" } } as LarTiddlerRecord, remote);
  await turns();
  await r.adaptor.armSeedCheckpoint();
  await r.adaptor.landingIdle();
}

describe.skipIf(wikiSkip)(`the rest door covers the hands a confirm leaves marked${skipNote}`, () => {
  test("RED: a confirm that rewrites the story list rests the personal bag beside the working bag — CONTROL: with no rest door the story list waits for its gate", async () => {
    for (const withDoor of [true, false]) {
      const boundary = new ManualBoundary();
      const r = await shoreRig({ boundary, upperSlots: true });
      const asks: Array<{ documentIds: string[] }> = [];
      if (withDoor) {
        r.adaptor.restDoor = makeRestDoor({
          post: (m) => { if (m.type === "doc:rest") { asks.push(m as unknown as { documentIds: string[] }); } },
          handles: () => new Map(Object.entries(r.handles)),
          mintId: () => "q",
        });
      }
      const x = `lar:///t/hands/${withDoor}`;
      await standing(r, x);
      const d = openDraft(r, x, "hand value");
      typeInto(r, d, "hand value");
      await afterDispatch();
      boundary.fire();
      await turns(16);
      const mark = r.calls.length;
      saveSequence(r, d);
      r.wiki.addTiddler(new r.Tiddler({ title: STORY, list: [x] }));
      await afterDispatch();
      const personalOf = () => r.calls.slice(mark).filter((c) => c.bag === personalBag && c.puts.includes(STORY));
      if (!withDoor) expect(personalOf(), "CONTROL: with no door the story list has not left when the act's turn ends").toHaveLength(0);
      await turns(24);
      const personal = personalOf();
      if (withDoor) {
        expect(personal, "the story list left with the confirm").toHaveLength(1);
        expect(asks, "the rest ask names the working bag and the personal bag").toHaveLength(1);
        expect(asks[0]!.documentIds).toContain(r.handles[workingBag]!.documentId);
        expect(asks[0]!.documentIds, "the personal bag rests with the act").toContain(r.handles[personalBag]!.documentId);
      } else {
        expect(personal, "CONTROL: with no door the story list leaves at the next boundary, the act's landing").toHaveLength(1);
        expect(asks, "no door asks nothing").toHaveLength(0);
      }
      await r.stop();
    }
  }, 120_000);
});
