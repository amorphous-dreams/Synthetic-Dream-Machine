/**
 * sibling-herm-relay.test — the herm's relay CARRIES sibling frames over real sockets: it routes on the channel
 * tags a leaf joined and the key the one gate proved for it, and it reads no frame.
 *
 * Proven over real sockets, each red beside its control:
 *   · CONTROL: a frame to the whole channel reaches every other key joined on it, stamped with the sender's
 *     PROVEN key;
 *   · RED: a key joined on ANOTHER channel hears nothing of it; CONTROL: a key joined on both hears it once;
 *   · RED: a frame addressed to one key reaches no other key on the channel;
 *   · RED: a socket that joined no channel neither sends nor hears;
 *   · RED: a later join REPLACES a socket's channels — it hears its new channel alone, and an empty join leaves all;
 *   · the drop floor: a plain request apart from every proven socket reads and keeps a KEL successor that verifies
 *     against the predecessor its deposit carries; an unknown name, a refused deposit and any other path meet one
 *     silence — a cut socket;
 *   · RED: a `from` the sender writes into its own frame never replaces the stamp;
 *   · the herm's sight (`onSiblingFrame`) holds exactly the frames it carried;
 *   · CARRY ⊥ READ, read DECODED: two enrolled sibling leaves sync a doc through the relay, and its whole sight —
 *     every frame's base64url, hex and nested JSON — holds no byte of the doc's content, no edge field and no
 *     root key; control: the same instrument finds a line hidden beside a seal.
 */
import { afterEach, describe, test, expect } from "vitest";
import * as ed from "@noble/ed25519";
import WS, { type RawData } from "ws";
import { Repo, type AutomergeUrl } from "@automerge/automerge-repo";
import {
  hex, ed25519SignerFromSeed, dialSiblingHerm, siblingChannelTag, buildAuthResponse, mintLeafNonce, knockedUrl,
  isLarChallengeMsg, isLarAuthOkMsg, mkLarSessionMsg, MEMBERSHIP_RELAY_DOMAIN, SIBLING_JOIN_KIND, SIBLING_FRAME_KIND,
  SiblingNetworkAdapter, enrolDevice, leafStandingUnder, groupSecretOpenerFromSeed, base64UrlEncode,
  provisionThresholdRecoveryAtFounding, guardianRecoveryRegistrationCard, attestAndRotate,
  personaKelDropName, httpPersonaKelDropHerm, pullPersonaKelSuccessors,
  type SiblingTransport, type SiblingRefusal,
} from "@lararium/mesh";
import { startAuthenticatedMembershipRelay, type AuthenticatedMembershipRelay } from "../src/authenticated-membership-relay.js";
import { carriedReads } from "../../lararium-mesh/tests/fixtures/sibling-fleet.js";

const SECRET_1 = new Uint8Array(32).fill(0xa1);
const SECRET_2 = new Uint8Array(32).fill(0xb2);

const pubOf = (seed: Uint8Array) => ed.getPublicKeyAsync(seed).then(hex);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Poll `cond` until it is true, or REFUSE — naming what it waited for — once `budgetMs` elapses. A
 *  capped loop that falls through silently when its budget runs out reads as whatever the test does
 *  next; this throws instead, so an exhausted wait reads as the failure it is. */
async function waitFor(cond: () => boolean, why: string, budgetMs = 5_000, stepMs = 10): Promise<void> {
  const deadline = Date.now() + budgetMs;
  while (!cond()) {
    if (Date.now() >= deadline) throw new Error(`waitFor timed out after ${budgetMs}ms: ${why}`);
    await sleep(stepMs);
  }
}

/** Settle a group's joins by proof, never by a guessed duration: each transport sends one tagged
 *  broadcast probe over the SAME connection its join rode, so the relay can only carry the probe
 *  under `channelsOf.get(socket)` AFTER that socket's own join has landed (`routeSibling` returns
 *  before `onSiblingFrame` fires when no join is on record yet) — true even for a transport alone on
 *  its channel, since the relay's sight fires unconditionally, with or without another peer sharing it.
 *  `dial`'s `onFrame` filters the tag out of `heard`, so it never pollutes a test's real assertions. */
async function settleJoins(sight: readonly { readonly frame: unknown }[], group: ReadonlyArray<{ readonly t: SiblingTransport }>): Promise<void> {
  const tag = `__settle_${Math.random().toString(36).slice(2)}__`;
  const before = sight.length;
  for (const { t } of group) t.send(null, { __settle: tag });
  await waitFor(
    () => sight.slice(before).filter((c) => (c.frame as { __settle?: unknown } | null)?.__settle === tag).length >= group.length,
    `every one of ${group.length} join(s) to settle at the relay`,
  );
}

describe("the herm's relay carries sibling frames by channel and proven key, and reads none", () => {
  let relay: AuthenticatedMembershipRelay | undefined;
  const open: SiblingTransport[] = [];
  afterEach(async () => { for (const t of open.splice(0)) t.close(); await relay?.close(); relay = undefined; });

  async function dial(seedByte: number, secrets: readonly Uint8Array[]): Promise<{ key: string; t: SiblingTransport; heard: Array<{ from: string; frame: unknown }> }> {
    const seed = new Uint8Array(32).fill(seedByte);
    const key = await pubOf(seed);
    const t = await dialSiblingHerm({ address: `ws://127.0.0.1:${relay!.port}#${relay!.gatePubKey}`, deviceKey: key, sign: ed25519SignerFromSeed(seed) });
    t.join(secrets);
    open.push(t);
    const heard: Array<{ from: string; frame: unknown }> = [];
    t.onFrame((from, frame) => {
      if ((frame as { __settle?: unknown } | null)?.__settle !== undefined) return;   // a settlement probe, not a test frame
      heard.push({ from, frame });
    });
    return { key, t, heard };
  }

  test("channel, address and stamp: each frame reaches exactly the keys it names, from the key the gate proved", async () => {
    const sight: Array<{ channels: readonly string[]; from: string; to: string | null; frame: unknown }> = [];
    relay = await startAuthenticatedMembershipRelay(new Uint8Array(32).fill(70), 0, { onSiblingFrame: (c) => sight.push(c) });
    const c1 = siblingChannelTag(SECRET_1, relay.gatePubKey);
    const a = await dial(71, [SECRET_1]);
    const b = await dial(72, [SECRET_1]);
    const e = await dial(73, [SECRET_1, SECRET_2]);                   // a leaf holding two secrets joins both channels
    const d = await dial(74, [SECRET_2]);
    await settleJoins(sight, [a, b, e, d]);                            // the joins have landed, by proof, not a guess
    const sightFrom = sight.length;

    a.t.send(null, { t: "here" });
    await waitFor(() => b.heard.length >= 1 && e.heard.length >= 1, "b and e to hear a's broadcast on c1");
    // CONTROL: both other keys on c1 hear it once, stamped with a's proven key — e although it joined two.
    expect(b.heard).toEqual([{ from: a.key, frame: { t: "here" } }]);
    expect(e.heard).toEqual([{ from: a.key, frame: { t: "here" } }]);
    // RED: the key on c2 alone hears nothing; the sender hears nothing back.
    expect(d.heard).toEqual([]);
    expect(a.heard).toEqual([]);

    // RED: an addressed frame reaches only the key it names.
    a.t.send(b.key, { t: "seal", s: { n: "nn", c: "cc" } });
    await waitFor(() => b.heard.length >= 2, "b to hear a's addressed frame");
    expect(b.heard.at(-1)).toEqual({ from: a.key, frame: { t: "seal", s: { n: "nn", c: "cc" } } });
    expect(e.heard).toHaveLength(1);
    expect(d.heard).toEqual([]);

    // CONTROL: d meets e on the channel they share, and no one else.
    d.t.send(null, { t: "here" });
    await waitFor(() => e.heard.length >= 2, "e to hear d's broadcast on c2");
    expect(e.heard.at(-1)).toEqual({ from: d.key, frame: { t: "here" } });
    expect(b.heard).toHaveLength(2);

    // The herm's sight holds the frames it carried, as it carried them, under the sender's channels —
    // sliced past the settlement probes, which carried no test frame.
    expect(sight.slice(sightFrom).map((c) => ({ channels: c.channels, from: c.from, to: c.to }))).toEqual([
      { channels: [c1], from: a.key, to: null }, { channels: [c1], from: a.key, to: b.key },
      { channels: [siblingChannelTag(SECRET_2, relay.gatePubKey)], from: d.key, to: null },
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
    const sight: Array<{ readonly frame: unknown }> = [];
    relay = await startAuthenticatedMembershipRelay(new Uint8Array(32).fill(80), 0, { onSiblingFrame: (c) => sight.push(c) });
    const c1 = siblingChannelTag(SECRET_1, relay.gatePubKey);
    const a = await dial(81, [SECRET_1]);
    const b = await dial(82, [SECRET_1]);
    const r = await rawProven(83);
    const rHeard: unknown[] = [];
    r.raw.on("message", (data: RawData) => rHeard.push(JSON.parse(data.toString())));
    try {
      await settleJoins(sight, [a, b]);
      // Unjoined: its frame reaches no one, and a's frame to the channel never reaches it.
      r.raw.send(JSON.stringify(mkLarSessionMsg(SIBLING_FRAME_KIND, { to: null, frame: { t: "here" } })));
      const bBefore = b.heard.length;
      a.t.send(null, { t: "here" });
      await waitFor(() => b.heard.length > bBefore, "b to hear a's broadcast");
      expect(b.heard).toEqual([{ from: a.key, frame: { t: "here" } }]);
      expect(rHeard).toEqual([]);
      // Joined, it writes a's key as its own `from`: b hears the frame under r's PROVEN key. Both
      // session messages ride the SAME connection as the join, so they land in that order without a wait.
      r.raw.send(JSON.stringify(mkLarSessionMsg(SIBLING_JOIN_KIND, { channels: [c1] })));
      r.raw.send(JSON.stringify(mkLarSessionMsg(SIBLING_FRAME_KIND, { to: b.key, frame: { t: "here" }, from: a.key })));
      await waitFor(() => b.heard.length > bBefore + 1, "b to hear r's addressed frame under its proven key");
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

  test("RED: a later join REPLACES a socket's channels — it hears its new channel alone; an empty join leaves every channel", async () => {
    const sight: Array<{ readonly frame: unknown }> = [];
    relay = await startAuthenticatedMembershipRelay(new Uint8Array(32).fill(84), 0, { onSiblingFrame: (c) => sight.push(c) });
    const a = await dial(85, [SECRET_1]);
    const b = await dial(86, [SECRET_2]);
    const moving = await dial(87, [SECRET_1]);
    await settleJoins(sight, [a, b, moving]);
    a.t.send(null, { t: "here" });
    await waitFor(() => moving.heard.length >= 1, "moving to hear a's broadcast on c1");
    expect(moving.heard).toEqual([{ from: a.key, frame: { t: "here" } }]);   // CONTROL: on c1, it hears c1

    moving.t.join([SECRET_2]);
    await settleJoins(sight, [moving]);                                     // the REPLACED join, settled by proof
    a.t.send(null, { t: "here" });
    b.t.send(null, { t: "here" });
    await waitFor(() => moving.heard.length >= 2, "moving to hear b's broadcast on its new channel c2");
    // It left c1 in the same act it joined c2: a's second word never reaches it, b's does.
    expect(moving.heard).toEqual([{ from: a.key, frame: { t: "here" } }, { from: b.key, frame: { t: "here" } }]);

    moving.t.join([]);
    // moving now owns no channel, so — unlike every other transition in this suite — there is no
    // positive signal left for it to produce: a channel-less socket's own frame never reaches
    // `onSiblingFrame` (`routeSibling` returns before it fires), so `settleJoins` cannot prove THIS
    // one landed. A short, named settle is the one honest exception; it is bounded so a relay too
    // slow to clear it in time fails loud (via the `toHaveLength` below), never silently.
    await sleep(250);
    a.t.send(null, { t: "here" });
    b.t.send(null, { t: "here" });
    moving.t.send(null, { t: "here" });                                 // expected to land nowhere
    // Fence on what IS provable: a's and b's own sends, issued in this same tick, have each settled at
    // the relay (their post-leave-attempt frames rode the SAME connections, so this bounds the wait by
    // the live relay's actual pace under load rather than a guessed duration).
    await settleJoins(sight, [a, b]);
    expect(moving.heard).toHaveLength(2);
    expect(b.heard.filter((h) => h.from === moving.key)).toEqual([]);
  }, 15_000);

  test("the drop floor: a plain request reads and keeps a KEL successor; every other ask meets one silence", async () => {
    relay = await startAuthenticatedMembershipRelay(new Uint8Array(32).fill(88), 0);
    const base = `http://127.0.0.1:${relay.port}`;
    const guardianSeeds = [61, 62, 63].map((b) => new Uint8Array(32).fill(b));
    const guardianRecoveryKeys = await Promise.all(guardianSeeds.map(pubOf));
    const slots = ["mine", "guardian-a", "guardian-b"] as const;
    const prov = provisionThresholdRecoveryAtFounding({
      foundingOpKeyDid: `0x${await pubOf(new Uint8Array(32).fill(51))}`,
      guardians: guardianRecoveryKeys.map((k, i) => guardianRecoveryRegistrationCard(slots[i]!, k, null)),
      recoveryThreshold: 2,
    });
    const rot = await attestAndRotate({
      head: prov.inception, freshOpKeyDid: `0x${await pubOf(new Uint8Array(32).fill(52))}`, guardianRecoveryKeys, recoveryThreshold: 2,
      guardianSigners: await Promise.all(guardianSeeds.slice(0, 2).map(async (s) => ({ signer: await pubOf(s), sign: async (b: Uint8Array) => hex(await ed.signAsync(b, s)) }))),
    });
    if (!rot.ok) throw new Error(rot.reason);
    const name = personaKelDropName(prov.inception.eventCid, relay.gatePubKey);
    /** One request's whole answer: its status, or "silence" when the herm cut the socket. */
    const ask = (path: string, init?: RequestInit) => fetch(`${base}${path}`, init).then(async (r) => ({ status: r.status, body: await r.text(), cors: r.headers.get("access-control-allow-origin") }), () => "silence" as const);
    // An unknown name, another path, a junk deposit and a deposit under the wrong name: one silence each.
    expect(await ask(`/drop/${name}`)).toBe("silence");
    expect(await ask(`/drop/${"0".repeat(64)}`)).toBe("silence");
    expect(await ask("/.well-known/lar")).toBe("silence");
    expect(await ask(`/drop/${name}`, { method: "POST", body: "junk" })).toBe("silence");
    const deposit = JSON.stringify({ prev: prov.inception, event: rot.event });
    expect(await ask(`/drop/${"0".repeat(64)}`, { method: "POST", body: deposit })).toBe("silence");
    expect(await ask(`/drop/${name}`, { method: "POST", body: JSON.stringify(rot.event) }), "a successor with no predecessor").toBe("silence");
    // The lawful deposit keeps, CORS open, and the read answers it.
    expect(await ask(`/drop/${name}`, { method: "POST", headers: { "content-type": "text/plain" }, body: deposit })).toMatchObject({ status: 204, cors: "*" });
    const read = await ask(`/drop/${name}`);
    expect(read).toMatchObject({ status: 200, cors: "*" });
    expect((JSON.parse((read as { body: string }).body) as Array<{ eventCid: string }>).map((e) => e.eventCid)).toEqual([rot.event.eventCid]);
    // A leaf reaches it through its pinned address, and its reader extends the chain.
    const herm = httpPersonaKelDropHerm(`ws://127.0.0.1:${relay.port}#${relay.gatePubKey}`);
    const pulled = await pullPersonaKelSuccessors([prov.inception], [herm]);
    expect(pulled.kel.map((e) => e.eventCid)).toEqual([prov.inception.eventCid, rot.event.eventCid]);
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
    const leaves: Array<{ repo: Repo; refusals: SiblingRefusal[] }> = [];
    for (const b of [95, 96]) {
      const device = new Uint8Array(32).fill(b);
      const key = await pubOf(device);
      const sign = ed25519SignerFromSeed(device);
      const enrolment = await enrolDevice({ opSeed: root, prefix: kel[0]!.prefix, deviceVerifyingKey: key, hearthTrueName: "", boundEpoch: 0 });
      const refusals: SiblingRefusal[] = [];
      const adapter = new SiblingNetworkAdapter({
        kel,
        leaf: async (k) => ({ deviceKey: key, sign, kel: k, standing: await leafStandingUnder({ kel: k, deviceKey: key, enrolment, open: groupSecretOpenerFromSeed(device) }) }),
        transports: [async () => { const t = await dialSiblingHerm({ address: `ws://127.0.0.1:${relay!.port}#${relay!.gatePubKey}`, deviceKey: key, sign }); open.push(t); return t; }],
        onRefusal: (r) => refusals.push(r),
      });
      leaves.push({ repo: new Repo({ network: [adapter], sharePolicy: async () => true }), refusals });
    }
    const [x, y] = leaves as [typeof leaves[0], typeof leaves[0]];
    try {
      await waitFor(() => x.repo.peers.length > 0 && y.repo.peers.length > 0, "both repos to see a peer", 10_000, 20);
      const LINE = "the line two siblings share and the herm carries unread";
      const handle = x.repo.create<{ line: string }>({ line: LINE });
      const found = await y.repo.find<{ line: string }>(handle.url as AutomergeUrl);
      expect(found.doc()?.line).toBe(LINE);
      expect([...x.refusals, ...y.refusals]).toEqual([]);
      const carried = sight.map((c) => JSON.stringify(c));
      expect(sight.length).toBeGreaterThan(4);                 // here · proof×3 · peer ids · sync, all carried
      for (const secret of ["two siblings share", "personaRootDid", "device-delegation", await pubOf(root)]) {
        expect(carriedReads(carried, secret), `the herm read ${secret.slice(0, 16)}`).toBe(false);
      }
      // CONTROL on the instrument: a line hidden in base64url beside a seal, as the herm would carry it, is found.
      const hidden = JSON.stringify({ channels: [], from: "00", to: null, frame: { t: "seal", s: { n: "AAAA", c: "BBBB", p: base64UrlEncode(new TextEncoder().encode(LINE)) } } });
      expect(carriedReads([hidden], "two siblings share")).toBe(true);
    } finally {
      await x.repo.shutdown(); await y.repo.shutdown();
    }
  }, 20_000);
});
