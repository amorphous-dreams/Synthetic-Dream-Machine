/**
 * e2e/sealed-roll-before-session — a removal roll that reaches the daemon island of a founder that dials no Nexus reads
 * under the vessel's own chain at its place, and never settles a founding as unfounded (the collided cold read's H1,
 * cold-t2/blind.md: no chain, no reading).
 *
 * THE STAND. A founds its hearth and a Nexus key; B lands A's fleet-join answer. A (the face's root holder) raises a
 * shadow over B's device on the face's fleet board. A's fold sets off its seat settler, which drives the daemon
 * island's `seat-duties` with no session call behind it. The founder dials no Nexus, yet its worn face stands at its
 * own place: the place session seals the face's bags from boot, so the island's holder reads under the vessel's own
 * chain there (a chain stands, so H1's no-chain hazard cannot arise; the holder's unit suite proves `unknown-bag` where
 * none stands).
 *
 *   R1 — A's island answers the roll: each founding A holds rolls to a successor (a mint that reads `mint-failed` stays
 *        owed and rolls when the roll comes again), and the settler marks no raise answered before a roll reads `rolled`
 *
 * The suite runs only in a STAGED target.
 */
import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { readFileSync } from "node:fs";
import { openStagedJoinee, type StagedJoinee } from "../harness/instance.js";
import { mintStagedNexusKey } from "../harness/vessel-key.js";

const staged = process.env["LAR_TARGET"] !== "live";
let pair: StagedJoinee | null = null;
let kapae: { code: number; stdout: string; stderr: string } | null = null;

beforeAll(async () => {
  if (!staged) return;
  pair = await openStagedJoinee({ tag: "roll-before-session", riteA: async (_cli, rootA) => { await mintStagedNexusKey(rootA); } });
  if (!pair.B) throw new Error(`B never stood: ${pair.joinGate ?? ""}`);
  const request = JSON.parse(readFileSync(pair.fleet.request, "utf8")) as { atomKey?: string };
  if (!request.atomKey) throw new Error("the fleet-join request names no atom key");
  kapae = await pair.A.cli(["edge", "kapae", "--device", request.atomKey, "--face", "0", "--json"]);
}, 600_000);

afterAll(async () => { await pair?.stop(); });

describe.runIf(staged)("a removal roll at a founder that dials no Nexus", () => {
  test("R1 — A's island answers the roll under its own chain at its place: every founding the roll reaches rolls, and no raise marks answered before one rolls", async () => {
    expect(kapae?.code, `${kapae?.stdout}\n${kapae?.stderr}`).toBe(0);
    const lines = (): string[] => pair!.A.bootLog().split("\n");
    const reports = (): string[] => lines().filter((l) => l.includes("[daemon] content-key roll:"));
    // A seat roll names no session, so a mint it asks may read `mint-failed` and stay owed (the roll comes again); each
    // founding that failed so rolls before the wait ends, or reads `not-owed` once a successor stands.
    const foundings = (seen: readonly string[], re: RegExp): Set<string> => new Set(seen.filter((l) => re.test(l)).map((l) => /founding (\S+)/.exec(l)?.[1] ?? ""));
    const unsettled = (seen: readonly string[]): string[] => {
      const settled = new Set([...foundings(seen, /: rolled /), ...foundings(seen, /: not-owed /)]);
      return [...foundings(seen, /: mint-failed /)].filter((f) => !settled.has(f));
    };
    // The wait COUNTS looks, never compares a clock: the roll comes again until a founding rolls and none stays failed.
    const done = (seen: readonly string[]): boolean => seen.some((l) => /: rolled /.test(l)) && unsettled(seen).length === 0;
    for (let look = 0; !done(reports()) && look < 240; look++) await new Promise((r) => setTimeout(r, 500));
    const seen = reports();
    process.stderr.write(`roll reports:\n  ${seen.join("\n  ")}\nseat lines:\n  ${lines().filter((l) => l.includes("[edge-seats]")).slice(-8).join("\n  ")}\n`);
    expect(seen.length, pair!.A.bootLog().slice(-3000)).toBeGreaterThan(0);
    expect(seen.filter((l) => /: rolled founding \S+ → version /.test(l)).length, seen.join("\n")).toBeGreaterThan(0);
    expect(unsettled(seen), seen.join("\n")).toEqual([]);
    // No raise reads answered ahead of its successor: every settle that marked one stands after the first `rolled`.
    const all = lines();
    const firstRolled = all.findIndex((l) => l.includes("[daemon] content-key roll: rolled "));
    const marks = all.map((l, i) => [l, i] as const).filter(([l]) => /\[edge-seats\] settled on a fold: .*?\b([1-9]\d*) marked/.test(l));
    expect(marks.filter(([, i]) => i < firstRolled).map(([l]) => l)).toEqual([]);
  }, 180_000);
});
