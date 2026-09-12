/**
 * node-share-config — the vessel's ONE share verdict, handed to BOTH of automerge-repo's hooks.
 *
 * automerge-repo 2.6 splits the share decision in two: `announce` (does this repo proactively offer the doc)
 * and `access` (may this peer HAVE the doc when it asks for it by id). A legacy `sharePolicy` fills only the
 * first — `{ announce: policy, access: () => true }` — and the DocSynchronizer answers a peer that REQUESTED
 * the doc with `access && hasRequested → "announce"`. So a policy that denies a peer gates nothing the peer
 * asks for by name, and every `bags/*` plane's id derives from the shared genesis, so a stranger at the
 * cross-operator floor names a private plane without being told it.
 *
 * The vessel's verdict (`selfSlotShareDecision` — same-operator · member · stranger · Kapae'd) is an ACCESS
 * verdict. This hands it to both hooks, so an announce and a request answer alike.
 *
 * Meme: lar:///ha.ka.ba/lararium/node/node-share-config
 */

import type { DocumentId, PeerId } from "@automerge/automerge-repo";

export type NodeSharePolicy = (peerId: PeerId, documentId?: DocumentId) => Promise<boolean>;

export interface NodeShareConfig {
  readonly announce: NodeSharePolicy;
  readonly access:   NodeSharePolicy;
}

/** The one verdict, on both hooks. */
export function nodeShareConfig(policy: NodeSharePolicy): NodeShareConfig {
  return { announce: policy, access: policy };
}
