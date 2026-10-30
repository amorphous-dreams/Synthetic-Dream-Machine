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
 *   MOVE   --from wikis/<slug>/working --to bags/<slug>            (no title: the whole layer promotes in one act)
 * The seed names no title: the island's answer rides bounded past the outcome cap, and a memetic record takes its
 * name from its head, so no CLI-side list can say what landed (measured on the fresh-root walk, 2026-10-29).
 *
 * CONTROLS: a system holding (`lares`) still rides the diff-gated `ingest` gesture; a preview (no `--apply`)
 * sends one dry-run LOAD and no CREATE and no MOVE.
 */

import { describe, expect, test, vi, beforeEach } from "vitest";
import type { ParsedArgs } from "../src/parse-args.js";

type Call = { readonly command: string; readonly positional: string[]; readonly options: Record<string, string>; readonly flags: Record<string, unknown> };
const calls: Call[] = [];
vi.mock("../src/commands/act.js", () => ({
  cmdAct: vi.fn(async (args: ParsedArgs) => {
    calls.push({ command: args.command, positional: [...args.positional], options: { ...args.options }, flags: { ...args.flags } });
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
  test("★ CREATE the bag, LOAD onto the wiki's working layer, then ONE title-less MOVE promotes the layer into canon ★", async () => {
    const row = await seedHolding(applied, holding);
    expect(row).toMatchObject({ holding: SLUG, gesture: "load", exitCode: 0 });
    const acts = calls.filter((c) => c.command === "act");
    expect(acts.map((c) => c.positional[0])).toEqual(["CREATE", "LOAD", "MOVE"]);
    expect(acts[0]!.options).toMatchObject({ bag: CANON });
    // The LOAD lands on the working layer, never on canon, and carries no founding door.
    expect(acts[1]!.options).toMatchObject({ "source-uri": holding.source, to: WORKING });
    expect(acts[1]!.flags).toMatchObject({ yes: true });
    expect(acts[1]!.flags["dry-run"]).toBeUndefined();
    // The promotion names the two bags and NO title: the island moves every live title the layer holds.
    expect(acts[2]!.options).toEqual({ from: WORKING, to: CANON });
    expect(acts[2]!.flags).toMatchObject({ yes: true });
  });

  test("a MOVE that refuses names the holding's exit", async () => {
    const { cmdAct } = await import("../src/commands/act.js");
    (cmdAct as unknown as ReturnType<typeof vi.fn>).mockImplementation(async (args: ParsedArgs) => {
      calls.push({ command: args.command, positional: [...args.positional], options: { ...args.options }, flags: { ...args.flags } });
      return args.positional[0] === "MOVE" ? 5 : 0;
    });
    const row = await seedHolding(applied, holding);
    expect(row.exitCode).toBe(5);
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
