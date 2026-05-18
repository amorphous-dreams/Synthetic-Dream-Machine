/**
 * promote-handler — thin Node wrapper around the TW5-native promote ceremony.
 *
 * Node still owns capability checks and command dispatch. The actual bag/file-path
 * mutation runs inside the primary TW5 wiki engine so the ceremony stays quine-law
 * local to the wiki VM.
 */

import type { CompositeStore } from "@lararium/mesh";
import type { LarTiddlerStore } from "@lararium/types";
import { IslandAdaptor, planPromoteUris, type PromoteWiki, type TW5Engine } from "@lararium/tw5";
import type { CommandHandler } from "./command-dispatcher.js";

export interface PromoteHandlerOptions {
  readonly composite: CompositeStore;
  readonly getPrimaryEngine: () => TW5Engine;
  readonly getMirrorLookupWiki: () => PromoteWiki;
}

export function createPromoteHandler(opts: PromoteHandlerOptions): CommandHandler {
  return async (args, ctx) => {
    const tiddler = stringArg(args, "tiddler");
    const toBag = stringArg(args, "toBag");
    const fromBagOpt = optionalStringArg(args, "fromBag");

    if (!tiddler) {
      throw new Error("args.tiddler is required (lar: URI of the tiddler to promote)");
    }
    if (!toBag) {
      throw new Error("args.toBag is required (target bag id)");
    }

    const proof = await ctx.cap("admin", toBag);
    if (!proof.ok) {
      throw new Error(`cap-denied: admin on ${toBag} required (${proof.reason ?? "no reason"})`);
    }

    const liveBags = await opts.composite.listBagsHolding(tiddler);
    if (liveBags.length === 0) {
      throw new Error(`tiddler not found in any live bag: ${tiddler}`);
    }

    const fallbackFromBag = liveBags[0];
    if (!fallbackFromBag) {
      throw new Error(`tiddler not found in any live bag: ${tiddler}`);
    }

    const actualFromBag = fromBagOpt && liveBags.includes(fromBagOpt)
      ? fromBagOpt
      : fallbackFromBag;

    if (fromBagOpt && !liveBags.includes(fromBagOpt)) {
      throw new Error(
        `source mismatch: args.fromBag=${fromBagOpt} doesn't hold a live record for ${tiddler}; live bags: ${liveBags.join(", ")}`,
      );
    }
    if (actualFromBag === toBag) {
      throw new Error(`target equals source: tiddler already lives in ${toBag}`);
    }
    if (!opts.composite.hasWritableBag(toBag)) {
      throw new Error(`target bag is not writable in this composite: ${toBag}`);
    }
    if (!opts.composite.hasWritableBag(actualFromBag)) {
      throw new Error(`source bag is not writable in this composite: ${actualFromBag}`);
    }

    const vm = opts.getPrimaryEngine();
    const result = planPromoteUris(vm.wiki, [tiddler], toBag, opts.getMirrorLookupWiki());

    if (result.error) {
      throw new Error(result.error);
    }
    if (!result.promoted.includes(tiddler)) {
      throw new Error(`tw5 promote did not produce a target copy for ${tiddler}`);
    }

    const sourceAdaptor = new IslandAdaptor(
      vm,
      targetCompositeBagStore(opts.composite, actualFromBag),
      `promote-source:${ctx.command.requestId}`,
      actualFromBag,
    );
    const targetAdaptor = new IslandAdaptor(
      vm,
      targetCompositeBagStore(opts.composite, toBag),
      `promote-target:${ctx.command.requestId}`,
      toBag,
    );

    for (const copy of result.copies) {
      await saveViaTw5Adaptor(targetAdaptor, flattenPromoteFields(copy.fields));
    }
    for (const title of result.tombstones) {
      await deleteViaTw5Adaptor(sourceAdaptor, title);
    }

    return {
      tiddler,
      promotedFrom: actualFromBag,
      promotedTo: result.promotedTo,
      promotedAt: result.promotedAt,
      childrenPromoted: result.childrenPromoted,
      skipped: result.skipped,
    };
  };
}

function stringArg(args: Readonly<Record<string, unknown>>, key: string): string {
  const value = args[key];
  return typeof value === "string" ? value : "";
}

function optionalStringArg(args: Readonly<Record<string, unknown>>, key: string): string | null {
  const value = args[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}

function targetCompositeBagStore(
  composite: CompositeStore,
  bagId:     string,
): LarTiddlerStore {
  return {
    listVisible: () => composite.listVisible(),
    get:         (title) => composite.getLive(title),
    put:         (record, origin) => composite.put({ ...record, bag: bagId }, origin),
    tombstone:   (title, origin) => composite.tombstoneInBag(bagId, title, origin),
    subscribe:   (fn) => composite.subscribe(fn),
    addProjection: (p) => composite.addProjection(p),
  };
}

function flattenPromoteFields(fields: Record<string, string | string[]>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(fields)) {
    out[key] = Array.isArray(value) ? value.join(" ") : String(value);
  }
  return out;
}

function saveViaTw5Adaptor(
  adaptor: IslandAdaptor,
  fields:  Record<string, string>,
): Promise<void> {
  return new Promise((resolve, reject) => {
    adaptor.saveTiddler({ fields }, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

function deleteViaTw5Adaptor(
  adaptor: IslandAdaptor,
  title:   string,
): Promise<void> {
  return new Promise((resolve, reject) => {
    adaptor.deleteTiddler(title, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}