/**
 * rest-door — a save act's result waits for the vessel to rest what the act wrote (dreamdom#/what-a-sink-keeps, "the
 * edit that unloads before it rests"). The island names its heads; the vessel answers `doc:rested`; nothing runs on
 * a timer.
 */
import { afterEach, describe, expect, test, vi } from "vitest";
import { createRequire } from "node:module";
import { emptyLarDoc, replicaHeads, type IslandToVesselMsg, type LarDoc, type Repo as RepoType } from "@lararium/mesh";
import { makeRestDoor, type RestDoor } from "../src/rest-door.js";
import { mountSurface, settle, type Surface } from "./projection-surface.js";
import { skipNote, wikiSkip } from "./test-wiki.js";

const meshRequire = createRequire(import.meta.resolve("@lararium/mesh"));
const Repo = meshRequire("@automerge/automerge-repo").Repo as new (options: { network: unknown[] }) => RepoType;
const SLOT = "lar:///ha.ka.ba/wikis/lares/working";
function door(opts: { flushOwn?: () => Promise<void> } = {}) {
  const handle = new Repo({ network: [] }).create<LarDoc>(emptyLarDoc());
  const posts: IslandToVesselMsg[] = [];
  const handles = new Map([[SLOT, handle]]);
  const rest = makeRestDoor({ post: (m) => posts.push(m), handles: () => handles, mintId: (() => { let i = 0; return () => `r${++i}`; })(), ...opts });
  return { rest, posts, handle, edit: () => { handle.change((doc) => { doc.tiddlers["lar:///t/x"] = { tiddler: { title: "lar:///t/x", text: String(Math.random()) } } as never; }); }, heads: () => replicaHeads(handle) };
}

describe("the island's rest door", () => {
  test("RED: an act that wrote waits for doc:rested, which names the document and its heads — CONTROL: an act that wrote nothing waits for nothing", async () => {
    const d = door();
    d.edit();
    const quiet = d.rest.begin();
    quiet.done(null);
    expect(d.rest.held(), "an act that wrote nothing holds nothing").toBeNull();
    const act = d.rest.begin();
    expect(d.rest.held(), "an act that began holds its result").not.toBeNull();
    let released = false;
    void d.rest.held()!.then(() => { released = true; });
    act.done([SLOT]);
    await settle();
    expect(d.posts).toEqual([{ type: "doc:rest", requestId: "r1", documentIds: [d.handle.documentId], heads: { [d.handle.documentId]: d.heads() } }]);
    expect(released, "the result still waits: the vessel has not answered").toBe(false);
    expect(d.rest.answer({ type: "doc:rested", requestId: "r1", rested: true })).toBe(true);
    await settle();
    expect(released).toBe(true);
    expect(d.rest.held()).toBeNull();
  });

  test("an unrested answer still releases the act (the write itself stood), and an answer nobody waits for is consumed", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const d = door();
    const act = d.rest.begin();
    act.done([SLOT]);
    await settle();
    expect(d.rest.answer({ type: "doc:rested", requestId: "r1", rested: false, why: "the vessel holds no copy of the document" })).toBe(true);
    await d.rest.idle();
    expect(d.rest.answer({ type: "doc:rested", requestId: "stranger", rested: true })).toBe(true);
    expect(d.rest.answer({ type: "wiki:verb-result", requestId: "r1" })).toBe(false);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("did not rest"));
    warn.mockRestore();
  });

  test("the island flushes its own store before it asks the vessel, and a door that closes lets every wait go", async () => {
    const order: string[] = [];
    const d = door({ flushOwn: async () => { order.push("flush"); } });
    const act = d.rest.begin();
    act.done([SLOT]);
    await settle();
    order.push(`post:${d.posts.length}`);
    expect(order).toEqual(["flush", "post:1"]);
    let idle = false;
    void d.rest.idle().then(() => { idle = true; });
    await settle();
    expect(idle).toBe(false);
    d.rest.close();
    await settle();
    expect(idle).toBe(true);
  });
});

describe.skipIf(wikiSkip)(`a control result waits on the rest door${skipNote}`, () => {
  let s: Surface | undefined;
  afterEach(() => { s?.stop(); s = undefined; });
  const button = `<$button class="go" actions="""<$action-setfield $tiddler="lar:///t/rest/n" text="x"/>""">go</$button>`;

  test("RED: an applied act holds its lar:control-result while a rest waits — CONTROL: the same act with nothing waiting answers at once", async () => {
    let rest: RestDoor | undefined;
    const posts: IslandToVesselMsg[] = [];
    const handles = new Map([[SLOT, new Repo({ network: [] }).create<LarDoc>(emptyLarDoc())]]);
    rest = makeRestDoor({ post: (m) => posts.push(m), handles: () => handles, mintId: () => "r1" });
    s = await mountSurface(button, [], "lar:///test/projection-surface", rest);
    const { dispatchLarControlEvent } = await import("../src/tw5-projection.js");
    // CONTROL: nothing waits, so the answer crosses ctx.post inside the dispatch.
    dispatchLarControlEvent(s.event("go", { kind: "lar:act", action: "lar:click" }));
    expect(s.results.map((r) => r.status)).toEqual(["applied"]);
    // RED: an act began a rest in the turn of its dispatch, so the answer waits for the vessel's word.
    const hold = rest.begin();
    dispatchLarControlEvent(s.event("go", { kind: "lar:act", action: "lar:click" }));
    await s.flush();
    expect(s.results.map((r) => r.status), "the held result has not crossed").toEqual(["applied"]);
    hold.done([SLOT]);
    await settle();
    expect(s.results.map((r) => r.status), "still waiting for doc:rested").toEqual(["applied"]);
    rest.answer({ type: "doc:rested", requestId: "r1", rested: true });
    await s.flush();
    expect(s.results.map((r) => r.status), "the vessel answered: the result leaves").toEqual(["applied", "applied"]);
  }, 120_000);
});

describe.skipIf(wikiSkip)(`the coherence fold waits for the rest door to go idle${skipNote}`, () => {
  test("RED: no fold runs while a save waits to rest, and the frame lands once it rests — CONTROL: with nothing waiting the fold runs on the change beat", async () => {
    const { bootTestWiki } = await import("./test-wiki.js");
    const { buildFixtureIsland } = await import("../src/wiki-store-adapter.js");
    const { mountCoherenceProjection, COHERENCE_FRAME } = await import("../src/wiki-coherence-projection.js");
    const engine = await bootTestWiki({ tiddlers: [] });
    const composite = await buildFixtureIsland("w", [{ title: "One", text: "alpha words" }, { title: "Two", text: "beta words" }]);
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    try {
      const frames: unknown[] = [];
      const posts: IslandToVesselMsg[] = [];
      const rest = makeRestDoor({ post: (m) => posts.push(m), handles: () => new Map() });
      const ctx = { wikiUri: "lar:///test/coherence-rest", composite, tw5: engine, rest, post: (m: IslandToVesselMsg) => { if ((m as { listenable?: string }).listenable === COHERENCE_FRAME) frames.push(m); } } as never;
      const stop = mountCoherenceProjection(ctx);
      const advance = async (): Promise<void> => { await settle(); vi.advanceTimersByTime(100); await settle(); await settle(); };
      await advance();
      expect(frames.length, "CONTROL: nothing waits, so the first frame lands on the beat").toBeGreaterThan(0);
      const before = frames.length;
      const act = rest.begin();
      (engine.$tw as unknown as { wiki: { addTiddler(f: Record<string, unknown>): void } }).wiki.addTiddler({ title: "Three", text: "gamma words" });
      await advance();
      expect(frames.length, "a save waits to rest: the fold has not run").toBe(before);
      act.done(null);
      await advance();
      expect(frames.length, "the save rested: the fold ran").toBeGreaterThan(before);
      stop();
    } finally { vi.useRealTimers(); engine.dispose(); }
  }, 120_000);
});
