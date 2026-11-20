/**
 * kukulu-offer — what a kūkulu carries to the pūlama: the standing vessel writes it, the next vessel offers it once.
 *
 * A rebuilt vessel wakes holding no key and no document, so it cannot read its own lei. The STANDING vessel gathers the
 * offer before it goes down (`rite-offer`, between the image's build and the vessel's lowering) and rests it as one file in
 * the house's config home:
 *
 *   <config>/kukulu-offer.json    { "lei": [ … ], "unstrung": [ … ], "vouch": [ … ] }
 *
 *   lei        every kukulu lei standing on the branch's line of each face the kūkulu asks lent, in this vessel's control
 *              document, as their signed records: a chain reads from its first lei, so each whole line rides, and the
 *              pūlama lands each where it verifies under its own face's hand
 *   unstrung   each unstringing that rests for one of those lei, so a lei the hand ended reaches the pūlama ended
 *   vouch      one vouch per face: this vessel's signature, under the custody root's vouch child, over that face's group,
 *              the branch, the head and the tree it derived, and the image digest the host named. A face with no lei
 *              on its line still rides its vouch, and waits at the pūlama by name (`swarm-lei-absent`) while the other faces' lend stands.
 *
 * ── NOTHING SECRET RESTS IN THE FILE ────────────────────────────────────────────────────────────
 * Each part holds a signed record or a public digest. The file lands whole (a sibling temp, then a rename), owner-only.
 *
 * ── ONE KŪKULU, ONE OFFER ───────────────────────────────────────────────────────────────────────
 * A later rite writes over the file, so the newest offer supersedes the last. The vessel that the pūlama serves removes
 * the file once its session stands (`consumeKukuluOffer`): a plain restart afterwards finds no offer and wears nothing. A
 * hello the pūlama refuses leaves the file, so the same offer rides the next dial (after the operator lights the pūlama).
 *
 * THE HOST NAMES THE IMAGE. The digest arrives as the row's argument, from the host that built the image; the pūlama
 * compares it with the digest the host reports at its own hand door, and a vessel that named another gains nothing.
 * Meme: lar:///ha.ka.ba/lares/docs/pono/the-worn-house#/the-pulama
 */
import { closeSync, fsyncSync, mkdirSync, openSync, renameSync, rmSync, writeSync } from "node:fs";
import { dirname, join } from "node:path";
import {
  SwarmRefused, kukuluVouchDigest, readLeiChain, signKukuluVouch, swarmLeiUnstrungTitle,
  type SignedKukuluVouch, type SignedSwarmAct, type SwarmTrust, type SwarmWikiPort, type WardActWitness,
} from "@lararium/mesh";
import type { CustodyHolder } from "./custody-holder.js";
import { vouchSignerOf } from "./kukulu-gate.js";
import { larConfigHome } from "./vessel-paths.js";

export const KUKULU_OFFER_FILE = "kukulu-offer.json";
/** Where the offer rests: the house's config home, which the standing vessel and the next one both reach. */
export const kukuluOfferPath = (): string => join(larConfigHome(), KUKULU_OFFER_FILE);

export interface KukuluOffer { readonly lei: readonly SignedSwarmAct[]; readonly unstrung: readonly unknown[]; readonly vouch: readonly SignedKukuluVouch[] }

/**
 * One face the offer asks lent: its group, the trust its own hand's records verify under, its ward witness, and the name the
 * answer gives it (`h<ordinal>`; its group where the caller names none).
 */
export interface KukuluOfferFace { readonly group: string; readonly trust: SwarmTrust; readonly ward: WardActWitness; readonly name?: string }

const IMAGE_DIGEST = /^[a-z0-9]+:[0-9a-f]{32,128}$/;

/**
 * Gather the offer for one line and rest it at `path`. Refuses by name, writing nothing: `rite-offer-malformed` (an image
 * that reads as no digest), `swarm-lei-absent` (no kukulu lei rests on any face's line).
 */
export async function writeKukuluOffer(a: {
  readonly wiki: SwarmWikiPort;
  /** The faces the kūkulu asks lent, one vouch each. */
  readonly faces: readonly KukuluOfferFace[];
  readonly branch: string; readonly head: string; readonly tree: string;
  /** THE HOST'S NAME for the image it built. */
  readonly image: string;
  /** The holder whose custody root yields the vouch key: this vessel's seated one. */
  readonly holder: Pick<CustodyHolder, "derive">;
  readonly path: string;
}): Promise<{
  readonly path: string; readonly vouch: readonly string[]; readonly lei: number;
  /** Every face the offer vouches for, by name, in the order asked. */
  readonly faces: readonly string[];
  /** The faces whose line carries no lei: each rides its vouch and waits at the pūlama by name. */
  readonly waits: readonly string[];
}> {
  if (!IMAGE_DIGEST.test(a.image)) throw new SwarmRefused("rite-offer-malformed", "an offer names the image by its digest, `<algorithm>:<hex>`");
  const lei: SignedSwarmAct[] = [], unstrung: unknown[] = [], waits: string[] = [];
  const nameOf = (face: KukuluOfferFace): string => face.name ?? face.group;
  for (const face of a.faces) {
    const chain = await readLeiChain(a.wiki, { rite: "kukulu", branch: a.branch }, face.trust, face.group, face.ward);
    if (chain.cosigned.length === 0) waits.push(nameOf(face));
    for (const row of chain.cosigned) {
      lei.push(row.act);
      const text = await a.wiki.read(swarmLeiUnstrungTitle(row.cid));
      if (text === null) continue;
      try { unstrung.push(JSON.parse(text)); } catch { /* a row that forms no record ends nothing at the pūlama */ }
    }
  }
  if (lei.length === 0) throw new SwarmRefused("swarm-lei-absent", `no kukulu lei rests for "${a.branch}" on any face's line, so this kūkulu wears none`);
  const signer = await vouchSignerOf(a.holder);
  const vouch: SignedKukuluVouch[] = [];
  for (const face of a.faces) vouch.push(await signKukuluVouch({ group: face.group, branch: a.branch, head: a.head, tree: a.tree, image: a.image }, signer));
  const offer: KukuluOffer = { lei, unstrung, vouch };
  mkdirSync(dirname(a.path), { recursive: true });
  const tmp = `${a.path}.${process.pid}.tmp`;
  const fd = openSync(tmp, "w", 0o600);
  try { writeSync(fd, JSON.stringify(offer)); fsyncSync(fd); } finally { closeSync(fd); }
  renameSync(tmp, a.path);
  return { path: a.path, vouch: vouch.map((v) => kukuluVouchDigest(v)), lei: offer.lei.length, faces: a.faces.map(nameOf), waits };
}

/** Remove a spent offer; answers whether a file went. A file that will not go stays, and the caller names it. */
export function consumeKukuluOffer(path: string | undefined): boolean {
  if (!path || path.trim() === "") return false;
  try { rmSync(path); return true; } catch { return false; }
}
