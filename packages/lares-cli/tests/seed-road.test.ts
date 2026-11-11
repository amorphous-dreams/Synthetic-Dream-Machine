/**
 * seed-road — `lares vessel seed` feeds every disk-sourced holding through ONE road: CREATE (converging on the bag
 * that stands) then the diff-gated INGEST into its canon bag. The road reads where canon stands (the canon source the
 * daemon resolves), never a name list, and the seed never walks LOAD + MOVE (the human promotion door): it sends no
 * act that writes a wiki's working layer.
 *
 * Stories:
 *   S1  (story 4) a disk-sourced non-system bag (sdm, crossroads) takes CREATE then INGEST, no LOAD and no MOVE
 *   S2  (stories 1-3) no gesture the seed sends names a working layer: a working edit, a working-only title and a
 *       disk-deleted title's working copy stay where the hand left them (the island side: canon-change-weighs-overrides)
 *   S3  a system holding (lares) rides the same road: CREATE converges on the realm's bag, then INGEST
 *   S4  a holding whose canon source stands off disk (a private plane, or a dir outside the canon source) takes no road
 *   S5  a preview sends the INGEST preview alone, no CREATE
 *   S6  (story 6) the seed warns where canon stands fresher than a working copy above it, names capped; nothing writes
 *   S8  house canon on a face outside the Kahu cabal: the CREATE answers `readsFloor`, the seed sends no INGEST, names the
 *       state ("house canon, written by the Kahu steward (h0); this face reads the floor") and reads clean
 */

import { describe, expect, test, vi, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ParsedArgs } from "../src/parse-args.js";

type Call = { readonly command: string; readonly positional: string[]; readonly options: Record<string, string>; readonly flags: Record<string, unknown> };
const calls: Call[] = [];
let fresherFor: Record<string, unknown> = {};
let floorFor = new Set<string>();
vi.mock("../src/commands/act.js", () => ({
  cmdAct: vi.fn(async (args: ParsedArgs) => {
    calls.push({ command: args.command, positional: [...args.positional], options: { ...args.options }, flags: { ...args.flags } });
    // The action handler's answer for house canon on a face outside the Kahu cabal, as `act` prints it.
    if (floorFor.has(String(args.options["bag"]))) { console.log("CREATE ✓ applied locally (req 00000000)"); console.log(`  ${"readsFloor".padEnd(12)} true`); }
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

import { seedHolding, canonIsDisk, cmdSeed, createReadsFloor, HOUSE_CANON_FLOOR_REASON } from "../src/commands/seed.js";

let root: string;
const prior = { root: process.env["LAR_ROOT"], bags: process.env["LAR_BAGS"] };
beforeEach(() => {
  calls.length = 0; fresherFor = {}; floorFor = new Set();
  root = mkdtempSync(join(tmpdir(), "lares-seed-road-"));
  for (const b of ["crossroads", "lares", "sdm", "kahua-0f1e2d3c-4b5a-4968-8776-655443322110"]) { mkdirSync(join(root, "bags", b), { recursive: true }); writeFileSync(join(root, "bags", b, "one.mem"), "x"); }
  process.env["LAR_ROOT"] = root;
  process.env["LAR_BAGS"] = join(root, "bags");
});
afterEach(() => {
  rmSync(root, { recursive: true, force: true });
  if (prior.root === undefined) delete process.env["LAR_ROOT"]; else process.env["LAR_ROOT"] = prior.root;
  if (prior.bags === undefined) delete process.env["LAR_BAGS"]; else process.env["LAR_BAGS"] = prior.bags;
});

const applied: ParsedArgs = { command: "vessel", positional: ["seed"], options: {}, flags: { apply: true, yes: true } };
const preview: ParsedArgs = { command: "vessel", positional: ["seed"], options: {}, flags: {} };
const holdingOf = (slug: string) => ({ holding: slug, source: join(root, "bags", slug), toBag: `lar:///ha.ka.ba/bags/${slug}` });

describe("the seed feeds every disk-sourced holding through CREATE then INGEST", () => {
  test("S1 — a disk-sourced non-system bag takes CREATE then INGEST, never LOAD or MOVE", async () => {
    for (const slug of ["sdm", "crossroads"]) {
      calls.length = 0;
      const h = holdingOf(slug);
      expect(canonIsDisk(h)).toBe(true);
      const row = await seedHolding(applied, h);
      expect(row).toMatchObject({ holding: slug, gesture: "ingest", exitCode: 0 });
      expect(calls.map((c) => `${c.command}:${c.positional[0] ?? ""}`)).toEqual(["act:CREATE", "ingest:"]);
      expect(calls[0]!.options).toMatchObject({ bag: h.toBag });
      expect(calls[1]!.options).toMatchObject({ source: h.source, to: h.toBag });
    }
  });

  test("S2 — no gesture the seed sends names a working layer", async () => {
    await cmdSeed(applied);
    expect(calls.length).toBeGreaterThan(0);
    for (const c of calls) {
      expect(["CREATE", undefined]).toContain(c.positional[0]);
      expect(JSON.stringify(c.options)).not.toMatch(/\/wikis\/[^/]+\/working/);
    }
  });

  test("S3 — a system holding rides the same road", async () => {
    const row = await seedHolding(applied, holdingOf("lares"));
    expect(row.gesture).toBe("ingest");
    expect(calls.map((c) => `${c.command}:${c.positional[0] ?? ""}`)).toEqual(["act:CREATE", "ingest:"]);
  });

  test("S4 — a private plane and a dir outside the canon source take no road", async () => {
    const plane = holdingOf("kahua-0f1e2d3c-4b5a-4968-8776-655443322110");
    expect(canonIsDisk(plane)).toBe(false);
    expect(await seedHolding(applied, plane)).toMatchObject({ gesture: "skip", exitCode: 0 });
    const outside = { holding: "sdm", source: join(root, "elsewhere", "sdm"), toBag: "lar:///ha.ka.ba/bags/sdm" };
    expect(canonIsDisk(outside)).toBe(false);
    expect(calls).toEqual([]);
  });

  test("S5 — a preview sends the INGEST preview alone", async () => {
    const row = await seedHolding(preview, holdingOf("sdm"));
    expect(row).toMatchObject({ gesture: "ingest", exitCode: 0 });
    expect(calls.map((c) => c.command)).toEqual(["ingest"]);
    expect(calls[0]!.flags["apply"]).toBeUndefined();
  });

  test("S6 — the seed warns where canon stands fresher than a working copy, names capped", async () => {
    fresherFor["lar:///ha.ka.ba/bags/sdm"] = { working: "lar:///ha.ka.ba/wikis/sdm/working", count: 10, titles: Array.from({ length: 10 }, (_, i) => `t${i}`) };
    const lines: string[] = [], errors: string[] = [];
    const log = console.log, error = console.error;
    console.log = (...a: unknown[]) => { lines.push(a.join(" ")); };
    console.error = (...a: unknown[]) => { errors.push(a.join(" ")); };
    try { expect(await cmdSeed(applied)).toBe(0); } finally { console.log = log; console.error = error; }
    const warn = errors.find((e) => e.includes("canon is fresher than the working copy above it"));
    expect(warn).toContain("for 10 title(s)");
    expect(warn).toContain("sdm:t0");
    expect(warn).toContain("… 2 more");
    expect(warn).not.toContain("sdm:t9");
    expect(lines.some((l) => l.startsWith("- kahua-0f1e2d3c-4b5a-4968-8776-655443322110: no road"))).toBe(true);
    expect(lines.at(-1)).toMatch(/^seed: 3\/3 holdings · 1 off disk · \d+s$/);
  });
});

import { pendingRemovalLines } from "../src/commands/seed.js";
describe("house canon on a face outside the Kahu cabal reads the floor", () => {
  test("S8 — a CREATE that answers readsFloor sends no INGEST; the seed names the state and reads clean", async () => {
    floorFor = new Set(["lar:///ha.ka.ba/bags/sdm", "lar:///ha.ka.ba/bags/lares"]);
    for (const slug of ["sdm", "lares"]) {
      calls.length = 0;
      const row = await seedHolding(applied, holdingOf(slug));
      expect(row).toMatchObject({ holding: slug, gesture: "floor", exitCode: 0, reason: HOUSE_CANON_FLOOR_REASON });
      expect(calls.map((c) => `${c.command}:${c.positional[0] ?? ""}`)).toEqual(["act:CREATE"]);
    }
    expect(HOUSE_CANON_FLOOR_REASON).toBe("house canon, written by the Kahu steward (h0); this face reads the floor");
    // CONTROL: the board (crossroads) answers no floor and takes CREATE then INGEST.
    calls.length = 0;
    expect(await seedHolding(applied, holdingOf("crossroads"))).toMatchObject({ gesture: "ingest", exitCode: 0 });
    expect(calls.map((c) => c.command)).toEqual(["act", "ingest"]);
  });
  test("S8b — the floor reading reads the printed answer alone", () => {
    expect(createReadsFloor(["CREATE ✓ applied locally (req 1)", "  readsFloor   true"])).toBe(true);
    expect(createReadsFloor(["CREATE ✓ applied locally (req 1)", "  alreadyStood true"])).toBe(false);
  });
});

describe("the seed answers a shore flood once", () => {
  test("S7 — the summary counts pending removals per fed bag and prints one batch answer each", () => {
    const rows = [
      ...Array.from({ length: 3 }, (_, i) => ({ bagId: "lar:///ha.ka.ba/bags/sdm", uri: `u${i}` })),
      { bagId: "lar:///ha.ka.ba/bags/crossroads", uri: "c" },
      { bagId: "lar:///ha.ka.ba/wikis/daemon-x/working", uri: "d" },
    ];
    expect(pendingRemovalLines(rows, ["lar:///ha.ka.ba/bags/sdm", "lar:///ha.ka.ba/bags/crossroads"])).toEqual([
      "seed: 1 pending removal(s) in lar:///ha.ka.ba/bags/crossroads: the files left disk and nothing tombstoned; answer once with `lares shore remove --all --count 1 --bag lar:///ha.ka.ba/bags/crossroads` (or `restore --all --count 1 --bag lar:///ha.ka.ba/bags/crossroads`)",
      "seed: 3 pending removal(s) in lar:///ha.ka.ba/bags/sdm: the files left disk and nothing tombstoned; answer once with `lares shore remove --all --count 3 --bag lar:///ha.ka.ba/bags/sdm` (or `restore --all --count 3 --bag lar:///ha.ka.ba/bags/sdm`)",
    ]);
  });
});
