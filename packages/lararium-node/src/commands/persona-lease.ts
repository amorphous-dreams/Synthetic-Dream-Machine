/**
 * persona-lease — roll a PersonaGroup's lease epoch forward with a SIGNED advance (`lares persona lease`).
 *
 * A face lease folds signed per-writer slots (`lease-advance`); Nexus and realm leases use charter-quorum
 * advances (`quorum-lease`). Here each face slot counts only when its writer
 * signed it and the writer's key stands in the face's KEL lineage (`lease-advance`). The persona ROOT signs here: it is
 * the key the lineage seats, and it rests on this vessel's identity home, never in the running daemon. The verb reads
 * the signed slots on the daemon doc, signs effective + 1 into the root's own slot, and raises the sealed anchor's
 * frontier to the epoch it just verified. An unsigned or stranger-signed slot raised nothing before this verb and raises
 * nothing after it.
 *
 * THE ROLL REFUSES WHILE IT WOULD STRAND A SEATED DEVICE (house ruling 2026-11-05, the operator may overrule it). A roll
 * re-issues no device edge, so every edge bound at the epoch it leaves reads stale at its holder's next boot, the rolling
 * vessel's own among them. Until the renewal at the roll stands (road L24), the verb refuses `lease-roll-strands-devices`
 * before it signs or writes, whenever this vessel's own edge binds the current epoch or the face's `@persona` log seats
 * another device's edge. The log carries an edge's digest and never its bound epoch, so every other seated edge counts.
 *

 * Meme: lar:///ha.ka.ba/lararium/node/persona-lease
 */
import type { WardCredential } from "../ward-credential.js";
import type { AutomergeUrl, Repo } from "@automerge/automerge-repo";
import { ed25519SignerFromSeed, ed25519VerifyingKeyFromSeed, raiseFaceFrontier, personaBagIdFor, type LarDoc, type FaceReading, ownEntry } from "@lararium/mesh";
import { DAEMON_BAG_ID } from "@lararium/mesh";
import { readFileSync } from "node:fs";
import { loadIdentityAnchors } from "../identity-anchors.js";
import { loadFaceAnchorOfGroup, keepFaceAnchorOfGroup } from "../face-anchor-store.js";
import { fleetFaceForVessel } from "../fleet-lineage.js";
import { rollSignedLeaseEpochOnBoard } from "../lease-rekey.js";
import { loadPersonaGroupRootSeed } from "../node-vessel-identity.js";
import { larBootstrapPath } from "../vessel-paths.js";
import { readFacePersonaRecords } from "../persona-act-store.js";

import { resolveFace } from "../face-selector.js";
export class PersonaLeaseError extends Error {}

/** The roll would leave seated device edges stale at their next boot, and nothing renews them at the roll yet. */
export class LeaseRollStrandsDevices extends PersonaLeaseError {
  override readonly name = "LeaseRollStrandsDevices";
  readonly refusal = "lease-roll-strands-devices";
  constructor(readonly stranded: number, readonly effective: number, ownStrands: boolean) {
    super(`lease-roll-strands-devices: rolling this face's lease past epoch ${effective} leaves ${stranded} seated device${stranded === 1 ? "" : "s"} `
      + `${ownStrands ? "(this vessel's own among them) " : ""}holding an edge its next boot reads stale, and no renewal at the roll re-issues one yet; the roll wrote nothing. `
      + `Owed: road L24, "a lease roll leaves every seated device able to boot". House ruling 2026-11-05: a pin that moves to a renewed edge the root `
      + `signed, that the log holds as the atom's latest device-edge act at a newer epoch, reads as a device-local cache update, not an identity change; `
      + `the renewal at the roll builds after standing under that reading.`);
  }
}

export interface PersonaLeaseOptions {
  readonly repo: Repo;
  /** The face whose root signs; default the founding face. */
  readonly handleIndex?: number;
  /** The face's ward route for this act (seat-harness#/the-ward): the root signs only under a fresh ward unlock. */
  readonly ward?: WardCredential;
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

function bootstrapTiddlers(): Record<string, { text?: string }> {
  let text: string;
  try { text = readFileSync(larBootstrapPath(), "utf8"); } catch { throw new PersonaLeaseError("this vessel has no bootstrap: found the place first"); }
  const plugin = JSON.parse(text) as { text?: string };
  return (JSON.parse(plugin.text ?? "{}") as { tiddlers?: Record<string, { text?: string }> }).tiddlers ?? {};
}

function daemonUrlOf(tiddlers: Record<string, { text?: string }>): string {
  const url = ownEntry(tiddlers, DAEMON_BAG_ID)?.text;
  if (!url) throw new PersonaLeaseError("the bootstrap names no daemon doc");
  return url;
}

export async function runPersonaLease(opts: PersonaLeaseOptions): Promise<PersonaLeaseResult> {
  const handleIndex = await resolveFace(opts.handleIndex);
  const anchors = await loadIdentityAnchors(handleIndex);
  if (!anchors) throw new PersonaLeaseError(`this vessel holds no face at index ${handleIndex}`);
  const anchor = await loadFaceAnchorOfGroup(anchors.personaGroupId);
  if (!anchor) throw new PersonaLeaseError("this face holds no sealed anchor; re-found it");
  const seed = await loadPersonaGroupRootSeed(handleIndex, opts.ward);
  // THE ROOT SEED LIVES FOR THIS ONE ACT: it zero-fills when the act settles, whatever it answered (seat-harness#/the-ward).
  try {
  const key = await ed25519VerifyingKeyFromSeed(seed);
  const face = await fleetFaceForVessel(opts.repo, key, anchor);
  if (!face) throw new PersonaLeaseError("this vessel reads no verified persona-KEL lineage for that root, so no advance can verify");
  const seated = face.currentSigner;
  if (!seated(key)) throw new PersonaLeaseError("this root holds no seat in the face's KEL lineage");
  const tiddlers = bootstrapTiddlers();
  const daemon = await opts.repo.find<LarDoc>(daemonUrlOf(tiddlers) as AutomergeUrl);
  const seatedEdges = await logSeatedEdges(opts.repo, face, anchors.personaGroupId, ownEntry(tiddlers, personaBagIdFor(anchors.personaGroupId))?.text);
  const ownEdge = anchors.deviceEdge;
  const ownKey = ownEdge?.deviceVerifyingKey.toLowerCase();
  const strands = (effective: number): void => {
    // This vessel's own edge strands when it binds the epoch the roll leaves (an edge already below it halts today, roll or no
    // roll); an anchor that carries no edge reads its binding unknown and counts. Every other edge the log seats counts.
    const own = ownEdge === undefined || !(Number(ownEdge.boundEpoch) < effective) ? 1 : 0;
    const others = seatedEdges.filter((k) => k !== ownKey).length;
    if (own + others > 0) throw new LeaseRollStrandsDevices(own + others, effective, own === 1);
  };
  const r = await rollSignedLeaseEpochOnBoard(daemon, anchors.personaGroupId, { key, sign: ed25519SignerFromSeed(seed) }, seated, face.floor, strands);
  const raised = raiseFaceFrontier(anchor, { leaseEpoch: r.rolled });
  if (raised !== anchor) await keepFaceAnchorOfGroup(raised);
  await opts.repo.flush();
  return { handleIndex, personaGroupId: anchors.personaGroupId, effective: r.effective, rolled: r.rolled, slot: r.slot, frontier: raised.frontier.leaseEpoch };
  } finally { seed.fill(0); }
}

/** The devices the face's `@persona` log seats an edge for, under this vessel's own face reading. A plane the bootstrap names
 *  no URL for, or this replica cannot open, reads no seat beyond this vessel's own. */
async function logSeatedEdges(repo: Repo, face: FaceReading, group: string, personaUrl: string | undefined): Promise<string[]> {
  if (!personaUrl) return [];
  let records: unknown[];
  try { records = await readFacePersonaRecords(repo, { personaUrl, group }); } catch { return []; }
  return Object.keys(face.project(records, group).edges).map((k) => k.toLowerCase());
}
