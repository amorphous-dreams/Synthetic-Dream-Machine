/**
 * seal-rite-fixture — the CLI's half of THE ONE HELPER a test seats and rolls a charter through.
 *
 * The platform-blind half lives in mesh (`packages/lararium-mesh/tests/charter-fixture.ts`): a charter built
 * in memory, over the fixture's keys or the caller's. This half drives the RITE: `lares nexus seal seat` and
 * `lares nexus seal rotate`, as a person runs them against a standing vault.
 *
 * A test that only NEEDS a seated or a rolled charter on disk calls `sealRite()` and never spells how the
 * rite arms a head. The rite arms itself: each chair's seat key mints behind the custody door, and each chair's
 * NEXT key mints as a cold-key card the rite prints and reads back. A harness types nothing, so the helper runs a
 * rite on a STAGED root (it marks the root it runs at, as a harness marks the roots it stages, and the suite's
 * custody founds under the published test route): there the read-back stands in and the rite's answer carries each
 * card's code. The helper keeps the codes the last seat or roll printed and hands them to the next rotate, as a
 * person carries the cards; it refuses an arming option a test passes by hand. The helper runs the verb itself
 * and keeps every chunk the verb writes to stdout, so whatever one
 * rite yields for the next stays inside it. A change to how a rite arms edits this file and no test that leans on
 * it. The rite's own law (what a seat writes, what a roll refuses) keeps its vectors by hand, each named in
 * `charter-funnel.test.ts`.
 *
 * One `sealRite()` per charter: a test that seats twice under two roots takes two.
 */
import { vi } from "vitest";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { cmdNexus } from "../src/commands/nexus.js";
import type { ParsedArgs } from "../src/parse-args.js";

export * from "../../lararium-mesh/tests/charter-fixture.js";

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
  /** `seal seat`: seat the standing chairs as the genesis; the rite arms it. */
  seat(options?: Readonly<Record<string, string>>): Promise<RiteResult>;
  /** `seal rotate`: seat the set the head committed, and arm the rolled head. */
  rotate(options?: Readonly<Record<string, string>>): Promise<RiteResult>;
}

/** The options through which a head could get armed by hand. The rite arms itself, so a caller passing one refuses
 *  by name. A rite that takes a new arming option names it here in the commit that adds it. */
export const ARMING_OPTIONS = ["next-key-commit", "cold-key"] as const;
/** The option through which the helper alone hands a rotate the cards the last rite printed. */
const CARDS_OPTION = ARMING_OPTIONS[1];
/** The marker a harness writes at a root it staged (`tools/test-scratch-marker.mjs`). */
const STAGED_MARKER = ".lar-test-scratch";

/**
 * The seat and rotate rites. `run` names the door a verb enters by (the `nexus` command itself unless a test
 * hands another). Every option a test names passes through untouched; an arming option refuses by name.
 */
export function sealRite(run: (args: ParsedArgs) => Promise<number> = cmdNexus): SealRite {
  /** The cards the last seat or roll printed: the next rotate hands them back. */
  let cards: string[] = [];
  const rite = async (verb: "seat" | "rotate", options: Readonly<Record<string, string>>): Promise<RiteResult> => {
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
      const root = process.env["LAR_ROOT"];
      if (root) writeFileSync(join(root, STAGED_MARKER), "");
      const carried = verb === "rotate" && cards.length > 0 ? { [CARDS_OPTION]: cards.join(",") } : {};
      const code = await run({ command: "nexus", positional: ["seal", verb], options: { ...options, ...carried }, flags: { json: true } });
      const json = printed.find((line) => line.trim().startsWith("{"));
      const out = json ? JSON.parse(json) as Record<string, unknown> : {};
      const printedCards = (out["data"] as { cards?: Array<{ code?: string }> } | undefined)?.cards;
      if (code === 0 && Array.isArray(printedCards)) cards = printedCards.map((c) => c.code ?? "").filter((c) => c.length > 0);
      return { code, out, printed };
    } finally { process.stdout.write = beneath; }
  };
  return {
    seat:   (options = {}) => rite("seat", options),
    rotate: (options = {}) => rite("rotate", options),
  };
}
