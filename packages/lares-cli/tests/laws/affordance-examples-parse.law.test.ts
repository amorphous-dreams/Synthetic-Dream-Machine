/**
 * W4 · EVERY EXAMPLE PARSES AT ITS OWN DOOR (lar:///ha.ka.ba/kahua/memory/plan/cap-memes-lantern).
 *
 * Inputs: every cli example and every cure the baked pack renders for a carrier (a foreign cure, one naming another address,
 * rides no door this carrier skins and stays out). Each line runs through the real arg law: `parseArgs`, the door's verb table,
 * and `unknownFlags` with the handler never called. A renamed flag reds every example still spelling the old one. Seed: the
 * oracle cast. Control: a planted example with an unknown flag, and one with an unknown verb, both read red. The one act (`lares act
 * lar:///<address> name=value…`) rides the call door: its line names an address and takes params alone, never a flag.
 *
 * Law: lar:///ha.ka.ba/lares/docs/pono/cli-test-laws#/the-laws
 */
import { describe, expect, test } from "vitest";
import { COMMANDS, unknownFlags } from "../../src/bin/lares.js";
import { parseArgs } from "../../src/parse-args.js";
import { flattenVerbs } from "../../src/verb-table.js";
import { isCallHead } from "../../src/commands/call.js";
import { GLOBAL_FLAGS } from "../../src/bin/lares.js";
import { REBAKE, SEED_ADDRESS, SEED_ADDRESSES, pack, shellWords } from "./affordance-harness.js";

/** Why one runnable line fails its door, or null where it parses clean. */
export function misparse(line: string): string | null {
  const words = shellWords(line);
  if (words[0] !== "lares") return `does not open on \`lares\``;
  const args = parseArgs(words.slice(1));
  const cmd = COMMANDS.find((c) => c.name === args.command);
  // THE ONE ACT RIDES THE CALL DOOR (landing 9): `lares act lar:///<address> name=value…` names an address and takes params alone.
  if (!cmd && isCallHead(args.command, args.positional)) {
    if (!(args.positional[0] ?? "").startsWith("lar:///")) return `the call names no address`;
    const flags = [...Object.keys(args.options), ...Object.keys(args.flags)].filter((n) => !GLOBAL_FLAGS.includes(n));
    if (flags.length > 0) return `unknown flag(s): ${flags.map((n) => `--${n}`).join(", ")}`;
    const stray = args.positional.slice(1).filter((w) => !/^[a-z][a-z0-9-]*=/.test(w));
    return stray.length > 0 ? `a word past the address names no param: ${stray.join(" ")}` : null;
  }
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

  test("SEED: every address wave 1a flipped renders runnable cli lines", () => {
    for (const address of SEED_ADDRESSES) expect(pack().carriers[address]?.calls["cli"]?.length ?? 0, `${address} renders no cli call; ${REBAKE}`).toBeGreaterThan(0);
  });

  test("a positional rides bare in its seat: the calendar's named day and the law's pin read as the door reads them", () => {
    const calls = pack().carriers["lar:///oracle.calendar.dates"]?.calls["cli"] ?? [];
    expect(calls).toContain("lares ddate 5 1 2024");
    expect(pack().carriers["lar:///engine.law.pins"]?.calls["cli"] ?? []).toContain("lares law pin lar:///ha.ka.ba/lares/api/pono/lar-uri");
  });

  test.each(lines())("%s · `%s`", (_address, line) => {
    expect(misparse(line)).toBeNull();
  });

  test("a keep spelling and the draft pull parse where their doors read them; CONTROL: a flag or a bare word beside the act reads red", () => {
    expect(misparse("lares shore keep-records 'lar:///ha.ka.ba/lares/docs/pono/example' --key k")).toBeNull();
    expect(misparse("lares act lar:///carriage.draft.pulls uri=lar:///ha.ka.ba/lares/docs/pono/example")).toBeNull();
    expect(misparse("lares act lar:///carriage.draft.pulls uri=lar:///ha.ka.ba/lares/docs/pono/example --draft")).toMatch(/unknown flag\(s\): --draft/);
    expect(misparse("lares act lar:///carriage.draft.pulls lar:///ha.ka.ba/lares/docs/pono/example")).toMatch(/names no param/);
    expect(misparse("lares act ADD title=x")).toMatch(/names no address/);
  });

  test("CONTROL: an unknown flag and an unknown verb each read red", () => {
    expect(misparse("lares oracle cast --recipe default --zz-no-such-name x")).toMatch(/unknown flag/);
    expect(misparse("lares oracle zz-no-such-name --recipe default")).toMatch(/no verb/);
    expect(misparse("lares oracle cast --recipe default --asking 'which road first?'")).toBeNull();
  });
});
