/**
 * sibling-herm-relay.test — the herm's relay CARRIES sibling frames over real sockets: it routes on the channel
 * tag a leaf joined and the key the one gate proved for it, and it reads no frame.
 *
 * Proven over real sockets, each red beside its control:
 *   · CONTROL: a frame to the whole channel reaches every other key joined on it, stamped with the sender's
 *     PROVEN key;
 *   · RED: a key joined on ANOTHER channel hears nothing of it;
 *   · RED: a frame addressed to one key reaches no other key on the channel;
 *   · RED: a socket that joined no channel neither sends nor hears;
 *   · RED: a `from` the sender writes into its own frame never replaces the stamp;
 *   · the herm's sight (`onSiblingFrame`) holds exactly the frames it carried;
 *   · CARRY ⊥ READ: two sibling leaves sync a doc through the relay, and its whole sight holds no byte of the
 *     doc's content, no edge field and no root key — control: the same scan finds the content in the doc.
 */
import { afterEach, describe, test, expect } from "vitest";
import * as ed from "@noble/ed25519";
import WS, { type RawData } from "ws";
import { Repo, type AutomergeUrl } from "@automerge/automerge-repo";
import {
  hex, ed25519SignerFromSeed, dialSiblingHerm, siblingChannelTag, buildAuthResponse, mintLeafNonce, knockedUrl,
  isLarChallengeMsg, isLarAuthOkMsg, mkLarSessionMsg, MEMBERSHIP_RELAY_DOMAIN, SIBLING_JOIN_KIND, SIBLING_FRAME_KIND,
  SiblingNetworkAdapter, buildDeviceDelegation, provisionThresholdRecoveryAtFounding, guardianRecoveryRegistrationCard,
  type SiblingTransport, type SiblingRefusal,
} from "@lararium/mesh";
import { startAuthenticatedMembershipRelay, type AuthenticatedMembershipRelay } from "../src/authenticated-membership-relay.js";

const pubOf = (seed: Uint8Array) => ed.getPublicKeyAsync(seed).then(hex);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe("the herm's relay carries sibling frames by channel and proven key, and reads none", () => {
  let relay: AuthenticatedMembershipRelay | undefined;
  const open: SiblingTransport[] = [];
  afterEach(async () => { for (const t of open.splice(0)) t.close(); await relay?.close(); relay = undefined; });

  async function dial(seedByte: number, channel: string): Promise<{ key: string; t: SiblingTransport; heard: Array<{ from: string; frame: unknown }> }> {
    const seed = new Uint8Array(32).fill(seedByte);
    const key = await pubOf(seed);
    const t = await dialSiblingHerm({ address: `ws://127.0.0.1:${relay!.port}#${relay!.gatePubKey}`, deviceKey: key, sign: ed25519SignerFromSeed(seed), channel });
    open.push(t);
    const heard: Array<{ from: string; frame: unknown }> = [];
    t.onFrame((from, frame) => heard.push({ from, frame }));
    return { key, t, heard };
  }

  test("channel, address and stamp: each frame reaches exactly the keys it names, from the key the gate proved", async () => {
    const sight: Array<{ channel: string; from: string; to: string | null; frame: unknown }> = [];
    relay = await startAuthenticatedMembershipRelay(new Uint8Array(32).fill(70), 0, { onSiblingFrame: (c) => sight.push(c) });
    const c1 = siblingChannelTag("a1".repeat(32));
    const c2 = siblingChannelTag("b2".repeat(32));
    const a = await dial(71, c1);
    const b = await dial(72, c1);
    const e = await dial(73, c1);
    const d = await dial(74, c2);
    await sleep(50);                                                   // the joins land ahead of the frames

    a.t.send(null, { t: "here" });
    await sleep(100);
    // CONTROL: both other keys on c1 hear it, stamped with a's proven key.
    expect(b.heard).toEqual([{ from: a.key, frame: { t: "here" } }]);
    expect(e.heard).toEqual([{ from: a.key, frame: { t: "here" } }]);
    // RED: the key on c2 hears nothing; the sender hears nothing back.
    expect(d.heard).toEqual([]);
    expect(a.heard).toEqual([]);

    // RED: an addressed frame reaches only the key it names.
    a.t.send(b.key, { t: "seal", s: { n: "nn", c: "cc" } });
    await sleep(100);
    expect(b.heard.at(-1)).toEqual({ from: a.key, frame: { t: "seal", s: { n: "nn", c: "cc" } } });
    expect(e.heard).toHaveLength(1);
    expect(d.heard).toEqual([]);

    // The herm's sight holds the two frames it carried, as it carried them, on c1.
    expect(sight.map((c) => ({ channel: c.channel, from: c.from, to: c.to }))).toEqual([
      { channel: c1, from: a.key, to: null }, { channel: c1, from: a.key, to: b.key },
    ]);
  }, 15_000);

  /** A socket hand-driven through the one handshake, so a test can write any session body it likes. */
  async function rawProven(seedByte: number): Promise<{ key: string; raw: WS }> {
    const seed = new Uint8Array(32).fill(seedByte);
    const key = await pubOf(seed);
    const raw = new WS(knockedUrl(`ws://127.0.0.1:${relay!.port}`, relay!.gatePubKey));
    await new Promise<void>((resolve, reject) => {
      raw.on("error", reject);
      raw.on("message", (data: RawData) => {
        const frame = JSON.parse(data.toString()) as Record<string, unknown>;
        if (isLarChallengeMsg(frame)) void (async () => {
          raw.send(JSON.stringify(await buildAuthResponse({
            contactCard: key, nonce: frame.nonce, gatePubKey: relay!.gatePubKey, peerPubKey: key,
            aud: MEMBERSHIP_RELAY_DOMAIN, leafNonce: mintLeafNonce(), sign: ed25519SignerFromSeed(seed),
          })));
        })();
        else if (isLarAuthOkMsg(frame)) resolve();
      });
    });
    return { key, raw };
  }

  test("RED: a socket that joined no channel neither sends nor hears; a forged `from` never replaces the stamp", async () => {
    relay = await startAuthenticatedMembershipRelay(new Uint8Array(32).fill(80), 0);
    const c1 = siblingChannelTag("c3".repeat(32));
    const a = await dial(81, c1);
    const b = await dial(82, c1);
    const r = await rawProven(83);
    const rHeard: unknown[] = [];
    r.raw.on("message", (data: RawData) => rHeard.push(JSON.parse(data.toString())));
    try {
      await sleep(50);
      // Unjoined: its frame reaches no one, and a's frame to the channel never reaches it.
      r.raw.send(JSON.stringify(mkLarSessionMsg(SIBLING_FRAME_KIND, { to: null, frame: { t: "here" } })));
      a.t.send(null, { t: "here" });
      await sleep(100);
      expect(b.heard).toEqual([{ from: a.key, frame: { t: "here" } }]);
      expect(rHeard).toEqual([]);
      // Joined, it writes a's key as its own `from`: b hears the frame under r's PROVEN key.
      r.raw.send(JSON.stringify(mkLarSessionMsg(SIBLING_JOIN_KIND, { channel: c1 })));
      r.raw.send(JSON.stringify(mkLarSessionMsg(SIBLING_FRAME_KIND, { to: b.key, frame: { t: "here" }, from: a.key })));
      await sleep(100);
      expect(b.heard.at(-1)).toEqual({ from: r.key, frame: { t: "here" } });
      expect(b.heard.filter((h) => h.from === a.key)).toHaveLength(1);
    } finally { r.raw.close(); }

    // A bare WebSocket on the root draws no 101 — a stranger without the knock meets silence.
    const bare = await new Promise<boolean>((resolve) => {
      const raw = new WS(`ws://127.0.0.1:${relay!.port}/`);
      raw.on("open", () => { raw.close(); resolve(true); });
      raw.on("error", () => resolve(false));
      raw.on("unexpected-response", () => resolve(false));
    });
    expect(bare).toBe(false);
  }, 15_000);

  test("CARRY ⊥ READ: siblings sync a doc through the relay, and the relay's whole sight holds none of it", async () => {
    const sight: unknown[] = [];
    relay = await startAuthenticatedMembershipRelay(new Uint8Array(32).fill(90), 0, { onSiblingFrame: (c) => sight.push(c) });
    const root = new Uint8Array(32).fill(91);
    const guardianKeys = await Promise.all([92, 93, 94].map((b) => pubOf(new Uint8Array(32).fill(b))));
    const slots = ["mine", "guardian-a", "guardian-b"] as const;
    const kel = [provisionThresholdRecoveryAtFounding({
      foundingOpKeyDid: `0x${await pubOf(root)}`,
      guardians: guardianKeys.map((k, i) => guardianRecoveryRegistrationCard(slots[i]!, k, null)),
      recoveryThreshold: 2,
    }).inception];
    const channel = siblingChannelTag("d4".repeat(32));
    const leaves: Array<{ repo: Repo; refusals: SiblingRefusal[] }> = [];
    for (const b of [95, 96]) {
      const device = new Uint8Array(32).fill(b);
      const key = await pubOf(device);
      const sign = ed25519SignerFromSeed(device);
      const edge = await buildDeviceDelegation({ personaRootSeed: root, deviceVerifyingKey: key, hearthTrueName: "", boundEpoch: 0 });
      const refusals: SiblingRefusal[] = [];
      const adapter = new SiblingNetworkAdapter({
        self: { deviceKey: key, sign, edge, kel },
        transport: async () => { const t = await dialSiblingHerm({ address: `ws://127.0.0.1:${relay!.port}#${relay!.gatePubKey}`, deviceKey: key, sign, channel }); open.push(t); return t; },
        onRefusal: (r) => refusals.push(r),
      });
      leaves.push({ repo: new Repo({ network: [adapter], sharePolicy: async () => true }), refusals });
    }
    const [x, y] = leaves as [typeof leaves[0], typeof leaves[0]];
    try {
      for (let i = 0; i < 200 && (x.repo.peers.length === 0 || y.repo.peers.length === 0); i++) await sleep(20);
      const LINE = "the line two siblings share and the herm carries unread";
      const handle = x.repo.create<{ line: string }>({ line: LINE });
      const found = await y.repo.find<{ line: string }>(handle.url as AutomergeUrl);
      expect(found.doc()?.line).toBe(LINE);
      expect([...x.refusals, ...y.refusals]).toEqual([]);
      const wire = JSON.stringify(sight);
      expect(sight.length).toBeGreaterThan(4);                 // here · proof×3 · peer ids · sync, all carried
      for (const secret of ["two siblings share", "personaRootDid", "device-delegation", await pubOf(root)]) {
        expect(wire.includes(secret), `the herm read ${secret.slice(0, 16)}`).toBe(false);
      }
      expect(JSON.stringify(found.doc())).toContain("two siblings share");   // CONTROL on the instrument
    } finally {
      await x.repo.shutdown(); await y.repo.shutdown();
    }
  }, 20_000);
});
