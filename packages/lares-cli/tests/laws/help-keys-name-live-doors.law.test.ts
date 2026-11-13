/**
 * L2 · A DECLARATION AGREES WITH WHAT THE DOOR ANSWERS: every help registry key names a live door.
 *
 * Law: lar:///ha.ka.ba/lares/docs/pono/cli-test-laws#/the-laws
 */
/**
 * THE HELP REGISTRY NAMES ONLY COMMANDS THAT EXIST.
 *
 * The registry is SPARSE by design — a command without an entry renders its dispatch summary — so a
 * missing entry is legal and silent. The reverse is not: an entry for a command nobody can run reaches
 * no reader, contradicts nothing, and fails no build. It simply rots, and the surface it describes is
 * the one an operator would have trusted.
 *
 * The vessel collapse left exactly two behind (`status`, `wake`), which is how this test came to exist.
 */
import { describe, test, expect, vi } from "vitest";
import { COMMAND_HELP } from "../../src/command-help.js";
import { COMMAND_NAMES, dispatch } from "../../src/bin/lares.js";
import { SHIM_VERBS } from "../../src/host-bridge.js";

/** One dispatch's exit and what it printed to each stream. */
async function said(argv: string[]): Promise<{ code: number; out: string; err: string }> {
  const out: string[] = [], err: string[] = [];
  const log = vi.spyOn(console, "log").mockImplementation((...a) => { out.push(a.join(" ")); });
  const error = vi.spyOn(console, "error").mockImplementation((...a) => { err.push(a.join(" ")); });
  try { return { code: await dispatch(argv), out: out.join("\n"), err: err.join("\n") }; }
  finally { log.mockRestore(); error.mockRestore(); }
}

describe("the per-command help registry", () => {
  test("★ every entry names a command that answers ★", () => {
    // A key MAY name a SUB-DOOR (`vessel wire`) — the dispatcher prefers the longer key when the
    // positional matches. Either way the FIRST token must name a command an operator can reach.
    const live = new Set(COMMAND_NAMES);
    const orphans = Object.keys(COMMAND_HELP).filter((k) => !live.has(k.split(" ")[0]!));
    expect(orphans).toEqual([]);
  });

  test("the registry stays SPARSE — a missing entry is legal, and this test never demands one", () => {
    // Stated so nobody later "fixes" the asymmetry by requiring an entry per command: the dispatch
    // summary is the fallback, and forcing a second description per verb is how two of them drift apart.
    expect(Object.keys(COMMAND_HELP).length).toBeLessThan(COMMAND_NAMES.length);
  });

  test("meme help publishes the required store target", () => {
    const { usage, synopsis, examples } = COMMAND_HELP.meme!;
    expect({ usage, synopsis, examples: examples?.slice(0, 4) }).toMatchSnapshot("meme help");
  });

  test("every verb the host shim answers holds a help row: `lares <shim verb> --help` reads it, never `unknown command`", async () => {
    expect([...SHIM_VERBS].sort()).toEqual(["build", "down", "found", "logs", "reset", "up"]);
    for (const verb of SHIM_VERBS) {
      const r = await said([verb, "--help"]);
      expect({ verb, code: r.code, err: r.err }).toEqual({ verb, code: 0, err: "" });
      expect(r.out).toContain(`lares ${verb}`);
      expect(r.out).toContain("tools/lares-container.sh");
    }
    // CONTROL: a name neither table holds still refuses as unknown.
    const r = await said(["upp", "--help"]);
    expect(r.code).toBe(2);
    expect(r.err).toMatch(/unknown command "upp"/);
  });

  test("a door that keeps its own sub-verb table answers --help with that table: `wiki --help` reads as `wiki help` reads", async () => {
    const flag = await said(["wiki", "--help"]), word = await said(["wiki", "help"]);
    expect(flag.out).not.toMatch(/no detailed help yet/);
    expect(flag.out).toBe(word.out);
    for (const verb of ["init", "share", "switch", "active", "list"]) expect(flag.out).toMatch(new RegExp(`^  ${verb}\\s`, "m"));
    expect(flag.code).toBe(0);
  });

  test("herm --help carries its own row: the stand, the relay gate's rotation, and the ports", async () => {
    const r = await said(["herm", "--help"]);
    expect(r.out).not.toMatch(/no detailed help yet/);
    expect(r.out).toMatch(/relay-rotate/);
    expect(r.out).toMatch(/--relay-port/);
  });
});
