/**
 * `lares shore log` — the vessel's log records through the door, and the flat fallback where no vessel answers.
 *
 * Control: the door's filter names the prefix and each field a query names; `--held` keeps the unacknowledged (and the
 * recurred); with the door dark the command reads `run/vessel-live.log` and the month ash, names that it does, and every
 * fallback record reads held; with neither, it exits 3.
 */
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ShoreLogRing, shoreLogFields, shoreLogJsonLine } from "@lararium/mesh/shore-log";
import type { ParsedArgs } from "../src/parse-args.js";

const door = vi.hoisted(() => ({ answer: null as unknown, throws: null as Error | null }));
vi.mock("../src/commands/door-call.js", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../src/commands/door-call.js")>()),
  tryDoor: async () => { if (door.throws) throw door.throws; return door.answer; },
}));

const { cmdShoreLog, readFlatShoreLog, selectShoreLog, shoreLogFilter, shoreLogQuery } = await import("../src/commands/shore-log.js");
const { shoreArgs, SHORE_ACTS } = await import("../src/commands/shore.js");

const parsed = (positional: string[], options: Record<string, string> = {}, flags: Record<string, boolean> = {}): ParsedArgs =>
  ({ positional, options, flags }) as unknown as ParsedArgs;

const ring = new ShoreLogRing({ boot: "b1", now: () => "t" });
ring.take("[sealed-rest] save-unsealed: 3xYqAbCdEfGh… waits");
ring.take("[sealed-rest] save-unsealed: 3xYqAbCdEfGh… waits");
ring.take("[faces] skips h1");
const [unsealed, skips] = [ring.records().find((r) => r.kind === "sealed-rest/save-unsealed")!, ring.records().find((r) => r.kind === "faces/skips")!];

let house: string;
let prior: string | undefined;
let out: string[];
beforeEach(() => {
  house = mkdtempSync(join(tmpdir(), "shore-log-cmd-"));
  prior = process.env["LAR_ROOT"];
  process.env["LAR_ROOT"] = house;
  out = [];
  vi.spyOn(console, "log").mockImplementation((...a: unknown[]) => { out.push(a.join(" ")); });
  vi.spyOn(console, "error").mockImplementation((...a: unknown[]) => { out.push(a.join(" ")); });
  door.answer = null; door.throws = null;
});
afterEach(() => {
  vi.restoreAllMocks();
  if (prior === undefined) delete process.env["LAR_ROOT"]; else process.env["LAR_ROOT"] = prior;
  rmSync(house, { recursive: true, force: true });
});

describe("the query", () => {
  test("log rides the shore door's acts and reads no hand", () => {
    expect(SHORE_ACTS).toContain("log");
    expect(shoreArgs("log", parsed(["log"]))).toEqual({ args: { op: "log" } });
  });
  test("the filter names the prefix, a kind and a boot", () => {
    expect(shoreLogFilter({ kind: null, held: false, boot: null })).toBe("[prefix[$:/lares/shore/log/event/]]");
    expect(shoreLogFilter({ kind: "faces/skips", held: true, boot: "b1" })).toBe("[prefix[$:/lares/shore/log/event/]field:kind[faces/skips]field:boot[b1]]");
  });
  test("a kind with a bracket, or a boot that reads no id, refuses as usage", () => {
    expect(shoreLogQuery(parsed(["log"], { kind: "a]b" }))).toHaveProperty("usage");
    expect(shoreLogQuery(parsed(["log"], { boot: "not-hex!" }))).toHaveProperty("usage");
    expect(shoreLogQuery(parsed(["log"], { kind: "faces/skips" }, { held: true }))).toEqual({ kind: "faces/skips", held: true, boot: null });
  });
  test("--held keeps the unacknowledged and the recurred, newest change first", () => {
    const rows = [{ ...unsealed, ack: 2 }, { ...skips, ack: null }];
    expect(selectShoreLog(rows, { kind: null, held: true, boot: null }).map((r) => r.kind)).toEqual(["faces/skips"]);
    expect(selectShoreLog([{ ...unsealed, ack: 1 }], { kind: null, held: true, boot: null })).toHaveLength(1);
    expect(selectShoreLog(rows, { kind: null, held: false, boot: null }).map((r) => r.lastSeq)).toEqual([3, 2]);
  });
});

describe("through the door", () => {
  test("the door's rows read back as records, the counts by kind first", async () => {
    door.answer = { ok: true, requestId: "r", output: { rows: [{ title: "t1", fields: shoreLogFields(unsealed) }, { title: "t2", fields: { ...shoreLogFields(skips), ack: "3" } }] } };
    expect(await cmdShoreLog(parsed(["log"], {}, { held: true, json: false }))).toBe(0);
    expect(out.join("\n")).toMatch(/sealed-rest\/save-unsealed 3xYqAbCdEfGh ×2/);
    expect(out.join("\n")).not.toMatch(/faces\/skips/);
    expect(out.join("\n")).not.toMatch(/flat fallback/);
  });
});

describe("the flat fallback", () => {
  test("with the door dark it reads run/vessel-live.log and the ash, and names that it does", async () => {
    mkdirSync(join(house, "run", "shore-ash"), { recursive: true });
    writeFileSync(join(house, "run", "vessel-live.log"), `${shoreLogJsonLine({ ...unsealed, count: 1 })}\n${shoreLogJsonLine(unsealed)}\n`);
    writeFileSync(join(house, "run", "shore-ash", "2026-11.jsonl"), `${shoreLogJsonLine({ ...skips, boot: "b0" })}\n`);
    door.throws = Object.assign(new Error("no vessel listens on the sock"), { code: "no-container" });
    expect(await cmdShoreLog(parsed(["log"], {}, { json: false }))).toBe(0);
    const text = out.join("\n");
    expect(text).toMatch(/no vessel answers \(.*\); reading the flat fallback: .*shore-ash\/2026-11\.jsonl, .*vessel-live\.log/);
    expect(text).toMatch(/save-unsealed 3xYqAbCdEfGh ×2 .* held/);
    expect(text).toMatch(/faces\/skips ×1 .*boot b0 held/);
    expect(readFlatShoreLog(join(house, "run")).rows.every((r) => r.ack === null)).toBe(true);
  });
  test("a door refusal (the face shut) falls back too; with no flat log it exits 3", async () => {
    door.answer = { ok: false, requestId: "r", message: "face-not-open: face h1 stands shut", named: "face-not-open" };
    expect(await cmdShoreLog(parsed(["log"], {}, { json: false }))).toBe(3);
    expect(out.join("\n")).toMatch(/no vessel answers \(face-not-open: face h1 stands shut\), and no flat log stands at/);
  });
});
