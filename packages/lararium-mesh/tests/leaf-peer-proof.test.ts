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
 *   · RED: a relay that swaps its own ephemeral key into the exchange opens nothing without the PersonaGroup
 *     secret, and even an insider holding the secret gains nothing the initiator accepts;
 *   · RED: a hello whose hint names no secret the responder holds draws no box; one naming an OLDER secret draws
 *     the KEL suffix alone (a catch-up), never the responder's edge;
 *   · RED: a channel that proved a different sender key than the edge names is refused;
 *   · RED: a relay that swaps the RESPONDER's ephemeral key in the answer is refused by the initiator — the
 *     signature covers the transcript, so no side stands a session whose key the relay chose;
 *   · the proof binds a SESSION: both sides seal and open each other's frames in order; a frame the relay
 *     injects, replays or reorders refuses the session, the refusal stays, and it names itself;
 *   · a session whose edge the KEL head moved past refuses on `relicense`; a licensed edge stands.
 */
import { describe, test, expect } from "vitest";
import { hex, hexToBytes } from "../src/crypto.js";
import { sealToRecipient, openFromSender } from "../src/sealed-box.js";
import {
  proveLeafPeerAsInitiator, proveLeafPeerAsResponder, startLeafPeerProof, answerLeafPeerProof,
  finishLeafPeerProof, openLeafCatchUp, leafPeerProofBytes,
  type LeafPeerSelf, type LeafPeerDuplex, type LeafPeerFrame, type LeafPeerVerdict,
} from "../src/leaf-peer-proof.js";
import { LEAF_PEER_PROOF_DOMAIN, LEAF_PEER_SEAL_INFO } from "../src/domains.js";
import type { LeafPeerSession } from "../src/leaf-peer-proof.js";
import { SEEDS, pubOf, didOf, founded, enrol, rotatedKeeping, leafUnder } from "./fixtures/sibling-fleet.js";
import { leafPeerHint as hintFor } from "../src/leaf-peer-proof.js";

const SEAL_INFO = new TextEncoder().encode(LEAF_PEER_SEAL_INFO);

/** A device enrolled by `root` and standing under `kel`; `presents` swaps the edge it shows (an impostor's). */
async function leaf(device: Uint8Array, root: Uint8Array, kel: Parameters<typeof leafUnder>[2], presents?: { root: Uint8Array; device: Uint8Array }): Promise<LeafPeerSelf> {
  const prefix = kel[0]!.prefix;
  const self = await leafUnder(device, await enrol(root, device, prefix), kel);
  return presents ? { ...self, edge: (await enrol(presents.root, presents.device, prefix)).edge } : self;
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

/** Run one exchange, each side's wait bounded: a side that hears nothing more reads "silent". */
async function exchange(a: LeafPeerSelf, b: LeafPeerSelf, r = relay()): Promise<{ a: LeafPeerVerdict | "silent"; b: LeafPeerVerdict | "silent"; carried: string[] }> {
  const bounded = <T,>(p: Promise<T>) => Promise.race([p, new Promise<"silent">((res) => setTimeout(() => res("silent"), 300))]);
  const bSide = bounded(proveLeafPeerAsResponder(b, r.b));
  const aVerdict = await bounded(proveLeafPeerAsInitiator(a, r.a));
  return { a: aVerdict, b: await bSide, carried: r.carried };
}
const ok = (v: LeafPeerVerdict | "silent"): v is LeafPeerVerdict & { ok: true } => v !== "silent" && v.ok;

describe("leaf ↔ leaf proof inside one PersonaGroup, over a relay", () => {
  test("CONTROL: two enrolled sibling devices prove each other's device key", async () => {
    const { inception } = await founded();
    const x = await leaf(SEEDS.deviceX, SEEDS.opA, [inception]);
    const y = await leaf(SEEDS.deviceY, SEEDS.opA, [inception]);
    const { a, b } = await exchange(x, y);
    expect(a).toMatchObject({ ok: true, peerKey: y.deviceKey });
    expect(b).toMatchObject({ ok: true, peerKey: x.deviceKey });
  });

  test("the relay carried every byte and read no edge", async () => {
    const { inception } = await founded();
    const xs = await leaf(SEEDS.deviceX, SEEDS.opA, [inception]);
    const ys = await leaf(SEEDS.deviceY, SEEDS.opA, [inception]);
    const { a, b, carried } = await exchange(xs, ys);
    expect(ok(a) && ok(b)).toBe(true);
    expect(carried).toHaveLength(3);                                     // hello · answer · finish
    const wire = carried.join("\n");
    const rootKey = (await didOf(SEEDS.opA)).slice(2);
    for (const secret of [xs.edge.signature, ys.edge.signature, rootKey, "device-delegation", "personaRootDid"]) {
      expect(wire.includes(secret), `the relay read ${secret.slice(0, 16)}…`).toBe(false);
    }
    // CONTROL on the instrument: the same scan finds an edge field when one does cross in the clear.
    expect(JSON.stringify(xs.edge).includes("personaRootDid")).toBe(true);
  });

  test("RED: an impostor leaf whose edge a stranger root signed is refused", async () => {
    const { inception } = await founded();
    const x = await leaf(SEEDS.deviceX, SEEDS.opA, [inception]);
    const z = await leaf(SEEDS.deviceZ, SEEDS.opA, [inception], { root: SEEDS.stranger, device: SEEDS.deviceZ });
    const { a } = await exchange(x, z);
    expect(a).toMatchObject({ ok: false, reason: expect.stringMatching(/not licensed by this PersonaGroup's KEL head/) });
  });

  test("RED: a leaf holding a sibling's real edge but not its device key is refused", async () => {
    const { inception } = await founded();
    const x = await leaf(SEEDS.deviceX, SEEDS.opA, [inception]);
    const z = await leaf(SEEDS.deviceZ, SEEDS.opA, [inception], { root: SEEDS.opA, device: SEEDS.deviceY });  // signs as Z, shows Y's edge
    const { a } = await exchange(x, z);
    expect(a).toEqual({ ok: false, reason: "the device key did not sign this exchange" });
  });

  test("RED: a leaf whose edge the KEL rolled past is refused; the edge the rotation re-enrolled licenses", async () => {
    const chain = await rotatedKeeping([SEEDS.deviceX, SEEDS.deviceY]);
    const x = await leaf(SEEDS.deviceX, SEEDS.opA, chain);
    const rolledPast = await leaf(SEEDS.deviceY, SEEDS.opA, chain, { root: SEEDS.opA, device: SEEDS.deviceY });
    expect((await exchange(x, rolledPast)).a).toMatchObject({ ok: false });
    const redelegated = await leaf(SEEDS.deviceY, SEEDS.opA, chain);
    expect(redelegated.edge.personaRootDid).toBe(await didOf(SEEDS.opB));
    expect((await exchange(x, redelegated)).a).toMatchObject({ ok: true, peerKey: redelegated.deviceKey });
  });

  test("RED: a hello whose hint names no secret the responder holds draws no box — a forger without the secret opens nothing", async () => {
    const { inception } = await founded();
    const y = await leaf(SEEDS.deviceY, SEEDS.opA, [inception]);
    const forged = startLeafPeerProof({ secrets: [{ opKeyDid: "0x00", secret: new Uint8Array(32).fill(7) }] });
    expect(await answerLeafPeerProof(y, forged.frame)).toEqual({ kind: "unmatched" });
    // A relay that swaps its own ephemeral into an honest hello breaks the hint the same way.
    const x = await leaf(SEEDS.deviceX, SEEDS.opA, [inception]);
    const honest = startLeafPeerProof(x).frame;
    expect(await answerLeafPeerProof(y, { ...honest, eph: forged.state.ephPub })).toEqual({ kind: "unmatched" });
    // CONTROL: the honest hello draws an answer with a box.
    expect((await answerLeafPeerProof(y, honest)).kind).toBe("answer");
  });

  test("RED: the proof box mixes the secret in — the responder's ephemeral and both nonces alone open nothing", async () => {
    const { inception } = await founded();
    const x = await leaf(SEEDS.deviceX, SEEDS.opA, [inception]);
    const y = await leaf(SEEDS.deviceY, SEEDS.opA, [inception]);
    const { frame: hello, state } = startLeafPeerProof(x);
    const answered = await answerLeafPeerProof(y, hello);
    if (answered.kind !== "answer") throw new Error("the control hello drew no answer");
    const box = answered.frame.box;
    const open = (salt: Uint8Array[]) => openFromSender({
      recipientSecret: state.ephSecret, senderEphemeralPub: hexToBytes(box.e), aeadNonce: hexToBytes(box.n),
      ciphertext: hexToBytes(box.c), info: SEAL_INFO, extraSalt: salt,
    });
    // Whoever holds the hello's ephemeral secret — the herm that forged it — and every public byte opens nothing.
    expect(open([hexToBytes(hello.nonce), hexToBytes(answered.frame.nonce)])).toBeNull();
    // CONTROL: the member's own salt, the secret mixed in, opens it.
    expect(open([hexToBytes(hello.nonce), hexToBytes(answered.frame.nonce), x.secrets[0]!.secret])).not.toBeNull();
  });

  test("RED: an INSIDER relay holding the secret swaps its ephemeral key in and still gains nothing the initiator accepts", async () => {
    const { inception } = await founded();
    const x = await leaf(SEEDS.deviceX, SEEDS.opA, [inception]);
    const y = await leaf(SEEDS.deviceY, SEEDS.opA, [inception]);
    const secret = x.secrets[x.secrets.length - 1]!;
    // The insider re-hints its own ephemeral, opens the proof Y seals to it, and re-seals that proof toward X's
    // real ephemeral key. It reads Y's edge — and holds a signature naming its own key, which X's transcript refuses.
    let xEph = "";
    let helloNonce = "";
    let insider: ReturnType<typeof startLeafPeerProof>["state"] | null = null;
    const mitm = relay({
      tamper: (frame, toward) => {
        if (frame.step === "hello" && toward === "b") {
          xEph = frame.eph; helloNonce = frame.nonce;
          insider = startLeafPeerProof({ secrets: [secret] }).state;
          return { step: "hello", nonce: frame.nonce, eph: insider.ephPub, hint: hintFor(secret.secret, frame.nonce, insider.ephPub) };
        }
        if (frame.step === "answer" && toward === "a" && insider) {
          const salt = [hexToBytes(helloNonce), hexToBytes(frame.nonce), secret.secret];
          const plaintext = openFromSender({
            recipientSecret: insider.ephSecret, senderEphemeralPub: hexToBytes(frame.box.e),
            aeadNonce: hexToBytes(frame.box.n), ciphertext: hexToBytes(frame.box.c), info: SEAL_INFO, extraSalt: salt,
          });
          expect(plaintext, "the insider opened the box sealed to it").not.toBeNull();
          const resealed = sealToRecipient({ recipientPub: hexToBytes(xEph), plaintext: plaintext!, info: SEAL_INFO, extraSalt: salt });
          return { ...frame, box: { e: hex(resealed.senderEphemeralPub), n: hex(resealed.aeadNonce), c: hex(resealed.ciphertext) } };
        }
        return frame;
      },
    });
    const { a } = await exchange(x, y, mitm);
    expect(a).toEqual({ ok: false, reason: "the device key did not sign this exchange" });
  });

  test("RED: a hello under an OLDER secret draws the KEL suffix alone, which extends the stale leaf's chain", async () => {
    const { inception } = await founded();
    const chain = await rotatedKeeping([SEEDS.deviceX, SEEDS.deviceY]);
    const ahead = await leaf(SEEDS.deviceX, SEEDS.opA, chain);
    const stale = await leaf(SEEDS.deviceY, SEEDS.opA, [inception]);
    expect(ahead.secrets).toHaveLength(2);
    expect(stale.secrets).toHaveLength(1);
    const { frame: hello, state } = startLeafPeerProof(stale);
    const answered = await answerLeafPeerProof(ahead, hello);
    expect(answered.kind).toBe("catch-up");
    if (answered.kind !== "catch-up") return;
    const caught = await openLeafCatchUp(stale, state, answered.frame);
    expect(caught).toMatchObject({ ok: true });
    if (caught.ok) expect(caught.kel.map((e) => e.eventCid)).toEqual(chain.map((e) => e.eventCid));
    // The ahead leaf's own hello draws `unmatched` from the stale one — it holds no newer secret.
    expect((await answerLeafPeerProof(stale, startLeafPeerProof(ahead).frame)).kind).toBe("unmatched");
    // A catch-up opened under another exchange opens nothing.
    expect(await openLeafCatchUp(stale, startLeafPeerProof(stale).state, answered.frame)).toEqual({ ok: false, reason: "the catch-up does not open for this leaf" });
  });

  test("RED: a channel that proved a different sender key than the edge names is refused", async () => {
    const { inception } = await founded();
    const x = await leaf(SEEDS.deviceX, SEEDS.opA, [inception]);
    const y = await leaf(SEEDS.deviceY, SEEDS.opA, [inception]);
    const { a } = await exchange(x, y, relay({ fromOf: { b: await pubOf(SEEDS.deviceZ) } }));
    expect(a).toEqual({ ok: false, reason: "the channel proved a different key than the edge names" });
    // CONTROL: the channel proving the edge's own key passes.
    const passed = await exchange(x, y, relay({ fromOf: { b: y.deviceKey, a: x.deviceKey } }));
    expect(passed.a).toMatchObject({ ok: true, peerKey: y.deviceKey });
  });

  test("the proof bytes open on their own domain, cover the whole transcript and carry no clock", () => {
    const transcript = { initiatorNonce: "a".repeat(64), initiatorEph: "b".repeat(64), responderNonce: "c".repeat(64), responderEph: "d".repeat(64) };
    const text = new TextDecoder().decode(leafPeerProofBytes({ transcript, role: "responder", proverKey: "e".repeat(64) }));
    expect(JSON.parse(text).domain).toBe(LEAF_PEER_PROOF_DOMAIN);
    expect(Object.keys(JSON.parse(text)).sort()).toEqual(
      ["domain", "initiatorEph", "initiatorNonce", "proverKey", "responderEph", "responderNonce", "role"]);
  });

  test("a finish read without an answer refuses rather than throws", async () => {
    const { inception } = await founded();
    const x = await leaf(SEEDS.deviceX, SEEDS.opA, [inception]);
    const { state, frame } = startLeafPeerProof(x);
    const r = await finishLeafPeerProof(x, state, frame);
    expect(r.verdict.ok).toBe(false);
  });

  test("RED: a relay that swaps the responder's ephemeral key in the answer stands no session it chose", async () => {
    const { inception } = await founded();
    const x = await leaf(SEEDS.deviceX, SEEDS.opA, [inception]);
    const y = await leaf(SEEDS.deviceY, SEEDS.opA, [inception]);
    // The box Y sealed to X's real ephemeral still opens at X; only the clear `eph` field moves. Were the
    // signature blind to the responder's ephemeral, X would pass the proof and agree a session key with the relay.
    const relayEph = startLeafPeerProof(x).state.ephPub;
    const swap = relay({ tamper: (frame, toward) => frame.step === "answer" && toward === "a" ? { ...frame, eph: relayEph } : frame });
    const { a } = await exchange(x, y, swap);
    expect(a).toEqual({ ok: false, reason: "the device key did not sign this exchange" });
  });

  describe("the session a passing proof admits", () => {
    async function proven(): Promise<{ a: LeafPeerSession; b: LeafPeerSession }> {
      const { inception } = await founded();
      const x = await leaf(SEEDS.deviceX, SEEDS.opA, [inception]);
      const y = await leaf(SEEDS.deviceY, SEEDS.opA, [inception]);
      const { a, b } = await exchange(x, y);
      if (!ok(a) || !ok(b)) throw new Error("the control exchange refused");
      return { a: a.session, b: b.session };
    }
    const bytes = (s: string) => new TextEncoder().encode(s);
    const text = (r: ReturnType<LeafPeerSession["open"]>) => r.ok ? new TextDecoder().decode(r.plaintext) : `refused: ${r.reason}`;

    test("CONTROL: each side opens the other's frames in order, both ways", async () => {
      const { a, b } = await proven();
      const f1 = a.seal(bytes("one")); const f2 = a.seal(bytes("two"));
      expect(text(b.open(f1))).toBe("one");
      expect(text(b.open(f2))).toBe("two");
      expect(text(a.open(b.seal(bytes("back"))))).toBe("back");
      expect(a.refusal).toBeNull();
      expect(b.refusal).toBeNull();
    });

    test("RED: a frame the relay injects refuses the session, and the refusal stays", async () => {
      const { a, b } = await proven();
      const forged = { n: "A".repeat(32), c: "B".repeat(40) };
      expect(b.open(forged).ok).toBe(false);
      expect(b.refusal).toMatch(/injected, replayed or reordered/);
      expect(text(b.open(a.seal(bytes("after"))))).toMatch(/^refused/);   // sticky: no frame reads past a refusal
    });

    test("RED: a frame the relay REPLAYS refuses the session", async () => {
      const { a, b } = await proven();
      const f1 = a.seal(bytes("one"));
      expect(text(b.open(f1))).toBe("one");
      expect(b.open(f1).ok).toBe(false);
      expect(b.refusal).not.toBeNull();
    });

    test("RED: frames the relay REORDERS refuse the session", async () => {
      const { a, b } = await proven();
      const f1 = a.seal(bytes("one")); const f2 = a.seal(bytes("two"));
      expect(b.open(f2).ok).toBe(false);
      expect(b.open(f1).ok).toBe(false);
    });

    test("RED: a frame sealed in one direction never opens as the other direction", async () => {
      const { a } = await proven();
      expect(a.open(a.seal(bytes("reflected"))).ok).toBe(false);
    });

    test("RED: a session whose edge the head rolled past reads unlicensed on relicense, and refuses nothing by itself", async () => {
      const { a } = await proven();
      expect((await a.relicense([(await founded()).inception])).ok).toBe(true);   // CONTROL: the head still licenses
      // A rotation rolls every edge the prior op-key signed past — even a device it re-enrolled, whose renewed edge
      // rides sealed to that device alone and shows only on a fresh proof.
      const rolled = await a.relicense(await rotatedKeeping([SEEDS.deviceX, SEEDS.deviceY]));
      expect(rolled.ok).toBe(false);
      expect(typeof rolled.reason).toBe("string");
      expect(a.refusal).toBeNull();
      expect(a.peerEdge.personaRootDid).toBe(await didOf(SEEDS.opA));
    });
  });
});
