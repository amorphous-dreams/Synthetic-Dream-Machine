/**
 * surface-help — `lares surface` stands in the command table with its own help entries, one per sub-door, and the
 * top-level list names it on one line, its depth unfolding per door (progressive display; help-flags.test.ts reads every row).
 */
import { describe, expect, test, vi, afterEach } from "vitest";
import { COMMANDS, dispatch, doorTakes } from "../src/bin/lares.js";
import { helpLines } from "../src/command-help.js";
import { affordancePack, packRoute } from "@lararium/tw5/affordance-pack";

async function run(argv: string[]): Promise<{ code: number; out: string }> {
  const out: string[] = [];
  vi.spyOn(console, "log").mockImplementation((...a) => { out.push(a.map(String).join(" ")); });
  vi.spyOn(console, "error").mockImplementation((...a) => { out.push(a.map(String).join(" ")); });
  return { code: await dispatch(argv), out: out.join("\n") };
}
afterEach(() => vi.restoreAllMocks());

describe("lares surface help", () => {
  test("the command table holds `surface`, reading --face, --launch, --message and --realm", () => {
    const row = COMMANDS.find((c) => c.name === "surface");
    expect(row).toBeDefined();
    for (const f of ["face", "launch", "message", "realm"]) expect(doorTakes(row!.name)).toContain(f);
  });

  // The surface door flipped to its carriers (comms landings 10 + 23): each verb's carrier holds its words, no registry beside it.
  test.each(["surface init", "surface check", "surface commit"])("%s takes realm= on its carrier, and its help names it", (spelling) => {
    const address = packRoute("cli", spelling);
    expect(address, spelling).toBeDefined();
    expect(affordancePack().carriers[address!]!.takes["cli"], spelling).toContain("realm");
    expect(helpLines(spelling).join("\n"), spelling).toMatch(/realm=/);
  });

  test.each(["surface init", "surface check", "surface open", "surface commit", "surface face"])("%s holds a carrier whose examples run at the surface door", (spelling) => {
    const address = packRoute("cli", spelling);
    expect(address, spelling).toBeDefined();
    const calls = affordancePack().carriers[address!]!.calls["cli"] ?? [];
    expect(calls.length, spelling).toBeGreaterThan(0);
    expect(calls.every((e) => e.startsWith("lares surface"))).toBe(true);
  });

  test("`lares surface commit --help` reads the verb's own carrier", async () => {
    const r = await run(["surface", "commit", "--help"]);
    expect(r.code).toBe(0);
    expect(r.out).toContain("lar:///surface.keeps.the-sitting/");
  });

  test("★ the top-level list names `surface` on one line; its depth unfolds at `lares surface --help` ★", async () => {
    const r = await run(["help"]);
    expect(r.out.split("\n").filter((l) => /^\s+(✍ )?surface\s/.test(l))).toHaveLength(1);
  });
});
