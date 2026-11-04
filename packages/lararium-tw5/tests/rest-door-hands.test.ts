/**
 * The rest door covers the hands a confirm leaves marked: the story list the navigator rewrites in the same dispatch
 * as the save leaves with the act and rests beside it, so a reload that follows reads the story the person left
 * (dreamdom#/what-a-sink-keeps). Without a rest door the idle drain writes the story list.
 */
import { describe, expect, test } from "vitest";
import { makeRestDoor } from "../src/rest-door.js";
import { wikiSkip, skipNote } from "./test-wiki.js";
import { afterDispatch, ManualBoundary, openDraft, personalBag, remote, saveSequence, shoreRig, turns, typeInto, workingBag, type Rig } from "./wiki-shore-rig.js";
import type { LarTiddlerRecord } from "@lararium/mesh";

const STORY = "$:/StoryList";

test("a durable acknowledgement refuses an unknown bag; an empty request needs no document", async () => {
  const posted: unknown[] = [];
  const door = makeRestDoor({ post: (message) => posted.push(message), handles: () => new Map() });
  await expect(door.ack([])).resolves.toBeUndefined();
  expect(posted).toHaveLength(0);
  await expect(door.ack(["missing-draft-bag"])).rejects.toThrow();
  expect(posted).toHaveLength(0);
  door.close();
});

test("a required durable acknowledgement with no rest door refuses by name and keeps the title owed", async () => {
  const r = await shoreRig();
  await r.adaptor.armSeedCheckpoint();
  const title = "lar:///t/rest-door/refusal";
  r.adaptor.requireDurableAck = true;
  try {
    await expect(r.adaptor.saveTiddler({ fields: { title, text: "first" } } as never)).rejects
      .toThrow(/durable acknowledgement refused: no rest door stands/);
    expect(r.adaptor.pendingTitles()).toContain(title);
  } finally {
    r.adaptor.requireDurableAck = false;
    await r.adaptor.boundary();
    await r.stop();
  }
});

async function standing(r: Rig, title: string): Promise<void> {
  await r.working.put({ tiddler: { title, text: "landed" } } as LarTiddlerRecord, remote);
  await turns();
  await r.adaptor.armSeedCheckpoint();
  await r.adaptor.landingIdle();
}

describe.skipIf(wikiSkip)(`the rest door covers the hands a confirm leaves marked${skipNote}`, () => {
  test("RED: a confirm that rewrites the story list rests the personal bag beside the working bag — CONTROL: with no rest door the idle drain writes the story list", async () => {
    for (const withDoor of [true, false]) {
      const boundary = new ManualBoundary();
      const r = await shoreRig({ boundary, upperSlots: true });
      const asks: Array<{ requestId: string; documentIds: string[] }> = [];
      let nextId = 0;
      let settleSetup = true;
      if (withDoor) {
        r.adaptor.restDoor = makeRestDoor({
          post: (m) => { if (m.type === "doc:rest") { asks.push(m as unknown as { requestId: string; documentIds: string[] }); if (settleSetup) queueMicrotask(() => r.adaptor.restDoor?.answer({ type: "doc:rested", requestId: m.requestId, rested: true })); } },
          handles: () => new Map(Object.entries(r.handles)),
          mintId: () => `q${++nextId}`,
        });
      }
      const x = `lar:///t/hands/${withDoor}`;
      await standing(r, x);
      const d = openDraft(r, x, "hand value");
      typeInto(r, d, "hand value");
      await afterDispatch();
      boundary.fire();
      await turns(16);
      settleSetup = false;
      asks.length = 0;
      const mark = r.calls.length;
      saveSequence(r, d);
      r.wiki.addTiddler(new r.Tiddler({ title: STORY, list: [x] }));
      await afterDispatch();
      const personalOf = () => r.calls.slice(mark).filter((c) => c.bag === personalBag && c.puts.includes(STORY));
      await turns(24);
      if (withDoor) {
        expect(asks.some((ask) => ask.documentIds.includes(r.handles[workingBag]!.documentId)), "the target asks for durable acknowledgement").toBe(true);
        for (let turn = 0; turn < 6; turn++) {
          for (const ask of asks) r.adaptor.restDoor!.answer({ type: "doc:rested", requestId: ask.requestId, rested: true });
          await turns(12);
        }
        expect(personalOf(), "the story list reaches the personal bag").toHaveLength(1);
        expect(asks.some((ask) => ask.documentIds.includes(r.handles[personalBag]!.documentId)), "the personal bag receives a durable rest request").toBe(true);
        r.adaptor.restDoor!.close();
      } else {
        expect(personalOf(), "CONTROL: with no door the idle drain writes the story list").toHaveLength(1);
        expect(asks, "no door asks nothing").toHaveLength(0);
      }
      await r.stop();
    }
  }, 120_000);
});
