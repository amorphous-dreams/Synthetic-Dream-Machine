/**
 * sibling-channel.test — leaves of one PersonaGroup sync an Automerge doc through a relay that carries sealed
 * frames and reads none, and every divergence the relay or an impostor brings surfaces as a refusal.
 *
 * The relay here stands in memory, so a test can make it hostile; the live herm's relay (node, real sockets)
 * carries the same frames in `authenticated-membership-relay` and the e2e `leaf-sibling-sync`.
 *
 * Proven, each red beside its control:
 *   · CONTROL: two sibling leaves, no listening vessel, sync a doc; each names the other's device key as proven;
 *   · carry ⊥ read: no byte of the doc's content, no edge field, no root key crosses the relay in the clear;
 *   · RED: an impostor whose edge a stranger root signed becomes no peer, and its refusal surfaces;
 *   · RED: a sibling whose edge the KEL head rolled past becomes no peer, and its refusal surfaces;
 *   · RED: a frame the relay INJECTS after the proof refuses the session; the sibling leaves, the refusal surfaces;
 *   · RED: a frame the relay REPLAYS after the proof refuses the session the same way;
 *   · RED: a KEL head that moves past a standing sibling's edge (`relicense`) drops it, and says so.
 */
import { describe, test, expect } from "vitest";
import * as ed from "@noble/ed25519";
import { Repo, type AutomergeUrl, type DocHandle, type PeerId } from "@automerge/automerge-repo";
import { hex } from "../src/crypto.js";
import { buildDeviceDelegation, type DeviceDelegationTiddler } from "../src/device-delegation.js";
import type { PersonaKelEvent } from "../src/persona-kel.js";
import { provisionThresholdRecoveryAtFounding, attestAndRotate } from "../src/recovery-keel-core.js";
import { guardianRecoveryRegistrationCard } from "../src/recovery-registration.js";
import type { LeafPeerSelf } from "../src/leaf-peer-proof.js";
import {
  SiblingNetworkAdapter, siblingChannelTag,
  type SiblingTransport, type SiblingWireFrame, type SiblingRefusal,
} from "../src/sibling-channel.js";

const SEEDS = {
  opA: new Uint8Array(32).fill(11), opB: new Uint8Array(32).fill(22), stranger: new Uint8Array(32).fill(9),
  deviceX: new Uint8Array(32).fill(33), deviceY: new Uint8Array(32).fill(44), deviceZ: new Uint8Array(32).fill(55),
  g1: new Uint8Array(32).fill(1), g2: new Uint8Array(32).fill(2), g3: new Uint8Array(32).fill(3),
};
const pubOf    = (s: Uint8Array) => ed.getPublicKeyAsync(s).then(hex);
const didOf    = async (s: Uint8Array) => `0x${await pubOf(s)}`;
const signerOf = (s: Uint8Array) => async (bytes: Uint8Array) => hex(await ed.signAsync(bytes, s));

async function founded() {
  const guardianRecoveryKeys = await Promise.all([pubOf(SEEDS.g1), pubOf(SEEDS.g2), pubOf(SEEDS.g3)]);
  const slots = ["mine", "guardian-a", "guardian-b"] as const;
  const guardians = guardianRecoveryKeys.map((k, i) => guardianRecoveryRegistrationCard(slots[i]!, k, null));
  const prov = provisionThresholdRecoveryAtFounding({ foundingOpKeyDid: await didOf(SEEDS.opA), guardians, recoveryThreshold: 2 });
  return { inception: prov.inception, guardianRecoveryKeys, recoveryThreshold: prov.recoveryThreshold };
}
async function rotatedToOpB(): Promise<PersonaKelEvent[]> {
  const { inception, guardianRecoveryKeys, recoveryThreshold } = await founded();
  const guardianSigners = await Promise.all([SEEDS.g1, SEEDS.g2].map(async (s) => ({ signer: await pubOf(s), sign: signerOf(s) })));
  const rot = await attestAndRotate({ head: inception, freshOpKeyDid: await didOf(SEEDS.opB), guardianRecoveryKeys, recoveryThreshold, guardianSigners });
  if (!rot.ok) throw new Error(rot.reason);
  return [inception, rot.event];
}
const edgeFor = async (root: Uint8Array, device: Uint8Array): Promise<DeviceDelegationTiddler> =>
  buildDeviceDelegation({ personaRootSeed: root, deviceVerifyingKey: await pubOf(device), hearthTrueName: "", boundEpoch: 0 });
const leaf = async (device: Uint8Array, edge: DeviceDelegationTiddler, kel: readonly PersonaKelEvent[]): Promise<LeafPeerSelf> =>
  ({ deviceKey: await pubOf(device), sign: signerOf(device), edge, kel });

/**
 * An in-memory relay: it stamps every frame with the key it "proved" for the sender and routes it to the
 * addressed key (or every other member). It keeps every frame it carried, and `tamper` lets a test stand a
 * HOSTILE relay that rewrites, injects or replays.
 */
function memoryRelay() {
  const members = new Map<string, { frame: Set<(from: string, f: unknown) => void>; close: Set<() => void> }>();
  const carried: string[] = [];
  const deliver = (from: string, to: string, frame: unknown): void => {
    const text = JSON.stringify(frame);
    carried.push(text);
    queueMicrotask(() => { for (const l of members.get(to)?.frame ?? []) l(from, JSON.parse(text)); });
  };
  const relay = {
    carried,
    /** Every sealed frame the relay carried from `from` to `to`, as it carried it. */
    sealedFrom: [] as Array<{ from: string; to: string; frame: SiblingWireFrame }>,
    inject(from: string, to: string, frame: unknown): void { deliver(from, to, frame); },
    transportFor(key: string): () => Promise<SiblingTransport> {
      return async () => {
        const m = { frame: new Set<(from: string, f: unknown) => void>(), close: new Set<() => void>() };
        members.set(key, m);
        return {
          send: (to, frame) => {
            if (frame.t === "seal" && to) relay.sealedFrom.push({ from: key, to, frame });
            for (const target of to ? [to] : [...members.keys()].filter((k) => k !== key)) deliver(key, target, frame);
          },
          onFrame: (l) => { m.frame.add(l); return () => { m.frame.delete(l); }; },
          onClose: (l) => { m.close.add(l); return () => { m.close.delete(l); }; },
          close: () => { members.delete(key); },
        };
      };
    },
  };
  return relay;
}

interface Leaf { repo: Repo; adapter: SiblingNetworkAdapter; refusals: SiblingRefusal[]; self: LeafPeerSelf }

function standLeaf(self: LeafPeerSelf, relay: ReturnType<typeof memoryRelay>): Leaf {
  const refusals: SiblingRefusal[] = [];
  const adapter = new SiblingNetworkAdapter({ transport: relay.transportFor(self.deviceKey), self, onRefusal: (r) => refusals.push(r) });
  const repo = new Repo({ network: [adapter], sharePolicy: async () => true });
  return { repo, adapter, refusals, self };
}

async function until(cond: () => boolean, label: string, ms = 3000): Promise<void> {
  const start = Date.now();
  while (!cond()) {
    if (Date.now() - start > ms) throw new Error(`timed out waiting for ${label}`);
    await new Promise((r) => setTimeout(r, 10));
  }
}

const CONTENT = "the sealed sibling channel carries this line and the relay reads none of it";

async function syncOne(a: Leaf, b: Leaf): Promise<DocHandle<{ line: string }>> {
  const handle = a.repo.create<{ line: string }>({ line: CONTENT });
  const found = await b.repo.find<{ line: string }>(handle.url as AutomergeUrl);
  return found;
}

const peersOf = (l: Leaf): PeerId[] => l.repo.peers;
const shutdown = async (...leaves: Leaf[]) => { for (const l of leaves) await l.repo.shutdown(); };

describe("sibling channel — leaves of one PersonaGroup sync through a relay that reads nothing", () => {
  test("the channel tag is the group's own, opaque, and one per group", () => {
    const g = "ab".repeat(32);
    expect(siblingChannelTag(g)).toMatch(/^[0-9a-f]{64}$/);
    expect(siblingChannelTag(g)).toBe(siblingChannelTag(g.toUpperCase()));
    expect(siblingChannelTag(g)).not.toContain(g);
    expect(siblingChannelTag("cd".repeat(32))).not.toBe(siblingChannelTag(g));
  });

  test("CONTROL: two sibling leaves with no listening vessel sync a doc, each proving the other's device key", async () => {
    const { inception } = await founded();
    const relay = memoryRelay();
    const x = standLeaf(await leaf(SEEDS.deviceX, await edgeFor(SEEDS.opA, SEEDS.deviceX), [inception]), relay);
    const y = standLeaf(await leaf(SEEDS.deviceY, await edgeFor(SEEDS.opA, SEEDS.deviceY), [inception]), relay);
    try {
      await until(() => peersOf(x).length === 1 && peersOf(y).length === 1, "both siblings to stand as peers");
      expect(x.adapter.provenKeyOf(peersOf(x)[0]!)).toBe(y.self.deviceKey);
      expect(y.adapter.provenKeyOf(peersOf(y)[0]!)).toBe(x.self.deviceKey);
      const found = await syncOne(x, y);
      expect(found.doc()?.line).toBe(CONTENT);
      expect([...x.refusals, ...y.refusals]).toEqual([]);
      // CARRY ⊥ READ: the relay carried the sync, and no byte of the line, no edge field and no root key in clear.
      expect(relay.sealedFrom.length).toBeGreaterThan(1);
      const wire = relay.carried.join("\n");
      for (const secret of ["sealed sibling channel", "personaRootDid", "device-delegation", (await didOf(SEEDS.opA)).slice(2)]) {
        expect(wire.includes(secret), `the relay read ${secret.slice(0, 16)}`).toBe(false);
      }
      // CONTROL on the instrument: the same scan finds the line in the doc's own bytes.
      expect(JSON.stringify(found.doc())).toContain("sealed sibling channel");
    } finally { await shutdown(x, y); }
  });

  test("RED: an impostor whose edge a stranger root signed becomes no peer, and its refusal surfaces", async () => {
    const { inception } = await founded();
    const relay = memoryRelay();
    const x = standLeaf(await leaf(SEEDS.deviceX, await edgeFor(SEEDS.opA, SEEDS.deviceX), [inception]), relay);
    const z = standLeaf(await leaf(SEEDS.deviceZ, await edgeFor(SEEDS.stranger, SEEDS.deviceZ), [inception]), relay);
    try {
      await until(() => x.refusals.length > 0, "the impostor's refusal");
      expect(x.refusals[0]).toMatchObject({ peerKey: z.self.deviceKey, reason: expect.stringMatching(/not licensed by this PersonaGroup's KEL head/) });
      expect(peersOf(x)).toEqual([]);
      expect(peersOf(z)).toEqual([]);
    } finally { await shutdown(x, z); }
  });

  test("RED: a sibling whose edge the KEL head rolled past becomes no peer, and its refusal surfaces", async () => {
    const chain = await rotatedToOpB();
    const relay = memoryRelay();
    const x = standLeaf(await leaf(SEEDS.deviceX, await edgeFor(SEEDS.opB, SEEDS.deviceX), chain), relay);
    const y = standLeaf(await leaf(SEEDS.deviceY, await edgeFor(SEEDS.opA, SEEDS.deviceY), chain), relay);
    try {
      await until(() => x.refusals.length > 0, "the rolled-past refusal");
      expect(x.refusals[0]!.reason).toMatch(/not licensed by this PersonaGroup's KEL head/);
      expect(peersOf(x)).toEqual([]);
    } finally { await shutdown(x, y); }
  });

  test("RED: a frame the relay INJECTS after the proof refuses the session; the sibling leaves and the refusal surfaces", async () => {
    const { inception } = await founded();
    const relay = memoryRelay();
    const x = standLeaf(await leaf(SEEDS.deviceX, await edgeFor(SEEDS.opA, SEEDS.deviceX), [inception]), relay);
    const y = standLeaf(await leaf(SEEDS.deviceY, await edgeFor(SEEDS.opA, SEEDS.deviceY), [inception]), relay);
    try {
      await until(() => peersOf(x).length === 1 && peersOf(y).length === 1, "both siblings to stand as peers");
      relay.inject(y.self.deviceKey, x.self.deviceKey, { t: "seal", s: { n: "A".repeat(32), c: "B".repeat(64) } });
      await until(() => x.refusals.length > 0, "the injection's refusal");
      expect(x.refusals[0]).toMatchObject({ peerKey: y.self.deviceKey, reason: expect.stringMatching(/injected, replayed or reordered/) });
      expect(peersOf(x)).toEqual([]);
    } finally { await shutdown(x, y); }
  });

  test("RED: a frame the relay REPLAYS after the proof refuses the session the same way", async () => {
    const { inception } = await founded();
    const relay = memoryRelay();
    const x = standLeaf(await leaf(SEEDS.deviceX, await edgeFor(SEEDS.opA, SEEDS.deviceX), [inception]), relay);
    const y = standLeaf(await leaf(SEEDS.deviceY, await edgeFor(SEEDS.opA, SEEDS.deviceY), [inception]), relay);
    try {
      await until(() => peersOf(x).length === 1 && peersOf(y).length === 1, "both siblings to stand as peers");
      const earlier = relay.sealedFrom.find((f) => f.from === y.self.deviceKey && f.to === x.self.deviceKey);
      expect(earlier, "the relay carried a sealed frame from y to x").toBeDefined();
      relay.inject(y.self.deviceKey, x.self.deviceKey, earlier!.frame);
      await until(() => x.refusals.length > 0, "the replay's refusal");
      expect(x.refusals[0]!.reason).toMatch(/injected, replayed or reordered/);
      expect(peersOf(x)).toEqual([]);
    } finally { await shutdown(x, y); }
  });

  test("RED: a KEL head that moves past a standing sibling's edge drops it on relicense, and says so", async () => {
    const { inception } = await founded();
    const chain = await rotatedToOpB();
    const relay = memoryRelay();
    const x = standLeaf(await leaf(SEEDS.deviceX, await edgeFor(SEEDS.opA, SEEDS.deviceX), [inception]), relay);
    const y = standLeaf(await leaf(SEEDS.deviceY, await edgeFor(SEEDS.opA, SEEDS.deviceY), [inception]), relay);
    try {
      await until(() => peersOf(x).length === 1, "y to stand as x's peer");
      await x.adapter.relicense([inception]);          // CONTROL: a head that still licenses moves nothing
      expect(peersOf(x).length).toBe(1);
      await x.adapter.relicense(chain);
      expect(x.refusals[0]).toMatchObject({ peerKey: y.self.deviceKey, reason: expect.stringMatching(/not licensed/) });
      await until(() => peersOf(x).length === 0, "y to leave x's peers");
    } finally { await shutdown(x, y); }
  });
});
