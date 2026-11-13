/**
 * console-door — THE `lares` DOOR ON THE PAGE (lar:///ha.ka.ba/lares/docs/pono/browser-vessel-lift#/the-console-door).
 *
 * A person at the browser's console calls `lares("vessel", "read")`: the CLI's own argv, one string per word. The door answers
 * a Promise of the CLI's `--json` shape (`{ok, data}` or `{ok: false, error: {code, message}}`) and never rejects. It holds no
 * list of its own: the rows come from the page's table and from the vessel worker's own `help` over the page's port.
 *
 *   D1 RED   a verb the vessel holds resolves `{ok: true, data}` with the vessel's answer; a refusal the vessel names
 *            resolves `{ok: false, error: {code, message}}` under the refusal's own name. CONTROL: the door never rejects.
 *   D2 RED   `help` lists the rows the live tables hold and nothing else, each with its holder; every listed verb
 *            dispatches. A row the vessel holds and cannot run now reads under `waits` with its reason, so a fresh floor
 *            and a joined face read differently with no second list.
 *   D3 RED   a verb this vessel cannot hold refuses BY NAME with its reason: the host shim's verbs (`up`, `down`, `build`,
 *            `found`, `logs`), a verb that needs an inbound socket, a verb that takes a hand. CONTROL: an unknown word
 *            refuses `verb-not-held` and points at `help`.
 *   D4 RED   NO SECRET RIDES THE CONSOLE: a word past a held verb's path refuses `usage`, never crosses the port, and never
 *            reads back in the refusal's own message.
 *   D5 RED   ONE CALL FORM: argv strings. A single spaced string and a non-string refuse `usage` and name the form.
 *            CONTROL: `--json` names what the door always answers and changes nothing.
 *   D6       the door seats on its target as `lares`, and a later write does not replace it.
 *   D7       a tab no vessel worker greets still answers: its `help` lists the page's own rows and says why the vessel's
 *            are absent.
 *   D8 RED   `vessel read` answers what the page knows beside the vessel's reading, and still answers it where no vessel
 *            worker greets the tab or the vessel refuses: the ask a page shows reads there either way.
 */
import { expect, test } from "vitest";
import { ConsoleRefused, standConsoleVerbs, type ConsoleHelp } from "../src/console-verbs.js";
import { installConsoleDoor, readVesselBesidePage, standConsoleDoor } from "../src/console-door.js";

/** A vessel worker's side of the door, as the host stands it: its own table behind the port's `verb` call. */
function vesselOf(joined: boolean) {
  const crossed: string[][] = [];
  const table = standConsoleVerbs(() => [
    { path: ["vessel", "read"], summary: "read this vessel's standing", run: async () => ({ standing: joined ? "lit" : "floor" }) },
    { path: ["vault", "status"], summary: "read custody at rest", run: async () => ({ reading: joined ? "sealed" : "clear" }) },
    { path: ["vault", "lock"], summary: "drop the keys this tab's session holds",
      waits: () => joined ? null : ["nothing-to-lock", "no slot binds this browser's custody"] as const,
      run: async () => ({ locked: true }) },
  ]);
  return { crossed, verb: async (argv: readonly string[]): Promise<unknown> => { crossed.push([...argv]); return table.run(argv); } };
}

const doorOver = (vessel: ReturnType<typeof vesselOf> | null, pageRows: Parameters<typeof standConsoleVerbs>[0] = () => []) =>
  standConsoleDoor({ page: standConsoleVerbs(pageRows), vessel: () => vessel ? vessel.verb : null, vesselAbsent: () => "the vessel worker did not stand" });

test("D1 RED a held verb resolves {ok,data}; a named refusal resolves {ok:false,error:{code,message}}; CONTROL: the door never rejects", async () => {
  const lares = doorOver(vesselOf(false));
  expect(await lares("vessel", "read")).toEqual({ ok: true, data: { standing: "floor" } });
  const refused = await lares("vault", "lock");
  expect(refused).toEqual({ ok: false, error: { code: "nothing-to-lock", message: "nothing-to-lock: no slot binds this browser's custody" } });
  // CONTROL: a vessel whose port throws a nameless fault still resolves, under `error`.
  const broken = standConsoleDoor({ page: standConsoleVerbs(() => []), vessel: () => async () => { throw new Error("the port fell"); }, vesselAbsent: () => "" });
  await expect(broken("vessel", "read")).resolves.toMatchObject({ ok: false, error: { code: "verb-not-held" } });
  await expect(broken("help")).resolves.toMatchObject({ ok: true });
});

test("D2 RED help lists the live tables' rows alone, and a fresh floor and a joined face read differently with no second list", async () => {
  const pageRows = () => [{ path: ["vessel", "reset"], summary: "return this browser to its anon floor", run: async () => ({ asked: "reset" }) }];
  const floor = doorOver(vesselOf(false), pageRows), joined = doorOver(vesselOf(true), pageRows);
  type Held = { readonly entries: readonly { verb: string; holder: string }[]; readonly waits: ConsoleHelp["waits"] };
  const at = async (door: typeof floor): Promise<Held> => {
    const answer = await door("help");
    expect(answer.ok).toBe(true);
    return (answer as unknown as { data: Held }).data;
  };
  const fresh = await at(floor), face = await at(joined);
  expect(fresh.entries.map((e) => `${e.holder}:${e.verb}`)).toEqual(["page:help", "vessel:vault status", "vessel:vessel read", "page:vessel reset"]);
  expect(fresh.waits.map((w) => `${w.verb} (${w.code})`)).toEqual(["vault lock (nothing-to-lock)"]);
  expect(face.entries.map((e) => e.verb)).toEqual(["help", "vault lock", "vault status", "vessel read", "vessel reset"]);
  expect(face.waits).toEqual([]);
  // Every verb help lists dispatches: none answers `verb-not-held`.
  for (const entry of face.entries) {
    const answer = await joined(...entry.verb.split(" "));
    expect(answer.ok, `${entry.verb} dispatches`).toBe(true);
  }
  // A bare call reads as help.
  expect(await joined()).toEqual(await joined("help"));
});

test("D3 RED a verb this vessel cannot hold refuses by name with its reason; CONTROL: an unknown word refuses verb-not-held", async () => {
  const vessel = vesselOf(true);
  const lares = doorOver(vessel);
  for (const verb of ["up", "down", "build", "found", "logs"]) {
    const answer = await lares(verb);
    expect(answer, verb).toMatchObject({ ok: false, error: { code: "host-shim-verb" } });
    expect((answer as { error: { message: string } }).error.message, verb).toContain(`\`${verb}\``);
  }
  expect(await lares("vessel", "stand")).toMatchObject({ ok: false, error: { code: "needs-inbound-socket" } });
  expect(await lares("herm")).toMatchObject({ ok: false, error: { code: "needs-inbound-socket" } });
  expect(await lares("vault", "unlock")).toMatchObject({ ok: false, error: { code: "hand-needed" } });
  expect(await lares("export")).toMatchObject({ ok: false, error: { code: "syncs-by-join" } });
  // CONTROL: a word no table and no reason names refuses under the one generic name, and points at help.
  const unknown = await lares("frobnicate");
  expect(unknown).toMatchObject({ ok: false, error: { code: "verb-not-held" } });
  expect((unknown as { error: { message: string } }).error.message).toContain("lares(\"help\")");
  // None of them crossed the port as a verb: the vessel heard its own `help` alone.
  expect(vessel.crossed.every((argv) => argv.join(" ") === "help")).toBe(true);
});

test("D4 RED no secret rides the console: a word past a held verb's path refuses usage, never crosses the port, never reads back", async () => {
  const vessel = vesselOf(true);
  const lares = doorOver(vessel);
  const SECRET = "correct horse battery staple";
  for (const argv of [["vault", "status", SECRET], ["vault", "unlock", SECRET], ["vault", "lock", "--passphrase", SECRET], [SECRET]]) {
    const answer = await lares(...argv);
    expect(answer.ok, argv.join(" ")).toBe(false);
    expect(JSON.stringify(answer), "the refusal reads back no word past the verb").not.toContain("horse");
  }
  expect(await lares("vault", "status", "extra")).toMatchObject({ ok: false, error: { code: "usage" } });
  expect(JSON.stringify(vessel.crossed), "no word past a path crossed the port").not.toContain("horse");
  expect(vessel.crossed.some((argv) => argv.length > 2)).toBe(false);
});

test("D5 RED one call form: argv strings; a spaced string and a non-string refuse usage; CONTROL: --json changes nothing", async () => {
  const lares = doorOver(vesselOf(true));
  const spaced = await lares("vessel read");
  expect(spaced).toMatchObject({ ok: false, error: { code: "usage" } });
  expect((spaced as { error: { message: string } }).error.message).toContain("lares(\"vessel\", \"read\")");
  expect(await lares(["vessel", "read"] as never)).toMatchObject({ ok: false, error: { code: "usage" } });
  expect(await lares("vessel", 7 as never)).toMatchObject({ ok: false, error: { code: "usage" } });
  // CONTROL
  expect(await lares("vessel", "read", "--json")).toEqual(await lares("vessel", "read"));
});

test("D6 the door seats on its target as `lares`, and a later write does not replace it", () => {
  const target: { lares?: unknown } = {};
  const door = doorOver(null);
  installConsoleDoor(target, door);
  expect(target.lares).toBe(door);
  try { target.lares = () => "another hand"; } catch { /* a strict-mode write to a read-only seat throws; either way the seat holds */ }
  expect(target.lares).toBe(door);
});

test("D7 a tab no vessel worker greets still answers: help lists the page's own rows and says why the vessel's are absent", async () => {
  const lares = doorOver(null, () => [{ path: ["vessel", "reset"], summary: "return this browser to its anon floor", run: async () => ({ asked: "reset" }) }]);
  const help = await lares("help");
  expect(help).toMatchObject({ ok: true, data: { vessel: "the vessel worker did not stand" } });
  expect((help as { data: { entries: readonly { verb: string }[] } }).data.entries.map((e) => e.verb)).toEqual(["help", "vessel reset"]);
  expect(await lares("vessel", "reset")).toEqual({ ok: true, data: { asked: "reset" } });
  // A page row that refuses by name reads under its own code.
  const refusing = doorOver(null, () => [{ path: ["vessel", "reset"], summary: "", run: async () => { throw new ConsoleRefused("reset-already-asked", "one reset ask stands"); } }]);
  expect(await refusing("vessel", "reset")).toEqual({ ok: false, error: { code: "reset-already-asked", message: "reset-already-asked: one reset ask stands" } });
});

test("D8 RED vessel read answers the page's own reading beside the vessel's, and still answers it where the vessel reads absent", async () => {
  const page = () => ({ tab: "owner", asks: [{ askId: "a-1", kind: "bind-first", ceremony: "button-waits", refusal: null }] });
  const vessel = vesselOf(true);
  const row = (v: ReturnType<typeof vesselOf> | null, why = "this tab's vessel worker has sent no greeting yet") =>
    doorOver(v, () => [{ path: ["vessel", "read"], summary: "read this vessel", run: () => readVesselBesidePage(page, { vessel: () => v ? v.verb : null, vesselAbsent: () => why }) }]);
  expect(await row(vessel)("vessel", "read")).toEqual({ ok: true, data: { page: page(), vessel: { standing: "lit" } } });
  // No vessel worker greets the tab: the page's half still answers, and the pending ask reads there.
  const alone = await row(null)("vessel", "read");
  expect(alone).toEqual({ ok: true, data: { page: page(), vessel: { absent: "this tab's vessel worker has sent no greeting yet" } } });
  // The vessel refuses its reading by name: the page's half still answers beside the name.
  const refusing = { crossed: [], verb: async (argv: readonly string[]) => { if (argv[0] === "help") return { entries: [], waits: [] }; throw new ConsoleRefused("vessel-unstood", "another worker owns the store"); } };
  expect(await row(refusing as never)("vessel", "read")).toEqual({ ok: true, data: { page: page(), vessel: { absent: "vessel-unstood: another worker owns the store" } } });
  // help lists the composed row once, held by the page.
  const help = await row(vessel)("help") as { data: { entries: readonly { verb: string; holder: string }[] } };
  expect(help.data.entries.filter((e) => e.verb === "vessel read")).toEqual([{ verb: "vessel read", summary: "read this vessel", holder: "page" }]);
});
