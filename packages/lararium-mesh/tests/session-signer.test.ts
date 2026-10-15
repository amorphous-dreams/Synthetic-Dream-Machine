/**
 * session-signer.test — the key one session signs with, beneath its vessel's face-scoped key.
 *
 * The suite opens real sessions on the session contract's own table, wearing faces the one supplier built,
 * so a signer here asks the table an owner would hold.
 *
 * Canon: lar:///ha.ka.ba/lares/api/pono/face-proof#/the-key-hierarchy
 */
import * as ed25519 from "@noble/ed25519";
import { describe, expect, test } from "vitest";
import { hex, utf8Bytes } from "../src/crypto.js";
import { checkVesselChain, foldWithdrawals, type VesselFaceKeyCustody } from "../src/face-authority.js";
import { readSessionCertificate, readSessionSignature, sessionSignatureImage } from "../src/face-proof-subjects.js";
import { SessionTable, sessionBinding, type CapabilityProfile, type Session, type SessionBinding, type SessionFace } from "../src/session-contract.js";
import { supplySessionFace } from "../src/session-face.js";
import { SessionSigner, mintSessionSigner, openSignedSession } from "../src/session-signer.js";
import { chain, pair, stringLeaves, type Chain, type Pair } from "./face-proof-fixture.js";

const NEXUS_A = "nexus-a.synthetic";
const OWNER_EPOCH = "owner-epoch-synthetic";
const GROUP_ONE = "b7f1c2a9d4e60381";
const GROUP_TWO = "3e5a90cc17bd4f22";
const PAYLOAD = utf8Bytes("a synthetic payload");
const custodyOf = (by: Pair): VesselFaceKeyCustody => ({ signAsVesselFace: (_scope, _key, image) => ed25519.signAsync(image, by.secret) });

/** The face `c` wears, as the one supplier builds it. */
function faceOf(c: Chain, group: string): SessionFace {
  const fold = foldWithdrawals(c.scope);
  if (!("memory" in fold)) throw new Error(fold.refusal);
  const verdict = checkVesselChain({ admitted: c.scope, certificate: c.certificate, memory: fold.memory });
  if (verdict.verdict !== "verified") throw new Error(verdict.verdict);
  const supply = supplySessionFace({
    chain: verdict.chain, vesselFaceKey: c.vessel.key,
    admit: { verdict: { state: "held", reason: "held", nym: c.scope.faceKey }, nexus: c.scope.nexus, admitRef: `admit-${group}`, revision: `heads-${group}` },
    grant: { personaGroup: group, faceKey: c.scope.faceKey, nexus: c.scope.nexus, revision: `group-${group}` },
  });
  if (!("face" in supply)) throw new Error(supply.refusal);
  return supply.face;
}

interface Opened { readonly table: SessionTable; readonly binding: SessionBinding; readonly session: Session }

/** Open a live session on `table` wearing `c`'s face. */
function open(table: SessionTable, c: Chain, group: string, profile: CapabilityProfile): Opened {
  const binding = sessionBinding("socket");
  const opened = table.open(binding, faceOf(c, group), profile);
  if (!opened.ok) throw new Error(opened.refusal);
  return { table, binding, session: opened.session };
}

async function signerFor(c: Chain, at: Opened): Promise<SessionSigner> {
  const minted = await mintSessionSigner({ ...at, certificate: c.certificate, apart: [], custody: custodyOf(c.vessel) });
  if (!("signer" in minted)) throw new Error(minted.refusal);
  return minted.signer;
}

describe("minting a session's signer", () => {
  test("a live session takes a signer whose certificate chains beneath its vessel's face-scoped key", async () => {
    const c = await chain("mint", NEXUS_A);
    const at = open(new SessionTable(OWNER_EPOCH), c, GROUP_ONE, "verb");
    const signer = await signerFor(c, at);
    expect(readSessionCertificate(signer.certificate)).toEqual({ read: signer.certificate });
    expect(signer.certificate).toMatchObject({ scope: c.scope, vesselFaceKey: c.vessel.key, profile: "verb" });
    expect(signer.certificate.sessionKey).not.toBe(c.session.key);     // a fresh key, minted at the open
    expect(signer.binding).toEqual({ sessionId: at.session.sessionId, ownerEpoch: OWNER_EPOCH, generation: 0, profile: "verb" });
    const signed = await signer.sign("act", PAYLOAD);
    if (!("signature" in signed)) throw new Error(signed.refusal);
    expect(readSessionSignature(signer.certificate, "act", PAYLOAD, signed.signature)).toEqual({ read: "act" });
  });

  test("two sessions of one face hold two keys: each mint draws its own", async () => {
    const c = await chain("mint-fresh", NEXUS_A);
    const table = new SessionTable(OWNER_EPOCH);
    const [a, b] = [await signerFor(c, open(table, c, GROUP_ONE, "face")), await signerFor(c, open(table, c, GROUP_ONE, "face"))];
    expect(a.certificate.sessionKey).not.toBe(b.certificate.sessionKey);
    expect(a.certificate.scope.faceKey).toBe(b.certificate.scope.faceKey);   // CONTROL: one face, as the law allows
  });

  test("a session wearing one face takes no signer under another face's certificate", async () => {
    const one = await chain("mint-face one", NEXUS_A);
    const two = await chain("mint-face two", NEXUS_A);
    const at = open(new SessionTable(OWNER_EPOCH), one, GROUP_ONE, "face");
    expect(await mintSessionSigner({ ...at, certificate: two.certificate, apart: [], custody: custodyOf(two.vessel) })).toEqual({ refusal: "session-other-face" });
  });

  test("the owner's table decides who stands: a copied record, another binding and a closed session mint nothing", async () => {
    const c = await chain("mint-table", NEXUS_A);
    const table = new SessionTable(OWNER_EPOCH);
    const at = open(table, c, GROUP_ONE, "face");
    const args = { certificate: c.certificate, apart: [], custody: custodyOf(c.vessel) };
    // A record the table never opened: spelled by hand from a live one, under a fresh id.
    expect(await mintSessionSigner({ ...at, session: { ...at.session, sessionId: "copied-id" }, ...args })).toEqual({ refusal: "session-not-live" });
    // The live record, presented on a binding it never opened on.
    expect(await mintSessionSigner({ ...at, binding: sessionBinding("socket"), ...args })).toEqual({ refusal: "session-not-live" });
    // The live record, with a wider profile written over it: the table's own record names the profile.
    const widened = await mintSessionSigner({ ...open(table, c, GROUP_ONE, "seat"), ...args });
    const forged = open(table, c, GROUP_ONE, "seat");
    const lied = await mintSessionSigner({ ...forged, session: { ...forged.session, profile: "face" }, ...args });
    if (!("signer" in widened) || !("signer" in lied)) throw new Error("mint refused");
    expect(lied.signer.certificate.profile).toBe("seat");
    expect(lied.signer.binding.profile).toBe("seat");
    // A session the table closed.
    table.close(at.session.sessionId);
    expect(await mintSessionSigner({ ...at, ...args })).toEqual({ refusal: "session-not-live" });
    expect(await mintSessionSigner({ ...at, table: {} as SessionTable, ...args })).toEqual({ refusal: "table-foreign" });
    expect(await mintSessionSigner({ ...at, session: { sessionId: "s" }, ...args })).toEqual({ refusal: "session-malformed" });
  });

  test("a refused certificate and a custody door astray each mint nothing", async () => {
    const c = await chain("mint-refuse", NEXUS_A);
    const at = open(new SessionTable(OWNER_EPOCH), c, GROUP_ONE, "face");
    expect(await mintSessionSigner({ ...at, certificate: c.certificate, apart: [c.vessel.key], custody: custodyOf(c.vessel) }))
      .toMatchObject({ refusal: "certificate-refused", cause: { refusal: "key-held-apart" } });
    expect(await mintSessionSigner({ ...at, certificate: c.certificate, apart: [], custody: custodyOf(c.face) }))
      .toMatchObject({ refusal: "custody-astray" });
  });

  test("no hand builds a signer past the mint", async () => {
    const c = await chain("mint-lock", NEXUS_A);
    const at = open(new SessionTable(OWNER_EPOCH), c, GROUP_ONE, "face");
    expect(() => new SessionSigner(Symbol("session-signer mint"), c.sessionCertificate, { sessionId: "s", ownerEpoch: "e", generation: 0, profile: "face" }, at.table, at.binding, new Uint8Array(32)))
      .toThrow(/mintSessionSigner alone/);
  });

  test("a signer hands out no secret, and the random source keeps none", async () => {
    const c = await chain("mint-secret", NEXUS_A);
    const at = open(new SessionTable(OWNER_EPOCH), c, GROUP_ONE, "face");
    const kept: Uint8Array[] = [];
    const keeping = { getRandomValues: <T extends Uint8Array<ArrayBuffer>>(array: T): T => { array.fill(9); kept.push(array); return array; }, randomUUID: () => "unused" };
    const minted = await mintSessionSigner({ ...at, certificate: c.certificate, apart: [], custody: custodyOf(c.vessel), random: keeping });
    if (!("signer" in minted)) throw new Error(minted.refusal);
    const secret = "09".repeat(32);
    expect(minted.signer.certificate.sessionKey).toBe(hex(await ed25519.getPublicKeyAsync(new Uint8Array(32).fill(9))));   // the setup took
    expect(JSON.stringify(minted.signer)).not.toContain(secret);
    expect(stringLeaves({ ...minted.signer }).has(secret)).toBe(false);
    expect(Object.isFrozen(minted.signer)).toBe(true);
    // The array the source kept holds nothing, and the signer still signs: its key rests in storage of its own.
    expect(kept.length).toBe(1);
    expect(hex(kept[0]!)).toBe("00".repeat(32));
    expect("signature" in await minted.signer.sign("act", PAYLOAD)).toBe(true);
  });

  test("a mint that refuses after it drew a key leaves no key behind", async () => {
    const c = await chain("mint-zero", NEXUS_A);
    const at = open(new SessionTable(OWNER_EPOCH), c, GROUP_ONE, "face");
    const kept: Uint8Array[] = [];
    const keeping = { getRandomValues: <T extends Uint8Array<ArrayBuffer>>(array: T): T => { array.fill(9); kept.push(array); return array; }, randomUUID: () => "unused" };
    const throwing: VesselFaceKeyCustody = { signAsVesselFace: () => Promise.reject(new Error("custody closed")) };
    await expect(mintSessionSigner({ ...at, certificate: c.certificate, apart: [], custody: throwing, random: keeping })).rejects.toThrow("custody closed");
    expect(hex(kept[0]!)).toBe("00".repeat(32));
    // A source that fills the array and then throws leaves no bytes in it either.
    const failing = { getRandomValues: <T extends Uint8Array<ArrayBuffer>>(array: T): T => { array.fill(9); kept.push(array); throw new Error("source failed"); }, randomUUID: () => "unused" };
    await expect(mintSessionSigner({ ...at, certificate: c.certificate, apart: [], custody: custodyOf(c.vessel), random: failing })).rejects.toThrow("source failed");
    expect(kept.length).toBe(2);
    expect(hex(kept[1]!)).toBe("00".repeat(32));
  });
});

describe("what a signer signs, and for whom", () => {
  test("a seat and the watcher sign a finish and an act, and never an authority act", async () => {
    const c = await chain("profile", NEXUS_A);
    const table = new SessionTable(OWNER_EPOCH);
    for (const profile of ["seat", "ingest"] as const) {
      const signer = await signerFor(c, open(table, c, GROUP_ONE, profile));
      expect(await signer.sign("authority", PAYLOAD), profile).toEqual({ refusal: "purpose-beyond-profile" });
      expect("signature" in await signer.sign("act", PAYLOAD), profile).toBe(true);
      expect("signature" in await signer.sign("finish", PAYLOAD), profile).toBe(true);
      expect(signer.dropped).toBe(false);                                // a refused purpose drops nothing
    }
    for (const profile of ["face", "verb"] as const) {
      const signed = await (await signerFor(c, open(table, c, GROUP_ONE, profile))).sign("authority", PAYLOAD);
      expect("signature" in signed, profile).toBe(true);                  // CONTROL
    }
  });

  test("an unknown purpose and a payload of another kind sign nothing", async () => {
    const c = await chain("purpose", NEXUS_A);
    const signer = await signerFor(c, open(new SessionTable(OWNER_EPOCH), c, GROUP_ONE, "face"));
    expect(await signer.sign("root", PAYLOAD)).toEqual({ refusal: "purpose-unknown" });
    expect(await signer.sign("act", "payload")).toEqual({ refusal: "payload-malformed" });
    expect(signer.dropped).toBe(false);
  });

  test("a switch drops the signer: the table holds the session one generation on", async () => {
    const one = await chain("switch one", NEXUS_A);
    const two = await chain("switch two", NEXUS_A);
    const table = new SessionTable(OWNER_EPOCH);
    const at = open(table, one, GROUP_ONE, "face");
    const signer = await signerFor(one, at);
    expect("signature" in await signer.sign("act", PAYLOAD)).toBe(true);        // CONTROL: before the switch it signs
    table.transition(at.session.sessionId, "switching");
    const advanced = table.advance(at.session.sessionId, 0, faceOf(two, GROUP_TWO));
    if (!advanced.ok) throw new Error(advanced.refusal);
    expect(advanced.session.generation).toBe(1);
    expect(await signer.sign("act", PAYLOAD)).toEqual({ refusal: "stale-generation" });
    expect(signer.dropped).toBe(true);
    expect(await signer.sign("act", PAYLOAD)).toEqual({ refusal: "signer-dropped" });
  });

  test("a session frozen for its switch signs nothing, and a refused preflight returns its signer whole", async () => {
    const c = await chain("switching", NEXUS_A);
    const table = new SessionTable(OWNER_EPOCH);
    const at = open(table, c, GROUP_ONE, "face");
    const signer = await signerFor(c, at);
    table.transition(at.session.sessionId, "switching");
    expect(await signer.sign("act", PAYLOAD)).toEqual({ refusal: "session-not-live" });
    expect(signer.dropped).toBe(false);                                // frozen, never fallen: the old generation may yet stand
    table.transition(at.session.sessionId, "live");                     // the preflight refused; the same generation lives on
    const signed = await signer.sign("act", PAYLOAD);
    if (!("signature" in signed)) throw new Error(signed.refusal);
    expect(readSessionSignature(signer.certificate, "act", PAYLOAD, signed.signature)).toEqual({ read: "act" });
  });

  test("a freeze that lands while the key signs lets no signature leave, and drops nothing", async () => {
    const c = await chain("freeze-race", NEXUS_A);
    const table = new SessionTable(OWNER_EPOCH);
    const at = open(table, c, GROUP_ONE, "face");
    const signer = await signerFor(c, at);
    const pending = signer.sign("act", PAYLOAD);
    table.transition(at.session.sessionId, "switching");
    expect(await pending).toEqual({ refusal: "session-not-live" });
    expect(signer.dropped).toBe(false);
  });

  test("a revoked session signs nothing, and its close drops the signer", async () => {
    const c = await chain("revoked", NEXUS_A);
    const table = new SessionTable(OWNER_EPOCH);
    const at = open(table, c, GROUP_ONE, "face");
    const signer = await signerFor(c, at);
    table.transition(at.session.sessionId, "revoked");
    expect(await signer.sign("act", PAYLOAD)).toEqual({ refusal: "session-not-live" });
    table.transition(at.session.sessionId, "closed");
    expect(await signer.sign("act", PAYLOAD)).toEqual({ refusal: "session-not-live" });
    expect(signer.dropped).toBe(true);
  });

  test("a close drops the signer, though no hand called drop", async () => {
    const c = await chain("close", NEXUS_A);
    const table = new SessionTable(OWNER_EPOCH);
    const at = open(table, c, GROUP_ONE, "face");
    const signer = await signerFor(c, at);
    table.close(at.session.sessionId);
    const pending = signer.sign("act", PAYLOAD);
    expect(signer.dropped).toBe(true);                                  // dropped BEFORE the key could sign: the table read first
    expect(await pending).toEqual({ refusal: "session-not-live" });
    const explicit = await signerFor(c, open(table, c, GROUP_ONE, "face"));
    explicit.drop();
    expect(await explicit.sign("act", PAYLOAD)).toEqual({ refusal: "signer-dropped" });
  });

  test("a close that lands while the key signs lets no signature leave", async () => {
    const c = await chain("race", NEXUS_A);
    const table = new SessionTable(OWNER_EPOCH);
    const at = open(table, c, GROUP_ONE, "face");
    const signer = await signerFor(c, at);
    const pending = signer.sign("act", PAYLOAD);                        // the table read live; the key now signs
    table.close(at.session.sessionId);                                  // the close lands before the await returns
    expect(await pending).toEqual({ refusal: "session-not-live" });
    expect(signer.dropped).toBe(true);
  });

  test("another session's close leaves this signer standing", async () => {
    const c = await chain("neighbour", NEXUS_A);
    const table = new SessionTable(OWNER_EPOCH);
    const [mine, other] = [open(table, c, GROUP_ONE, "face"), open(table, c, GROUP_ONE, "face")];
    const signer = await signerFor(c, mine);
    table.close(other.session.sessionId);
    expect("signature" in await signer.sign("act", PAYLOAD)).toBe(true);
    expect(signer.dropped).toBe(false);
  });
});

describe("two faces of one vessel share nothing a signer shows", () => {
  test("two sessions under one owner epoch, wearing two faces, show no common string and no vessel mark", async () => {
    const one = await chain("vessel-v face-one", NEXUS_A);
    const two = await chain("vessel-v face-two", NEXUS_A);
    const table = new SessionTable(OWNER_EPOCH);                         // ONE vessel: one owner, one epoch
    const [a, b] = [open(table, one, GROUP_ONE, "face"), open(table, two, GROUP_TWO, "face")];
    const [signerA, signerB] = [await signerFor(one, a), await signerFor(two, b)];
    const shown = async (signer: SessionSigner): Promise<Set<string>> => {
      const finish = await signer.sign("finish", PAYLOAD);
      if (!("signature" in finish)) throw new Error(finish.refusal);
      const image = sessionSignatureImage("finish", signer.certificate.scope, signer.certificate.sessionKey, PAYLOAD);
      const leaves = stringLeaves([signer.certificate, finish.signature, image]);
      leaves.delete(signer.certificate.scope.nexus);
      leaves.delete(signer.certificate.profile);
      return leaves;
    };
    const [mine, theirs] = [await shown(signerA), await shown(signerB)];
    expect(mine.size).toBeGreaterThan(4);
    expect([...mine].filter((leaf) => theirs.has(leaf))).toEqual([]);
    // No vessel-wide value rides what a gate reads: neither the owner's epoch nor a session id.
    for (const signer of [signerA, signerB]) {
      const wire = JSON.stringify(signer.certificate) + hex(sessionSignatureImage("finish", signer.certificate.scope, signer.certificate.sessionKey, PAYLOAD));
      for (const local of [OWNER_EPOCH, a.session.sessionId, b.session.sessionId]) {
        expect(wire).not.toContain(local);
        expect(wire).not.toContain(hex(utf8Bytes(local)));
      }
    }
    // CONTROL: the binding, which never crosses, does hold the shared owner epoch.
    expect(signerA.binding.ownerEpoch).toBe(signerB.binding.ownerEpoch);
  });
});

describe("a session opens before its certificate, and never stands live without its signer", () => {
  test("CONTROL: one door opens the session on the supplied face and mints its signer", async () => {
    const c = await chain("open-signed", NEXUS_A);
    const table = new SessionTable(OWNER_EPOCH);
    const binding = sessionBinding("socket");
    const opened = await openSignedSession({ table, binding, face: faceOf(c, GROUP_ONE), profile: "verb", certificate: c.certificate, apart: [], custody: custodyOf(c.vessel) });
    if (!("signer" in opened)) throw new Error(opened.refusal);
    expect(opened.session.state).toBe("live");
    expect(opened.signer.binding.sessionId).toBe(opened.session.sessionId);
    expect(opened.signer.certificate.profile).toBe("verb");
    expect(table.size).toBe(1);
    expect("signature" in await opened.signer.sign("act", PAYLOAD)).toBe(true);
  });

  test("RED: a mint that refuses or throws closes the session it opened: no session stands live with a face and no signer", async () => {
    const c = await chain("open-unsigned", NEXUS_A);
    const other = await chain("open-unsigned other", NEXUS_A);
    const table = new SessionTable(OWNER_EPOCH);
    const args = { table, face: faceOf(c, GROUP_ONE), profile: "face" as const, certificate: c.certificate, apart: [] };
    // The custody door signs under another key: the certificate fails its own reading.
    const astray = sessionBinding("socket");
    expect(await openSignedSession({ ...args, binding: astray, custody: custodyOf(other.vessel) })).toEqual({ refusal: "custody-astray", cause: expect.anything() });
    expect(table.size).toBe(0);
    // The custody door throws: the open still gets undone, and the fault leaves by its own name.
    const thrown = sessionBinding("socket");
    await expect(openSignedSession({ ...args, binding: thrown, custody: { signAsVesselFace: () => { throw new Error("custody locked"); } } })).rejects.toThrow(/custody locked/);
    expect(table.size).toBe(0);
    // A certificate under another face: the session never wears a face its signer cannot sign for.
    expect(await openSignedSession({ ...args, binding: sessionBinding("socket"), certificate: other.certificate, custody: custodyOf(other.vessel) })).toEqual({ refusal: "session-other-face" });
    expect(table.size).toBe(0);
    // The bindings stand free again: a later open on the same binding takes it.
    const again = await openSignedSession({ ...args, binding: astray, custody: custodyOf(c.vessel) });
    expect("signer" in again).toBe(true);
    expect(table.size).toBe(1);
  });

  test("RED: a face the table refuses opens nothing and mints nothing", async () => {
    const c = await chain("open-refused", NEXUS_A);
    const table = new SessionTable(OWNER_EPOCH);
    let asked = 0;
    const custody = { signAsVesselFace: (...a: Parameters<VesselFaceKeyCustody["signAsVesselFace"]>) => { asked++; return custodyOf(c.vessel).signAsVesselFace(...a); } };
    expect(await openSignedSession({ table, binding: sessionBinding("socket"), face: { ...faceOf(c, GROUP_ONE), root: "bytes" }, profile: "face", certificate: c.certificate, apart: [], custody }))
      .toEqual({ refusal: "session-malformed", open: "face-malformed" });
    expect(await openSignedSession({ table, binding: sessionBinding("socket"), face: faceOf(c, GROUP_ONE), profile: "carriage", certificate: c.certificate, apart: [], custody }))
      .toEqual({ refusal: "session-malformed", open: "profile-unknown" });
    expect(asked).toBe(0);
    expect(table.size).toBe(0);
  });
});
