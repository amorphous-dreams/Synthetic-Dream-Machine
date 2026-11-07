/**
 * place-anchor-seals — THE SEALER READS THE SESSION'S (FACE, ANCHOR), WHATEVER THE ANCHOR.
 *
 * A session reads (face, anchor), and the anchor reads a Nexus or the place (session-contract#/the-hands). A vessel that
 * dials nothing still wears its face at its own place: its saves sign under that place session and seal, or a restart
 * would lose what waited in memory (stable-founding-road#/rulings, "A timer save signs under its session").
 *
 *   A1  RED: a record signs under a place session's signer and reads back whole, its certificate the atom's.
 *   A2  RED: the session sign book answers a place-anchored session of the worn face where the vessel's own chain names
 *       that place: its certificate, its subject, and a signature that reads under the place certificate.
 *   A0  CONTROL: where the vessel's chain names no place (a floor, a locked face), a place session's ask refuses by name
 *       and its signer signs nothing.
 *   A3  CONTROL: a Nexus-anchored session answers as before.
 *
 * Canon: lar:///ha.ka.ba/lararium/mesh/sealed-store#/the-store
 */
import { describe, expect, it } from "vitest";
import { keyVersionIdOf, readContentKey } from "../src/sealed-chunk.js";
import { bagLocatorOf, readRecord, signRecord, type RecordSigner, type WriterStanding } from "../src/sealed-records.js";
import {
  faceProofSubjectRef, placeProofSubjectRef, placeSessionSignatureImage, readPlaceSessionSignature, sessionSignatureImage,
} from "../src/face-proof-subjects.js";
import { SessionSignBook, type BookedSession } from "../src/session-sign-book.js";
import { chain, placeChain, signHex, type PlaceChain } from "./face-proof-fixture.js";

const BAG = "lar:///ha.ka.ba/@test/bags/place-notes";
const PLACE = "EplaceKelPrefix_test.one";
const key = readContentKey(new Uint8Array(32).fill(0x41))!;
const v1 = keyVersionIdOf(key, BAG);
const LOCATOR = bagLocatorOf(key, BAG);
const everyone: WriterStanding = { holdsWrite: () => true };

const placeSigner = (c: PlaceChain, signed: string[] = []): RecordSigner & { dropped: boolean } => ({
  dropped: false,
  certificate: c.certificate as never,
  sign: async (purpose, payload) => { signed.push(purpose); return { signature: await signHex(placeSessionSignatureImage(purpose, c.scope, c.certificate.sessionKey, payload), c.session) }; },
});
const placeSession = (c: PlaceChain, signed: string[] = []): BookedSession =>
  ({ signer: placeSigner(c, signed), anchor: { kind: "place" }, subject: placeProofSubjectRef(c.scope) });

describe("the sealer reads the session's (face, anchor)", () => {
  it("A1 RED: a record signs under a place session and reads back, its certificate the atom's", async () => {
    const c = await placeChain("place-writer", PLACE);
    const body = { bag: LOCATOR, keyVersion: v1, parents: [], span: v1 };
    const secret = { cause: { kind: "founding" as const }, history: "shareable" as const, joinProofs: [], unserved: [] };
    const signed = await signRecord({ kind: "key-version", body, private: secret, bagId: BAG, key, signer: placeSigner(c) });
    if (!("record" in signed)) throw new Error(`the place session's record refused: ${signed.refusal} ${signed.cause ?? ""}`);
    const read = readRecord("key-version", signed.record, { bagId: BAG, locator: LOCATOR, key, standing: everyone });
    expect("record" in read ? "READ" : `${read.refusal}:${read.cause ?? ""}`).toBe("READ");
    if ("record" in read) expect(read.record.certificate).toEqual(c.certificate);
  });

  it("A2 RED: the book answers a place session of the worn face where the vessel's chain names its place", async () => {
    const c = await placeChain("place-book", PLACE);
    const book = new SessionSignBook();
    const door = book.door(() => ({ place: c.scope }), async () => ({ read: true, counted: [], unanswered: [] }));
    book.hold("call-1", "sealed-seal", placeSession(c));
    const read = await door({ op: "read", ask: "call-1", verb: "sealed-seal" });
    expect(read).toMatchObject({ certificate: c.certificate, subject: placeProofSubjectRef(c.scope), chain: { place: c.scope } });
    const payload = new Uint8Array([1, 2, 3]);
    const sig = await door({ op: "sign", ask: "call-1", verb: "sealed-seal", payload });
    if (!("signature" in sig)) throw new Error(`the place session's signature refused: ${JSON.stringify(sig)}`);
    expect("read" in readPlaceSessionSignature(c.certificate, "act", payload, sig.signature)).toBe(true);
  });

  it("A0 CONTROL: with no place standing (a floor, a locked face), a place session's ask refuses and signs nothing", async () => {
    const c = await placeChain("place-floor", PLACE);
    const signed: string[] = [];
    const book = new SessionSignBook();
    const door = book.door(() => null);
    book.hold("call-1", "sealed-seal", placeSession(c, signed));
    expect(await door({ op: "read", ask: "call-1", verb: "sealed-seal" })).toHaveProperty("refusal");
    expect(await door({ op: "sign", ask: "call-1", verb: "sealed-seal", payload: new Uint8Array([1]) })).toHaveProperty("refusal");
    expect(signed).toEqual([]);
  });

  it("A3 CONTROL: a Nexus-anchored session answers as before", async () => {
    const c = await chain("nexus-book", "nexus-test-one");
    const own = { scope: c.scope, vesselFaceKey: c.sessionCertificate.vesselFaceKey };
    const book = new SessionSignBook();
    const door = book.door(() => own);
    book.hold("call-1", "sealed-seal", {
      anchor: { kind: "nexus" }, subject: faceProofSubjectRef(c.scope),
      signer: { dropped: false, certificate: c.sessionCertificate, sign: async (purpose, payload) => ({ signature: await signHex(sessionSignatureImage(purpose, c.scope, c.sessionCertificate.sessionKey, payload), c.session) }) },
    });
    expect(await door({ op: "read", ask: "call-1", verb: "sealed-seal" })).toMatchObject({ certificate: c.sessionCertificate, subject: faceProofSubjectRef(c.scope) });
  });
});
