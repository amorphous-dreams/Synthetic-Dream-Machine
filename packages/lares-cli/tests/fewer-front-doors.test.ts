/**
 * fewer-front-doors — the UX collapse's second fold (lar:///ha.ka.ba/kahua/memory/road/leap-ux-collapse).
 *
 * The operator's front door holds no row for these spellings; the door that owns each island answers instead (`watch` stands as
 * a call verb, a filter subscription):
 *
 *   receipt · cancel   -> vessel request <id> [cancel=true]
 *   draft              -> lares lar:///carriage.draft.pulls uri=<uri>
 *   raise sign         -> persona raise-sign <challenge-json>
 *   wing-of · test-quine -> out of the front door (tools/wing-of.mjs; `pnpm --filter @lararium/node test:quine`)
 *
 * An old spelling meets the plain unknown-command refusal, which names `lares help`. Each seat holds: `cancel=true` stays an
 * explicit param, `persona raise-sign` signs under the persona door's own `signs` seat.
 */
import { describe, test, expect, vi, afterEach } from "vitest";
import { dispatch, COMMANDS, doorTakes } from "../src/bin/lares.js";

async function run(argv: string[]): Promise<{ code: number; out: string; err: string }> {
  const out: string[] = []; const err: string[] = [];
  const lo = vi.spyOn(console, "log").mockImplementation((...a) => { out.push(a.map(String).join(" ")); });
  const le = vi.spyOn(console, "error").mockImplementation((...a) => { err.push(a.map(String).join(" ")); });
  try { const code = await dispatch(argv); return { code, out: out.join("\n"), err: err.join("\n") }; }
  finally { lo.mockRestore(); le.mockRestore(); }
}
afterEach(() => vi.restoreAllMocks());

/** The spellings outside the front door: each meets the plain unknown-command refusal. */
const FOLDED: readonly string[] = ["receipt", "cancel", "draft", "raise", "wing-of", "test-quine", "act", "promote"];

describe("fewer front doors", () => {
  test("★ a spelling outside the front door meets the plain unknown-command refusal, naming `lares help` ★", async () => {
    const names = COMMANDS.map((c) => c.name);
    for (const old of FOLDED) {
      expect(names, old).not.toContain(old);
      const r = await run([old]);
      expect(r.code, old).toBe(2);
      expect(r.err, old).toContain(`lares: unknown command "${old}".  Run \`lares help\` for the list.`);
    }
  });

  // THE COUNT PINS THE FRONT DOOR, so a new top-level verb lands as a named choice, never a drift. 44 after the fold; 45 with
  // `spirit` (a spirit's record by its pet name: om · ah · hum · hoʻoili · residue · otakiage). Its acts ride the `tiddler`
  // door's daemon verbs beneath, yet it carries a lifecycle that door never reads (the card's lease and epoch, slot budgets,
  // the ash ledger), and `sense`/`sensorium` read captured conversation, not a spirit's card; so it stands its own row. 48 with the
  // call shape (comms-ux-enacts landing 8): `tiddler` burned and the four call verbs `get` · `put` · `delete` · `rename` stand. 47 when
  // landing 9 folds the `act` door into the one call; 48 with `msg` (landing 14): one entry lands in its stream; 49 with `watch`
  // (landing 16): a call verb whose line holds its calls in a loop, one has line per change.
  test("the front door holds 49 top-level verbs: `spirit` named past the fold, the call verbs in `tiddler`'s place", () => {
    const names = COMMANDS.map((c) => c.name);
    expect(names).toContain("spirit");
    expect(names).toEqual(expect.arrayContaining(["get", "put", "delete", "rename", "msg", "watch"]));
    expect(names).not.toContain("tiddler");
    expect(COMMANDS.length).toBe(49);
  });

  test("★ the signing seats stay: vessel and persona sign, and ingest keeps its own seat ★", () => {
    const row = (n: string) => COMMANDS.find((c) => c.name === n)!;
    expect(row("vessel").signs).toBe(true);
    expect(row("persona").signs).toBe(true);
    expect(row("ingest").signs).not.toBe(true);
  });

  test("each new spelling is accepted by the door's row, and `cancel=` rides vessel alone", () => {
    const row = (n: string) => COMMANDS.find((c) => c.name === n)!;
    expect(doorTakes("ingest")).toEqual(expect.arrayContaining(["watch", "debounce"]));
    expect(doorTakes("persona")).toContain("as");
    expect(doorTakes("vessel")).toContain("cancel");
    for (const n of COMMANDS.map((c) => c.name).filter((x) => x !== "vessel")) expect(doorTakes(n), n).not.toContain("cancel");
  });

  test("vessel request names its usage and exits 2 with no id", async () => {
    const r = await run(["vessel", "request", "json=false"]);
    expect(r.code).toBe(2);
    expect(r.err).toContain("usage: lares vessel request <requestId>");
    const c = await run(["vessel", "request", "cancel=true", "json=false"]);
    expect(c.code).toBe(2);
    expect(c.err).toContain("usage: lares vessel request <requestId> cancel=true");
  });

  test("ingest watch=true refuses the one-shot params by name, and debounce= refuses without watch=true", async () => {
    const a = await run(["ingest", "watch=true", "yes=true", "source=x", "to=lar:///ha.ka.ba/bags/x"]);
    expect(a.code).toBe(2);
    expect(a.err).toContain("yes= ride the one-shot ingest alone");
    const b = await run(["ingest", "debounce=100", "source=x", "to=lar:///ha.ka.ba/bags/x"]);
    expect(b.code).toBe(2);
    expect(b.err).toContain("debounce= sets the watcher's quiet window and rides `watch=true` alone");
    const c = await run(["ingest", "watch=true"]);
    expect(c.code).toBe(2);
    expect(c.out).toContain("usage: lares ingest source=<dir-or-file> to=<bag-uri>");   // the carrier's spine: watch= rides it
    expect(c.out).toContain("[watch=<true>] [debounce=<ms>]");
  });

  test("an address rides the call door: a dash flag beside it refuses `dash-flag-burned`, naming the address's help", async () => {
    const r = await run(["lar:///carriage.draft.pulls", "--draft"]);
    expect(r.code).toBe(2);
    expect(r.err).toContain("dash-flag-burned: dash flags burned; params ride as name=value (lares help lar:///carriage.draft.pulls)");
  });

  test("persona raise-sign with no challenge refuses with its own menu", async () => {
    const r = await run(["persona", "raise-sign", "json=false"]);
    expect(r.code).toBe(2);
    expect(r.err).toContain("usage: lares persona raise-sign <challenge-json-text>");
  });

  test("the folded spellings leave every help line, and the folded doors name their new motion", async () => {
    const h = await run(["help"]);
    for (const old of FOLDED) expect(h.out, old).not.toMatch(new RegExp(`^\\s+(✍ )?${old}\\s`, "m"));
    const vessel = await run(["help", "vessel"]);
    expect(vessel.out).toContain("request");
    const ingest = await run(["help", "ingest"]);
    expect(ingest.out).toContain("watch=");
    const draft = await run(["help", "lar:///carriage.draft.pulls"]);
    expect(draft.code).toBe(0);
    expect(draft.out).toContain("lar:///carriage.draft.pulls");
  });
});
