/**
 * rite — the store holder runs a rite's rows against the daemon wiki: `begin`, `land`, `receipts`.
 *
 * A rite that takes the vessel down keeps a tessera: `begin` derives the head's tree from git (`gitTreeOf`), returns the
 * rite's lei at that head (the evidence, the count and the reach all judged in the mesh core) and rests the guest half BEFORE the caller takes the vessel down; `land` rests the
 * host half once a vessel stands again; `receipts` lists every half and runs conferre over them; `receipt` rests the
 * vessel-signed `receipt/<tree>` every return rests on, over the verdict the host's battery hands in.
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
import { execFile } from "node:child_process";
import type { Repo } from "@automerge/automerge-repo";
import {
  SwarmRefused, beginRite, conferre, cosignPortWitness, isSwarmLeiRite, landRite, restReceipt, riteReceipts,
  type SwarmSignerPort, type SwarmTrust, type SwarmWikiPort,
} from "@lararium/mesh";
import { loadFaceFold, nodeWardCosignPortOf, IntentRefused, type FaceFold } from "./intent.js";

export type RiteAction = "begin" | "land" | "receipts" | "receipt";

/** Where the vessel looks for the checkout a rite's head belongs to: its own working directory, then the house's workspace mount. */
export const RITE_CHECKOUTS: readonly string[] = [process.cwd(), "/workspace"];

/**
 * THE VESSEL DERIVES THE HEAD'S TREE FROM GIT ITSELF. A return rests on the receipt standing for the head's tree, so the tree
 * never comes from the caller: the vessel asks git for `<head>^{tree}` in the first checkout that answers. A head that reads
 * as no object name never reaches git, and a place with no checkout, or a head git holds no commit for, refuses
 * `rite-tree-unreadable`: the rite begins nothing rather than rest on a tree nobody derived.
 */
export async function gitTreeOf(head: string, checkouts: readonly string[] = RITE_CHECKOUTS): Promise<string> {
  if (/^[0-9a-f]{40}$|^[0-9a-f]{64}$/.test(head)) {
    for (const dir of checkouts) {
      const env = { ...process.env };
      for (const k of ["GIT_DIR", "GIT_WORK_TREE", "GIT_COMMON_DIR", "GIT_INDEX_FILE"]) delete env[k];
      const tree = await new Promise<string>((resolve) => {
        execFile("git", ["-C", dir, "rev-parse", "--verify", "--quiet", `${head}^{tree}`], { encoding: "utf8", env }, (err, stdout) => resolve(err ? "" : stdout.trim()));
      });
      if (/^[0-9a-f]{40}$|^[0-9a-f]{64}$/.test(tree)) return tree;
    }
  }
  throw new SwarmRefused("rite-tree-unreadable", `git names no tree for the head ${head.slice(0, 64)} in any checkout this vessel reaches`);
}

export async function runRiteVerb(opts: {
  repo: Repo; catalogUrl?: string; face?: number; action: RiteAction;
  args: Readonly<Record<string, unknown>>; wiki?: SwarmWikiPort;
  /** The head's tree, as this vessel derives it; `gitTreeOf` where the caller seats none. */
  treeOf?: (head: string) => Promise<string>;
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
  const rite = opts.args["rite"];
  if (!isSwarmLeiRite(rite) || !str("branch") || !str("head")) throw new SwarmRefused("rite-malformed", "a rite names its rite, its branch and the head it runs at");
  // The caller names the head; this vessel derives the tree, so a return never rests on a tree its spender chose.
  const tree = await (opts.treeOf ?? gitTreeOf)(str("head"));
  let ward;
  try { ward = cosignPortWitness(await nodeWardCosignPortOf(opts.repo, loaded)); }
  catch (e) { if (e instanceof IntentRefused) throw new SwarmRefused("face-log-unreadable", e.message); throw e; }
  return { ...await beginRite(opts.wiki, { rite, branch: str("branch"), head: str("head"), tree }, trust, group, vessel, ward) };
}
