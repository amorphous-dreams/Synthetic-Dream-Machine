/**
 * authenticated-membership-relay.test.ts — WAVE 5: the cas-wire carry ⊥ read + Kapae-Mu proofs run GREEN over a
 * LIVE, AUTHENTICATED WS transport (real sockets), and a peer CANNOT impersonate the member gate.
 *
 * Proven over a real socket hop:
 *   · the ONE gate fronts the relay: a dial reaches it only on the knock its pinned key derives, proves its key, and
 *     reads the relay's signed verdict; a replayed or racing lar:auth meets silence or binds once,
 *   · CARRY ⊥ READ over the wire — an admitted MEMBER (proven key in the member set) carries the sealed ciphertext
 *     (verify-cap re-checked SECRET-FREE) + reads it with the per-body read-cap; a NON-member draws Mu,
 *   · NO IMPERSONATION — a stranger that forges `from = <a member's key>` is STAMPED back to its OWN proven key by
 *     the relay, so the cas-wire gate reads it as the stranger → Mu (the forged carry never crosses),
 *   · the wire bytes match the in-memory proof (the MembershipChannel interface carries the identical messages).
 */
import { MEMBERSHIP_RELAY_DOMAIN } from "@lararium/mesh";
import { afterEach, beforeEach, describe, test, expect } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as ed from "@noble/ed25519";
import WS, { type RawData } from "ws";
import {
  DeterministicFederationGate, openBodyOnCas, utf8Bytes, hex,
  buildAuthResponse, ed25519SignerFromSeed, mintLeafNonce, knockedUrl, isLarChallengeMsg, isLarAuthOkMsg, mkLarSessionMsg,
  type MembershipChannel, type MembershipEnvelope,
} from "@lararium/mesh";
import { standNexusKeyring } from "../src/nexus-convergence-secret-store.js";
import { cadSealDir, sealCarrierForFederation } from "../src/seal-carrier-federation.js";
import { makeSealedPlaneRegistry } from "../src/plane-seal.js";
import { serveCasWire, type CasWireServerDeps } from "../src/cas-wire.js";
import {
  startAuthenticatedMembershipRelay, AuthenticatedWSMembershipChannel,
  type AuthenticatedMembershipRelay,
} from "../src/authenticated-membership-relay.js";
import { membershipOf, antigenOf } from "./cas-test-setup.js";

const BODY = utf8Bytes("the sealed carrier body a member blind-transits over a real authenticated socket");
const pubOf = (seed: Uint8Array) => ed.getPublicKeyAsync(seed).then(hex);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Drive one fetch over the async WS hop: the requester offers a want-block; the holder serves a turn (retried
 *  until the async socket delivers it); the requester polls for the response. Returns the response envelope. */
async function driveFetch(args: {
  requesterCh: MembershipChannel; requesterAddr: string;
  holderCh: MembershipChannel; holderAddr: string;
  deps: CasWireServerDeps; cid: string;
}): Promise<MembershipEnvelope | null> {
  await args.requesterCh.offer({ kind: "cas-want-block", from: args.requesterAddr, to: args.holderAddr, payload: { cid: args.cid } });
  for (let i = 0; i < 40 && (await serveCasWire(args.holderCh, args.holderAddr, args.deps)) === 0; i++) await sleep(10);
  for (let i = 0; i < 40; i++) {
    const responses = await args.requesterCh.poll(args.requesterAddr);
    if (responses.length > 0) return responses[0]!;
    await sleep(10);
  }
  return null;
}

describe("authenticated-membership-relay — cas-wire over a live authenticated WS hop", () => {
  let relay: AuthenticatedMembershipRelay;
  let storageDir: string;
  let idDir: string;
  beforeEach(() => { storageDir = mkdtempSync(join(tmpdir(), "lares-ws-store-")); idDir = mkdtempSync(join(tmpdir(), "lares-ws-id-")); });
  afterEach(async () => { await relay?.close(); rmSync(storageDir, { recursive: true, force: true }); rmSync(idDir, { recursive: true, force: true }); });

  test("an admitted MEMBER carries + reads over the wire; a NON-member draws Mu; a forged `from` is defeated", async () => {
    // Seeds → proven keys (the relay stamps `from` with these; the cas-wire gate reads them).
    const holderSeed = new Uint8Array(32).fill(1);
    const memberSeed = new Uint8Array(32).fill(2);
    const strangerSeed = new Uint8Array(32).fill(3);
    const [holderKey, memberKey, strangerKey] = await Promise.all([pubOf(holderSeed), pubOf(memberSeed), pubOf(strangerSeed)]);

    // Seal a body into the cad store.
    const registry = makeSealedPlaneRegistry();
    const keyring = standNexusKeyring({ sealEpoch: 0, dir: idDir });
    const cadDir = cadSealDir(storageDir);
    const installed = sealCarrierForFederation({ registry, cadDir, plaintext: BODY, keyring });

    // The member gate: memberKey is a MEMBER; strangerKey is not. (Nexus pubkey seeds the federatable set.)
    const deps: CasWireServerDeps = {
      cadDir, seal: registry.seal,
      membership: membershipOf([memberKey]),
      antigen: antigenOf([]),
      fedGate: new DeterministicFederationGate(holderKey),
    };

    // Stand the AUTHENTICATED relay + three real socket connections (each proves possession of its key).
    relay = await startAuthenticatedMembershipRelay(holderSeed);
    const url = `ws://127.0.0.1:${relay.port}#${relay.gatePubKey}`;
    const holderCh   = await AuthenticatedWSMembershipChannel.connect(url, holderSeed);
    const memberCh   = await AuthenticatedWSMembershipChannel.connect(url, memberSeed);
    const strangerCh = await AuthenticatedWSMembershipChannel.connect(url, strangerSeed);
    try {
      // ── MEMBER carries the ciphertext over the wire + reads it. ──
      const memberResp = await driveFetch({ requesterCh: memberCh, requesterAddr: memberKey, holderCh, holderAddr: holderKey, deps, cid: installed.cid });
      expect(memberResp?.kind).toBe("cas-block");
      const carried = (memberResp!.payload as { bytes?: Record<string, number> }).bytes;
      const ciphertext = Uint8Array.from(Object.values(carried!));   // JSON round-trip of the byte array
      expect([...openBodyOnCas(ciphertext, installed.readCap)]).toEqual([...BODY]);   // reads with the per-body read-cap
      expect([...ciphertext]).not.toEqual([...BODY]);                                  // carried bytes are CIPHERTEXT

      // ── NON-member draws Mu (no carry). ──
      const strangerResp = await driveFetch({ requesterCh: strangerCh, requesterAddr: strangerKey, holderCh, holderAddr: holderKey, deps, cid: installed.cid });
      expect(strangerResp?.kind).toBe("cas-mu");

      // ── IMPERSONATION defeated: the stranger forges `from = memberKey`; the relay stamps it back to strangerKey. ──
      await strangerCh.offer({ kind: "cas-want-block", from: memberKey /* forged */, to: holderKey, payload: { cid: installed.cid } });
      for (let i = 0; i < 40 && (await serveCasWire(holderCh, holderKey, deps)) === 0; i++) await sleep(10);
      // The response is addressed to the stranger's PROVEN key (the relay overrode the forged `from`), and it is Mu.
      let forgedResp: MembershipEnvelope | null = null;
      for (let i = 0; i < 40 && !forgedResp; i++) { const r = await strangerCh.poll(strangerKey); if (r.length) forgedResp = r[0]!; else await sleep(10); }
      expect(forgedResp?.kind).toBe("cas-mu");
      // The member never receives a response to a request it did not make (the forged `from` never reached the gate as memberKey).
      expect((await memberCh.poll(memberKey)).length).toBe(0);
    } finally {
      holderCh.close(); memberCh.close(); strangerCh.close();
    }
  }, 15_000);

  test("an addressed envelope reaches its addressee alone; a third proven peer sees neither its sender nor its cid", async () => {
    relay = await startAuthenticatedMembershipRelay(new Uint8Array(32).fill(21));
    const url = `ws://127.0.0.1:${relay.port}#${relay.gatePubKey}`;
    const [seedA, seedB, seedC] = [22, 23, 24].map((n) => new Uint8Array(32).fill(n)) as [Uint8Array, Uint8Array, Uint8Array];
    const [keyA, keyB] = await Promise.all([pubOf(seedA), pubOf(seedB)]);
    const a = await AuthenticatedWSMembershipChannel.connect(url, seedA);
    const b = await AuthenticatedWSMembershipChannel.connect(url, seedB);
    const c = await AuthenticatedWSMembershipChannel.connect(url, seedC);
    try {
      const cid = "bafy-the-kel-event-a-sibling-asks-for";
      await a.offer({ kind: "cas-want-block", from: keyA, to: keyB, payload: { cid } });
      await a.offer({ kind: "cas-have", from: keyA, to: "*", payload: { cid: "bafy-announced" } });
      // CONTROL: the addressee receives the addressed envelope, stamped with the sender's proven key.
      let atB: MembershipEnvelope[] = [];
      for (let i = 0; i < 40 && atB.length < 2; i++) { atB = [...atB, ...(await b.poll(keyB))]; if (atB.length < 2) await sleep(10); }
      expect(atB.map((e) => [e.kind, e.from])).toEqual([["cas-want-block", keyA], ["cas-have", keyA]]);
      // The third peer reads its socket under the ADDRESSEE's name, so nothing the wire delivered hides from it:
      // the broadcast reaches it, the addressed envelope never does.
      let atC: MembershipEnvelope[] = [];
      for (let i = 0; i < 40 && atC.length < 1; i++) { atC = [...atC, ...(await c.poll(keyB))]; if (atC.length < 1) await sleep(10); }
      await sleep(50);
      atC = [...atC, ...(await c.poll(keyB))];
      expect(atC.map((e) => e.kind)).toEqual(["cas-have"]);
      expect(JSON.stringify(atC)).not.toContain(cid);
    } finally {
      a.close(); b.close(); c.close();
    }
  }, 15_000);

  test("the relay stands behind the one gate: a pinned, proven dial joins; no pin, a wrong pin or no knock reaches nothing", async () => {
    const gateSeed = new Uint8Array(32).fill(7);
    relay = await startAuthenticatedMembershipRelay(gateSeed, 0, undefined, { authTimeoutMs: 200 });
    const goodSeed = new Uint8Array(32).fill(8);
    // CONTROL: the pinned, proven dial joins.
    const ch = await AuthenticatedWSMembershipChannel.connect(`ws://127.0.0.1:${relay.port}#${relay.gatePubKey}`, goodSeed);
    expect(ch).toBeInstanceOf(AuthenticatedWSMembershipChannel);
    ch.close();
    // An address with no pin names no gate: the dial never opens.
    await expect(AuthenticatedWSMembershipChannel.connect(`ws://127.0.0.1:${relay.port}`, goodSeed)).rejects.toThrow(/gate key/);
    // A pin for another key derives another knock: the relay destroys that upgrade before any 101.
    const otherPin = await pubOf(new Uint8Array(32).fill(99));
    await expect(AuthenticatedWSMembershipChannel.connect(`ws://127.0.0.1:${relay.port}#${otherPin}`, goodSeed)).rejects.toThrow();
    // The bare root draws no 101 either.
    const bare = await new Promise<boolean>((resolve) => {
      const raw = new WS(`ws://127.0.0.1:${relay.port}/`);
      raw.on("open", () => { raw.close(); resolve(true); });
      raw.on("error", () => resolve(false));
      raw.on("unexpected-response", () => resolve(false));
    });
    expect(bare).toBe(false);
  }, 15_000);

  test("an old signed lar:auth stays connection-scoped — a fresh challenge nonce meets it with silence", async () => {
    const gateSeed = new Uint8Array(32).fill(11);
    relay = await startAuthenticatedMembershipRelay(gateSeed, 0, undefined, { authTimeoutMs: 200 });
    const peerSeed = new Uint8Array(32).fill(12);
    const peerPubKey = await pubOf(peerSeed);
    const knocked = knockedUrl(`ws://127.0.0.1:${relay.port}`, relay.gatePubKey);

    // Hand-drive the one handshake: the challenge nonce is the connection-scoped replay boundary.
    const first = await new Promise<{ raw: WS; auth: unknown }>((resolve, reject) => {
      const raw = new WS(knocked);
      let auth: unknown;
      raw.on("error", reject);
      raw.on("message", (data: RawData) => {
        const frame = JSON.parse(data.toString()) as Record<string, unknown>;
        if (isLarChallengeMsg(frame)) void (async () => {
          auth = await buildAuthResponse({
            contactCard: peerPubKey, nonce: frame.nonce, gatePubKey: relay!.gatePubKey, peerPubKey,
            aud: MEMBERSHIP_RELAY_DOMAIN, leafNonce: mintLeafNonce(), sign: ed25519SignerFromSeed(peerSeed),
          });
          raw.send(JSON.stringify(auth));
        })();
        else if (isLarAuthOkMsg(frame) && auth) resolve({ raw, auth });
      });
    });
    first.raw.close();

    // The same signed lar:auth cannot cross a fresh challenge: the nonce is part of the signed bytes. The gate
    // answers nothing and cuts the socket with no close frame.
    const end = await new Promise<{ code: number; frames: number }>((resolve, reject) => {
      const raw = new WS(knocked);
      let frames = 0;
      raw.on("error", reject);
      raw.on("message", (data: RawData) => {
        frames += 1;
        if (isLarChallengeMsg(JSON.parse(data.toString()))) raw.send(JSON.stringify(first.auth));
      });
      raw.on("close", (code: number) => resolve({ code, frames }));
    });
    expect(end).toEqual({ code: 1006, frames: 1 });
  }, 15_000);

  test("two lar:auth frames on ONE socket cannot race the binding — the gate reads exactly one", async () => {
    const gateSeed = new Uint8Array(32).fill(13);
    relay = await startAuthenticatedMembershipRelay(gateSeed, 0, undefined, { authTimeoutMs: 200 });
    const seedA = new Uint8Array(32).fill(14);
    const seedB = new Uint8Array(32).fill(15);
    const keyA = await pubOf(seedA);
    const keyB = await pubOf(seedB);

    // An OBSERVER peer reads the stamped `from` — the relay broadcasts to other clients, never back to the sender.
    const observerSeed = new Uint8Array(32).fill(16);
    const observerKey = await pubOf(observerSeed);
    const observer = await AuthenticatedWSMembershipChannel.connect(`ws://127.0.0.1:${relay.port}#${relay.gatePubKey}`, observerSeed);

    // One socket sends TWO valid lar:auth frames (different keys) back to back. Only the FIRST may bind.
    const raw = new WS(knockedUrl(`ws://127.0.0.1:${relay.port}`, relay.gatePubKey));
    try {
      await new Promise<void>((resolve) => {
        raw.on("message", (data: RawData) => {
          const frame = JSON.parse(data.toString()) as Record<string, unknown>;
          if (isLarChallengeMsg(frame)) {
            void (async () => {
              // Pre-build BOTH, then send them in the SAME tick — awaiting between sends would let the first verify
              // finish and close the window, and the race would never surface.
              const frames: string[] = [];
              for (const [seed, key] of [[seedA, keyA], [seedB, keyB]] as const) {
                frames.push(JSON.stringify(await buildAuthResponse({
                  contactCard: key, nonce: frame.nonce, gatePubKey: relay.gatePubKey, peerPubKey: key,
                  aud: MEMBERSHIP_RELAY_DOMAIN, leafNonce: mintLeafNonce(), sign: ed25519SignerFromSeed(seed),
                })));
              }
              for (const f of frames) raw.send(f);
            })();
          } else if (isLarAuthOkMsg(frame)) {
            // Probe only AFTER both frames have had time to verify — otherwise the first binding is read before a
            // racing second one could overwrite it.
            setTimeout(() => {
              raw.send(JSON.stringify(mkLarSessionMsg("membership/env", { kind: "probe", from: "forged", to: observerKey, payload: {} })));
              resolve();
            }, 250);
          }
        });
        raw.on("error", () => resolve());
      });

      let seen: MembershipEnvelope | undefined;
      for (let i = 0; i < 40 && !seen; i++) { const r = await observer.poll(observerKey); if (r.length) seen = r[0]!; else await sleep(10); }
      // Exactly one lar:auth bound, and it was the FIRST — the second never re-bound the socket.
      expect(seen?.from).toBe(keyA);
      expect(seen?.from).not.toBe(keyB);
    } finally {
      raw.close();
      observer.close();
    }
  }, 15_000);
});
