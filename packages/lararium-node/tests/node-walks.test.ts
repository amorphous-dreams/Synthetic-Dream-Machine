/**
 * node-walks.test.ts — N: a node vessel MAY walk, and walking grants it no carry duty.
 *
 * THE WALKER ARMS SHIP SHUT (the shut-routes house ruling, stable-founding-road #/rulings): the hearth's gate sorts a hosting grant or an invite claim
 * as no walker at all, and names the shut route locally (asserted in socket-sorter.test). So the old vectors that
 * sorted a node's walk exactly as a browser-shaped leaf's, and followed its key along a hand-over line at the
 * sorter, retire with the walker class they pinned. What stays true is the node's side of a walk, proven here on a
 * temp LAR_ROOT with a real node vessel identity and a real persona root:
 *   · walking grants no carry duty: the node's carried set and its own charter stand exactly as before, and the
 *     walk lands only under its own `walk/` store.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync, readdirSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { encodeInvite, mintHostToken, takeInvite } from "@lararium/mesh";
import { generateOrLoadVesselIdentity, generateOrLoadPersonaGroupRoot } from "../src/node-vessel-identity.js";
import { larDataDir } from "../src/vessel-paths.js";
import { carriedSet } from "../src/carried-set.js";
import { nodeWalkStore } from "../src/node-walk-store.js";
import { rollHosting, readHostingState, liveEpochs } from "../src/hosting-store.js";

const AID = "nexus-" + "a".repeat(64);
const HEARTH_LEAF = new Uint8Array(32).fill(91);
const GATE = "ee".repeat(32);

let root: string;
let priorLarRoot: string | undefined;
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "lares-node-walks-"));
  priorLarRoot = process.env["LAR_ROOT"];
  process.env["LAR_ROOT"] = root;
});
afterEach(() => {
  if (priorLarRoot === undefined) delete process.env["LAR_ROOT"]; else process.env["LAR_ROOT"] = priorLarRoot;
  rmSync(root, { recursive: true, force: true });
});

/** A hearth's invite at its live epoch: the token a newcomer carries. */
async function invite(): Promise<() => string> {
  await rollHosting({ nexusAid: AID, leafSeed: HEARTH_LEAF });
  const live = liveEpochs((await readHostingState(AID))!, HEARTH_LEAF)!;
  return () => encodeInvite({ nexusAid: AID, gatePubKey: GATE, token: mintHostToken(live.current) });
}

describe("N — a node vessel walks like any leaf", () => {
  it("walking grants no carry duty: the carried set and the node's own charter stand as before", async () => {
    const mint = await invite();
    await generateOrLoadVesselIdentity();
    await generateOrLoadPersonaGroupRoot(0);
    const sealHome = join(root, "state", "nexus");
    const before = await carriedSet(sealHome);
    await takeInvite(nodeWalkStore(), mint());
    expect(await carriedSet(sealHome)).toEqual(before);
    expect(existsSync(join(sealHome, "nexus.json"))).toBe(false);
    expect(readdirSync(join(larDataDir(), "walk"))).toHaveLength(1);
  });
});
