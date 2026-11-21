/**
 * verb-summons — CRDT verb-summons tiddler → volatile local invocation relay.
 *
 * A verb-summons tiddler rests at bags/control/summons/<id> in the vessel's control document
 * (`control-home`). The daemon island's control-store subscriber calls
 * heedSummons on every change; this translates a summons tiddler into
 * a volatile local invocation and tombstones the summons in every writable layer holding it.
 * The summons names edge transport — a peer calling another peer to act; the
 * Agent↔Operator HUD/legibility frame uses a separate signal surface.
 * The volatile invocation tiddler holds the durable coordination the dispatcher watches.
 *
 * Isomorphic: no Node or browser platform APIs. Runs in any sovereign Worker.
 *
 * Meme: lar:///ha.ka.ba/lararium/tw5/verb-summons
 */

import type { ChangeOrigin, CompositeStore, LarTiddlerChange } from "@lararium/mesh";
import { CONTROL_HOME_ID, NoWorkingLayerRefusal, SUMMONS_URI_PREFIX, parseVerb } from "@lararium/mesh";
import type { VerbPlacement } from "./verb-vm.js";

export type SummonsRequest = VerbPlacement;

export interface SummonsRelayOptions {
  /** The vessel's control document as a store (`controlStoreOf`): where a summons rests and where its tombstone lands. */
  readonly control:     CompositeStore;
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
  if (change.origin.kind === "lares-verb") return;

  const invocation = parseVerb(change.record.tiddler as Record<string, unknown>);
  if (!invocation || invocation.status !== "pending") return;
  if (opts.isInFlight(invocation.requestId)) return;
  if (opts.seenRequestIds?.has(invocation.requestId)) return;
  opts.seenRequestIds?.add(invocation.requestId);

  try {
    const origin: ChangeOrigin = { kind: "lares-verb", requestId: invocation.requestId };
    const title = change.record.tiddler.title;
    // Consuming a summons needs the control document standing; without it the relay refuses by name.
    if (!opts.control.hasWritableBag(CONTROL_HOME_ID)) throw new NoWorkingLayerRefusal("Consuming a summons", "Stand the vessel's control document, then place the summons again.");
    // The tombstone lands in each layer that holds the record, so no live copy survives beneath it.
    for (const bagId of await opts.control.listBagsHolding(title)) await opts.control.tombstoneInBag(bagId, title, origin);
    opts.placeVerb({
      verb:        invocation.action,
      args:        invocation.args as Record<string, unknown>,
      requestedBy: invocation.requestedBy,
      targets:     [...invocation.targets],
      batchMode:   invocation.batchMode,
      requestId:   invocation.requestId,
      ...(invocation.fromUri    !== undefined && { fromUri:    invocation.fromUri }),
      ...(invocation.listenable !== undefined && { listenable: invocation.listenable }),
    });
  } catch (cause) {
    opts.seenRequestIds?.delete(invocation.requestId);
    throw cause;
  }
}
