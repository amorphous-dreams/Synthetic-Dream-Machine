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
 *   · RED: a herm address with no pinned gate key, or fewer than two herms, throws at the stand, before any dial.
 */
import { afterEach, describe, test, expect } from "vitest";
import * as ed from "@noble/ed25519";
import { Repo, type AutomergeUrl } from "@automerge/automerge-repo";
import {
  hex, ed25519SignerFromSeed, standSiblingChannel, enrolDevice, rollEnrolments, groupSecretOpenerFromSeed,
  materializeSharedLarDoc, personaKelBoardDocUrl, writePersonaKelEvent, provisionThresholdRecoveryAtFounding,
  guardianRecoveryRegistrationCard, attestAndRotate, type PersonaKelEvent, type SiblingRefusal,
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
    device: Uint8Array, inception: PersonaKelEvent, lease: { expectedEpoch?: number; boundEpoch?: number } = {},
  ): Promise<{ repo: Repo; refusals: SiblingRefusal[]; key: string; board: Awaited<ReturnType<typeof materializeSharedLarDoc>> }> {
    const repo = new Repo({ network: [], sharePolicy: async () => true });
    repos.push(repo);
    const board = await materializeSharedLarDoc(repo, personaKelBoardDocUrl(NEXUS), "board:persona-kel");
    board.change((d) => writePersonaKelEvent(d, inception));
    const key = await pubOf(device);
    const refusals: SiblingRefusal[] = [];
    await standSiblingChannel({
      repo, herms: herms(), nexusPubkey: NEXUS,
      personaKelPrefix: inception.prefix, deviceKey: key, sign: ed25519SignerFromSeed(device),
      enrolment: await enrolDevice({ opSeed: seed(51), prefix: inception.prefix, deviceVerifyingKey: key, hearthTrueName: "", boundEpoch: lease.boundEpoch ?? 0 }),
      open: groupSecretOpenerFromSeed(device),
      expectedEpoch: lease.expectedEpoch ?? 0,
      onRefusal: (r) => refusals.push(r),
    });
    return { repo, refusals, key, board };
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

  test("RED: a herm address with no pinned gate key, or fewer than two herms under distinct keys, throws at the stand", async () => {
    const repo = new Repo({ network: [], sharePolicy: async () => true });
    repos.push(repo);
    const { inception } = await kelOf();
    const key = await pubOf(seed(55));
    const stand = async (herms: string[]) => standSiblingChannel({
      repo, herms, nexusPubkey: NEXUS, personaKelPrefix: inception.prefix,
      deviceKey: key, sign: ed25519SignerFromSeed(seed(55)),
      enrolment: await enrolDevice({ opSeed: seed(51), prefix: inception.prefix, deviceVerifyingKey: key, hearthTrueName: "", boundEpoch: 0 }),
      open: groupSecretOpenerFromSeed(seed(55)), expectedEpoch: 0,
    });
    const gate = (b: number) => b.toString(16).padStart(2, "0").repeat(32);
    await expect(stand(["ws://127.0.0.1:9", `ws://127.0.0.1:10#${gate(1)}`])).rejects.toThrow(/gate key/);
    await expect(stand([`ws://127.0.0.1:9#${gate(1)}`])).rejects.toThrow(/at least two herms/);
    await expect(stand([`ws://127.0.0.1:9#${gate(1)}`, `ws://127.0.0.1:10#${gate(1)}`])).rejects.toThrow(/at least two herms/);
  });
});
