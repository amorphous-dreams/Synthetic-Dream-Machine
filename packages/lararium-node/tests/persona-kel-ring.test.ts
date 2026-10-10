/**
 * persona-kel-ring.test — the node's persona-KEL ring hands the gate doors every event its board holds, and reads
 * heads through the one reader (`foldPersonaContests`).
 *
 *   · RED: a junk rotation planted on the board reaches the Binding Gate through the ring, and the boot door SAYS it
 *     set it aside (`unreadable`), on the production pipe the vessel boot runs (ring → `bootDaemonKeyhive`);
 *   · RED: a junk inception copy the board holds beside the founding never leads the chain, in either write order,
 *     so a door that reads the inception off `chain[0]` reads the one that verifies;
 *   · RED: junk moves no head — the ring's head stays the lawful rotation's, and the revoked edge stays refused;
 *   · GUARD: two verified rotations at one seat fork, the ring reads NO head, and the gate names the fork;
 *   · CONTROL: a clean board hands the lineage alone, names nothing, and reads the lawful head.
 */
import { afterEach, beforeAll, describe, test, expect } from "vitest";
import { Repo } from "@automerge/automerge-repo";
import type { AutomergeUrl } from "@automerge/automerge-repo";
import {
  type LarDoc, type PersonaKelEvent,
  CompositeStore, AutomergeDocStore, DAEMON_BAG_ID,
  materializeSharedLarDoc, personaKelBoardDocUrl, writePersonaKelEvent, enrolmentDigestOf, personaEventCidOf,
  verifyEdgeAgainstPersonaKel, attestAndRotate, rollEnrolments, sha256HexSync,
} from "@lararium/mesh";
import { KeyhiveProvider, DaemonEventStore, bootDaemonKeyhive, runFoundingCeremony } from "@lararium/keyhive";
import { makePersonaKelRingHolder, type PersonaKelRingHolder } from "../src/persona-kel-ring.js";
import { SEEDS, pubOf, didOf, signerOf, founded, enrol, rotatedKeeping } from "../../lararium-mesh/tests/fixtures/sibling-fleet.js";

const NEXUS = "7c".repeat(32);

/** A rotation no quorum signed, to a key of the planter's own: its cid recomputes, so only the one reader refuses it. */
function junkRotationOf(prev: PersonaKelEvent, n: number): PersonaKelEvent {
  const core = {
    seq: prev.seq + 1, prefix: prev.prefix, opKeyDid: `0x${sha256HexSync(`junk-${n}`)}`, recoverySetHash: prev.recoverySetHash,
    nextRecoverySetHash: prev.nextRecoverySetHash, prevEventCid: prev.eventCid, provisional: false, vetoOfCid: null,
    enrolmentDigest: enrolmentDigestOf([]),
  };
  return { ...core, eventCid: personaEventCidOf(core), recoveryRoster: [], recoveryThreshold: 0, rotationSigs: [] };
}

/** An inception under the persona's prefix that the prefix does not derive from: a junk copy at seq 0. */
function junkInceptionOf(inception: PersonaKelEvent): PersonaKelEvent {
  const core = {
    seq: 0, prefix: inception.prefix, opKeyDid: `0x${sha256HexSync("junk-inception")}`, recoverySetHash: inception.recoverySetHash,
    nextRecoverySetHash: inception.nextRecoverySetHash, prevEventCid: null, provisional: false, vetoOfCid: null,
    enrolmentDigest: enrolmentDigestOf([]),
  };
  return { ...core, eventCid: personaEventCidOf(core), recoveryRoster: [], recoveryThreshold: 0, rotationSigs: [] };
}

/** The inception rotated to `op` keeping `keep`: a lawful quorum-signed successor at seq 1. */
async function rotationTo(op: Uint8Array, keep: readonly Uint8Array[]): Promise<PersonaKelEvent> {
  const { inception, guardianRecoveryKeys, recoveryThreshold } = await founded();
  const guardianSigners = await Promise.all([SEEDS.g1, SEEDS.g2].map(async (s) => ({ signer: await pubOf(s), sign: signerOf(s) })));
  const devices = await Promise.all(keep.map(async (d) => ({ deviceVerifyingKey: await pubOf(d), hearthTrueName: "", boundEpoch: 0 })));
  const enrolments = await rollEnrolments({ prefix: inception.prefix, opSeed: op, devices });
  const rot = await attestAndRotate({ head: inception, freshOpKeyDid: await didOf(op), guardianRecoveryKeys, recoveryThreshold, guardianSigners, enrolments });
  if (!rot.ok) throw new Error(rot.reason);
  return rot.event;
}

const repos: Repo[] = [];
const holders: PersonaKelRingHolder[] = [];
afterEach(async () => {
  for (const h of holders.splice(0)) h.dispose();
  for (const r of repos.splice(0)) await r.shutdown();
});

/** A ring over a board written in exactly `events`' order. */
async function ringOver(events: readonly PersonaKelEvent[]): Promise<PersonaKelRingHolder> {
  const repo = new Repo({ network: [] });
  repos.push(repo);
  const board = await materializeSharedLarDoc(repo, personaKelBoardDocUrl(NEXUS), "board:persona-kel");
  board.change((d) => { for (const e of events) writePersonaKelEvent(d, e); });
  const holder = makePersonaKelRingHolder({ repo, nexusPubkey: NEXUS });
  holders.push(holder);
  await holder.ready;
  return holder;
}

describe("persona-kel ring — the doors meet every event the board holds", () => {
  const SEED = new Uint8Array(32).fill(7);
  let boot: { repo: Repo; verifyingKey: string; prefix: string; args: Parameters<typeof bootDaemonKeyhive>[0] };

  beforeAll(async () => {
    const repo = new Repo();
    const probe = new KeyhiveProvider();
    await probe.init({ seed: SEED, eventStore: { put: async () => {}, list: async () => [] } });
    const did = await probe.whoami();
    const verifyingKey = did.startsWith("0x") ? did.slice(2) : did;
    await probe.dispose();
    const cer = await runFoundingCeremony({
      repo, vesselSeed: SEED, vesselVerifyingKey: verifyingKey, vesselDisplayName: "Ring Operator",
      binding: { mode: "self-stood", signerSeed: SEED }, hearthTrueName: "", nexusPubkey: verifyingKey,
    });
    const daemonHandle = await repo.find<LarDoc>(cer.daemonUrl as AutomergeUrl);
    const composite = new CompositeStore();
    const daemonStore = new AutomergeDocStore(daemonHandle, DAEMON_BAG_ID);
    composite.addLayer({ bagId: DAEMON_BAG_ID, store: daemonStore, writable: true });
    daemonStore.markSyncComplete();
    boot = {
      repo, verifyingKey, prefix: cer.personaKelPrefix,
      args: {
        seed: SEED, eventStore: new DaemonEventStore({ daemon: composite }), vesselVerifyingKey: verifyingKey,
        personaGroupDocIdHex: cer.personaGroupDocIdHex, personaGroupAgentIdHex: cer.personaGroupAgentIdHex,
        meshCabalDocIdHex: cer.meshCabalDocIdHex, registerBags: [DAEMON_BAG_ID], signerDid: cer.signerDid,
        personaKel: { prefix: cer.personaKelPrefix, chain: [] }, deviceEdge: cer.founderEdge, expectedEpoch: 0,
      },
    };
  });

  test("RED: a junk rotation on the board reaches the Binding Gate through the ring, and the boot door says it set it aside; CONTROL: the clean board says nothing", async () => {
    const holder = makePersonaKelRingHolder({ repo: boot.repo, nexusPubkey: boot.verifyingKey });
    holders.push(holder);
    await holder.ready;
    const clean = holder.chainForPrefix(boot.prefix)!;
    const warn = console.warn;
    console.warn = () => {};
    try {
      const control = await bootDaemonKeyhive({ ...boot.args, personaKel: { prefix: boot.prefix, chain: clean } });
      expect(control.unreadable, "CONTROL: a clean board names nothing").toBeNull();
      await control.keyhive.dispose();

      const head = clean[clean.length - 1]!;
      const junk = junkRotationOf(head, 1);
      const board = await materializeSharedLarDoc(boot.repo, personaKelBoardDocUrl(boot.verifyingKey), "board:persona-kel");
      board.change((d) => writePersonaKelEvent(d, junk));
      const planted = holder.chainForPrefix(boot.prefix)!;
      expect(planted.map((e) => e.eventCid), "the ring hands the junk on, and the door judges it").toContain(junk.eventCid);
      const said = await bootDaemonKeyhive({ ...boot.args, personaKel: { prefix: boot.prefix, chain: planted } });
      expect(said.unreadable).toMatch(new RegExp(`do not verify and move nothing.*${junk.eventCid.slice(0, 16)}`));
      expect(await holder.headOpKeyForPrefix(boot.prefix), "the junk moves no head").toBe(head.opKeyDid);
      await said.keyhive.dispose();
    } finally { console.warn = warn; }
  }, 20_000);

  test("RED: a junk inception copy never leads the chain, in either write order — `chain[0]` is the inception that verifies", async () => {
    const { inception } = await founded();
    const junk = junkInceptionOf(inception);
    for (const order of [[junk, inception], [inception, junk]]) {
      const holder = await ringOver(order);
      const chain = holder.chainForPrefix(inception.prefix)!;
      expect(chain[0]!.eventCid).toBe(inception.eventCid);
      expect(chain.map((e) => e.eventCid)).toContain(junk.eventCid);
      expect(await holder.headOpKeyForPrefix(inception.prefix)).toBe(inception.opKeyDid);
    }
  });

  test("RED: junk planted ahead of a lawful rotation moves no head, and the revoked edge stays refused with the junk named", async () => {
    const [inception, rot] = await rotatedKeeping([SEEDS.deviceX]) as [PersonaKelEvent, PersonaKelEvent];   // Y revoked
    const junk = junkRotationOf(inception, 2);
    const ey = await enrol(SEEDS.opA, SEEDS.deviceY, inception.prefix);
    const ex = await enrol(SEEDS.opB, SEEDS.deviceX, inception.prefix);
    for (const order of [[inception, junk, rot], [inception, rot, junk]]) {
      const holder = await ringOver(order);
      expect(await holder.headOpKeyForPrefix(inception.prefix)).toBe(await didOf(SEEDS.opB));
      const chain = holder.chainForPrefix(inception.prefix)!;
      const refused = await verifyEdgeAgainstPersonaKel(ey.edge, chain, { expectedEpoch: 0 });
      expect(refused.ok, "the rotation still revokes Y").toBe(false);
      expect(refused.unreadable).toMatch(new RegExp(junk.eventCid.slice(0, 16)));
      const stands = await verifyEdgeAgainstPersonaKel(ex.edge, chain, { expectedEpoch: 0 });
      expect(stands.ok, "the head's own edge stands").toBe(true);
      expect(stands.unreadable).toMatch(new RegExp(junk.eventCid.slice(0, 16)));
    }
  });

  test("GUARD: two verified rotations at one seat fork — the ring reads no head and the gate names the fork; CONTROL: one rotation alone reads its head", async () => {
    const { inception } = await founded();
    const b = await rotationTo(SEEDS.opB, [SEEDS.deviceX]);
    const c = await rotationTo(SEEDS.opC, [SEEDS.deviceX]);
    const exB = await enrol(SEEDS.opB, SEEDS.deviceX, inception.prefix);
    for (const order of [[inception, b, c], [inception, c, b]]) {
      const holder = await ringOver(order);
      expect(await holder.headOpKeyForPrefix(inception.prefix), "a fork leaves the head in doubt").toBeNull();
      const v = await verifyEdgeAgainstPersonaKel(exB.edge, holder.chainForPrefix(inception.prefix)!, { expectedEpoch: 0 });
      expect(v.ok).toBe(false);
      expect(v.fork).toMatch(/forks at seq 1/);
    }
    const lawful = await ringOver([inception, b]);
    expect(lawful.chainForPrefix(inception.prefix)!.map((e) => e.eventCid)).toEqual([inception.eventCid, b.eventCid]);
    expect(await lawful.headOpKeyForPrefix(inception.prefix)).toBe(await didOf(SEEDS.opB));
    const v = await verifyEdgeAgainstPersonaKel(exB.edge, lawful.chainForPrefix(inception.prefix)!, { expectedEpoch: 0 });
    expect(v).toMatchObject({ ok: true });
    expect(v.unreadable).toBeUndefined();
  });
});
