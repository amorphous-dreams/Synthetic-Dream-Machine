/**
 * `lares oracle cast` — the CLI skin of the `oracle-cast` verb: one cast, written by the vessel as one tiddler. The line
 * plans the verb's args (the container, the operator's coins, the caster, the time the CLI reads once at its edge),
 * prints the reading plainly by default and the verb's own answer under `--json`, and its help says the oracle widens
 * attention and never decides.
 */
import { afterEach, describe, test, expect, vi } from "vitest";

const h = vi.hoisted(() => ({
  calls: [] as Array<{ verb: string; args: Record<string, unknown> }>,
  reply: {} as Record<string, unknown>,
  offline: false,
}));
vi.mock("../src/verb-call.js", () => {
  class DaemonUnreachable extends Error {}
  return {
  DaemonUnreachable,
  verbFailure: (err: unknown) => ({ code: "error", message: err instanceof Error ? err.message : String(err) }),
  runVerb: async (verb: string, args: Record<string, unknown>) => {
    h.calls.push({ verb, args });
    if (h.offline) throw new DaemonUnreachable();
    return { status: "done", requestId: "r", results: { summary: { ok: true, output: h.reply } } };
  },
}; });
vi.mock("../src/env.js", async (orig) => ({
  ...(await orig<typeof import("../src/env.js")>()),
  vesselDid: async () => "0x" + "ab".repeat(32),
}));

import { ORACLE_THROW_STANDS, castFromCoins, castRecord, castText } from "@lararium/mesh/oracle-cast";
import { cmdOracle, oraclePlan } from "../src/commands/oracle-cmd.js";
import { COMMANDS } from "../src/bin/lares.js";
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

afterEach(() => { h.calls.length = 0; h.reply = {}; h.offline = false; });

describe("lares oracle cast", () => {
  test("RED: the verb stands in the command table, rides the vessel, and its help names the oracle's limit", () => {
    const row = COMMANDS.find((c) => c.name === "oracle");
    expect(row).toBeDefined();
    expect(row?.accepts).toEqual(["bag", "caster", "coins", "face", "realm", "recipe"]);
    expect(commandScope("oracle")).toBe("vessel");
    expect(row?.summary).toContain(ORACLE_THROW_STANDS);
    expect(helpLines("oracle").join("\n")).toContain(ORACLE_THROW_STANDS);
  });

  test("the plan names the container, the time the CLI read, and no coins for a house cast", () => {
    expect(oraclePlan(argv(["cast"], { recipe: "default" }), AT)).toEqual({ verb: "oracle-cast", args: { recipe: "default", at: AT, caster: "operator" } });
  });

  test("--coins rides as six line values, bottom first; --caster names who cast", () => {
    expect(oraclePlan(argv(["cast"], { recipe: "default", coins: "7,8,9,6,7,7", caster: "h1" }), AT))
      .toEqual({ verb: "oracle-cast", args: { recipe: "default", at: AT, caster: "h1", coins: [7, 8, 9, 6, 7, 7] } });
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

  test("--json carries the verb's answer verbatim as data", async () => {
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

  test("a bare `lares oracle` prints its help, the limit included", async () => {
    const r = await run(argv([]));
    expect(r.exit).toBe(2);
    expect(r.err).toContain(ORACLE_THROW_STANDS);
  });
});
