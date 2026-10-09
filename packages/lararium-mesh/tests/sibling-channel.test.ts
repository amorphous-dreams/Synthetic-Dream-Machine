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
 *   · RED: the channel tag needs the secret — a non-member holding the group id alone computes another;
 *   · RED: a forged hello (the herm, or any non-member) draws no box at all, and no box opens for its forger;
 *   · RED: an impostor holding a leaked secret but an edge a stranger root signed becomes no peer, said as `peer`;
 *   · RED: an edge bound below the lease epoch the leaf holds is refused as lapsed;
 *   · RED: a frame the relay INJECTS refuses the session on BOTH sides, said as `relay`, never blaming the
 *     sibling — and the pair proves again and syncs;
 *   · RED: a REPLAYED frame refuses the same way;
 *   · RED: a forged `here` against a standing session surfaces, never tearing down in silence;
 *   · RED: a frame stamped with the leaf's own key surfaces, never dropping in silence;
 *   · RED: a stale sibling (its KEL short of the rotation) catches up inside the seal and the pair stands;
 *   · RED: a leaf the rotation left out finds no seal addressed to it, stands revoked and says so; a later
 *     rotation that re-enrols it stands it again;
 *   · RED: a KEL head that moves past a standing sibling's edge with no re-enrolment drops it on relicense.
 */
import { describe, test, expect } from "vitest";
import { hmac } from "@noble/hashes/hmac.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { type AutomergeUrl, type DocHandle } from "@automerge/automerge-repo";
import { base64UrlEncode, hex, hexToBytes } from "../src/crypto.js";
import { SIBLING_CHANNEL_INFO, LEAF_PEER_SEAL_INFO } from "../src/domains.js";
import { openFromSender } from "../src/sealed-box.js";
import { personaGroupSecret } from "../src/persona-group-secret.js";
import { startLeafPeerProof } from "../src/leaf-peer-proof.js";
import { siblingChannelTag } from "../src/sibling-channel.js";
import {
  SEEDS, pubOf, didOf, founded, enrol, rotatedKeeping, rotatedTwice, leafUnder, memoryRelay, standLeaf, until, sleep, peersOf,
  shutdown, carriedReads, type Leaf,
} from "./fixtures/sibling-fleet.js";

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
  const x = standLeaf(SEEDS.deviceX, ex, await leafUnder(SEEDS.deviceX, ex, [inception]), relay);
  const y = standLeaf(SEEDS.deviceY, ey, await leafUnder(SEEDS.deviceY, ey, [inception]), relay);
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

  test("RED: a forged hello — from the herm or any non-member — draws no box, and nothing opens for its forger", async () => {
    const { relay, x, y, inception } = await pair();
    try {
      // The forger holds no secret, so it can only guess a hint. It also tries the one key it might hold: the
      // group's own public facts.
      const { frame: hello, state } = startLeafPeerProof({ secrets: [{ opKeyDid: "0x00", secret: new Uint8Array(32).fill(7) }] });
      const before = relay.log.length;
      relay.inject("00".repeat(32), x.self.deviceKey, { t: "proof", p: hello });
      await sleep(300);
      const toForger = relay.log.slice(before).filter((f) => f.to === "00".repeat(32));
      const boxes = toForger.filter((f) => f.frame.t === "proof" && "box" in f.frame.p);
      expect(boxes, "x sealed nothing to a forger").toEqual([]);
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
    const x = standLeaf(SEEDS.deviceX, ex, await leafUnder(SEEDS.deviceX, ex, [inception]), relay);
    const z = standLeaf(SEEDS.deviceZ, leaked, await leafUnder(SEEDS.deviceZ, leaked, [inception]), relay, { presents: stranger.edge });
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
    const x = standLeaf(SEEDS.deviceX, ex, await leafUnder(SEEDS.deviceX, ex, [inception], 1), relay);
    const y = standLeaf(SEEDS.deviceY, lapsed, await leafUnder(SEEDS.deviceY, lapsed, [inception], 0), relay);
    try {
      await until(() => x.refusals.length > 0, "the lapsed lease's refusal");
      expect(x.refusals[0]).toMatchObject({ suspect: "peer", peerKey: y.self.deviceKey, reason: expect.stringMatching(/lease stale/) });
      expect(peersOf(x)).toEqual([]);
    } finally { await shutdown(x, y); }
    // CONTROL: the same lapsed edge stands beside a verifier that holds the epoch it was bound at.
    const relay2 = memoryRelay();
    const x2 = standLeaf(SEEDS.deviceX, ex, await leafUnder(SEEDS.deviceX, ex, [inception], 0), relay2);
    const y2 = standLeaf(SEEDS.deviceY, lapsed, await leafUnder(SEEDS.deviceY, lapsed, [inception], 0), relay2);
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

  test("RED: a stale sibling catches up inside the seal — the pair stands and the stale leaf extends its KEL", async () => {
    const { inception } = await founded();
    const chain = await rotatedKeeping([SEEDS.deviceX, SEEDS.deviceY]);
    const relay = memoryRelay();
    const ex = await enrol(SEEDS.opA, SEEDS.deviceX, inception.prefix);
    const ey = await enrol(SEEDS.opA, SEEDS.deviceY, inception.prefix);
    const x = standLeaf(SEEDS.deviceX, ex, await leafUnder(SEEDS.deviceX, ex, chain), relay);           // rotated
    const y = standLeaf(SEEDS.deviceY, ey, await leafUnder(SEEDS.deviceY, ey, [inception]), relay);     // stale
    try {
      await until(() => peersOf(x).length === 1 && peersOf(y).length === 1, "the stale pair to stand");
      expect(y.suffixes.flat().map((e) => e.eventCid)).toEqual([chain[1]!.eventCid]);
      expect(y.adapter.kel.map((e) => e.eventCid)).toEqual(chain.map((e) => e.eventCid));
      const found = await syncOne(x, y, "across the rotation");
      expect(found.doc()?.line).toBe("across the rotation");
      expect([...x.refusals, ...y.refusals]).toEqual([]);
      // The suffix crossed sealed: the herm read no event of it.
      expect(carriedReads(relay.carried, chain[1]!.eventCid)).toBe(false);
    } finally { await shutdown(x, y); }
  });

  test("RED: a leaf the rotation left out finds no seal addressed to it, stands revoked and says so", async () => {
    const { inception } = await founded();
    const chain = await rotatedKeeping([SEEDS.deviceX]);                                 // Z revoked
    const relay = memoryRelay();
    const ex = await enrol(SEEDS.opA, SEEDS.deviceX, inception.prefix);
    const ez = await enrol(SEEDS.opA, SEEDS.deviceZ, inception.prefix);
    const x = standLeaf(SEEDS.deviceX, ex, await leafUnder(SEEDS.deviceX, ex, chain), relay);
    const z = standLeaf(SEEDS.deviceZ, ez, await leafUnder(SEEDS.deviceZ, ez, [inception]), relay);
    try {
      await until(() => z.refusals.some((r) => r.suspect === "self"), "the revoked leaf's own refusal");
      expect(z.refusals.find((r) => r.suspect === "self")!.reason).toMatch(/left this device out/);
      await sleep(200);
      expect(peersOf(x)).toEqual([]);
      expect(peersOf(z)).toEqual([]);
      // CONTROL: the revoked leaf held the old secret, yet no proof box of x's opened for it — x sent catch-ups only.
      const toZ = relay.log.filter((f) => f.to === z.self.deviceKey && f.frame.t === "proof");
      expect(toZ.some((f) => f.frame.t === "proof" && f.frame.p.step === "answer")).toBe(false);
    } finally { await shutdown(x, z); }
  });

  test("a leaf a later rotation re-enrols stands again — and meets its sibling under the newest secret", async () => {
    const { inception } = await founded();
    const twice = await rotatedTwice([SEEDS.deviceX], [SEEDS.deviceX, SEEDS.deviceZ]);
    const relay = memoryRelay();
    const ex = await enrol(SEEDS.opA, SEEDS.deviceX, inception.prefix);
    const ez = await enrol(SEEDS.opA, SEEDS.deviceZ, inception.prefix);
    const x = standLeaf(SEEDS.deviceX, ex, await leafUnder(SEEDS.deviceX, ex, twice), relay);
    const z = standLeaf(SEEDS.deviceZ, ez, await leafUnder(SEEDS.deviceZ, ez, twice.slice(0, 2)), relay);   // revoked at opB
    try {
      await until(() => z.refusals.some((r) => r.suspect === "self"), "the revoked leaf's own refusal");
      expect(peersOf(z)).toEqual([]);
      await z.adapter.relicense(twice);                  // opC's rotation re-enrols z
      await until(() => peersOf(x).length === 1 && peersOf(z).length === 1, "the re-enrolled pair to stand");
    } finally { await shutdown(x, z); }
  });

  test("RED: a KEL head that moves past a standing sibling's edge with no re-enrolment drops it on relicense", async () => {
    const { relay, x, y, inception } = await pair();
    void relay;
    try {
      await x.adapter.relicense([inception]);          // CONTROL: a head that still licenses moves nothing
      expect(peersOf(x).length).toBe(1);
      await x.adapter.relicense(await rotatedKeeping([SEEDS.deviceX]));
      expect(x.refusals[0]).toMatchObject({ suspect: "peer", peerKey: y.self.deviceKey, reason: expect.stringMatching(/not licensed/) });
      await until(() => peersOf(x).length === 0, "y to leave x's peers");
    } finally { await shutdown(x, y); }
  });

  test("CONTROL: a KEL head that moves with a re-enrolment for the sibling keeps the session standing", async () => {
    const { x, y } = await pair();
    try {
      await x.adapter.relicense(await rotatedKeeping([SEEDS.deviceX, SEEDS.deviceY]));
      expect(peersOf(x).length).toBe(1);
      expect(x.refusals).toEqual([]);
    } finally { await shutdown(x, y); }
  });
});

void pubOf;
