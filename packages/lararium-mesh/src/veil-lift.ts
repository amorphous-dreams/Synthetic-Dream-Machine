/**
 * veil-lift — THE PRIVATE LINK FROM A VEIL TO A FACE IT JOINED (the-veil-ladder#/the-base-model, in-house ruling 1).
 *
 * A join mints a fresh atom for the face: no device-wide key signs a face's proof, and the face's records name the atom
 * alone. The continuity a person may one day want to show ("this veil lifted into this face") rests in ONE record the
 * face's ATOM signs: the veil's key, the face's PersonaGroup and the atom the join minted. It rests only in that
 * face's private custody, never on a board, a plane another device reads or a floor document, and it names no other
 * face: two faces of one human hold two records that share the veil's key and nothing else, and neither leaves its face.
 *
 * THE ATOM SIGNS, NEVER THE PLACE KEY (persona-circle: the place key "signs no face act, seals to no face, and sits on no
 * face's roster"; identity-enacts-relation, the Bonds table: the atom bond's own key carries a face on a vessel). The
 * record names the veil's public key as a field and takes no signature from it, so the vessel's key signs nothing that
 * names a face.
 *
 * The record proves the link to whoever its holder hands it to. It grants nothing: no gate, cap or proof reads it.
 */
import { canonicalJsonBytes, utf8Bytes } from "./crypto.js";
import { ed25519SignerFromSeed, ed25519VerifyHex, ed25519VerifyingKeyFromSeed } from "./ed25519-door.js";

/** The signed image's domain: a veil-lift signature reads as nothing else the atom ever signs. */
export const VEIL_LIFT_DOMAIN = "lararium/veil-lift";

export interface VeilLiftRecord {
  readonly kind: "veil-lift";
  /** The vessel's own verifying key (64 lowercase hex): the veil that lifted. */
  readonly veil: string;
  /** The PersonaGroup the veil joined. */
  readonly face: string;
  /** The fresh atom the join minted for that face on this device (its verifying key, 64 lowercase hex). */
  readonly atom: string;
  /** The ATOM's signature over the domain and the three fields. */
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

/** Sign the link under the face's atom seed, naming the veil's PUBLIC key. The seed stays the caller's to zero. */
export async function signVeilLift(args: { readonly atomSeed: Uint8Array; readonly veil: string; readonly face: string }): Promise<VeilLiftRecord> {
  if (args.face.length === 0) throw new Error("veil-lift: the record names a face");
  if (!KEY.test(args.veil)) throw new Error("veil-lift: the veil reads as no verifying key");
  const atom = await ed25519VerifyingKeyFromSeed(args.atomSeed);
  const signature = await ed25519SignerFromSeed(args.atomSeed)(imageOf(args.veil, args.face, atom));
  return { kind: "veil-lift", veil: args.veil, face: args.face, atom, signature };
}

/** Read a link: its shape, exactly its five fields, and the ATOM's signature over them. Null where any fails. */
export async function verifyVeilLift(raw: unknown): Promise<VeilLiftRecord | null> {
  const r = raw as Partial<VeilLiftRecord> | null;
  if (!r || typeof r !== "object" || r.kind !== "veil-lift") return null;
  if (Object.keys(r).sort().join(",") !== "atom,face,kind,signature,veil") return null;
  if (typeof r.veil !== "string" || !KEY.test(r.veil) || typeof r.atom !== "string" || !KEY.test(r.atom)) return null;
  if (typeof r.face !== "string" || r.face.length === 0 || typeof r.signature !== "string") return null;
  let holds = false;
  try { holds = await ed25519VerifyHex(r.signature, imageOf(r.veil, r.face, r.atom), r.atom); } catch { holds = false; }
  return holds ? { kind: "veil-lift", veil: r.veil, face: r.face, atom: r.atom, signature: r.signature } : null;
}
