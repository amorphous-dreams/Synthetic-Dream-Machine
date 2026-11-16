/**
 * rite — the store holder runs a rite's rows against the daemon wiki: `begin`, `land`, `receipts`.
 *
 * A rite that takes the vessel down keeps a tessera: `begin` returns the rite's lei at one head (the evidence, the count and
 * the reach all judged in the mesh core) and rests the guest half BEFORE the caller takes the vessel down; `land` rests the
 * host half once a vessel stands again; `receipts` lists every half and runs conferre over them.
 *
 * THE LEI CARRIES THE GRANT. No row here reads hand-only: the hand strung the lei under the ward, and any seat holding the
 * line may spend it.
 *
 * THE VESSEL SIGNS AS THIS DEVICE'S ATOM IN THE FACE. A return, a narrowing and each tessera half rest as the vessel's
 * witness, and a swarm record stays device-local, so the trust names this device's own atom as the vessel and no other key. A
 * receipt over a tree verifies under the same key; no row here writes one.
 *
 * With no standing daemon wiki every row refuses by name before a face loads.
 * Meme: lar:///ha.ka.ba/lares/docs/pono/seat-harness
 */
import type { Repo } from "@automerge/automerge-repo";
import {
  SwarmRefused, beginRite, conferre, cosignPortWitness, isSwarmLeiRite, landRite, riteReceipts,
  type SwarmSignerPort, type SwarmTrust, type SwarmWikiPort,
} from "@lararium/mesh";
import { loadFaceFold, nodeWardCosignPortOf, IntentRefused, type FaceFold } from "./intent.js";

export type RiteAction = "begin" | "land" | "receipts";

export async function runRiteVerb(opts: {
  repo: Repo; catalogUrl?: string; face?: number; action: RiteAction;
  args: Readonly<Record<string, unknown>>; wiki?: SwarmWikiPort;
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
  if (opts.action === "land") {
    if (!/^[0-9a-f]{64}$/.test(str("tessera")) || !str("head")) throw new SwarmRefused("rite-malformed", "a landing names its tessera and the head the vessel stands at");
    return { ...await landRite(opts.wiki, { tessera: str("tessera"), head: str("head") }, trust, group, vessel) };
  }
  const rite = opts.args["rite"];
  if (!isSwarmLeiRite(rite) || !str("branch") || !str("head") || !str("tree")) throw new SwarmRefused("rite-malformed", "a rite names its rite, its branch, and the head and tree it runs at");
  let ward;
  try { ward = cosignPortWitness(await nodeWardCosignPortOf(opts.repo, loaded)); }
  catch (e) { if (e instanceof IntentRefused) throw new SwarmRefused("face-log-unreadable", e.message); throw e; }
  return { ...await beginRite(opts.wiki, { rite, branch: str("branch"), head: str("head"), tree: str("tree") }, trust, group, vessel, ward) };
}
