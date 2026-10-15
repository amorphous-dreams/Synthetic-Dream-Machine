import { describe, expect, test, vi } from "vitest";

const conflicts = vi.hoisted(() => new Map<string, Record<string, unknown>>());

vi.mock("@automerge/automerge", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@automerge/automerge")>();
  return {
    ...actual,
    getConflicts: (_object: unknown, property: string) => conflicts.get(property),
  };
});

import { readParallelDrafts } from "../src/parallel-drafts.js";

const TITLE = "lar:///landed/op-identity";
const actorA = "11111111111111111111111111111111";
const actorB = "22222222222222222222222222222222";

describe("landed conflict operation identity", () => {
  test("two values from one actor on one field each appear in one uniquely titled draft", () => {
    conflicts.clear();
    conflicts.set("text", {
      [`1@${actorA}`]: "first from one actor",
      [`2@${actorA}`]: "second from one actor",
      [`1@${actorB}`]: "live from another actor",
    });
    const drafts = readParallelDrafts({ [TITLE]: { tiddler: { title: TITLE, text: "live from another actor" } } }, TITLE);
    const sameActor = drafts.filter((draft) => draft.tiddler["lar-conflict-actor"] === actorA);
    expect(sameActor.map((draft) => draft.tiddler.text).sort()).toEqual(["first from one actor", "second from one actor"]);
    expect(new Set(sameActor.map((draft) => draft.tiddler.title)).size).toBe(2);
    expect(sameActor.map((draft) => draft.tiddler["lar-conflict-ops"]).sort()).toEqual([`1@${actorA}`, `2@${actorA}`]);
    const surfaced = drafts.flatMap((draft) => String(draft.tiddler["lar-conflict-ops"]).split(" "));
    expect(new Set(surfaced).size).toBe(3);
    expect(surfaced.sort()).toEqual([`1@${actorA}`, `1@${actorB}`, `2@${actorA}`].sort());
  });

  test("one op by an actor per conflicted field stays in one draft across fields", () => {
    conflicts.clear();
    conflicts.set("text", { [`1@${actorA}`]: "A text", [`1@${actorB}`]: "B text" });
    conflicts.set("tags", { [`2@${actorA}`]: "A tags", [`2@${actorB}`]: "B tags" });
    const drafts = readParallelDrafts({ [TITLE]: { tiddler: { title: TITLE, text: "B text", tags: "B tags" } } }, TITLE);
    expect(drafts).toHaveLength(2);
    const byActor = new Map(drafts.map((draft) => [draft.tiddler["lar-conflict-actor"], draft]));
    expect(byActor.get(actorA)?.tiddler["lar-conflict-ops"]).toBe(`1@${actorA} 2@${actorA}`);
    expect(byActor.get(actorA)?.tiddler["lar-conflict-fields"]).toBe("text tags");
  });
});
