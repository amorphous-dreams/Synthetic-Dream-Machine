/**
 * oracle-cast-verb — the `oracle-cast` verb every vessel answers: a cast stands as an ACT that lands once as an OODA-HA meme
 * under `casts/`, through the meme door's own gate, its slots read from canon (the carrier's `#/loop` calls
 * api/pono/oracle-loop#/loop; the rig stands both slots from the canon files themselves), and answers the cast with the
 * readings the wiki holds for it. The coins draw through the platform's entropy door, or a person types six. The caller
 * names the time; the verb reads no clock. The loop's shape reads from the carrier the target's stack seats (a bare-root
 * carrier above the seat answers in canon's place), then the baked pack as the floor, and the answer names the carrier slot
 * that shaped it; `by` names the library shelf whose index declares the method.
 */
import { readFileSync } from "node:fs";
import { describe, test, expect } from "vitest";
import { CompositeStore } from "@lararium/mesh/composite-store";
import { bagUri } from "@lararium/mesh/lar-uris";
import { isVerbRefusal } from "@lararium/mesh/verb-refusal";
import { type Verb } from "@lararium/mesh/verb-tiddler";
import { ORACLE_THROW_STANDS, askingCastTitle, askingId, readingTitle } from "@lararium/mesh/oracle-cast";
import { LOOP_SLOT, ORACLE_AFFORDANCE, ORACLE_CARRIER, kaheaTarget, loopSlots, parseHasRows } from "@lararium/mesh/oracle-loop";
import { MemoryTiddlerStore } from "../src/memory-store.js";
import { bookedAsker, makeOracleCastReactor, type PackedConsult } from "../src/oracle-cast-verb.js";
import type { VerbContext } from "../src/verb-dispatcher.js";
import { bootTestWiki, skipNote, wikiSkip } from "./test-wiki.js";

const DAEMON = bagUri("daemon");
const WORKING_POINTER = "lar:///ha.ka.ba/lararium/config/current-wiki-bag";
const AT = "2026-11-20T23:15:02.123Z";
/** Every cast ROOT standing (a cast meme's slot records carry `#/` in their titles and stay out). */
const CAST_ROOTS = "[prefix[lar:///ha.ka.ba/lares/oracle/casts/]!regexp[#/]]";

/** One ahu slot of a canon carrier, read off the checkout's own file: the rig stands canon's words, never a copy. */
function canonSlot(rel: string, slot: string): string {
  const text = readFileSync(new URL(`../../../bags/lares/ha.ka.ba/lares/${rel}`, import.meta.url), "utf8");
  const open = text.indexOf(`<<~ ahu slot=\`${slot}\`>>`);
  if (open < 0) throw new Error(`canon ${rel} carries no ${slot}`);
  const body = text.indexOf("\n", open) + 1;
  return text.slice(body, text.indexOf("<<~/ahu>>", body)).trim();
}
const CARRIER_LOOP = canonSlot("afford/oracle.library.consults.mem", LOOP_SLOT);
const LOOP_CALL = kaheaTarget(CARRIER_LOOP)!;
const LOOP_ROWS = canonSlot("api/pono/oracle-loop.mem", LOOP_SLOT);
const SLOT_NAMES = loopSlots(parseHasRows(LOOP_ROWS)).map((s) => s.name);
/** The loop rows as the bake resolves them into the pack: the law slot's `has` lines. */
const PACKED_LOOP = LOOP_ROWS.split("\n").map((l) => l.trim()).filter((l) => l.startsWith("<<has "));
const SHELVES = {
  "e-jing": { title: "lar:///ha.ka.ba/lares/library/oracles/e-jing/index", method: "three-coins" },
  doa: { title: "lar:///ha.ka.ba/lares/library/oracles/doa/index", method: "three-coins" },
};
/** A pack seated for the rig: the shelves alone by default, so the loop reads from the wiki the rig stands. */
const seated = (pack: Partial<PackedConsult> | null): (() => Promise<PackedConsult | null>) =>
  async () => (pack === null ? null : { loop: [], shelves: SHELVES, ...pack });

const ctxOf = (composite: CompositeStore): VerbContext => ({
  daemon: composite,
  invocation: { requestId: "r", title: "t", action: "oracle-cast", args: {}, targets: [], batchMode: "best-effort", status: "pending", requestedBy: "test", requestedAt: "" } as unknown as Verb,
  cap: async () => ({ ok: true }),
} as VerbContext);

describe.skipIf(wikiSkip)(`oracle-cast — a cast writes its result as a tiddler${skipNote}`, () => {
  async function rig(opts: { canon?: boolean; packed?: (() => Promise<PackedConsult | null>) | "baked"; extra?: Array<Record<string, unknown>> } = {}) {
    const doa15 = readingTitle("doa", 15);
    const loop = opts.canon === false ? [] : [
      { title: ORACLE_CARRIER, text: "", "$origin-bag": DAEMON },
      { title: `${ORACLE_CARRIER}${LOOP_SLOT}`, text: CARRIER_LOOP, "$origin-bag": DAEMON },
      { title: LOOP_CALL.uri, text: "", "$origin-bag": DAEMON },
      { title: `${LOOP_CALL.uri}${LOOP_CALL.slot ?? LOOP_SLOT}`, text: LOOP_ROWS, "$origin-bag": DAEMON },
    ];
    const engine = await bootTestWiki({ tiddlers: [
      ...loop,
      { title: WORKING_POINTER, text: DAEMON },
      { title: doa15, caption: "15. Turn Me On Dead Man", source: "DOA.html", license: "Kopyleft 2022", attribution: "DOA", "$origin-bag": DAEMON },
      { title: `${doa15}#/reading`, text: "! 15\n\nA reading.", "$origin-bag": DAEMON },
      ...(opts.extra ?? []),
    ] });
    const composite = new CompositeStore();
    composite.addLayer({ bagId: DAEMON, store: new MemoryTiddlerStore(DAEMON), writable: true });
    const consult = opts.packed === "baked" ? {} : { packed: opts.packed ?? seated({}) };
    return { engine, cast: makeOracleCastReactor({ composite, tw5: engine }, consult), ctx: ctxOf(composite) };
  }

  const refusalOf = async (r: Awaited<ReturnType<typeof rig>>, args: Record<string, unknown>): Promise<{ reason: string; message: string }> => {
    try { await r.cast(args, r.ctx); return { reason: "ran", message: "" }; }
    catch (e) { return isVerbRefusal(e) ? { reason: e.reason, message: e.message } : { reason: String(e), message: String(e) }; }
  };

  test("RED: an operator's typed throw writes one cast tiddler naming method, entropy, lines, both hexagrams, caster and time", async () => {
    const r = await rig();
    const out = await r.cast({ recipe: "default", coins: [8, 8, 9, 6, 8, 8], caster: "operator", at: AT, nonce: "n1" }, r.ctx);
    const intent = askingId({ asker: bookedAsker(r.ctx), nonce: "n1", coins: [8, 8, 9, 6, 8, 8] });
    expect(out).toMatchObject({ band: "answered", intent, decision: "put", created: true, title: askingCastTitle(intent) });
    const fields = r.engine.wiki.getTiddler(String(out["title"]))!.fields as Record<string, unknown>;
    expect(fields).toMatchObject({
      method: "three-coins", entropy: "operator:three-coins", lines: "8 8 9 6 8 8", changing: "3 4",
      primary: "15", relating: "16", caster: "operator", "cast-at": AT,
    });
    expect(fields["tags"]).toEqual(["oracle/cast", ORACLE_AFFORDANCE]);
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
    expect(r.engine.wiki.filterTiddlers(CAST_ROOTS)).toEqual([first["title"]]);
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

  test("RED: a seat's typed coins answer asks: a seat never picks the figure, and nothing moves", async () => {
    const r = await rig();
    const seat = { ...r.ctx, asker: "seat" } as VerbContext;
    const out = await r.cast({ recipe: "default", caster: "agent", asking: "which road first?", coins: [9, 9, 9, 9, 9, 9], at: AT }, seat);
    expect(out).toMatchObject({ band: "asks", decision: "asks" });
    expect(String((out["asks"] as Record<string, unknown>)["answer"])).toContain("--coins");
    expect(r.engine.wiki.filterTiddlers("[prefix[lar:///ha.ka.ba/lares/oracle/casts/]]")).toEqual([]);
  }, 60_000);

  test("RED: the cast lands as an OODA-HA meme whose slots read from canon, the ask filling the first and the seat owing the rest", async () => {
    const r = await rig();
    const out = await r.cast({
      recipe: "default", caster: "operator", coins: "889688", asking: "which lane first?", at: AT,
      uncertain: "two leans, neither grounded", observe: ["lar:///ha.ka.ba/kahua/memory/plan/x", "spirit/lane"],
    }, r.ctx);
    expect(out).toMatchObject({ band: "answered", created: true, replayed: false, uncertain: "two leans, neither grounded" });
    const title = String(out["title"]);
    const slots = out["slots"] as Array<{ slot: string; owed: boolean }>;
    expect(slots.map((s) => s.slot)).toEqual(SLOT_NAMES);
    expect(slots.map((s) => s.owed)).toEqual([false, false, true, true, true]);
    const slotText = (name: string): string => String(r.engine.wiki.getTiddler(`${title}${name}`)?.fields["text"] ?? "");
    expect(slotText(SLOT_NAMES[0]!)).toContain("lar:///ha.ka.ba/kahua/memory/plan/x");
    expect(slotText(SLOT_NAMES[1]!)).toContain("two leans, neither grounded");
    expect(slotText(SLOT_NAMES[2]!)).toContain("A reading.");
    expect(slotText(SLOT_NAMES[2]!)).toContain("Kopyleft 2022");
    expect(slotText(SLOT_NAMES[3]!)).toContain("(owed:");
    expect(String((out["next"] as Record<string, unknown>)["append"])).toContain("append='<your words>'");
  }, 60_000);

  test("RED: a replay names the uncertainty the record kept, and the replay's own words never rewrite it", async () => {
    const r = await rig();
    const first = await r.cast({ recipe: "default", caster: "operator", asking: "which lane first?", uncertain: "the first words", observe: "a b", at: AT }, r.ctx);
    const again = await r.cast({ recipe: "default", caster: "operator", asking: "which lane first?", uncertain: "other words", at: AT }, r.ctx);
    expect(again).toMatchObject({ replayed: true, title: first["title"], uncertain: "the first words", observe: ["a", "b"] });
    expect(String(r.engine.wiki.getTiddler(`${String(first["title"])}${SLOT_NAMES[1]}`)?.fields["text"])).not.toContain("other words");
  }, 60_000);

  test("RED: a target wiki with no loop rows still casts: the shape reads from the baked pack, and the cast lands in the target", async () => {
    const r = await rig({ canon: false, packed: seated({ loop: PACKED_LOOP }) });
    const out = await r.cast({ recipe: "default", caster: "operator", coins: "889688", asking: "which lane first?", uncertain: "two leans", at: AT }, r.ctx);
    expect(out).toMatchObject({ band: "answered", created: true, by: "e-jing", method: "three-coins" });
    expect((out["slots"] as Array<{ slot: string }>).map((s) => s.slot)).toEqual(SLOT_NAMES);
    expect(String(r.engine.wiki.getTiddler(`${String(out["title"])}${SLOT_NAMES[1]}`)?.fields["text"])).toContain("two leans");
    expect(r.engine.wiki.filterTiddlers(CAST_ROOTS)).toEqual([out["title"]]);
  }, 60_000);

  test("RED: the pack this package baked carries the consult's loop rows and its shelves, so a bare target casts with no seat", async () => {
    const r = await rig({ canon: false, packed: "baked" });
    const out = await r.cast({ recipe: "default", caster: "operator", coins: "889688", asking: "which lane first?", at: AT }, r.ctx);
    expect(out).toMatchObject({ band: "answered", created: true, by: "e-jing", method: "three-coins" });
    expect((out["slots"] as Array<{ slot: string }>).map((s) => s.slot)).toEqual(SLOT_NAMES);
  }, 60_000);

  test("RED: by names the shelf: doa casts under its own asking, and the default shelf keys the id every earlier cast kept", async () => {
    const r = await rig();
    const ejing = await r.cast({ recipe: "default", caster: "operator", asking: "which road first?", at: AT }, r.ctx);
    const doa = await r.cast({ recipe: "default", caster: "operator", asking: "which road first?", by: "doa", at: AT }, r.ctx);
    expect(ejing).toMatchObject({ band: "answered", by: "e-jing", method: "three-coins", intent: askingId({ asker: bookedAsker(r.ctx), asking: "which road first?" }) });
    expect(doa).toMatchObject({ band: "answered", created: true, by: "doa", method: "three-coins" });
    expect(doa["intent"]).toBe(askingId({ asker: bookedAsker(r.ctx), asking: "which road first?", by: "doa" }));
    expect(doa["title"]).not.toBe(ejing["title"]);
    expect(r.engine.wiki.getTiddler(String(doa["title"]))!.fields["by"]).toBe("doa");
  }, 60_000);

  test("RED: a kind no shelf declares refuses oracle-shelf-unknown, naming the shelves that stand, and nothing moves", async () => {
    const r = await rig();
    const unknown = await refusalOf(r, { recipe: "default", caster: "operator", asking: "q", by: "tarot", at: AT });
    expect(unknown.reason).toBe("oracle-shelf-unknown");
    expect(unknown.message).toContain("doa (three-coins) · e-jing (three-coins)");
    expect(unknown.message).toContain("--by e-jing");
    expect((await refusalOf(r, { recipe: "default", caster: "operator", asking: "q", by: "../e-jing", at: AT })).reason).toBe("oracle-shelf-unknown");
    expect(r.engine.wiki.filterTiddlers("[prefix[lar:///ha.ka.ba/lares/oracle/casts/]]")).toEqual([]);
  }, 60_000);

  test("RED: a shelf whose method the verb runs not yet refuses oracle-method-unrun; the target's own shelf record answers first", async () => {
    const dice = "lar:///ha.ka.ba/lares/library/oracles/sdm-dice/index";
    const r = await rig({ extra: [{ title: dice, method: "roll", text: "", "$origin-bag": DAEMON }] });
    const unrun = await refusalOf(r, { recipe: "default", caster: "operator", asking: "q", by: "sdm-dice", at: AT });
    expect(unrun.reason).toBe("oracle-method-unrun");
    expect(unrun.message).toContain("`roll`");
    const r2 = await rig({ packed: seated({ shelves: { ...SHELVES, tarot: { title: "lar:///ha.ka.ba/lares/library/oracles/tarot/index", method: "draw" } } }) });
    expect((await refusalOf(r2, { recipe: "default", caster: "operator", asking: "q", by: "tarot", at: AT })).reason).toBe("oracle-method-unrun");
    expect(r.engine.wiki.filterTiddlers("[prefix[lar:///ha.ka.ba/lares/oracle/casts/]]")).toEqual([]);
  }, 60_000);

  test("RED: a carrier seated at the bare root with one more loop slot shapes the act record in canon's place, and the answer's has line names it", async () => {
    const witness = "<<has entity=`slot` name=`#/witness` params=`phase/↺ writer/seat owes/[[who else reads the move]] ~ the witness the seat names`>>";
    const r = await rig({ extra: [
      { title: ORACLE_AFFORDANCE, text: "", "$origin-bag": DAEMON },
      { title: `${ORACLE_AFFORDANCE}${LOOP_SLOT}`, text: `${LOOP_ROWS}\n${witness}`, "$origin-bag": DAEMON },
    ] });
    const out = await r.cast({ recipe: "default", caster: "operator", coins: "889688", asking: "which lane first?", at: AT }, r.ctx);
    expect((out["slots"] as Array<{ slot: string }>).map((s) => s.slot)).toEqual([...SLOT_NAMES, "#/witness"]);
    expect(String(r.engine.wiki.getTiddler(`${String(out["title"])}#/witness`)?.fields["text"])).toContain("who else reads the move");
    expect(out["carrier"]).toMatchObject({ carrier: `${ORACLE_AFFORDANCE}${LOOP_SLOT}`, bag: DAEMON });
    expect(String(out["has"])).toContain(`carrier/${ORACLE_AFFORDANCE}${LOOP_SLOT}`);
    expect(String(out["has"])).toContain(`bag/${DAEMON}`);
    // CONTROL: the canon seat answers where no bare root stands; the floor names the pack where the stack answers nothing.
    const canon = await rig();
    const seat = await canon.cast({ recipe: "default", caster: "operator", coins: "889688", asking: "which lane first?", at: AT }, canon.ctx);
    expect(seat["carrier"]).toMatchObject({ carrier: `${ORACLE_CARRIER}${LOOP_SLOT}`, bag: DAEMON });
    const floor = await rig({ canon: false, packed: seated({ loop: PACKED_LOOP, carrier: ORACLE_CARRIER, hash: "sha256-floor" }) });
    const fell = await floor.cast({ recipe: "default", caster: "operator", coins: "889688", asking: "which lane first?", at: AT }, floor.ctx);
    expect(fell["carrier"]).toEqual({ carrier: `${ORACLE_CARRIER}${LOOP_SLOT}`, bag: "pack", base: "sha256-floor" });
    expect(String(fell["has"])).toContain("bag/pack");
  }, 60_000);

  test("RED: where the stack and the pack both answer no loop rows, the cast refuses before any coin draws, and nothing moves", async () => {
    const r = await rig({ canon: false, packed: seated({ loop: [] }) });
    let reason = "ran";
    try { await r.cast({ recipe: "default", caster: "operator", asking: "q", at: AT }, r.ctx); }
    catch (e) { reason = isVerbRefusal(e) ? e.reason : String(e); }
    expect(reason).toBe("oracle-loop-unread");
    expect(r.engine.wiki.filterTiddlers("[prefix[lar:///ha.ka.ba/lares/oracle/casts/]]")).toEqual([]);
  }, 60_000);
});
