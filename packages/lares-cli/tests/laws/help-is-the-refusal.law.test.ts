/**
 * L3 · HELP AND REFUSAL RENDER FROM ONE SOURCE: `lares help <door>` prints exactly the lines a refusal prints.
 *
 * Both halves run through the real dispatcher. Inputs: every door the baked pack gathers an entry for,
 * for `lares help <door>`; and for the refusal, every door whose source refuses
 * through `refuseUsage(…, helpLines(door))`, read from the command sources, plus the tunnel doors.
 * Each door runs under a scratch LAR_ROOT and HOME, so a door that reads an unknown word as an
 * argument reaches nothing of the operator's. Control: two doors render different bytes, and a
 * refusal that drops its menu reads red.
 *
 * Law: lar:///ha.ka.ba/lares/docs/pono/cli-test-laws#/L3
 */
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { packDoor, packRoute } from "@lararium/tw5/affordance-pack";
import { helpLines } from "../../src/command-help.js";
import { commands, door, helpKeys, UNKNOWN, verbTables } from "./harness.js";

const SRC = join(import.meta.dirname, "..", "..", "src", "commands");

/** The doors whose source refuses with the pack's lines, read from the command sources. */
function refusingDoors(): string[] {
  const found = new Set<string>();
  for (const f of readdirSync(SRC)) {
    if (!f.endsWith(".ts")) continue;
    for (const m of readFileSync(join(SRC, f), "utf8").matchAll(/refuseUsage\(args, "([a-z -]+)", helpLines\("\1"\)/g)) found.add(m[1]!);
  }
  // A pass-through door hands an unknown word to another program's grammar, whose own parser refuses it.
  const passes = new Set(commands().filter((c) => c.passesThrough !== undefined).map((c) => c.name));
  for (const { door: d } of verbTables()) if (d !== "vessel" && !passes.has(d.split(" ")[0]!)) found.add(d);
  return [...found].sort();
}

/** A key `helpLines` answers from one home: the baked pack, a door's entry or one verb's carrier. */
const answersHelp = (k: string): boolean => helpKeys().includes(k) || packDoor(k) !== undefined || packRoute("cli", k) !== undefined;

/**
 * The lines a door answers with, by the dispatcher's own rule: the longest pack key that leads the door (a sub-door with no
 * carrier of its own answers with its parent's).
 */
function doorKey(key: string): string | null {
  const words = key.split(" ");
  for (let n = words.length; n > 0; n--) { const k = words.slice(0, n).join(" "); if (answersHelp(k)) return k; }
  return null;
}
function doorLines(key: string): string[] {
  const k = doorKey(key);
  if (k !== null) return helpLines(k);
  return helpLines(key);
}

/** A refusal reads true when it exits 2 and its stderr ends with the door's lines. */
const refusalCarries = (r: { code: number; err: string }, key: string): boolean =>
  r.code === 2 && r.err.trimEnd().endsWith(doorLines(key).join("\n").trimEnd());

const saved: Record<string, string | undefined> = {};
let scratch = "";
beforeAll(() => {
  scratch = mkdtempSync(join(tmpdir(), "law-l3-"));
  for (const k of ["LAR_ROOT", "HOME", "XDG_STATE_HOME"]) saved[k] = process.env[k];
  process.env["LAR_ROOT"] = join(scratch, "root");
  process.env["HOME"] = join(scratch, "home");
  process.env["XDG_STATE_HOME"] = join(scratch, "state");
});
afterAll(() => {
  for (const [k, v] of Object.entries(saved)) if (v === undefined) delete process.env[k]; else process.env[k] = v;
  rmSync(scratch, { recursive: true, force: true });
});

describe("L3 · help and refusal render the same bytes", () => {
  test.each(helpKeys().map((k) => [k]))("`lares help %s` prints exactly the pack's lines", async (key) => {
    const r = await door(["help", ...key.split(" ")]);
    expect(r.code).toBe(0);
    expect(r.out.trimEnd()).toBe(helpLines(key).join("\n").trimEnd());
  });

  // A sub-door that takes a positional where a sub-verb would stand (`persona raise-sign <challenge-json>`) holds no verb for an
  // unknown name to miss: its refusal rides a missing argument, which `tests/fewer-front-doors.test.ts` walks.
  const TAKES_A_POSITIONAL = new Set(["persona raise-sign"]);
  test.each(refusingDoors().filter((k) => !TAKES_A_POSITIONAL.has(k)).map((k) => [k]))("`%s` refuses an unknown verb with the same lines, exit 2", async (key) => {
    const r = await door([...key.split(" "), UNKNOWN, "json=false"]);
    expect(refusalCarries(r, key)).toBe(true);
  });

  // A door one carrier answers reads that carrier's whole, whose first line spells the usage spine; a door of several reads an index.
  test.each(helpKeys().filter((k) => packDoor(k)!.addresses.length === 1).map((k) => [k]))("`%s`: the lines lead with its usage spine", (key) => {
    expect(helpLines(key)[0]).toMatch(new RegExp(`^usage: lares ${key}`));
  });

  test("the source scan finds the refusing doors, and each names a pack key", () => {
    const doors = refusingDoors();
    expect(doors.length).toBeGreaterThan(10);
    expect(doors.filter((d) => doorKey(d) === null)).toEqual([]);
  });

  test("the root door: bare `lares` speaks the house (lar:///lares.lararium.status), and the menu moved behind `lares help`", async () => {
    const asked = await door(["help"]);
    const bare = await door([]);
    expect(asked.code).toBe(0);
    expect(asked.out.length).toBeGreaterThan(0);
    // A scratch house stands dark: the bare door reports it, exit 0, and names the keys instead of the menu.
    expect(bare.code).toBe(0);
    expect(bare.out).toContain("lar:///lares.lararium.status");
    expect(bare.out).toContain("the house stands dark");
    expect(bare.out).toContain("keys: get=");
    expect(bare.out).not.toBe(asked.out);
  });

  test("seed: library's lines keep its verbs", () => {
    expect(helpLines("library").join("\n")).toContain("acquire");
  });

  test("CONTROL: two doors render different bytes; a refusal that drops its menu, or exits clean, reads red", async () => {
    const [a, b] = helpKeys();
    expect((await door(["help", a!])).out).not.toBe((await door(["help", b!])).out);
    const lines = helpLines("library").join("\n");
    expect(refusalCarries({ code: 2, err: `lares library: unknown sub-verb "x"\n${lines}` }, "library")).toBe(true);
    expect(refusalCarries({ code: 2, err: 'lares library: unknown sub-verb "x"' }, "library")).toBe(false);
    expect(refusalCarries({ code: 0, err: lines }, "library")).toBe(false);
  });
});
