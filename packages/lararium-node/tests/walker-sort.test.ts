/**
 * walker-sort.test.ts — the sorter's walker arms: a hosting grant this hearth issued, or an invite token redeemed
 * at its gate, sorts a socket WALKER — every case here under a PRIVATE posture — and nothing else does.
 *
 * Proven (each red on the tree before the walker class, each with its control):
 *   · a current-epoch grant with its leaf's proof sorts walker, standing as the grant's leaf in its Nexus;
 *     CONTROL: the same socket presenting nothing is silence under PRIVATE;
 *   · a previous-epoch grant sorts walker and the renewed grant is pushed after the verdict; two rolls back it
 *     is silence (the hard roll is a roll done twice);
 *   · each of these drops to silence: a grant with no or another leaf's proof, a grant for a Nexus this hearth
 *     does not carry, a grant tagged under another hearth's key, a Kapae'd leaf;
 *   · a token redeems ONCE: the first socket is walker with a fresh grant pushed; the same claim again earns the
 *     IDENTICAL grant (refuse before destroy); a different claim is silence; a token of the other class, or one
 *     from another epoch, is silence;
 *   · RED: a captured `{token, claim}` replayed under another leaf is silence, and the victim's own retry still
 *     earns its identical grant after the refused attempt — the burn binds the leaf that proved;
 *   · a token is burned BEFORE the verdict — the spent-set holds its nonce as soon as the sort returns;
 *   · RED: after a redemption the hearth's store holds no guest leaf, no lineage and no claim;
 *   · the operator's count event fires once per fresh redemption.
 */
import { describe, test, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, readFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as ed from "@noble/ed25519";
import {
  hex, genesisSealEpochCid, hostingActCid, issueGrant, mintHostToken, mintHostingAct, evaluateToken,
  redeemClaim, lineageOf, signLeafProof, signAntigenEntry,
  type KahuQuorumSeats, type HostingGrant, type InviteToken, type KapaeAntigenEntry, type Presented,
} from "@lararium/mesh";
import { makeSocketSorter } from "../src/socket-sorter.js";
import { rollHosting, readHostingState, liveEpochs, hostingDir } from "../src/hosting-store.js";
import type { CarriedNexusReading } from "../src/nexus-carriage.js";
import type { SortInput } from "../src/daemon-auth-gate.js";

const SEEDS = [new Uint8Array(32).fill(1), new Uint8Array(32).fill(2), new Uint8Array(32).fill(3)];
const HEARTH_LEAF = new Uint8Array(32).fill(61);
const OTHER_HEARTH = new Uint8Array(32).fill(62);
const GUEST_SEED  = new Uint8Array(32).fill(63);
const VESSEL_SEED = new Uint8Array(32).fill(64);
const pubOf    = (seed: Uint8Array) => ed.getPublicKeyAsync(seed).then(hex);
const signerOf = (seed: Uint8Array) => (bytes: Uint8Array) => ed.signAsync(bytes, seed).then(hex);
const GATE  = "ee".repeat(32);
const NONCE = "ab".repeat(32);
const AID   = "epoch0-" + "a".repeat(64);

let storageDir = "";
beforeEach(() => { storageDir = mkdtempSync(join(tmpdir(), "walker-sort-")); });
afterEach(() => { rmSync(storageDir, { recursive: true, force: true }); });

async function rosterAt(): Promise<KahuQuorumSeats> {
  const keys = await Promise.all(SEEDS.map(pubOf));
  return { keys, threshold: 2, sealEpochCid: genesisSealEpochCid(keys, 2) };
}
async function reading(aid = AID, antigen: KapaeAntigenEntry[] = []): Promise<CarriedNexusReading> {
  const roster = await rosterAt();
  return { aid, via: "consent", island: aid, roster, sealLineage: [], denyBoard: [], antigen, antigenRoster: roster, posture: "private" };
}
function sorter(readings: CarriedNexusReading[], counts: number[] = []) {
  return makeSocketSorter({
    readings: async () => readings, carrier: () => false, primaryPosture: () => "private",
    hosting: { storageDir, leafSeedFor: async () => HEARTH_LEAF, onRedeemed: (_aid, n) => { counts.push(n); } },
  });
}
/** A socket presenting `arm`, proven by `signer` (the arm's own leaf unless named) over this socket. */
async function socket(arm: Presented | null, signer: Uint8Array = GUEST_SEED): Promise<SortInput> {
  const vesselKey = await pubOf(VESSEL_SEED);
  const base = { identifier: `0x${vesselKey}`, vesselKey, sameOperator: false, challenge: { nonce: NONCE, gatePubKey: GATE } };
  if (!arm) return base;
  const leafProof = await signLeafProof({ presented: arm, nonce: NONCE, gatePubKey: GATE, vesselKey, sign: signerOf(signer) });
  return { ...base, presented: { ...arm, leafProof } as Presented };
}
async function liveNow() { return liveEpochs(readHostingState(storageDir, AID)!, HEARTH_LEAF)!; }
async function grantAt(which: "current" | "previous", over: Partial<HostingGrant> = {}): Promise<HostingGrant> {
  const live = await liveNow();
  const epoch = which === "current" ? live.current : live.previous!;
  return { ...issueGrant(epoch, { leaf: await pubOf(GUEST_SEED), lineage: "d".repeat(64), survived: 0, from: "host" }), ...over };
}
const tokenArm = async (token: InviteToken, claimSeed = GUEST_SEED): Promise<Presented> => ({
  kind: "token", nexusAid: AID, token, claim: redeemClaim(claimSeed, token.n), leaf: await pubOf(claimSeed),
});

describe("the grant arm", () => {
  test("RED: a current-epoch grant sorts walker; CONTROL: the same socket presenting nothing is silence", async () => {
    await rollHosting({ storageDir, nexusAid: AID, leafSeed: HEARTH_LEAF });
    const sort = sorter([await reading()]);
    const grant = await grantAt("current");
    expect(await sort(await socket({ kind: "grant", grant }))).toEqual({
      class: "walker", standing: { nym: await pubOf(GUEST_SEED), aid: AID }, grant,
    });
    expect(await sort(await socket(null))).toBeNull();
  });

  test("a previous-epoch grant sorts walker and its renewal is pushed; two rolls back it is silence", async () => {
    await rollHosting({ storageDir, nexusAid: AID, leafSeed: HEARTH_LEAF });
    const old = await grantAt("current");
    await rollHosting({ storageDir, nexusAid: AID, leafSeed: HEARTH_LEAF });
    const sort = sorter([await reading()]);
    const verdict = await sort(await socket({ kind: "grant", grant: old }));
    expect(verdict?.class).toBe("walker");
    const renewed = (verdict?.push?.[0]?.body as { grant: HostingGrant }).grant;
    expect(verdict?.push?.[0]?.kind).toBe("hosting/grant");
    expect(renewed).toMatchObject({ lineage: old.lineage, survived: 1, epoch: (await liveNow()).current.cid });
    expect(await sort(await socket({ kind: "grant", grant: renewed }))).toMatchObject({ class: "walker" });   // the renewal stands
    await rollHosting({ storageDir, nexusAid: AID, leafSeed: HEARTH_LEAF });
    await rollHosting({ storageDir, nexusAid: AID, leafSeed: HEARTH_LEAF });
    expect(await sort(await socket({ kind: "grant", grant: old }))).toBeNull();
  });

  test("RED: each of these drops a grant to silence — another leaf's proof, an uncarried Nexus, another hearth's key, a Kapae'd leaf", async () => {
    await rollHosting({ storageDir, nexusAid: AID, leafSeed: HEARTH_LEAF });
    const grant = await grantAt("current");
    expect(await sorter([await reading()])(await socket({ kind: "grant", grant }, VESSEL_SEED))).toBeNull();
    expect(await sorter([await reading("epoch0-" + "b".repeat(64))])(await socket({ kind: "grant", grant }))).toBeNull();
    const foreign = await mintHostingAct({ leafSeed: OTHER_HEARTH, nexusAid: AID, prev: null, cap: 3 });
    const forged = issueGrant(foreign, { leaf: grant.leaf, lineage: grant.lineage, survived: 0, from: "host" });
    expect(await sorter([await reading()])(await socket({ kind: "grant", grant: forged }))).toBeNull();
    const roster = await rosterAt();
    const ban = await signAntigenEntry({ nym: grant.leaf, action: "kapae", parents: [], sealEpochCid: roster.sealEpochCid },
      await Promise.all([SEEDS[0]!, SEEDS[1]!].map(async (s) => ({ signer: await pubOf(s), sign: signerOf(s) }))));
    expect(await sorter([await reading(AID, [ban])])(await socket({ kind: "grant", grant }))).toBeNull();
    // CONTROL: the same grant, proven by its own leaf, in the carried Nexus, unbanned.
    expect(await sorter([await reading()])(await socket({ kind: "grant", grant }))).toMatchObject({ class: "walker" });
  });
});

describe("the token arm — redemption at the hearth's own gate", () => {
  test("RED: a token redeems once; the same claim earns the identical grant; a different claim is silence", async () => {
    await rollHosting({ storageDir, nexusAid: AID, leafSeed: HEARTH_LEAF });
    const counts: number[] = [];
    const sort = sorter([await reading()], counts);
    const token = mintHostToken((await liveNow()).current);
    const first = await sort(await socket(await tokenArm(token)));
    expect(first?.class).toBe("walker");
    const grant = (first?.push?.[0]?.body as { grant: HostingGrant }).grant;
    expect(grant).toMatchObject({ leaf: await pubOf(GUEST_SEED), survived: 0, from: "host", lineage: lineageOf(token.n, redeemClaim(GUEST_SEED, token.n)) });
    // Burned before the verdict: the spent-set already holds the nonce.
    const spent = readFileSync(join(hostingDir(storageDir, AID), `spent-${(await liveNow()).current.cid}`), "utf8");
    expect(spent).toContain(token.n);
    const retry = await sort(await socket(await tokenArm(token)));
    expect(retry).toEqual(first);
    const thief = new Uint8Array(32).fill(70);
    expect(await sort(await socket(await tokenArm(token, thief), thief))).toBeNull();
    expect(counts).toEqual([1]);
  });

  test("RED: a captured {token, claim} replayed under another leaf is silence, and destroys nothing — the victim's own retry still earns its grant", async () => {
    await rollHosting({ storageDir, nexusAid: AID, leafSeed: HEARTH_LEAF });
    const counts: number[] = [];
    const sort = sorter([await reading()], counts);
    const token = mintHostToken((await liveNow()).current);
    const first = await sort(await socket(await tokenArm(token)));
    expect(first?.class).toBe("walker");
    // The eavesdropper replays the victim's exact token and claim, under its OWN leaf and its own leaf proof.
    const thief = new Uint8Array(32).fill(73);
    const replay: Presented = { ...(await tokenArm(token)), leaf: await pubOf(thief) } as Presented;
    expect(await sort(await socket(replay, thief))).toBeNull();
    // CONTROL: the victim's own retry, after the refused attempt, earns the identical grant.
    expect(await sort(await socket(await tokenArm(token)))).toEqual(first);
    expect(counts).toEqual([1]);
  });

  test("a token of the other class, a forged output, or one minted at an epoch two rolls back is silence", async () => {
    await rollHosting({ storageDir, nexusAid: AID, leafSeed: HEARTH_LEAF });
    const sort = sorter([await reading()]);
    const token = mintHostToken((await liveNow()).current);
    expect(await sort(await socket(await tokenArm({ ...token, purpose: "walker-invite" })))).toBeNull();
    expect(await sort(await socket(await tokenArm({ ...token, y: evaluateToken((await liveNow()).current, "01".repeat(32), "host-invite") })))).toBeNull();
    await rollHosting({ storageDir, nexusAid: AID, leafSeed: HEARTH_LEAF });
    expect(await sort(await socket(await tokenArm(token)))).toMatchObject({ class: "walker" });   // the previous epoch still redeems
    const late = mintHostToken((await liveNow()).previous!);
    await rollHosting({ storageDir, nexusAid: AID, leafSeed: HEARTH_LEAF });
    expect(await sort(await socket(await tokenArm(late)))).toBeNull();
  });

  test("RED: after a redemption the store holds no guest leaf, lineage or claim", async () => {
    await rollHosting({ storageDir, nexusAid: AID, leafSeed: HEARTH_LEAF });
    const token = mintHostToken((await liveNow()).current);
    await sorter([await reading()])(await socket(await tokenArm(token)));
    const dir = hostingDir(storageDir, AID);
    const everything = readdirSync(dir).map((f) => readFileSync(join(dir, f), "utf8")).join("\n");
    const claim = redeemClaim(GUEST_SEED, token.n);
    expect(everything).toContain(token.n);                                       // CONTROL: the scan sees the nonce
    expect(everything).not.toContain(await pubOf(GUEST_SEED));
    expect(everything).not.toContain(claim);
    expect(everything).not.toContain(lineageOf(token.n, claim));
  });
});
