/**
 * oracle-cast-verb — the `oracle-cast` verb every vessel answers: a cast stands as an ACT that writes its result as one
 * tiddler under `casts/`, through the tiddler door's own put (its gates, its working layer), and answers the cast with
 * the readings the wiki holds for it. The coins draw through the platform's entropy door, or the operator types six.
 * The caller names the time; the verb reads no clock.
 */
import { describe, test, expect } from "vitest";
import { CompositeStore, bagUri, isVerbRefusal, type Verb } from "@lararium/mesh";
import { ORACLE_THROW_STANDS, readingTitle } from "@lararium/mesh/oracle-cast";
import { MemoryTiddlerStore } from "../src/memory-store.js";
import { makeOracleCastReactor } from "../src/oracle-cast-verb.js";
import type { VerbContext } from "../src/verb-dispatcher.js";
import { bootTestWiki, skipNote, wikiSkip } from "./test-wiki.js";

const DAEMON = bagUri("daemon");
const WORKING_POINTER = "lar:///ha.ka.ba/lararium/config/current-wiki-bag";
const AT = "2026-11-20T23:15:02.123Z";

const ctxOf = (composite: CompositeStore): VerbContext => ({
  daemon: composite,
  invocation: { requestId: "r", title: "t", action: "oracle-cast", args: {}, targets: [], batchMode: "best-effort", status: "pending", requestedBy: "test", requestedAt: "" } as unknown as Verb,
  cap: async () => ({ ok: true }),
} as VerbContext);

describe.skipIf(wikiSkip)(`oracle-cast — a cast writes its result as a tiddler${skipNote}`, () => {
  async function rig() {
    const doa15 = readingTitle("doa", 15);
    const engine = await bootTestWiki({ tiddlers: [
      { title: WORKING_POINTER, text: DAEMON },
      { title: doa15, caption: "15. Turn Me On Dead Man", source: "DOA.html", license: "Kopyleft 2022", attribution: "DOA", "$origin-bag": DAEMON },
      { title: `${doa15}#/reading`, text: "! 15\n\nA reading.", "$origin-bag": DAEMON },
    ] });
    const composite = new CompositeStore();
    composite.addLayer({ bagId: DAEMON, store: new MemoryTiddlerStore(DAEMON), writable: true });
    return { engine, cast: makeOracleCastReactor({ composite, tw5: engine }), ctx: ctxOf(composite) };
  }

  test("RED: an operator's typed throw writes one cast tiddler naming method, entropy, lines, both hexagrams, caster and time", async () => {
    const r = await rig();
    const out = await r.cast({ recipe: "default", coins: [8, 8, 9, 6, 8, 8], caster: "operator", at: AT }, r.ctx);
    expect(out).toMatchObject({ decision: "put", created: true, title: "lar:///ha.ka.ba/lares/oracle/casts/2026-11-20T23-15-02-123Z-15-16" });
    const fields = r.engine.wiki.getTiddler(String(out["title"]))!.fields as Record<string, unknown>;
    expect(fields).toMatchObject({
      method: "three-coins", entropy: "operator:three-coins", lines: "8 8 9 6 8 8", changing: "3 4",
      primary: "15", relating: "16", caster: "operator", "cast-at": AT, tags: ["oracle/cast"],
    });
    expect(String(fields["text"])).toContain(ORACLE_THROW_STANDS);
    expect(out["note"]).toBe(ORACLE_THROW_STANDS);
  }, 60_000);

  test("the answer carries the readings the wiki holds, and names the ones it holds none of", async () => {
    const r = await rig();
    const out = await r.cast({ recipe: "default", coins: "889688", caster: "operator", at: AT }, r.ctx);
    const readings = out["readings"] as Array<Record<string, unknown>>;
    expect(readings.map((x) => x["title"])).toEqual([
      readingTitle("doa", 15), readingTitle("e-jing", 15), readingTitle("doa", 16), readingTitle("e-jing", 16),
    ]);
    expect(readings[0]).toMatchObject({ caption: "15. Turn Me On Dead Man", license: "Kopyleft 2022", text: "! 15\n\nA reading." });
    expect(readings[1]).toMatchObject({ absent: true });
    expect(String(out["text"])).toContain("Hexagram 15");
  }, 60_000);

  test("a house cast draws through the platform's entropy door and says so", async () => {
    const r = await rig();
    const out = await r.cast({ recipe: "default", caster: "agent", at: AT }, r.ctx);
    const cast = out["cast"] as Record<string, unknown>;
    expect(cast["entropy"]).toBe("platform:crypto.getRandomValues");
    expect((cast["lines"] as number[]).length).toBe(6);
    expect(r.engine.wiki.getTiddler(String(out["title"]))!.fields["entropy"]).toBe("platform:crypto.getRandomValues");
  }, 60_000);

  test("re-asking never recasts over a standing cast: the same title answers `exists` and the record stays", async () => {
    const r = await rig();
    const first = await r.cast({ recipe: "default", coins: [7, 7, 7, 7, 7, 7], caster: "operator", at: AT }, r.ctx);
    const again = await r.cast({ recipe: "default", coins: [7, 7, 7, 7, 7, 7], caster: "someone else", at: AT }, r.ctx);
    expect(again["decision"]).toBe("exists");
    expect(r.engine.wiki.getTiddler(String(first["title"]))!.fields["caster"]).toBe("operator");
  }, 60_000);

  test("the verb reads no clock: a call naming no time refuses, and bad coins refuse by name", async () => {
    const r = await rig();
    const why = async (args: Record<string, unknown>): Promise<string> => {
      try { await r.cast(args, r.ctx); return "ran"; } catch (e) { return isVerbRefusal(e) ? e.reason : String(e); }
    };
    expect(await why({ recipe: "default", caster: "operator" })).toBe("oracle-cast-untimed");
    expect(await why({ recipe: "default", caster: "operator", at: AT, coins: "7,7,7" })).toBe("oracle-cast-coins");
    expect(await why({ recipe: "default", caster: "operator", at: AT, coins: [7, 7, 7, 7, 7, 5] })).toBe("oracle-cast-coins");
  }, 60_000);
});
