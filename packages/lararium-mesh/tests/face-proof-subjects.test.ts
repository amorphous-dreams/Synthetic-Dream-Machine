/**
 * face-proof-subjects.test — the subjects of the face proof, link by link.
 *
 * Each vector names a hole and carries its control beside it: the same reader, handed the lawful subject,
 * reads. A tamper probe changes DECODED bytes and asserts the encoding moved before it reads the refusal.
 *
 * Canon: lar:///ha.ka.ba/lares/api/pono/face-proof
 */
import { describe, expect, test } from "vitest";
import { hex, hexToBytes, utf8Bytes } from "../src/crypto.js";
import * as domains from "../src/domains.js";
import {
  FACE_PROOF_SUBJECT_FIELDS, PROFILE_SIGNING_PURPOSES, SESSION_SIGNING_PURPOSES,
  certificateImage, certificateRequestImage, faceProofSubjectRef, genesisFrontier, profileSigns,
  readCertificate, readCertificateRequest, readFaceKey, readFaceScope, readFrontier, readNexusAid,
  own, readSessionCertificate, readSessionSignature, readWithdrawal, sameFaceScope, sessionCertificateImage,
  sessionSignatureImage, withdrawalHead, withdrawalImage, withdrawnKeyDigest,
  type Digest, type FaceProofRefusal, type NexusAid, type Read, type SessionKey, type VesselFaceKey,
} from "../src/face-proof-subjects.js";
import { CAPABILITY_PROFILES } from "../src/session-contract.js";
import { chain, history, pair, sessionSignature, signHex, stringLeaves, withdrawal } from "./face-proof-fixture.js";

const NEXUS_A = "nexus-a.synthetic";
const NEXUS_B = "nexus-b.synthetic";

const refusalOf = <T>(reading: Read<T>): FaceProofRefusal | null => ("read" in reading ? null : reading);
const reads = <T>(reading: Read<T>): boolean => "read" in reading;

/** The fields of an image, read back off its length prefixes. Throws on a ragged tail. */
function fieldsOf(image: Uint8Array): Uint8Array[] {
  const view = new DataView(image.buffer, image.byteOffset, image.byteLength);
  const fields: Uint8Array[] = [];
  let at = 0;
  while (at < image.length) {
    const length = view.getUint32(at, false);
    if (at + 4 + length > image.length) throw new Error("ragged image");
    fields.push(image.slice(at + 4, at + 4 + length));
    at += 4 + length;
  }
  return fields;
}

/** One bit of a hex value, flipped. */
function flipped(value: string, at = 0): string {
  const bytes = hexToBytes(value);
  bytes[at] = bytes[at]! ^ 0x01;
  return hex(bytes);
}

describe("a scope names one face at one Nexus", () => {
  test("a lawful scope reads; a Nexus in a second spelling refuses", async () => {
    const c = await chain("scope", NEXUS_A);
    expect(reads(readFaceScope(c.scope))).toBe(true);
    for (const nexus of ["", " nexus", "nexus ", "nex us", "néxus", "n".repeat(257)]) {
      expect(refusalOf(readNexusAid(nexus))?.refusal, JSON.stringify(nexus)).toBe("subject-malformed");
    }
    expect(reads(readNexusAid("n".repeat(256)))).toBe(true);
  });

  test("an extra field refuses the scope", async () => {
    const c = await chain("scope-extra", NEXUS_A);
    expect(refusalOf(readFaceScope({ ...c.scope, personaGroup: "pg" }))?.refusal).toBe("subject-malformed");
  });

  test("a key the one door refuses names the door's reason", () => {
    const smallOrder = "0100000000000000000000000000000000000000000000000000000000000000";
    expect(readFaceKey(smallOrder)).toEqual({ refusal: "key-refused", door: "key-small-order" });
    expect(readFaceKey("AB".repeat(32))).toEqual({ refusal: "key-refused", door: "key-malformed" });
    expect(readFaceKey(new Uint8Array(32))).toEqual({ refusal: "key-refused", door: "key-malformed" });
  });

  test("two scopes compare by both fields", async () => {
    const a = await chain("same", NEXUS_A);
    const b = await chain("same", NEXUS_B);
    expect(a.scope.faceKey).toBe(b.scope.faceKey);                    // the setup took: one face key, two Nexuses
    expect(sameFaceScope(a.scope, b.scope)).toBe(false);
    expect(sameFaceScope(a.scope, { ...a.scope })).toBe(true);
  });
});

describe("canonical images", () => {
  test("every image leads with its own purpose, and reads back field by field", async () => {
    const c = await chain("image", NEXUS_A);
    const vessel = c.certificate.vesselFaceKey;
    const session = c.sessionCertificate.sessionKey;
    const head = genesisFrontier(c.scope).head;
    const payload = utf8Bytes("payload");
    const images: ReadonlyArray<readonly [string, Uint8Array, number]> = [
      [domains.FACE_CERTIFICATE_REQUEST_DOMAIN, certificateRequestImage(c.scope, vessel), 4],
      [domains.FACE_CERTIFICATE_DOMAIN, certificateImage(c.scope, vessel), 4],
      [domains.FACE_WITHDRAWAL_DOMAIN, withdrawalImage(c.scope, 1, head, head), 6],
      [domains.SESSION_CERTIFICATE_DOMAIN, sessionCertificateImage(c.scope, vessel, session, "seat"), 6],
      [domains.SESSION_FINISH_DOMAIN, sessionSignatureImage("finish", c.scope, session, payload), 5],
      [domains.SESSION_ACT_DOMAIN, sessionSignatureImage("act", c.scope, session, payload), 5],
      [domains.SESSION_AUTHORITY_DOMAIN, sessionSignatureImage("authority", c.scope, session, payload), 5],
    ];
    for (const [domain, image, count] of images) {
      const fields = fieldsOf(image);
      expect(fields.length, domain).toBe(count);
      expect(new TextDecoder().decode(fields[0]), domain).toBe(domain);
      expect(hex(fields[1]!), domain).toBe(c.scope.faceKey);
      expect(new TextDecoder().decode(fields[2]), domain).toBe(c.scope.nexus);
    }
    expect(new Set(images.map(([, image]) => hex(image))).size).toBe(images.length);
  });

  test("a request and a certificate over the same fields differ in their first field alone", async () => {
    const c = await chain("twin", NEXUS_A);
    const request = fieldsOf(certificateRequestImage(c.scope, c.certificate.vesselFaceKey));
    const certificate = fieldsOf(certificateImage(c.scope, c.certificate.vesselFaceKey));
    expect(request.slice(1).map(hex)).toEqual(certificate.slice(1).map(hex));
    expect(hex(request[0]!)).not.toBe(hex(certificate[0]!));
  });

  test("a withdrawal's position rides as eight big-endian bytes", async () => {
    const c = await chain("position", NEXUS_A);
    const head = genesisFrontier(c.scope).head;
    expect(hex(fieldsOf(withdrawalImage(c.scope, 258, head, head))[3]!)).toBe("0000000000000102");
  });

  test("no digest of one purpose equals a digest of another over the same scope", async () => {
    const c = await chain("digests", NEXUS_A);
    const all = [genesisFrontier(c.scope).head, faceProofSubjectRef(c.scope), withdrawnKeyDigest(c.scope, c.certificate.vesselFaceKey)];
    expect(new Set(all).size).toBe(all.length);
  });
});

describe("the certificate", () => {
  test("a certificate the face key signed reads, and so does its request", async () => {
    const c = await chain("cert", NEXUS_A);
    expect(readCertificate(c.certificate)).toEqual({ read: c.certificate });
    expect(readCertificateRequest(c.request)).toEqual({ read: c.request });
  });

  test("a certificate signed for one Nexus refuses under another", async () => {
    const c = await chain("cert-nexus", NEXUS_A);
    const moved = { ...c.certificate, scope: { ...c.scope, nexus: NEXUS_B as NexusAid } };
    expect(hex(certificateImage(moved.scope, moved.vesselFaceKey))).not.toBe(hex(certificateImage(c.scope, c.certificate.vesselFaceKey)));
    expect(readCertificate(moved)).toEqual({ refusal: "signature-refused", door: "signature-mismatch" });
  });

  test("a certificate signed by one face refuses under another face's key", async () => {
    const c = await chain("cert-face", NEXUS_A);
    const other = await chain("cert-face-other", NEXUS_A);
    const moved = { ...c.certificate, scope: { ...c.scope, faceKey: other.scope.faceKey } };
    expect(moved.scope.faceKey).not.toBe(c.scope.faceKey);
    expect(refusalOf(readCertificate(moved))?.refusal).toBe("signature-refused");
  });

  test("a certificate over another vessel's key refuses", async () => {
    const c = await chain("cert-vessel", NEXUS_A);
    const other = await pair("cert-vessel other");
    const moved = { ...c.certificate, vesselFaceKey: other.key as VesselFaceKey };
    expect(refusalOf(readCertificate(moved))?.refusal).toBe("signature-refused");
  });

  test("a request never reads as a certificate, even where the face key signed the request's image", async () => {
    const c = await chain("cert-replay", NEXUS_A);
    const requestSignedByFace = await signHex(certificateRequestImage(c.scope, c.certificate.vesselFaceKey), c.face);
    expect(refusalOf(readCertificate({ ...c.certificate, signature: requestSignedByFace }))?.refusal).toBe("signature-refused");
    // And the certificate's own signature never reads as the vessel's request.
    expect(refusalOf(readCertificateRequest({ ...c.request, signature: c.certificate.signature }))?.refusal).toBe("signature-refused");
  });

  test("a tampered signature refuses, after the encoding moved", async () => {
    const c = await chain("cert-tamper", NEXUS_A);
    const signature = flipped(c.certificate.signature, 40);
    expect(signature).not.toBe(c.certificate.signature);
    expect(refusalOf(readCertificate({ ...c.certificate, signature }))?.refusal).toBe("signature-refused");
  });

  test("a certificate whose vessel key equals its face key refuses, however it was signed", async () => {
    const c = await chain("cert-self", NEXUS_A);
    const self = c.scope.faceKey as string as VesselFaceKey;
    const signature = await signHex(certificateImage(c.scope, self), c.face);
    expect(readCertificate({ scope: c.scope, vesselFaceKey: self, signature })).toEqual({ refusal: "keys-not-distinct" });
  });

  test("a key the caller holds apart refuses by name; the same certificate reads for a caller holding none", async () => {
    const c = await chain("cert-root", NEXUS_A);
    expect(readCertificate(c.certificate, [c.vessel.key])).toEqual({ refusal: "key-held-apart" });
    expect(readCertificateRequest(c.request, [c.vessel.key])).toEqual({ refusal: "key-held-apart" });
    expect(readCertificate(c.certificate, [c.face.key])).toEqual({ refusal: "key-held-apart" });
    expect(reads(readCertificate(c.certificate, [(await pair("unrelated")).key]))).toBe(true);
  });

  test("one extra field refuses the whole certificate", async () => {
    const c = await chain("cert-extra", NEXUS_A);
    for (const extra of ["vesselKey", "deviceKey", "personaGroup", "sessionId", "ownerEpoch"]) {
      expect(refusalOf(readCertificate({ ...c.certificate, [extra]: "x" }))?.refusal, extra).toBe("subject-malformed");
    }
  });

  test("a hidden field refuses too: a non-enumerable key and a symbol each count", async () => {
    const c = await chain("cert-hidden", NEXUS_A);
    const hidden = Object.defineProperty({ ...c.certificate }, "vesselRoot", { value: "x", enumerable: false });
    expect(Object.keys(hidden).length).toBe(3);                         // the setup took: the key hides from a plain listing
    expect(refusalOf(readCertificate(hidden))?.refusal).toBe("subject-malformed");
    expect(refusalOf(readCertificate({ ...c.certificate, [Symbol("vesselRoot")]: "x" }))?.refusal).toBe("subject-malformed");
  });

  test("a refusal reads as a refusal whatever a prototype holds", async () => {
    const c = await chain("cert-prototype", NEXUS_A);
    const tampered = { ...c.certificate, signature: flipped(c.certificate.signature, 40) };
    const pollute = Object.prototype as unknown as Record<string, unknown>;
    pollute["read"] = c.certificate;
    try {
      const reading = readCertificate(tampered);
      expect("read" in reading).toBe(true);                             // the setup took: `in` now lies
      expect(own(reading, "read")).toBe(false);
      expect(own(reading, "refusal") && reading.refusal).toBe("signature-refused");
    } finally { delete pollute["read"]; }
  });

  test("a value that throws while read holds no subject", () => {
    const hostile = new Proxy({}, { ownKeys() { throw new Error("hostile"); } });
    expect(readCertificate(hostile)).toEqual({ refusal: "subject-malformed" });
    expect(readSessionCertificate(hostile)).toEqual({ refusal: "subject-malformed" });
    expect(readWithdrawal(hostile)).toEqual({ refusal: "subject-malformed" });
  });
});

describe("the withdrawal event", () => {
  test("an event the face key signed reads; one the vessel signed refuses", async () => {
    const c = await chain("withdrawal", NEXUS_A);
    const genesis = genesisFrontier(c.scope).head;
    const lawful = await withdrawal(c.scope, 1, genesis, c.vessel.key, c.face);
    expect(readWithdrawal(lawful)).toEqual({ read: lawful });
    const byVessel = await withdrawal(c.scope, 1, genesis, c.vessel.key, c.vessel);
    expect(refusalOf(readWithdrawal(byVessel))?.refusal).toBe("signature-refused");
  });

  test("each signed field binds: a moved position, predecessor, digest or Nexus refuses", async () => {
    const c = await chain("withdrawal-bind", NEXUS_A);
    const genesis = genesisFrontier(c.scope).head;
    const event = await withdrawal(c.scope, 1, genesis, c.vessel.key, c.face);
    const moves = {
      position:  { ...event, position: 2 },
      previous:  { ...event, previous: flipped(event.previous) as Digest },
      withdrawn: { ...event, withdrawn: flipped(event.withdrawn) as Digest },
      nexus:     { ...event, scope: { ...c.scope, nexus: NEXUS_B as NexusAid } },
    };
    for (const [name, moved] of Object.entries(moves)) {
      expect(withdrawalHead(moved), name).not.toBe(withdrawalHead(event));          // the encoding moved
      expect(refusalOf(readWithdrawal(moved))?.refusal, name).toBe("signature-refused");
    }
  });

  test("position zero belongs to the genesis and to no event", async () => {
    const c = await chain("withdrawal-zero", NEXUS_A);
    const genesis = genesisFrontier(c.scope).head;
    const zero = await withdrawal(c.scope, 0, genesis, c.vessel.key, c.face);
    expect(readWithdrawal(zero)).toEqual({ refusal: "subject-malformed" });
    expect(reads(readFrontier({ position: 0, head: genesis }))).toBe(true);
    expect(refusalOf(readFrontier({ position: -1, head: genesis }))?.refusal).toBe("subject-malformed");
    expect(refusalOf(readFrontier({ position: 1.5, head: genesis }))?.refusal).toBe("subject-malformed");
  });

  test("a history's heads chain: each event names the head before it", async () => {
    const c = await chain("withdrawal-chain", NEXUS_A);
    const events = await history(c, [(await pair("gone-1")).key, (await pair("gone-2")).key]);
    expect(events[0]!.previous).toBe(genesisFrontier(c.scope).head);
    expect(events[1]!.previous).toBe(withdrawalHead(events[0]!));
    expect(withdrawalHead(events[1]!)).not.toBe(withdrawalHead(events[0]!));
  });

  test("a denial's digest binds its face and its Nexus", async () => {
    const a = await chain("digest", NEXUS_A);
    const b = await chain("digest", NEXUS_B);                         // the same face key at another Nexus
    const other = await chain("digest-other", NEXUS_A);               // another face at the same Nexus
    const key = a.certificate.vesselFaceKey;
    const digests = [withdrawnKeyDigest(a.scope, key), withdrawnKeyDigest(b.scope, key), withdrawnKeyDigest(other.scope, key)];
    expect(new Set(digests).size).toBe(3);
    expect(genesisFrontier(a.scope).head).not.toBe(genesisFrontier(b.scope).head);
    expect(faceProofSubjectRef(a.scope)).not.toBe(faceProofSubjectRef(b.scope));
    // CONTROL: one scope and one key give one digest.
    expect(withdrawnKeyDigest(a.scope, key)).toBe(withdrawnKeyDigest({ ...a.scope }, key));
  });
});

describe("the session certificate and what a session key signs", () => {
  test("a session certificate the vessel's face-scoped key signed reads", async () => {
    const c = await chain("session", NEXUS_A, "seat");
    expect(readSessionCertificate(c.sessionCertificate)).toEqual({ read: c.sessionCertificate });
  });

  test("the profile binds: a seat's certificate re-labelled as a face's refuses", async () => {
    const c = await chain("session-profile", NEXUS_A, "seat");
    const relabelled = { ...c.sessionCertificate, profile: "face" as const };
    expect(hex(sessionCertificateImage(c.scope, relabelled.vesselFaceKey, relabelled.sessionKey, "face")))
      .not.toBe(hex(sessionCertificateImage(c.scope, relabelled.vesselFaceKey, relabelled.sessionKey, "seat")));
    expect(refusalOf(readSessionCertificate(relabelled))?.refusal).toBe("signature-refused");
    expect(refusalOf(readSessionCertificate({ ...c.sessionCertificate, profile: "root" }))?.refusal).toBe("subject-malformed");
  });

  test("a session certificate replayed under another vessel key, face or Nexus refuses", async () => {
    const c = await chain("session-replay", NEXUS_A);
    const other = await chain("session-replay-other", NEXUS_A);
    const moves = {
      vessel: { ...c.sessionCertificate, vesselFaceKey: other.certificate.vesselFaceKey },
      face:   { ...c.sessionCertificate, scope: other.scope },
      nexus:  { ...c.sessionCertificate, scope: { ...c.scope, nexus: NEXUS_B as NexusAid } },
      key:    { ...c.sessionCertificate, sessionKey: other.sessionCertificate.sessionKey },
    };
    for (const [name, moved] of Object.entries(moves)) {
      expect(refusalOf(readSessionCertificate(moved))?.refusal, name).toBe("signature-refused");
    }
  });

  test("three links name three keys: a session key equal to its vessel's refuses", async () => {
    const c = await chain("session-distinct", NEXUS_A);
    const same = c.certificate.vesselFaceKey as string as SessionKey;
    const signature = await signHex(sessionCertificateImage(c.scope, c.certificate.vesselFaceKey, same, "face"), c.vessel);
    expect(readSessionCertificate({ ...c.sessionCertificate, sessionKey: same, signature })).toEqual({ refusal: "keys-not-distinct" });
    expect(readSessionCertificate(c.sessionCertificate, [c.session.key])).toEqual({ refusal: "key-held-apart" });
  });

  test("a finish never verifies as an act, and an act never as a finish", async () => {
    const c = await chain("purpose", NEXUS_A);
    const payload = utf8Bytes("one payload");
    const finish = await sessionSignature(c, "finish", payload);
    expect(readSessionSignature(c.sessionCertificate, "finish", payload, finish)).toEqual({ read: "finish" });
    expect(refusalOf(readSessionSignature(c.sessionCertificate, "act", payload, finish))?.refusal).toBe("signature-refused");
    expect(refusalOf(readSessionSignature(c.sessionCertificate, "authority", payload, finish))?.refusal).toBe("signature-refused");
    expect(refusalOf(readSessionSignature(c.sessionCertificate, "finish", utf8Bytes("another payload"), finish))?.refusal).toBe("signature-refused");
  });

  test("a seat's key signs no authority act, even where the key truly signed one", async () => {
    const seat = await chain("seat", NEXUS_A, "seat");
    const person = await chain("person", NEXUS_A, "face");
    const payload = utf8Bytes("an admit");
    const bySeat = await sessionSignature(seat, "authority", payload);
    expect(readSessionSignature(seat.sessionCertificate, "authority", payload, bySeat)).toEqual({ refusal: "purpose-beyond-profile" });
    // CONTROL: the same act under a person's profile reads, and the seat's own ordinary act reads.
    expect(readSessionSignature(person.sessionCertificate, "authority", payload, await sessionSignature(person, "authority", payload))).toEqual({ read: "authority" });
    expect(readSessionSignature(seat.sessionCertificate, "act", payload, await sessionSignature(seat, "act", payload))).toEqual({ read: "act" });
  });

  test("the profile table: every hand dials and acts; only a person's hands sign authority", () => {
    for (const profile of CAPABILITY_PROFILES) {
      expect(profileSigns(profile, "finish"), profile).toBe(true);
      expect(profileSigns(profile, "act"), profile).toBe(true);
    }
    expect(CAPABILITY_PROFILES.filter((profile) => profileSigns(profile, "authority"))).toEqual(["face", "verb"]);
    expect(Object.keys(PROFILE_SIGNING_PURPOSES).sort()).toEqual([...CAPABILITY_PROFILES].sort());
    expect(SESSION_SIGNING_PURPOSES).toEqual(["finish", "act", "authority"]);
  });

  test("an unknown purpose or a payload of another kind reads as no signature", async () => {
    const c = await chain("purpose-shape", NEXUS_A);
    const payload = utf8Bytes("p");
    const sig = await sessionSignature(c, "act", payload);
    expect(refusalOf(readSessionSignature(c.sessionCertificate, "root", payload, sig))?.refusal).toBe("subject-malformed");
    expect(refusalOf(readSessionSignature(c.sessionCertificate, "act", "p", sig))?.refusal).toBe("subject-malformed");
    expect(refusalOf(readSessionSignature(c.sessionCertificate, "act", payload, sig.slice(2)))?.refusal).toBe("subject-malformed");
  });
});

describe("two faces of one vessel share nothing", () => {
  test("no subject names a vessel, a PersonaGroup, a session id or an owner epoch", () => {
    const names = new Set(Object.values(FACE_PROOF_SUBJECT_FIELDS).flat() as string[]);
    for (const forbidden of ["vesselKey", "vesselRoot", "deviceKey", "device", "personaGroup", "personaRoot", "sessionId", "ownerEpoch", "peerId", "actorId", "handle"]) {
      expect(names.has(forbidden), forbidden).toBe(false);
    }
    // CONTROL: the census reads a real table.
    expect(names.has("vesselFaceKey")).toBe(true);
    expect(names.size).toBeGreaterThan(8);
  });

  test("every string and every signed byte of one face's chain stands apart from the other's", async () => {
    // One vessel wears two faces at ONE Nexus: each face's chain holds its own random keys.
    const one = await chain("vessel-v face-one", NEXUS_A);
    const two = await chain("vessel-v face-two", NEXUS_A);
    const everything = async (c: typeof one): Promise<Set<string>> => {
      const events = await history(c, [c.vessel.key]);
      const leaves = stringLeaves([c.request, c.certificate, c.sessionCertificate, events, genesisFrontier(c.scope), faceProofSubjectRef(c.scope)]);
      leaves.delete(c.scope.nexus);                                   // the Nexus both faces dial; no vessel's mark
      leaves.delete(c.sessionCertificate.profile);                    // one of four hands; no identifier
      return leaves;
    };
    const [mine, theirs] = [await everything(one), await everything(two)];
    expect(mine.size).toBeGreaterThan(8);
    expect([...mine].filter((leaf) => theirs.has(leaf))).toEqual([]);
    // CONTROL: two sessions of ONE face do share that face's key and its subject, as the law allows.
    const again = await everything(one);
    expect([...mine].filter((leaf) => again.has(leaf)).length).toBe(mine.size);
    expect(mine.has(one.scope.faceKey)).toBe(true);
  });
});
