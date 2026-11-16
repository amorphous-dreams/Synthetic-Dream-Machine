/**
 * kukulu-vouch — the standing vessel's signature over a candidate image it walked, ahead of a kūkulu. Apart from the cabal's
 * vouch family (`vouch-dag`, `vouch-board`), where one member vouches for a joiner: this record vouches for an image.
 *
 * The standing vessel boots the candidate under a scratch root, walks it, and signs what it saw: the face's group, the
 * branch, the tree, the image's digest and the walk's verdict. A kūkulu lei names the vouch's digest as its head, so the lei
 * reaches the one candidate that vessel walked and no other, and the pūlama reads both before it serves.
 *
 * A VOUCH CERTIFIES CONTINUITY, NEVER GOODNESS. It signs under a child of the custody root (`KUKULU_VOUCH_DOMAIN`), so only a
 * vessel that already reached that root signs one; it says nothing of what the candidate will do once it stands.
 *
 * THE IMAGE DIGEST COMES FROM OUTSIDE. The vouch carries the digest its signer walked; whoever reads it compares that
 * digest with the one the host reports for the image it raises. A vessel never reports its own.
 * Meme: lar:///ha.ka.ba/lares/docs/pono/the-worn-house#/the-pulama
 */
import { canonicalJsonBytes, sha256HexBytesSync } from "./crypto.js";
import { KUKULU_VOUCH_DOMAIN } from "./domains.js";
import { verifyEd25519 } from "./ed25519-door.js";

export interface KukuluVouchParts {
  /** The face's group the kūkulu stands for. */
  readonly group: string;
  readonly branch: string;
  /** The tree the candidate image carries. */
  readonly tree: string;
  /** The candidate image's digest, as its walker read it. */
  readonly image: string;
  /** The walk's verdict; a pūlama serves a `pass` alone. */
  readonly verdict: "pass" | "fail";
  /** The cid of the walk's receipt, where one rests. */
  readonly receipt: string | null;
}
export type KukuluVouchBody = KukuluVouchParts & { readonly kind: typeof KUKULU_VOUCH_DOMAIN; readonly act: "vouch" };
export interface SignedKukuluVouch { readonly body: KukuluVouchBody; readonly signer: string; readonly sig: string }
export type KukuluVouchRefusal = "shape" | "domain" | "signature" | "signer";

const KEYS = ["act", "branch", "group", "image", "kind", "receipt", "tree", "verdict"].join(",");
const text = (x: unknown): x is string => typeof x === "string" && x.length > 0 && x.length <= 512;
const hex64 = (x: unknown): x is string => typeof x === "string" && /^[0-9a-f]{64}$/.test(x);

function shape(b: unknown): b is KukuluVouchBody {
  if (typeof b !== "object" || b === null || Array.isArray(b)) return false;
  const v = b as Record<string, unknown>;
  return Object.keys(v).sort().join(",") === KEYS && v["act"] === "vouch" && typeof v["kind"] === "string"
    && text(v["group"]) && text(v["branch"]) && text(v["tree"]) && text(v["image"])
    && (v["verdict"] === "pass" || v["verdict"] === "fail") && (v["receipt"] === null || hex64(v["receipt"]));
}

/** Sign a vouch under the vouch key (`key`: its verifying half, 64 lower hex). */
export async function signKukuluVouch(parts: KukuluVouchParts, signer: { readonly key: string; readonly sign: (bytes: Uint8Array) => Promise<string> }): Promise<SignedKukuluVouch> {
  const body: KukuluVouchBody = { kind: KUKULU_VOUCH_DOMAIN, act: "vouch", group: parts.group, branch: parts.branch, tree: parts.tree, image: parts.image, verdict: parts.verdict, receipt: parts.receipt };
  if (!shape(body)) throw new TypeError("vouch: the parts form no vouch");
  return { body, signer: signer.key.toLowerCase(), sig: await signer.sign(canonicalJsonBytes(body)) };
}

/** The digest a kūkulu lei names as its head: the vouch's body and its signer, canonical. */
export const kukuluVouchDigest = (vouch: { readonly body: KukuluVouchBody; readonly signer: string }): string =>
  sha256HexBytesSync(canonicalJsonBytes({ body: vouch.body, signer: vouch.signer }));

/** Read an offered vouch: its shape, its domain, its signature, and that `vouchKey` (the key its reader derived itself) signed it. */
export function verifyKukuluVouch(raw: unknown, vouchKey: string): { readonly ok: true; readonly vouch: SignedKukuluVouch; readonly digest: string } | { readonly ok: false; readonly refusal: KukuluVouchRefusal } {
  if (typeof raw !== "object" || raw === null) return { ok: false, refusal: "shape" };
  const r = raw as Record<string, unknown>;
  if (Object.keys(r).sort().join(",") !== "body,sig,signer" || !hex64(r["signer"]) || typeof r["sig"] !== "string" || !shape(r["body"])) return { ok: false, refusal: "shape" };
  const body = r["body"];
  if (body.kind !== KUKULU_VOUCH_DOMAIN) return { ok: false, refusal: "domain" };
  try { if (!verifyEd25519(r["sig"], canonicalJsonBytes(body), r["signer"])) return { ok: false, refusal: "signature" }; } catch { return { ok: false, refusal: "signature" }; }
  if (r["signer"] !== vouchKey.toLowerCase()) return { ok: false, refusal: "signer" };
  const vouch = { body, signer: r["signer"], sig: r["sig"] } as SignedKukuluVouch;
  return { ok: true, vouch, digest: kukuluVouchDigest(vouch) };
}
