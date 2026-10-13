/**
 * face-proof-fixture — synthetic keys and signed subjects for the face proof's suites.
 *
 * Every seed here reads as a fixed fill byte hashed under a label: synthetic, repeatable, and no key any
 * vessel holds. The helpers sign with the same primitive every producer in the house uses, and they build
 * subjects BY HAND from the image functions, so a suite can sign a wrong image on purpose.
 */
import * as ed25519 from "@noble/ed25519";
import { sha256 } from "@noble/hashes/sha2.js";
import { hex, utf8Bytes } from "../src/crypto.js";
import {
  certificateImage, certificateRequestImage, genesisFrontier, sessionCertificateImage, sessionSignatureImage,
  withdrawalHead, withdrawalImage, withdrawnKeyDigest,
  type Digest, type FaceKey, type FaceScope, type FaceWithdrawal, type NexusAid, type SessionCertificate,
  type SessionKey, type SessionSigningPurpose, type Signature, type VesselFaceCertificate,
  type VesselFaceCertificateRequest, type VesselFaceKey,
} from "../src/face-proof-subjects.js";
import type { CapabilityProfile } from "../src/session-contract.js";

export interface Pair { readonly secret: Uint8Array; readonly key: string }

/** A synthetic key pair named by a label. */
export async function pair(label: string): Promise<Pair> {
  const secret = sha256(utf8Bytes(`face-proof-fixture ${label}`));
  return { secret, key: hex(await ed25519.getPublicKeyAsync(secret)) };
}

export async function signHex(image: Uint8Array, by: Pair): Promise<Signature> {
  return hex(await ed25519.signAsync(image, by.secret)) as Signature;
}

/** One face at one Nexus, with a vessel and a session beneath it. */
export interface Chain {
  readonly face:    Pair;
  readonly vessel:  Pair;
  readonly session: Pair;
  readonly scope:   FaceScope;
  readonly request:            VesselFaceCertificateRequest;
  readonly certificate:        VesselFaceCertificate;
  readonly sessionCertificate: SessionCertificate;
}

export async function chain(label: string, nexus: string, profile: CapabilityProfile = "face"): Promise<Chain> {
  const face = await pair(`${label} face`);
  const vessel = await pair(`${label} vessel`);
  const session = await pair(`${label} session`);
  const scope: FaceScope = { faceKey: face.key as FaceKey, nexus: nexus as NexusAid };
  const vesselFaceKey = vessel.key as VesselFaceKey;
  const sessionKey = session.key as SessionKey;
  return {
    face, vessel, session, scope,
    request:     { scope, vesselFaceKey, signature: await signHex(certificateRequestImage(scope, vesselFaceKey), vessel) },
    certificate: { scope, vesselFaceKey, signature: await signHex(certificateImage(scope, vesselFaceKey), face) },
    sessionCertificate: {
      scope, vesselFaceKey, sessionKey, profile,
      signature: await signHex(sessionCertificateImage(scope, vesselFaceKey, sessionKey, profile), vessel),
    },
  };
}

/** A further vessel of one face: its own key and its certificate. */
export async function vesselOf(of: Chain, label: string): Promise<{ vessel: Pair; certificate: VesselFaceCertificate }> {
  const vessel = await pair(`${label} vessel`);
  const vesselFaceKey = vessel.key as VesselFaceKey;
  return { vessel, certificate: { scope: of.scope, vesselFaceKey, signature: await signHex(certificateImage(of.scope, vesselFaceKey), of.face) } };
}

/** One withdrawal event, signed by `by` (the face key, unless a suite signs it wrongly on purpose). */
export async function withdrawal(scope: FaceScope, position: number, previous: Digest, vesselFaceKey: string, by: Pair): Promise<FaceWithdrawal> {
  const withdrawn = withdrawnKeyDigest(scope, vesselFaceKey as VesselFaceKey);
  return { scope, position, previous, withdrawn, signature: await signHex(withdrawalImage(scope, position, previous, withdrawn), by) };
}

/** A history that withdraws `keys` in order, each event chained on the one before it. */
export async function history(of: Chain, keys: readonly string[]): Promise<FaceWithdrawal[]> {
  const events: FaceWithdrawal[] = [];
  let previous = genesisFrontier(of.scope).head;
  for (const [index, key] of keys.entries()) {
    const event = await withdrawal(of.scope, index + 1, previous, key, of.face);
    events.push(event);
    previous = withdrawalHead(event);
  }
  return events;
}

export async function sessionSignature(of: Chain, purpose: SessionSigningPurpose, payload: Uint8Array): Promise<Signature> {
  return signHex(sessionSignatureImage(purpose, of.scope, of.session.key as SessionKey, payload), of.session);
}

/** Every string a value holds, at any depth. */
export function stringLeaves(value: unknown, into: Set<string> = new Set()): Set<string> {
  if (typeof value === "string") into.add(value);
  else if (Array.isArray(value)) for (const item of value) stringLeaves(item, into);
  else if (value instanceof Uint8Array) into.add(hex(value));
  else if (typeof value === "object" && value !== null) for (const item of Object.values(value)) stringLeaves(item, into);
  return into;
}
