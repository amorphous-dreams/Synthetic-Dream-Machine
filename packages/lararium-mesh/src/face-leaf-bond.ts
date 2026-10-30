/**
 * face-leaf-bond — a face's leaf key at one realm's Nexus, bound to the face by a bond BOTH ends sign.
 *
 * A face presents a per-Nexus leaf key at a realm (its writer there, the name a voucher writes), minted at random and
 * derived from nothing, so no outside reader relates two of a face's leaves. The vessel meets the face through its atom.
 * The bond ties the two for one reader: the atom signs that this leaf stands for it at this Nexus for this realm, and
 * the leaf signs the same image, so neither half lifts alone (`api/pono/identity-enacts-relation` #/identity-as-bond).
 *
 * A reader binds a writer to a presenter only through a bond that verifies whole: the presenter's atom, the writer's
 * leaf, the realm the act names, and both signatures over the one image. A bond proves a past signing and never a present
 * hand, so a feed also carries the atom's signature over its own request (`realmFeedAskImage`). The bond and the ask
 * stay on the vessel's main thread and ride only its own placement to the island, never an answer or a synced document:
 * published, they would link the face's leaves across Nexuses through the atom.
 *
 * Platform-blind: rides ./crypto, ./domains and ./ed25519-door alone.
 */
import { canonicalJsonBytes } from "./crypto.js";
import { FACE_LEAF_BOND_DOMAIN, REALM_FEED_ASK_DOMAIN } from "./domains.js";
import { acceptEd25519Key, readEd25519 } from "./ed25519-door.js";

/** What a bond names: the face's atom, its leaf key, the Nexus the leaf presents at and the realm it feeds. */
export interface FaceLeafBondParts {
  readonly atom:     string;
  readonly leaf:     string;
  readonly nexusAid: string;
  readonly realm:    string;
}

/** A bond both ends signed: each signature a 64-byte Ed25519 signature over `faceLeafBondImage`, lowercase hex. */
export interface FaceLeafBond extends FaceLeafBondParts {
  readonly atomSig: string;
  readonly leafSig: string;
}

export type FaceLeafBondReason =
  | "bond-absent" | "bond-malformed" | "bond-not-presenter" | "bond-not-writer" | "bond-other-realm"
  | "bond-atom-unsigned" | "bond-leaf-unsigned";

export type FaceLeafBondReading = { readonly ok: true; readonly bond: FaceLeafBond } | { readonly ok: false; readonly reason: FaceLeafBondReason };

const bare = (key: string): string => key.trim().toLowerCase().replace(/^0x/, "");
const HEX64 = /^[0-9a-f]{64}$/;
const HEX128 = /^[0-9a-f]{128}$/;
const KEYS = ["atom", "atomSig", "leaf", "leafSig", "nexusAid", "realm"] as const;

/** The one image both ends sign: its own domain, the two keys, the Nexus and the realm. */
export function faceLeafBondImage(parts: FaceLeafBondParts): Uint8Array {
  return canonicalJsonBytes({
    domain: FACE_LEAF_BOND_DOMAIN,
    atom: bare(parts.atom), leaf: bare(parts.leaf), nexusAid: parts.nexusAid, realm: parts.realm.trim().toLowerCase(),
  });
}

/** Sign a bond as both ends: the caller hands each end's signer, so no seed passes through here. */
export async function signFaceLeafBond(
  parts: FaceLeafBondParts,
  sign: { readonly atom: (bytes: Uint8Array) => Promise<string>; readonly leaf: (bytes: Uint8Array) => Promise<string> },
): Promise<FaceLeafBond> {
  const named: FaceLeafBondParts = { atom: bare(parts.atom), leaf: bare(parts.leaf), nexusAid: parts.nexusAid, realm: parts.realm.trim().toLowerCase() };
  const image = faceLeafBondImage(named);
  return Object.freeze({ ...named, atomSig: (await sign.atom(image)).toLowerCase(), leafSig: (await sign.leaf(image)).toLowerCase() });
}

/**
 * Read a bond for one act: the presenter's atom (bare or `0x`), the writer the act names and the realm it feeds. Every
 * field must stand, exactly these and no others; a mismatch refuses by name, and each signature verifies through the
 * house's one Ed25519 door. Never throws.
 */
export function readFaceLeafBond(value: unknown, expect: { readonly presenter: string; readonly writer: string; readonly realm: string }): FaceLeafBondReading {
  if (value === undefined) return { ok: false, reason: "bond-absent" };
  if (value === null || typeof value !== "object" || Array.isArray(value)) return { ok: false, reason: "bond-malformed" };
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  if (keys.length !== KEYS.length || keys.some((k, i) => k !== KEYS[i])) return { ok: false, reason: "bond-malformed" };
  const { atom, leaf, nexusAid, realm, atomSig, leafSig } = record;
  if (typeof atom !== "string" || typeof leaf !== "string" || typeof nexusAid !== "string" || typeof realm !== "string" ||
      typeof atomSig !== "string" || typeof leafSig !== "string" ||
      !HEX64.test(atom) || !HEX64.test(leaf) || !HEX64.test(realm) || nexusAid.length === 0 ||
      !HEX128.test(atomSig) || !HEX128.test(leafSig) ||
      !acceptEd25519Key(atom).ok || !acceptEd25519Key(leaf).ok) {
    return { ok: false, reason: "bond-malformed" };
  }
  if (atom !== bare(expect.presenter)) return { ok: false, reason: "bond-not-presenter" };
  if (leaf !== bare(expect.writer)) return { ok: false, reason: "bond-not-writer" };
  if (realm !== expect.realm.trim().toLowerCase()) return { ok: false, reason: "bond-other-realm" };
  const image = faceLeafBondImage({ atom, leaf, nexusAid, realm });
  if (!readEd25519(atomSig, image, atom).ok) return { ok: false, reason: "bond-atom-unsigned" };
  if (!readEd25519(leafSig, image, leaf).ok) return { ok: false, reason: "bond-leaf-unsigned" };
  return { ok: true, bond: { atom, leaf, nexusAid, realm, atomSig, leafSig } };
}

/** The image a face's atom signs to feed one realm as its leaf, under the one request id the feed rides. */
export function realmFeedAskImage(parts: { readonly requestId: string; readonly realm: string; readonly writer: string }): Uint8Array {
  return canonicalJsonBytes({ domain: REALM_FEED_ASK_DOMAIN, requestId: parts.requestId, realm: parts.realm.trim().toLowerCase(), writer: bare(parts.writer) });
}

/** Does `askSig` stand as the bond's atom asking this very request? Never throws. */
export function readRealmFeedAsk(askSig: unknown, bond: FaceLeafBond, requestId: string): boolean {
  return typeof askSig === "string" && HEX128.test(askSig) && requestId.length > 0 &&
    readEd25519(askSig, realmFeedAskImage({ requestId, realm: bond.realm, writer: bond.leaf }), bond.atom).ok;
}
