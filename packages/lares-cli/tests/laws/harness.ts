/**
 * The law harness — what every law module shares. A law draws its inputs from the LIVE tables (the
 * command table, the baked pack's doors, the declared verb tables), so a new door joins every law the day
 * it lands; the literal cases a fixed bug once left stay as the law's SEEDS; and every law stands a
 * known-positive CONTROL beside its zero, so a law that cannot fail reads red.
 *
 * Law: lar:///ha.ka.ba/lares/docs/pono/cli-test-laws
 */
import { vi } from "vitest";
import { COMMANDS, dispatch, type Command } from "../../src/bin/lares.js";
import { affordancePack } from "@lararium/tw5/affordance-pack";
import { flattenVerbs } from "../../src/verb-table.js";

export interface DoorRun {
  readonly code: number;
  readonly out: string;
  readonly err: string;
}

/** One dispatch at the door, its stdout and stderr captured and the console left as it stood. */
export async function door(argv: readonly string[]): Promise<DoorRun> {
  const out: string[] = [];
  const err: string[] = [];
  const log = vi.spyOn(console, "log").mockImplementation((...a: unknown[]) => { out.push(a.map(String).join(" ")); });
  const error = vi.spyOn(console, "error").mockImplementation((...a: unknown[]) => { err.push(a.map(String).join(" ")); });
  const write = vi.spyOn(process.stdout, "write").mockImplementation((c: string | Uint8Array) => { out.push(String(c)); return true; });
  try {
    const code = await dispatch(argv);
    return { code, out: out.join("\n"), err: err.join("\n") };
  } finally {
    log.mockRestore(); error.mockRestore(); write.mockRestore();
  }
}

/** Every live command, and the ones whose flags reach the dispatcher's own reading. */
export const commands = (): readonly Command[] => COMMANDS;
export const flagReadingCommands = (): readonly Command[] => COMMANDS.filter((c) => c.passesThrough === undefined);

/**
 * Every door whose verbs stand in a declared table, read off the command rows' own `verbs`: the door (or a sub-door path,
 * `meme offer`), and the verbs it answers. A door with no table takes arguments, never sub-verbs.
 */
export const verbTables = (): ReadonlyArray<{ door: string; verbs: readonly string[] }> =>
  COMMANDS.flatMap((c) => (c.verbs === null ? [] : flattenVerbs(c.name, c.verbs)));

/** Every door the baked pack gathers an entry for: the keys `helpLines` answers a door's help from, one home each. */
export const helpKeys = (): readonly string[] => Object.keys(affordancePack().doors).sort();

/** A spelling no table declares: the law's generated unknown. */
export const UNKNOWN = "zz-no-such-name";
