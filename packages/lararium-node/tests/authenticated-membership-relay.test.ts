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
 *   · the wire bytes match the in-memory proof (the MembershipChannel interface carries the identical messages);
 *   · THE DROP DOOR, live: junk under a real name or an invented one files nothing (F1, F2), a quarter-megabyte
 *     deposit meets silence (F3), one connection spends a bounded budget, a journal hands a restarted herm back
 *     what it verified, and a herm that never answers costs a pull or a deposit its deadline and no more (H).
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
import * as net from "node:net";
import { request as httpRequest, Agent } from "node:http";
import {
  provisionThresholdRecoveryAtFounding, guardianRecoveryRegistrationCard, attestAndRotate, enrolmentDigestOf,
  personaEventCidOf, personaKelDropName, httpPersonaKelDropHerm, pullPersonaKelSuccessors, depositPersonaKelChain,
  sha256HexSync, type PersonaKelEvent,
} from "@lararium/mesh";
import { DROP_CONNECTION_BUDGET } from "../src/authenticated-membership-relay.js";

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

// ── THE DROP DOOR, LIVE: a herm keeps only what verifies, spends its budget on nothing else, and never hangs a leaf ──

describe("the drop door over a live herm", () => {
  const relays: AuthenticatedMembershipRelay[] = [];
  const dirs: string[] = [];
  afterEach(async () => {
    for (const r of relays.splice(0)) await r.close();
    for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
  });
  const seed = (b: number) => new Uint8Array(32).fill(b);
  const stand = async (b: number, opts: Parameters<typeof startAuthenticatedMembershipRelay>[3] = {}) => {
    const r = await startAuthenticatedMembershipRelay(seed(b), 0, undefined, opts);
    relays.push(r);
    return r;
  };
  const addressOf = (r: AuthenticatedMembershipRelay) => `ws://127.0.0.1:${r.port}#${r.gatePubKey}`;

  /** A founded KEL rotated once by its guardian quorum. */
  async function rotated(): Promise<[PersonaKelEvent, PersonaKelEvent]> {
    const guardianSeeds = [seed(61), seed(62), seed(63)];
    const guardianRecoveryKeys = await Promise.all(guardianSeeds.map(pubOf));
    const slots = ["mine", "guardian-a", "guardian-b"] as const;
    const prov = provisionThresholdRecoveryAtFounding({
      foundingOpKeyDid: `0x${await pubOf(seed(51))}`,
      guardians: guardianRecoveryKeys.map((k, i) => guardianRecoveryRegistrationCard(slots[i]!, k, null)),
      recoveryThreshold: 2,
    });
    const rot = await attestAndRotate({
      head: prov.inception, freshOpKeyDid: `0x${await pubOf(seed(52))}`, guardianRecoveryKeys, recoveryThreshold: 2,
      guardianSigners: await Promise.all(guardianSeeds.slice(0, 2).map(async (s) => ({ signer: await pubOf(s), sign: async (b: Uint8Array) => hex(await ed.signAsync(b, s)) }))),
    });
    if (!rot.ok) throw new Error(rot.reason);
    return [prov.inception, rot.event];
  }
  const junkRotationOf = (prev: PersonaKelEvent, n: number): PersonaKelEvent => {
    const core = {
      seq: prev.seq + 1, prefix: prev.prefix, opKeyDid: `0x${sha256HexSync(`junk-${n}`)}`, recoverySetHash: prev.recoverySetHash,
      nextRecoverySetHash: prev.nextRecoverySetHash, prevEventCid: prev.eventCid, provisional: false, vetoOfCid: null,
      enrolmentDigest: enrolmentDigestOf([]),
    };
    return { ...core, eventCid: personaEventCidOf(core), recoveryRoster: [], recoveryThreshold: 0, rotationSigs: [] };
  };
  /** POST one body and read its status, or "silence" when the herm cut the socket. */
  const post = (r: AuthenticatedMembershipRelay, name: string, body: string) =>
    fetch(`http://127.0.0.1:${r.port}/drop/${name}`, { method: "POST", headers: { "content-type": "text/plain" }, body })
      .then((res) => res.status, () => "silence" as const);

  test("RED (F1, live): sixteen junk rotations POSTed under a real name file nothing at either herm, and the lawful deposit still lands", async () => {
    const [inception, rot] = await rotated();
    const herms = [await stand(80), await stand(81)];
    for (const r of herms) {
      for (let i = 0; i < 16; i++) expect(await post(r, personaKelDropName(inception.eventCid, r.gatePubKey), JSON.stringify({ prev: inception, event: junkRotationOf(inception, i) }))).toBe("silence");
    }
    const leaves = herms.map((r) => httpPersonaKelDropHerm(addressOf(r)));
    expect((await depositPersonaKelChain([inception, rot], leaves)).unanswered).toEqual([]);
    const pulled = await pullPersonaKelSuccessors([inception], leaves);
    expect(pulled.kel.map((e) => e.eventCid)).toEqual([inception.eventCid, rot.eventCid]);
    // A re-deposit of the verified event stays idempotent: it answers, and the drop still holds one value.
    expect(await post(herms[0]!, personaKelDropName(inception.eventCid, herms[0]!.gatePubKey), JSON.stringify({ prev: inception, event: rot }))).toBe(204);
    expect(await leaves[0]!.pull(personaKelDropName(inception.eventCid, herms[0]!.gatePubKey))).toHaveLength(1);
  }, 20_000);

  test("RED (F2, live): junk under invented predecessors files nothing, and the herm takes the lawful deposit after", async () => {
    const [inception, rot] = await rotated();
    const r = await stand(82);
    for (let i = 0; i < 64; i++) {
      const fakePrev = { ...inception, eventCid: `pkel0-fake-${i}` };
      expect(await post(r, personaKelDropName(fakePrev.eventCid, r.gatePubKey), JSON.stringify({ prev: fakePrev, event: junkRotationOf(fakePrev, i) }))).toBe("silence");
    }
    expect(await post(r, personaKelDropName(inception.eventCid, r.gatePubKey), JSON.stringify({ prev: inception, event: rot }))).toBe(204);
  }, 20_000);

  test("RED (F3, live): a quarter-megabyte deposit meets silence before the store reads it; CONTROL: the lawful deposit lands", async () => {
    const [inception, rot] = await rotated();
    const r = await stand(83);
    const boxes = Array.from({ length: 520 }, (_, i) => ({ kind: "sealed-enrolment", e: "ab".repeat(32), n: "cd".repeat(12), c: "ef".repeat(100) + i.toString(16).padStart(4, "0"), sig: "00".repeat(64) }));
    const core = { ...junkRotationOf(inception, 0), enrolmentDigest: enrolmentDigestOf(boxes as never) };
    const big = JSON.stringify({ prev: inception, event: { ...core, eventCid: personaEventCidOf(core), enrolments: boxes } });
    expect(big.length).toBeGreaterThan(240_000);
    expect(await post(r, personaKelDropName(inception.eventCid, r.gatePubKey), big)).toBe("silence");
    // The cap reads bytes before it reads trust: a LAWFUL deposit padded past the cap meets the same silence.
    const padded = JSON.stringify({ prev: inception, event: rot, pad: "x".repeat(250_000) });
    expect(await post(r, personaKelDropName(inception.eventCid, r.gatePubKey), padded)).toBe("silence");
    expect(await post(r, personaKelDropName(inception.eventCid, r.gatePubKey), JSON.stringify({ prev: inception, event: rot }))).toBe(204);
  }, 20_000);

  test("RED: one connection spends at most its budget of deposits; a fresh connection deposits again", async () => {
    const [inception, rot] = await rotated();
    const r = await stand(84);
    const body = JSON.stringify({ prev: inception, event: rot });
    const agent = new Agent({ keepAlive: true, maxSockets: 1 });
    const once = (a: Agent) => new Promise<number | "silence">((resolve) => {
      const req = httpRequest({ host: "127.0.0.1", port: r.port, path: `/drop/${personaKelDropName(inception.eventCid, r.gatePubKey)}`, method: "POST", agent: a, headers: { "content-type": "text/plain", "content-length": Buffer.byteLength(body) } }, (res) => { res.resume(); res.on("end", () => resolve(res.statusCode ?? 0)); });
      req.on("error", () => resolve("silence"));
      req.end(body);
    });
    const statuses: Array<number | "silence"> = [];
    for (let i = 0; i <= DROP_CONNECTION_BUDGET.deposits; i++) statuses.push(await once(agent));
    agent.destroy();
    expect(statuses.slice(0, DROP_CONNECTION_BUDGET.deposits).every((s) => s === 204)).toBe(true);
    expect(statuses.at(-1)).toBe("silence");
    const fresh = new Agent({ keepAlive: false });
    expect(await once(fresh)).toBe(204);
    fresh.destroy();
  }, 30_000);

  test("a herm journals what it verified: restarted on the same journal, it serves the drop again; a planted line files nothing", async () => {
    const [inception, rot] = await rotated();
    const dir = mkdtempSync(join(tmpdir(), "lar-drop-journal-"));
    dirs.push(dir);
    const journal = join(dir, "persona-kel-drops.jsonl");
    const first = await stand(85, { dropJournalPath: journal });
    expect(await post(first, personaKelDropName(inception.eventCid, first.gatePubKey), JSON.stringify({ prev: inception, event: rot }))).toBe(204);
    await first.close(); relays.splice(relays.indexOf(first), 1);
    const { appendFileSync } = await import("node:fs");
    appendFileSync(journal, `${JSON.stringify({ name: personaKelDropName(rot.eventCid, first.gatePubKey), deposit: { prev: rot, event: junkRotationOf(rot, 1) } })}\n`);
    const again = await stand(85, { dropJournalPath: journal });
    const leaf = httpPersonaKelDropHerm(addressOf(again));
    expect((await leaf.pull(personaKelDropName(inception.eventCid, again.gatePubKey))).map((e) => (e as PersonaKelEvent).eventCid)).toEqual([rot.eventCid]);
    expect(await leaf.pull(personaKelDropName(rot.eventCid, again.gatePubKey))).toEqual([]);
  }, 20_000);

  test("RED (H, live): a herm that accepts and never answers, first or last, costs a pull and a deposit its deadline and no more", async () => {
    const [inception, rot] = await rotated();
    const honest = await stand(86);
    const sockets: net.Socket[] = [];
    const hung = net.createServer((s) => { sockets.push(s); });
    await new Promise<void>((resolve) => hung.listen(0, "127.0.0.1", resolve));
    try {
      const silent = httpPersonaKelDropHerm(`ws://127.0.0.1:${(hung.address() as net.AddressInfo).port}#${"c3".repeat(32)}`, { deadlineMs: 400 });
      const live = httpPersonaKelDropHerm(addressOf(honest), { deadlineMs: 400 });
      for (const herms of [[silent, live], [live, silent]]) {
        const startedAt = performance.now();
        const deposited = await depositPersonaKelChain([inception, rot], herms);
        const pulled = await pullPersonaKelSuccessors([inception], herms);
        const spent = performance.now() - startedAt;
        expect(deposited.unanswered).toEqual(["c3".repeat(32)]);
        expect(pulled.unanswered).toEqual(["c3".repeat(32)]);
        expect(pulled.kel.map((e) => e.eventCid)).toEqual([inception.eventCid, rot.eventCid]);
        expect(spent, "two deadlines, never a hang").toBeLessThan(3000);
      }
    } finally {
      for (const s of sockets) s.destroy();
      await new Promise<void>((resolve) => hung.close(() => resolve()));
    }
  }, 20_000);
});
