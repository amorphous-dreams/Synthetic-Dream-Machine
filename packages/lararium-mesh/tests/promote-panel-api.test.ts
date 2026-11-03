/**
 * promote-panel-api — what the page's "rites waiting here" list asks of the vessel: one snapshot across the wikis, and the hand's
 * click as commit, drop, orphan, raise and lower. Platform-blind; a wiki that cannot read answers an error row and never hides the others.
 * Every red pairs with a CONTROL. Meme: lar:///ha.ka.ba/lares/docs/pono/kahua-memory-stage
 */
import { describe, expect, test } from "vitest";
import { promotePanelApi } from "../src/promote-panel-api.js";
import type { PromoteWho } from "../src/index.js";

const D = "d".repeat(64), HAND: PromoteWho = { kind: "hand", id: "h" };

function api(opts: { broken?: string } = {}) {
  const calls: Array<[string, unknown]> = [];
  const listing = (wiki: string) => ({ rows: [], waiting: [{ title: `rites/${wiki}`, digest: D, classes: ["module-type"], origin: { seat: "s", device: "d", session: "s-1" }, revision: "r" }], shadowed: [] });
  const a = promotePanelApi({
    who: HAND,
    wikis: async () => ["daemon", "garden"],
    promotionsFor: (wiki) => ({
      list: async () => { if (wiki === opts.broken) throw new Error("wiki unreadable"); return listing(wiki); },
      promote: async (x: unknown) => { calls.push(["promote", { wiki, x }]); return {}; },
      unpromote: async (x: unknown) => { calls.push(["unpromote", { wiki, x }]); },
      decideOrphan: async (x: unknown) => { calls.push(["decideOrphan", { wiki, x }]); },
    }) as never,
    boardDoor: { kapae: async (x: unknown) => { calls.push(["kapae", x]); return { cid: "c" }; }, prepare: async () => ({}), flag: async () => ({}) } as never,
  });
  return { a, calls };
}

describe("the snapshot", () => {
  test("RED: the snapshot lists every wiki's rows and waiting rites, each wiki under its own name; CONTROL: a wiki that cannot read answers an error row and the others still list", async () => {
    const ok = await api().a.snapshot();
    expect(ok.wikis.map((w) => w.wiki)).toEqual(["daemon", "garden"]);
    expect(ok.wikis[1]).toMatchObject({ wiki: "garden", waiting: [{ title: "rites/garden", digest: D }] });
    const bad = await api({ broken: "garden" }).a.snapshot();
    expect(bad.wikis[0]).toMatchObject({ wiki: "daemon", waiting: [{ title: "rites/daemon" }] });
    expect(bad.wikis[1]).toEqual({ wiki: "garden", error: "wiki unreadable" });
  });
});

describe("the hand's click", () => {
  test("RED: commit, drop and orphan reach the named wiki's door, raise and lower the board door for that wiki and digest; CONTROL: a malformed digest refuses before any door", async () => {
    const { a, calls } = api();
    await a.commit("garden", D); await a.drop("garden", D); await a.orphan("garden", D, "keep"); await a.raise("garden", D); await a.lower("garden", D);
    expect(calls).toEqual([
      ["promote", { wiki: "garden", x: { digest: D } }], ["unpromote", { wiki: "garden", x: { digest: D } }],
      ["decideOrphan", { wiki: "garden", x: { digest: D, decision: "keep" } }],
      ["kapae", { action: "raise", wiki: "garden", digest: D, who: HAND }], ["kapae", { action: "lower", wiki: "garden", digest: D, who: HAND }],
    ]);
    calls.length = 0;
    await expect(a.commit("garden", "nope")).rejects.toMatchObject({ code: "promote-digest-malformed" });
    expect(calls).toEqual([]);
  });
});

describe("a quiet snapshot writes nothing at boot (the second-boot law: a boot mints no content head)", () => {
  test("RED: a snapshot with no rite waiting, promoted or shadowed anywhere reads quiet; CONTROL: a waiting rite, a promoted row, a shadow or an error row each read busy", async () => {
    const { isQuietSnapshot } = await import("../src/promote-panel-api.js");
    expect(isQuietSnapshot({ wikis: [{ wiki: "daemon", rows: [], waiting: [], shadowed: [] } as never] })).toBe(true);
    expect(isQuietSnapshot({ wikis: [] })).toBe(true);
    const busy = (entry: Record<string, unknown>) => isQuietSnapshot({ wikis: [{ wiki: "daemon", rows: [], waiting: [], shadowed: [], ...entry } as never] });
    expect(busy({ waiting: [{ title: "t" }] })).toBe(false);
    expect(busy({ rows: [{ title: "t" }] })).toBe(false);
    expect(busy({ shadowed: ["d"] })).toBe(false);
    expect(busy({ error: "unreadable" })).toBe(false);
  });
});
