/**
 * Relay a durable summons from vessel work into the daemon VM's local invocation.
 * The work snapshot retains the summons until the act's compact verdict replaces it
 * in the same write family. Restart replays a pending summons through the dispatcher,
 * which reads any existing claim or verdict before invoking its handler.
 */

import type { LarTiddlerChange } from "@lararium/mesh/tiddler-store";
import type { CompositeStore } from "@lararium/mesh/composite-store";
import { VESSEL_WORK_ID } from "@lararium/mesh/lar-uris";
import { NoWorkingLayerRefusal } from "@lararium/mesh/composite-store";
import { SUMMONS_URI_PREFIX, parseVerb } from "@lararium/mesh/verb-tiddler";
import type { VerbPlacement } from "./verb-vm.js";

export type SummonsRequest = VerbPlacement;

export interface SummonsRelayOptions {
  /** The vessel's work snapshot as a store (`workStoreOf`): where a summons rests and where its tombstone lands. */
  readonly state:     CompositeStore;
  readonly isInFlight:  (requestId: string) => boolean;
  /** Request ids already heeded by this relay; a replay scan and live delivery share it so each fires once. */
  readonly seenRequestIds?: Set<string>;
  readonly placeVerb:   (invocation: SummonsRequest) => void;
}

export async function heedSummons(
  change: LarTiddlerChange,
  opts: SummonsRelayOptions,
): Promise<void> {
  if (!change.record) return;
  if (!change.record.tiddler.title.startsWith(SUMMONS_URI_PREFIX)) return;

  const invocation = parseVerb(change.record.tiddler as Record<string, unknown>);
  if (!invocation || invocation.status !== "pending") return;
  if (opts.isInFlight(invocation.requestId)) return;
  if (opts.seenRequestIds?.has(invocation.requestId)) return;
  opts.seenRequestIds?.add(invocation.requestId);

  try {
    // Consuming a summons needs the work snapshot standing; without it the relay refuses by name.
    if (!opts.state.hasWritableBag(VESSEL_WORK_ID)) throw new NoWorkingLayerRefusal("Consuming a summons", "Stand the vessel's work snapshot, then place the summons again.");
    opts.placeVerb({
      verb:        invocation.action,
      args:        invocation.args as Record<string, unknown>,
      requestedBy: invocation.requestedBy,
      targets:     [...invocation.targets],
      batchMode:   invocation.batchMode,
      ...(invocation.effectKey !== undefined && { effectKey: invocation.effectKey }),
      ...(invocation.face !== undefined && { face: invocation.face }),
      requestId:   invocation.requestId,
      ...(invocation.fromUri    !== undefined && { fromUri:    invocation.fromUri }),
      ...(invocation.listenable !== undefined && { listenable: invocation.listenable }),
    });
  } catch (cause) {
    opts.seenRequestIds?.delete(invocation.requestId);
    throw cause;
  }
}
