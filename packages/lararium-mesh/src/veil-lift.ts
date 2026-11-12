/**
 * veil-lift — THE PRIVATE LINK FROM A VEIL TO A FACE IT JOINED (the-veil-ladder#/the-base-model, in-house ruling 1).
 *
 * A join mints a fresh atom for the face: no device-wide key signs a face's proof, and the face's records name the atom
 * alone. The continuity a person may one day want to show ("this veil lifted into this face") rests in ONE record the
 * vessel's own key signs: the veil's key, the face's PersonaGroup and the atom the join minted. It rests only in that
 * face's private custody, never on a board, a plane another device reads or a floor document, and it names no other
 * face: two faces of one human hold two records that share the veil's key and nothing else, and neither leaves its face.
 *
 * The record proves the link to whoever its holder hands it to. It grants nothing: no gate, cap or proof reads it.
 */
import { canonicalJsonBytes, utf8Bytes } from "./crypto.js";
import { ed25519SignerFromSeed, ed25519VerifyHex, ed25519VerifyingKeyFromSeed } from "./ed25519-door.js";

/** The signed image's domain: a veil-lift signature reads as nothing else the vessel's key ever signs. */
export const VEIL_LIFT_DOMAIN = "lararium/veil-lift";

export interface VeilLiftRecord {
  readonly kind: "veil-lift";
  /** The vessel's own verifying key (64 lowercase hex): the veil that lifted. */
  readonly veil: string;
  /** The PersonaGroup the veil joined. */
  readonly face: string;
  /** The fresh atom the join minted for that face on this device (its verifying key, 64 lowercase hex). */
  readonly atom: string;
  /** The veil key's signature over the domain and the three fields. */
  readonly signature: string;
}

const KEY = /^[0-9a-f]{64}$/;
const imageOf = (veil: string, face: string, atom: string): Uint8Array => {
  const body = canonicalJsonBytes({ kind: "veil-lift", veil, face, atom });
  const domain = utf8Bytes(`${VEIL_LIFT_DOMAIN}\n`);
  const image = new Uint8Array(domain.length + body.length);
  image.set(domain, 0); image.set(body, domain.length);
  return image;
};

/** Sign the link under the vessel's own seed. The seed stays the caller's to zero. */
export async function signVeilLift(args: { readonly veilSeed: Uint8Array; readonly face: string; readonly atom: string }): Promise<VeilLiftRecord> {
  if (args.face.length === 0) throw new Error("veil-lift: the record names a face");
  if (!KEY.test(args.atom)) throw new Error("veil-lift: the atom reads as no verifying key");
  const veil = await ed25519VerifyingKeyFromSeed(args.veilSeed);
  const signature = await ed25519SignerFromSeed(args.veilSeed)(imageOf(veil, args.face, args.atom));
  return { kind: "veil-lift", veil, face: args.face, atom: args.atom, signature };
}

/** Read a link: its shape, exactly its five fields, and the veil key's signature over them. Null where any fails. */
export async function verifyVeilLift(raw: unknown): Promise<VeilLiftRecord | null> {
  const r = raw as Partial<VeilLiftRecord> | null;
  if (!r || typeof r !== "object" || r.kind !== "veil-lift") return null;
  if (Object.keys(r).sort().join(",") !== "atom,face,kind,signature,veil") return null;
  if (typeof r.veil !== "string" || !KEY.test(r.veil) || typeof r.atom !== "string" || !KEY.test(r.atom)) return null;
  if (typeof r.face !== "string" || r.face.length === 0 || typeof r.signature !== "string") return null;
  let holds = false;
  try { holds = await ed25519VerifyHex(r.signature, imageOf(r.veil, r.face, r.atom), r.veil); } catch { holds = false; }
  return holds ? { kind: "veil-lift", veil: r.veil, face: r.face, atom: r.atom, signature: r.signature } : null;
}
