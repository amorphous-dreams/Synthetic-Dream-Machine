/**
 * fewer-front-doors — the UX collapse's second fold (lar:///ha.ka.ba/kahua/memory/road/leap-ux-collapse).
 *
 * Seven top-level verbs left the operator's front door and ride the door that already owns their island:
 *
 *   receipt · cancel   -> vessel request <id> [--cancel]
 *   watch              -> ingest --watch
 *   draft              -> act --draft <uri>
 *   raise sign         -> persona raise-sign <challenge-json>
 *   wing-of · test-quine -> out of the front door (tools/wing-of.mjs; `pnpm --filter @lararium/node test:quine`)
 *
 * Alpha line: the old spellings retire outright, no bridge. Each fold holds its old seat: `--cancel` stays an explicit
 * flag, `persona raise-sign` signs under the persona door's own `signs` seat.
 */
import { describe, test, expect, vi, afterEach } from "vitest";
import { dispatch, COMMANDS, MOVED } from "../src/bin/lares.js";

async function run(argv: string[]): Promise<{ code: number; out: string; err: string }> {
  const out: string[] = []; const err: string[] = [];
  const lo = vi.spyOn(console, "log").mockImplementation((...a) => { out.push(a.map(String).join(" ")); });
  const le = vi.spyOn(console, "error").mockImplementation((...a) => { err.push(a.map(String).join(" ")); });
  try { const code = await dispatch(argv); return { code, out: out.join("\n"), err: err.join("\n") }; }
  finally { lo.mockRestore(); le.mockRestore(); }
}
afterEach(() => vi.restoreAllMocks());

/** Each folded spelling and the door its refusal points at (an old name answers with its new seat, never a bare unknown). */
const FOLDED: ReadonlyArray<readonly [argv: readonly string[], cure: string]> = [
  [["receipt"], "lares vessel request <id>"],
  [["cancel"], "lares vessel request <id> --cancel"],
  [["watch"], "lares ingest --watch"],
  [["draft"], "lares act --draft <uri>"],
  [["raise", "sign"], "lares persona raise-sign <challenge-json-text>"],
  [["wing-of"], "node tools/wing-of.mjs"],
  [["test-quine"], "pnpm --filter @lararium/node test:quine"],
];

describe("fewer front doors", () => {
  test("★ the folded spellings leave the table and refuse by name, pointing at their new seat ★", async () => {
    const names = COMMANDS.map((c) => c.name);
    for (const [argv, cure] of FOLDED) {
      const old = argv[0]!;
      expect(names, old).not.toContain(old);
      const r = await run([...argv]);
      expect(r.code, old).toBe(2);
      expect(r.err, old).not.toContain("unknown command");
      expect(r.err, old).toContain(`\`${cure}\``);
    }
  });

  test("★ every row of the one MOVED table answers at its cure, the door-local folds (`bag stats`, `wiki list`) among them ★", async () => {
    expect(MOVED.map((m) => m.argv.join(" "))).toEqual(expect.arrayContaining(["bag stats", "bag list", "wiki list"]));
    for (const { argv, to } of MOVED) {
      const r = await run([...argv]);
      expect(r.code, argv.join(" ")).toBe(2);
      expect(r.err, argv.join(" ")).toContain(`\`${to}\``);
    }
  });

  // THE COUNT PINS THE FRONT DOOR, so a new top-level verb lands as a named choice, never a drift. 44 after the fold; 45 with
  // `spirit` (a spirit's record by its pet name: om · ah · hum · hoʻoili · residue · otakiage). Its acts ride the `tiddler`
  // door's daemon verbs beneath, yet it carries a lifecycle that door never reads (the card's lease and epoch, slot budgets,
  // the ash ledger), and `sense`/`sensorium` read captured conversation, not a spirit's card; so it stands its own row.
  test("the front door holds 45 top-level verbs, `spirit` the one named past the fold", () => {
    expect(COMMANDS.map((c) => c.name)).toContain("spirit");
    expect(COMMANDS.length).toBe(45);
  });

  test("★ the signing seats stay: vessel and persona sign, and ingest/act keep their own seat ★", () => {
    const row = (n: string) => COMMANDS.find((c) => c.name === n)!;
    expect(row("vessel").signs).toBe(true);
    expect(row("persona").signs).toBe(true);
    expect(row("ingest").signs).not.toBe(true);
    expect(row("act").signs).not.toBe(true);
  });

  test("each new spelling is accepted by the door's row, and `--cancel` rides vessel alone", () => {
    const row = (n: string) => COMMANDS.find((c) => c.name === n)!;
    expect(row("ingest").accepts).toEqual(expect.arrayContaining(["watch", "debounce"]));
    expect(row("act").accepts).toContain("draft");
    expect(row("persona").accepts).toContain("as");
    expect(row("vessel").accepts).toContain("cancel");
    for (const n of COMMANDS.map((c) => c.name).filter((x) => x !== "vessel")) expect(row(n).accepts, n).not.toContain("cancel");
  });

  test("vessel request names its usage and exits 2 with no id", async () => {
    const r = await run(["vessel", "request", "--no-json"]);
    expect(r.code).toBe(2);
    expect(r.err).toContain("usage: lares vessel request <requestId>");
    const c = await run(["vessel", "request", "--cancel", "--no-json"]);
    expect(c.code).toBe(2);
    expect(c.err).toContain("usage: lares vessel request <requestId> --cancel");
  });

  test("ingest --watch refuses the one-shot flags by name, and --debounce refuses without --watch", async () => {
    const a = await run(["ingest", "--watch", "--yes", "--source", "x", "--to", "lar:///ha.ka.ba/bags/x"]);
    expect(a.code).toBe(2);
    expect(a.err).toContain("--yes");
    const b = await run(["ingest", "--debounce", "100", "--source", "x", "--to", "lar:///ha.ka.ba/bags/x"]);
    expect(b.code).toBe(2);
    expect(b.err).toContain("unknown flag --debounce");
    const c = await run(["ingest", "--watch"]);
    expect(c.code).toBe(2);
    expect(c.out).toContain("lares ingest --watch --source");
  });

  test("act --draft with no uri refuses with the new usage", async () => {
    const r = await run(["act", "--draft", "--no-json"]);
    expect(r.code).toBe(2);
    expect(r.err).toContain("usage: lares act --draft <uri>");
  });

  test("persona raise-sign with no challenge refuses with its own menu", async () => {
    const r = await run(["persona", "raise-sign", "--no-json"]);
    expect(r.code).toBe(2);
    expect(r.err).toContain("usage: lares persona raise-sign <challenge-json-text>");
  });

  test("the folded spellings leave every help line, and the folded doors name their new motion", async () => {
    const h = await run(["help"]);
    for (const [[old]] of FOLDED) expect(h.out, old).not.toMatch(new RegExp(`^\\s+(✍ )?${old}\\s`, "m"));
    const vessel = await run(["vessel", "--help"]);
    expect(vessel.out).toContain("request");
    const ingest = await run(["ingest", "--help"]);
    expect(ingest.out).toContain("--watch");
    const act = await run(["act", "--help"]);
    expect(act.out).toContain("--draft");
  });
});
