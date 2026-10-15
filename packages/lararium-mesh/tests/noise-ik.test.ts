/**
 * noise-ik.test — the Noise IK handshake, proven by published vectors.
 *
 * A pure library with no caller proves itself by vectors alone. The two published test vectors for
 * `Noise_IK_25519_ChaChaPoly_SHA256`, one from each of two independent implementations' vector sets:
 *   · cacophony — https://raw.githubusercontent.com/haskell-cryptography/cacophony/master/vectors/cacophony.txt
 *     (file sha256 3bde7c09a6f349ee11c825c50fcc02649f8f02a47c857a459206b357f9386cae), six messages and a handshake hash;
 *   · snow — https://raw.githubusercontent.com/mcginty/snow/main/tests/vectors/snow.txt
 *     (file sha256 69da433305fd045f6c9f01b656662a389d022688986fd39fbe7af009cd402fd3), four messages.
 * Each set publishes exactly one vector for this protocol name. In both, messages one and two are the
 * handshake; the later ones alternate transport directions, the initiator first.
 *
 * Proven here:
 *   · both vectors reproduce byte for byte, handshake and transport, with cacophony's handshake hash on both sides;
 *   · a transport cipher exists only after message two: neither pending side exposes a key or a cipher, and a
 *     replayed message one yields the same provisional reading and nothing more;
 *   · every failure throws the ONE error with no detail that tells which step failed;
 *   · a wrong pin, a second use, a short message and a low-order key all fail by that name;
 *   · fresh ephemerals yield fresh hashes and keys; transport nonces advance and never rewind;
 *   · the lawful doors take NO ephemeral: a fixed one enters through the vector harness alone, which no source
 *     file imports, since one ephemeral used twice under one static pair reuses a key and a nonce;
 *   · no message passes Noise's 65535-byte bound, written or read;
 *   · the module stays out of the package barrel and reads no clock.
 */
import { readdirSync, readFileSync } from "node:fs";
import { describe, test, expect } from "vitest";
import { hex, hexToBytes } from "../src/crypto.js";
import {
  MIN_MESSAGE1_BYTES, MIN_MESSAGE2_BYTES, NOISE_IK_PROTOCOL, NoiseHandshakeError,
  NOISE_MAX_MESSAGE_BYTES, noiseInitiate, noiseKeyPair, noiseRespond, noiseVectorHarness, type NoiseTransport,
} from "../src/noise-ik.js";

interface Vector {
  readonly source: string;
  readonly init_prologue: string; readonly init_static: string; readonly init_ephemeral: string;
  readonly init_remote_static: string; readonly resp_static: string; readonly resp_ephemeral: string;
  readonly handshake_hash: string | null;
  readonly messages: readonly { readonly payload: string; readonly ciphertext: string }[];
}
const VECTORS: readonly Vector[] = [
  {
    source: "cacophony",
    init_prologue: "4a6f686e2047616c74",
    init_static: "e61ef9919cde45dd5f82166404bd08e38bceb5dfdfded0a34c8df7ed542214d1",
    init_ephemeral: "893e28b9dc6ca8d611ab664754b8ceb7bac5117349a4439a6b0569da977c464a",
    init_remote_static: "31e0303fd6418d2f8c0e78b91f22e8caed0fbe48656dcf4767e4834f701b8f62",
    resp_static: "4a3acbfdb163dec651dfa3194dece676d437029c62a408b4c5ea9114246e4893",
    resp_ephemeral: "bbdb4cdbd309f1a1f2e1456967fe288cadd6f712d65dc7b7793d5e63da6b375b",
    handshake_hash: "0b0f68fb0c27e03ce9b97565995ed4838cc0581b762ef72b062f6a546419fad7",
    messages: [
      { payload: "4c756477696720766f6e204d69736573",
        ciphertext: "ca35def5ae56cec33dc2036731ab14896bc4c75dbb07a61f879f8e3afa4c7944718da798efbcd91528520204f904b9bd6c7413dccdc214d951e15253e39987f18146e8cd0873654207148333479d4d16c289f0294b29960a72f48e0b7bba2e89083169825e59642148d492020664ccf7" },
      { payload: "4d757272617920526f746862617264",
        ciphertext: "95ebc60d2b1fa672c1f46a8aa265ef51bfe38e7ccb39ec5be34069f1448088435361e70b2ed446e6c9ec387d1d6b3b840f194e373979d241b203c4acafccf5" },
      { payload: "462e20412e20486179656b",
        ciphertext: "050e9f3c8fac16b68dbce8f8c4bfbf6617c897f9ada4aa29aa19c8" },
      { payload: "4361726c204d656e676572",
        ciphertext: "344233a6cabb7141d80f3da2fedc311d9646bbb0f505afe403a667" },
      { payload: "4a65616e2d426170746973746520536179",
        ciphertext: "62cdeeb172ad7ade7aa7d9e069da5790f12331bfa00177787a1d0810c67dc3b2b4" },
      { payload: "457567656e2042f6686d20766f6e2042617765726b",
        ciphertext: "029bead1b40992327044d409d9a1f3ad8f36c3c452775d557e18bbeb2e8dfcead32d514024" },
    ],
  },
  {
    source: "snow",
    init_prologue: "5468657265206973206e6f20726967687420616e642077726f6e672e2054686572652773206f6e6c792066756e20616e6420626f72696e672e",
    init_static: "f49f93c5112c0787acc808d61716d7e090e076a58f15a3f78d92773f8dcb473b",
    init_ephemeral: "dae68498c41315cff7e4a34dded8d973199d8f0cf3fcb8b6651c169de77de8be",
    init_remote_static: "2ea5942829bac414e25aa4cbb1bcc43394816ebb1bd12550d7d0eb4415e42951",
    resp_static: "b790546f98b1e933c48cd01f17e7b281469d46fcacc9a3b584ae65b1d6272e8e",
    resp_ephemeral: "c0875a5b59c8492bd2135e5432d7d484f938e0a1f5009428c4bcb70b2f69f69f",
    handshake_hash: null,
    messages: [
      { payload: "95a8f51c435a9530ff1f30868ed7b23ec952eb513c26a0774fed82d2978a8c81",
        ciphertext: "6d21fec9141f3f37cc464e936a48b2d9521b5a44e0f3d960895d3c3fba30282f731f445c25e898e2534ac0536715b24308c108fc46bd260c887b36c3f68e3a05654fc8295c068ed53fb2022560961224e0b10b0835e1efc82fc587cd50f7178fe3d9eb06e0351c6e7334162c10bed670bfa2a105f7b2768a140b3fd597782601" },
      { payload: "b866b807a6d8b83182b884dbfedc861843c5082bd6e480cb54e4245a72083041",
        ciphertext: "e64e1fb8701c4f4bc3850b255fea657d4d835338b059c89acc99628fbe52473b41a4e79e3c1e6abc46bf80f078a005e15d8a3e04f989af3e6cb99b52031165006163ac3e17b928af8c116009d7bf4fb2" },
      { payload: "e3a4937faef391028f759758b428b57652e0069a8dee64dfed01b60846938740",
        ciphertext: "2bebe19102169cdfe79cf41e38930bfd20a5b2fc78ccf33e853ddd939c0983174656eb27b61464a607762848892ca1c0" },
      { payload: "693972f27b0cb98aeac1fb54d782125431e7540e0cb2fa882cf51a8184d724fd",
        ciphertext: "c7c56da33b45d12f4754e17978bd49999c9c8f51d00db460f902aba2e6e245d0c46662f507915de8596f43b1d175f1db" },
    ],
  },
];

const b = hexToBytes;
const text = (s: string): Uint8Array => new TextEncoder().encode(s);
const PROLOGUE = text("a synthetic prologue");
const INIT = noiseKeyPair(new Uint8Array(32).fill(0x11));
const RESP = noiseKeyPair(new Uint8Array(32).fill(0x22));
const OTHER = noiseKeyPair(new Uint8Array(32).fill(0x33));

/** The one error, and nothing that tells which step failed. */
function expectTheOneError(run: () => unknown): void {
  let caught: unknown;
  try { run(); } catch (error) { caught = error; }
  expect(caught).toBeInstanceOf(NoiseHandshakeError);
  const error = caught as NoiseHandshakeError;
  expect(error.message).toBe("noise-handshake-failed");
  expect(error.cause).toBeUndefined();
  expect(Object.getOwnPropertyNames(error).sort()).toEqual(Object.getOwnPropertyNames(new NoiseHandshakeError()).sort());
}

/** One whole exchange over synthetic keys with fresh ephemerals. */
function exchange(payload1 = text("knock"), payload2 = text("answer")) {
  const initiator = noiseInitiate({ prologue: PROLOGUE, s: INIT, rs: RESP.publicKey, payload: payload1 });
  const responder = noiseRespond({ prologue: PROLOGUE, s: RESP, message1: initiator.message1 });
  const written = responder.writeMessage2(payload2);
  const read = initiator.readMessage2(written.message2);
  return { initiator, responder, message2: written.message2, i: read.transport, r: written.transport, payload2Read: read.payload };
}
const flipBit = (bytes: Uint8Array, at: number): Uint8Array => { const out = new Uint8Array(bytes); out[at]! ^= 0x01; return out; };

describe("the published vectors", () => {
  test.each(VECTORS.map((v) => [v.source, v] as const))("★ %s: handshake and transport reproduce byte for byte ★", (_source, v) => {
    const prologue = b(v.init_prologue);
    const initStatic = noiseKeyPair(b(v.init_static)), respStatic = noiseKeyPair(b(v.resp_static));
    expect(hex(respStatic.publicKey)).toBe(v.init_remote_static);      // the vector's pin IS the responder's static
    const [m1, m2, ...transport] = v.messages;

    const initiator = noiseVectorHarness.initiate({ prologue, s: initStatic, rs: b(v.init_remote_static), payload: b(m1!.payload) }, b(v.init_ephemeral));
    expect(hex(initiator.message1)).toBe(m1!.ciphertext);

    const responder = noiseVectorHarness.respond({ prologue, s: respStatic, message1: b(m1!.ciphertext) }, b(v.resp_ephemeral));
    expect(hex(responder.payload)).toBe(m1!.payload);
    expect(hex(responder.initiatorStatic)).toBe(hex(initStatic.publicKey));

    const written = responder.writeMessage2(b(m2!.payload));
    expect(hex(written.message2)).toBe(m2!.ciphertext);
    const read = initiator.readMessage2(b(m2!.ciphertext));
    expect(hex(read.payload)).toBe(m2!.payload);

    expect(hex(read.transport.handshakeHash)).toBe(hex(written.transport.handshakeHash));
    if (v.handshake_hash !== null) expect(hex(read.transport.handshakeHash)).toBe(v.handshake_hash);

    expect(transport.length).toBeGreaterThanOrEqual(2);
    transport.forEach((m, n) => {
      const [from, to]: [NoiseTransport, NoiseTransport] = n % 2 === 0 ? [read.transport, written.transport] : [written.transport, read.transport];
      const sealed = from.send.seal(b(m.payload));
      expect(hex(sealed)).toBe(m.ciphertext);
      expect(hex(to.receive.open(sealed))).toBe(m.payload);
    });
  });

  test("two vector sets, one protocol name, and a handshake hash published for at least one", () => {
    expect(NOISE_IK_PROTOCOL).toBe("Noise_IK_25519_ChaChaPoly_SHA256");
    expect(VECTORS.map((v) => v.source)).toEqual(["cacophony", "snow"]);
    expect(VECTORS.filter((v) => v.handshake_hash !== null)).toHaveLength(1);
    expect(VECTORS[0]!.init_static).not.toBe(VECTORS[1]!.init_static);
  });
});

describe("no transport before message two", () => {
  test("★ neither pending side exposes a key or a cipher ★", () => {
    const initiator = noiseInitiate({ prologue: PROLOGUE, s: INIT, rs: RESP.publicKey, payload: text("knock") });
    const responder = noiseRespond({ prologue: PROLOGUE, s: RESP, message1: initiator.message1 });
    expect(Object.keys(initiator).sort()).toEqual(["message1", "readMessage2"]);
    expect(Object.keys(responder).sort()).toEqual(["initiatorStatic", "payload", "writeMessage2"]);
    for (const pending of [initiator, responder] as readonly object[]) {
      for (const name of ["transport", "send", "receive", "ck", "k", "h", "e", "handshakeHash"]) expect(name in pending).toBe(false);
      const visible = JSON.stringify(pending, (_k, value) => (value instanceof Uint8Array ? hex(value) : value));
      expect(visible).not.toContain(hex(INIT.secretKey));
      expect(visible).not.toContain(hex(RESP.secretKey));
    }
    // CONTROL: the finished exchange yields ciphers that interoperate both ways.
    const done = exchange();
    expect(new TextDecoder().decode(done.r.receive.open(done.i.send.seal(text("to the gate"))))).toBe("to the gate");
    expect(new TextDecoder().decode(done.i.receive.open(done.r.send.seal(text("to the dialer"))))).toBe("to the dialer");
  });

  test("a replayed message one reads the same provisional payload and static, and proves no live dialer", () => {
    const initiator = noiseInitiate({ prologue: PROLOGUE, s: INIT, rs: RESP.publicKey, payload: text("knock") });
    const first = noiseRespond({ prologue: PROLOGUE, s: RESP, message1: initiator.message1 });
    const replay = noiseRespond({ prologue: PROLOGUE, s: RESP, message1: new Uint8Array(initiator.message1) });
    expect(hex(replay.payload)).toBe(hex(first.payload));
    expect(hex(replay.initiatorStatic)).toBe(hex(INIT.publicKey));
    // Each responder answers under its own ephemeral: the replayer, holding no initiator state, reads neither answer,
    // and the real initiator finishes with exactly one of them.
    const a = first.writeMessage2(text("answer")), c = replay.writeMessage2(text("answer"));
    expect(hex(a.message2)).not.toBe(hex(c.message2));
    expect(hex(a.transport.handshakeHash)).not.toBe(hex(c.transport.handshakeHash));
    const finished = initiator.readMessage2(a.message2);
    expect(hex(finished.transport.handshakeHash)).toBe(hex(a.transport.handshakeHash));
    expectTheOneError(() => c.transport.receive.open(finished.transport.send.seal(text("x"))));
  });
});

describe("one error, and silence about the step", () => {
  test("★ one flipped bit anywhere in message one, message two or the prologue fails by the one name ★", () => {
    const payload = text("knock");
    const initiator = noiseInitiate({ prologue: PROLOGUE, s: INIT, rs: RESP.publicKey, payload });
    const m1 = initiator.message1;
    expect(m1.length).toBe(MIN_MESSAGE1_BYTES + payload.length);
    // ephemeral (0..31) · encrypted static (32..63) · its tag (64..79) · payload (80..) · payload tag (last 16)
    for (const at of [0, 31, 32, 63, 64, 79, 80, m1.length - 17, m1.length - 16, m1.length - 1]) {
      expectTheOneError(() => noiseRespond({ prologue: PROLOGUE, s: RESP, message1: flipBit(m1, at) }));
    }
    expectTheOneError(() => noiseRespond({ prologue: flipBit(PROLOGUE, 0), s: RESP, message1: m1 }));
    const responder = noiseRespond({ prologue: PROLOGUE, s: RESP, message1: m1 });          // CONTROL
    const { message2 } = responder.writeMessage2(text("answer"));
    expect(message2.length).toBe(MIN_MESSAGE2_BYTES + text("answer").length);
    for (const at of [0, 31, 32, message2.length - 17, message2.length - 16, message2.length - 1]) {
      const fresh = noiseInitiate({ prologue: PROLOGUE, s: INIT, rs: RESP.publicKey, payload });
      const answer = noiseRespond({ prologue: PROLOGUE, s: RESP, message1: fresh.message1 }).writeMessage2(text("answer"));
      expectTheOneError(() => fresh.readMessage2(flipBit(answer.message2, at)));
    }
    expect(new TextDecoder().decode(initiator.readMessage2(message2).payload)).toBe("answer");   // CONTROL
  });

  test("a wrong pin, a second use, a short message and a low-order key fail by the same name", () => {
    const pinnedWrong = noiseInitiate({ prologue: PROLOGUE, s: INIT, rs: OTHER.publicKey });
    expectTheOneError(() => noiseRespond({ prologue: PROLOGUE, s: RESP, message1: pinnedWrong.message1 }));
    expect(() => noiseRespond({ prologue: PROLOGUE, s: OTHER, message1: pinnedWrong.message1 })).not.toThrow();   // CONTROL

    const done = exchange();
    expectTheOneError(() => done.initiator.readMessage2(done.message2));
    expectTheOneError(() => done.responder.writeMessage2());

    const m1 = noiseInitiate({ prologue: PROLOGUE, s: INIT, rs: RESP.publicKey }).message1;
    expect(m1.length).toBe(96);
    expectTheOneError(() => noiseRespond({ prologue: PROLOGUE, s: RESP, message1: m1.slice(0, 95) }));
    expectTheOneError(() => noiseRespond({ prologue: PROLOGUE, s: RESP, message1: new Uint8Array(0) }));
    const pending = noiseInitiate({ prologue: PROLOGUE, s: INIT, rs: RESP.publicKey });
    expectTheOneError(() => pending.readMessage2(new Uint8Array(47)));

    // The all-zero key is low-order: every party would derive one shared secret. The curve library refuses it
    // and the module's own all-zero check stands behind that, so this vector holds whichever of the two reads it.
    expectTheOneError(() => noiseInitiate({ prologue: PROLOGUE, s: INIT, rs: new Uint8Array(32) }));
    expectTheOneError(() => noiseInitiate({ prologue: PROLOGUE, s: INIT, rs: new Uint8Array(31).fill(9) }));
    expectTheOneError(() => noiseKeyPair(new Uint8Array(31)));
    // A low-order ephemeral in message one refuses before any reading.
    const lowOrder = new Uint8Array(m1); lowOrder.fill(0, 0, 32);
    expectTheOneError(() => noiseRespond({ prologue: PROLOGUE, s: RESP, message1: lowOrder }));
  });
});

describe("fresh ephemerals, and a transport that only moves forward", () => {
  test("both sides hold one hash; two exchanges share nothing", () => {
    const a = exchange(), c = exchange();
    expect(hex(a.i.handshakeHash)).toBe(hex(a.r.handshakeHash));
    expect(a.i.handshakeHash).toHaveLength(32);
    expect(hex(a.initiator.message1)).not.toBe(hex(c.initiator.message1));
    expect(hex(a.i.handshakeHash)).not.toBe(hex(c.i.handshakeHash));
    const sealedA = a.i.send.seal(text("same")), sealedC = c.i.send.seal(text("same"));
    expect(hex(sealedA)).not.toBe(hex(sealedC));
    expectTheOneError(() => c.r.receive.open(sealedA));                  // one exchange's key opens nothing of another's
    expect(new TextDecoder().decode(a.r.receive.open(sealedA))).toBe("same");
    expect(new TextDecoder().decode(a.payload2Read)).toBe("answer");
    // The hash handed out is a copy: a caller that scribbles on it moves nothing.
    a.i.handshakeHash.fill(0);
    expect(new TextDecoder().decode(a.r.receive.open(a.i.send.seal(text("still"))))).toBe("still");
  });

  test("nonces advance; a replayed or cross-direction ciphertext fails; associated data binds", () => {
    const { i, r } = exchange();
    const one = i.send.seal(text("same")), two = i.send.seal(text("same"));
    expect(hex(one)).not.toBe(hex(two));
    expect(one.length).toBe(4 + 16);
    expect(new TextDecoder().decode(r.receive.open(one))).toBe("same");
    expectTheOneError(() => r.receive.open(one));                       // the receive nonce moved on
    const back = r.send.seal(text("reply"));
    expectTheOneError(() => r.receive.open(back));                      // its own direction never opens it
    expect(new TextDecoder().decode(i.receive.open(back))).toBe("reply");
    // A failed open moves nothing: after two refusals the next lawful ciphertext still opens in its place.
    expect(new TextDecoder().decode(r.receive.open(two))).toBe("same");
    const bound = i.send.seal(text("bound"), text("ad"));
    expectTheOneError(() => r.receive.open(bound, text("other")));
    expect(new TextDecoder().decode(r.receive.open(bound, text("ad")))).toBe("bound");
  });

  test("the empty-payload sizes the header budget leans on", () => {
    expect(MIN_MESSAGE1_BYTES).toBe(96);
    expect(MIN_MESSAGE2_BYTES).toBe(48);
    const initiator = noiseInitiate({ prologue: new Uint8Array(0), s: INIT, rs: RESP.publicKey });
    expect(initiator.message1.length).toBe(MIN_MESSAGE1_BYTES);
    const { message2 } = noiseRespond({ prologue: new Uint8Array(0), s: RESP, message1: initiator.message1 }).writeMessage2();
    expect(message2.length).toBe(MIN_MESSAGE2_BYTES);
  });
});

describe("a fixed ephemeral enters through the vector harness alone", () => {
  test("★ the lawful doors take no ephemeral, and ignore one a caller smuggles in ★", () => {
    const smuggled = { prologue: PROLOGUE, s: INIT, rs: RESP.publicKey, payload: text("knock"), ephemeral: () => new Uint8Array(32).fill(0x44) };
    const one = noiseInitiate(smuggled), two = noiseInitiate(smuggled);
    expect(hex(one.message1.slice(0, 32))).not.toBe(hex(two.message1.slice(0, 32)));      // two fresh ephemerals
    expect(hex(one.message1)).not.toBe(hex(two.message1));
    const answered = { prologue: PROLOGUE, s: RESP, message1: one.message1, ephemeral: () => new Uint8Array(32).fill(0x55) };
    expect(hex(noiseRespond(answered).writeMessage2().message2)).not.toBe(hex(noiseRespond(answered).writeMessage2().message2));
    // The reason the doors refuse it: one ephemeral used twice under one static pair writes two first messages
    // under ONE key and ONE nonce. So even the harness spends a fixed ephemeral: its second use refuses, on
    // either side, whatever the payload.
    const fixedE = new Uint8Array(32).fill(0x44);
    const a = noiseVectorHarness.initiate({ prologue: PROLOGUE, s: INIT, rs: RESP.publicKey, payload: text("knock-a") }, fixedE);
    expect(hex(a.message1.slice(0, 32))).toBe(hex(noiseKeyPair(fixedE).publicKey));        // KNOWN POSITIVE: the harness does fix it
    expectTheOneError(() => noiseVectorHarness.initiate({ prologue: PROLOGUE, s: INIT, rs: RESP.publicKey, payload: text("knock-c") }, fixedE));
    expectTheOneError(() => noiseVectorHarness.respond({ prologue: PROLOGUE, s: RESP, message1: a.message1 }, new Uint8Array(fixedE)));
    expect(hex(fixedE)).toBe("44".repeat(32));                                             // the harness copies; the caller's bytes stand
    expectTheOneError(() => noiseVectorHarness.initiate({ prologue: PROLOGUE, s: INIT, rs: RESP.publicKey }, new Uint8Array(31)));
  });

  test("no source file of the package names the harness", () => {
    const src = new URL("../src/", import.meta.url);
    const files = (readdirSync(src, { recursive: true }) as string[]).filter((f) => f.endsWith(".ts"));
    expect(files.length).toBeGreaterThan(100);
    const naming = files.filter((f) => readFileSync(new URL(f, src), "utf8").includes("noiseVectorHarness"));
    expect(naming).toEqual(["noise-ik.ts"]);                                               // KNOWN POSITIVE: its own definition
  });
});

describe("no message passes the 65535-byte bound", () => {
  test("a handshake payload or a transport message past the bound refuses; one at the bound passes", () => {
    expect(NOISE_MAX_MESSAGE_BYTES).toBe(65535);
    const most1 = new Uint8Array(NOISE_MAX_MESSAGE_BYTES - MIN_MESSAGE1_BYTES);
    const widest = noiseInitiate({ prologue: PROLOGUE, s: INIT, rs: RESP.publicKey, payload: most1 });
    expect(widest.message1.length).toBe(NOISE_MAX_MESSAGE_BYTES);                          // CONTROL
    const responder = noiseRespond({ prologue: PROLOGUE, s: RESP, message1: widest.message1 });
    expect(responder.payload.length).toBe(most1.length);
    expectTheOneError(() => noiseInitiate({ prologue: PROLOGUE, s: INIT, rs: RESP.publicKey, payload: new Uint8Array(most1.length + 1) }));
    expectTheOneError(() => noiseRespond({ prologue: PROLOGUE, s: RESP, message1: new Uint8Array(NOISE_MAX_MESSAGE_BYTES + 1) }));
    const most2 = new Uint8Array(NOISE_MAX_MESSAGE_BYTES - MIN_MESSAGE2_BYTES);
    const second = noiseRespond({ prologue: PROLOGUE, s: RESP, message1: noiseInitiate({ prologue: PROLOGUE, s: INIT, rs: RESP.publicKey }).message1 });
    expectTheOneError(() => second.writeMessage2(new Uint8Array(most2.length + 1)));
    const pending = noiseInitiate({ prologue: PROLOGUE, s: INIT, rs: RESP.publicKey });
    expectTheOneError(() => pending.readMessage2(new Uint8Array(NOISE_MAX_MESSAGE_BYTES + 1)));

    const { i, r } = exchange();
    const atBound = i.send.seal(new Uint8Array(NOISE_MAX_MESSAGE_BYTES - 16));
    expect(atBound.length).toBe(NOISE_MAX_MESSAGE_BYTES);
    expect(r.receive.open(atBound).length).toBe(NOISE_MAX_MESSAGE_BYTES - 16);            // CONTROL
    expectTheOneError(() => i.send.seal(new Uint8Array(NOISE_MAX_MESSAGE_BYTES - 15)));
    expectTheOneError(() => r.receive.open(new Uint8Array(NOISE_MAX_MESSAGE_BYTES + 1)));
    // A refused seal moved no nonce: the next lawful message still opens in its place.
    expect(new TextDecoder().decode(r.receive.open(i.send.seal(text("after"))))).toBe("after");
  });
});

describe("the module stays out of the barrel and reads no clock", () => {
  test("the barrel names it nowhere; its source names no clock, timer or platform module", () => {
    const barrel = readFileSync(new URL("../src/index.ts", import.meta.url), "utf8");
    expect(barrel).not.toContain("./noise-ik.js");
    expect(barrel).toContain("./crypto.js");                                 // KNOWN POSITIVE
    const source = readFileSync(new URL("../src/noise-ik.ts", import.meta.url), "utf8");
    for (const banned of [/\bDate\b/, /performance\./, /setTimeout|setInterval/, /node:/]) expect(banned.test(source)).toBe(false);
    expect(/\bDate\b/.test(readFileSync(new URL("../src/tiddler-store.ts", import.meta.url), "utf8"))).toBe(true);   // KNOWN POSITIVE
  });
});
