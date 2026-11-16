/**
 * kukulu-offer — what a kūkulu carries to the pūlama: the standing vessel writes it, the next vessel offers it once.
 *
 * A rebuilt vessel wakes holding no key and no document, so it cannot read its own lei. The STANDING vessel gathers the
 * offer before it goes down (`rite-offer`, between the image's build and the vessel's lowering) and rests it as one file in
 * the house's config home:
 *
 *   <config>/kukulu-offer.json    { "lei": [ … ], "unstrung": [ … ], "vouch": { … } }
 *
 *   lei        every kukulu lei standing on the branch's line in this vessel's control document, as their signed records:
 *              a chain reads from its first lei, so the whole line rides, and the pūlama lands each where it verifies
 *   unstrung   each unstringing that rests for one of those lei, so a lei the hand ended reaches the pūlama ended
 *   vouch      this vessel's signature, under the custody root's vouch child, over the group, the branch, the head and the
 *              tree it derived, the image digest the host named, and the verdict of the receipt standing for that tree
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
  SwarmRefused, kukuluVouchDigest, readLeiChain, signKukuluVouch, swarmLeiUnstrungTitle, swarmReceiptTitle, verifySwarmRecord,
  type SignedKukuluVouch, type SignedSwarmAct, type SwarmTrust, type SwarmWikiPort, type WardActWitness,
} from "@lararium/mesh";
import type { CustodyHolder } from "./custody-holder.js";
import { vouchSignerOf } from "./kukulu-gate.js";
import { larConfigHome } from "./vessel-paths.js";

export const KUKULU_OFFER_FILE = "kukulu-offer.json";
/** Where the offer rests: the house's config home, which the standing vessel and the next one both reach. */
export const kukuluOfferPath = (): string => join(larConfigHome(), KUKULU_OFFER_FILE);

export interface KukuluOffer { readonly lei: readonly SignedSwarmAct[]; readonly unstrung: readonly unknown[]; readonly vouch: SignedKukuluVouch }

const IMAGE_DIGEST = /^[a-z0-9]+:[0-9a-f]{32,128}$/;

/**
 * Gather the offer for one line and rest it at `path`. Refuses by name, writing nothing: `rite-offer-malformed` (an image
 * that reads as no digest), `swarm-lei-absent` (no kukulu lei rests on the line), `rite-offer-evidence-absent` (no receipt
 * stands for the head's tree, so the vouch would carry no verdict).
 */
export async function writeKukuluOffer(a: {
  readonly wiki: SwarmWikiPort; readonly trust: SwarmTrust; readonly group: string; readonly ward: WardActWitness;
  readonly branch: string; readonly head: string; readonly tree: string;
  /** THE HOST'S NAME for the image it built. */
  readonly image: string;
  /** The holder whose custody root yields the vouch key: this vessel's seated one. */
  readonly holder: Pick<CustodyHolder, "derive">;
  readonly path: string;
}): Promise<{ readonly path: string; readonly vouch: string; readonly lei: number; readonly verdict: "pass" | "fail" }> {
  if (!IMAGE_DIGEST.test(a.image)) throw new SwarmRefused("rite-offer-malformed", "an offer names the image by its digest, `<algorithm>:<hex>`");
  const chain = await readLeiChain(a.wiki, { rite: "kukulu", branch: a.branch }, a.trust, a.group, a.ward);
  if (chain.cosigned.length === 0) throw new SwarmRefused("swarm-lei-absent", `no kukulu lei rests for "${a.branch}", so this kūkulu wears none`);
  const unstrung: unknown[] = [];
  for (const row of chain.cosigned) {
    const text = await a.wiki.read(swarmLeiUnstrungTitle(row.cid));
    if (text === null) continue;
    try { unstrung.push(JSON.parse(text)); } catch { /* a row that forms no record ends nothing at the pūlama */ }
  }
  const receiptTitle = swarmReceiptTitle(a.tree);
  const receipt = verifySwarmRecord(await a.wiki.read(receiptTitle), receiptTitle, a.trust, a.group);
  if (!receipt.ok || receipt.act.body.act !== "receipt") throw new SwarmRefused("rite-offer-evidence-absent", `no receipt stands for the tree of ${a.head}; a vouch carries the verdict of the walk it rests on`);
  const verdict = receipt.act.body.verdict;
  const vouch = await signKukuluVouch({ group: a.group, branch: a.branch, head: a.head, tree: a.tree, image: a.image, verdict, receipt: receipt.cid }, await vouchSignerOf(a.holder));
  const offer: KukuluOffer = { lei: chain.cosigned.map((row) => row.act), unstrung, vouch };
  mkdirSync(dirname(a.path), { recursive: true });
  const tmp = `${a.path}.${process.pid}.tmp`;
  const fd = openSync(tmp, "w", 0o600);
  try { writeSync(fd, JSON.stringify(offer)); fsyncSync(fd); } finally { closeSync(fd); }
  renameSync(tmp, a.path);
  return { path: a.path, vouch: kukuluVouchDigest(vouch), lei: offer.lei.length, verdict };
}

/** Remove a spent offer; answers whether a file went. A file that will not go stays, and the caller names it. */
export function consumeKukuluOffer(path: string | undefined): boolean {
  if (!path || path.trim() === "") return false;
  try { rmSync(path); return true; } catch { return false; }
}
