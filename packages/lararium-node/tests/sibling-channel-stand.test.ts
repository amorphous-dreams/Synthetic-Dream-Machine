/**
 * sibling-channel-stand.test — `standSiblingChannel`, the ONE composition both vessel shores call, stood over a
 * real herm relay beside a second herm: it reads the face's persona-KEL off the vessel's own board, the board's next
 * event re-licenses the standing sessions, and a pull off the herms' drops lands on that same board.
 *
 *   · CONTROL: two enrolled leaves of one PersonaGroup stand their channels through the relay and sync a doc;
 *   · RED: a rotation that lands on one leaf's board re-enrols it and leaves the sibling out — the leaf deposits it
 *     at both herms before it closes the session, the sibling pulls it onto its own board, leaves this leaf's peers
 *     and its refusal surfaces, never a silent drop;
 *   · RED: the lease epoch the vessel holds reaches the proof — a sibling whose edge binds below it is refused
 *     as lapsed;
 *   · RED: the channel stands over every pinned herm — the first herm closing leaves the pair syncing over the second;
 *   · RED: ONE herm stands the channel DEGRADED — two leaves sync over it, and the channel says on every dial and in
 *     its status that withholding cannot be tolerated through one herm; CONTROL: two herms read no degraded mode;
 *   · RED: a herm address with no pinned gate key, or no herm at all, refuses the CHANNEL alone: it dials nothing,
 *     says why as `pins` on every dial and in its status, and never throws into the vessel's boot.
 */
import { afterEach, describe, test, expect } from "vitest";
import * as ed from "@noble/ed25519";
import { Repo, type AutomergeUrl } from "@automerge/automerge-repo";
import {
  hex, ed25519SignerFromSeed, standSiblingChannel, enrolDevice, rollEnrolments, groupSecretOpenerFromSeed,
  materializeSharedLarDoc, personaKelBoardDocUrl, writePersonaKelEvent, provisionThresholdRecoveryAtFounding,
  guardianRecoveryRegistrationCard, attestAndRotate, type PersonaKelEvent, type SiblingRefusal, type SiblingNetworkAdapter,
} from "@lararium/mesh";
import { startAuthenticatedMembershipRelay, type AuthenticatedMembershipRelay } from "../src/authenticated-membership-relay.js";

const pubOf = (seed: Uint8Array) => ed.getPublicKeyAsync(seed).then(hex);
const seed = (b: number) => new Uint8Array(32).fill(b);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const NEXUS = "9a".repeat(32);

async function kelOf(): Promise<{ inception: PersonaKelEvent; rotate: (keep: readonly Uint8Array[]) => Promise<PersonaKelEvent> }> {
  const guardianSeeds = [seed(61), seed(62), seed(63)];
  const guardianRecoveryKeys = await Promise.all(guardianSeeds.map(pubOf));
  const slots = ["mine", "guardian-a", "guardian-b"] as const;
  const prov = provisionThresholdRecoveryAtFounding({
    foundingOpKeyDid: `0x${await pubOf(seed(51))}`,
    guardians: guardianRecoveryKeys.map((k, i) => guardianRecoveryRegistrationCard(slots[i]!, k, null)),
    recoveryThreshold: 2,
  });
  const rotate = async (keep: readonly Uint8Array[]): Promise<PersonaKelEvent> => {
    const guardianSigners = await Promise.all(guardianSeeds.slice(0, 2).map(async (s) => ({
      signer: await pubOf(s), sign: async (b: Uint8Array) => hex(await ed.signAsync(b, s)),
    })));
    const devices = await Promise.all(keep.map(async (d) => ({ deviceVerifyingKey: await pubOf(d), hearthTrueName: "", boundEpoch: 0 })));
    const enrolments = await rollEnrolments({ prefix: prov.inception.prefix, opSeed: seed(52), devices });
    const rot = await attestAndRotate({ head: prov.inception, freshOpKeyDid: `0x${await pubOf(seed(52))}`, guardianRecoveryKeys, recoveryThreshold: prov.recoveryThreshold, guardianSigners, enrolments });
    if (!rot.ok) throw new Error(rot.reason);
    return rot.event;
  };
  return { inception: prov.inception, rotate };
}

describe("standSiblingChannel — the one composition both shores call", () => {
  let relay: AuthenticatedMembershipRelay | undefined;
  let second: AuthenticatedMembershipRelay | undefined;
  const repos: Repo[] = [];
  afterEach(async () => {
    for (const r of repos.splice(0)) await r.shutdown();
    await relay?.close(); relay = undefined;
    await second?.close(); second = undefined;
  });
  const herms = (): string[] => [relay!, second!].map((r) => `ws://127.0.0.1:${r.port}#${r.gatePubKey}`);

  async function standLeaf(
    device: Uint8Array, inception: PersonaKelEvent, lease: { expectedEpoch?: number; boundEpoch?: number } = {}, pins: readonly string[] = herms(),
  ): Promise<{ repo: Repo; refusals: SiblingRefusal[]; key: string; board: Awaited<ReturnType<typeof materializeSharedLarDoc>>; adapter: SiblingNetworkAdapter }> {
    const repo = new Repo({ network: [], sharePolicy: async () => true });
    repos.push(repo);
    const board = await materializeSharedLarDoc(repo, personaKelBoardDocUrl(NEXUS), "board:persona-kel");
    board.change((d) => writePersonaKelEvent(d, inception));
    const key = await pubOf(device);
    const refusals: SiblingRefusal[] = [];
    const adapter = await standSiblingChannel({
      repo, herms: [...pins], nexusPubkey: NEXUS, retryInterval: 60_000,
      personaKelPrefix: inception.prefix, deviceKey: key, sign: ed25519SignerFromSeed(device),
      enrolment: await enrolDevice({ opSeed: seed(51), prefix: inception.prefix, deviceVerifyingKey: key, hearthTrueName: "", boundEpoch: lease.boundEpoch ?? 0 }),
      open: groupSecretOpenerFromSeed(device),
      expectedEpoch: lease.expectedEpoch ?? 0,
      onRefusal: (r) => refusals.push(r),
    });
    return { repo, refusals, key, board, adapter };
  }

  test("CONTROL, then RED: siblings sync; a rotation on the board that leaves a sibling out parts the pair, and the sibling says it stands revoked", async () => {
    relay = await startAuthenticatedMembershipRelay(seed(50), 0);
    second = await startAuthenticatedMembershipRelay(seed(49), 0);
    const { inception, rotate } = await kelOf();
    const x = await standLeaf(seed(53), inception);
    const y = await standLeaf(seed(54), inception);
    for (let i = 0; i < 200 && (x.repo.peers.length === 0 || y.repo.peers.length === 0); i++) await sleep(20);
    const handle = x.repo.create<{ line: string }>({ line: "synced through the composed channel" });
    expect((await y.repo.find<{ line: string }>(handle.url as AutomergeUrl)).doc()?.line).toBe("synced through the composed channel");
    expect([...x.refusals, ...y.refusals]).toEqual([]);

    const rotation = await rotate([seed(53)]);                 // x re-enrolled, y left out
    x.board.change((d) => writePersonaKelEvent(d, rotation));
    // x deposits the move at both herms and closes the session inside it; y pulls it onto its own board and finds
    // no seal for it.
    for (let i = 0; i < 200 && !y.refusals.some((r) => r.suspect === "self"); i++) await sleep(20);
    expect(y.refusals.find((r) => r.suspect === "self")).toMatchObject({ cause: "revoked" });
    for (let i = 0; i < 200 && (x.repo.peers.length > 0 || y.repo.peers.length > 0); i++) await sleep(20);
    expect(x.repo.peers).toEqual([]);
    expect(y.repo.peers).toEqual([]);
  }, 20_000);

  test("RED: the held lease epoch reaches the proof — a sibling whose edge binds below it is refused as lapsed", async () => {
    relay = await startAuthenticatedMembershipRelay(seed(50), 0);
    second = await startAuthenticatedMembershipRelay(seed(49), 0);
    const { inception } = await kelOf();
    const x = await standLeaf(seed(53), inception, { expectedEpoch: 1, boundEpoch: 1 });
    const y = await standLeaf(seed(54), inception, { expectedEpoch: 0, boundEpoch: 0 });
    for (let i = 0; i < 200 && x.refusals.length === 0; i++) await sleep(20);
    expect(x.refusals[0]).toMatchObject({ suspect: "peer", peerKey: y.key, reason: expect.stringMatching(/lease stale/) });
    expect(x.repo.peers).toEqual([]);
  }, 20_000);

  test("RED (M2): the channel stands over EVERY pinned herm — the first herm closing leaves the pair syncing over the second", async () => {
    relay = await startAuthenticatedMembershipRelay(seed(50), 0);
    second = await startAuthenticatedMembershipRelay(seed(49), 0);
    const { inception } = await kelOf();
    const x = await standLeaf(seed(53), inception);
    const y = await standLeaf(seed(54), inception);
    for (let i = 0; i < 200 && (x.repo.peers.length === 0 || y.repo.peers.length === 0 || x.adapter.status().carried < 2); i++) await sleep(20);
    expect(x.adapter.status()).toMatchObject({ refusal: null, degraded: null, herms: 2, carried: 2 });
    expect([...x.refusals, ...y.refusals].filter((r) => r.suspect === "pins"), "CONTROL: two herms say no degraded mode").toEqual([]);
    await relay.close(); relay = undefined;
    // The pair may still be proving over the second herm when the first closes: wait for the pair over it.
    for (let i = 0; i < 200 && (x.adapter.status().carried > 1 || x.repo.peers.length !== 1 || y.repo.peers.length !== 1); i++) await sleep(20);
    expect(x.repo.peers).toHaveLength(1);
    expect(y.repo.peers).toHaveLength(1);
    const handle = x.repo.create<{ line: string }>({ line: "over the herm still standing" });
    expect((await y.repo.find<{ line: string }>(handle.url as AutomergeUrl)).doc()?.line).toBe("over the herm still standing");
  }, 20_000);

  test("RED (one herm): ONE herm stands the channel DEGRADED — the pair syncs over it, and the channel says on every dial and in status that withholding cannot be tolerated through one herm", async () => {
    relay = await startAuthenticatedMembershipRelay(seed(50), 0);
    const { inception } = await kelOf();
    const one = [`ws://127.0.0.1:${relay.port}#${relay.gatePubKey}`];
    const x = await standLeaf(seed(53), inception, {}, one);
    const y = await standLeaf(seed(54), inception, {}, one);
    for (let i = 0; i < 200 && (x.repo.peers.length === 0 || y.repo.peers.length === 0); i++) await sleep(20);
    const handle = x.repo.create<{ line: string }>({ line: "over one herm, degraded" });
    expect((await y.repo.find<{ line: string }>(handle.url as AutomergeUrl)).doc()?.line).toBe("over one herm, degraded");
    expect(x.adapter.status()).toMatchObject({ refusal: null, degraded: expect.stringMatching(/cannot be tolerated through one herm/), herms: 1, carried: 1 });
    expect(x.refusals).toEqual([{ suspect: "pins", stands: true, reason: expect.stringMatching(/cannot be tolerated through one herm/) }]);
    x.adapter.connect("again" as never);
    expect(x.refusals.filter((r) => r.suspect === "pins" && r.stands), "said on every dial").toHaveLength(2);
    // Two addresses under ONE gate key pin one herm, and read degraded alike.
    const twice = await standLeaf(seed(56), inception, {}, [one[0]!, `ws://127.0.0.1:${relay.port}#${relay.gatePubKey}`]);
    expect(twice.adapter.status()).toMatchObject({ refusal: null, degraded: expect.stringMatching(/one herm/) });
  }, 20_000);

  test("RED (M2): no herm, or an address with no pinned gate key, refuses the CHANNEL — said as `pins` on every dial and in status — and never throws", async () => {
    const repo = new Repo({ network: [], sharePolicy: async () => true });
    repos.push(repo);
    const { inception } = await kelOf();
    const key = await pubOf(seed(55));
    const gate = (b: number) => b.toString(16).padStart(2, "0").repeat(32);
    for (const [herms, why] of [
      [["ws://127.0.0.1:9", `ws://127.0.0.1:10#${gate(1)}`], /reads no gate key/],
      [[], /pins no herm/],
    ] as const) {
      const refusals: SiblingRefusal[] = [];
      const adapter = await standSiblingChannel({
        repo, herms: [...herms], nexusPubkey: NEXUS, personaKelPrefix: inception.prefix,
        deviceKey: key, sign: ed25519SignerFromSeed(seed(55)),
        enrolment: await enrolDevice({ opSeed: seed(51), prefix: inception.prefix, deviceVerifyingKey: key, hearthTrueName: "", boundEpoch: 0 }),
        open: groupSecretOpenerFromSeed(seed(55)), expectedEpoch: 0, onRefusal: (r) => refusals.push(r),
      });
      await adapter.whenReady();
      expect(refusals).toEqual([{ suspect: "pins", stands: false, reason: expect.stringMatching(why) }]);
      expect(adapter.status()).toMatchObject({ refusal: expect.stringMatching(why), degraded: null, carried: 0 });
      adapter.connect("again" as never);
      expect(refusals.filter((r) => r.suspect === "pins")).toHaveLength(2);
    }
  });
});
