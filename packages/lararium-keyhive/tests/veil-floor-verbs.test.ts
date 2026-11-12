/**
 * THE FLOOR'S VERB GATE NAMES THE HELD KEY (in-house ruling 2026-11-12, the-veil-ladder#/the-base-model).
 *
 * The wiki-minting and composing verbs refuse where the vessel cannot seal what they write. The capability: the vessel
 * holds its own key open, which reads as its control document reading. A face seated passes as before.
 *
 *   G1 — an unlocked veil floor (no face, a reading control document) mints a wiki as the veil: its catalog row carries
 *        `face-reach = vessel-only`, and its canon document files as the vessel's own (announced `floor`, then named by a
 *        `floor-slot/<slug>/canon` control row) in the same act
 *   G2 — a locked floor (`vessel-locked`) still refuses by naming the lift, and writes nothing
 *   G3 — a herm (`control-home-unnamed`) still refuses by naming the lift, and writes nothing
 */
import { describe, test, expect } from "vitest";
import { makeIslandRepo } from "@lararium/mesh";
import {
  CompositeStore, CONTROL_HOME_ID, CONTROL_HOME_UNNAMED, ControlHomeUnavailable, DAEMON_BAG_ID, emptyLarDoc, floorAnswerStore, floorSlotTitle,
  isVeilBagRow, isVerbRefusal, refusingControlStore, tiddlerText, vesselLockedRefusal, wikiBagUri, type LarDoc,
} from "@lararium/mesh";
import { MemoryTiddlerStore, VerbTable } from "@lararium/tw5";
import { operatorDaemonOptions } from "../src/operator-daemon-behavior.js";

const PLACE = "a".repeat(64);
const FLOOR = /waking floor|persona new 0/i;

function floor(control: CompositeStore) {
  const repo = makeIslandRepo({ syncPort: new MessageChannel().port1 });
  const catalog = repo.create<LarDoc>(emptyLarDoc());
  const composite = new CompositeStore();
  composite.addLayer({ bagId: DAEMON_BAG_ID, store: new MemoryTiddlerStore(DAEMON_BAG_ID), writable: true });
  const posts: Array<Record<string, unknown>> = [];
  const docStoreDoor = { post: (m: unknown) => { posts.push(m as Record<string, unknown>); }, listen: () => () => {} };
  const registry = new VerbTable();
  const ctx = { composite, control, repo, catalogUrl: catalog.url, tw5: {} as never, post: () => {} } as never;
  operatorDaemonOptions({ daemonAuth: { placeVerifyingKey: PLACE, registerBags: [] } } as never, { docStoreDoor } as never).wireWorkerVerbs?.(registry, ctx);
  const verbCtx = { daemon: {} as never, invocation: { requestId: "r1" } as never, cap: async () => ({ ok: true }) } as never;
  return { repo, catalog, control, posts, run: (verb: string, args: Record<string, unknown>) => registry.get(verb)!(args, verbCtx) };
}
const openControl = () => { const s = new CompositeStore(); s.addLayer({ bagId: CONTROL_HOME_ID, store: new MemoryTiddlerStore(CONTROL_HOME_ID), writable: true, defaultWritable: true }); return s; };

describe("★ the floor's verb gate names the held key, never a seated face ★", () => {
  test("RED G1 — an unlocked veil floor mints a wiki as the veil, and its canon document files as the vessel's own in the same act", async () => {
    const f = floor(openControl());
    const out = await f.run("init-wiki", { slug: "tabs" }) as { status: string; wikiDocUrl: string };
    expect(out.status).toBe("minted");
    const row = f.catalog.doc()!.tiddlers[wikiBagUri("tabs")]!;
    expect(tiddlerText(row)).toBe(out.wikiDocUrl);
    expect(isVeilBagRow(wikiBagUri("tabs"), row), "the row carries the veil's mark").toBe(true);
    // The seal travels with the mark: announced as the vessel's own, and named by the control document.
    const documentId = out.wikiDocUrl.replace(/^automerge:/, "");
    expect(f.posts.find((m) => m["type"] === "docstore:slot" && m["bagId"] === wikiBagUri("tabs"))).toMatchObject({ documentId, floor: true });
    expect(tiddlerText(await f.control.get(floorSlotTitle("tabs", "canon")))).toBe(out.wikiDocUrl);
    await f.repo.shutdown();
  });

  for (const [name, control] of [
    ["G2 — a locked floor", () => refusingControlStore(vesselLockedRefusal())],
    ["G3 — a herm", () => floorAnswerStore(new ControlHomeUnavailable("this place names no control document", CONTROL_HOME_UNNAMED))],
  ] as const) {
    test(`RED ${name} still refuses the mint and compose verbs by naming the lift, and writes nothing`, async () => {
      const f = floor(control());
      for (const verb of ["init-wiki", "add-bag", "remove-bag", "prune-stale"]) {
        const refused = await f.run(verb, { slug: "tabs" }).then(() => null, (e: unknown) => e);
        expect(isVerbRefusal(refused), verb).toBe(true);
        expect(String((refused as Error).message), verb).toMatch(FLOOR);
      }
      expect(Object.keys(f.catalog.doc()!.tiddlers), "no row lands").toEqual([]);
      expect(f.posts).toEqual([]);
      await f.repo.shutdown();
    });
  }
});
