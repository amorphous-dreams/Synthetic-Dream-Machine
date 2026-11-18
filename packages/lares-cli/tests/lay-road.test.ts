/**
 * lay-road — `lares vessel lay` feeds every disk-sourced holding through ONE road: CREATE (converging on the bag
 * that stands) then the diff-gated INGEST into its canon bag. The road reads where canon stands (the canon source the
 * daemon resolves), never a name list, and the lay never walks LOAD + MOVE (the human promotion door): it sends no
 * act that writes a wiki's working layer.
 *
 * Stories:
 *   S1  (story 4) a disk-sourced non-system bag (sdm, crossroads) takes CREATE then INGEST, no LOAD and no MOVE
 *   S2  (stories 1-3) no gesture the lay sends names a working layer: a working edit, a working-only title and a
 *       disk-deleted title's working copy stay where the hand left them (the island side: canon-change-weighs-overrides)
 *   S3  a system holding (lares) rides the same road: CREATE converges on the realm's bag, then INGEST
 *   S4  a holding whose canon source stands off disk (a private plane, or a dir outside the canon source) takes no road
 *   S5  a preview sends the INGEST preview alone, no CREATE
 *   S6  (story 6) the lay warns where canon stands fresher than a working copy above it, names capped; nothing writes
 *   S8  house canon on a face outside the Kahu cabal: the CREATE answers `readsFloor`, the lay sends no INGEST, names the
 *       state ("house canon, written by the Kahu steward (h0); this face reads the floor") and reads clean
 */

import { describe, expect, test, vi, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ParsedArgs } from "../src/parse-args.js";

type Call = { readonly command: string; readonly positional: string[]; readonly options: Record<string, string>; readonly flags: Record<string, unknown>; readonly claims?: unknown };
const calls: Call[] = [];
let fresherFor: Record<string, unknown> = {};
let floorFor = new Set<string>();
let floorJson = false;
vi.mock("../src/commands/act.js", () => ({
  cmdAct: vi.fn(async (args: ParsedArgs, claims?: unknown) => {
    calls.push({ command: args.command, positional: [...args.positional], options: { ...args.options }, flags: { ...args.flags }, claims });
    // The action handler's answer for house canon on a face outside the Kahu cabal, as `act` prints it.
    if (floorFor.has(String(args.options["bag"]))) {
      // Off a terminal `act` prints its answer as ONE JSON line straight to stdout (`emit`), never through console.log.
      if (floorJson) process.stdout.write(`${JSON.stringify({ ok: true, requestId: "r", data: { verb: "CREATE", bag: args.options["bag"], plane: "catalog", alreadyStood: true, resolvedElsewhere: true, readsFloor: true, count: 0 } })}\n`);
      else { console.log("CREATE ✓ applied locally (req 00000000)"); console.log(`  ${"readsFloor".padEnd(12)} true`); }
    }
    return 0;
  }),
}));
vi.mock("../src/commands/ingest.js", () => ({
  cmdIngest: vi.fn(async (args: ParsedArgs, sink?: { fresher?: unknown }) => {
    calls.push({ command: args.command, positional: [...args.positional], options: { ...args.options }, flags: { ...args.flags } });
    const o = fresherFor[String(args.options["to"])];
    if (sink && o) sink.fresher = o;
    return 0;
  }),
}));

import { layHolding, canonIsDisk, cmdLay, createReadsFloor, HOUSE_CANON_FLOOR_REASON } from "../src/commands/lay.js";

let root: string;
const prior = { root: process.env["LAR_ROOT"], bags: process.env["LAR_BAGS"] };
beforeEach(() => {
  calls.length = 0; fresherFor = {}; floorFor = new Set();
  root = mkdtempSync(join(tmpdir(), "lares-lay-road-"));
  for (const b of ["crossroads", "lares", "sdm", "kahua-0f1e2d3c-4b5a-4968-8776-655443322110"]) { mkdirSync(join(root, "bags", b), { recursive: true }); writeFileSync(join(root, "bags", b, "one.mem"), "x"); }
  process.env["LAR_ROOT"] = root;
  process.env["LAR_BAGS"] = join(root, "bags");
});
afterEach(() => {
  rmSync(root, { recursive: true, force: true });
  if (prior.root === undefined) delete process.env["LAR_ROOT"]; else process.env["LAR_ROOT"] = prior.root;
  if (prior.bags === undefined) delete process.env["LAR_BAGS"]; else process.env["LAR_BAGS"] = prior.bags;
});

const applied: ParsedArgs = { command: "vessel", positional: ["lay"], options: {}, flags: { apply: true, yes: true } };
const preview: ParsedArgs = { command: "vessel", positional: ["lay"], options: {}, flags: {} };
const holdingOf = (slug: string) => ({ holding: slug, source: join(root, "bags", slug), toBag: `lar:///ha.ka.ba/bags/${slug}` });

describe("the lay feeds every disk-sourced holding through CREATE then INGEST", () => {
  test("S1 — a disk-sourced non-system bag takes CREATE then INGEST, never LOAD or MOVE", async () => {
    for (const slug of ["sdm", "crossroads"]) {
      calls.length = 0;
      const h = holdingOf(slug);
      expect(canonIsDisk(h)).toBe(true);
      const row = await layHolding(applied, h);
      expect(row).toMatchObject({ holding: slug, gesture: "ingest", exitCode: 0 });
      expect(calls.map((c) => `${c.command}:${c.positional[0] ?? ""}`)).toEqual(["act:CREATE", "ingest:"]);
      expect(calls[0]!.options).toMatchObject({ bag: h.toBag });
      expect(calls[1]!.options).toMatchObject({ source: h.source, to: h.toBag });
    }
  });

  test("S2 — no gesture the lay sends names a working layer", async () => {
    await cmdLay(applied);
    expect(calls.length).toBeGreaterThan(0);
    for (const c of calls) {
      expect(["CREATE", undefined]).toContain(c.positional[0]);
      expect(JSON.stringify(c.options)).not.toMatch(/\/wikis\/[^/]+\/working/);
    }
  });

  test("S3 — a system holding rides the same road", async () => {
    const row = await layHolding(applied, holdingOf("lares"));
    expect(row.gesture).toBe("ingest");
    expect(calls.map((c) => `${c.command}:${c.positional[0] ?? ""}`)).toEqual(["act:CREATE", "ingest:"]);
  });

  test("S4 — a private plane and a dir outside the canon source take no road", async () => {
    const plane = holdingOf("kahua-0f1e2d3c-4b5a-4968-8776-655443322110");
    expect(canonIsDisk(plane)).toBe(false);
    expect(await layHolding(applied, plane)).toMatchObject({ gesture: "skip", exitCode: 0 });
    const outside = { holding: "sdm", source: join(root, "elsewhere", "sdm"), toBag: "lar:///ha.ka.ba/bags/sdm" };
    expect(canonIsDisk(outside)).toBe(false);
    expect(calls).toEqual([]);
  });

  test("S5 — a preview sends the INGEST preview alone", async () => {
    const row = await layHolding(preview, holdingOf("sdm"));
    expect(row).toMatchObject({ gesture: "ingest", exitCode: 0 });
    expect(calls.map((c) => c.command)).toEqual(["ingest"]);
    expect(calls[0]!.flags["apply"]).toBeUndefined();
  });

  test("S6 — the lay warns where canon stands fresher than a working copy, names capped", async () => {
    fresherFor["lar:///ha.ka.ba/bags/sdm"] = { working: "lar:///ha.ka.ba/wikis/sdm/working", count: 10, titles: Array.from({ length: 10 }, (_, i) => `t${i}`) };
    const lines: string[] = [], errors: string[] = [];
    const log = console.log, error = console.error;
    console.log = (...a: unknown[]) => { lines.push(a.join(" ")); };
    console.error = (...a: unknown[]) => { errors.push(a.join(" ")); };
    try { expect(await cmdLay(applied)).toBe(0); } finally { console.log = log; console.error = error; }
    const warn = errors.find((e) => e.includes("canon is fresher than the working copy above it"));
    expect(warn).toContain("for 10 title(s)");
    expect(warn).toContain("sdm:t0");
    expect(warn).toContain("… 2 more");
    expect(warn).not.toContain("sdm:t9");
    expect(lines.some((l) => l.startsWith("- kahua-0f1e2d3c-4b5a-4968-8776-655443322110: no road"))).toBe(true);
    expect(lines.at(-1)).toMatch(/^lay: 3\/3 holdings · 1 off disk · \d+s$/);
  });
});

import { pendingRemovalLines } from "../src/commands/lay.js";
describe("house canon on a face outside the Kahu cabal reads the floor", () => {
  test("S8 — a CREATE that answers readsFloor sends no INGEST; the lay names the state and reads clean", async () => {
    floorFor = new Set(["lar:///ha.ka.ba/bags/sdm", "lar:///ha.ka.ba/bags/lares"]);
    for (const slug of ["sdm", "lares"]) {
      calls.length = 0;
      const row = await layHolding(applied, holdingOf(slug));
      expect(row).toMatchObject({ holding: slug, gesture: "floor", exitCode: 0, reason: HOUSE_CANON_FLOOR_REASON });
      expect(calls.map((c) => `${c.command}:${c.positional[0] ?? ""}`)).toEqual(["act:CREATE"]);
    }
    expect(HOUSE_CANON_FLOOR_REASON).toBe("house canon, written by the Kahu steward (h0); this face reads the floor");
    // CONTROL: the board (crossroads) answers no floor and takes CREATE then INGEST.
    calls.length = 0;
    expect(await layHolding(applied, holdingOf("crossroads"))).toMatchObject({ gesture: "ingest", exitCode: 0 });
    expect(calls.map((c) => c.command)).toEqual(["act", "ingest"]);
  });
  test("S9 — the lay's CREATE names a disk-sourced holding house canon, so an island that never seated it mints no row; the board carries no such claim", async () => {
    floorFor = new Set();
    for (const slug of ["sdm", "lares"]) {
      calls.length = 0;
      await layHolding(applied, holdingOf(slug));
      expect(calls[0]).toMatchObject({ command: "act", positional: ["CREATE"], claims: { houseCanon: true } });
    }
    // CONTROL: the Nexus's public board stays an ordinary catalog bag.
    calls.length = 0;
    await layHolding(applied, holdingOf("crossroads"));
    expect(calls[0]).toMatchObject({ command: "act", positional: ["CREATE"], claims: { houseCanon: false } });
    // The claim rides beside the parsed arguments: no flag of the lay's or of `act` carries it, so neither door grows a typed surface.
    for (const call of calls) expect(Object.keys(call.flags)).not.toContain("house-canon");
  });
  test("S8d — the lay hears the CREATE's answer where `act` writes it as JSON to stdout: no INGEST follows, the answer still prints, and the lay reads clean", async () => {
    floorFor = new Set(["lar:///ha.ka.ba/bags/lares"]);
    floorJson = true;
    const written: string[] = [];
    const spy = vi.spyOn(process.stdout, "write").mockImplementation((m: unknown) => { written.push(String(m)); return true; });
    try {
      calls.length = 0;
      const row = await layHolding(applied, holdingOf("lares"));
      expect(row).toMatchObject({ holding: "lares", gesture: "floor", exitCode: 0, reason: HOUSE_CANON_FLOOR_REASON });
      expect(calls.map((c) => `${c.command}:${c.positional[0] ?? ""}`)).toEqual(["act:CREATE"]);
      expect(written.join("")).toContain('"readsFloor":true');                 // the answer still reaches the caller's stdout
    } finally { spy.mockRestore(); floorJson = false; }
  });
  test("S8b — the floor reading reads the printed answer alone", () => {
    expect(createReadsFloor(["CREATE ✓ applied locally (req 1)", "  readsFloor   true"])).toBe(true);
    expect(createReadsFloor(["CREATE ✓ applied locally (req 1)", "  alreadyStood true"])).toBe(false);
  });
  test("S8c — the floor reading reads the answer `act` prints as one JSON line too (a pipe, a seat, a harness), by its own field alone", () => {
    // The CREATE's answer as a walk on a scratch hearth printed it, the engineer worn: no human line stands in it.
    const answer = (data: Record<string, unknown>): string => JSON.stringify({ ok: true, requestId: "7m4v2m373g4a6v1q5r6u2v2b522b5f6j", data: { verb: "CREATE", bag: "lar:///ha.ka.ba/bags/lararium", plane: "catalog", alreadyStood: true, resolvedElsewhere: true, ...data, count: 0 } });
    expect(createReadsFloor([answer({ readsFloor: true, houseCanon: HOUSE_CANON_FLOOR_REASON })])).toBe(true);
    // CONTROLS: the steward's own answer names no floor; a field that only quotes the word reads as no floor; a torn line reads as none.
    expect(createReadsFloor([answer({})])).toBe(false);
    expect(createReadsFloor([answer({ readsFloor: false })])).toBe(false);
    expect(createReadsFloor([answer({ note: '"readsFloor":true' })])).toBe(false);
    expect(createReadsFloor(['{"ok":true,"data":{"readsFloor":true'])).toBe(false);
  });
});

describe("the lay answers a shore flood once", () => {
  test("S7 — the summary counts pending removals per fed bag and prints one batch answer each", () => {
    const rows = [
      ...Array.from({ length: 3 }, (_, i) => ({ bagId: "lar:///ha.ka.ba/bags/sdm", uri: `u${i}` })),
      { bagId: "lar:///ha.ka.ba/bags/crossroads", uri: "c" },
      { bagId: "lar:///ha.ka.ba/wikis/daemon-x/working", uri: "d" },
    ];
    expect(pendingRemovalLines(rows, ["lar:///ha.ka.ba/bags/sdm", "lar:///ha.ka.ba/bags/crossroads"])).toEqual([
      "lay: 1 pending removal(s) in lar:///ha.ka.ba/bags/crossroads: the files left disk and nothing tombstoned; answer once with `lares shore remove --all --count 1 --bag lar:///ha.ka.ba/bags/crossroads` (or `restore --all --count 1 --bag lar:///ha.ka.ba/bags/crossroads`)",
      "lay: 3 pending removal(s) in lar:///ha.ka.ba/bags/sdm: the files left disk and nothing tombstoned; answer once with `lares shore remove --all --count 3 --bag lar:///ha.ka.ba/bags/sdm` (or `restore --all --count 3 --bag lar:///ha.ka.ba/bags/sdm`)",
    ]);
  });
});
