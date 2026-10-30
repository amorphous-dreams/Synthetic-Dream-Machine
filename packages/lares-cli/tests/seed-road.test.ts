/**
 * seed-road — `lares vessel seed` takes the island's named road for every LOAD-route holding.
 *
 * W27's ruling: a write lands on a wiki's working layer, and canon takes it by promotion. The LOAD door into a
 * canon bag (`bags/<slug>`) refuses `load-into-canon` and names that road. The standalone seed, the road the
 * founding runbook's §5 walks (`vessel seed --apply --yes` ending `6/6 holding(s) converged`), used to pass a
 * founding door the public act parser never spells, so on a stood hearth it read 2/6: the two ingest holdings
 * converged and every LOAD-route holding refused. Lares ruled (a), wikis-first, 2026-10-29: the seed takes the
 * island's named road, and no founding-door exception stands.
 *
 * The road per LOAD-route holding, in order, through the one act gesture:
 *   CREATE --bag bags/<slug>                          (registers the catalog-corpus entry; idempotent)
 *   LOAD   --source-uri <dir> --to wikis/<slug>/working (lands on the working layer; the act mounts the wiki)
 *   MOVE   --title <t> --from wikis/<slug>/working --to bags/<slug>   for every family root the LOAD answered
 * The MOVE grain reads per title because that is the grain the verb table spells (`act MOVE --title`); a root's
 * fragment members (`#/…`) ride its MOVE (measured on the walk: the member's own MOVE found it gone), an orphan
 * member moves by name; the seed hears the titles from the LOAD's own answer, never from a second read of the disk.
 *
 * CONTROLS: a system holding (`lares`) still rides the diff-gated `ingest` gesture; a preview (no `--apply`)
 * sends one dry-run LOAD and no CREATE and no MOVE.
 */

import { describe, expect, test, vi, beforeEach } from "vitest";
import type { ParsedArgs } from "../src/parse-args.js";

type Call = { readonly command: string; readonly positional: string[]; readonly options: Record<string, string>; readonly flags: Record<string, unknown> };
const calls: Call[] = [];
// The address titles a LOAD gesture sends: families by prefix (`root/…`, `root#…`) ride their root's MOVE; a title no
// sent title stands above moves by its own name. The island's answer rides BOUNDED past the outcome cap, so the seed
// reads its roots off the sent titles, never off the answer.
const SENT = [
  "lar:///ha.ka.ba/bags/sdm", "lar:///ha.ka.ba/bags/sdm#/$postamble", "lar:///ha.ka.ba/bags/sdm/procedures/tag-pill",
  "lar:///ha.ka.ba/sdm/docs/arcana-model", "lar:///ha.ka.ba/sdm/docs/arcana-model#/head", "lar:///ha.ka.ba/sdm/docs/other",
  "lar:///ha.ka.ba/bags/sdm", "lar:///t/orphan#/head",
];
const ROOTS = ["lar:///ha.ka.ba/bags/sdm", "lar:///ha.ka.ba/sdm/docs/arcana-model", "lar:///ha.ka.ba/sdm/docs/other", "lar:///t/orphan#/head"];
const BOUNDED_ANSWER = { verb: "LOAD", titles: { boundedArrayCount: 350, tallies: {}, sha256: "x", sample: SENT.slice(0, 3), held: [], heldMore: 0 } };

vi.mock("../src/commands/act.js", () => ({
  cmdAct: vi.fn(async (args: ParsedArgs, heard?: unknown) => {
    calls.push({ command: args.command, positional: [...args.positional], options: { ...args.options }, flags: { ...args.flags } });
    // The island's answer for a LOAD rides bounded past the cap; the gesture hands the titles it SENT beside it.
    if (args.positional[0] === "LOAD" && typeof heard === "function" && !args.flags["dry-run"]) {
      heard({ ...BOUNDED_ANSWER, toBag: args.options["to"], count: SENT.length }, [...SENT]);
    }
    return 0;
  }),
}));
vi.mock("../src/commands/ingest.js", () => ({
  cmdIngest: vi.fn(async (args: ParsedArgs) => {
    calls.push({ command: args.command, positional: [...args.positional], options: { ...args.options }, flags: { ...args.flags } });
    return 0;
  }),
}));

import { seedHolding } from "../src/commands/seed.js";

const SLUG = "sdm";
const CANON = `lar:///ha.ka.ba/bags/${SLUG}`;
const WORKING = `lar:///ha.ka.ba/wikis/${SLUG}/working`;
const holding = { holding: SLUG, source: `/scratch/bags/${SLUG}`, toBag: CANON };
const applied: ParsedArgs = { command: "vessel", positional: ["seed"], options: {}, flags: { apply: true, yes: true } };
const preview: ParsedArgs = { command: "vessel", positional: ["seed"], options: {}, flags: {} };

beforeEach(() => { calls.length = 0; });

describe("the seed takes the island's named road for a LOAD-route holding", () => {
  test("★ CREATE the bag, LOAD onto the wiki's working layer, then MOVE every landed title into canon ★", async () => {
    const row = await seedHolding(applied, holding);
    expect(row).toMatchObject({ holding: SLUG, gesture: "load", exitCode: 0 });
    const acts = calls.filter((c) => c.command === "act");
    expect(acts.map((c) => c.positional[0])).toEqual(["CREATE", "LOAD", "MOVE", "MOVE", "MOVE", "MOVE"]);
    expect(acts[0]!.options).toMatchObject({ bag: CANON });
    // The LOAD lands on the working layer, never on canon, and carries no founding door.
    expect(acts[1]!.options).toMatchObject({ "source-uri": holding.source, to: WORKING });
    expect(acts[1]!.flags).toMatchObject({ yes: true });
    expect(acts[1]!.flags["dry-run"]).toBeUndefined();
    // One MOVE per family root among the sent titles (a member rides its root; an orphan member moves by name),
    // each from the working layer into canon, under --yes; the bounded answer lists nothing and decides nothing.
    expect(acts.slice(2).map((c) => c.options)).toEqual(ROOTS.map((title) => ({ title, from: WORKING, to: CANON })));
    for (const move of acts.slice(2)) expect(move.flags).toMatchObject({ yes: true });
  });

  test("a MOVE that refuses names the holding's exit and stops the rest of that holding's moves", async () => {
    const { cmdAct } = await import("../src/commands/act.js");
    (cmdAct as unknown as ReturnType<typeof vi.fn>).mockImplementationOnce(async (args: ParsedArgs) => {
      calls.push({ command: args.command, positional: [...args.positional], options: { ...args.options }, flags: { ...args.flags } });
      return 0; // CREATE
    });
    // CREATE (0), LOAD (answers three titles), first MOVE refuses with 5 → the holding reads exit 5, two moves never sent.
    let moves = 0;
    (cmdAct as unknown as ReturnType<typeof vi.fn>).mockImplementation(async (args: ParsedArgs, heard?: unknown) => {
      calls.push({ command: args.command, positional: [...args.positional], options: { ...args.options }, flags: { ...args.flags } });
      if (args.positional[0] === "LOAD" && typeof heard === "function") heard({ ...BOUNDED_ANSWER }, [...SENT]);
      if (args.positional[0] === "MOVE") { moves++; return 5; }
      return 0;
    });
    const row = await seedHolding(applied, holding);
    expect(row.exitCode).toBe(5);
    expect(moves).toBe(1);
  });

  test("CONTROL: a system holding still rides the diff-gated ingest gesture, no act at all", async () => {
    const sys = { holding: "lares", source: "/scratch/bags/lares", toBag: "lar:///ha.ka.ba/bags/lares" };
    const row = await seedHolding(applied, sys);
    expect(row.gesture).toBe("ingest");
    expect(calls.map((c) => c.command)).toEqual(["ingest"]);
    expect(calls[0]!.options).toMatchObject({ source: sys.source, to: sys.toBag });
  });

  test("CONTROL: a preview sends one dry-run LOAD onto the working layer and no CREATE and no MOVE", async () => {
    const row = await seedHolding(preview, holding);
    expect(row).toMatchObject({ gesture: "load", exitCode: 0 });
    const acts = calls.filter((c) => c.command === "act");
    expect(acts.map((c) => c.positional[0])).toEqual(["LOAD"]);
    expect(acts[0]!.options).toMatchObject({ to: WORKING });
    expect(acts[0]!.flags).toMatchObject({ "dry-run": true });
  });
});
