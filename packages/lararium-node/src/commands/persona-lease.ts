/**
 * persona-lease — roll a PersonaGroup's lease epoch forward with a SIGNED advance (`lares persona lease`).
 *
 * The lease is a max-register of per-writer slots (`epoch-lease`), and for a face each slot counts only when its writer
 * signed it and the writer's key stands in the face's KEL lineage (`lease-advance`). The persona ROOT signs here: it is
 * the key the lineage seats, and it rests on this vessel's identity home, never in the running daemon. The verb reads
 * the signed slots on the daemon doc, signs effective + 1 into the root's own slot, and raises the sealed anchor's
 * frontier to the epoch it just verified. An unsigned or stranger-signed slot raised nothing before this verb and raises
 * nothing after it.
 *
 * Meme: lar:///ha.ka.ba/lararium/node/persona-lease
 */
import type { AutomergeUrl, Repo } from "@automerge/automerge-repo";
import { ed25519SignerFromSeed, ed25519VerifyingKeyFromSeed, raiseFaceFrontier, currentSignerOf, type LarDoc } from "@lararium/mesh";
import { DAEMON_BAG_ID } from "@lararium/mesh";
import { readFileSync } from "node:fs";
import { loadIdentityAnchors } from "../identity-anchors.js";
import { loadFaceAnchorOfGroup, keepFaceAnchorOfGroup } from "../face-anchor-store.js";
import { fleetLineageForVessel } from "../fleet-lineage.js";
import { rollSignedLeaseEpochOnBoard } from "../lease-rekey.js";
import { loadPersonaGroupRootSeed } from "../node-vessel-identity.js";
import { larBootstrapPath } from "../vessel-paths.js";

import { resolveFace } from "../face-selector.js";
export class PersonaLeaseError extends Error {}

export interface PersonaLeaseOptions {
  readonly repo: Repo;
  /** The face whose root signs; default the founding face. */
  readonly handleIndex?: number;
}

export interface PersonaLeaseResult {
  readonly handleIndex: number;
  readonly personaGroupId: string;
  readonly effective: number;
  readonly rolled: number;
  readonly slot: string;
  /** The sealed anchor's frontier after the advance verified. */
  readonly frontier: number;
}

function daemonUrlOfBootstrap(): string {
  let text: string;
  try { text = readFileSync(larBootstrapPath(), "utf8"); } catch { throw new PersonaLeaseError("this vessel has no bootstrap: found the place first"); }
  const plugin = JSON.parse(text) as { text?: string };
  const tiddlers = (JSON.parse(plugin.text ?? "{}") as { tiddlers?: Record<string, { text?: string }> }).tiddlers ?? {};
  const url = tiddlers[DAEMON_BAG_ID]?.text;
  if (!url) throw new PersonaLeaseError("the bootstrap names no daemon doc");
  return url;
}

export async function runPersonaLease(opts: PersonaLeaseOptions): Promise<PersonaLeaseResult> {
  const handleIndex = await resolveFace(opts.handleIndex);
  const anchors = await loadIdentityAnchors(handleIndex);
  if (!anchors) throw new PersonaLeaseError(`this vessel holds no face at index ${handleIndex}`);
  const anchor = await loadFaceAnchorOfGroup(anchors.personaGroupId);
  if (!anchor) throw new PersonaLeaseError("this face holds no sealed anchor; re-found it");
  const seed = await loadPersonaGroupRootSeed(handleIndex);
  const key = await ed25519VerifyingKeyFromSeed(seed);
  const lineage = await fleetLineageForVessel(opts.repo, key);
  if (!lineage) throw new PersonaLeaseError("this vessel reads no verified persona-KEL lineage for that root, so no advance can verify");
  const seated = currentSignerOf(lineage);
  if (!seated(key)) throw new PersonaLeaseError("this root holds no seat in the face's KEL lineage");
  const daemon = await opts.repo.find<LarDoc>(daemonUrlOfBootstrap() as AutomergeUrl);
  const r = await rollSignedLeaseEpochOnBoard(daemon, anchors.personaGroupId, { key, sign: ed25519SignerFromSeed(seed) }, seated);
  const raised = raiseFaceFrontier(anchor, { leaseEpoch: r.rolled });
  if (raised !== anchor) await keepFaceAnchorOfGroup(raised);
  await opts.repo.flush();
  return { handleIndex, personaGroupId: anchors.personaGroupId, effective: r.effective, rolled: r.rolled, slot: r.slot, frontier: raised.frontier.leaseEpoch };
}
