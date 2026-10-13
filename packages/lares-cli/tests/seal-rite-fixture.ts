/**
 * seal-rite-fixture — the CLI's half of THE ONE HELPER a test seats and rolls a charter through.
 *
 * The platform-blind half lives in mesh (`packages/lararium-mesh/tests/charter-fixture.ts`): a charter built
 * in memory, over the fixture's keys or the caller's. This half drives the RITE: `lares nexus seal seat` and
 * `lares nexus seal rotate`, as a person runs them against a standing vault.
 *
 * A test that only NEEDS a seated or a rolled charter on disk calls `sealRite()` and never spells how the
 * rite arms a head: it names the seats of the next generation by their keys and their threshold, and the
 * helper turns that into whatever the rite takes. The helper runs the verb itself and keeps every chunk the
 * verb writes to stdout, so whatever one rite yields for the next stays inside it. A change to how a rite arms edits
 * this file and no test that leans on it. The rite's own law (what a seat writes, what a roll refuses) keeps
 * its vectors by hand, each named in `charter-funnel.test.ts`.
 *
 * One `sealRite()` per charter: a test that seats twice under two roots takes two.
 */
import { vi } from "vitest";
import { hex, sha256BytesSync, utf8Bytes, sealKeySetHash } from "@lararium/mesh";
import { cmdNexus } from "../src/commands/nexus.js";
import type { ParsedArgs } from "../src/parse-args.js";
import type { HeldSeats } from "../../lararium-mesh/tests/charter-fixture.js";

export * from "../../lararium-mesh/tests/charter-fixture.js";

/**
 * The generation a rite arms its head for:
 *   · seats named by their keys and threshold: the head rolls to exactly them;
 *   · `"nobody"`: successors no vault holds, so the head stands armed and no lawful roll follows;
 *   · `null`: nothing, so the head stands unarmed.
 */
export type RiteSuccessors = HeldSeats | "nobody" | null;

/**
 * What one rite answered: its exit code, every chunk it wrote to stdout in order, and the first JSON payload
 * among them (empty where it printed none), which reads as the verb's own answer under `--json`.
 */
export interface RiteResult {
  readonly code:    number;
  readonly out:     Record<string, unknown>;
  readonly printed: readonly string[];
}

export interface SealRite {
  /** `seal seat`: seat the standing chairs as the genesis, armed for `successors`. */
  seat(successors: RiteSuccessors, options?: Readonly<Record<string, string>>): Promise<RiteResult>;
  /** `seal rotate`: seat what the head committed, and arm the rolled head for `successors`. */
  rotate(successors: RiteSuccessors, options?: Readonly<Record<string, string>>): Promise<RiteResult>;
}

/** The options through which a rite arms a head. A caller never passes one: the helper alone arms. A rite that
 *  takes a new arming option names it here in the commit that adds it. */
const ARMING_OPTIONS = ["next-key-commit", "cold-key"] as const;

/** What a rite takes to arm the head it writes. */
function armedFor(successors: RiteSuccessors): Record<string, string> {
  if (successors === null) return {};
  if (successors === "nobody") return { "next-key-commit": hex(sha256BytesSync(utf8Bytes("seal-rite-fixture|nobody"))) };
  return { "next-key-commit": sealKeySetHash(successors.keys, successors.threshold) };
}

/**
 * The seat and rotate rites. `run` names the door a verb enters by (the `nexus` command itself unless a test
 * hands another). Every option a verb takes beside its arming passes through; an arming option refuses by name.
 */
export function sealRite(run: (args: ParsedArgs) => Promise<number> = cmdNexus): SealRite {
  const rite = async (verb: "seat" | "rotate", successors: RiteSuccessors, options: Readonly<Record<string, string>>): Promise<RiteResult> => {
    const named = ARMING_OPTIONS.find((name) => name in options);
    if (named) throw Object.assign(new Error(`seal-rite-fixture: arming-option-by-hand (${named})`), { code: "arming-option-by-hand" });
    // The capture stands in for stdout by hand and steps back out by hand. A spy of the calling test's own
    // stays seated beneath it and still collects each chunk; a bare stdout stays quiet.
    const printed: string[] = [];
    const beneath = process.stdout.write;
    const collects = vi.isMockFunction(beneath);
    process.stdout.write = ((chunk: unknown, ...rest: unknown[]): boolean => {
      printed.push(String(chunk));
      return collects ? (beneath as (...a: unknown[]) => boolean).call(process.stdout, chunk, ...rest) : true;
    }) as typeof process.stdout.write;
    try {
      const code = await run({ command: "nexus", positional: ["seal", verb], options: { ...options, ...armedFor(successors) }, flags: { json: true } });
      const json = printed.find((line) => line.trim().startsWith("{"));
      return { code, out: json ? JSON.parse(json) as Record<string, unknown> : {}, printed };
    } finally { process.stdout.write = beneath; }
  };
  return {
    seat:   (successors, options = {}) => rite("seat", successors, options),
    rotate: (successors, options = {}) => rite("rotate", successors, options),
  };
}
