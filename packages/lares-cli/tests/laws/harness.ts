/**
 * The law harness — what every law module shares. A law draws its inputs from the LIVE tables (the
 * command table, the help registry, the declared verb tables), so a new door joins every law the day
 * it lands; the literal cases a fixed bug once left stay as the law's SEEDS; and every law stands a
 * known-positive CONTROL beside its zero, so a law that cannot fail reads red.
 *
 * Law: lar:///ha.ka.ba/lares/docs/pono/cli-test-laws
 */
import { vi } from "vitest";
import { COMMANDS, dispatch, type Command } from "../../src/bin/lares.js";
import { COMMAND_HELP } from "../../src/command-help.js";
import { VESSEL_SUBS } from "../../src/commands/vessel.js";
import { TUNNEL_VERBS } from "../../src/commands/tunnel-door.js";

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

/** Every door whose verbs stand in a declared table: the door, and the verbs it answers. */
export const verbTables = (): ReadonlyArray<{ door: string; verbs: readonly string[] }> => [
  { door: "vessel", verbs: VESSEL_SUBS },
  { door: "repo", verbs: TUNNEL_VERBS },
  { door: "home", verbs: TUNNEL_VERBS },
];

/** Every help registry key: a door, or a `"<door> <sub>"` sub-door. */
export const helpKeys = (): readonly string[] => Object.keys(COMMAND_HELP);

/** A spelling no table declares: the law's generated unknown. */
export const UNKNOWN = "zz-no-such-name";
