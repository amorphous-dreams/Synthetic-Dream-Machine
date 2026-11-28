/**
 * L2 · A DECLARATION AGREES WITH WHAT THE DOOR ANSWERS: every door the baked pack gathers names a live door.
 *
 * Law: lar:///ha.ka.ba/lares/docs/pono/cli-test-laws#/the-laws
 */
/**
 * THE PACK'S DOORS NAME ONLY COMMANDS THAT EXIST.
 *
 * A door's help reads its carriers through the baked pack, one home. An entry for a command nobody can run reaches no reader,
 * contradicts nothing, and fails no build: it rots, and the surface it describes holds the words an operator would have trusted.
 */
import { describe, test, expect, vi } from "vitest";
import { affordancePack, packDoor, packRoute } from "@lararium/tw5/affordance-pack";
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

describe("the per-command help, read off the pack", () => {
  test("★ every pack door names a command that answers ★", () => {
    const live = new Set(COMMAND_NAMES);
    const orphans = Object.keys(affordancePack().doors).filter((k) => !live.has(k));
    expect(orphans).toEqual([]);
  });

  test("★ every command answers from the pack: its door gathers an entry ★", () => {
    expect(COMMAND_NAMES.filter((name) => packDoor(name) === undefined)).toEqual([]);
  });

  test("meme help names the store target its project takes", async () => {
    const r = await said(["help", "meme", "project"]);
    expect(r.code).toBe(0);
    expect(r.out).toMatch(/\[recipe=<word>\]/);
    expect(r.out).toMatch(/\[bag=<word>\]/);
  });

  test("every verb the host shim answers holds a help row: `lares help <shim verb>` reads it, never `unknown command`", async () => {
    expect([...SHIM_VERBS].sort()).toEqual(["build", "down", "found", "logs", "pulama", "rebuild", "reset", "up"]);
    for (const verb of SHIM_VERBS) {
      const r = await said(["help", verb]);
      expect({ verb, code: r.code, err: r.err }).toEqual({ verb, code: 0, err: "" });
      expect(r.out).toContain(`lares ${verb}`);
      expect(r.out).toContain("tools/lares-container.sh");
    }
    // CONTROL: a name neither table holds still refuses as unknown.
    const r = await said(["help", "upp"]);
    expect(r.code).toBe(2);
    expect(r.err).toMatch(/unknown command "upp"/);
  });

  test("the wiki door reads its carriers: `lares help wiki` reads as `wiki help` reads, every verb in its index", async () => {
    const flag = await said(["help", "wiki"]), word = await said(["wiki", "help"]);
    expect(flag.out).toBe(word.out);
    expect(flag.out).toBe(packDoor("wiki")!.help.join("\n"));
    for (const verb of ["init", "share", "switch", "keep", "unkeep", "status", "render", "compact"]) expect(flag.out).toMatch(new RegExp(`lares wiki ${verb}\\b`));
    expect(flag.code).toBe(0);
  });

  // The herm door flipped to its carriers (comms landings 10 + 23): `lares help herm` reads the door's index of the stand and the
  // rotation; the stand's carrier takes the ports.
  test("`lares help herm` reads its carriers: the stand, the relay gate's rotation, and the ports", async () => {
    const r = await said(["help", "herm"]);
    expect(r.out).not.toMatch(/no detailed help yet/);
    expect(r.out).toMatch(/relay-rotate/);
    expect(affordancePack().carriers[packRoute("cli", "herm")!]!.takes["cli"]).toEqual(expect.arrayContaining(["port", "relay-port"]));
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
