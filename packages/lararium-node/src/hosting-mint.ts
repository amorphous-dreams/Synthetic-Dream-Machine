/**
 * hosting-mint — the hearth's ONE session verb for walkers: a walker mints its epoch's allowance BLIND.
 *
 *   walker → hearth  `hosting/mint   {blinded: hex[]}`         on a socket the sorter classed walker
 *   hearth → walker  `hosting/minted {evaluated: hex[], proof}` the POPRF blind evaluation under `walker-invite`
 *
 * WHO IS ANSWERED. A walker socket alone, whose current-epoch grant the sorter answered. Every other socket, every
 * malformed body, a batch larger than the grant's allowance (`allowance`, which vests a walker-minted lineage
 * only at the next roll), and a different batch under a lineage that already minted this epoch: no answer at all.
 *
 * ONE BURN PER LINEAGE PER EPOCH. The hearth burns `mintMarker(lineage, epoch)` keyed to the digest of the batch,
 * fsynced BEFORE it answers. The same batch again is a retry and is evaluated again — the walker lost the first
 * answer and finalized nothing — so refuse-before-destroy holds; a different batch on a burned marker is silence.
 * The marker names no one: the lineage is opaque to a hearth that holds no claim.
 *
 * WHAT THE HEARTH LEARNS: that some walker it hosts minted some number of invites this epoch. The request
 * carries no Nexus (the socket's grant names it), no nonce and no key; the blinded elements are unlinkable to the
 * tokens they become, which is why no who-invited-whom is computable at redemption.
 *
 * Meme: lar:///ha.ka.ba/lararium/mesh/membership-doctrine#/the-invite
 */

import {
  allowance, mintMarker, batchDigest, evaluateWalkerBatch, grantVerifiesAt,
  HOSTING_MINT_SESSION_KIND, HOSTING_MINTED_SESSION_KIND,
} from "@lararium/mesh";
import type { DaemonAuthGate } from "./daemon-auth-gate.js";
import { readHostingState, liveEpochs, spendMintMarker } from "./hosting-store.js";

const POINT_RE = /^[0-9a-f]{64}$/;

/** Serve walkers' blind mints on `gate`'s authenticated sessions. Returns the unsubscribe. */
export function serveHostingMint(
  gate: Pick<DaemonAuthGate, "onSession" | "sendSession" | "getClassForSocket" | "getGrantForSocket">,
  deps: { readonly storageDir: string; readonly leafSeedFor: (nexusAid: string) => Promise<Uint8Array | null> },
): () => void {
  return gate.onSession((socket, msg) => {
    if (msg.kind !== HOSTING_MINT_SESSION_KIND) return;
    void (async () => {
      if (gate.getClassForSocket(socket) !== "walker") return;
      const grant = gate.getGrantForSocket(socket);
      const blinded = (msg.body as { blinded?: unknown } | null)?.blinded;
      if (!grant || !Array.isArray(blinded) || blinded.length === 0 || !blinded.every((b) => typeof b === "string" && POINT_RE.test(b))) return;
      const state = readHostingState(deps.storageDir, grant.nexusAid);
      const seed = state ? await deps.leafSeedFor(grant.nexusAid) : null;
      const live = state && seed ? liveEpochs(state, seed) : null;
      if (!live || !grantVerifiesAt(live.current, grant)) return;
      if (blinded.length > allowance(grant, live.current.act.cap)) return;
      const outcome = await spendMintMarker({
        storageDir: deps.storageDir, nexusAid: grant.nexusAid, epochCid: live.current.cid,
        marker: mintMarker(grant.lineage, live.current.cid), batchDigest: batchDigest(blinded as string[]),
      });
      if (outcome === "spent-other") return;
      gate.sendSession(socket, HOSTING_MINTED_SESSION_KIND, evaluateWalkerBatch(live.current, blinded as string[]));
    })().catch(() => { /* a fault answers nothing, exactly as a refusal does */ });
  });
}
