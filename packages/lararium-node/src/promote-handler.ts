/**
 * promote-handler — canon-promotion ceremony as a command-tiddler handler.
 *
 * Promotion moves a tiddler from a source bag to a target bag inside the
 * room's composite store. The disk side effect (file move from
 * `rooms/{slug}/...` to canonical `packages/...`) falls out automatically
 * via LarDiskProjector + BagMirrorConfig routing — the projector watches
 * record.bag changes and re-renders both source and target carriers.
 *
 * The git diff after a successful promotion is the operator's signature
 * on canon: room files shrink, canonical files appear, ceremony lands in
 * the audit log.
 *
 * Args shape (from the command-tiddler `args` JSON):
 *   tiddler:   string  — the lar: URI to promote
 *   toBag:     string  — target bag id
 *   fromBag?:  string  — optional explicit source; refuses if mismatch with record.bag
 *
 * Capability gate: today the gate is "operator runs the node" implicitly.
 * When S7 device delegations land, ctx.cap will carry the proof and the
 * handler should verifyCapability("promote", toBag) before any write.
 *
 * Forward note (federated promotion):
 *   The eventual shape is: promotion can be invoked from ANY Room VM by ANY
 *   user/operator — gated by UCAN-style capability proofs against the bags
 *   they own or have been delegated `promote` permission on. The handler
 *   should keep its dispatch path bag-aware and capability-checked rather
 *   than hardcoding "operator owns everything". When that lands, the
 *   composite reference here generalizes to "the requesting peer's
 *   composite + their cap chain", and the gate moves from implicit
 *   operator-runs-the-node to an explicit OrichalcumCapability check
 *   (see causal-island.ts ABILITY_LADDER, where "promote" already lives).
 *
 * Architecture laws preserved:
 *   - TW5 vm primacy: this handler ALSO works as a target for a future
 *     <$lar-promote> action-widget — the widget would write the same
 *     command-tiddler the CLI does, and this handler would dispatch.
 *     The handler is intentionally widget-agnostic.
 *   - Web2 smell test: pure CRDT mutation; no network calls.
 */

import type { CompositeStore, ChangeOrigin, LarTiddlerRecord } from "@lararium/core";
import type { CommandHandler } from "./command-dispatcher.js";

export interface PromoteHandlerOptions {
  /** Composite store that owns the promotable bags (the room VM's composite). */
  readonly composite: CompositeStore;
}

export function createPromoteHandler(opts: PromoteHandlerOptions): CommandHandler {
  return async (args, ctx) => {
    const tiddler   = stringArg(args, "tiddler");
    const toBag     = stringArg(args, "toBag");
    const fromBagOpt = optionalStringArg(args, "fromBag");

    if (!tiddler) throw new Error('args.tiddler is required (lar: URI of the tiddler to promote)');
    if (!toBag)   throw new Error('args.toBag is required (target bag id)');

    const composite = opts.composite;

    // 1. Read source record. Composite reads fan across layers; the result's
    //    `bag` field tells us where the tiddler currently lives.
    const record = await composite.get(tiddler);
    if (!record) {
      throw new Error(`tiddler not found: ${tiddler}`);
    }

    const actualFromBag = record.bag;
    if (!actualFromBag) {
      throw new Error(`source record has no bag field — cannot promote: ${tiddler}`);
    }

    // 2. Strict source check (operator-chosen edge case): if the caller named
    //    a fromBag, refuse the promotion when it doesn't match where the
    //    tiddler actually lives. Avoids silent surprises.
    if (fromBagOpt && fromBagOpt !== actualFromBag) {
      throw new Error(
        `source mismatch: args.fromBag=${fromBagOpt}, but tiddler lives in ${actualFromBag}`,
      );
    }

    if (actualFromBag === toBag) {
      throw new Error(`target equals source: tiddler already lives in ${toBag}`);
    }

    if (!composite.hasWritableBag(toBag)) {
      throw new Error(`target bag is not writable in this composite: ${toBag}`);
    }
    if (!composite.hasWritableBag(actualFromBag)) {
      throw new Error(`source bag is not writable in this composite: ${actualFromBag}`);
    }

    const origin: ChangeOrigin = { kind: "lares-command", requestId: ctx.command.requestId };

    // 3. Write the target copy. Composite routes by record.bag → target layer.
    const promoted: LarTiddlerRecord = {
      title:     record.title,
      bag:       toBag,
      authority: record.authority ?? "lares-promote",
      fields:    { ...record.fields },
      ...(record.text !== undefined && { text: record.text }),
    };
    await composite.put(promoted, origin);

    // 4. Tombstone the source-bag entry. Uses the bag-targeted variant so we
    //    delete from the actual source layer, not the default writable.
    await composite.tombstoneInBag(actualFromBag, tiddler, origin);

    return {
      tiddler,
      promotedFrom: actualFromBag,
      promotedTo:   toBag,
      promotedAt:   new Date().toISOString(),
    };
  };
}

function stringArg(args: Readonly<Record<string, unknown>>, key: string): string {
  const v = args[key];
  return typeof v === "string" ? v : "";
}

function optionalStringArg(args: Readonly<Record<string, unknown>>, key: string): string | null {
  const v = args[key];
  return typeof v === "string" && v.length > 0 ? v : null;
}
