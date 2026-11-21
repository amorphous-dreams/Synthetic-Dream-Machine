/**
 * e2e/first-admit-lands-second — a faceless vessel holds two pending joins (h0 and h1, one per face of the hearth it joins), the
 * join for h1 lands FIRST, and the vessel opens every face it holds with `unlock --all`, naming none.
 *
 *   L1 RED  the unlock mounts the face that landed (h1), never the pending h0 whose anchors stand absent, and the vessel stands
 *           sovereign on it: no `anchor-missing`.
 *   L2 RED  `lock --face 1` never slides the mount onto the pending h0, and a second unnamed `unlock --all` wears h1 again and
 *           stands sovereign: a `held: true` answer means the vessel wears a face.
 *   L3 RED  h0's join lands second; a fresh unnamed `unlock --all` wears h0 (it holds anchors now) and the vessel stands on h0's
 *           own planes, never the planes the bootstrap pin a sibling's landing left names.
 *
 * Scratch roots alone (`openStagedJoinee`), the test custody route, A with two faces.
 */
import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { cliFor, openStaged, openStagedJoinee, awaitRendezvous, type CliResult, type LarInstance, type StagedJoinee } from "../harness/instance.js";

const DOOR = join(new URL("../..", import.meta.url).pathname, "tools/unlock-test-custody.mjs");
const ROUTE = join(new URL("../..", import.meta.url).pathname, "tools/test-custody-route.mjs");
let joinee: StagedJoinee;
let B: LarInstance | null = null;
let unlocked: Record<string, unknown> | null = null;
/** The answer for face 0's join, kept aside while face 1's lands first. */
let answer0 = "";
let send: (frame: unknown) => Promise<Record<string, unknown> | null>;
let route: { kind: "passphrase"; passphrase: string }[];

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
      answer0 = join(dir, "fleet-answer-0.json");
      writeFileSync(answer0, readFileSync(files.answer));
      writeFileSync(files.answer, readFileSync(answer1));
    },
  });
  if (joinee.admitted.code !== 0) throw new Error(`B: the land of face 1's answer failed (${joinee.admitted.code})\n${joinee.admitted.stderr.slice(-1500)}`);
  // B stands at its floor; the unlock below names no face and opens every face the route fits.
  B = await openStaged({ tag: "admit-second-first-B", root: joinee.rootB, port: joinee.portB, found: async () => {}, locked: true });
  const { sendCustodyFrame } = await import(DOOR) as { sendCustodyFrame: (root: string, frame: unknown) => Promise<Record<string, unknown> | null> };
  const { TEST_PASSPHRASE } = await import(ROUTE) as { TEST_PASSPHRASE: string };
  route = [{ kind: "passphrase", passphrase: TEST_PASSPHRASE }];
  send = (frame) => sendCustodyFrame(joinee.rootB, frame);
  unlocked = await send({ op: "unlock", credentials: route, all: true });
}, 600_000);
afterAll(async () => { await B?.stopDaemonOnly(); await joinee?.stop(); });

describe("e2e/first-admit-lands-second", () => {
  test("L1 RED: unlock --all mounts the landed h1, never the pending h0, and the vessel stands sovereign on it", async () => {
    expect(unlocked, JSON.stringify(unlocked)).toMatchObject({ op: "unlock", held: true, wears: 1 });
    expect(unlocked?.["refused"], `the composition refused: ${B!.bootLog().slice(-2000)}`).toBeUndefined();
    expect(B!.bootLog()).not.toContain("anchor-missing");
    expect(await awaitRendezvous(B!)).toBe(true);
  }, 120_000);

  test("L2 RED: lock --face 1 never slides onto the pending h0, and a second unlock --all wears h1 again", async () => {
    // The lock composes the vessel again, down to the floor; the caller's line may close with the sovereign composition it
    // leaves (its answer then reads null), so the census below reads what stands once the floor answers.
    const locked = await send({ op: "lock", face: 1 });
    if (locked !== null) expect(locked, JSON.stringify(locked)).toMatchObject({ op: "lock", locked: true });
    expect(B!.bootLog()).toContain("no open face holding anchors takes h1's mount; the vessel stands at the floor");
    // BETWEEN THE LOCK AND THE REOPEN: no composition stands for h1 (its key dropped), and no default mount stands on the pending h0;
    // the vessel reads the floor.
    let between: Record<string, unknown> | null = null;
    for (let look = 0; look < 120 && (between === null || between["standing"] === "recomposing"); look++) {
      between = await send({ op: "census" });
      if (between === null || between["standing"] === "recomposing") await new Promise((r) => setTimeout(r, 500));
    }
    expect(between, B!.bootLog().slice(-2000)).not.toBeNull();
    expect(between?.["worn"], `h1's composition outlived its key: ${JSON.stringify(between)}`).toBeUndefined();
    expect(between?.["facesLit"] ?? [], JSON.stringify(between)).not.toContain(1);
    expect(between?.["standing"], "the vessel composed again, off h1's sovereign standing").not.toBe(unlocked?.["standing"]);
    const again = await send({ op: "unlock", credentials: route, all: true });
    expect(again, JSON.stringify(again)).toMatchObject({ op: "unlock", held: true, wears: 1 });
    expect(again?.["refused"], `the composition refused: ${B!.bootLog().slice(-2000)}`).toBeUndefined();
    expect(B!.bootLog()).not.toContain("anchor-missing");
  }, 240_000);

  test("L3 RED: h0's join lands second, and a fresh unlock --all stands on h0's own planes", async () => {
    await B!.stopDaemonOnly();
    const cliB = cliFor({ LAR_ROOT: joinee.rootB, LAR_PORT: String(joinee.portB) });
    const landed = await cliB(["fleet", "join", "land", answer0]);
    expect(landed.code, `${landed.stdout.slice(-800)}\n${landed.stderr.slice(-1500)}`).toBe(0);
    B = await openStaged({ tag: "admit-second-first-B2", root: joinee.rootB, port: joinee.portB, found: async () => {}, locked: true });
    const fresh = await send({ op: "unlock", credentials: route, all: true });
    expect(fresh, JSON.stringify(fresh)).toMatchObject({ op: "unlock", held: true, wears: 0 });
    expect(fresh?.["refused"], `the composition refused: ${B.bootLog().slice(-2000)}`).toBeUndefined();
    expect(B.bootLog()).not.toContain("anchor-missing");
    expect(await awaitRendezvous(B)).toBe(true);
  }, 360_000);
});
