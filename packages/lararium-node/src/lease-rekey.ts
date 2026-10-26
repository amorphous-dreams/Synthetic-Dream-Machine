/**
 * lease-rekey — a face signs its own advance; a Nexus or realm's charter quorum signs its advance.
 *
 * The NON-RENEWAL half of revocation (lar:///ha.ka.ba/lares/api/pono/convergent-mesh): a grant names a
 * `boundEpoch`; the grant goes cold the moment the resource's lease epoch rolls past it. Rolling the epoch
 * is how a Herm STALES every outstanding grant on a resource at once — the immune keel's RE-KEY tooth at the
 * Herm's own tier. Targeted key-MATERIAL rotation rides keyhive CGKA (`orichalcum-capabilities`), NEVER this
 * lease — the lease stales, it never re-derives a secret.
 *
 * Meme: lar:///ha.ka.ba/lararium/node/lease-rekey
 */

import type { DocHandle } from "@automerge/automerge-repo";
import {
  storedLarRecord, tiddlerText,
  leaseEpochPrefix, leaseEpochSlotUri, rolledLeaseEpoch,
  signedLeaseEpoch, signLeaseAdvance,
  quorumLeaseEpochOnBoard, signQuorumLease, landQuorumLease, quorumLeaseSlotUri, actCid,
  type LarDoc, type HandLineage,
} from "@lararium/mesh";

/** The outcome of one face rekey — the verified epoch read, the epoch written, and the signing writer's slot. */
export interface LeaseRekeyResult {
  /** The resource whose lease rolled. */
  readonly resource: string;
  /** The writer whose OWN slot took the roll (the caller's nym). */
  readonly writer:   string;
  /** The verified face lease epoch read BEFORE the roll. */
  readonly effective: number;
  /** The epoch written into the writer's own slot — always effective + 1. */
  readonly rolled:    number;
  /** The tiddler URI of the writer's own slot. */
  readonly slot:      string;
}

export interface QuorumLeaseRekeyResult {
  readonly resource: string;
  readonly signers: string[];
  readonly effective: number;
  readonly rolled: number;
  readonly slot: string;
}

/** Sign at the charter's head roster and land one content-addressed advance. */
export async function rollQuorumLeaseOnBoard(
  handle: DocHandle<LarDoc>, resource: string,
  input: { readonly lineage: HandLineage; readonly signers: readonly { readonly key: string; readonly sign: (bytes: Uint8Array) => Promise<string> }[] },
): Promise<QuorumLeaseRekeyResult> {
  const effective = quorumLeaseEpochOnBoard(handle.doc(), resource, input.lineage);
  const rolled = rolledLeaseEpoch(effective);
  const act = await signQuorumLease({ resource, epoch: rolled, lineage: input.lineage }, input.signers);
  const slot = quorumLeaseSlotUri(resource, actCid(act.body));
  handle.change((draft) => { landQuorumLease(draft, resource, act); });
  return { resource, signers: input.signers.map((s) => s.key), effective, rolled, slot };
}

/** Roll a PersonaGroup lease after checking every signed per-writer slot. */
export async function rollSignedLeaseEpochOnBoard(
  handle: DocHandle<LarDoc>, resource: string,
  signer: { readonly key: string; readonly sign: (bytes: Uint8Array) => Promise<string> },
  authorize: (writerHex: string) => boolean,
  /** The anchor's floor (`FaceReading.floor`): the roll never reads below what this device accepted. */
  floor: (observed: number) => number = (observed) => observed,
): Promise<LeaseRekeyResult> {
  if (!authorize(signer.key.toLowerCase())) throw new Error("lease-rekey: signer has no PersonaGroup KEL seat");
  const prefix = leaseEpochPrefix(resource);
  const slots = Object.entries(handle.doc()?.tiddlers ?? {})
    .filter(([title]) => title.startsWith(prefix)).map(([, record]) => tiddlerText(record));
  const effective = floor(signedLeaseEpoch(resource, slots, authorize));
  const rolled = rolledLeaseEpoch(effective);
  const slot = leaseEpochSlotUri(resource, signer.key);
  const signed = await signLeaseAdvance({ resource, epoch: rolled }, signer);
  handle.change((doc) => { doc.tiddlers[slot] = storedLarRecord(slot, { text: signed }, "lease-roll"); });
  return { resource, writer: signer.key, effective, rolled, slot };
}
