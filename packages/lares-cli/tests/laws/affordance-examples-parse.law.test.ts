/**
 * W4 · EVERY EXAMPLE PARSES AT ITS OWN DOOR (lar:///ha.ka.ba/kahua/memory/plan/cap-memes-lantern).
 *
 * Inputs: every cli example and every cure the baked pack renders for a carrier (a foreign cure, one naming another address,
 * rides no door this carrier skins and stays out). Each line runs through the real arg law: `parseArgs`, the door's verb table,
 * and `unknownFlags` with the handler never called. A renamed flag reds every example still spelling the old one. Seed: the
 * oracle cast. Control: a planted example with an unknown flag, and one with an unknown verb, both read red.
 *
 * Law: lar:///ha.ka.ba/lares/docs/pono/cli-test-laws#/the-laws
 */
import { describe, expect, test } from "vitest";
import { COMMANDS, unknownFlags } from "../../src/bin/lares.js";
import { parseArgs } from "../../src/parse-args.js";
import { flattenVerbs } from "../../src/verb-table.js";
import { REBAKE, SEED_ADDRESS, pack, shellWords } from "./affordance-harness.js";

/** Why one runnable line fails its door, or null where it parses clean. */
export function misparse(line: string): string | null {
  const words = shellWords(line);
  if (words[0] !== "lares") return `does not open on \`lares\``;
  const args = parseArgs(words.slice(1));
  const cmd = COMMANDS.find((c) => c.name === args.command);
  if (!cmd) return `no door "${args.command}"`;
  if (cmd.verbs !== null) {
    const verbs = flattenVerbs(cmd.name, cmd.verbs).find((t) => t.door === cmd.name)?.verbs ?? [];
    if (!verbs.includes(args.positional[0] ?? "")) return `the door answers no verb "${args.positional[0] ?? ""}"`;
  }
  const stray = unknownFlags(cmd, args);
  return stray.length > 0 ? `unknown flag(s): ${stray.map((s) => `--${s.name}`).join(", ")}` : null;
}

const lines = (): Array<readonly [string, string]> =>
  Object.entries(pack().carriers).flatMap(([address, c]) => (c.calls["cli"] ?? []).map((l) => [address, l] as const));

describe("W4 · every example and cure parses at its own door", () => {
  test("SEED: the oracle cast renders runnable cli lines", () => {
    expect(pack().carriers[SEED_ADDRESS]?.calls["cli"]?.length ?? 0, `the pack holds no cli calls for the oracle cast; ${REBAKE}`).toBeGreaterThan(0);
  });

  test.each(lines())("%s · `%s`", (_address, line) => {
    expect(misparse(line)).toBeNull();
  });

  test("CONTROL: an unknown flag and an unknown verb each read red", () => {
    expect(misparse("lares oracle cast --recipe default --zz-no-such-name x")).toMatch(/unknown flag/);
    expect(misparse("lares oracle zz-no-such-name --recipe default")).toMatch(/no verb/);
    expect(misparse("lares oracle cast --recipe default --asking 'which road first?'")).toBeNull();
  });
});
