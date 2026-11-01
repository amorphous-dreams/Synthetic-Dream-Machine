/**
 * walk-doors.test.ts — a node vessel's walking doors on a temp LAR_ROOT: a real vessel identity, a real persona
 * root, a real hearth's hosting state.
 *
 * Proven:
 *   · RED: a take that names no face on a vessel of two takes no invite — it refuses by name and writes nothing;
 *     CONTROL: naming a face, the take keeps the invite, presenting as THAT face's leaf in the invite's Nexus;
 *   · the named face, never the roster's first: with two faces held and h1 named, the walk presents h1's leaf;
 *   · RED: a vessel walks at one hearth — a take for a second hearth, or one beside a dial pinned elsewhere,
 *     refuses aloud and writes nothing; CONTROL: a fresh invite for the same hearth is taken;
 *   · the relay the invite named is kept past the invite's settling, so the vessel knows where to dial again;
 *   · `walk invite` hands out the newest token with the hearth's relay; an empty wallet refuses;
 *   · RED: the walk and hosting directories stand owner-only (0700), and an existing wider one is re-moded.
 */
import { describe, expect } from "vitest";
import { seatedCustody } from "../src/custody-seat.js";
import { holdSealsUntilBothArrive } from "./custody-seat-fixture.js";
import { chmodSync, statSync, readdirSync } from "node:fs";
import {
  encodeInvite, decodeInvite, mintHostToken, mintHostingAct, tokenVerifiesAt, type HostingEpoch,
} from "@lararium/mesh";
import { generateOrLoadVesselIdentity, generateOrLoadPersonaGroupRoot } from "../src/node-vessel-identity.js";
import { FaceNotNamed } from "../src/face-selector.js";
import { handleRowPath, faceRowNames } from "./face-paths.js";
import { walkRowFile } from "../src/node-walk-store.js";
import { dirname } from "node:path";
import { nexusLeafFor, faceNexusLeaf } from "../src/nexus-leaf.js";
import { nodeWalkStore, listWalkRecords } from "../src/node-walk-store.js";
import { rollHosting } from "../src/hosting-store.js";
import { hostingDirPath } from "../src/hosting-face.js";
import { runWalkTake, runWalkInvite, runWalkState, WalkRefusal } from "../src/commands/walk.js";
import { scratchRoot as root, it } from "./support/scratch-fixture.js";

const AID = "nexus-" + "a".repeat(64);
const GATE = "ee".repeat(32);
const OTHER_GATE = "dd".repeat(32);
const RELAY = "ws://hearth:7700/ws";
const HEARTH = new Uint8Array(32).fill(91);


let epoch: HostingEpoch;
async function invite(gate = GATE, relay: string | null = RELAY): Promise<string> {
  epoch ??= await mintHostingAct({ leafSeed: HEARTH, nexusAid: AID, prev: null, cap: 3 });
  return encodeInvite({ nexusAid: AID, gatePubKey: gate, token: mintHostToken(epoch), ...(relay ? { relay } : {}) });
}
const walkDirOf = (): string => dirname(handleRowPath(walkRowFile(0, GATE)));

describe("lares walk — take, as the named face, at one hearth", () => {
  it("RED: a take naming no face on a vessel of two takes no invite and writes nothing; CONTROL: named, the take keeps it as that face", async () => {
    await generateOrLoadVesselIdentity({ placeFoundingCard: { readBack: async () => {} } });
    await generateOrLoadPersonaGroupRoot(0);
    await generateOrLoadPersonaGroupRoot(1);
    await expect(runWalkTake({ carried: await invite() })).rejects.toBeInstanceOf(FaceNotNamed);
    expect(faceRowNames().some((n) => n.startsWith("walk-"))).toBe(false);
    const taken = await runWalkTake({ carried: await invite(), face: 0 });
    expect(taken).toMatchObject({ gatePubKey: GATE, nexusAid: AID, relay: RELAY, leaf: (await nexusLeafFor(0, AID))!.verifyingKey });
    expect((await listWalkRecords()).map((w) => w.gatePubKey)).toEqual([GATE]);
  });

  it("the named face, never the roster's first: two faces held and h1 named, the walk presents h1's leaf", async () => {
    await generateOrLoadVesselIdentity({ placeFoundingCard: { readBack: async () => {} } });
    await generateOrLoadPersonaGroupRoot(0);
    await generateOrLoadPersonaGroupRoot(1);
    // A read never mints: neither face holds a key at the Nexus until the walk presents the named one.
    expect(await faceNexusLeaf(AID, 1)).toBeNull();
    const walked = (await runWalkTake({ carried: await invite(), face: 1 })).leaf;
    const h1 = (await nexusLeafFor(1, AID))!.verifyingKey;
    expect(walked).toBe(h1);
    expect(await nexusLeafFor(0, AID)).toBeNull();
    expect((await faceNexusLeaf(AID, 1))?.verifyingKey).toBe(h1);
  });

  it("RED: two takes for two hearths that start together keep ONE hearth; the other refuses", async () => {
    await generateOrLoadVesselIdentity({ placeFoundingCard: { readBack: async () => {} } });
    await generateOrLoadPersonaGroupRoot(0);
    const [here, there] = [await invite(GATE), await invite(OTHER_GATE)];
    // The handshake holds the overlap: neither take seals its row until both have read that this vessel walks
    // nowhere. Which take seals first stays the machine's own choice; the vessel keeps that one hearth alone.
    const gate = holdSealsUntilBothArrive(seatedCustody()!, /^walk-h/);
    let outcomes: PromiseSettledResult<Awaited<ReturnType<typeof runWalkTake>>>[];
    try { outcomes = await Promise.allSettled([runWalkTake({ carried: here }), runWalkTake({ carried: there })]); }
    finally { gate.release(); }
    expect(outcomes.map((o) => o.status).sort()).toEqual(["fulfilled", "rejected"]);
    const won = outcomes.find((o): o is PromiseFulfilledResult<Awaited<ReturnType<typeof runWalkTake>>> => o.status === "fulfilled")!;
    expect(outcomes.find((o): o is PromiseRejectedResult => o.status === "rejected")!.reason).toBeInstanceOf(WalkRefusal);
    expect([GATE, OTHER_GATE]).toContain(won.value.gatePubKey);
    expect((await listWalkRecords()).map((w) => w.gatePubKey)).toEqual([won.value.gatePubKey]);
  });

  it("RED: a second hearth, or a dial pinned elsewhere, refuses and writes nothing; CONTROL: the same hearth takes a fresh invite", async () => {
    await generateOrLoadVesselIdentity({ placeFoundingCard: { readBack: async () => {} } });
    await generateOrLoadPersonaGroupRoot(0);
    await expect(runWalkTake({ carried: await invite(), dialGate: OTHER_GATE })).rejects.toThrow(/dial stands to the hearth/);
    expect(faceRowNames().some((n) => n.startsWith("walk-"))).toBe(false);
    await runWalkTake({ carried: await invite() });
    await expect(runWalkTake({ carried: await invite(OTHER_GATE) })).rejects.toBeInstanceOf(WalkRefusal);
    expect((await listWalkRecords()).map((w) => w.gatePubKey)).toEqual([GATE]);
    // The same hearth in another Nexus refuses too: one record names one Nexus.
    const otherNexus = encodeInvite({ nexusAid: "nexus-" + "b".repeat(64), gatePubKey: GATE, token: mintHostToken(epoch), relay: RELAY });
    await expect(runWalkTake({ carried: otherNexus })).rejects.toThrow(/in another Nexus/);
    expect((await runWalkState()).map((w) => w.nexusAid)).toEqual([AID]);
    // A fresh invite for the same hearth — walking back in — is taken, and the relay stays.
    await runWalkTake({ carried: await invite(GATE, null) });
    expect(await runWalkState()).toEqual([expect.objectContaining({ gatePubKey: GATE, relay: RELAY, redeeming: true })]);
  });

  it("an invite with no relay, for a hearth this vessel knows no relay of, refuses", async () => {
    await generateOrLoadVesselIdentity({ placeFoundingCard: { readBack: async () => {} } });
    await generateOrLoadPersonaGroupRoot(0);
    await expect(runWalkTake({ carried: await invite(GATE, null) })).rejects.toThrow(/names no relay/);
    await expect(runWalkTake({ carried: "lar-invite:torn" })).rejects.toThrow(/not a carried invite/);
  });

  it("walk invite hands out the newest token with the hearth's relay; an empty wallet refuses", async () => {
    await generateOrLoadVesselIdentity({ placeFoundingCard: { readBack: async () => {} } });
    await generateOrLoadPersonaGroupRoot(0);
    await expect(runWalkInvite()).rejects.toThrow(/walks nowhere/);
    await runWalkTake({ carried: await invite() });
    await expect(runWalkInvite()).rejects.toThrow(/holds no invite/);
    const store = nodeWalkStore({ face: 0 });
    const second = await mintHostingAct({ leafSeed: HEARTH, nexusAid: AID, prev: epoch.cid, cap: 3 });
    const older = mintHostToken(epoch), newer = mintHostToken(second);
    await store.update(GATE, (held) => ({ ...held!, wallet: [{ epoch: epoch.cid, token: older }, { epoch: second.cid, token: newer }] }));
    const out = await runWalkInvite();
    const handed = decodeInvite(out.invite)!;
    expect(handed).toMatchObject({ nexusAid: AID, gatePubKey: GATE, relay: RELAY });
    expect(tokenVerifiesAt(second, handed.token)).toBe(true);
    expect(out.left).toBe(1);
  });
});

describe("the walk and hosting stores stand owner-only", () => {
  it("RED: the walk and hosting directories are 0700, and an existing wider one is re-moded", async () => {
    const mode = (p: string): number => statSync(p).mode & 0o777;
    await generateOrLoadVesselIdentity({ placeFoundingCard: { readBack: async () => {} } });
    await generateOrLoadPersonaGroupRoot(0);
    await runWalkTake({ carried: await invite() });
    expect(mode(walkDirOf())).toBe(0o700); // the face directory was founded owner-only
    await rollHosting({ nexusAid: AID, leafSeed: HEARTH });
    const hostingRoot = dirname(hostingDirPath(0, AID)!);
    chmodSync(hostingRoot, 0o755);
    await runWalkTake({ carried: await invite() });
    await rollHosting({ nexusAid: AID, leafSeed: HEARTH });
    expect(mode(walkDirOf())).toBe(0o700);
    expect(mode(hostingRoot)).toBe(0o700);
    expect(mode(hostingDirPath(0, AID)!)).toBe(0o700);
    expect(readdirSync(walkDirOf()).filter((n) => n.startsWith("walk-"))).toHaveLength(1);                     // CONTROL: the record landed
  });
});
