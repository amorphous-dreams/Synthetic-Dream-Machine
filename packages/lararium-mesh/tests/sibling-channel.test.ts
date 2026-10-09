/**
 * sibling-channel.test — leaves of one PersonaGroup sync an Automerge doc through a relay that carries sealed
 * frames and reads none, and every divergence the relay or an impostor brings surfaces as a refusal naming its
 * suspect.
 *
 * The relay here stands in memory, so a test can make it hostile; the live herm's relay (node, real sockets)
 * carries the same frames in `authenticated-membership-relay` and the e2e `leaf-sibling-sync`.
 *
 * Proven, each red beside its control:
 *   · CONTROL: two enrolled sibling leaves, no listening vessel, sync a doc; each names the other's device key;
 *   · carry ⊥ read, read DECODED: no byte of the doc, no edge field, no root key crosses in any frame's base64url,
 *     hex or nested JSON — and the instrument's own positive control finds a line hidden that way;
 *   · carry ⊥ read past Automerge's deflate: the instrument decodes sync messages, changes and documents, so a
 *     long line leaked in the clear reads RED, and the channel carries a long line with nothing of it readable;
 *   · RED: the channel tag needs the secret — a non-member holding the group id alone computes another;
 *   · RED: a forged hello (the herm, or any non-member) draws no box at all, and no box opens for its forger;
 *   · RED: an impostor holding a leaked secret but an edge a stranger root signed becomes no peer, said as `peer`;
 *   · RED: an edge bound below the lease epoch the leaf holds is refused as lapsed;
 *   · RED: a frame the relay INJECTS refuses the session on BOTH sides, said as `relay`, never blaming the
 *     sibling — and the pair proves again and syncs;
 *   · RED: a REPLAYED frame refuses the same way;
 *   · RED: a forged `here` against a standing session surfaces, never tearing down in silence;
 *   · RED: a frame stamped with the leaf's own key surfaces, never dropping in silence;
 *   · RED: the last leaf to wake catches up from a drop, with no sibling online, and the pair stands;
 *   · RED: a leaf the rotation left out finds no seal addressed to it, stands revoked and says so; re-enrolled by
 *     a later rotation, the device catches up when it wakes and stands again;
 *   · RED: a revoked leaf alone, on its old channel through an honest herm, sees no sibling at all;
 *   · RED: a KEL head that moves past a standing sibling's edge closes the session inside it and the pair proves
 *     again — a re-enrolled sibling stands with no refusal, a left-out one stands revoked and says so;
 *   · RED: the leaf whose KEL moved deposits the move BEFORE it closes a session, so the sibling that hears the
 *     close finds it waiting;
 *   · RED: a herm that withholds a drop is tolerated through a second herm; a herm that strips or swaps a
 *     successor is refused by the reader, said as `relay`;
 *   · RED: a withheld veto of a provisional rotation never reads the leaf as revoked: it stands under the head;
 *   · RED: a leaf its own KEL revokes says goodbye inside each session, so no sibling stays half-open;
 *   · RED: a junk, stripped or forged event revokes no one: the leaf names the KEL `unreadable` and keeps (or
 *     stands under) the standing a verified KEL gives it; a leaf holding no seal stands `unsealed`.
 */
import { describe, test, expect } from "vitest";
import { hmac } from "@noble/hashes/hmac.js";
import { sha256 } from "@noble/hashes/sha2.js";
import * as A from "@automerge/automerge";
import { cbor, type AutomergeUrl, type DocHandle } from "@automerge/automerge-repo";
import { base64UrlEncode, hex, hexToBytes } from "../src/crypto.js";
import { SIBLING_CHANNEL_INFO, LEAF_PEER_SEAL_INFO } from "../src/domains.js";
import { openFromSender } from "../src/sealed-box.js";
import { personaGroupSecret } from "../src/persona-group-secret.js";
import { startLeafPeerProof } from "../src/leaf-peer-proof.js";
import { SiblingNetworkAdapter, siblingChannelTag, siblingKelDropsOf, type SiblingRefusal } from "../src/sibling-channel.js";
import { personaKelDropName } from "../src/persona-kel-drop.js";
import {
  SEEDS, pubOf, didOf, founded, enrol, rotatedKeeping, rotatedTwice, provisionalKeeping, leafOf, memoryRelay, memoryDropHerm,
  standLeaf, until, sleep, peersOf, shutdown, carriedReads, type Leaf,
} from "./fixtures/sibling-fleet.js";

const copy = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

const CONTENT = "the sealed sibling channel carries this line and the relay reads none of it";

async function syncOne(a: Leaf, b: Leaf, line = CONTENT): Promise<DocHandle<{ line: string }>> {
  const handle = a.repo.create<{ line: string }>({ line });
  return b.repo.find<{ line: string }>(handle.url as AutomergeUrl);
}

/** Two enrolled siblings of the founded group, standing as each other's peer. */
async function pair() {
  const { inception } = await founded();
  const relay = memoryRelay();
  const ex = await enrol(SEEDS.opA, SEEDS.deviceX, inception.prefix);
  const ey = await enrol(SEEDS.opA, SEEDS.deviceY, inception.prefix);
  const x = standLeaf(SEEDS.deviceX, ex, await leafOf(SEEDS.deviceX, ex, [inception]), relay);
  const y = standLeaf(SEEDS.deviceY, ey, await leafOf(SEEDS.deviceY, ey, [inception]), relay);
  await until(() => peersOf(x).length === 1 && peersOf(y).length === 1, "both siblings to stand as peers");
  return { relay, x, y, inception, ex, ey };
}

describe("sibling channel — leaves of one PersonaGroup sync through a relay that reads nothing", () => {
  test("RED: the channel tag needs the PersonaGroup secret — the group id alone computes another tag", async () => {
    const { inception } = await founded();
    const secret = personaGroupSecret(SEEDS.opA, inception.prefix);
    const gate = "ab".repeat(32);
    const tag = siblingChannelTag(secret, gate);
    expect(tag).toMatch(/^[0-9a-f]{64}$/);
    // What a non-member holding the group's id can compute: the HMAC of that id under the public name.
    const group = "5e".repeat(32);
    const fromIdAlone = hex(hmac(sha256, new TextEncoder().encode(SIBLING_CHANNEL_INFO), new TextEncoder().encode(group)));
    expect(tag).not.toBe(fromIdAlone);
    // Two herms see two tags; two secrets key two channels.
    expect(siblingChannelTag(secret, "cd".repeat(32))).not.toBe(tag);
    expect(siblingChannelTag(personaGroupSecret(SEEDS.opB, inception.prefix), gate)).not.toBe(tag);
  });

  test("CONTROL: two enrolled siblings with no listening vessel sync a doc, each proving the other's device key", async () => {
    const { relay, x, y } = await pair();
    try {
      expect(x.adapter.provenKeyOf(peersOf(x)[0]!)).toBe(y.self.deviceKey);
      expect(y.adapter.provenKeyOf(peersOf(y)[0]!)).toBe(x.self.deviceKey);
      const found = await syncOne(x, y);
      expect(found.doc()?.line).toBe(CONTENT);
      expect([...x.refusals, ...y.refusals]).toEqual([]);
      expect(relay.sealedFrom.length).toBeGreaterThan(1);
    } finally { await shutdown(x, y); }
  });

  test("carry ⊥ read, DECODED: no frame carries the doc, an edge field or the root key in any encoding", async () => {
    const { relay, x, y } = await pair();
    try {
      const found = await syncOne(x, y);
      expect(found.doc()?.line).toBe(CONTENT);
      for (const secret of ["sealed sibling channel", "personaRootDid", "device-delegation", (await didOf(SEEDS.opA)).slice(2)]) {
        expect(carriedReads(relay.carried, secret), `the relay read ${secret.slice(0, 16)}`).toBe(false);
      }
      // CONTROL on the instrument: a line hidden in base64url beside a seal, and in hex inside a box, is found.
      const beside = JSON.stringify({ t: "seal", s: { n: "AAAA", c: "BBBB", p: base64UrlEncode(new TextEncoder().encode(`x${CONTENT}y`)) } });
      const inBox = JSON.stringify({ t: "proof", p: { step: "finish", box: { e: "00".repeat(32), n: "11", c: hex(new TextEncoder().encode(JSON.stringify({ personaRootDid: "0x" }))) } } });
      expect(carriedReads([beside], "sealed sibling channel")).toBe(true);
      expect(carriedReads([inBox], "personaRootDid")).toBe(true);
    } finally { await shutdown(x, y); }
  });

  test("carry ⊥ read past Automerge's deflate: the instrument finds a long line leaked as a sync message, and the channel carries none", async () => {
    const LONG = `${CONTENT} ${"lorem ipsum dolor sit amet ".repeat(40)}`;
    // POSITIVE CONTROL: a real Automerge sync exchange leaked in the clear beside a seal — short and deflated-long.
    for (const line of [CONTENT, LONG]) {
      let a = A.from({ line }); let b = A.init<{ line: string }>();
      let sa = A.initSyncState(); let sb = A.initSyncState();
      const frames: string[] = [];
      for (let i = 0; i < 6; i++) {
        let m: Uint8Array | null;
        [sa, m] = A.generateSyncMessage(a, sa);
        if (m) {
          const body = cbor.encode({ t: "msg", m: { type: "sync", senderId: "a", targetId: "b", documentId: "d", data: m } });
          frames.push(JSON.stringify({ t: "seal", s: { n: "AAAA", c: base64UrlEncode(body) } }));
          [b, sb] = A.receiveSyncMessage(b, sb, m);
        }
        let n: Uint8Array | null;
        [sb, n] = A.generateSyncMessage(b, sb);
        if (n) [a, sa] = A.receiveSyncMessage(a, sa, n);
      }
      expect(b.line).toBe(line);
      expect(carriedReads(frames, "sealed sibling channel"), `a ${line.length}-char line leaked beside the seal`).toBe(true);
      // A whole document leaked as bytes reads too.
      expect(carriedReads([JSON.stringify({ c: base64UrlEncode(A.save(a)) })], "sealed sibling channel")).toBe(true);
    }
    // The channel itself carries the long line sealed: nothing of it in any decoding.
    const { relay, x, y } = await pair();
    try {
      const found = await syncOne(x, y, LONG);
      expect(found.doc()?.line).toBe(LONG);
      expect(carriedReads(relay.carried, "sealed sibling channel")).toBe(false);
      expect(carriedReads(relay.carried, "lorem ipsum dolor")).toBe(false);
    } finally { await shutdown(x, y); }
  });

  test("RED: a forged hello — from the herm or any non-member — draws no box, and nothing opens for its forger", async () => {
    const { relay, x, y, inception } = await pair();
    try {
      // The forger holds no secret, so it can only guess a hint. It also tries the one key it might hold: the
      // group's own public facts.
      const { frame: hello, state } = startLeafPeerProof({ secret: { opKeyDid: "0x00", secret: new Uint8Array(32).fill(7) } });
      const before = relay.log.length;
      const sentBefore = relay.sent.length;
      relay.inject("00".repeat(32), x.self.deviceKey, { t: "proof", p: hello });
      await sleep(300);
      const toForger = relay.log.slice(before).filter((f) => f.to === "00".repeat(32));
      const boxes = toForger.filter((f) => f.frame.t === "proof" && "box" in f.frame.p);
      expect(boxes, "x sealed nothing to a forger").toEqual([]);
      // x answers a hello it cannot match with nothing at all, and says so: no hello back, no `here`.
      expect(relay.sent.slice(sentBefore).filter((f) => f.to === "00".repeat(32)), "x sent the forger nothing").toEqual([]);
      expect(x.refusals).toEqual([expect.objectContaining({ suspect: "peer", peerKey: "00".repeat(32), reason: expect.stringMatching(/stands under/) })]);
      // Whatever x answered with, nothing opens under the forger's ephemeral key without the secret.
      for (const f of toForger) {
        if (f.frame.t !== "proof" || !("box" in f.frame.p)) continue;
        const box = (f.frame.p as { box: { e: string; n: string; c: string } }).box;
        expect(openFromSender({ recipientSecret: state.ephSecret, senderEphemeralPub: hexToBytes(box.e), aeadNonce: hexToBytes(box.n),
          ciphertext: hexToBytes(box.c), info: new TextEncoder().encode(LEAF_PEER_SEAL_INFO), extraSalt: [hexToBytes(hello.nonce)] })).toBeNull();
      }
      void inception;
    } finally { await shutdown(x, y); }
  });

  test("RED: an impostor holding a leaked secret but a stranger-signed edge becomes no peer, said as `peer`", async () => {
    const { inception } = await founded();
    const relay = memoryRelay();
    const ex = await enrol(SEEDS.opA, SEEDS.deviceX, inception.prefix);
    const leaked = await enrol(SEEDS.opA, SEEDS.deviceZ, inception.prefix);          // the secret, sealed to Z
    const stranger = await enrol(SEEDS.stranger, SEEDS.deviceZ, inception.prefix);   // an edge no member root signed
    const x = standLeaf(SEEDS.deviceX, ex, await leafOf(SEEDS.deviceX, ex, [inception]), relay);
    const z = standLeaf(SEEDS.deviceZ, leaked, await leafOf(SEEDS.deviceZ, leaked, [inception]), relay, { presents: stranger.edge });
    try {
      await until(() => x.refusals.length > 0, "the impostor's refusal");
      expect(x.refusals[0]).toMatchObject({ suspect: "peer", peerKey: z.self.deviceKey, reason: expect.stringMatching(/not licensed by this PersonaGroup's KEL head/) });
      expect(peersOf(x)).toEqual([]);
    } finally { await shutdown(x, z); }
  });

  test("RED: an edge bound below the lease epoch the leaf holds is refused as lapsed; CONTROL at the held epoch it stands", async () => {
    const { inception } = await founded();
    const relay = memoryRelay();
    const ex = await enrol(SEEDS.opA, SEEDS.deviceX, inception.prefix, 1);
    const lapsed = await enrol(SEEDS.opA, SEEDS.deviceY, inception.prefix, 0);
    const x = standLeaf(SEEDS.deviceX, ex, await leafOf(SEEDS.deviceX, ex, [inception], 1), relay);
    const y = standLeaf(SEEDS.deviceY, lapsed, await leafOf(SEEDS.deviceY, lapsed, [inception], 0), relay);
    try {
      await until(() => x.refusals.length > 0, "the lapsed lease's refusal");
      expect(x.refusals[0]).toMatchObject({ suspect: "peer", peerKey: y.self.deviceKey, reason: expect.stringMatching(/lease stale/) });
      expect(peersOf(x)).toEqual([]);
    } finally { await shutdown(x, y); }
    // CONTROL: the same lapsed edge stands beside a verifier that holds the epoch it was bound at.
    const relay2 = memoryRelay();
    const x2 = standLeaf(SEEDS.deviceX, ex, await leafOf(SEEDS.deviceX, ex, [inception], 0), relay2);
    const y2 = standLeaf(SEEDS.deviceY, lapsed, await leafOf(SEEDS.deviceY, lapsed, [inception], 0), relay2);
    try {
      await until(() => peersOf(x2).length === 1 && peersOf(y2).length === 1, "the pair at the held epoch");
    } finally { await shutdown(x2, y2); }
  });

  test("RED: an INJECTED frame closes the session on BOTH sides, names the relay, and the pair proves again", async () => {
    const { relay, x, y } = await pair();
    try {
      relay.inject(y.self.deviceKey, x.self.deviceKey, { t: "seal", s: { n: "A".repeat(32), c: "B".repeat(64) } });
      await until(() => x.refusals.length > 0 && y.refusals.length > 0, "both halves to close");
      expect(x.refusals[0]).toMatchObject({ suspect: "relay", session: y.self.deviceKey, reason: expect.stringMatching(/never sealed/) });
      expect(y.refusals[0]).toMatchObject({ suspect: "relay", session: x.self.deviceKey });
      for (const r of [...x.refusals, ...y.refusals]) expect(r.suspect, "no refusal blames a sibling").toBe("relay");
      // The pair re-proves and the next doc crosses.
      await until(() => peersOf(x).length === 1 && peersOf(y).length === 1, "the pair to stand again");
      const found = await syncOne(y, x, "after the injection");
      expect(found.doc()?.line).toBe("after the injection");
    } finally { await shutdown(x, y); }
  });

  test("RED: a REPLAYED frame refuses the session the same way", async () => {
    const { relay, x, y } = await pair();
    try {
      const earlier = relay.sealedFrom.find((f) => f.from === y.self.deviceKey && f.to === x.self.deviceKey);
      expect(earlier, "the relay carried a sealed frame from y to x").toBeDefined();
      relay.inject(y.self.deviceKey, x.self.deviceKey, earlier!.frame);
      await until(() => x.refusals.length > 0, "the replay's refusal");
      expect(x.refusals[0]).toMatchObject({ suspect: "relay", reason: expect.stringMatching(/injected, replayed or reordered/) });
    } finally { await shutdown(x, y); }
  });

  test("RED: a forged `here` against a standing session surfaces as `relay`, and the pair proves again", async () => {
    const { relay, x, y } = await pair();
    try {
      relay.inject(y.self.deviceKey, x.self.deviceKey, { t: "here" });
      await until(() => x.refusals.length > 0, "the forged here's refusal");
      expect(x.refusals[0]).toMatchObject({ suspect: "relay", session: y.self.deviceKey, reason: expect.stringMatching(/here arrived for a standing session/) });
      await until(() => peersOf(x).length === 1 && peersOf(y).length === 1, "the pair to stand again");
    } finally { await shutdown(x, y); }
  });

  test("RED: a frame stamped with the leaf's own key surfaces as `relay`", async () => {
    const { relay, x, y } = await pair();
    try {
      const own = relay.sealedFrom.find((f) => f.from === x.self.deviceKey)!;
      relay.inject(x.self.deviceKey, x.self.deviceKey, own.frame);
      await until(() => x.refusals.length > 0, "the reflection's refusal");
      expect(x.refusals[0]).toMatchObject({ suspect: "relay", session: null, reason: expect.stringMatching(/own key/) });
      expect(peersOf(x).length, "the reflection disturbs no standing session").toBe(1);
    } finally { await shutdown(x, y); }
  });

  /** Wait until the relay's drops hold `cid` under its predecessor's name at both herms. */
  async function deposited(relay: ReturnType<typeof memoryRelay>, event: { eventCid: string; prevEventCid: string | null }): Promise<void> {
    await until(() => relay.stores.every((st) => st.pull(personaKelDropName(event.prevEventCid!, st.gatePubKey)).some((e) => e.eventCid === event.eventCid)), "the move deposited at both herms");
  }

  test("RED: the last leaf to wake catches up from a drop — no sibling online — and the pair stands under the head", async () => {
    const { inception } = await founded();
    const chain = await rotatedKeeping([SEEDS.deviceX, SEEDS.deviceY]);
    const relay = memoryRelay();
    const ex = await enrol(SEEDS.opA, SEEDS.deviceX, inception.prefix);
    const ey = await enrol(SEEDS.opA, SEEDS.deviceY, inception.prefix);
    // x rotated and deposited, then went offline: no sibling holds a session when y wakes.
    const x = standLeaf(SEEDS.deviceX, ex, await leafOf(SEEDS.deviceX, ex, chain), relay);
    await deposited(relay, chain[1]!);
    await shutdown(x);
    const y = standLeaf(SEEDS.deviceY, ey, await leafOf(SEEDS.deviceY, ey, [inception]), relay);   // stale
    try {
      await until(() => y.adapter.kel.length === 2, "y to pull the rotation off a drop");
      expect(y.adapter.kel.map((e) => e.eventCid)).toEqual(chain.map((e) => e.eventCid));
      expect(y.refusals).toEqual([]);
      // x wakes again; the pair meets under the head and syncs.
      const x2 = standLeaf(SEEDS.deviceX, ex, await leafOf(SEEDS.deviceX, ex, chain), relay);
      try {
        await until(() => peersOf(x2).length === 1 && peersOf(y).length === 1, "the pair under the head");
        const found = await syncOne(x2, y, "across the rotation");
        expect(found.doc()?.line).toBe("across the rotation");
        expect([...x2.refusals, ...y.refusals]).toEqual([]);
        // No KEL crossed the sibling channel: the relay carried no event of it.
        expect(carriedReads(relay.carried, chain[1]!.eventCid)).toBe(false);
      } finally { await shutdown(x2); }
    } finally { await shutdown(y); }
    // CONTROL: a leaf that pins no drop stays where it stood.
    const relay2 = memoryRelay();
    const lone = standLeaf(SEEDS.deviceY, ey, await leafOf(SEEDS.deviceY, ey, [inception]), relay2, { drops: null });
    try { await sleep(200); expect(lone.adapter.kel).toHaveLength(1); } finally { await shutdown(lone); }
  });

  test("RED: a leaf the rotation left out finds no seal addressed to it, stands revoked, says so and meets no one", async () => {
    const { inception } = await founded();
    const chain = await rotatedKeeping([SEEDS.deviceX]);                                 // Z revoked
    const relay = memoryRelay();
    const ex = await enrol(SEEDS.opA, SEEDS.deviceX, inception.prefix);
    const ez = await enrol(SEEDS.opA, SEEDS.deviceZ, inception.prefix);
    const x = standLeaf(SEEDS.deviceX, ex, await leafOf(SEEDS.deviceX, ex, chain), relay);
    await deposited(relay, chain[1]!);
    const z = standLeaf(SEEDS.deviceZ, ez, await leafOf(SEEDS.deviceZ, ez, [inception]), relay);
    try {
      await until(() => z.refusals.some((r) => r.suspect === "self"), "the revoked leaf's own refusal");
      expect(z.refusals.find((r) => r.suspect === "self")).toMatchObject({ cause: "revoked", reason: expect.stringMatching(/left this device out/) });
      await sleep(200);
      expect(peersOf(x)).toEqual([]);
      expect(peersOf(z)).toEqual([]);
      // No frame crossed between them in either direction: z left every channel.
      expect(relay.log.filter((f) => f.to === z.self.deviceKey || f.from === z.self.deviceKey)).toEqual([]);
    } finally { await shutdown(x, z); }
  });

  test("RED: a revoked leaf alone, on its old channel through an honest herm, sees no sibling presence", async () => {
    const { inception } = await founded();
    const chain = await rotatedKeeping([SEEDS.deviceX, SEEDS.deviceY]);                 // Z revoked
    const relay = memoryRelay();
    const ex = await enrol(SEEDS.opA, SEEDS.deviceX, inception.prefix);
    const ey = await enrol(SEEDS.opA, SEEDS.deviceY, inception.prefix);
    const ez = await enrol(SEEDS.opA, SEEDS.deviceZ, inception.prefix);
    const x = standLeaf(SEEDS.deviceX, ex, await leafOf(SEEDS.deviceX, ex, chain), relay);
    const y = standLeaf(SEEDS.deviceY, ey, await leafOf(SEEDS.deviceY, ey, chain), relay);
    // z keeps the old secret and pulls nothing: it waits on the old rendezvous, as a revoked leaf acting alone would.
    const z = standLeaf(SEEDS.deviceZ, ez, await leafOf(SEEDS.deviceZ, ez, [inception]), relay, { drops: null });
    try {
      await until(() => peersOf(x).length === 1 && peersOf(y).length === 1, "the siblings under the head");
      await sleep(300);
      expect(relay.log.filter((f) => f.to === z.self.deviceKey), "no sibling's frame reached z").toEqual([]);
      expect(relay.log.filter((f) => f.from === z.self.deviceKey), "z's here reached no sibling").toEqual([]);
      expect(peersOf(z)).toEqual([]);
    } finally { await shutdown(x, y, z); }
    // CONTROL: before the rotation, the same three meet on one channel and z hears its siblings.
    const relay2 = memoryRelay();
    const x2 = standLeaf(SEEDS.deviceX, ex, await leafOf(SEEDS.deviceX, ex, [inception]), relay2);
    const z2 = standLeaf(SEEDS.deviceZ, ez, await leafOf(SEEDS.deviceZ, ez, [inception]), relay2, { drops: null });
    try {
      await until(() => peersOf(x2).length === 1 && peersOf(z2).length === 1, "the pre-rotation pair");
      expect(relay2.log.some((f) => f.to === z2.self.deviceKey)).toBe(true);
    } finally { await shutdown(x2, z2); }
  });

  test("RED: re-enrolled by a later rotation after its revocation, the device catches up when it wakes and stands again", async () => {
    const { inception } = await founded();
    const twice = await rotatedTwice([SEEDS.deviceX], [SEEDS.deviceX, SEEDS.deviceZ]);
    const relay = memoryRelay();
    const ex = await enrol(SEEDS.opA, SEEDS.deviceX, inception.prefix);
    const ez = await enrol(SEEDS.opA, SEEDS.deviceZ, inception.prefix);
    const x = standLeaf(SEEDS.deviceX, ex, await leafOf(SEEDS.deviceX, ex, twice.slice(0, 2)), relay);
    const z = standLeaf(SEEDS.deviceZ, ez, await leafOf(SEEDS.deviceZ, ez, twice.slice(0, 2)), relay);   // revoked at opB
    try {
      await until(() => z.refusals.some((r) => r.suspect === "self"), "the revoked leaf's own refusal");
      expect(peersOf(z)).toEqual([]);
      await x.adapter.relicense(twice);                  // opC's rotation re-enrols z, and x deposits it
      await deposited(relay, twice[2]!);
    } finally { await shutdown(z); }
    // The device wakes: it pulls before it joins, opens opC's enrolment and meets x under the head.
    const z2 = standLeaf(SEEDS.deviceZ, ez, await leafOf(SEEDS.deviceZ, ez, twice.slice(0, 2)), relay);
    try {
      await until(() => peersOf(x).length === 1 && peersOf(z2).length === 1, "the re-enrolled pair to stand");
      expect(z2.adapter.kel.map((e) => e.eventCid)).toEqual(twice.map((e) => e.eventCid));
      expect(z2.refusals.filter((r) => r.suspect === "self")).toEqual([]);
    } finally { await shutdown(x, z2); }
  });

  test("RED: a KEL head that moves past a standing sibling's edge closes the session and the pair proves again — a sibling the head left out stands revoked", async () => {
    const { relay, x, y, inception } = await pair();
    void relay;
    try {
      await x.adapter.relicense([inception]);          // CONTROL: a head that still licenses moves nothing
      expect(peersOf(x).length).toBe(1);
      await x.adapter.relicense(await rotatedKeeping([SEEDS.deviceX]));
      // x deposits the move and closes the session inside it; y pulls the move off a drop — and finds no seal for it.
      await until(() => y.refusals.some((r) => r.suspect === "self"), "the left-out sibling to stand revoked");
      expect(y.refusals.find((r) => r.suspect === "self")).toMatchObject({ cause: "revoked" });
      await until(() => peersOf(x).length === 0 && peersOf(y).length === 0, "the pair to part");
      expect(x.refusals.filter((r) => r.suspect === "relay"), "a lawful KEL move blames no relay").toEqual([]);
    } finally { await shutdown(x, y); }
  });

  test("CONTROL: a KEL head that moves with a re-enrolment for the sibling — the pair proves again under the head, with no refusal", async () => {
    const { x, y } = await pair();
    try {
      const chain = await rotatedKeeping([SEEDS.deviceX, SEEDS.deviceY]);
      await x.adapter.relicense(chain);
      await until(() => y.adapter.kel.length === 2 && peersOf(x).length === 1 && peersOf(y).length === 1, "the pair to stand under the head");
      expect([...x.refusals, ...y.refusals]).toEqual([]);
      const found = await syncOne(x, y, "under the moved head");
      expect(found.doc()?.line).toBe("under the moved head");
    } finally { await shutdown(x, y); }
  });

  test("RED: a leaf its own KEL revokes says goodbye inside each session — its sibling closes, never syncing into a black hole", async () => {
    const { x, y } = await pair();
    try {
      await y.adapter.relicense(await rotatedKeeping([SEEDS.deviceX]));   // only y learns the rotation
      expect(y.refusals.find((r) => r.suspect === "self")).toMatchObject({ cause: "revoked" });
      await until(() => peersOf(x).length === 0, "x to close its half");
      expect(x.refusals[0]).toMatchObject({ suspect: "peer", peerKey: y.self.deviceKey, reason: expect.stringMatching(/its own KEL revoked it/) });
      expect(peersOf(y)).toEqual([]);
    } finally { await shutdown(x, y); }
  });

  test("RED: the leaf whose KEL moved deposits the move BEFORE it closes a session, and the sibling that hears the close catches up", async () => {
    const { relay, x, y } = await pair();
    try {
      const chain = await rotatedKeeping([SEEDS.deviceX, SEEDS.deviceY]);
      const mark = relay.timeline.length;
      await x.adapter.relicense(chain);
      const after = relay.timeline.slice(mark);
      const deposit = after.indexOf(`deposit ${chain[1]!.eventCid}`);
      const close = after.findIndex((t) => t.startsWith(`frame ${x.self.deviceKey.slice(0, 8)}>${y.self.deviceKey.slice(0, 8)} seal`));
      expect(deposit, "x deposited the move").toBeGreaterThanOrEqual(0);
      expect(close, "x closed its session with y").toBeGreaterThanOrEqual(0);
      expect(deposit).toBeLessThan(close);
      await until(() => y.adapter.kel.length === 2 && peersOf(x).length === 1 && peersOf(y).length === 1, "y to catch up off the drop and the pair to stand");
      expect([...x.refusals, ...y.refusals]).toEqual([]);
    } finally { await shutdown(x, y); }
  });

  test("RED: a herm that withholds a drop is tolerated through a second herm; CONTROL: two withholding herms leave the leaf where it stood", async () => {
    const { inception } = await founded();
    const chain = await rotatedKeeping([SEEDS.deviceX, SEEDS.deviceY]);
    const ey = await enrol(SEEDS.opA, SEEDS.deviceY, inception.prefix);
    for (const withholding of [[true, false], [true, true]] as const) {
      const relay = memoryRelay();
      for (const store of relay.stores) chain.slice(1).forEach((e, i) => store.deposit(personaKelDropName(e.prevEventCid!, store.gatePubKey), copy({ prev: chain[i]!, event: e })));
      const herms = relay.stores.map((store, i) => memoryDropHerm(store, relay.timeline, withholding[i] ? { serve: () => [] } : {}));
      const y = standLeaf(SEEDS.deviceY, ey, await leafOf(SEEDS.deviceY, ey, [inception]), relay, { drops: siblingKelDropsOf(herms) });
      try {
        await sleep(300);
        expect(y.adapter.kel, `withholding ${withholding.join("/")}`).toHaveLength(withholding[1] ? 1 : 2);
      } finally { await shutdown(y); }
    }
  });

  test("RED: a herm that strips or swaps a successor is refused by the reader and said as `relay`; the honest herm's copy stands", async () => {
    const { inception } = await founded();
    const chain = await rotatedKeeping([SEEDS.deviceX, SEEDS.deviceY]);
    const forged = await rotatedKeeping([SEEDS.deviceX]);
    const ey = await enrol(SEEDS.opA, SEEDS.deviceY, inception.prefix);
    const relay = memoryRelay();
    for (const store of relay.stores) store.deposit(personaKelDropName(inception.eventCid, store.gatePubKey), copy({ prev: inception, event: chain[1]! }));
    const stripped = { ...chain[1]!, enrolments: [] };
    const swapped = { ...forged[1]!, rotationSigs: [] };
    const hostile = memoryDropHerm(relay.stores[0]!, relay.timeline, { serve: () => [stripped, swapped] });
    const honest = memoryDropHerm(relay.stores[1]!, relay.timeline);
    // Alone, the hostile herm extends nothing.
    const alone = standLeaf(SEEDS.deviceY, ey, await leafOf(SEEDS.deviceY, ey, [inception]), relay, { drops: siblingKelDropsOf([hostile]) });
    try {
      await until(() => alone.refusals.filter((r) => r.suspect === "relay").length >= 2, "both hostile values refused");
      expect(alone.adapter.kel).toHaveLength(1);
      for (const r of alone.refusals) expect(r).toMatchObject({ suspect: "relay", session: null, reason: expect.stringMatching(/does not verify/) });
    } finally { await shutdown(alone); }
    // Beside an honest herm, the honest copy stands and the hostile values still surface.
    const y = standLeaf(SEEDS.deviceY, ey, await leafOf(SEEDS.deviceY, ey, [inception]), relay, { drops: siblingKelDropsOf([hostile, honest]) });
    try {
      await until(() => y.adapter.kel.length === 2, "the honest copy to stand");
      expect(y.adapter.kel[1]!.eventCid).toBe(chain[1]!.eventCid);
      expect(y.refusals.filter((r) => r.suspect === "relay").length).toBeGreaterThanOrEqual(2);
      expect(y.refusals.filter((r) => r.suspect === "self")).toEqual([]);
    } finally { await shutdown(y); }
  });

  test("RED: a withheld veto of a provisional rotation never reads the leaf as revoked — it stands under the head; the veto, folded, stands it too", async () => {
    const { inception, provisional, veto } = await provisionalKeeping([SEEDS.deviceX, SEEDS.deviceY]);
    const ex = await enrol(SEEDS.opA, SEEDS.deviceX, inception.prefix);
    const ey = await enrol(SEEDS.opA, SEEDS.deviceY, inception.prefix);
    // The herm served the provisional and withheld its veto: the leaves carry the provisional, which re-enrols them.
    const relay = memoryRelay();
    const x = standLeaf(SEEDS.deviceX, ex, await leafOf(SEEDS.deviceX, ex, [inception, provisional]), relay, { drops: null });
    const y = standLeaf(SEEDS.deviceY, ey, await leafOf(SEEDS.deviceY, ey, [inception, provisional]), relay, { drops: null });
    try {
      await until(() => peersOf(x).length === 1 && peersOf(y).length === 1, "the pair under the head the provisional leaves standing");
      expect([...x.refusals, ...y.refusals].filter((r) => r.suspect === "self")).toEqual([]);
    } finally { await shutdown(x, y); }
    // CONTROL: the veto lands through a drop, the fold kills the provisional, and the pair stands under the head.
    const relay2 = memoryRelay();
    for (const store of relay2.stores) for (const e of [provisional, veto]) store.deposit(personaKelDropName(inception.eventCid, store.gatePubKey), copy({ prev: inception, event: e }));
    const x2 = standLeaf(SEEDS.deviceX, ex, await leafOf(SEEDS.deviceX, ex, [inception, provisional]), relay2);
    const y2 = standLeaf(SEEDS.deviceY, ey, await leafOf(SEEDS.deviceY, ey, [inception]), relay2);
    try {
      await until(() => x2.adapter.kel.at(-1)?.eventCid === veto.eventCid && y2.adapter.kel.at(-1)?.eventCid === veto.eventCid, "both to fold the veto");
      await until(() => peersOf(x2).length === 1 && peersOf(y2).length === 1, "the pair under the vetoed head");
      expect([...x2.refusals, ...y2.refusals].filter((r) => r.suspect === "self")).toEqual([]);
    } finally { await shutdown(x2, y2); }
  });

  test("RED: a junk event on the board revokes no one — the leaf names the KEL unreadable and keeps its standing", async () => {
    const { x, y, inception } = await pair();
    try {
      const rotated = await rotatedKeeping([SEEDS.deviceX, SEEDS.deviceY]);
      const junk = { ...rotated[1]!, rotationSigs: [] };   // a torn quorum on an inception-only chain
      await x.adapter.relicense([inception, junk]);
      expect(x.refusals.some((r) => r.suspect === "self" && r.cause === "revoked")).toBe(false);
      expect(x.refusals).toEqual([expect.objectContaining({ suspect: "self", cause: "unreadable" })]);
      await x.adapter.relicense([inception, junk]);          // one board state surfaces once
      expect(x.refusals).toHaveLength(1);
      expect(peersOf(x).length).toBe(1);
      const found = await syncOne(x, y, "after the junk");
      expect(found.doc()?.line).toBe("after the junk");
    } finally { await shutdown(x, y); }
  });

  test("RED: a STRIPPED enrolment on the board reads unreadable, never `self` revoked, and the pair stands", async () => {
    const { x, y, inception } = await pair();
    try {
      const chain = await rotatedKeeping([SEEDS.deviceX, SEEDS.deviceY]);
      const keyY = await pubOf(SEEDS.deviceY);
      const open = (await import("../src/persona-group-secret.js")).groupSecretOpenerFromSeed(SEEDS.deviceY);
      const mine = [];
      for (const e of chain[1]!.enrolments!) if (open.enrolment(e, { prefix: inception.prefix, opKeyDid: chain[1]!.opKeyDid })) mine.push(e);
      expect(mine).toHaveLength(1);
      const stripped = [chain[0]!, { ...chain[1]!, enrolments: chain[1]!.enrolments!.filter((e) => !mine.includes(e)) }];
      void keyY;
      await y.adapter.relicense(stripped);
      await sleep(200);
      expect(y.refusals).toEqual([expect.objectContaining({ suspect: "self", cause: "unreadable" })]);
      expect(peersOf(x).length).toBe(1);
      expect(peersOf(y).length).toBe(1);
    } finally { await shutdown(x, y); }
  });

  test("RED: a KEL handed with a forged enrolment blames no sibling — both stand under the prefix that verifies", async () => {
    const { inception } = await founded();
    const chain = await rotatedKeeping([SEEDS.deviceX, SEEDS.deviceY]);
    const forged = { ...chain[1]!.enrolments![0]!, sig: "00".repeat(64) };
    const tampered = [chain[0]!, { ...chain[1]!, enrolments: [forged, ...chain[1]!.enrolments!] }];
    const relay = memoryRelay();
    const ex = await enrol(SEEDS.opA, SEEDS.deviceX, inception.prefix);
    const ey = await enrol(SEEDS.opA, SEEDS.deviceY, inception.prefix);
    const x = standLeaf(SEEDS.deviceX, ex, await leafOf(SEEDS.deviceX, ex, tampered), relay);
    const y = standLeaf(SEEDS.deviceY, ey, await leafOf(SEEDS.deviceY, ey, tampered), relay);
    try {
      await until(() => peersOf(x).length === 1 && peersOf(y).length === 1, "the pair under the verified prefix");
      for (const r of [...x.refusals, ...y.refusals]) expect(r).toMatchObject({ suspect: "self", cause: "unreadable" });
      expect(x.adapter.kel).toHaveLength(1);
    } finally { await shutdown(x, y); }
  });

  test("RED: a leaf whose seal opens for no op-key its KEL seats stands `unsealed`, never `revoked`", async () => {
    const { inception } = await founded();
    const relay = memoryRelay();
    const ex = await enrol(SEEDS.opA, SEEDS.deviceX, inception.prefix);
    const sealedToAnother = await enrol(SEEDS.opA, SEEDS.deviceW, inception.prefix);
    const missing = { edge: ex.edge, seal: sealedToAnother.seal };
    const x = standLeaf(SEEDS.deviceX, missing, await leafOf(SEEDS.deviceX, missing, [inception]), relay);
    try {
      await until(() => x.refusals.length > 0, "the unsealed leaf's refusal");
      expect(x.refusals[0]).toMatchObject({ suspect: "self", cause: "unsealed" });
    } finally { await shutdown(x); }
  });

  test("RED (M2): the channel dials EVERY pinned herm — a herm that drops a pair leaves it standing over the other; CONTROL: a leaf on one herm alone loses its sibling", async () => {
    const { inception } = await founded();
    const ex = await enrol(SEEDS.opA, SEEDS.deviceX, inception.prefix);
    const ey = await enrol(SEEDS.opA, SEEDS.deviceY, inception.prefix);
    const a = memoryRelay(), b = memoryRelay();
    const x = standLeaf(SEEDS.deviceX, ex, await leafOf(SEEDS.deviceX, ex, [inception]), a, { alsoVia: [b], retryInterval: 60_000 });
    const y = standLeaf(SEEDS.deviceY, ey, await leafOf(SEEDS.deviceY, ey, [inception]), a, { alsoVia: [b], retryInterval: 60_000 });
    try {
      await until(() => peersOf(x).length === 1 && peersOf(y).length === 1 && a.holds(x.self.deviceKey) && b.holds(x.self.deviceKey), "the pair over both herms");
      expect(x.adapter.status()).toMatchObject({ refusal: null, herms: 2, carried: 2 });
      // Herm `a` drops both sockets: the pair proves again over `b` and syncs.
      for (const key of [x.self.deviceKey, y.self.deviceKey]) a.drop(key);
      await until(() => peersOf(x).length === 1 && peersOf(y).length === 1, "the pair over the herm still standing");
      expect(x.adapter.status().carried).toBe(1);
      const found = await syncOne(x, y, "over the second herm");
      expect(found.doc()?.line).toBe("over the second herm");
    } finally { await shutdown(x, y); }
    // CONTROL: pinned through `a` alone, a drop leaves the leaf with no sibling.
    const c = memoryRelay();
    const x1 = standLeaf(SEEDS.deviceX, ex, await leafOf(SEEDS.deviceX, ex, [inception]), c, { retryInterval: 60_000 });
    const y1 = standLeaf(SEEDS.deviceY, ey, await leafOf(SEEDS.deviceY, ey, [inception]), c, { retryInterval: 60_000 });
    try {
      await until(() => peersOf(x1).length === 1, "the pair over one herm");
      for (const key of [x1.self.deviceKey, y1.self.deviceKey]) c.drop(key);
      await sleep(100);
      expect(peersOf(x1)).toHaveLength(0);
    } finally { await shutdown(x1, y1); }
  });

  test("RED (M2): a channel told to refuse dials nothing and says why as `pins` on every dial and in its status", async () => {
    const { inception } = await founded();
    const ex = await enrol(SEEDS.opA, SEEDS.deviceX, inception.prefix);
    const refusals: SiblingRefusal[] = [];
    const adapter = new SiblingNetworkAdapter({
      transports: [], refusal: "the channel pins 1 herm(s) under distinct gate keys and stands over at least two",
      kel: [inception], leaf: (kel) => leafOf(SEEDS.deviceX, ex, kel), onRefusal: (r) => refusals.push(r),
    });
    adapter.connect("x" as never);
    await adapter.whenReady();
    adapter.connect("x" as never);
    expect(refusals.map((r) => r.suspect)).toEqual(["pins", "pins"]);
    expect(adapter.status()).toMatchObject({ refusal: expect.stringMatching(/at least two/), carried: 0 });
    adapter.disconnect();
  });

  test("RED (H): a herm that answers no drop request surfaces as `relay`, and the leaf catches up and pairs off the other", async () => {
    const { inception } = await founded();
    const chain = await rotatedKeeping([SEEDS.deviceX, SEEDS.deviceY]);
    const ex = await enrol(SEEDS.opA, SEEDS.deviceX, inception.prefix);
    const ey = await enrol(SEEDS.opA, SEEDS.deviceY, inception.prefix);
    const silent = { gatePubKey: "c3".repeat(32), pull: async () => { throw new Error("unanswered"); }, deposit: async () => { throw new Error("unanswered"); } };
    for (const order of ["silent-first", "silent-last"] as const) {
      const relay = memoryRelay();
      const honest = relay.drops[1]!;
      await honest.deposit(personaKelDropName(inception.eventCid, honest.gatePubKey), { prev: chain[0]!, event: chain[1]! });
      const herms = order === "silent-first" ? [silent, honest] : [honest, silent];
      const x = standLeaf(SEEDS.deviceX, ex, await leafOf(SEEDS.deviceX, ex, chain), relay, { drops: siblingKelDropsOf([honest]) });
      const y = standLeaf(SEEDS.deviceY, ey, await leafOf(SEEDS.deviceY, ey, [inception]), relay, { drops: siblingKelDropsOf(herms) });
      try {
        await until(() => y.adapter.kel.length === 2 && peersOf(y).length === 1, `y caught up and paired (${order})`);
        expect(y.refusals.some((r) => r.suspect === "relay" && /c3c3c3c3… answered no drop pull/.test(r.reason)), order).toBe(true);
      } finally { await shutdown(x, y); }
    }
  });

  test("RED (M1): a KEL that forks at one seat surfaces as `self: fork`, and the leaf keeps the standing it last read", async () => {
    const { inception, guardianRecoveryKeys, recoveryThreshold } = await founded();
    const chain = await rotatedKeeping([SEEDS.deviceX, SEEDS.deviceY]);
    const guardianSigners = await Promise.all([SEEDS.g1, SEEDS.g2].map(async (s) => ({ signer: await pubOf(s), sign: async (b: Uint8Array) => hex(await (await import("@noble/ed25519")).signAsync(b, s)) })));
    const { rollEnrolments } = await import("../src/persona-group-secret.js");
    const { attestAndRotate } = await import("../src/recovery-keel-core.js");
    const enrolments = await rollEnrolments({ prefix: inception.prefix, opSeed: SEEDS.opC, devices: [{ deviceVerifyingKey: await pubOf(SEEDS.deviceX), hearthTrueName: "", boundEpoch: 0 }] });
    const rival = await attestAndRotate({ head: inception, freshOpKeyDid: await didOf(SEEDS.opC), guardianRecoveryKeys, recoveryThreshold, guardianSigners, enrolments });
    if (!rival.ok) throw new Error(rival.reason);
    const { x, y } = await pair();
    try {
      await x.adapter.relicense([inception, chain[1]!, rival.event]);
      expect(x.refusals.filter((r) => r.suspect === "self")).toEqual([expect.objectContaining({ cause: "fork", reason: expect.stringMatching(/forks at seq 1/) })]);
      expect(x.adapter.kel.map((e) => e.eventCid)).toEqual([inception.eventCid]);
      expect(x.adapter.status().self).toBe("fork");
      expect(peersOf(x)).toHaveLength(1);
      // CONTROL: the lawful rotation alone moves the pair, with no fork said.
      await y.adapter.relicense(chain);
      expect(y.refusals.filter((r) => r.suspect === "self")).toEqual([]);
    } finally { await shutdown(x, y); }
  });
});

void pubOf;
