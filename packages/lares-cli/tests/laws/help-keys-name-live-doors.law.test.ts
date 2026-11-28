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
import { affordancePack, packRoute } from "@lararium/tw5/affordance-pack";
import { COMMAND_NAMES, dispatch } from "../../src/bin/lares.js";
import { SHIM_VERBS } from "../../src/host-bridge.js";
import { COMMANDS } from "../../src/bin/lares.js";
import { KAHUA_OPERATOR_VERBS } from "@lararium/node";

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
    // A sub-door key (`vessel lay`) answers one motion beneath its door, so only the door-level keys count against the doors.
    expect(Object.keys(COMMAND_HELP).filter((k) => !k.includes(" ")).length).toBeLessThan(COMMAND_NAMES.length);
  });

  test("meme help publishes the required store target", () => {
    const { usage, synopsis, examples } = COMMAND_HELP.meme!;
    expect({ usage, synopsis, examples: examples?.slice(0, 4) }).toMatchSnapshot("meme help");
  });

  test("every verb the host shim answers holds a help row: `lares <shim verb> --help` reads it, never `unknown command`", async () => {
    expect([...SHIM_VERBS].sort()).toEqual(["build", "down", "found", "logs", "pulama", "rebuild", "reset", "up"]);
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
    // The same table, then exactly the door's long account: a blank line, `About:`, and the row's own summary. Nothing else rides.
    const wiki = COMMANDS.find((c) => c.name === "wiki")!;
    expect(flag.out).toBe(`${word.out}\n\nAbout:\n  ${wiki.summary}`);
    expect(word.out).not.toMatch(/^About:$/m);   // CONTROL: the bare table (`wiki help`) carries no account
    for (const verb of ["init", "share", "switch", "keep", "unkeep", "status"]) expect(flag.out).toMatch(new RegExp(`^  ${verb}\\s`, "m"));
    expect(flag.code).toBe(0);
  });

  // The herm door flipped to its carriers (comms landings 10 + 23): `herm --help` reads the door's index of the stand and the
  // rotation; the stand's carrier takes the ports.
  test("herm --help reads its carriers: the stand, the relay gate's rotation, and the ports", async () => {
    const r = await said(["herm", "--help"]);
    expect(r.out).not.toMatch(/no detailed help yet/);
    expect(r.out).toMatch(/relay-rotate/);
    expect(affordancePack().carriers[packRoute("cli", "herm")!]!.takes["cli"]).toEqual(expect.arrayContaining(["--port", "--relay-port"]));
  });

  test("the top-level ✍ mark says which of kahua's sub-verbs hold a key: the hand-only rows the store door names, no others", async () => {
    const kahua = COMMANDS.find((c) => c.name === "kahua")!;
    expect([...(kahua.signsOnly ?? [])].sort()).toEqual([...KAHUA_OPERATOR_VERBS].map((row) => row.replace(/^kahua-/, "")).sort());
    const r = await said(["help"]);
    // The packed brief lists kahua's verbs, so each signing verb wears its mark in place, and no other verb does.
    const line = r.out.split("\n").find((l) => /^\s+✍ kahua\s/.test(l));
    expect(line, "the top-level list draws a ✍ kahua line").toBeDefined();
    const verbs = line!.replace(/^\s+✍ kahua\s+/, "").split(" · ");
    expect(verbs.filter((v) => v.startsWith("✍ ")).map((v) => v.slice(2)).sort()).toEqual([...(kahua.signsOnly ?? [])].sort());
    // CONTROL: a command that holds a key whole draws no such line.
    expect(r.out).not.toMatch(/^\s+✍ promote\s.*alone\)$/m);
  });
});
