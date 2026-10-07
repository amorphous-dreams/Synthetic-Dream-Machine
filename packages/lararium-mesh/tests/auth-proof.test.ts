/**
 * auth-wire — authProofBytes (V3 proof-of-possession, the canonical what-to-sign)
 * + verifyAuthProof (the Ed25519 verifier half). Locks the gate-bound challenge
 * blob and proves real keys round-trip + relay/replay/tamper get rejected.
 */

import { describe, test, expect, beforeAll } from "vitest";
import * as ed25519 from "@noble/ed25519";
import {
  authProofBytes, buildAuthResponse, verifyAuthProof, evaluateAuthProof, runPeerHandshake,
  authOkBytes, verifyAuthOk, ed25519VerifyingKeyFromSeed,
  ed25519SignerFromSeed, AUTH_PROOF_TTL_MS,
  mkLarChallenge, mkLarAuthOk, mkLarAuthDenied, isLarAuthMsg, isPresentedAdmit,
} from "../src/auth-wire.js";
import { canonicalJsonBytes, hex } from "../src/crypto.js";
import { carriageEntryActCid } from "../src/carriage-registry.js";
import type { LarAuthMsg, PresentedAdmit } from "../src/auth-wire.js";
import { carriageAct } from "./fixtures/carriage.js";
import { AUTH_OK_DOMAIN, AUTH_PROOF_DOMAIN } from "../src/domains.js";

const base = {
  nonce:      "ab12cd",
  gatePubKey: "gate-pk-hex",
  peerPubKey: "peer-pk-hex",
  aud:        "lar:///ha.ka.ba/bags/daemon",
  ts:         "2026-06-07T00:00:00Z",
  leafNonce:  "ef".repeat(32),
};

// A real quorum-signed admit and the counted acts it cites — the subject's own presentation at the wire.
const EPOCH = "epoch-cid-genesis";
async function presentedAdmitFixture(): Promise<PresentedAdmit> {
  const kahu = [1, 2].map((n) => new Uint8Array(32).fill(n));
  const subject = new Uint8Array(32).fill(5);
  const first = await carriageAct(subject, "admit", { kahu, epoch: EPOCH });
  const revoke = await carriageAct(subject, "revoke", { kahu, epoch: EPOCH, parents: [carriageEntryActCid(first)] });
  const admit = await carriageAct(subject, "admit", { kahu, epoch: EPOCH, parents: [carriageEntryActCid(revoke)] });
  return { admit, lineage: [first, revoke] };
}

describe("authProofBytes (V3 proof-of-possession)", () => {
  test("deterministic over the same parts", () => {
    expect(authProofBytes(base)).toEqual(authProofBytes(base));
  });

  test("binds the gate pubkey — changing it changes the bytes (gate-binding / anti-relay)", () => {
    expect(authProofBytes(base)).not.toEqual(authProofBytes({ ...base, gatePubKey: "other-gate" }));
  });

  test("binds the nonce — changing it changes the bytes (anti-replay)", () => {
    expect(authProofBytes(base)).not.toEqual(authProofBytes({ ...base, nonce: "ff9900" }));
  });

  test("binds the peer pubkey — changing it changes the bytes", () => {
    expect(authProofBytes(base)).not.toEqual(authProofBytes({ ...base, peerPubKey: "imposter" }));
  });
});

describe("buildAuthResponse (V3 peer half)", () => {
  const parts = { ...base, contactCard: "card-json" };

  test("signs exactly authProofBytes and returns a lar:auth with sig + ts", async () => {
    let signed: Uint8Array | undefined;
    const msg = await buildAuthResponse({ ...parts, sign: (b) => { signed = b; return "deadbeef"; } });
    expect(signed).toEqual(authProofBytes(base));
    expect(msg.type).toBe("lar:auth");
    expect(msg.sig).toBe("deadbeef");
    expect(msg.ts).toBe(parts.ts);
    expect(msg.contactCard).toBe("card-json");
    expect(msg.nonce).toBe(parts.nonce);
  });

  test("gate-binding carries through — a different gate pubkey changes the signed bytes", async () => {
    const cap: Uint8Array[] = [];
    await buildAuthResponse({ ...parts, sign: (b) => { cap.push(b); return "x"; } });
    await buildAuthResponse({ ...parts, gatePubKey: "other-gate", sign: (b) => { cap.push(b); return "x"; } });
    expect(cap[0]).not.toEqual(cap[1]);
  });

  test("CONTROL: the proof signature does NOT cover the presented admit — the bundle is public and binds to the socket through the vessel-key edge", async () => {
    const presentedAdmit = await presentedAdmitFixture();
    let plainSigned: Uint8Array | undefined;
    let presentedSigned: Uint8Array | undefined;
    await buildAuthResponse({ ...parts, sign: (bytes) => { plainSigned = bytes; return "x"; } });
    await buildAuthResponse({ ...parts, presentedAdmit, sign: (bytes) => { presentedSigned = bytes; return "x"; } });
    expect(presentedSigned).toEqual(plainSigned);
    expect(presentedSigned).toEqual(authProofBytes(base));
  });

  test("a presented admit round-trips byte-identical through build, the wire and the guard", async () => {
    const presentedAdmit = await presentedAdmitFixture();
    const msg = await buildAuthResponse({ ...parts, presentedAdmit, sign: () => "x" });
    const wire = JSON.parse(JSON.stringify(msg)) as unknown;
    expect(isLarAuthMsg(wire)).toBe(true);
    const carried = (wire as LarAuthMsg).presentedAdmit;
    expect(isPresentedAdmit(carried)).toBe(true);
    expect(canonicalJsonBytes(carried)).toEqual(canonicalJsonBytes(presentedAdmit));
    expect(JSON.stringify(carried)).toBe(JSON.stringify(presentedAdmit));
    // TAMPER PROBE: one moved signature byte in the lineage moves the decoded bytes; the structural guard
    // still passes it, because the guard reads shape and leaves every signature to the receiver's fold.
    const cited = presentedAdmit.lineage[1]!;
    const sig0 = cited.signatures[0]!;
    const tampered: PresentedAdmit = {
      ...presentedAdmit,
      lineage: [presentedAdmit.lineage[0]!, {
        ...cited,
        signatures: [{ ...sig0, sig: (sig0.sig[0] === "0" ? "1" : "0") + sig0.sig.slice(1) }, ...cited.signatures.slice(1)],
      }],
    };
    expect(canonicalJsonBytes(tampered)).not.toEqual(canonicalJsonBytes(presentedAdmit));
    expect(isPresentedAdmit(tampered)).toBe(true);
  });

  test("CONTROL: a lar:auth presenting nothing carries no presentedAdmit key", async () => {
    const msg = await buildAuthResponse({ ...parts, sign: () => "x" });
    expect("presentedAdmit" in msg).toBe(false);
    expect(isLarAuthMsg(JSON.parse(JSON.stringify(msg)))).toBe(true);
  });

  test("a malformed presented admit fails the guard, and the whole lar:auth with it", async () => {
    const good = await presentedAdmitFixture();
    const msg = await buildAuthResponse({ ...parts, presentedAdmit: good, sign: () => "x" });
    const { admit, lineage } = good;
    const malformed: unknown[] = [
      null, "bundle", [], {},
      { admit },                                                              // no lineage
      { lineage },                                                            // no admit
      { admit, lineage: "not-an-array" },
      { admit: { ...admit, action: "revoke" }, lineage },                     // the presented act must be an admit
      { admit: { ...admit, kind: "carriage-entry" }, lineage },               // wrong domain
      { admit: { ...admit, nym: "zz".repeat(32) }, lineage },                 // nym not hex
      { admit: { ...admit, parents: "p" }, lineage },
      { admit: { ...admit, parents: [7] }, lineage },
      { admit: { ...admit, sealEpochCid: "" }, lineage },
      { admit: { ...admit, signatures: [{ signer: 1, sig: "x" }] }, lineage },
      { admit: { ...admit, contractSig: { signer: admit.nym } }, lineage },
      { admit, lineage: [...lineage, null] },
      { admit, lineage: [{ ...lineage[0]!, nym: "ab".repeat(32) }] },         // a lineage act for ANOTHER nym
      { admit, lineage: [{ ...lineage[0]!, sealEpochCid: "other-epoch" }] },  // a lineage act under ANOTHER epoch
      { admit, lineage: [{ ...lineage[0]!, action: "carry" }] },              // a place act never sits in an operator lineage
    ];
    for (const bad of malformed) {
      expect(isPresentedAdmit(bad), JSON.stringify(bad)?.slice(0, 80)).toBe(false);
      expect(isLarAuthMsg({ ...msg, presentedAdmit: bad })).toBe(false);
    }
    expect(isPresentedAdmit(good)).toBe(true);                                // CONTROL: the well-formed bundle passes
    expect(isPresentedAdmit({ admit, lineage: [] })).toBe(true);              // CONTROL: a genesis admit cites no lineage
  });
});

describe("runPeerHandshake (platform-blind V3 peer half)", () => {
  const GATE_SEED = new Uint8Array(32).fill(41);
  const PEER_KEY  = "7".repeat(64);
  const AUD       = "lar:///ha.ka.ba/bags/daemon";

  /**
   * A gate on the far side of a duplex: it sends `first`, then answers the leaf's lar:auth with `answer(auth)`.
   * `answer` sees the leaf's own fresh nonce, so a signed verdict can commit to it the way a real gate's does.
   */
  function shore(first: unknown, answer?: (auth: LarAuthMsg) => Promise<unknown> | unknown) {
    const sent: LarAuthMsg[] = [];
    let calls = 0;
    return {
      recv:        async () => (calls++ === 0 ? first : answer ? answer(sent[0]!) : undefined),
      send:        (m: LarAuthMsg) => { sent.push(m); },
      contactCard: "card", peerPubKey: PEER_KEY, gatePubKey: "", aud: AUD,
      sign:        () => "sig-hex",
      now:         () => "2026-06-07T00:00:00Z",
      sent,
    };
  }
  /** The gate's verdict: signed by `seed` over this exchange (or over `override`'s values). */
  const signedOk = (seed: Uint8Array, nonce: string, override: Partial<Parameters<typeof authOkBytes>[0]> = {}) =>
    async (auth: LarAuthMsg) => {
      const gatePubKey = await ed25519VerifyingKeyFromSeed(GATE_SEED);
      const sig = await ed25519SignerFromSeed(seed)(authOkBytes({
        nonce, leafNonce: auth.leafNonce, gatePubKey, peerPubKey: PEER_KEY, aud: AUD, ...override,
      }));
      return mkLarAuthOk(sig);
    };
  const pinnedGate = () => ed25519VerifyingKeyFromSeed(GATE_SEED);

  test("CONTROL: challenge → signed lar:auth → the PINNED gate's signed auth-ok ⇒ { ok: true }", async () => {
    const s = { ...shore(mkLarChallenge("n1"), signedOk(GATE_SEED, "n1")), gatePubKey: await pinnedGate() };
    const r = await runPeerHandshake(s);
    expect(r.ok).toBe(true);
    expect(s.sent).toHaveLength(1);
    expect(s.sent[0]!.type).toBe("lar:auth");
    expect(s.sent[0]!.sig).toBe("sig-hex");
    expect(s.sent[0]!.nonce).toBe("n1");
    expect(s.sent[0]!.leafNonce).toMatch(/^[0-9a-f]{64}$/);
  });

  test("RED: a relay in the middle that answers auth-ok without the gate's key is refused", async () => {
    const relaySeed = new Uint8Array(32).fill(42);
    const s = { ...shore(mkLarChallenge("n1"), signedOk(relaySeed, "n1")), gatePubKey: await pinnedGate() };
    expect(await runPeerHandshake(s)).toEqual({ ok: false, reason: "the verdict carries no signature of the pinned gate key" });
  });

  test("RED: a recorded verdict the gate signed for another leaf nonce is refused", async () => {
    const s = {
      ...shore(mkLarChallenge("n1"), signedOk(GATE_SEED, "n1", { leafNonce: "00".repeat(32) })),
      gatePubKey: await pinnedGate(),
    };
    expect((await runPeerHandshake(s)).ok).toBe(false);
  });

  test("RED: an unsigned auth-ok is no verdict at all", async () => {
    const s = { ...shore(mkLarChallenge("n1"), () => ({ type: "lar:auth-ok" })), gatePubKey: await pinnedGate() };
    expect((await runPeerHandshake(s)).ok).toBe(false);
  });

  test("forwards the dialed island's presented admit onto the lar:auth", async () => {
    const presentedAdmit = await presentedAdmitFixture();
    const s = { ...shore(mkLarChallenge("n1"), signedOk(GATE_SEED, "n1")), gatePubKey: await pinnedGate(), presentedAdmit };
    expect((await runPeerHandshake(s)).ok).toBe(true);
    expect(s.sent[0]!.presentedAdmit).toEqual(presentedAdmit);
  });

  test("auth-denied ⇒ { ok:false, reason }", async () => {
    const s = shore(mkLarChallenge("n1"), () => mkLarAuthDenied("insufficient cap"));
    expect(await runPeerHandshake(s)).toEqual({ ok: false, reason: "insufficient cap" });
  });

  test("wrong first message ⇒ rejects before sending anything", async () => {
    const s = shore(mkLarAuthOk("00".repeat(64)));
    const r = await runPeerHandshake(s);
    expect(r.ok).toBe(false);
    expect(s.sent).toHaveLength(0);
  });
});

describe("authOkBytes / verifyAuthOk (the gate's signed verdict)", () => {
  const parts = {
    nonce: "n1", leafNonce: "ab".repeat(32), gatePubKey: "", peerPubKey: "cd".repeat(32), aud: "lar:///x",
  };
  test("the verdict opens on its own domain, apart from the leaf's proof", () => {
    expect(AUTH_OK_DOMAIN).not.toBe(AUTH_PROOF_DOMAIN);
    const text = new TextDecoder().decode(authOkBytes({ ...parts, gatePubKey: "ee".repeat(32) }));
    expect(JSON.parse(text).domain).toBe(AUTH_OK_DOMAIN);
    // No clock rides it.
    expect(Object.keys(JSON.parse(text)).sort()).toEqual(["aud", "domain", "gatePubKey", "leafNonce", "nonce", "peerPubKey"]);
  });
  test("each bound value moves the verdict: another audience, leaf or gate key fails the check", async () => {
    const seed = new Uint8Array(32).fill(43);
    const gatePubKey = await ed25519VerifyingKeyFromSeed(seed);
    const sig = await ed25519SignerFromSeed(seed)(authOkBytes({ ...parts, gatePubKey }));
    expect(await verifyAuthOk({ ...parts, gatePubKey, sig })).toBe(true);                          // control
    expect(await verifyAuthOk({ ...parts, gatePubKey, sig, aud: "lar:///y" })).toBe(false);
    expect(await verifyAuthOk({ ...parts, gatePubKey, sig, peerPubKey: "ce".repeat(32) })).toBe(false);
    expect(await verifyAuthOk({ ...parts, gatePubKey: await ed25519VerifyingKeyFromSeed(new Uint8Array(32).fill(44)), sig })).toBe(false);
    expect(await verifyAuthOk({ ...parts, gatePubKey, sig: "zz" })).toBe(false);
  });
});

describe("verifyAuthProof (V3 verifier half — real Ed25519 keys)", () => {
  // A real peer keypair; peerPubKey = the raw 32-byte verifying-key hex.
  let peerPub: string;
  let sign: (bytes: Uint8Array) => Promise<string>;

  const challenge = {
    nonce:      "ab12cd",
    gatePubKey: "00".repeat(32),                 // stands for the verifier's own key
    aud:        "lar:///ha.ka.ba/bags/daemon",
    ts:         "2026-06-07T00:00:00.000Z",
    leafNonce:  "ef".repeat(32),
  };

  // Build a signed lar:auth the way a real peer would, then verify it.
  async function signedProof(over = challenge, peer = peerPub) {
    const msg = await buildAuthResponse({
      ...over, peerPubKey: peer, contactCard: "card-json", sign,
    });
    return { sig: msg.sig, ts: msg.ts! };
  }

  beforeAll(async () => {
    const priv = ed25519.utils.randomSecretKey();
    peerPub = hex(await ed25519.getPublicKeyAsync(priv));
    sign = async (bytes) => hex(await ed25519.signAsync(bytes, priv));
  });

  test("returns relation-scoped evidence for checked, unavailable, stale, malformed, and rejected proofs", async () => {
    const { sig, ts } = await signedProof();
    expect(await evaluateAuthProof({ ...challenge, peerPubKey: peerPub, sig, ts, now: Date.parse(ts) })).toMatchObject({
      relation: "daemon-proof-of-possession", state: "checked-valid", cryptographicallyValid: true,
    });
    expect(await evaluateAuthProof({ ...challenge, peerPubKey: peerPub, sig, ts })).toMatchObject({
      relation: "daemon-proof-of-possession", state: "unavailable", cryptographicallyValid: true,
    });
    expect(await evaluateAuthProof({ ...challenge, peerPubKey: peerPub, sig, ts, now: Date.parse(ts) + AUTH_PROOF_TTL_MS + 1 })).toMatchObject({
      relation: "daemon-proof-of-possession", state: "stale", cryptographicallyValid: false,
    });
    expect(await evaluateAuthProof({ ...challenge, peerPubKey: "xyz", sig, ts })).toMatchObject({
      relation: "daemon-proof-of-possession", state: "malformed", cryptographicallyValid: false,
    });
    expect(await evaluateAuthProof({ ...challenge, peerPubKey: peerPub, sig: "ab".repeat(64), ts })).toMatchObject({
      relation: "daemon-proof-of-possession", state: "rejected", cryptographicallyValid: false,
    });
  });

  test("a genuine signature over the gate-bound proof clears", async () => {
    const { sig, ts } = await signedProof();
    expect(await verifyAuthProof({ ...challenge, peerPubKey: peerPub, sig, ts }))
      .toEqual({ ok: true });
  });

  test("anti-relay: a proof signed for a DIFFERENT gate fails against this gate", async () => {
    const { sig, ts } = await signedProof({ ...challenge, gatePubKey: "11".repeat(32) });
    const r = await verifyAuthProof({ ...challenge, peerPubKey: peerPub, sig, ts });
    expect(r.ok).toBe(false);
  });

  test("anti-replay: a proof signed for a different nonce fails", async () => {
    const { sig, ts } = await signedProof({ ...challenge, nonce: "ff9900" });
    expect((await verifyAuthProof({ ...challenge, peerPubKey: peerPub, sig, ts })).ok).toBe(false);
  });

  test("imposter: a signature checked against a different peer key fails", async () => {
    const { sig, ts } = await signedProof();
    const otherPub = hex(await ed25519.getPublicKeyAsync(ed25519.utils.randomSecretKey()));
    expect((await verifyAuthProof({ ...challenge, peerPubKey: otherPub, sig, ts })).ok).toBe(false);
  });

  test("freshness window: a stale ts past the TTL is rejected when `now` is supplied", async () => {
    const { sig, ts } = await signedProof();
    const stale = Date.parse(challenge.ts) + AUTH_PROOF_TTL_MS + 1_000;
    const r = await verifyAuthProof({ ...challenge, peerPubKey: peerPub, sig, ts, now: stale });
    expect(r).toEqual({ ok: false, reason: "proof outside freshness window" });
  });

  test("freshness window: a ts within the TTL passes", async () => {
    const { sig, ts } = await signedProof();
    const fresh = Date.parse(challenge.ts) + 1_000;
    expect(await verifyAuthProof({ ...challenge, peerPubKey: peerPub, sig, ts, now: fresh }))
      .toEqual({ ok: true });
  });

  test("malformed material is rejected before crypto", async () => {
    const { sig, ts } = await signedProof();
    expect((await verifyAuthProof({ ...challenge, peerPubKey: "xyz", sig, ts })).reason)
      .toMatch(/peerPubKey/);
    expect((await verifyAuthProof({ ...challenge, peerPubKey: peerPub, sig: "ab", ts })).reason)
      .toMatch(/sig/);
  });
});

describe("ed25519SignerFromSeed (the LIGHT leaf-identity signer)", () => {
  // Proves the leaf-identity signing path end-to-end: a bare-Ed25519 signer over
  // the operator seed (what LeafIdentity.sign + LarWSClientAdapter use) produces a
  // proof the gate's verifier accepts — and the relay-binding still holds.
  test("a leaf seed-signer's proof clears the gate verifier", async () => {
    const seed   = ed25519.utils.randomSecretKey();
    const pub    = hex(await ed25519.getPublicKeyAsync(seed));
    const sign   = ed25519SignerFromSeed(seed);               // the leaf signer
    const parts  = {
      nonce: "cafe".repeat(16), gatePubKey: "00".repeat(32),
      peerPubKey: pub, aud: "lar:///ha.ka.ba/bags/daemon", ts: "2026-06-07T12:00:00.000Z", leafNonce: "ef".repeat(32),
    };
    const msg    = await buildAuthResponse({ ...parts, contactCard: "card", sign });
    // The gate recomputes with its OWN key (= gatePubKey here) and the card-derived
    // peer key (= pub); a genuine leaf proof clears.
    expect(await verifyAuthProof({ ...parts, sig: msg.sig, ts: msg.ts! }))
      .toEqual({ ok: true });
    // Anti-relay: a gate holding a DIFFERENT key rejects the same proof.
    expect((await verifyAuthProof({ ...parts, gatePubKey: "11".repeat(32), sig: msg.sig, ts: msg.ts! })).ok)
      .toBe(false);
  });
});
