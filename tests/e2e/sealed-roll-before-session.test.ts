/**
 * e2e/sealed-roll-before-session — a removal roll that reaches the daemon island before any session asked stays owed
 * on a real vessel: the holder takes no reading without the vessel's chain, so the roll reads `unknown-bag` and comes
 * again, never `bag-unfounded` (the collided cold read's H1, cold-t2/blind.md).
 *
 * THE STAND. A founds its hearth and a Nexus key; B lands A's fleet-join answer. A (the face's root holder) raises a
 * shadow over B's device on the face's fleet board. A's fold sets off its seat settler, which drives the daemon
 * island's `seat-duties` with no session behind it: the founder dials no Nexus and has opened no session, so its
 * island holds no chain.
 *
 *   R1 — A's island answers the roll and every content-key roll report reads `unknown-bag` (owed); none reads
 *        `bag-unfounded`, and the settler marks no raise answered
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

describe.runIf(staged)("a removal roll before any session asked", () => {
  test("R1 — A's island answers the roll: every report reads `unknown-bag` (owed), none `bag-unfounded`, and no raise marks answered", async () => {
    expect(kapae?.code, `${kapae?.stdout}\n${kapae?.stderr}`).toBe(0);
    const reports = (): string[] => pair!.A.bootLog().split("\n").filter((l) => l.includes("[daemon] content-key roll:"));
    const deadline = performance.now() + 120_000;
    while (reports().length === 0 && performance.now() < deadline) await new Promise((r) => setTimeout(r, 500));
    const seen = reports();
    process.stderr.write(`roll reports:\n  ${seen.slice(0, 12).join("\n  ")}\nseat lines:\n  ${pair!.A.bootLog().split("\n").filter((l) => l.includes("[edge-seats]")).slice(-8).join("\n  ")}\n`);
    expect(seen.length, pair!.A.bootLog().slice(-3000)).toBeGreaterThan(0);
    expect(seen.filter((l) => /bag-unfounded/.test(l))).toEqual([]);
    expect(seen.every((l) => /unknown-bag/.test(l))).toBe(true);
    expect(pair!.A.bootLog()).not.toMatch(/\[edge-seats\][^\n]*marked:\s*[1-9]/);
  }, 180_000);
});
