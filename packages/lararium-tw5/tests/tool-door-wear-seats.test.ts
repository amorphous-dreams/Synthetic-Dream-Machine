/**
 * tool-door-wear-seats — every store a tool-door write can reach holds the composition's actor door, and the session's
 * face crosses from the vessel into the daemon island (Wave 4b lane C, the door).
 *
 *   W1  RED: no-tool-door-write-on-a-seated-store-refuses-worn-face-unwritable: every `new AutomergeDocStore(` on the
 *       tool door's reach (the meme and tiddler doors, the island's recipe and its attached layers, the reach and catalog
 *       planes, the vessel composites) passes the Repo's actor door, so a face's write there never refuses
 *       `worn-face-unwritable`
 *   W2  RED: a store seated by its Repo writes a face's change under the actor the Repo's seated door derives; CONTROL: a
 *       Repo with no seated door refuses `worn-face-unwritable` by name
 *   W3  RED: the island's door asks the vessel for the actor (`daemon:wear-actor-request`) under the island's own replica,
 *       and the vessel's answer settles it; a refusal settles as the refusal it names
 *   W4  RED: the island books a session's worn face with the placed act, and only that act reads it
 */
import { describe, expect, test } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import * as mesh from "@lararium/mesh";
import { AutomergeDocStore, emptyLarDoc, type LarDoc, type Repo as RepoType } from "@lararium/mesh";
import * as behavior from "../src/daemon-behavior.js";
import { REPO } from "./test-wiki.js";

const meshRequire = createRequire(import.meta.resolve("@lararium/mesh"));
const Repo = meshRequire("@automerge/automerge-repo").Repo as new (options: { network: unknown[] }) => RepoType;
const A = meshRequire("@automerge/automerge") as { getAllChanges(doc: LarDoc): Uint8Array[]; decodeChange(change: Uint8Array): { actor: string } };

/** The files whose stores a tool-door write can reach. */
const REACH = [
  "packages/lararium-tw5/src/meme-verbs.ts",
  "packages/lararium-tw5/src/island-recipe.ts",
  "packages/lararium-tw5/src/recipe-watch.ts",
  "packages/lararium-tw5/src/catalog-accessor.ts",
  "packages/lararium-tw5/src/canon-offer-verbs.ts",
  "packages/lararium-tw5/src/vessel-steps.ts",
  "packages/lararium-tw5/src/daemon-vm-core.ts",
  "packages/lararium-tw5/src/sovereign-kernel.ts",
  "packages/lararium-tw5/src/action-handler.ts",
  "packages/lararium-keyhive/src/operator-daemon-behavior.ts",
  "packages/lararium-mesh/src/open-vessel-core.ts",
  "packages/lararium-mesh/src/who-face-cap.ts",
  "packages/lararium-mesh/src/carriage-caps.ts",
];

/** Each `new AutomergeDocStore(...)` call in `src`, its argument list read to the matching close. */
function constructions(src: string): string[] {
  const calls: string[] = [];
  for (let at = src.indexOf("new AutomergeDocStore("); at >= 0; at = src.indexOf("new AutomergeDocStore(", at + 1)) {
    let depth = 0;
    let end = at + "new AutomergeDocStore".length;
    for (; end < src.length; end++) {
      if (src[end] === "(") depth++;
      else if (src[end] === ")" && --depth === 0) break;
    }
    calls.push(src.slice(at, end + 1));
  }
  return calls;
}

describe("the tool door's stores hold the actor door, and the face crosses into the island", () => {
  test("W1 RED: no-tool-door-write-on-a-seated-store-refuses-worn-face-unwritable", () => {
    const unseated: string[] = [];
    let seen = 0;
    for (const file of REACH) {
      for (const call of constructions(readFileSync(path.join(REPO, file), "utf8"))) {
        seen++;
        if (!/\bwear(Of)?\b/.test(call)) unseated.push(`${file}: ${call.replace(/\s+/g, " ")}`);
      }
    }
    expect(seen, "the witness reads the tool door's reach").toBeGreaterThan(20);
    expect(unseated, "a store on the tool door's reach holds no actor door").toEqual([]);
  });

  test("W2 RED: a store seated by its Repo writes a face's change under the seated door's actor; CONTROL: an unseated Repo refuses by name", async () => {
    const { seatRepoWear, wearOf } = mesh as unknown as { seatRepoWear: typeof import("@lararium/mesh").seatRepoWear; wearOf: typeof import("@lararium/mesh").wearOf };
    expect(typeof wearOf, "the mesh seats an actor door on a Repo").toBe("function");
    const repo = new Repo({ network: [] });
    const handle = repo.create<LarDoc>(emptyLarDoc());
    const store = new AutomergeDocStore(handle, "lar:///ha.ka.ba/wikis/probe/working", wearOf(repo));
    const origin = { kind: "lares-verb", requestId: "w2", face: "persona-group-a" } as const;
    await expect(store.put({ tiddler: { title: "lar:///t/w2", text: "v0" } }, origin)).rejects.toMatchObject({ reason: "worn-face-unwritable" });
    const derived = "ab".repeat(16);
    const off = seatRepoWear(repo, { actor: async () => derived });
    await store.put({ tiddler: { title: "lar:///t/w2", text: "v1" } }, origin);
    const actors = A.getAllChanges(handle.doc()!).map((c) => A.decodeChange(c).actor);
    expect(actors[actors.length - 1]).toBe(derived);
    off();
    await expect(store.put({ tiddler: { title: "lar:///t/w2", text: "v2" } }, origin)).rejects.toMatchObject({ reason: "worn-face-unwritable" });
    await repo.shutdown();
  });

  test("W3 RED: the island's door asks the vessel under its own replica, and the answer settles it", async () => {
    // The door's module loads inside the test, so a missing door reads as this vector's red alone.
    const { makeIslandWearDoor } = await import("../src/island-wear.js");
    const posted: Array<Record<string, unknown>> = [];
    const wear = makeIslandWearDoor((msg) => { posted.push(msg as unknown as Record<string, unknown>); });
    const asked = wear.door.actor("persona-group-a", "doc-1");
    expect(posted).toHaveLength(1);
    expect(posted[0]).toMatchObject({ type: "daemon:wear-actor-request", face: "persona-group-a", documentId: "doc-1" });
    expect(typeof posted[0]!["replica"]).toBe("string");
    expect(wear.answer({ type: "daemon:wear-actor-result", requestId: posted[0]!["requestId"] as string, actor: "cd".repeat(16) })).toBe(true);
    await expect(asked).resolves.toBe("cd".repeat(16));
    // The answer settles once: a second reading of the same (face, document) asks nothing more.
    await expect(wear.door.actor("persona-group-a", "doc-1")).resolves.toBe("cd".repeat(16));
    expect(posted).toHaveLength(1);
    const refused = wear.door.actor(null, "doc-2");
    wear.answer({ type: "daemon:wear-actor-result", requestId: posted[1]!["requestId"] as string, refusal: "worn-face-unwritable" });
    await expect(refused).rejects.toMatchObject({ reason: "worn-face-unwritable" });
  });

  test("W4 RED: the island books a session's worn face with the placed act, and only that act reads it", () => {
    const book = behavior.makeLocalAskBook();
    const ask = { requestId: "r1", action: "tiddler-put", args: { title: "x" }, requestedBy: "p", origin: "channel" as const, worn: { ordinal: 1, presenter: "p", group: "persona-group-b" } };
    book.add(ask);
    expect(book.wornOf(ask)).toEqual({ ordinal: 1, presenter: "p", group: "persona-group-b" });
    expect(book.wornOf({ ...ask, args: { title: "y" } }), "another act under the id reads no face").toBeUndefined();
    book.add({ requestId: "r2", action: "tiddler-put", args: {}, requestedBy: "p", origin: "channel" as const });
    expect(book.wornOf({ requestId: "r2", action: "tiddler-put", args: {}, requestedBy: "p" })).toBeUndefined();
  });
});
