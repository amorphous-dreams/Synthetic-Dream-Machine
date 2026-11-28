/**
 * `lares oracle cast` — the CLI skin of the `oracle-cast` verb: one cast, written by the vessel as one tiddler. The line
 * plans the verb's args (the container, the operator's coins, the caster, the time the CLI reads once at its edge),
 * prints the reading plainly by default and the verb's own answer under `json=true`, and its help says the oracle widens
 * attention and never decides.
 */
import { afterEach, describe, test, expect, vi } from "vitest";

const h = vi.hoisted(() => ({
  calls: [] as Array<{ verb: string; args: Record<string, unknown> }>,
  reply: {} as Record<string, unknown>,
  offline: false,
  fault: null as null | { code: string; message: string; requestId?: string },
}));
vi.mock("../src/verb-call.js", () => {
  class DaemonUnreachable extends Error {}
  return {
  DaemonUnreachable,
  verbFailure: (err: unknown) => h.fault ?? ({ code: "error", message: err instanceof Error ? err.message : String(err) }),
  runVerb: async (verb: string, args: Record<string, unknown>) => {
    h.calls.push({ verb, args });
    if (h.offline) throw new DaemonUnreachable();
    if (h.fault) throw new Error(h.fault.message);
    return { status: "done", requestId: "r", results: { summary: { ok: true, output: h.reply } } };
  },
}; });
vi.mock("../src/env.js", async (orig) => ({
  ...(await orig<typeof import("../src/env.js")>()),
  vesselDid: async () => "0x" + "ab".repeat(32),
}));

import { ORACLE_THROW_STANDS, castFromCoins, castRecord, castText } from "@lararium/mesh/oracle-cast";
import { cmdOracle, oraclePlan } from "../src/commands/oracle-cmd.js";
import { COMMANDS, doorTakes } from "../src/bin/lares.js";
import { helpLines } from "../src/command-help.js";
import { commandScope } from "../src/host-bridge.js";
import type { ParsedArgs } from "../src/parse-args.js";

const AT = "2026-11-20T23:15:02.123Z";
const argv = (positional: string[], options: Record<string, string> = {}, flags: Record<string, boolean> = {}): ParsedArgs =>
  ({ command: "oracle", positional, options, flags } as unknown as ParsedArgs);

async function run(args: ParsedArgs): Promise<{ exit: number; out: string; err: string }> {
  const out: string[] = []; const err: string[] = [];
  const so = vi.spyOn(process.stdout, "write").mockImplementation(((chunk: unknown) => { out.push(String(chunk)); return true; }) as never);
  const lo = vi.spyOn(console, "log").mockImplementation((...parts: unknown[]) => { out.push(parts.join(" ") + "\n"); });
  const le = vi.spyOn(console, "error").mockImplementation((...parts: unknown[]) => { err.push(parts.join(" ") + "\n"); });
  try { return { exit: await cmdOracle(args), out: out.join(""), err: err.join("") }; }
  finally { so.mockRestore(); lo.mockRestore(); le.mockRestore(); }
}

afterEach(() => { h.calls.length = 0; h.reply = {}; h.offline = false; h.fault = null; });
const MINT = (): string => "n0";

describe("lares oracle cast", () => {
  test("RED: the verb stands in the command table, rides the vessel, and its help names the oracle's limit", () => {
    const row = COMMANDS.find((c) => c.name === "oracle");
    expect(row).toBeDefined();
    expect([...doorTakes(row!.name)].sort()).toEqual(["asking", "bag", "by", "caster", "coins", "face", "fresh", "observe", "realm", "recipe", "seed", "uncertain"]);
    expect(commandScope("oracle")).toBe("vessel");
    expect(row?.summary).toContain(ORACLE_THROW_STANDS);
    expect(helpLines("oracle").join("\n")).toContain(ORACLE_THROW_STANDS);
  });

  test("a bare cast's plan names the container, the time the CLI read, and the nonce it minted at the word", () => {
    expect(oraclePlan(argv(["cast"], { recipe: "default" }), AT, MINT)).toEqual({ verb: "oracle-cast", args: { recipe: "default", at: AT, caster: "operator", nonce: "n0" } });
  });

  test("--coins rides as six line values, bottom first; --caster names who cast", () => {
    expect(oraclePlan(argv(["cast"], { recipe: "default", coins: "7,8,9,6,7,7", caster: "h1" }), AT, MINT))
      .toEqual({ verb: "oracle-cast", args: { recipe: "default", at: AT, caster: "h1", nonce: "n0", coins: [7, 8, 9, 6, 7, 7] } });
  });

  test("--asking names the asking and mints no nonce, so the same words answer the same throw", () => {
    expect(oraclePlan(argv(["cast"], { recipe: "default", asking: "which road?" }), AT, MINT))
      .toEqual({ verb: "oracle-cast", args: { recipe: "default", at: AT, caster: "operator", asking: "which road?" } });
  });

  test("RED: --uncertain and --observe ride the plan to fill the cast meme's first slots; one door, no collapse, no unfold", async () => {
    expect(oraclePlan(argv(["cast"], { recipe: "default", asking: "which lane?", uncertain: "two leans", observe: "lar:///a/b  spirit/x" }), AT, MINT).args)
      .toEqual({ recipe: "default", at: AT, caster: "operator", asking: "which lane?", uncertain: "two leans", observe: ["lar:///a/b", "spirit/x"] });
    const help = helpLines("oracle").join("\n");
    expect(help).toContain("uncertain=");
    expect(help).toContain("observe=");
    expect(help).not.toMatch(/collapse|--unfold/);
    const r = await run(argv(["collapse"], { recipe: "default", uncertain: "u", asking: "q" }));
    expect(r.exit).toBe(2);
    expect(h.calls).toEqual([]);
  });

  test("an answered cast prints each slot the seat owes and the append line that fills it; a replay names the uncertainty it kept", async () => {
    const cast = castFromCoins([8, 8, 9, 6, 8, 8], { caster: "operator", at: AT });
    h.reply = {
      band: "answered", replayed: true, decision: "exists", created: false, title: "t", cast: castRecord(cast), text: castText(cast), readings: [],
      uncertain: "the first words", slots: [{ slot: "#/decide", phase: "◇", writer: "house-then-seat", owed: true }],
      next: { read: "lares get title=t aperture=measure", append: "lares put title=t slot='<the slot you owe>' append='<your words>'" },
      note: ORACLE_THROW_STANDS,
    };
    const r = await run(argv(["cast"], { recipe: "default", asking: "which road?" }, { json: false }));
    expect(r.exit).toBe(0);
    expect(r.out).toContain("kept: the uncertainty of the first throw: the first words");
    expect(r.out).toContain("owed: ◇ #/decide");
    expect(r.out).toContain("append=");
  });

  test("--fresh mints a nonce for the same words; --seed rides the person's words; the two never ride together", async () => {
    expect(oraclePlan(argv(["cast"], { recipe: "default", asking: "which road?" }, { fresh: true }), AT, MINT).args)
      .toMatchObject({ asking: "which road?", nonce: "n0", fresh: true });
    expect(oraclePlan(argv(["cast"], { recipe: "default", seed: "kahiko" }), AT, MINT).args)
      .toEqual({ recipe: "default", at: AT, caster: "operator", seed: "kahiko" });
    for (const [options, flags] of [[{ recipe: "default", seed: "s" }, { fresh: true }], [{ recipe: "default", seed: "s", coins: "777777" }, {}]] as const) {
      const r = await run(argv(["cast"], { ...options }, { ...flags, json: true }));
      expect(r.exit).toBe(2);
    }
    expect(h.calls).toEqual([]);
  });

  test("a seat's fresh throw answers asks: the line a person runs, and a non-zero exit", async () => {
    h.reply = { band: "asks", decision: "asks", asks: { who: "a person's hand", answer: "lares oracle cast recipe=default asking=\"q\" fresh=true", why: "w" } };
    const r = await run(argv(["cast"], { recipe: "default", asking: "q" }, { fresh: true, json: false }));
    expect(r.exit).toBe(5);
    expect(r.err).toContain("fresh=");
    const j = await run(argv(["cast"], { recipe: "default", asking: "q" }, { fresh: true, json: true }));
    expect(JSON.parse(j.out)).toMatchObject({ ok: false, data: { band: "asks" }, error: { code: "asks-a-hand" } });
  });

  test("a lost answer reads owed, never failed: the asking's id and the read-back ride with it", async () => {
    h.fault = { code: "outcome-unknown", message: "stopped waiting", requestId: "r9" };
    const r = await run(argv(["cast"], { recipe: "default", asking: "which road?" }, { json: true }));
    expect(r.exit).toBe(6);
    const out = JSON.parse(r.out);
    expect(out).toMatchObject({ ok: false, requestId: "r9", data: { band: "owed", asking: "which road?" }, error: { code: "outcome-unknown" } });
    expect(out.error.hint).toContain("same line");
    expect(out.error.hint).toContain("lares vessel request r9");
  });

  test("a replayed asking prints that its throw already stood", async () => {
    const cast = castFromCoins([8, 8, 9, 6, 8, 8], { caster: "operator", at: AT });
    h.reply = { band: "answered", replayed: true, decision: "exists", created: false, title: "t", cast: castRecord(cast), text: castText(cast), readings: [], note: ORACLE_THROW_STANDS };
    const r = await run(argv(["cast"], { recipe: "default", asking: "which road?" }, { json: false }));
    expect(r.exit).toBe(0);
    expect(r.out).toContain("this asking already holds its throw");
  });

  test("coins that read wrong refuse before any vessel call", async () => {
    const r = await run(argv(["cast"], { recipe: "default", coins: "7,8,9" }, { json: true }));
    expect(r.exit).not.toBe(0);
    expect(h.calls).toEqual([]);
  });

  test("the reading prints plainly by default: the cast and each reading the vessel answered", async () => {
    const cast = castFromCoins([8, 8, 9, 6, 8, 8], { caster: "operator", at: AT });
    h.reply = {
      decision: "put", created: true, title: castRecord(cast)["title"], cast: castRecord(cast), text: castText(cast), note: ORACLE_THROW_STANDS,
      readings: [
        { title: "lar:///ha.ka.ba/lares/library/oracles/doa/hexagram-15", caption: "15. A Name", attribution: "DOA", license: "Kopyleft 2022", text: "! 15\n\nA reading." },
        { title: "lar:///ha.ka.ba/lares/library/oracles/e-jing/hexagram-15", absent: true },
      ],
    };
    const r = await run(argv(["cast"], { recipe: "default", coins: "889688" }, { json: false }));
    expect(r.exit).toBe(0);
    expect(h.calls[0]!.verb).toBe("oracle-cast");
    expect(r.out).toContain("Hexagram 15");
    expect(r.out).toContain("15. A Name");
    expect(r.out).toContain("A reading.");
    expect(r.out).toContain("Kopyleft 2022");
    expect(r.out).toContain(String(castRecord(cast)["title"]));
    expect(r.out).toContain(ORACLE_THROW_STANDS);
  });

  test("json=true carries the verb's answer verbatim as data", async () => {
    h.reply = { decision: "put", created: true, title: "t", note: ORACLE_THROW_STANDS };
    const r = await run(argv(["cast"], { recipe: "default" }, { json: true }));
    expect(JSON.parse(r.out)).toMatchObject({ ok: true, data: h.reply });
  });

  test("a sleeping vessel answers with both sources and the operator's changing lines", async () => {
    h.offline = true;
    const r = await run(argv(["cast"], { recipe: "default", coins: "889688" }, { json: true }));
    expect(r.exit).toBe(0);
    const data = JSON.parse(r.out).data;
    const expected = castFromCoins([8, 8, 9, 6, 8, 8], { caster: "operator", at: data.cast.at });
    expect(data.offline).toBe(true);
    expect(data.cast).toEqual(castRecord(expected));
    expect(data.readings).toHaveLength(4);
    for (const reading of data.readings) {
      expect(reading.text).toContain("!");
      expect(reading.attribution).toBeTruthy();
      expect(reading.license).toBeTruthy();
    }
  });

  test("a sleeping vessel draws through the platform door and prints its readings", async () => {
    h.offline = true;
    const json = await run(argv(["cast"], { recipe: "default" }, { json: true }));
    const data = JSON.parse(json.out).data;
    expect(data.cast.entropy).toBe("platform:crypto.getRandomValues");
    expect(data.cast.lines).toHaveLength(6);
    const plain = await run(argv(["cast"], { recipe: "default", coins: "889688" }, { json: false }));
    expect(plain.exit).toBe(0);
    expect(plain.out).toContain("Robert Shea");
    expect(plain.out).toContain("Kopyleft");
    expect(plain.out).toContain("no record was saved");
  });

  test("a sleeping vessel keeps no asking: --asking refuses offline with its cure, and never draws silent coins", async () => {
    h.offline = true;
    const r = await run(argv(["cast"], { recipe: "default", asking: "which road?" }, { json: true }));
    expect(r.exit).toBe(2);
    const out = JSON.parse(r.out);
    expect(out.error.message).toContain("lares vessel stand");
    expect(out.error.message).toContain("seed=");
  });

  test("a sleeping vessel honors --seed: the seed's coins, named by its digest", async () => {
    h.offline = true;
    const one = JSON.parse((await run(argv(["cast"], { recipe: "default", seed: "a strong seed", asking: "q" }, { json: true }))).out).data;
    const two = JSON.parse((await run(argv(["cast"], { recipe: "default", seed: "a strong seed" }, { json: true }))).out).data;
    expect(one.cast.entropy).toMatch(/^seed:sha256:[0-9a-f]{16}$/);
    expect(one.cast.lines).toEqual(two.cast.lines);
  });

  test("RED: --by names the library shelf; the default shelf rides nothing, so every earlier plan keeps its bytes", () => {
    expect(oraclePlan(argv(["cast"], { recipe: "default", asking: "which road?", by: "doa" }), AT, MINT).args)
      .toEqual({ recipe: "default", at: AT, caster: "operator", asking: "which road?", by: "doa" });
    expect(oraclePlan(argv(["cast"], { recipe: "default", asking: "which road?", by: "e-jing" }), AT, MINT).args)
      .toEqual({ recipe: "default", at: AT, caster: "operator", asking: "which road?" });
    expect(doorTakes("oracle")).toContain("by");
  });

  test("RED: a sleeping vessel reads the checkout's shelves: --by doa casts, an unknown kind refuses by name with the shelves that stand", async () => {
    h.offline = true;
    const doa = JSON.parse((await run(argv(["cast"], { recipe: "default", coins: "889688", by: "doa" }, { json: true }))).out).data;
    expect(doa).toMatchObject({ offline: true, by: "doa", method: "three-coins" });
    const r = await run(argv(["cast"], { recipe: "default", coins: "889688", by: "tarot" }, { json: true }));
    expect(r.exit).toBe(2);
    const message = String(JSON.parse(r.out).error.message);
    expect(message).toContain("oracle-shelf-unknown");
    expect(message).toContain("doa (three-coins) · e-jing (three-coins)");
  });

  test("the help warns that a weak seed reads back from its digest", () => {
    expect(helpLines("oracle").join("\n")).toContain("guess");
  });

  test("a bare `lares oracle` prints its help, the limit included", async () => {
    const r = await run(argv([]));
    expect(r.exit).toBe(2);
    expect(r.err).toContain(ORACLE_THROW_STANDS);
  });
});
