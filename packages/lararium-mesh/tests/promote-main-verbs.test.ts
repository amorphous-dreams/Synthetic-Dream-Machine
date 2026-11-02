/**
 * promote-main-verbs — the main-thread handlers behind the panel's six island verbs and `promote-refresh`, platform-blind.
 *
 * The island's dispatcher already holds the hand-only gate (an ask must arrive on the surface path); these handlers run only past it,
 * act as this device's hand, and push the new snapshot to the island's state tiddler after every act. A malformed ask refuses by
 * name. Every red pairs with a CONTROL. Meme: lar:///ha.ka.ba/lares/docs/pono/kahua-memory-stage
 */
import { describe, expect, test } from "vitest";
import { PROMOTE_PANEL_HAND_CODES, PROMOTE_PANEL_VERBS, promoteMainVerbs } from "../src/promote-main-verbs.js";

const D = "d".repeat(64);

function stand() {
  const calls: string[] = [], pushed: string[] = [];
  const api = {
    snapshot: async () => ({ wikis: [{ wiki: "daemon", shadowed: [], rows: [], waiting: [] }] }),
    commit: async (w: string, d: string) => { calls.push(`commit ${w} ${d}`); }, drop: async (w: string, d: string) => { calls.push(`drop ${w} ${d}`); },
    orphan: async (w: string, d: string, x: string) => { calls.push(`orphan ${w} ${d} ${x}`); },
    raise: async (w: string, d: string) => { calls.push(`raise ${w} ${d}`); }, lower: async (w: string, d: string) => { calls.push(`lower ${w} ${d}`); },
  };
  return { verbs: promoteMainVerbs({ api: api as never, push: async (data) => { pushed.push(data); } }), calls, pushed };
}

describe("the verb names", () => {
  test("RED: the six hand-only verbs carry their refusal codes and `promote-refresh` is not among them; CONTROL: every code names a hand", () => {
    expect([...PROMOTE_PANEL_VERBS].sort()).toEqual(["kapae-lower", "kapae-raise", "promote-commit", "promote-drop", "promote-keep", "promote-orphan-drop"]);
    expect(PROMOTE_PANEL_HAND_CODES).toEqual({
      "promote-commit": "promote-needs-hand", "promote-drop": "promote-needs-hand", "promote-keep": "promote-needs-hand", "promote-orphan-drop": "promote-needs-hand",
      "kapae-raise": "kapae-needs-hand", "kapae-lower": "kapae-needs-hand",
    });
    expect(Object.keys(promoteMainVerbs({ api: {} as never, push: async () => {} })).sort()).toEqual([...PROMOTE_PANEL_VERBS, "promote-refresh"].sort());
  });
});

describe("the handlers", () => {
  test("RED: each verb reaches the api with the wiki and digest, then pushes the fresh snapshot; CONTROL: refresh pushes without acting", async () => {
    const s = stand();
    await s.verbs["promote-commit"]!({ wiki: "garden", digest: D });
    await s.verbs["promote-drop"]!({ wiki: "garden", digest: D });
    await s.verbs["promote-keep"]!({ wiki: "garden", digest: D });
    await s.verbs["promote-orphan-drop"]!({ wiki: "garden", digest: D });
    await s.verbs["kapae-raise"]!({ wiki: "garden", digest: D });
    await s.verbs["kapae-lower"]!({ wiki: "garden", digest: D });
    expect(s.calls).toEqual([`commit garden ${D}`, `drop garden ${D}`, `orphan garden ${D} keep`, `orphan garden ${D} drop`, `raise garden ${D}`, `lower garden ${D}`]);
    expect(s.pushed).toHaveLength(6);
    const before = s.calls.length;
    const out = await s.verbs["promote-refresh"]!({});
    expect(s.calls).toHaveLength(before);
    expect(s.pushed).toHaveLength(7);
    expect(JSON.parse(s.pushed[6]!)).toEqual({ wikis: [{ wiki: "daemon", shadowed: [], rows: [], waiting: [] }] });
    expect(out).toMatchObject({ pushed: true });
  });

  test("RED: a missing wiki or a malformed digest refuses by name and acts on nothing; CONTROL: a refused act still pushes nothing", async () => {
    const s = stand();
    await expect(s.verbs["promote-commit"]!({ digest: D })).rejects.toMatchObject({ code: "promote-wiki-missing" });
    await expect(s.verbs["kapae-raise"]!({ wiki: "garden", digest: "nope" })).rejects.toMatchObject({ code: "promote-digest-malformed" });
    expect(s.calls).toEqual([]);
    expect(s.pushed).toEqual([]);
  });
});
