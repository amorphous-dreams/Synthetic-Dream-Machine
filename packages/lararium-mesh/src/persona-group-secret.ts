/**
 * persona-group-secret — the secret a PersonaGroup's devices hold in common, delivered AT ENROLMENT and rolled
 * with the op-key.
 *
 * WHAT IT GUARDS. Siblings meet through a herm that reads nothing, and the first move of their proof hands a
 * sealed box to whatever ephemeral key a hello names. Without a secret only members hold, a forged hello — from
 * the herm, or from anyone holding the group's id — would open that box and read the edge inside. The secret
 * closes that: it keys the hello's hint, it is mixed into every proof seal, and it keys the channel tag a leaf
 * joins on a herm. A non-member forges no hint, opens no box and finds no channel.
 *
 * DERIVED, NEVER STORED, NEVER OFF THE KEL. The secret derives from the persona root's OWN seed, salted by the
 * group's KEL prefix (`personaGroupSecret`), so the root holder reads it again whenever it signs and keeps no copy.
 * The KEL rides public boards, so nothing derives from it.
 *
 * DELIVERY BESIDE THE EDGE. When the root signs a DeviceDelegation it seals the secret to that device key
 * (`enrolDevice`): an X25519 box to the device's own key, signed by the root over the box, the device and the
 * group. The device opens it with its own seed and nothing else; a box the root did not sign opens to nothing.
 *
 * ROLLED WITH THE OP-KEY, SEALED AND ATTESTED ON THE KEL. A rotation seats a fresh op-key, and the fresh seed derives
 * the next secret. The rotation carries one SEALED ENROLMENT per REMAINING device (`rollEnrolments`): a box sealed
 * to that device's key holding its re-delegated edge and the next secret, signed by the fresh op-key and naming no
 * device. The KEL rides public boards, so no edge rides it in the clear: a board reader counts boxes and reads none,
 * and each device finds its own by trial-open. The event's content address commits the digest of the whole list,
 * and the guardians' quorum signs that address's bytes, so a board writer who strips, adds or swaps a box breaks
 * the chain's walk instead of revoking or framing a device. A revoking rotation leaves the revoked device out: no
 * box opens for it, and it holds no secret past it.
 *
 * A DEVICE'S STANDING UNDER A KEL (`leafStandingUnder`): every secret its enrolments deliver, oldest first, and the
 * newest edge the KEL re-delegated to it. A leaf keeps the older secrets so a stale sibling still meets it, and
 * hands that sibling the KEL suffix it lacks (`leaf-peer-proof`'s catch-up).
 *
 * NO CLOCK: the secret's epoch is the op-key that derived it, read by KEL event order.
 *
 * Meme: lar:///ha.ka.ba/lares/docs/pono/identity-slot-policy#/the-leaf-taxonomy
 */

import { ed25519 as edCurve } from "@noble/curves/ed25519.js";
import * as ed from "@noble/ed25519";
import { hkdf } from "@noble/hashes/hkdf.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { canonicalJsonBytes, hex, hexToBytes, utf8Bytes } from "./crypto.js";
import {
  GROUP_SECRET_ENROLMENT_DOMAIN, GROUP_SECRET_SEAL_INFO, PERSONA_GROUP_SECRET_INFO, SEALED_ENROLMENT_INFO,
} from "./domains.js";
import { ed25519VerifyHex } from "./auth-wire.js";
import { sealToRecipient, openFromSender } from "./sealed-box.js";
import { didFromVerifyingKey, verifyingKeyFromDid } from "./lar-did.js";
import { buildDeviceDelegation, verifyDeviceDelegation, type DeviceDelegationTiddler } from "./device-delegation.js";
import {
  enrolmentsAttested, sealedEnrolmentBytes, verifySealedEnrolment, type PersonaKelEvent, type SealedEnrolment,
} from "./persona-kel.js";
import { PERSONA_NAMESPACE } from "./lar-uris.js";

const KEY_RE = /^[0-9a-f]{64}$/;
const SIG_RE = /^[0-9a-f]{128}$/;
const HEX_RE = /^[0-9a-f]+$/;
const SEAL_INFO = utf8Bytes(GROUP_SECRET_SEAL_INFO);
const ENROLMENT_INFO = utf8Bytes(SEALED_ENROLMENT_INFO);

/** The secret one op-key's epoch carries, as a device holds it. */
export interface GroupSecret {
  /** The op-key whose seed derived it — its epoch, read by KEL event order. */
  readonly opKeyDid: string;
  readonly secret:   Uint8Array;
}

/** The secret sealed to ONE device, signed by the op-key that derived it. Opaque to every hand but that device's. */
export interface GroupSecretSeal {
  readonly kind:      "group-secret-seal";
  /** The PersonaGroup's KEL prefix — the group this secret belongs to. */
  readonly prefix:    string;
  /** The op-key that derived the secret and signed this seal. */
  readonly opKeyDid:  string;
  /** The device key the box opens for. */
  readonly deviceKey: string;
  /** The box, hex: the sender's ephemeral X25519 key, the AEAD nonce, the ciphertext. */
  readonly e: string;
  readonly n: string;
  readonly c: string;
  /** The op-key's signature over the seal (`groupSecretSealBytes`). */
  readonly sig: string;
}

/** One device's enrolment: the edge the root signed for it, and the secret sealed beside it. */
export interface PersonaGroupEnrolment {
  readonly edge: DeviceDelegationTiddler;
  readonly seal: GroupSecretSeal;
}

/** The secret one op-key derives for its PersonaGroup: HKDF over the op-key's seed, salted by the KEL prefix. */
export function personaGroupSecret(opSeed: Uint8Array, prefix: string): Uint8Array {
  return hkdf(sha256, opSeed, utf8Bytes(prefix), utf8Bytes(PERSONA_GROUP_SECRET_INFO), 32);
}

/** The bytes the op-key signs over one seal: the group, the op-key, the device and the whole box. */
export function groupSecretSealBytes(seal: Omit<GroupSecretSeal, "sig" | "kind">): Uint8Array {
  return canonicalJsonBytes({
    domain:    GROUP_SECRET_ENROLMENT_DOMAIN,
    prefix:    seal.prefix,
    opKeyDid:  seal.opKeyDid.toLowerCase(),
    deviceKey: seal.deviceKey.toLowerCase(),
    e: seal.e, n: seal.n, c: seal.c,
  });
}

/** The salt both the seal and its opening bind: the group and the device, so a box re-addressed opens nowhere. */
function sealSalt(prefix: string, deviceKey: string): Uint8Array[] {
  return [utf8Bytes(prefix), hexToBytes(deviceKey.toLowerCase())];
}

/**
 * Seal the op-key's secret to one device key and sign the seal. THROWS on a malformed device key — a root must
 * never believe it delivered a secret to nobody.
 */
export async function sealGroupSecret(args: {
  readonly opSeed:             Uint8Array;
  readonly prefix:             string;
  readonly deviceVerifyingKey: string;
}): Promise<GroupSecretSeal> {
  const deviceKey = args.deviceVerifyingKey.toLowerCase();
  if (!KEY_RE.test(deviceKey)) throw new Error("[persona-group-secret] cannot seal: the device key is not 32-byte hex");
  if (args.prefix.length === 0) throw new Error("[persona-group-secret] cannot seal: no KEL prefix names the group");
  const box = sealToRecipient({
    recipientPub: edCurve.utils.toMontgomery(hexToBytes(deviceKey)),
    plaintext:    personaGroupSecret(args.opSeed, args.prefix),
    info:         SEAL_INFO,
    extraSalt:    sealSalt(args.prefix, deviceKey),
  });
  const unsigned = {
    prefix:    args.prefix,
    opKeyDid:  didFromVerifyingKey(hex(await ed.getPublicKeyAsync(args.opSeed))),
    deviceKey,
    e: hex(box.senderEphemeralPub), n: hex(box.aeadNonce), c: hex(box.ciphertext),
  };
  const sig = hex(await ed.signAsync(groupSecretSealBytes(unsigned), args.opSeed));
  return { kind: "group-secret-seal", ...unsigned, sig };
}

/**
 * Enrol one device: the root signs its DeviceDelegation edge and seals the PersonaGroup secret to the same device
 * key, in one act. The ONE enrolment every mint path runs — founding, device admit and rotation.
 */
export async function enrolDevice(args: {
  readonly opSeed:             Uint8Array;
  readonly prefix:             string;
  readonly deviceVerifyingKey: string;
  readonly hearthTrueName:     string;
  readonly boundEpoch:         number;
}): Promise<PersonaGroupEnrolment> {
  const edge = await buildDeviceDelegation({
    personaRootSeed: args.opSeed, deviceVerifyingKey: args.deviceVerifyingKey,
    hearthTrueName: args.hearthTrueName, boundEpoch: args.boundEpoch,
  });
  return { edge, seal: await sealGroupSecret(args) };
}

/** Read an untrusted seal: its fields well-formed and its signature the named op-key's. Null on any failure. */
export async function verifyGroupSecretSeal(raw: unknown): Promise<GroupSecretSeal | null> {
  if (typeof raw !== "object" || raw === null) return null;
  const s = raw as Partial<Record<keyof GroupSecretSeal, unknown>>;
  if (s.kind !== "group-secret-seal") return null;
  if (typeof s.prefix !== "string" || s.prefix.length === 0) return null;
  if (typeof s.opKeyDid !== "string" || !KEY_RE.test(verifyingKeyFromDid(s.opKeyDid))) return null;
  if (typeof s.deviceKey !== "string" || !KEY_RE.test(s.deviceKey)) return null;
  if (typeof s.e !== "string" || !KEY_RE.test(s.e)) return null;
  if (typeof s.n !== "string" || !HEX_RE.test(s.n) || typeof s.c !== "string" || !HEX_RE.test(s.c)) return null;
  if (typeof s.sig !== "string" || !SIG_RE.test(s.sig)) return null;
  const seal = s as GroupSecretSeal;
  const ok = await ed25519VerifyHex(seal.sig, groupSecretSealBytes(seal), verifyingKeyFromDid(seal.opKeyDid));
  return ok ? seal : null;
}

/**
 * This device's own custody, carried as an object: it opens what a root sealed to THIS device key and nothing
 * else, and hands back only what the box held. The seed stays in the closure that builds it.
 */
export interface GroupSecretOpener {
  /** The device key this opener stands for. */
  readonly deviceKey: string;
  /** Open a delivery seal addressed to this device: the 32-byte secret, or null. */
  seal(seal: GroupSecretSeal): Uint8Array | null;
  /** Trial-open a KEL event's sealed enrolment: its plaintext when the box addresses this device, else null. */
  enrolment(sealed: SealedEnrolment, at: { readonly prefix: string; readonly opKeyDid: string }): Uint8Array | null;
}

/** The opener a device's own seed stands. */
export function groupSecretOpenerFromSeed(deviceSeed: Uint8Array): GroupSecretOpener {
  const recipientSecret = edCurve.utils.toMontgomerySecret(deviceSeed);
  const deviceKey = hex(edCurve.getPublicKey(deviceSeed));
  const openBox = (box: { e: string; n: string; c: string }, info: Uint8Array, extraSalt: Uint8Array[]): Uint8Array | null => {
    if (!KEY_RE.test(box.e) || !HEX_RE.test(box.n) || !HEX_RE.test(box.c)) return null;
    return openFromSender({
      recipientSecret, senderEphemeralPub: hexToBytes(box.e), aeadNonce: hexToBytes(box.n),
      ciphertext: hexToBytes(box.c), info, extraSalt,
    });
  };
  return {
    deviceKey,
    seal: (seal) => {
      if (seal.deviceKey.toLowerCase() !== deviceKey) return null;
      const opened = openBox(seal, SEAL_INFO, sealSalt(seal.prefix, deviceKey));
      return opened && opened.length === 32 ? opened : null;
    },
    enrolment: (sealed, at) => openBox(sealed, ENROLMENT_INFO, enrolmentSalt(at.prefix, at.opKeyDid, deviceKey)),
  };
}

/** The salt a sealed enrolment's box binds: the group, the op-key that sealed it and the device it addresses. */
function enrolmentSalt(prefix: string, opKeyDid: string, deviceKey: string): Uint8Array[] {
  return [utf8Bytes(prefix), utf8Bytes(opKeyDid.toLowerCase()), hexToBytes(deviceKey.toLowerCase())];
}

/**
 * Seal the enrolments a ROTATION carries: for each device that REMAINS, the fresh op-key signs its edge and seals
 * that edge with the next secret to the device's own key. A device absent from `devices` is revoked by the
 * rotation: no box opens for it. The list rides INTO the rotation (`mintPersonaRotation`), whose content address
 * commits its digest and whose quorum attests it, so the rotation and its enrolments are one act. THROWS on a
 * malformed device key.
 */
export async function rollEnrolments(args: {
  readonly prefix: string;
  readonly opSeed: Uint8Array;
  readonly devices: ReadonlyArray<{ readonly deviceVerifyingKey: string; readonly hearthTrueName: string; readonly boundEpoch: number }>;
}): Promise<SealedEnrolment[]> {
  if (args.prefix.length === 0) throw new Error("[persona-group-secret] cannot enrol: no KEL prefix names the group");
  const opKeyDid = didFromVerifyingKey(hex(await ed.getPublicKeyAsync(args.opSeed)));
  const secret = hex(personaGroupSecret(args.opSeed, args.prefix));
  const sealed: SealedEnrolment[] = [];
  for (const d of args.devices) {
    const deviceKey = d.deviceVerifyingKey.toLowerCase();
    if (!KEY_RE.test(deviceKey)) throw new Error("[persona-group-secret] cannot enrol: the device key is not 32-byte hex");
    const edge = await buildDeviceDelegation({
      personaRootSeed: args.opSeed, deviceVerifyingKey: deviceKey, hearthTrueName: d.hearthTrueName, boundEpoch: d.boundEpoch,
    });
    const box = sealToRecipient({
      recipientPub: edCurve.utils.toMontgomery(hexToBytes(deviceKey)),
      plaintext:    canonicalJsonBytes({ edge, secret }),
      info:         ENROLMENT_INFO,
      extraSalt:    enrolmentSalt(args.prefix, opKeyDid, deviceKey),
    });
    const unsigned = { e: hex(box.senderEphemeralPub), n: hex(box.aeadNonce), c: hex(box.ciphertext) };
    const sig = hex(await ed.signAsync(sealedEnrolmentBytes(args.prefix, opKeyDid, unsigned), args.opSeed));
    sealed.push({ kind: "sealed-enrolment", ...unsigned, sig });
  }
  return sealed;
}

/** The index of the LAST event that seats `opKeyDid` in the chain, or -1. */
function seatOf(kel: readonly PersonaKelEvent[], opKeyDid: string): number {
  const did = opKeyDid.toLowerCase();
  for (let i = kel.length - 1; i >= 0; i--) if (kel[i]!.opKeyDid.toLowerCase() === did) return i;
  return -1;
}

/** What one KEL event's enrolments deliver to this device, read and verified, or null when none addresses it. */
interface OpenedEnrolment { readonly at: number; readonly edge: DeviceDelegationTiddler; readonly secret: GroupSecret }

/**
 * Every enrolment the KEL's events carry FOR this device, oldest first. An event counts only when its enrolment
 * list matches the digest its content address commits; a box counts only when the event's op-key signed it, it
 * opens for this device, and the edge inside names this device and verifies under that same op-key.
 */
async function openedEnrolments(kel: readonly PersonaKelEvent[], open: GroupSecretOpener): Promise<OpenedEnrolment[]> {
  const key = open.deviceKey.toLowerCase();
  const out: OpenedEnrolment[] = [];
  for (let at = 0; at < kel.length; at++) {
    const event = kel[at]!;
    const list = event.enrolments ?? [];
    if (list.length === 0 || !enrolmentsAttested(event)) continue;
    for (const sealed of list) {
      if (!(await verifySealedEnrolment(sealed, event.prefix, event.opKeyDid))) continue;
      const plaintext = open.enrolment(sealed, { prefix: event.prefix, opKeyDid: event.opKeyDid });
      if (!plaintext) continue;
      let body: { edge?: DeviceDelegationTiddler; secret?: unknown };
      try { body = JSON.parse(new TextDecoder().decode(plaintext)) as typeof body; } catch { continue; }
      const edge = body.edge;
      if (!edge || edge.deviceVerifyingKey?.toLowerCase() !== key) continue;
      if (typeof body.secret !== "string" || !KEY_RE.test(body.secret)) continue;
      if (!(await verifyDeviceDelegation(edge, event.opKeyDid)).ok) continue;
      out.push({ at, edge, secret: { opKeyDid: event.opKeyDid.toLowerCase(), secret: hexToBytes(body.secret) } });
      break;
    }
  }
  return out;
}

/**
 * The newest edge the KEL re-delegated to THIS device (the opener's), its signature verified under the op-key of
 * the event that carried it, or null. Only the device reads it: every other hand finds sealed boxes.
 */
export async function enrolledEdgeOf(kel: readonly PersonaKelEvent[], open: GroupSecretOpener): Promise<DeviceDelegationTiddler | null> {
  const opened = await openedEnrolments(kel, open);
  return opened.at(-1)?.edge ?? null;
}

/** What a device stands on under a KEL: every secret its enrolments deliver (oldest first) and its newest edge. */
export interface LeafStanding {
  readonly secrets: readonly GroupSecret[];
  readonly edge:    DeviceDelegationTiddler;
}

/**
 * Read a device's standing under the KEL it carries: the enrolment it was handed (its edge and seal), plus every
 * sealed enrolment the KEL's rotations carry for its key. The handed seal counts only when the op-key it names sits
 * in the chain, signed it, and its box opens for this device; the secrets order by where their op-key sits. The
 * edge is the newest the chain re-delegated to this device, else the one it was handed.
 */
export async function leafStandingUnder(args: {
  readonly kel:       readonly PersonaKelEvent[];
  readonly deviceKey: string;
  /** The enrolment this device was handed at founding or admit. */
  readonly enrolment: PersonaGroupEnrolment;
  readonly open:      GroupSecretOpener;
}): Promise<LeafStanding> {
  const key = args.deviceKey.toLowerCase();
  if (args.open.deviceKey.toLowerCase() !== key) throw new Error("[persona-group-secret] the opener stands for another device key");
  const prefix = args.kel[0]?.prefix;
  const held = new Map<string, { at: number; secret: Uint8Array }>();
  const handed = await verifyGroupSecretSeal(args.enrolment.seal);
  if (handed && handed.deviceKey === key && handed.prefix === prefix) {
    const at = seatOf(args.kel, handed.opKeyDid);
    const secret = at >= 0 ? args.open.seal(handed) : null;
    if (secret) held.set(handed.opKeyDid.toLowerCase(), { at, secret });
  }
  const opened = await openedEnrolments(args.kel, args.open);
  for (const o of opened) held.set(o.secret.opKeyDid, { at: o.at, secret: o.secret.secret });
  const secrets = [...held.entries()].sort((a, b) => a[1].at - b[1].at).map(([opKeyDid, h]) => ({ opKeyDid, secret: h.secret }));
  return { secrets, edge: opened.at(-1)?.edge ?? args.enrolment.edge };
}

/** The daemon-doc title a device's enrolment seal for one PersonaGroup rests under — sovereign, never crossing. */
export function groupSecretSealTitle(personaGroupDocIdHex: string): string {
  return `${PERSONA_NAMESPACE}/group-secret/${personaGroupDocIdHex.toLowerCase()}`;
}
