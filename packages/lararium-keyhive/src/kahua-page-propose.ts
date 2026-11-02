/**
 * kahua-page-propose — the page's hand toward a lift: this device's atom signs ONE `kahua-lift` proposal batch over the
 * drafts its daemon top holds and writes it on the face's intents plane. Digests ride; bodies never leave the device.
 *
 * The daemon never syncs; the proposal reaches the operator's hand through the face's intents plane, pinned to the
 * proposing atom, and the operator's CLI binds the body by digest (`lares kahua lift --proposal <id> --file <body>`).
 * A proposal grants nothing: the lift still reads the lōkahi cap and the operator's grant.
 *
 * Meme: lar:///ha.ka.ba/lares/docs/pono/kahua-memory-stage
 */
import type { CompositeStore, DocHandle, IntentSigner, IntentVerbRegistry, KahuaProposal, LarDoc } from "@lararium/mesh";

export class KahuaProposeRefused extends Error { override name = "KahuaProposeRefused"; }

export interface PageProposeInput {
  readonly group: string;
  readonly atom: IntentSigner;
  /** The face's intents plane as this island holds it; null where no plane resolved. */
  readonly plane: DocHandle<LarDoc> | null;
  /** The daemon wiki's composition: each title's draft reads off the layer above `bags/kahua`. */
  readonly composite: Pick<CompositeStore, "resolveLayered">;
  readonly titles: readonly string[];
  readonly taint?: readonly string[];
  readonly session: string;
  readonly nonce: string;
  readonly verbs: IntentVerbRegistry;
}

export async function proposeDraftsToKahua(input: PageProposeInput): Promise<{ readonly id: string; readonly cid: string; readonly proposals: readonly KahuaProposal[] }> {
  throw new KahuaProposeRefused("kahua-propose: unbuilt");
}
