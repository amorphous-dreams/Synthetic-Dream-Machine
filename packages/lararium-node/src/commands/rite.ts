/**
 * rite — the store holder runs a rite's rows against the daemon wiki: `begin`, `land`, `receipts`.
 *
 * A rite that takes the vessel down keeps a tessera: `begin` derives the head's tree (out of the checkout's object store, `gitTreeOf`, no git binary; a `keep` reads its bundle id, `riteTreeOf`), returns the
 * rite's lei at that head (the testimony, the count and the reach all judged in the mesh core) and rests the guest half BEFORE the caller takes the vessel down; `land` rests the
 * host half once a vessel stands again; `receipts` lists every half and runs conferre over them; `receipt` rests the
 * vessel-signed `receipt/<tree>` every return rests on, over the verdict the host's battery hands in; `offer` gathers what a
 * kūkulu carries to the pūlama (the line's lei and this vessel's vouch over the image the host built) and rests it in the
 * house's config home for the next vessel (`kukulu-offer`).
 *
 * THE LEI CARRIES THE GRANT. No row here reads hand-only: the hand strung the lei under the ward, and any seat holding the
 * line may spend it.
 *
 * THE VESSEL SIGNS AS THIS DEVICE'S ATOM IN THE FACE. A return, a narrowing and each tessera half rest as the vessel's
 * witness, and a swarm record stays device-local, so the trust names this device's own atom as the vessel and no other key. A
 * receipt over a tree rests and verifies under the same key. It notarises the host's testimony: the vessel re-runs no check,
 * and any seat may hand a verdict in, so a receipt vouches for what this vessel heard, never for the tree.
 *
 * With no standing daemon wiki every row refuses by name before a face loads.
 * Meme: lar:///ha.ka.ba/lares/docs/pono/seat-harness
 */
import type { Repo } from "@automerge/automerge-repo";
import {
  SwarmRefused, beginRite, conferre, cosignPortWitness, isSwarmLeiRite, landRite, restReceipt, riteReceipts,
  type SwarmLeiRite, type SwarmSignerPort, type SwarmTrust, type SwarmWikiPort,
} from "@lararium/mesh";
import { loadFaceFold, nodeWardCosignPortOf, IntentRefused, type FaceFold } from "./intent.js";
import { treeOfHead } from "../git-tree-reader.js";
import { openedCustody } from "../custody-seat.js";
import { kukuluOfferPath, writeKukuluOffer } from "../kukulu-offer.js";

export type RiteAction = "begin" | "land" | "receipts" | "receipt" | "offer";

/** Where the vessel looks for the checkout a rite's head belongs to: its own working directory, then the house's workspace mount. */
export const RITE_CHECKOUTS: readonly string[] = [process.cwd(), "/workspace"];

/**
 * THE VESSEL DERIVES THE HEAD'S TREE ITSELF. A return rests on the receipt standing for the head's tree, so the tree never
 * comes from the caller. The vessel's image carries no git binary, so the vessel reads the checkout's object store directly
 * (`../git-tree-reader.ts`): the commit the head names, held to its own hash, and the tree that commit names. A head that
 * reads as no object name, a place with no checkout, or a head no store holds refuses `rite-tree-unreadable`: the rite begins
 * nothing rather than rest on a tree nobody derived.
 */
export const gitTreeOf = (head: string, checkouts: readonly string[] = RITE_CHECKOUTS): Promise<string> => treeOfHead(head, checkouts);

/**
 * THE TREE A RITE'S RETURN RESTS ON. A rite over the checkout (`push`, `kukulu`) reads its tree off the head through git. A
 * `keep` runs over no checkout: its head names a carry bundle by its id (the sha-256 over the bundle's sorted file list), and
 * a content name already names its tree, so the id stands as both. A keep head that spells no bundle id refuses
 * `rite-tree-unreadable`. The receipt a keep returns under rests at that id, handed in by the seat that cut the bundle and read
 * every byte back (`rite-receipt`): this vessel signs what it heard, as it does for every receipt.
 */
export async function riteTreeOf(rite: SwarmLeiRite, head: string, gitTree: (head: string) => Promise<string> = gitTreeOf): Promise<string> {
  if (rite !== "keep") return gitTree(head);
  if (!/^[0-9a-f]{64}$/.test(head)) throw new SwarmRefused("rite-tree-unreadable", `a keep's head names a carry bundle by its id (64 hex), and ${JSON.stringify(head.slice(0, 80))} spells none`);
  return head;
}

export async function runRiteVerb(opts: {
  repo: Repo; catalogUrl?: string; face?: number; action: RiteAction;
  args: Readonly<Record<string, unknown>>; wiki?: SwarmWikiPort;
  /** The head's tree, as this vessel derives it; `gitTreeOf` where the caller seats none. */
  treeOf?: (head: string) => Promise<string>;
  /** Where an `offer` rests; the house's config home where the caller seats none. */
  offerPath?: string;
}): Promise<Record<string, unknown>> {
  if (!opts.wiki) throw new SwarmRefused("swarm-no-daemon", "no standing daemon: a rite's records need the founded wiki");
  const str = (key: string): string => (typeof opts.args[key] === "string" ? opts.args[key] as string : "");
  let loaded: FaceFold;
  try { loaded = await loadFaceFold(opts.repo, opts.catalogUrl, { index: opts.face }); }
  catch (e) { if (e instanceof IntentRefused) throw new SwarmRefused("face-log-unreadable", e.message); throw e; }
  const { group, face, signer } = loaded;
  const vesselKey = signer.key.toLowerCase();
  const vessel: SwarmSignerPort = { key: signer.key, sign: (bytes) => signer.sign(bytes) };
  const trust: SwarmTrust = { hand: (key) => face.currentSigner(key), vessel: (key) => key === vesselKey, lead: () => false };
  if (opts.action === "receipts") return { receipts: await riteReceipts(opts.wiki, trust, group), conferre: await conferre(opts.wiki, trust, group) };
  if (opts.action === "receipt") {
    // THE RECEIPT NOTARISES THE HOST'S TESTIMONY: the battery ran on the host, and this vessel signs the verdict it heard.
    return { ...await restReceipt(opts.wiki, { tree: str("tree"), checks: opts.args["checks"] as readonly string[], verdict: opts.args["verdict"] as "pass" | "fail", definitions: str("definitions") }, trust, group, vessel) };
  }
  if (opts.action === "land") {
    if (!/^[0-9a-f]{64}$/.test(str("tessera")) || !str("head")) throw new SwarmRefused("rite-malformed", "a landing names its tessera and the head the vessel stands at");
    return { ...await landRite(opts.wiki, { tessera: str("tessera"), head: str("head") }, trust, group, vessel) };
  }
  if (opts.action === "offer") {
    // THE OFFER A KŪKULU CARRIES TO THE PŪLAMA: this vessel, still standing, gathers the line's lei and signs the vouch over
    // the image the host named, then rests both where the next vessel reads them (`kukulu-offer`).
    if (!str("branch") || !str("head") || !str("image")) throw new SwarmRefused("rite-offer-malformed", "an offer names its branch, its head and the image the host built");
    const offerTree = await (opts.treeOf ?? gitTreeOf)(str("head"));
    let offerWard;
    try { offerWard = cosignPortWitness(await nodeWardCosignPortOf(opts.repo, loaded)); }
    catch (e) { if (e instanceof IntentRefused) throw new SwarmRefused("face-log-unreadable", e.message); throw e; }
    return { ...await writeKukuluOffer({
      wiki: opts.wiki, trust, group, ward: offerWard, branch: str("branch"), head: str("head"), tree: offerTree, image: str("image"),
      holder: await openedCustody(), path: opts.offerPath ?? kukuluOfferPath(),
    }) };
  }
  const rite = opts.args["rite"];
  if (!isSwarmLeiRite(rite) || !str("branch") || !str("head")) throw new SwarmRefused("rite-malformed", "a rite names its rite, its branch and the head it runs at");
  // The caller names the head; this vessel derives the tree, so a return never rests on a tree its spender chose.
  const tree = await riteTreeOf(rite, str("head"), opts.treeOf ?? gitTreeOf);
  let ward;
  try { ward = cosignPortWitness(await nodeWardCosignPortOf(opts.repo, loaded)); }
  catch (e) { if (e instanceof IntentRefused) throw new SwarmRefused("face-log-unreadable", e.message); throw e; }
  return { ...await beginRite(opts.wiki, { rite, branch: str("branch"), head: str("head"), tree }, trust, group, vessel, ward) };
}
