/**
 * e2e/first-admit-lands-second — a faceless vessel holds two pending joins (h0 and h1, one per face of the hearth it joins), the
 * join for h1 lands FIRST, and the vessel opens every face it holds with `unlock --all`, naming none.
 *
 *   L1 RED  the unlock mounts the face that landed (h1), never the pending h0 whose anchors stand absent, and the vessel stands
 *           sovereign on it: no `anchor-missing`, and the landed face's anchors name the hearth's second face.
 *
 * Scratch roots alone (`openStagedJoinee`), the test custody route, A with two faces.
 */
import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { openStaged, openStagedJoinee, awaitRendezvous, type CliResult, type LarInstance, type StagedJoinee } from "../harness/instance.js";

const DOOR = join(new URL("../..", import.meta.url).pathname, "tools/unlock-test-custody.mjs");
const ROUTE = join(new URL("../..", import.meta.url).pathname, "tools/test-custody-route.mjs");
let joinee: StagedJoinee;
let B: LarInstance | null = null;
let unlocked: Record<string, unknown> | null = null;

beforeAll(async () => {
  let cliA: ((args: readonly string[]) => Promise<CliResult>) | null = null;
  joinee = await openStagedJoinee({
    tag: "admit-second-first", dial: "pin", bootB: false,
    // A's second face, so B can ask to join both.
    riteA: async (cli) => {
      cliA = cli;
      const second = await cli(["persona", "new", "1", "--name", "second-face", "--json"]);
      if (second.code !== 0) throw new Error(`A: persona new 1 failed (${second.code})\n${second.stderr.slice(-800)}`);
    },
    // B already asked to join face 0 (its h0 stands reserved and pending). It asks for face 1 too (h1), A answers that ask,
    // and the answer for face 1 stands where the harness lands: the join for h1 lands FIRST, and h0 stays pending.
    beforeLand: async (cliB, files) => {
      const dir = dirname(files.offer);
      const offer1 = join(dir, "fleet-offer-1.json"), request1 = join(dir, "fleet-request-1.json"), answer1 = join(dir, "fleet-answer-1.json");
      const syncUrl = /ws:\/\/127\.0\.0\.1:\d+\/ws/.exec(readFileSync(files.answer, "utf8"))?.[0];
      if (!syncUrl) throw new Error("the face 0 answer names no sync url to reuse");
      const offer = await cliA!(["fleet", "join", "offer", "--face", "1", "--out", offer1]);
      if (offer.code !== 0) throw new Error(`A: offer for face 1 failed (${offer.code})\n${offer.stderr.slice(-1500)}`);
      const request = await cliB(["fleet", "join", "request", offer1, "--out", request1]);
      if (request.code !== 0) throw new Error(`B: request for face 1 failed (${request.code})\n${request.stderr.slice(-1500)}`);
      const answer = await cliA!(["fleet", "join", "answer", request1, "--face", "1", "--sync-url", syncUrl, "--out", answer1]);
      if (answer.code !== 0) throw new Error(`A: answer for face 1 failed (${answer.code})\n${answer.stderr.slice(-1500)}`);
      writeFileSync(files.answer, readFileSync(answer1));
    },
  });
  if (joinee.admitted.code !== 0) throw new Error(`B: the land of face 1's answer failed (${joinee.admitted.code})\n${joinee.admitted.stderr.slice(-1500)}`);
  // B stands at its floor; the unlock below names no face and opens every face the route fits.
  B = await openStaged({ tag: "admit-second-first-B", root: joinee.rootB, port: joinee.portB, found: async () => {}, locked: true });
  const { sendCustodyFrame } = await import(DOOR) as { sendCustodyFrame: (root: string, frame: unknown) => Promise<Record<string, unknown> | null> };
  const { TEST_PASSPHRASE } = await import(ROUTE) as { TEST_PASSPHRASE: string };
  unlocked = await sendCustodyFrame(joinee.rootB, { op: "unlock", credentials: [{ kind: "passphrase", passphrase: TEST_PASSPHRASE }], all: true });
}, 600_000);
afterAll(async () => { await B?.stopDaemonOnly(); await joinee?.stop(); });

describe("e2e/first-admit-lands-second", () => {
  test("L1 RED: unlock --all mounts the landed h1, never the pending h0, and the vessel stands sovereign on it", async () => {
    expect(unlocked, JSON.stringify(unlocked)).toMatchObject({ op: "unlock", held: true, wears: 1 });
    expect(unlocked?.["refused"], `the composition refused: ${B!.bootLog().slice(-2000)}`).toBeUndefined();
    expect(B!.bootLog()).not.toContain("anchor-missing");
    expect(await awaitRendezvous(B!)).toBe(true);
  }, 120_000);
});
