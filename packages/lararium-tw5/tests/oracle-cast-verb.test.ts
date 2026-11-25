/**
 * oracle-cast-verb — the `oracle-cast` verb every vessel answers: a cast stands as an ACT that writes its result as one
 * tiddler under `casts/`, through the tiddler door's own put (its gates, its working layer), and answers the cast with
 * the readings the wiki holds for it. The coins draw through the platform's entropy door, or the operator types six.
 * The caller names the time; the verb reads no clock.
 */
import { describe, test, expect } from "vitest";
import { CompositeStore, bagUri, isVerbRefusal, type Verb } from "@lararium/mesh";
import { ORACLE_THROW_STANDS, askingCastTitle, askingId, readingTitle } from "@lararium/mesh/oracle-cast";
import { MemoryTiddlerStore } from "../src/memory-store.js";
import { bookedAsker, makeOracleCastReactor } from "../src/oracle-cast-verb.js";
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
    const out = await r.cast({ recipe: "default", coins: [8, 8, 9, 6, 8, 8], caster: "operator", at: AT, nonce: "n1" }, r.ctx);
    const intent = askingId({ asker: bookedAsker(r.ctx), nonce: "n1", coins: [8, 8, 9, 6, 8, 8] });
    expect(out).toMatchObject({ band: "answered", intent, decision: "put", created: true, title: askingCastTitle(intent) });
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

  test("one asking, one throw: the same asking again answers the standing cast, at any later time, and draws nothing", async () => {
    const r = await rig();
    const first = await r.cast({ recipe: "default", caster: "operator", asking: "which road first?", at: AT }, r.ctx);
    const again = await r.cast({ recipe: "default", caster: "operator", asking: "which road first?", at: "2031-01-01T00:00:00.000Z" }, r.ctx);
    expect(first).toMatchObject({ band: "answered", replayed: false, created: true });
    expect(again).toMatchObject({ band: "answered", replayed: true, created: false, title: first["title"], intent: first["intent"] });
    expect((again["cast"] as Record<string, unknown>)["lines"]).toEqual((first["cast"] as Record<string, unknown>)["lines"]);
    expect((again["cast"] as Record<string, unknown>)["at"]).toBe(AT);
    expect(r.engine.wiki.filterTiddlers("[prefix[lar:///ha.ka.ba/lares/oracle/casts/]]")).toEqual([first["title"]]);
  }, 60_000);

  test("another booked asker, other words, or a fresh nonce stands as another asking and throws its own cast", async () => {
    const r = await rig();
    const base = { recipe: "default", caster: "operator", asking: "which road first?", at: AT };
    const other = { ...r.ctx, presenter: "0x" + "cd".repeat(32) } as VerbContext;
    const titles = new Set<unknown>();
    titles.add((await r.cast(base, r.ctx))["title"]);
    titles.add((await r.cast(base, other))["title"]);
    titles.add((await r.cast({ ...base, asking: "which road last?" }, r.ctx))["title"]);
    titles.add((await r.cast({ ...base, nonce: "fresh-1", fresh: true }, r.ctx))["title"]);
    expect(titles.size).toBe(4);
  }, 60_000);

  test("the throw stands against the asker's own words: a caller-named caster or a trivial edit replays it", async () => {
    const r = await rig();
    const first = await r.cast({ recipe: "default", caster: "operator", asking: "which road first?", at: AT }, r.ctx);
    for (const edit of [{ caster: "someone else" }, { asking: "Which  road FIRST" }, { asking: "which road first?!." }]) {
      const again = await r.cast({ recipe: "default", caster: "operator", asking: "which road first?", at: AT, ...edit }, r.ctx);
      expect(again).toMatchObject({ band: "answered", replayed: true, title: first["title"] });
    }
  }, 60_000);

  test("a seat's own nonce re-rolls nothing: it answers asks with the person's line, and nothing moves", async () => {
    const r = await rig();
    const seat = { ...r.ctx, asker: "seat" } as VerbContext;
    for (const extra of [{ nonce: "n1" }, { nonce: "n2", asking: "which road first?" }]) {
      const out = await r.cast({ recipe: "default", caster: "agent", at: AT, ...extra }, seat);
      expect(out).toMatchObject({ band: "asks", decision: "asks" });
      expect(String((out["asks"] as Record<string, unknown>)["answer"])).toContain("--fresh");
    }
    expect(r.engine.wiki.filterTiddlers("[prefix[lar:///ha.ka.ba/lares/oracle/casts/]]")).toEqual([]);
  }, 60_000);

  test("two worn faces key apart: the same words from each throw their own cast", async () => {
    const r = await rig();
    const face = (ordinal: number, presenter: string): VerbContext => ({ ...r.ctx, asker: "seat", worn: { ordinal, presenter } } as VerbContext);
    const one = await r.cast({ recipe: "default", asking: "which road first?", at: AT }, face(0, "0x" + "01".repeat(32)));
    const two = await r.cast({ recipe: "default", asking: "which road first?", at: AT }, face(1, "0x" + "02".repeat(32)));
    expect(one["title"]).not.toBe(two["title"]);
    expect(bookedAsker(face(0, "a"))).not.toBe(bookedAsker(face(1, "b")));
  }, 60_000);

  test("a seat's bare cast asks for its query first: nothing moves, and the cure names --asking", async () => {
    const r = await rig();
    const seat = { ...r.ctx, asker: "seat" } as VerbContext;
    const out = await r.cast({ recipe: "default", caster: "agent", at: AT }, seat);
    expect(out).toMatchObject({ band: "asks", decision: "asks" });
    expect(String((out["asks"] as Record<string, unknown>)["answer"])).toContain("--asking");
    expect(r.engine.wiki.filterTiddlers("[prefix[lar:///ha.ka.ba/lares/oracle/casts/]]")).toEqual([]);
  }, 60_000);

  test("a bare cast (no asking, nonce or seed) mints its own nonce: two bare casts stand as two", async () => {
    const r = await rig();
    const one = await r.cast({ recipe: "default", caster: "operator", at: AT }, r.ctx);
    const two = await r.cast({ recipe: "default", caster: "operator", at: AT }, r.ctx);
    expect(one["title"]).not.toBe(two["title"]);
  }, 60_000);

  test("a seed throws the same coins for the same seed, and the record names the seed's digest", async () => {
    const r = await rig();
    const a = await r.cast({ recipe: "default", caster: "operator", asking: "q1", seed: "kahiko", at: AT }, r.ctx);
    const b = await r.cast({ recipe: "default", caster: "operator", asking: "q2", seed: "kahiko", at: AT }, r.ctx);
    expect((a["cast"] as Record<string, unknown>)["lines"]).toEqual((b["cast"] as Record<string, unknown>)["lines"]);
    expect(String((a["cast"] as Record<string, unknown>)["entropy"])).toMatch(/^seed:sha256:[0-9a-f]{16}$/);
  }, 60_000);

  test("a seat's fresh throw or seed answers `asks`: a person's hand gives it, and nothing moves", async () => {
    const r = await rig();
    const seat = { ...r.ctx, asker: "seat" } as VerbContext;
    for (const extra of [{ fresh: true, nonce: "n" }, { seed: "kahiko" }]) {
      const out = await r.cast({ recipe: "default", caster: "agent", asking: "which road first?", at: AT, ...extra }, seat);
      expect(out).toMatchObject({ band: "asks", decision: "asks" });
      expect(String((out["asks"] as Record<string, unknown>)["answer"])).toContain("lares oracle cast");
    }
    expect(r.engine.wiki.filterTiddlers("[prefix[lar:///ha.ka.ba/lares/oracle/casts/]]")).toEqual([]);
    const plain = await r.cast({ recipe: "default", caster: "agent", asking: "which road first?", at: AT }, seat);
    expect(plain["band"]).toBe("answered");
  }, 60_000);

  test("the readings read labelled as-of the bytes they reflect, and the label moves only when they do", async () => {
    const r = await rig();
    const one = await r.cast({ recipe: "default", coins: "889688", caster: "operator", asking: "a", at: AT }, r.ctx);
    const two = await r.cast({ recipe: "default", coins: "889688", caster: "operator", asking: "b", at: AT }, r.ctx);
    expect(String(one["asOf"])).toMatch(/^[0-9a-f]{16}$/);
    expect(two["asOf"]).toBe(one["asOf"]);
    r.engine.wiki.addTiddler({ title: `${readingTitle("doa", 15)}#/reading`, text: "! 15\n\nAnother reading.", "$origin-bag": DAEMON });
    const three = await r.cast({ recipe: "default", coins: "889688", caster: "operator", asking: "c", at: AT }, r.ctx);
    expect(three["asOf"]).not.toBe(one["asOf"]);
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
