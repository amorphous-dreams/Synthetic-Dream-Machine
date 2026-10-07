/**
 * leaf-peer-proof.test — two leaves of one PersonaGroup prove their device keys to each other over a relay
 * that forwards bytes and reads nothing.
 *
 * Proven, each red beside its control:
 *   · CONTROL: two sibling devices, each delegated by the KEL head's op-key, prove each other — each side
 *     resolves the OTHER's device key;
 *   · the relay carried every byte and read no edge: no edge signature, no root key, no edge field crossed it
 *     in the clear;
 *   · RED: an impostor leaf whose edge a stranger root signed is refused;
 *   · RED: a leaf holding a sibling's real edge but not that sibling's device key is refused;
 *   · RED: a leaf whose edge the KEL has ROLLED PAST (the op-key that signed it was rotated away) is refused,
 *     and the same device re-delegated under the new head is licensed — event order, no clock;
 *   · RED: a relay that swaps its own ephemeral key into the exchange gains nothing the initiator accepts;
 *   · RED: a channel that proved a different sender key than the edge names is refused.
 */
import { describe, test, expect } from "vitest";
import * as ed from "@noble/ed25519";
import { hex, hexToBytes } from "../src/crypto.js";
import { sealToRecipient, openFromSender } from "../src/sealed-box.js";
import { buildDeviceDelegation, type DeviceDelegationTiddler } from "../src/device-delegation.js";
import type { PersonaKelEvent } from "../src/persona-kel.js";
import { provisionThresholdRecoveryAtFounding, attestAndRotate } from "../src/recovery-keel-core.js";
import { guardianRecoveryRegistrationCard } from "../src/recovery-registration.js";
import {
  proveLeafPeerAsInitiator, proveLeafPeerAsResponder, startLeafPeerProof,
  finishLeafPeerProof, leafPeerProofBytes,
  type LeafPeerSelf, type LeafPeerDuplex, type LeafPeerFrame, type LeafPeerVerdict,
} from "../src/leaf-peer-proof.js";
import { LEAF_PEER_PROOF_DOMAIN, LEAF_PEER_SEAL_INFO } from "../src/domains.js";

const SEAL_INFO = new TextEncoder().encode(LEAF_PEER_SEAL_INFO);

const SEEDS = {
  opA:      new Uint8Array(32).fill(11),
  opB:      new Uint8Array(32).fill(22),
  stranger: new Uint8Array(32).fill(9),
  deviceX:  new Uint8Array(32).fill(33),
  deviceY:  new Uint8Array(32).fill(44),
  deviceZ:  new Uint8Array(32).fill(55),
  g1:       new Uint8Array(32).fill(1),
  g2:       new Uint8Array(32).fill(2),
  g3:       new Uint8Array(32).fill(3),
};
const pubOf    = (s: Uint8Array) => ed.getPublicKeyAsync(s).then(hex);
const didOf    = async (s: Uint8Array) => `0x${await pubOf(s)}`;
const signerOf = (s: Uint8Array) => async (bytes: Uint8Array) => hex(await ed.signAsync(bytes, s));

async function founded(): Promise<{ inception: PersonaKelEvent; guardianRecoveryKeys: string[]; recoveryThreshold: number }> {
  const foundingOpKeyDid = await didOf(SEEDS.opA);
  const guardianRecoveryKeys = await Promise.all([pubOf(SEEDS.g1), pubOf(SEEDS.g2), pubOf(SEEDS.g3)]);
  const slots = ["mine", "guardian-a", "guardian-b"] as const;
  const guardians = guardianRecoveryKeys.map((k, i) => guardianRecoveryRegistrationCard(slots[i]!, k, null));
  const prov = provisionThresholdRecoveryAtFounding({ foundingOpKeyDid, guardians, recoveryThreshold: 2 });
  return { inception: prov.inception, guardianRecoveryKeys, recoveryThreshold: prov.recoveryThreshold };
}

async function rotatedToOpB(): Promise<PersonaKelEvent[]> {
  const { inception, guardianRecoveryKeys, recoveryThreshold } = await founded();
  const guardianSigners = await Promise.all([SEEDS.g1, SEEDS.g2].map(async (s) => ({ signer: await pubOf(s), sign: signerOf(s) })));
  const rot = await attestAndRotate({ head: inception, freshOpKeyDid: await didOf(SEEDS.opB), guardianRecoveryKeys, recoveryThreshold, guardianSigners });
  if (!rot.ok) throw new Error(rot.reason);
  return [inception, rot.event];
}

async function edgeFor(root: Uint8Array, device: Uint8Array): Promise<DeviceDelegationTiddler> {
  return buildDeviceDelegation({ personaRootSeed: root, deviceVerifyingKey: await pubOf(device), hearthTrueName: "", boundEpoch: 0 });
}

async function leaf(device: Uint8Array, edge: DeviceDelegationTiddler, kel: readonly PersonaKelEvent[]): Promise<LeafPeerSelf> {
  return { deviceKey: await pubOf(device), sign: signerOf(device), edge, kel };
}

/**
 * A relay between two leaves: it forwards each frame as the bytes it received and keeps every one it carried.
 * `tamper` lets a test stand an ACTIVE relay that rewrites frames in flight; `fromOf` stands the sender key an
 * authenticated relay would stamp.
 */
function relay(opts: {
  tamper?: (frame: LeafPeerFrame, toward: "a" | "b") => Promise<LeafPeerFrame> | LeafPeerFrame;
  fromOf?: { a?: string; b?: string };
} = {}) {
  const carried: string[] = [];
  const inbox = { a: [] as string[], b: [] as string[] };
  const waiting = { a: [] as Array<() => void>, b: [] as Array<() => void> };
  const deliver = (to: "a" | "b", bytes: string) => { inbox[to].push(bytes); waiting[to].shift()?.(); };
  const side = (me: "a" | "b"): LeafPeerDuplex => {
    const other = me === "a" ? "b" : "a";
    return {
      send: async (frame) => {
        const forwarded = opts.tamper ? await opts.tamper(frame, other) : frame;
        const bytes = JSON.stringify(forwarded);
        carried.push(bytes);
        deliver(other, bytes);
      },
      recv: async () => {
        if (inbox[me].length === 0) await new Promise<void>((r) => waiting[me].push(r));
        const from = opts.fromOf?.[other];
        return { frame: JSON.parse(inbox[me].shift()!) as LeafPeerFrame, ...(from ? { from } : {}) };
      },
    };
  };
  return { a: side("a"), b: side("b"), carried };
}

/** Run one exchange with a bounded wait on the responder, which hears no finish when the initiator refuses. */
async function exchange(a: LeafPeerSelf, b: LeafPeerSelf, r = relay()): Promise<{ a: LeafPeerVerdict; b: LeafPeerVerdict | "no-finish"; carried: string[] }> {
  const bSide = proveLeafPeerAsResponder(b, r.b);
  const aVerdict = await proveLeafPeerAsInitiator(a, r.a);
  const bVerdict = await Promise.race([bSide, new Promise<"no-finish">((res) => setTimeout(() => res("no-finish"), 200))]);
  return { a: aVerdict, b: bVerdict, carried: r.carried };
}

describe("leaf ↔ leaf proof inside one PersonaGroup, over a relay", () => {
  test("CONTROL: two sibling devices prove each other's device key", async () => {
    const { inception } = await founded();
    const x = await leaf(SEEDS.deviceX, await edgeFor(SEEDS.opA, SEEDS.deviceX), [inception]);
    const y = await leaf(SEEDS.deviceY, await edgeFor(SEEDS.opA, SEEDS.deviceY), [inception]);
    const { a, b } = await exchange(x, y);
    expect(a).toEqual({ ok: true, peerKey: y.deviceKey });
    expect(b).toEqual({ ok: true, peerKey: x.deviceKey });
  });

  test("the relay carried every byte and read no edge", async () => {
    const { inception } = await founded();
    const ex = await edgeFor(SEEDS.opA, SEEDS.deviceX);
    const ey = await edgeFor(SEEDS.opA, SEEDS.deviceY);
    const { a, b, carried } = await exchange(
      await leaf(SEEDS.deviceX, ex, [inception]), await leaf(SEEDS.deviceY, ey, [inception]));
    expect(a.ok && b !== "no-finish" && b.ok).toBe(true);
    expect(carried).toHaveLength(3);                                     // hello · answer · finish
    const wire = carried.join("\n");
    const rootKey = (await didOf(SEEDS.opA)).slice(2);
    for (const secret of [ex.signature, ey.signature, rootKey, "device-delegation", "personaRootDid"]) {
      expect(wire.includes(secret), `the relay read ${secret.slice(0, 16)}…`).toBe(false);
    }
    // CONTROL on the instrument: the same scan finds an edge field when one does cross in the clear.
    expect(JSON.stringify(ex).includes("personaRootDid")).toBe(true);
  });

  test("RED: an impostor leaf whose edge a stranger root signed is refused", async () => {
    const { inception } = await founded();
    const x = await leaf(SEEDS.deviceX, await edgeFor(SEEDS.opA, SEEDS.deviceX), [inception]);
    const z = await leaf(SEEDS.deviceZ, await edgeFor(SEEDS.stranger, SEEDS.deviceZ), [inception]);
    const { a } = await exchange(x, z);
    expect(a.ok).toBe(false);
    if (!a.ok) expect(a.reason).toMatch(/not licensed by this PersonaGroup's KEL head/);
  });

  test("RED: a leaf holding a sibling's real edge but not its device key is refused", async () => {
    const { inception } = await founded();
    const x = await leaf(SEEDS.deviceX, await edgeFor(SEEDS.opA, SEEDS.deviceX), [inception]);
    const stolen = await edgeFor(SEEDS.opA, SEEDS.deviceY);
    const z = await leaf(SEEDS.deviceZ, stolen, [inception]);        // signs with Z's key, presents Y's edge
    const { a } = await exchange(x, z);
    expect(a).toEqual({ ok: false, reason: "the device key did not sign this exchange" });
  });

  test("RED: a leaf whose edge the KEL rolled past is refused; re-delegated under the head, it is licensed", async () => {
    const chain = await rotatedToOpB();
    const x = await leaf(SEEDS.deviceX, await edgeFor(SEEDS.opB, SEEDS.deviceX), chain);
    const rolledPast = await leaf(SEEDS.deviceY, await edgeFor(SEEDS.opA, SEEDS.deviceY), chain);
    const refused = await exchange(x, rolledPast);
    expect(refused.a.ok).toBe(false);
    const redelegated = await leaf(SEEDS.deviceY, await edgeFor(SEEDS.opB, SEEDS.deviceY), chain);
    const licensed = await exchange(x, redelegated);
    expect(licensed.a).toEqual({ ok: true, peerKey: redelegated.deviceKey });
  });

  test("RED: a relay that swaps its own ephemeral key into the exchange gains nothing the initiator accepts", async () => {
    const { inception } = await founded();
    const x = await leaf(SEEDS.deviceX, await edgeFor(SEEDS.opA, SEEDS.deviceX), [inception]);
    const y = await leaf(SEEDS.deviceY, await edgeFor(SEEDS.opA, SEEDS.deviceY), [inception]);
    // The relay hands Y ITS OWN ephemeral key in place of X's, opens the proof Y seals to it, and re-seals
    // that proof toward X's real ephemeral key. It reads Y's edge — and holds a signature naming its own key.
    let xEph = "";
    let relayState: ReturnType<typeof startLeafPeerProof>["state"] | null = null;
    let helloNonce = "";
    const mitm = relay({
      tamper: (frame, toward) => {
        if (frame.step === "hello" && toward === "b") {
          xEph = frame.eph; helloNonce = frame.nonce;
          relayState = startLeafPeerProof().state;
          return { ...frame, eph: relayState.ephPub };
        }
        if (frame.step === "answer" && toward === "a" && relayState) {
          const salt = [hexToBytes(helloNonce), hexToBytes(frame.nonce)];
          const plaintext = openFromSender({
            recipientSecret: relayState.ephSecret, senderEphemeralPub: hexToBytes(frame.box.e),
            aeadNonce: hexToBytes(frame.box.n), ciphertext: hexToBytes(frame.box.c), info: SEAL_INFO, extraSalt: salt,
          });
          expect(plaintext, "the active relay opened the box sealed to it").not.toBeNull();
          const resealed = sealToRecipient({ recipientPub: hexToBytes(xEph), plaintext: plaintext!, info: SEAL_INFO, extraSalt: salt });
          return { ...frame, box: { e: hex(resealed.senderEphemeralPub), n: hex(resealed.aeadNonce), c: hex(resealed.ciphertext) } };
        }
        return frame;
      },
    });
    const { a } = await exchange(x, y, mitm);
    expect(a).toEqual({ ok: false, reason: "the device key did not sign this exchange" });
  });

  test("RED: a channel that proved a different sender key than the edge names is refused", async () => {
    const { inception } = await founded();
    const x = await leaf(SEEDS.deviceX, await edgeFor(SEEDS.opA, SEEDS.deviceX), [inception]);
    const y = await leaf(SEEDS.deviceY, await edgeFor(SEEDS.opA, SEEDS.deviceY), [inception]);
    const { a } = await exchange(x, y, relay({ fromOf: { b: await pubOf(SEEDS.deviceZ) } }));
    expect(a).toEqual({ ok: false, reason: "the channel proved a different key than the edge names" });
    // CONTROL: the channel proving the edge's own key passes.
    const ok = await exchange(x, y, relay({ fromOf: { b: y.deviceKey, a: x.deviceKey } }));
    expect(ok.a).toEqual({ ok: true, peerKey: y.deviceKey });
  });

  test("the proof bytes open on their own domain and carry no clock", () => {
    const text = new TextDecoder().decode(leafPeerProofBytes({ nonce: "a".repeat(64), sealedTo: "b".repeat(64), proverKey: "c".repeat(64) }));
    expect(JSON.parse(text).domain).toBe(LEAF_PEER_PROOF_DOMAIN);
    expect(Object.keys(JSON.parse(text)).sort()).toEqual(["domain", "nonce", "proverKey", "sealedTo"]);
  });

  test("a finish read without an answer refuses rather than throws", async () => {
    const { inception } = await founded();
    const x = await leaf(SEEDS.deviceX, await edgeFor(SEEDS.opA, SEEDS.deviceX), [inception]);
    const { state, frame } = startLeafPeerProof();
    const r = await finishLeafPeerProof(x, state, frame);
    expect(r.verdict.ok).toBe(false);
  });
});
