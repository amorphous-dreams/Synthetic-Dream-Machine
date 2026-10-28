/**
 * place-session.test — a session anchored at its vessel's own place: the face's atom presented to its own vessel, no
 * Nexus admit. The face names the atom and the place; the atom certifies one session key; the key signs behind the
 * owner's table, as a Nexus session's signer does, and no place image reads as a Nexus one.
 *
 * Canon: lar:///ha.ka.ba/lares/api/pono/session-contract#/the-hands
 */
import * as ed25519 from "@noble/ed25519";
import { describe, expect, test } from "vitest";
import { hex, utf8Bytes } from "../src/crypto.js";
import { faceProofSubjectRef, readPlaceSessionSignature, type FaceKey, type NexusAid } from "../src/face-proof-subjects.js";
import { SessionTable, sessionBinding } from "../src/session-contract.js";
import { preparePlaceFace, supplyPlaceFace } from "../src/session-face.js";

const GROUP = "b7f1c2a9d4e60381";
const PLACE = { place: "EplaceSyntheticPrefix000000000000000000000001", seq: 0, head: "a".repeat(64) };
const PAYLOAD = utf8Bytes("a synthetic act");

async function atom(fill: number) {
  const secret = new Uint8Array(32).fill(fill);
  const key = hex(await ed25519.getPublicKeyAsync(secret));
  return { key, sign: async (image: Uint8Array) => hex(await ed25519.signAsync(image, secret)) };
}

async function opened(profile: "verb" | "seat" = "verb", fill = 7) {
  const a = await atom(fill);
  const target = preparePlaceFace({ personaGroup: GROUP, atomKey: a.key, place: PLACE, signAsAtom: a.sign });
  if (!("face" in target)) throw new Error(target.refusal);
  const table = new SessionTable("owner-epoch-place");
  const binding = sessionBinding("socket");
  const open = table.open(binding, target.face, profile);
  if (!open.ok) throw new Error(open.refusal);
  return { a, target, table, binding, session: open.session };
}

describe("the place anchor", () => {
  test("the place face names the atom and the place, and its proof subject reads as no Nexus subject over the same strings", async () => {
    const a = await atom(7);
    const supplied = supplyPlaceFace({ personaGroup: GROUP, atomKey: a.key, place: PLACE });
    if (!("face" in supplied)) throw new Error(supplied.refusal);
    expect(supplied.face).toMatchObject({ personaGroup: GROUP, admitRef: `place:${PLACE.place}@${PLACE.head}`, causalRevision: `place:0:${PLACE.head}` });
    expect(supplied.face.proofSubject).not.toBe(faceProofSubjectRef({ faceKey: a.key as FaceKey, nexus: PLACE.place as NexusAid }));
    // A rotation of the place moves the revision and keeps the proof subject.
    const rotated = supplyPlaceFace({ personaGroup: GROUP, atomKey: a.key, place: { ...PLACE, seq: 1, head: "b".repeat(64) } });
    if (!("face" in rotated)) throw new Error(rotated.refusal);
    expect(rotated.face.proofSubject).toBe(supplied.face.proofSubject);
    expect(rotated.face.causalRevision).not.toBe(supplied.face.causalRevision);
  });

  test("each malformed reading refuses by name", async () => {
    const a = await atom(7);
    expect(supplyPlaceFace({ personaGroup: "not hex", atomKey: a.key, place: PLACE })).toEqual({ refusal: "group-malformed" });
    expect(supplyPlaceFace({ personaGroup: GROUP, atomKey: "00", place: PLACE })).toEqual({ refusal: "atom-malformed" });
    expect(supplyPlaceFace({ personaGroup: GROUP, atomKey: a.key, place: { ...PLACE, seq: -1 } })).toEqual({ refusal: "place-malformed" });
    expect(supplyPlaceFace({ personaGroup: GROUP, atomKey: a.key, place: { place: "has space", seq: 0, head: "h" } })).toEqual({ refusal: "place-malformed" });
  });

  test("the atom certifies one session key; the key signs an act behind the table, and no dial finish", async () => {
    const { a, target, table, binding, session } = await opened();
    const minted = await target.mint({ table, binding, session });
    if (!("signer" in minted)) throw new Error(minted.refusal);
    const { signer } = minted;
    expect(signer.certificate.scope).toEqual({ atomKey: a.key, place: PLACE.place });
    expect(signer.certificate.sessionKey).not.toBe(a.key);
    const signed = await signer.sign("act", PAYLOAD);
    if (!("signature" in signed)) throw new Error(signed.refusal);
    expect(readPlaceSessionSignature(signer.certificate, "act", PAYLOAD, signed.signature)).toEqual({ read: "act" });
    expect(await signer.sign("finish", PAYLOAD)).toEqual({ refusal: "purpose-unknown" });
  });

  test("RED: a closed session's signer drops at its next sign; a seat's signer signs no authority", async () => {
    const { target, table, binding, session } = await opened();
    const minted = await target.mint({ table, binding, session });
    if (!("signer" in minted)) throw new Error(minted.refusal);
    table.close(session.sessionId);
    expect(await minted.signer.sign("act", PAYLOAD)).toMatchObject({ refusal: "session-not-live" });
    expect(minted.signer.dropped).toBe(true);
    const seat = await opened("seat");
    const seatSigner = await seat.target.mint({ table: seat.table, binding: seat.binding, session: seat.session });
    if (!("signer" in seatSigner)) throw new Error(seatSigner.refusal);
    expect(await seatSigner.signer.sign("authority", PAYLOAD)).toEqual({ refusal: "purpose-beyond-profile" });
  });

  test("RED: an atom door that signs under another key refuses custody-astray; CONTROL: the face's own atom mints", async () => {
    const { target, table, binding, session } = await opened();
    const stranger = await atom(9);
    const astray = preparePlaceFace({ personaGroup: GROUP, atomKey: target.scope.atomKey, place: PLACE, signAsAtom: stranger.sign });
    if (!("face" in astray)) throw new Error(astray.refusal);
    expect(await astray.mint({ table, binding, session })).toMatchObject({ refusal: "custody-astray" });
    expect(await target.mint({ table, binding, session })).toHaveProperty("signer");
  });

  test("a session wearing another face takes no place signer", async () => {
    const { table, binding, session } = await opened("verb", 7);
    const other = await atom(8);
    const target = preparePlaceFace({ personaGroup: GROUP, atomKey: other.key, place: PLACE, signAsAtom: other.sign });
    if (!("face" in target)) throw new Error(target.refusal);
    expect(await target.mint({ table, binding, session })).toEqual({ refusal: "session-other-face" });
  });
});
