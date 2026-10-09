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
 * ROLLED WITH THE OP-KEY. A rotation seats a fresh op-key, and the fresh seed derives the next secret. The rotation
 * carries one enrolment per REMAINING device — its re-delegated edge and its sealed secret — inside the KEL event
 * (`rollEnrolments`), outside the event's content address, the way its quorum signatures ride. A revoking rotation
 * leaves the revoked device out, so that device finds no seal addressed to it and holds no secret past it.
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
import { GROUP_SECRET_ENROLMENT_DOMAIN, GROUP_SECRET_SEAL_INFO, PERSONA_GROUP_SECRET_INFO } from "./domains.js";
import { ed25519VerifyHex } from "./auth-wire.js";
import { sealToRecipient, openFromSender } from "./sealed-box.js";
import { didFromVerifyingKey, verifyingKeyFromDid } from "./lar-did.js";
import { buildDeviceDelegation, type DeviceDelegationTiddler } from "./device-delegation.js";
import type { PersonaKelEvent } from "./persona-kel.js";
import { PERSONA_NAMESPACE } from "./lar-uris.js";

const KEY_RE = /^[0-9a-f]{64}$/;
const SIG_RE = /^[0-9a-f]{128}$/;
const HEX_RE = /^[0-9a-f]+$/;
const SEAL_INFO = utf8Bytes(GROUP_SECRET_SEAL_INFO);

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

/** Open a seal addressed to this device — the device's own custody, carried as a function. Null on any failure. */
export type GroupSecretOpener = (seal: GroupSecretSeal) => Uint8Array | null;

/** The opener a device's own seed stands. The seed stays in the closure; the opener hands back only the secret. */
export function groupSecretOpenerFromSeed(deviceSeed: Uint8Array): GroupSecretOpener {
  const recipientSecret = edCurve.utils.toMontgomerySecret(deviceSeed);
  return (seal) => {
    const opened = openFromSender({
      recipientSecret, senderEphemeralPub: hexToBytes(seal.e), aeadNonce: hexToBytes(seal.n),
      ciphertext: hexToBytes(seal.c), info: SEAL_INFO, extraSalt: sealSalt(seal.prefix, seal.deviceKey),
    });
    return opened && opened.length === 32 ? opened : null;
  };
}

/**
 * Re-enrol the devices that REMAIN on a rotation: the event's fresh op-key signs each one's edge and seals the
 * next secret to it, and the enrolments ride the event outside its content address. A device absent from
 * `devices` is revoked by this rotation: it finds no seal addressed to it. THROWS when the seed does not seat
 * the event's op-key.
 */
export async function rollEnrolments(args: {
  readonly event:  PersonaKelEvent;
  readonly opSeed: Uint8Array;
  readonly devices: ReadonlyArray<{ readonly deviceVerifyingKey: string; readonly hearthTrueName: string; readonly boundEpoch: number }>;
}): Promise<PersonaKelEvent> {
  const opKeyDid = didFromVerifyingKey(hex(await ed.getPublicKeyAsync(args.opSeed)));
  if (opKeyDid !== args.event.opKeyDid.toLowerCase()) {
    throw new Error("[persona-group-secret] the seed does not seat this event's op-key — only that key re-enrols");
  }
  const enrolments: PersonaGroupEnrolment[] = [];
  for (const d of args.devices) {
    enrolments.push(await enrolDevice({ opSeed: args.opSeed, prefix: args.event.prefix, ...d }));
  }
  return { ...args.event, enrolments };
}

/** The index of the LAST event that seats `opKeyDid` in the chain, or -1. */
function seatOf(kel: readonly PersonaKelEvent[], opKeyDid: string): number {
  const did = opKeyDid.toLowerCase();
  for (let i = kel.length - 1; i >= 0; i--) if (kel[i]!.opKeyDid.toLowerCase() === did) return i;
  return -1;
}

/** The newest edge the KEL re-delegated to `deviceKey` under the op-key of the event that carried it, or null. */
export function enrolledEdgeOf(kel: readonly PersonaKelEvent[], deviceKey: string): DeviceDelegationTiddler | null {
  const key = deviceKey.toLowerCase();
  for (let i = kel.length - 1; i >= 0; i--) {
    const event = kel[i]!;
    for (const enrolment of event.enrolments ?? []) {
      const edge = enrolment?.edge;
      if (edge?.deviceVerifyingKey?.toLowerCase() === key && edge.personaRootDid?.toLowerCase() === event.opKeyDid.toLowerCase()) return edge;
    }
  }
  return null;
}

/** What a device stands on under a KEL: every secret its enrolments deliver (oldest first) and its newest edge. */
export interface LeafStanding {
  readonly secrets: readonly GroupSecret[];
  readonly edge:    DeviceDelegationTiddler;
}

/**
 * Read a device's standing under the KEL it carries: the enrolment it was handed (its edge and seal), plus every
 * enrolment the KEL's rotations carry for its key. A seal counts only when the op-key it names sits in the chain,
 * signed it, and the box opens for this device; the secrets order by where their op-key sits. The edge is the
 * newest the chain re-delegated to this device, else the one it was handed.
 */
export async function leafStandingUnder(args: {
  readonly kel:       readonly PersonaKelEvent[];
  readonly deviceKey: string;
  /** The enrolment this device was handed at founding or admit. */
  readonly enrolment: PersonaGroupEnrolment;
  readonly open:      GroupSecretOpener;
}): Promise<LeafStanding> {
  const key = args.deviceKey.toLowerCase();
  const prefix = args.kel[0]?.prefix;
  const seals: unknown[] = [args.enrolment.seal];
  for (const event of args.kel) for (const e of event.enrolments ?? []) seals.push(e?.seal);
  const held = new Map<string, { at: number; secret: Uint8Array }>();
  for (const raw of seals) {
    const seal = await verifyGroupSecretSeal(raw);
    if (!seal || seal.deviceKey !== key || seal.prefix !== prefix) continue;
    const at = seatOf(args.kel, seal.opKeyDid);
    if (at < 0) continue;
    const secret = args.open(seal);
    if (!secret) continue;
    held.set(seal.opKeyDid.toLowerCase(), { at, secret });
  }
  const secrets = [...held.entries()].sort((a, b) => a[1].at - b[1].at).map(([opKeyDid, h]) => ({ opKeyDid, secret: h.secret }));
  return { secrets, edge: enrolledEdgeOf(args.kel, key) ?? args.enrolment.edge };
}

/** The daemon-doc title a device's enrolment seal for one PersonaGroup rests under — sovereign, never crossing. */
export function groupSecretSealTitle(personaGroupDocIdHex: string): string {
  return `${PERSONA_NAMESPACE}/group-secret/${personaGroupDocIdHex.toLowerCase()}`;
}
