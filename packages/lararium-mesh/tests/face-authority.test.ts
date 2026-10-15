/**
 * face-authority.test — private authority for the face proof: issue, withdraw, fold, and the six verdicts.
 *
 * Each vector names a hole and carries its control. A gate here means a reader that holds a memory for one
 * admitted face; a presenter means a vessel that hands over its certificate, a session certificate, its
 * frontier and the events it carries.
 *
 * Canon: lar:///ha.ka.ba/lares/api/pono/face-proof#/the-withdrawal-proof
 */
import * as ed25519 from "@noble/ed25519";
import { describe, expect, test } from "vitest";
import { hex } from "../src/crypto.js";
import { acceptEd25519Key } from "../src/ed25519-door.js";
import {
  FACE_CHAIN_VERDICTS, FACE_PROOF_CUSTODY_ROWS, WITHDRAWAL_HISTORY_BOUND,
  checkFaceChain, checkVesselChain, isVerifiedVesselChain, foldWithdrawals, heldWithdrawals, isVerifiedFaceChain, isWithdrawalMemory, issueCertificate,
  learnWithdrawals, mintFaceProofKey, mintVesselFaceKey, readOwnStanding, requestCertificate, withdrawKey,
  type FaceChainVerdict, type FaceKeyCustody, type VesselFaceKeyCustody, type WithdrawalMemory,
} from "../src/face-authority.js";
import {
  genesisFrontier, readCertificate, sessionCertificateImage, withdrawalHead, withdrawnKeyDigest,
  type FaceScope, type FaceWithdrawal, type SessionKey, type VesselFaceKey, type WithdrawalFrontier,
} from "../src/face-proof-subjects.js";
import { chain, history, pair, signHex, stringLeaves, vesselOf, withdrawal, type Chain, type Pair } from "./face-proof-fixture.js";

const NEXUS_A = "nexus-a.synthetic";
const NEXUS_B = "nexus-b.synthetic";

const faceCustody = (by: Pair): FaceKeyCustody => ({ signAsFace: (_scope, image) => ed25519.signAsync(image, by.secret) });
const vesselCustody = (by: Pair): VesselFaceKeyCustody => ({ signAsVesselFace: (_scope, _key, image) => ed25519.signAsync(image, by.secret) });

function memoryOf(scope: FaceScope, events: readonly FaceWithdrawal[] = []): WithdrawalMemory {
  const fold = foldWithdrawals(scope, events);
  if (!("memory" in fold)) throw new Error(`fixture: fold refused ${fold.refusal}`);
  return fold.memory;
}
const frontierOf = (scope: FaceScope, events: readonly FaceWithdrawal[]): WithdrawalFrontier => memoryOf(scope, events).frontier;

/** One presentation of `c` at a gate holding `memory`. */
function present(c: Chain, memory: WithdrawalMemory, shown: { frontier?: unknown; carried?: unknown } = {}, admitted: FaceScope = c.scope): FaceChainVerdict {
  return checkFaceChain({
    admitted, certificate: c.certificate, sessionCertificate: c.sessionCertificate,
    frontier: shown.frontier ?? genesisFrontier(c.scope), carried: shown.carried ?? [], memory,
  });
}

function shuffled<T>(items: readonly T[]): T[] {
  // A fixed permutation: reversed, then the halves swapped. Repeatable, and never the input order for n > 2.
  const reversed = [...items].reverse();
  const half = Math.floor(reversed.length / 2);
  return [...reversed.slice(half), ...reversed.slice(0, half)];
}

describe("minting", () => {
  test("a face proof key and a vessel's face-scoped key mint at random and pass the one door", async () => {
    const [a, b, v] = [await mintFaceProofKey(), await mintFaceProofKey(), await mintVesselFaceKey()];
    expect(new Set([a.publicKey, b.publicKey, v.publicKey]).size).toBe(3);
    for (const minted of [a, b, v]) {
      expect(minted.secret.length).toBe(32);
      expect(acceptEd25519Key(minted.publicKey)).toEqual({ ok: true });
      expect(hex(await ed25519.getPublicKeyAsync(minted.secret))).toBe(minted.publicKey);
    }
  });

  test("CONTROL: the random source alone decides a key", async () => {
    const fixed = { getRandomValues: <T extends Uint8Array<ArrayBuffer>>(array: T): T => { array.fill(7); return array; }, randomUUID: () => "unused" };
    expect((await mintFaceProofKey(fixed)).publicKey).toBe((await mintVesselFaceKey(fixed)).publicKey as string);
  });

  test("the custody rows name a cold face key with the root holder and a hot key on each vessel", () => {
    expect(FACE_PROOF_CUSTODY_ROWS.map((row) => [row.row, row.custody])).toEqual([["face-proof-key", "cold"], ["vessel-face-key", "hot"]]);
  });
});

describe("issuing a certificate", () => {
  test("a joining vessel requests under its own key, and the face key certifies it once", async () => {
    const c = await chain("issue", NEXUS_A);
    const requested = await requestCertificate({ scope: c.scope, vesselFaceKey: c.certificate.vesselFaceKey, apart: [], custody: vesselCustody(c.vessel) });
    if (!("request" in requested)) throw new Error(requested.refusal);
    const issued = await issueCertificate({ request: requested.request, history: memoryOf(c.scope), apart: [], custody: faceCustody(c.face) });
    if (!("certificate" in issued)) throw new Error(issued.refusal);
    expect(readCertificate(issued.certificate)).toEqual({ read: issued.certificate });
    expect(issued.certificate.vesselFaceKey).toBe(c.vessel.key);
  });

  test("a request signed by any key but the one it names refuses", async () => {
    const c = await chain("issue-pop", NEXUS_A);
    const thief = await pair("issue-pop thief");
    const requested = await requestCertificate({ scope: c.scope, vesselFaceKey: c.certificate.vesselFaceKey, apart: [], custody: vesselCustody(thief) });
    expect(requested).toMatchObject({ refusal: "custody-astray" });
    // And a request a thief assembled by hand refuses at the issuer.
    const forged = { ...c.request, signature: (await chain("issue-pop other", NEXUS_A)).request.signature };
    expect(await issueCertificate({ request: forged, history: memoryOf(c.scope), apart: [], custody: faceCustody(c.face) }))
      .toMatchObject({ refusal: "request-refused", cause: { refusal: "signature-refused" } });
  });

  test("a request over a key the vessel holds for anything else refuses", async () => {
    const c = await chain("issue-root", NEXUS_A);
    const requested = await requestCertificate({ scope: c.scope, vesselFaceKey: c.certificate.vesselFaceKey, apart: [c.vessel.key], custody: vesselCustody(c.vessel) });
    expect(requested).toMatchObject({ refusal: "request-refused", cause: { refusal: "key-held-apart" } });
  });

  test("a key held apart signs no request at all: the custody door never opens", async () => {
    const c = await chain("issue-apart", NEXUS_A);
    let signed = 0;
    const counting: VesselFaceKeyCustody = { signAsVesselFace: (scope, key, image) => { signed++; return vesselCustody(c.vessel).signAsVesselFace(scope, key, image); } };
    const args = { scope: c.scope, vesselFaceKey: c.certificate.vesselFaceKey, custody: counting };
    expect(await requestCertificate({ ...args, apart: [c.vessel.key] })).toMatchObject({ refusal: "request-refused", cause: { refusal: "key-held-apart" } });
    expect(await requestCertificate({ ...args, apart: [c.face.key] })).toMatchObject({ refusal: "request-refused", cause: { refusal: "key-held-apart" } });
    expect(await requestCertificate({ ...args, vesselFaceKey: c.scope.faceKey as string as VesselFaceKey, apart: [] })).toMatchObject({ refusal: "request-refused", cause: { refusal: "keys-not-distinct" } });
    expect(signed).toBe(0);
    expect("request" in await requestCertificate({ ...args, apart: [] })).toBe(true);   // CONTROL
    expect(signed).toBe(1);
    // The issuer holds its other faces' vessels apart too: a key certified under one face takes no second certificate.
    expect(await issueCertificate({ request: c.request, history: memoryOf(c.scope), apart: [c.vessel.key], custody: faceCustody(c.face) }))
      .toMatchObject({ refusal: "request-refused", cause: { refusal: "key-held-apart" } });
  });

  test("a request for another face or another Nexus refuses at this issuer", async () => {
    const c = await chain("issue-scope", NEXUS_A);
    const elsewhere = await chain("issue-scope", NEXUS_B);            // the same keys, another Nexus
    expect(await issueCertificate({ request: elsewhere.request, history: memoryOf(c.scope), apart: [], custody: faceCustody(c.face) }))
      .toEqual({ refusal: "request-other-face" });
    const otherFace = await chain("issue-scope other", NEXUS_A);
    expect(await issueCertificate({ request: otherFace.request, history: memoryOf(c.scope), apart: [], custody: faceCustody(c.face) }))
      .toEqual({ refusal: "request-other-face" });
  });

  test("a custody door that signs under another key yields no certificate", async () => {
    const c = await chain("issue-astray", NEXUS_A);
    const astray = await pair("issue-astray wrong row");
    expect(await issueCertificate({ request: c.request, history: memoryOf(c.scope), apart: [], custody: faceCustody(astray) }))
      .toMatchObject({ refusal: "custody-astray" });
  });

  test("a withdrawn key never returns: the issuer refuses a certificate for it", async () => {
    const c = await chain("issue-withdrawn", NEXUS_A);
    const removed = await withdrawKey({ history: memoryOf(c.scope), vesselFaceKey: c.vessel.key, custody: faceCustody(c.face) });
    if (!("event" in removed)) throw new Error(removed.refusal);
    expect(await issueCertificate({ request: c.request, history: removed.history, apart: [], custody: faceCustody(c.face) }))
      .toEqual({ refusal: "key-withdrawn" });
    // CONTROL: the same request against the history before the removal issues.
    expect("certificate" in await issueCertificate({ request: c.request, history: memoryOf(c.scope), apart: [], custody: faceCustody(c.face) })).toBe(true);
  });
});

describe("withdrawing a key", () => {
  test("each denial stands one position past the last and names the head before it", async () => {
    const c = await chain("withdraw", NEXUS_A);
    const [gone1, gone2] = [await pair("withdraw gone-1"), await pair("withdraw gone-2")];
    const first = await withdrawKey({ history: memoryOf(c.scope), vesselFaceKey: gone1.key, custody: faceCustody(c.face) });
    if (!("event" in first)) throw new Error(first.refusal);
    expect(first.event.position).toBe(1);
    expect(first.event.previous).toBe(genesisFrontier(c.scope).head);
    expect(first.event.withdrawn).toBe(withdrawnKeyDigest(c.scope, gone1.key as VesselFaceKey));
    const second = await withdrawKey({ history: first.history, vesselFaceKey: gone2.key, custody: faceCustody(c.face) });
    if (!("event" in second)) throw new Error(second.refusal);
    expect(second.event.position).toBe(2);
    expect(second.event.previous).toBe(withdrawalHead(first.event));
    expect(second.history.frontier).toEqual({ position: 2, head: withdrawalHead(second.event) });
    expect(second.history.denied.length).toBe(2);
  });

  test("one key takes one denial; a second refuses and signs nothing", async () => {
    const c = await chain("withdraw-twice", NEXUS_A);
    const first = await withdrawKey({ history: memoryOf(c.scope), vesselFaceKey: c.vessel.key, custody: faceCustody(c.face) });
    if (!("event" in first)) throw new Error(first.refusal);
    let signed = 0;
    const counting: FaceKeyCustody = { signAsFace: (scope, image) => { signed++; return faceCustody(c.face).signAsFace(scope, image); } };
    expect(await withdrawKey({ history: first.history, vesselFaceKey: c.vessel.key, custody: counting })).toEqual({ refusal: "already-withdrawn" });
    expect(signed).toBe(0);
  });

  test("a custody door that signs under another key yields no event", async () => {
    const c = await chain("withdraw-astray", NEXUS_A);
    expect(await withdrawKey({ history: memoryOf(c.scope), vesselFaceKey: c.vessel.key, custody: faceCustody(c.vessel) }))
      .toMatchObject({ refusal: "custody-astray" });
  });

  test("a history the module never folded, a forked one and a gapped one each refuse the issuer", async () => {
    const c = await chain("withdraw-unfit", NEXUS_A);
    const events = await history(c, [(await pair("unfit-1")).key, (await pair("unfit-2")).key, (await pair("unfit-3")).key]);
    const byHand = { ...memoryOf(c.scope) } as WithdrawalMemory;
    expect(await withdrawKey({ history: byHand, vesselFaceKey: c.vessel.key, custody: faceCustody(c.face) })).toEqual({ refusal: "history-foreign" });
    const gapped = memoryOf(c.scope, [events[0]!, events[2]!]);
    expect(await withdrawKey({ history: gapped, vesselFaceKey: c.vessel.key, custody: faceCustody(c.face) })).toEqual({ refusal: "history-incomplete" });
    const rival = await withdrawal(c.scope, 2, withdrawalHead(events[0]!), (await pair("unfit-rival")).key, c.face);
    const forked = memoryOf(c.scope, [...events, rival]);
    expect(await withdrawKey({ history: forked, vesselFaceKey: c.vessel.key, custody: faceCustody(c.face) })).toEqual({ refusal: "history-forked" });
    expect(await issueCertificate({ request: c.request, history: forked, apart: [], custody: faceCustody(c.face) })).toEqual({ refusal: "history-forked" });
  });

  test("the history holds a bounded count: the issuer signs none past it, and a reader folds none past it", async () => {
    const c = await chain("withdraw-bound", NEXUS_A);
    const keys: string[] = [];
    for (let i = 0; i < WITHDRAWAL_HISTORY_BOUND; i++) keys.push((await pair(`bound ${i}`)).key);
    const full = await history(c, keys);
    const atBound = memoryOf(c.scope, full);
    expect(atBound.line.length).toBe(WITHDRAWAL_HISTORY_BOUND);
    let signed = 0;
    const counting: FaceKeyCustody = { signAsFace: (scope, image) => { signed++; return faceCustody(c.face).signAsFace(scope, image); } };
    expect(await withdrawKey({ history: atBound, vesselFaceKey: c.vessel.key, custody: counting })).toEqual({ refusal: "history-at-bound" });
    expect(signed).toBe(0);                                             // the face key signed nothing past the bound
    const onePast = await withdrawal(c.scope, WITHDRAWAL_HISTORY_BOUND + 1, atBound.frontier.head, c.vessel.key, c.face);
    expect(foldWithdrawals(c.scope, [...full, onePast])).toEqual({ refusal: "history-over-bound" });
    expect(learnWithdrawals(atBound, [onePast])).toEqual({ refusal: "history-over-bound" });
    // CONTROL: one short of the bound, the issuer still signs.
    const oneShort = memoryOf(c.scope, full.slice(0, -1));
    expect("event" in await withdrawKey({ history: oneShort, vesselFaceKey: c.vessel.key, custody: faceCustody(c.face) })).toBe(true);
  }, 120_000);
});

describe("folding what a reader learned", () => {
  test("the fold reads a set: any order gives one memory", async () => {
    const c = await chain("fold-order", NEXUS_A);
    const events = await history(c, [(await pair("order-1")).key, (await pair("order-2")).key, (await pair("order-3")).key, (await pair("order-4")).key]);
    const mixed = shuffled(events);
    expect(mixed.map((e) => e.position)).not.toEqual(events.map((e) => e.position));     // the setup took
    const [straight, scrambled] = [memoryOf(c.scope, events), memoryOf(c.scope, [...mixed, ...events])];
    expect(scrambled.frontier).toEqual(straight.frontier);
    expect(scrambled.denied).toEqual(straight.denied);
    expect(scrambled.line).toEqual(straight.line);
    expect(straight.frontier.position).toBe(4);
    expect(straight.loose).toEqual([]);
    expect(straight.fork).toBeNull();
  });

  test("a gap stops the line; the events past it stay loose and their denials count", async () => {
    const c = await chain("fold-gap", NEXUS_A);
    const beyond = await pair("gap-3");
    const events = await history(c, [(await pair("gap-1")).key, (await pair("gap-2")).key, beyond.key]);
    const gapped = memoryOf(c.scope, [events[0]!, events[2]!]);
    expect(gapped.frontier.position).toBe(1);
    expect(gapped.loose).toEqual([events[2]]);
    expect(gapped.denied).toContain(withdrawnKeyDigest(c.scope, beyond.key as VesselFaceKey));
    expect(gapped.fork).toBeNull();
    // The missing event closes the gap.
    const healed = learnWithdrawals(gapped, [events[1]]);
    expect("memory" in healed && healed.memory.frontier.position).toBe(3);
  });

  test("two events at one position prove a fork, and both denials count", async () => {
    const c = await chain("fold-fork", NEXUS_A);
    const [a, b] = [await pair("fork-a"), await pair("fork-b")];
    const base = await history(c, [(await pair("fork-base")).key, a.key]);
    const rival = await withdrawal(c.scope, 2, withdrawalHead(base[0]!), b.key, c.face);
    const forked = memoryOf(c.scope, [...base, rival]);
    expect(forked.fork?.map(withdrawalHead).sort()).toEqual([withdrawalHead(base[1]!), withdrawalHead(rival)].sort());
    expect(forked.frontier.position).toBe(1);
    expect(forked.denied).toContain(withdrawnKeyDigest(c.scope, a.key as VesselFaceKey));
    expect(forked.denied).toContain(withdrawnKeyDigest(c.scope, b.key as VesselFaceKey));
    // CONTROL: the same event carried twice proves nothing.
    expect(memoryOf(c.scope, [...base, base[1]!]).fork).toBeNull();
  });

  test("an event over a predecessor the line never held proves a fork too", async () => {
    const c = await chain("fold-breach", NEXUS_A);
    const base = await history(c, [(await pair("breach-1")).key]);
    const astray = await withdrawal(c.scope, 2, genesisFrontier(c.scope).head, (await pair("breach-2")).key, c.face);
    const memory = memoryOf(c.scope, [...base, astray]);
    expect(memory.fork).toEqual([base[0], astray]);
    expect(memory.frontier.position).toBe(1);
  });

  test("a carried event for another face, or one that fails its signature, refuses the whole fold", async () => {
    const c = await chain("fold-refuse", NEXUS_A);
    const other = await chain("fold-refuse other", NEXUS_A);
    const good = await history(c, [(await pair("refuse-1")).key]);
    const foreign = await history(other, [(await pair("refuse-2")).key]);
    expect(foldWithdrawals(c.scope, [...good, ...foreign])).toEqual({ refusal: "carried-other-face" });
    const unsigned = await withdrawal(c.scope, 2, withdrawalHead(good[0]!), (await pair("refuse-3")).key, c.vessel);
    expect(foldWithdrawals(c.scope, [...good, unsigned])).toMatchObject({ refusal: "carried-event-refused", cause: { refusal: "signature-refused" } });
    expect(foldWithdrawals(c.scope, "events")).toEqual({ refusal: "carried-malformed" });
    expect(learnWithdrawals({ ...memoryOf(c.scope) } as WithdrawalMemory, good)).toEqual({ refusal: "memory-foreign" });
  });

  test("a memory only accretes: learning older events moves no frontier back and drops no denial", async () => {
    const c = await chain("fold-accrete", NEXUS_A);
    const events = await history(c, [(await pair("accrete-1")).key, (await pair("accrete-2")).key]);
    const full = memoryOf(c.scope, events);
    for (const older of [[], [events[0]!]]) {
      const again = learnWithdrawals(full, older);
      if (!("memory" in again)) throw new Error(again.refusal);
      expect(again.memory.frontier).toEqual(full.frontier);
      expect(again.memory.denied).toEqual(full.denied);
    }
    expect(heldWithdrawals(full).length).toBe(2);
  });

  test("a fork stops the line below the contested position, and every event and denial stays", async () => {
    const c = await chain("fold-fork-early", NEXUS_A);
    const events = await history(c, [(await pair("early-1")).key, (await pair("early-2")).key, (await pair("early-3")).key]);
    const full = memoryOf(c.scope, events);
    expect(full.frontier.position).toBe(3);
    const rival = await withdrawal(c.scope, 1, genesisFrontier(c.scope).head, (await pair("early-rival")).key, c.face);
    const forked = learnWithdrawals(full, [rival]);
    if (!("memory" in forked)) throw new Error(forked.refusal);
    expect(forked.memory.fork).not.toBeNull();
    expect(forked.memory.frontier).toEqual(genesisFrontier(c.scope));    // the line stops below position 1
    expect(heldWithdrawals(forked.memory).length).toBe(4);               // nothing verified got dropped
    for (const denial of full.denied) expect(forked.memory.denied).toContain(denial);
    expect(forked.memory.denied).toContain(rival.withdrawn);
    // And nothing unlearns the fork.
    const again = learnWithdrawals(forked.memory, events);
    expect("memory" in again && again.memory.fork).toEqual(forked.memory.fork);
  });

  test("a carried list that grows while read teaches no more than its first length", async () => {
    const c = await chain("fold-grow", NEXUS_A);
    const events = await history(c, [(await pair("grow-1")).key, (await pair("grow-2")).key]);
    let reads = 0;
    const growing = new Proxy([events[0]], {
      get(target, key, receiver) {
        if (key === "length") return Math.min(reads + 1, 5);        // the list grows as it gets read
        if (typeof key === "string" && /^\d+$/.test(key)) { reads++; return events[Math.min(Number(key), 1)]; }
        return Reflect.get(target, key, receiver);
      },
    });
    const fold = foldWithdrawals(c.scope, growing);
    if (!("memory" in fold)) throw new Error(fold.refusal);
    expect(reads).toBe(1);
    expect(fold.memory.frontier.position).toBe(1);
    expect(foldWithdrawals(c.scope, new Proxy([], { get: (t, k, r) => (k === "length" ? WITHDRAWAL_HISTORY_BOUND + 1 : Reflect.get(t, k, r)) }))).toEqual({ refusal: "history-over-bound" });
  });

  test("a vessel reads its own standing from the history it holds", async () => {
    const c = await chain("own", NEXUS_A);
    const sibling = await vesselOf(c, "own sibling");
    const events = await history(c, [sibling.vessel.key, (await pair("own-2")).key]);
    const memory = memoryOf(c.scope, events);
    expect(readOwnStanding(memory, c.certificate.vesselFaceKey)).toBe("standing");
    expect(readOwnStanding(memory, sibling.certificate.vesselFaceKey)).toBe("withdrawn");
    expect(readOwnStanding(memoryOf(c.scope, [events[1]!]), c.certificate.vesselFaceKey)).toBe("incomplete");
    const rival = await withdrawal(c.scope, 1, genesisFrontier(c.scope).head, (await pair("own-rival")).key, c.face);
    expect(readOwnStanding(memoryOf(c.scope, [...events, rival]), c.certificate.vesselFaceKey)).toBe("forked");
    expect(readOwnStanding({ ...memory } as WithdrawalMemory, c.certificate.vesselFaceKey)).toBe("incomplete");
  });
});

describe("the chain check: six verdicts, and none a boolean", () => {
  test("a certified vessel with nothing withdrawn reads verified", async () => {
    const c = await chain("verified", NEXUS_A, "seat");
    const verdict = present(c, memoryOf(c.scope));
    if (verdict.verdict !== "verified") throw new Error(verdict.verdict);
    expect(isVerifiedFaceChain(verdict.chain)).toBe(true);
    expect(verdict.chain).toMatchObject({ scope: c.scope, vesselFaceKey: c.vessel.key, sessionKey: c.session.key, profile: "seat", frontier: genesisFrontier(c.scope) });
  });

  test("no verdict reads as a boolean, and no hand-spelled chain reads as verified", async () => {
    const c = await chain("no-boolean", NEXUS_A);
    const verdict = present(c, memoryOf(c.scope));
    expect(Object.keys(verdict)).not.toContain("ok");
    expect(typeof verdict).toBe("object");
    expect(Object.isFrozen(verdict)).toBe(true);
    expect(FACE_CHAIN_VERDICTS).toEqual(["verified", "unconfirmed", "withdrawn", "incomplete", "forked", "invalid"]);
    if (verdict.verdict !== "verified") throw new Error(verdict.verdict);
    expect(isVerifiedFaceChain({ ...verdict.chain })).toBe(false);
    expect(isVerifiedFaceChain(verdict.chain)).toBe(true);
  });

  test("a certificate for another face refuses at this gate, though it verifies under its own", async () => {
    const mine = await chain("gate-face", NEXUS_A);
    const other = await chain("gate-face other", NEXUS_A);
    expect(present(other, memoryOf(mine.scope), {}, mine.scope)).toEqual({ verdict: "invalid", refusal: "certificate-other-face" });
    // CONTROL: the same chain at the gate that admitted its own face.
    expect(present(other, memoryOf(other.scope)).verdict).toBe("verified");
  });

  test("a certificate for another Nexus refuses at this gate, though the same face key signed it", async () => {
    const here = await chain("gate-nexus", NEXUS_A);
    const there = await chain("gate-nexus", NEXUS_B);
    expect(there.scope.faceKey).toBe(here.scope.faceKey);              // the setup took: one face key
    expect(present(there, memoryOf(here.scope), {}, here.scope)).toEqual({ verdict: "invalid", refusal: "certificate-other-nexus" });
  });

  test("a session certificate from another vessel, or from another face, refuses", async () => {
    const c = await chain("gate-session", NEXUS_A);
    const otherVessel = await vesselOf(c, "gate-session sibling");
    const memory = memoryOf(c.scope);
    const crossed = checkFaceChain({ admitted: c.scope, certificate: otherVessel.certificate, sessionCertificate: c.sessionCertificate, frontier: genesisFrontier(c.scope), carried: [], memory });
    expect(crossed).toEqual({ verdict: "invalid", refusal: "session-certificate-other-vessel" });
    const otherFace = await chain("gate-session other", NEXUS_A);
    const foreign = checkFaceChain({ admitted: c.scope, certificate: c.certificate, sessionCertificate: otherFace.sessionCertificate, frontier: genesisFrontier(c.scope), carried: [], memory });
    expect(foreign).toEqual({ verdict: "invalid", refusal: "session-certificate-other-scope" });
    expect(present(c, memory).verdict).toBe("verified");               // CONTROL
  });

  test("the gate's own ground gets read once: a scope that answers two faces verifies nothing against the wrong memory", async () => {
    const mine = await chain("gate-toctou mine", NEXUS_A);
    const other = await chain("gate-toctou other", NEXUS_A);
    const otherEvents = await history(other, [other.vessel.key]);       // the OTHER face withdrew its vessel
    expect(present(other, memoryOf(other.scope, otherEvents)).verdict).toBe("withdrawn");   // the setup took
    let reads = 0;
    const shifting = { get faceKey() { return reads++ === 0 ? mine.scope.faceKey : other.scope.faceKey; }, nexus: mine.scope.nexus };
    const verdict = checkFaceChain({
      admitted: shifting as unknown as FaceScope, certificate: other.certificate, sessionCertificate: other.sessionCertificate,
      frontier: genesisFrontier(other.scope), carried: [], memory: memoryOf(mine.scope),
    });
    // The first answer stands for the whole check: the other face's certificate refuses at this gate.
    expect(verdict).toEqual({ verdict: "invalid", refusal: "certificate-other-face" });
    expect(checkFaceChain({ admitted: { faceKey: "zz", nexus: NEXUS_A } as unknown as FaceScope, certificate: mine.certificate, sessionCertificate: mine.sessionCertificate, frontier: genesisFrontier(mine.scope), carried: [], memory: memoryOf(mine.scope) }))
      .toMatchObject({ verdict: "invalid", refusal: "admitted-malformed" });
  });

  test("a polluted prototype turns no refused certificate into a verified chain", async () => {
    const c = await chain("gate-prototype", NEXUS_A);
    const other = await chain("gate-prototype other", NEXUS_A);
    const tampered = { ...c.certificate, signature: other.certificate.signature };
    const pollute = Object.prototype as unknown as Record<string, unknown>;
    pollute["read"] = c.certificate;
    try {
      const verdict = checkFaceChain({ admitted: c.scope, certificate: tampered, sessionCertificate: c.sessionCertificate, frontier: genesisFrontier(c.scope), carried: [], memory: memoryOf(c.scope) });
      expect(verdict.verdict).toBe("invalid");
    } finally { delete pollute["read"]; }
  });

  test("a gate's memory for another face, or one spelled by hand, refuses before anything reads", async () => {
    const c = await chain("gate-memory", NEXUS_A);
    const other = await chain("gate-memory other", NEXUS_A);
    expect(present(c, memoryOf(other.scope))).toEqual({ verdict: "invalid", refusal: "memory-other-face" });
    expect(present(c, { ...memoryOf(c.scope) } as WithdrawalMemory)).toEqual({ verdict: "invalid", refusal: "memory-foreign" });
    // The memory reads FIRST: a hand-spelled one refuses by its own name even beside a certificate that fails.
    const badCertificate = { ...c.certificate, signature: other.certificate.signature };
    expect(checkFaceChain({ admitted: c.scope, certificate: badCertificate, sessionCertificate: c.sessionCertificate, frontier: genesisFrontier(c.scope), carried: [], memory: { ...memoryOf(c.scope) } as WithdrawalMemory }))
      .toEqual({ verdict: "invalid", refusal: "memory-foreign" });
  });

  test("a withdrawn vessel refuses wherever the gate learned the denial, whatever frontier it shows", async () => {
    const c = await chain("gate-withdrawn", NEXUS_A);
    const events = await history(c, [(await pair("w-1")).key, c.vessel.key]);
    const learned = memoryOf(c.scope, events);
    for (const frontier of [genesisFrontier(c.scope), frontierOf(c.scope, events.slice(0, 1)), learned.frontier]) {
      const verdict = present(c, learned, { frontier });
      expect(verdict).toMatchObject({ verdict: "withdrawn", evidence: [events[1]] });
    }
    // THE NAMED LEAK, stated as a vector: a gate that learned nothing newer accepts the same vessel.
    expect(present(c, memoryOf(c.scope)).verdict).toBe("verified");
  });

  test("a presenter that carries its own denial gets refused by the gate it taught", async () => {
    const c = await chain("gate-self", NEXUS_A);
    const events = await history(c, [c.vessel.key]);
    const verdict = present(c, memoryOf(c.scope), { frontier: frontierOf(c.scope, events), carried: events });
    expect(verdict.verdict).toBe("withdrawn");
    if (verdict.verdict === "withdrawn") expect(verdict.memory.frontier.position).toBe(1);
  });

  test("a sibling behind the gate reads unconfirmed, receives what it lacks, and then verifies", async () => {
    const c = await chain("gate-behind", NEXUS_A);
    const events = await history(c, [(await pair("behind-1")).key, (await pair("behind-2")).key, (await pair("behind-3")).key]);
    const gate = memoryOf(c.scope, events);
    const verdict = present(c, gate, { frontier: frontierOf(c.scope, events.slice(0, 1)) });
    expect(verdict).toMatchObject({ verdict: "unconfirmed", frontier: gate.frontier, catchUp: events.slice(1) });
    expect("chain" in verdict).toBe(false);
    // The vessel folds what it received and presents under the later frontier.
    const caughtUp = memoryOf(c.scope, [...events.slice(0, 1), ...(verdict.verdict === "unconfirmed" ? verdict.catchUp : [])]);
    expect(present(c, gate, { frontier: caughtUp.frontier }).verdict).toBe("verified");
  });

  test("a sibling ahead of the gate carries the events, and the gate learns them", async () => {
    const c = await chain("gate-ahead", NEXUS_A);
    const gone = await vesselOf(c, "gate-ahead gone");
    const events = await history(c, [gone.vessel.key]);
    const verdict = present(c, memoryOf(c.scope), { frontier: frontierOf(c.scope, events), carried: events });
    if (verdict.verdict !== "verified") throw new Error(verdict.verdict);
    expect(verdict.memory.frontier.position).toBe(1);
    // The gate now refuses the vessel the sibling's history denied.
    const { sessionCertificate } = await chainUnder(c, gone.vessel);
    const refused = checkFaceChain({ admitted: c.scope, certificate: gone.certificate, sessionCertificate, frontier: genesisFrontier(c.scope), carried: [], memory: verdict.memory });
    expect(refused).toMatchObject({ verdict: "withdrawn", evidence: events });
    // CONTROL: the gate that learned nothing still accepts that vessel.
    expect(checkFaceChain({ admitted: c.scope, certificate: gone.certificate, sessionCertificate, frontier: genesisFrontier(c.scope), carried: [], memory: memoryOf(c.scope) }).verdict).toBe("verified");
  });

  test("a later frontier named and never carried, another head, or a gap each read incomplete", async () => {
    const c = await chain("gate-incomplete", NEXUS_A);
    const events = await history(c, [(await pair("inc-1")).key, (await pair("inc-2")).key, (await pair("inc-3")).key]);
    const gate = memoryOf(c.scope, events.slice(0, 1));
    expect(present(c, gate, { frontier: frontierOf(c.scope, events) })).toMatchObject({ verdict: "incomplete", frontier: gate.frontier });
    const otherHead = { position: 1, head: genesisFrontier(c.scope).head };
    expect(otherHead.head).not.toBe(gate.frontier.head);
    expect(present(c, gate, { frontier: otherHead }).verdict).toBe("incomplete");
    expect(present(c, gate, { frontier: frontierOf(c.scope, events), carried: [events[2]] }).verdict).toBe("incomplete");
    // A gate that holds an event past a gap knows the history runs on: a presenter AT its line's frontier
    // still reads incomplete, since the gate can hand over no whole suffix.
    const gapped = memoryOf(c.scope, [events[0]!, events[2]!]);
    expect(gapped.frontier).toEqual(gate.frontier);
    expect(present(c, gapped, { frontier: gapped.frontier }).verdict).toBe("incomplete");
    expect(present(c, gate, { frontier: gate.frontier }).verdict).toBe("verified");      // CONTROL: no gap, same frontier
    // CONTROL: the whole suffix carried reads verified.
    expect(present(c, gate, { frontier: frontierOf(c.scope, events), carried: events.slice(1) }).verdict).toBe("verified");
  });

  test("a fork refuses every vessel of the face, and keeps both events", async () => {
    const c = await chain("gate-fork", NEXUS_A);
    const sibling = await vesselOf(c, "gate-fork sibling");
    const base = await history(c, [(await pair("gfork-1")).key]);
    const rival = await withdrawal(c.scope, 1, genesisFrontier(c.scope).head, (await pair("gfork-rival")).key, c.face);
    const gate = memoryOf(c.scope, base);
    const verdict = present(c, gate, { frontier: gate.frontier, carried: [rival] });
    if (verdict.verdict !== "forked") throw new Error(verdict.verdict);
    expect(verdict.evidence.map(withdrawalHead).sort()).toEqual([withdrawalHead(base[0]!), withdrawalHead(rival)].sort());
    const { sessionCertificate } = await chainUnder(c, sibling.vessel);
    const later = checkFaceChain({ admitted: c.scope, certificate: sibling.certificate, sessionCertificate, frontier: gate.frontier, carried: [], memory: verdict.memory });
    expect(later.verdict).toBe("forked");
    expect(present(c, verdict.memory, { frontier: gate.frontier }).verdict).toBe("forked");
    // CONTROL: before the rival arrived the same presenter verified.
    expect(present(c, gate, { frontier: gate.frontier }).verdict).toBe("verified");
  });

  test("an invalid presentation teaches the gate nothing", async () => {
    const c = await chain("gate-invalid", NEXUS_A);
    const other = await chain("gate-invalid other", NEXUS_A);
    const good = await history(c, [(await pair("inv-1")).key]);
    const foreign = await history(other, [(await pair("inv-2")).key]);
    const gate = memoryOf(c.scope);
    const verdict = present(c, gate, { frontier: frontierOf(c.scope, good), carried: [...good, ...foreign] });
    expect(verdict).toEqual({ verdict: "invalid", refusal: "carried-other-face" });
    expect("memory" in verdict).toBe(false);
    expect(present(c, gate, { frontier: { position: "1" } })).toMatchObject({ verdict: "invalid", refusal: "frontier-malformed" });
    expect(present(c, gate, { carried: "events" })).toEqual({ verdict: "invalid", refusal: "carried-malformed" });
    const tampered = { ...c.certificate, signature: other.certificate.signature };
    expect(checkFaceChain({ admitted: c.scope, certificate: tampered, sessionCertificate: c.sessionCertificate, frontier: genesisFrontier(c.scope), carried: good, memory: gate }))
      .toMatchObject({ verdict: "invalid", refusal: "certificate-refused" });
  });

  test("a gate keeps denials and no vessel: nothing it holds names a key or a certificate it saw", async () => {
    const c = await chain("gate-roster", NEXUS_A);
    const sibling = await vesselOf(c, "gate-roster sibling");
    const events = await history(c, [(await pair("roster-gone")).key]);
    let memory = memoryOf(c.scope);
    for (const certificate of [c.certificate, sibling.certificate]) {
      const sessionCertificate = certificate === c.certificate ? c.sessionCertificate : (await chainUnder(c, sibling.vessel)).sessionCertificate;
      const verdict = checkFaceChain({ admitted: c.scope, certificate, sessionCertificate, frontier: frontierOf(c.scope, events), carried: events, memory });
      if (verdict.verdict !== "verified") throw new Error(verdict.verdict);
      memory = verdict.memory;
    }
    const held = stringLeaves(memory);
    for (const seen of [c.vessel.key, sibling.vessel.key, c.session.key, c.certificate.signature, sibling.certificate.signature]) {
      expect(held.has(seen), seen).toBe(false);
    }
    // CONTROL: the memory does hold the face key it answers for, and the denial it learned.
    expect(held.has(c.scope.faceKey)).toBe(true);
    expect(held.has(events[0]!.withdrawn)).toBe(true);
    expect(isWithdrawalMemory(memory)).toBe(true);
  });
});

/** A session certificate for `of`'s face under another of its vessels. */
async function chainUnder(of: Chain, vessel: Pair): Promise<Pick<Chain, "sessionCertificate">> {
  const session = await pair(`session under ${vessel.key.slice(0, 8)}`);
  const vesselFaceKey = vessel.key as VesselFaceKey;
  const sessionKey = session.key as SessionKey;
  return { sessionCertificate: {
    scope: of.scope, vesselFaceKey, sessionKey, profile: "face",
    signature: await signHex(sessionCertificateImage(of.scope, vesselFaceKey, sessionKey, "face"), vessel),
  } };
}

describe("the vessel's own chain: what a session opens on, before any session key exists", () => {
  test("CONTROL: a certificate under the admitted face key, with no learned denial, verifies and carries its minter's mark", async () => {
    const c = await chain("vessel-chain", NEXUS_A);
    const verdict = checkVesselChain({ admitted: c.scope, certificate: c.certificate, memory: memoryOf(c.scope) });
    if (verdict.verdict !== "verified") throw new Error(verdict.verdict);
    expect(verdict.chain).toEqual({ scope: c.scope, vesselFaceKey: c.vessel.key, certificate: c.certificate, frontier: genesisFrontier(c.scope) });
    expect(isVerifiedVesselChain(verdict.chain)).toBe(true);
    expect(Object.isFrozen(verdict.chain)).toBe(true);
    // No session key and no session certificate stands anywhere in it.
    expect(stringLeaves(verdict.chain)).not.toContain(c.session.key);
  });

  test("RED: a chain spelled by hand, a copy, and a chain the gate's own check minted carry no vessel mark", async () => {
    const c = await chain("vessel-mark", NEXUS_A);
    const memory = memoryOf(c.scope);
    const real = checkVesselChain({ admitted: c.scope, certificate: c.certificate, memory });
    if (real.verdict !== "verified") throw new Error(real.verdict);
    const gates = checkFaceChain({ admitted: c.scope, certificate: c.certificate, sessionCertificate: c.sessionCertificate, frontier: memory.frontier, carried: [], memory });
    if (gates.verdict !== "verified") throw new Error(gates.verdict);
    for (const impostor of [{ ...real.chain }, structuredClone({ ...real.chain }), gates.chain, real, null]) expect(isVerifiedVesselChain(impostor)).toBe(false);
    expect(isVerifiedFaceChain(real.chain)).toBe(false);                 // nor does a vessel chain pass for a gate's
  });

  test("RED: a denied key reads withdrawn, a fork reads forked, a gap reads incomplete, and none mints a chain", async () => {
    const c = await chain("vessel-states", NEXUS_A);
    const other = await vesselOf(c, "vessel-states other");
    const denied = await history(c, [c.vessel.key]);
    expect(checkVesselChain({ admitted: c.scope, certificate: c.certificate, memory: memoryOf(c.scope, denied) })).toEqual({ verdict: "withdrawn" });
    const genesis = genesisFrontier(c.scope).head;
    const fork = [await withdrawal(c.scope, 1, genesis, other.vessel.key, c.face), await withdrawal(c.scope, 1, genesis, (await pair("vessel-states third")).key, c.face)];
    expect(checkVesselChain({ admitted: c.scope, certificate: c.certificate, memory: memoryOf(c.scope, fork) })).toEqual({ verdict: "forked" });
    const two = await history(c, [other.vessel.key, (await pair("vessel-states fourth")).key]);
    expect(checkVesselChain({ admitted: c.scope, certificate: c.certificate, memory: memoryOf(c.scope, [two[1]!]) })).toEqual({ verdict: "incomplete" });
    // CONTROL: the same vessel under a history that denies only its sibling verifies, at that history's frontier.
    const sound = checkVesselChain({ admitted: c.scope, certificate: c.certificate, memory: memoryOf(c.scope, two) });
    expect(sound.verdict === "verified" && sound.chain.frontier.position).toBe(2);
  });

  test("RED: another face, another Nexus, a forged certificate and a foreign memory each read invalid by name", async () => {
    const c = await chain("vessel-invalid", NEXUS_A);
    const elsewhere = await chain("vessel-invalid", NEXUS_B);
    const stranger = await chain("vessel-invalid stranger", NEXUS_A);
    const memory = memoryOf(c.scope);
    const refusal = (input: Parameters<typeof checkVesselChain>[0]): string => { const v = checkVesselChain(input); return v.verdict === "invalid" ? v.refusal : v.verdict; };
    expect(refusal({ admitted: c.scope, certificate: stranger.certificate, memory })).toBe("certificate-other-face");
    expect(refusal({ admitted: c.scope, certificate: elsewhere.certificate, memory })).toBe("certificate-other-nexus");
    expect(refusal({ admitted: c.scope, certificate: { ...c.certificate, signature: stranger.certificate.signature }, memory })).toBe("certificate-refused");
    expect(refusal({ admitted: c.scope, certificate: c.certificate, memory: { ...memory } as WithdrawalMemory })).toBe("memory-foreign");
    expect(refusal({ admitted: c.scope, certificate: c.certificate, memory: memoryOf(stranger.scope) })).toBe("memory-other-face");
    expect(refusal({ admitted: { faceKey: "zz", nexus: NEXUS_A } as never, certificate: c.certificate, memory })).toBe("admitted-malformed");
    expect(refusal({ admitted: c.scope, certificate: c.certificate, memory })).toBe("verified");   // CONTROL
  });
});
