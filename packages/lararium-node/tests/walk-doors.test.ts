/**
 * walk-doors.test.ts — a node vessel's walking doors on a temp LAR_ROOT: a real vessel identity, a real persona
 * root, a real hearth's hosting state.
 *
 * Proven:
 *   · RED: a vessel that wears no face takes no invite — the take refuses and writes nothing; CONTROL: once it
 *     wears a face, the take keeps the invite, presenting as THAT face's leaf in the invite's Nexus;
 *   · the worn face, never the roster's first: with two faces held and h1 worn, the walk presents h1's leaf;
 *   · RED: a vessel walks at one hearth — a take for a second hearth, or one beside a dial pinned elsewhere,
 *     refuses aloud and writes nothing; CONTROL: a fresh invite for the same hearth is taken;
 *   · the relay the invite named is kept past the invite's settling, so the vessel knows where to dial again;
 *   · `walk invite` hands out the newest token with the hearth's relay; an empty wallet refuses;
 *   · RED: the walk and hosting directories stand owner-only (0700), and an existing wider one is re-moded.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync, mkdirSync, chmodSync, statSync, existsSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  encodeInvite, decodeInvite, mintHostToken, mintHostingAct, tokenVerifiesAt, type HostingEpoch,
} from "@lararium/mesh";
import { generateOrLoadVesselIdentity, generateOrLoadPersonaGroupRoot, wearPersona } from "../src/node-vessel-identity.js";
import { larDataDir } from "../src/vessel-paths.js";
import { nexusLeafFor, wornNexusLeaf } from "../src/nexus-leaf.js";
import { nodeWalkStore, listWalkRecords } from "../src/node-walk-store.js";
import { rollHosting, hostingDir } from "../src/hosting-store.js";
import { runWalkTake, runWalkInvite, runWalkState, WalkRefusal } from "../src/commands/walk.js";

const AID = "epoch0-" + "a".repeat(64);
const GATE = "ee".repeat(32);
const OTHER_GATE = "dd".repeat(32);
const RELAY = "ws://hearth:7700/ws";
const HEARTH = new Uint8Array(32).fill(91);

let root: string;
let priorLarRoot: string | undefined;
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "lares-walk-doors-"));
  priorLarRoot = process.env["LAR_ROOT"];
  process.env["LAR_ROOT"] = root;
});
afterEach(() => {
  if (priorLarRoot === undefined) delete process.env["LAR_ROOT"]; else process.env["LAR_ROOT"] = priorLarRoot;
  rmSync(root, { recursive: true, force: true });
});

let epoch: HostingEpoch;
async function invite(gate = GATE, relay: string | null = RELAY): Promise<string> {
  epoch ??= await mintHostingAct({ leafSeed: HEARTH, nexusAid: AID, prev: null, cap: 3 });
  return encodeInvite({ nexusAid: AID, gatePubKey: gate, token: mintHostToken(epoch), ...(relay ? { relay } : {}) });
}
const walkDirOf = (): string => join(larDataDir(), "walk");

describe("lares walk — take, as the worn face, at one hearth", () => {
  it("RED: a vessel wearing no face takes no invite and writes nothing; CONTROL: worn, the take keeps it as that face", async () => {
    await generateOrLoadVesselIdentity();
    await generateOrLoadPersonaGroupRoot(0);
    await expect(runWalkTake({ carried: await invite() })).rejects.toThrow(/wears no face/);
    expect(existsSync(walkDirOf())).toBe(false);
    await wearPersona(0);
    const taken = await runWalkTake({ carried: await invite() });
    expect(taken).toMatchObject({ gatePubKey: GATE, nexusAid: AID, relay: RELAY, leaf: (await nexusLeafFor(0, AID)).verifyingKey });
    expect(listWalkRecords(larDataDir()).map((w) => w.gatePubKey)).toEqual([GATE]);
  });

  it("the worn face, never the roster's first: two faces held and h1 worn, the walk presents h1's leaf", async () => {
    await generateOrLoadVesselIdentity();
    await generateOrLoadPersonaGroupRoot(0);
    await generateOrLoadPersonaGroupRoot(1);
    await wearPersona(1);
    const h1 = (await nexusLeafFor(1, AID)).verifyingKey;
    expect(h1).not.toBe((await nexusLeafFor(0, AID)).verifyingKey);
    expect((await wornNexusLeaf(AID))?.verifyingKey).toBe(h1);
    expect((await runWalkTake({ carried: await invite() })).leaf).toBe(h1);
  });

  it("RED: a second hearth, or a dial pinned elsewhere, refuses and writes nothing; CONTROL: the same hearth takes a fresh invite", async () => {
    await generateOrLoadVesselIdentity();
    await generateOrLoadPersonaGroupRoot(0);
    await wearPersona(0);
    await expect(runWalkTake({ carried: await invite(), dialGate: OTHER_GATE })).rejects.toThrow(/dial stands to the hearth/);
    expect(existsSync(walkDirOf())).toBe(false);
    await runWalkTake({ carried: await invite() });
    await expect(runWalkTake({ carried: await invite(OTHER_GATE) })).rejects.toBeInstanceOf(WalkRefusal);
    expect(listWalkRecords(larDataDir()).map((w) => w.gatePubKey)).toEqual([GATE]);
    // A fresh invite for the same hearth — walking back in — is taken, and the relay stays.
    await runWalkTake({ carried: await invite(GATE, null) });
    expect(runWalkState()).toEqual([expect.objectContaining({ gatePubKey: GATE, relay: RELAY, redeeming: true })]);
  });

  it("an invite with no relay, for a hearth this vessel knows no relay of, refuses", async () => {
    await generateOrLoadVesselIdentity();
    await generateOrLoadPersonaGroupRoot(0);
    await wearPersona(0);
    await expect(runWalkTake({ carried: await invite(GATE, null) })).rejects.toThrow(/names no relay/);
    await expect(runWalkTake({ carried: "lar-invite:torn" })).rejects.toThrow(/not a carried invite/);
  });

  it("walk invite hands out the newest token with the hearth's relay; an empty wallet refuses", async () => {
    await generateOrLoadVesselIdentity();
    await generateOrLoadPersonaGroupRoot(0);
    await wearPersona(0);
    await expect(runWalkInvite()).rejects.toThrow(/walks nowhere/);
    await runWalkTake({ carried: await invite() });
    await expect(runWalkInvite()).rejects.toThrow(/holds no invite/);
    const store = nodeWalkStore(larDataDir());
    const second = await mintHostingAct({ leafSeed: HEARTH, nexusAid: AID, prev: epoch.cid, cap: 3 });
    const older = mintHostToken(epoch), newer = mintHostToken(second);
    await store.write(GATE, { ...(await store.read(GATE))!, wallet: [{ epoch: epoch.cid, token: older }, { epoch: second.cid, token: newer }] });
    const out = await runWalkInvite();
    const handed = decodeInvite(out.invite)!;
    expect(handed).toMatchObject({ nexusAid: AID, gatePubKey: GATE, relay: RELAY });
    expect(tokenVerifiesAt(second, handed.token)).toBe(true);
    expect(out.left).toBe(1);
  });
});

describe("the walk and hosting stores stand owner-only", () => {
  it("RED: the walk and hosting directories are 0700, and an existing wider one is re-moded", async () => {
    await generateOrLoadVesselIdentity();
    await generateOrLoadPersonaGroupRoot(0);
    await wearPersona(0);
    mkdirSync(walkDirOf(), { recursive: true });
    chmodSync(walkDirOf(), 0o755);
    mkdirSync(join(larDataDir(), "hosting"), { recursive: true });
    chmodSync(join(larDataDir(), "hosting"), 0o755);
    await runWalkTake({ carried: await invite() });
    await rollHosting({ storageDir: larDataDir(), nexusAid: AID, leafSeed: HEARTH });
    const mode = (p: string): number => statSync(p).mode & 0o777;
    expect(mode(walkDirOf())).toBe(0o700);
    expect(mode(join(larDataDir(), "hosting"))).toBe(0o700);
    expect(mode(hostingDir(larDataDir(), AID))).toBe(0o700);
    expect(readdirSync(walkDirOf())).toHaveLength(1);                     // CONTROL: the record landed
  });
});
