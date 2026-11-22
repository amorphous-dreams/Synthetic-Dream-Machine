/**
 * THE SENSE DOOR SHRINKS: the read instruments answer as lenses on one `analyze` verb, roster reads at two grains,
 * pour carries the bulk pass, and the retired spellings refuse as unknown verbs (alpha line: no bridge).
 *
 * Every door runs through the real dispatcher under a scratch LAR_ROOT and HOME, so a lens that reads a sensorium
 * reads an empty one and answers its honest absence. Control: a lens asked by its plain name and the same lens asked
 * by its canon house name answer the same lens.
 *
 * Road: lar:///ha.ka.ba/kahua/memory/road/leap-ux-collapse (fold 1)
 */
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { door } from "./laws/harness.js";
import { SENSE_LENSES } from "../src/commands/sense-analyze.js";

const LENSES = ["changes", "rhythm", "couple", "cohere", "square", "lead", "forecast", "mismatch"];

const saved: Record<string, string | undefined> = {};
let scratch = "";
beforeAll(() => {
  scratch = mkdtempSync(join(tmpdir(), "sense-lenses-"));
  for (const k of ["LAR_ROOT", "HOME", "XDG_STATE_HOME"]) saved[k] = process.env[k];
  process.env["LAR_ROOT"] = join(scratch, "root");
  process.env["HOME"] = join(scratch, "home");
  process.env["XDG_STATE_HOME"] = join(scratch, "state");
});
afterAll(() => {
  for (const [k, v] of Object.entries(saved)) if (v === undefined) delete process.env[k]; else process.env[k] = v;
  rmSync(scratch, { recursive: true, force: true });
});

const json = (out: string): Record<string, unknown> => JSON.parse(out.trim().split("\n").at(-1)!) as Record<string, unknown>;

describe("sense analyze --lens: one door, the lens chooses", () => {
  test("the lens table names the eight plain lenses, in order", () => {
    expect(Object.keys(SENSE_LENSES)).toEqual(LENSES);
  });

  test("no lens refuses (exit 2) and names every lens", async () => {
    const r = await door(["sense", "analyze", "--no-json"]);
    expect(r.code).toBe(2);
    for (const l of LENSES) expect(r.err).toContain(l);
  });

  test("an unknown lens refuses loudly and lists the lenses", async () => {
    const r = await door(["sense", "analyze", "--lens", "zz-no-such-lens", "--json"]);
    expect(r.code).toBe(2);
    const message = String((json(r.out)["error"] as Record<string, unknown>)["message"]);
    expect(message).toContain("zz-no-such-lens");
    for (const l of LENSES) expect(message).toContain(l);
  });

  test("a TS-native lens answers and echoes the lens it applied", async () => {
    const r = await door(["sense", "analyze", "--lens", "cohere", "--json"]);
    expect(r.code).toBe(0);
    expect((json(r.out)["data"] as Record<string, unknown>)["lens"]).toBe("cohere");
  });

  test("the canon house name flows to its plain lens (CONTROL: same lens, same echo)", async () => {
    const plain = await door(["sense", "analyze", "--lens", "couple", "--json"]);
    const house = await door(["sense", "analyze", "--lens", "ki", "--json"]);
    expect(plain.code).toBe(0);
    expect(house.code).toBe(0);
    expect((json(plain.out)["data"] as Record<string, unknown>)["lens"]).toBe("couple");
    expect((json(house.out)["data"] as Record<string, unknown>)["lens"]).toBe("couple");
  });

  test("a signal lens without --signal refuses and still names its lens", async () => {
    const r = await door(["sense", "analyze", "--lens", "forecast", "--json"]);
    expect(r.code).toBe(2);
    expect(String((json(r.out)["error"] as Record<string, unknown>)["message"])).toContain("--lens forecast");
  });
});

describe("the retired spellings refuse as unknown sense verbs", () => {
  test.each([["ki"], ["li"], ["jing"], ["couple-r"], ["forecast"], ["mismatch"], ["rejim"], ["inspect"], ["sweep"], ["flow"]])(
    "`lares sense %s` reads as no verb", async (verb) => {
      const r = await door(["sense", verb, "--json"]);
      expect(r.code).toBe(2);
      const error = json(r.out)["error"] as Record<string, unknown>;
      expect(error["code"]).toBe("usage");
      expect(String(error["message"])).toMatch(/^name a verb/);
    });
});

describe("roster reads at two grains", () => {
  test("bare roster lists every sensorium", async () => {
    const r = await door(["sense", "roster", "--json"]);
    expect(r.code).toBe(0);
    const data = json(r.out)["data"] as Record<string, unknown>;
    expect(data["verb"]).toBe("roster");
    expect(Array.isArray((data["result"] as Record<string, unknown>)["sensoria"])).toBe(true);
  });

  test("roster <name> reads that one sensorium's facets, and an absent one refuses naming the roster", async () => {
    const r = await door(["sense", "roster", "zz-no-such-sensorium", "--json"]);
    expect(r.code).not.toBe(0);
    expect(String((json(r.out)["error"] as Record<string, unknown>)["message"])).toContain("zz-no-such-sensorium");
  });
});

describe("a fold refuses by name every flag its path does not read", () => {
  test.each([
    [["--lens", "couple", "--signal", "x.ndjson"], "--signal"],
    [["--lens", "changes", "--repour"], "--repour"],
    [["--lens", "rhythm", "--spectral"], "--spectral"],
    [["--lens", "forecast", "--signal", "x.ndjson", "--names", "a,b"], "--names"],
    [["--lens", "square", "--wing", "w"], "--wing"],
  ])("`sense analyze %j` refuses naming %s", async (tail, flag) => {
    const r = await door(["sense", "analyze", ...tail, "--json"]);
    expect(r.code).toBe(2);
    const message = String((json(r.out)["error"] as Record<string, unknown>)["message"]);
    expect(message).toContain(flag);
  });

  test("pour --bulk refuses the flags only another leg reads", async () => {
    const r = await door(["sense", "pour", "--bulk", "--writeback", "--json"]);
    expect(r.code).toBe(2);
    expect(String((json(r.out)["error"] as Record<string, unknown>)["message"])).toContain("--writeback");
  });

  test("roster <name> refuses a flag the roster never reads", async () => {
    const r = await door(["sense", "roster", "memory", "--lens", "content", "--json"]);
    expect(r.code).toBe(2);
    expect(String((json(r.out)["error"] as Record<string, unknown>)["message"])).toContain("--lens");
  });
});

describe("pour walks one leg at a time", () => {
  test.each([[["--all", "--bulk"]], [["--bulk", "--writeback"]], [["--all", "--writeback"]]])(
    "`sense pour %j` refuses naming both legs", async (legs) => {
      const r = await door(["sense", "pour", ...legs, "--json"]);
      expect(r.code).toBe(2);
      const said = `${r.out}\n${r.err}`;
      for (const leg of legs) expect(said).toContain(leg);
    });
});

describe("the help says what each lens reads", () => {
  test("lead, forecast and mismatch read a --signal the caller hands in; no line claims every lens reads a poured sensorium", async () => {
    const { helpLines } = await import("../src/command-help.js");
    const { COMMANDS } = await import("../src/bin/lares.js");
    const lines = helpLines("sense");
    for (const lens of ["lead", "forecast", "mismatch"]) {
      const line = lines.find((l) => l.trimStart().startsWith(`${lens} `));
      expect(line, `the ${lens} line`).toContain("--signal");
    }
    const summary = COMMANDS.find((c) => c.name === "sense")!.summary;
    expect([...lines, summary].join("\n")).not.toMatch(/every (read )?instrument over a poured sensorium/i);
  });
});
