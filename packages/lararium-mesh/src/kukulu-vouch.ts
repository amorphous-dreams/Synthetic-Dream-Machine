/**
 * kukulu-vouch — the standing vessel's signature over a candidate image it walked, ahead of a kūkulu. Apart from the cabal's
 * vouch family (`vouch-dag`, `vouch-board`), where one member vouches for a joiner: this record vouches for an image.
 *
 * The standing vessel boots the candidate under a scratch root, walks it, and signs what it saw: the face's group, the
 * branch, the head and its tree and the image's digest. The pūlama returns the kūkulu lei at the head and
 * tree the vouch names (a lei that pins a head pins that one), and the vouch's digest names the candidate the return belongs to, so the
 * lei reaches the one candidate that vessel walked and no other.
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
  /** The head the candidate image was built at; a kūkulu lei that pins a head pins this one. */
  readonly head: string;
  /** The tree that head carries, as the walker derived it. */
  readonly tree: string;
  /** The candidate image's digest, as its walker read it. */
  readonly image: string;
  /**
   * THE KEEPER MOVE this kūkulu carries (the keeper tally), where it hands the pūlama's fire: the successor's one-handoff key it
   * announced through this same rite (`to`), the closure the hand committed (`next`), and the devices this face holds as the
   * vessel read its signed admission fold (`devices`, 0 where it read none). A vest proceeds only inside a rite whose vouch names it.
   */
  readonly keeper?: KukuluVouchKeeper;
}
export interface KukuluVouchKeeper { readonly to: string; readonly next: string; readonly devices: number }
export type KukuluVouchBody = KukuluVouchParts & { readonly kind: typeof KUKULU_VOUCH_DOMAIN; readonly act: "vouch" };
export interface SignedKukuluVouch { readonly body: KukuluVouchBody; readonly signer: string; readonly sig: string }
export type KukuluVouchRefusal = "shape" | "domain" | "signature" | "signer";

const KEYS = ["act", "branch", "group", "head", "image", "kind", "tree"].join(",");
const KEYS_KEEPER = ["act", "branch", "group", "head", "image", "keeper", "kind", "tree"].join(",");
function keeperShape(k: unknown): k is KukuluVouchKeeper {
  if (typeof k !== "object" || k === null || Array.isArray(k)) return false;
  const v = k as Record<string, unknown>;
  return Object.keys(v).sort().join(",") === "devices,next,to" && hex64(v["to"]) && typeof v["next"] === "string" && /^sha256:[0-9a-f]{64}$/.test(v["next"])
    && typeof v["devices"] === "number" && Number.isSafeInteger(v["devices"]) && v["devices"] >= 0;
}
const text = (x: unknown): x is string => typeof x === "string" && x.length > 0 && x.length <= 512;
const hex64 = (x: unknown): x is string => typeof x === "string" && /^[0-9a-f]{64}$/.test(x);

function shape(b: unknown): b is KukuluVouchBody {
  if (typeof b !== "object" || b === null || Array.isArray(b)) return false;
  const v = b as Record<string, unknown>;
  const keys = Object.keys(v).sort().join(",");
  if (keys === KEYS_KEEPER ? !keeperShape(v["keeper"]) : keys !== KEYS) return false;
  return v["act"] === "vouch" && typeof v["kind"] === "string"
    && text(v["group"]) && text(v["branch"]) && text(v["head"]) && text(v["tree"]) && text(v["image"]);
}

/** Sign a vouch under the vouch key (`key`: its verifying half, 64 lower hex). */
export async function signKukuluVouch(parts: KukuluVouchParts, signer: { readonly key: string; readonly sign: (bytes: Uint8Array) => Promise<string> }): Promise<SignedKukuluVouch> {
  const body: KukuluVouchBody = { kind: KUKULU_VOUCH_DOMAIN, act: "vouch", group: parts.group, branch: parts.branch, head: parts.head, tree: parts.tree, image: parts.image, ...(parts.keeper === undefined ? {} : { keeper: { to: parts.keeper.to, next: parts.keeper.next, devices: parts.keeper.devices } }) };
  if (!shape(body)) throw new TypeError("vouch: the parts form no vouch");
  return { body, signer: signer.key.toLowerCase(), sig: await signer.sign(canonicalJsonBytes(body)) };
}

/** The vouch's digest: its body and its signer, canonical. The return a kūkulu rests on names it. */
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
