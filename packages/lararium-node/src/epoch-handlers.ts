/**
 * epoch-handlers — DXOS-style snapshot-restart on a bag.
 *
 * The only local-first CRDT mechanism that actually bounds history. Mints
 * a NEW Automerge doc with the source bag's current materialized tiddlers
 * (no history); updates catalog oracle + composite layer to point at the
 * new doc; old doc remains in the repo (operator prunes later via OS-level
 * means or future GC sprint).
 *
 * Lossy by design. Pre-Epoch peers that haven't synced through cannot
 * reconstruct the change graph from the new doc alone — they'd need the
 * old doc URL to recover. Acceptable at hobbyist scale per operator's
 * named version-bump-with-migration policy.
 *
 * Cassandra-derived rule honored: tombstones (records with deleted=true)
 * survive the Epoch. They migrate as first-class state, not history. A
 * tiddler deleted in bag-H to unshadow bag-L's copy must persist after
 * the Epoch or the deletion gets lost on restart.
 */

import type { Repo, AutomergeUrl } from "@automerge/automerge-repo";
import {
  type CompositeStore, type ChangeOrigin,
  type CatalogDoc, type MemeStoreDoc, type MutableLarRecord,
  type BagResidencyManager,
  emptyMemeStoreDoc, AutomergeDocStore,
} from "@lararium/core";
import type { CommandHandler } from "./command-dispatcher.js";

export interface EpochHandlerOptions {
  readonly composite: CompositeStore;
  readonly repo:      Repo;
  readonly residency: BagResidencyManager;
  /** Catalog handle — needed to update the oracle tiddler that points at
   *  the bag's Automerge doc URL. */
  readonly catalogHandle: import("@automerge/automerge-repo").DocHandle<CatalogDoc>;
}

/**
 * `lares bag epoch <bag-url>` — snapshot-restart a single bag.
 *
 * Steps:
 *   1. Resolve old Automerge URL via composite read of the bag oracle.
 *   2. Open old doc; read all tiddlers (including tombstones).
 *   3. Mint new MemeStoreDoc with the materialized tiddler set.
 *   4. Update the catalog oracle tiddler's text to the new doc URL.
 *   5. Swap composite layer: removeLayer(old) + addLayer(new).
 *   6. Re-pin residency if the old bag was pinned.
 *
 * Returns { bagUrl, oldDocUrl, newDocUrl, tiddlerCount, tombstoneCount }.
 */
export function createEpochBagHandler(opts: EpochHandlerOptions): CommandHandler {
  return async (args) => {
    const bagUrl = stringArg(args, "bagUrl");
    if (!bagUrl) throw new Error("args.bagUrl is required");

    // Find the oracle for the bag — looks for a tiddler whose title equals
    // the bag URL with `text` carrying the Automerge URL.
    const oracleRec = await opts.composite.get(bagUrl);
    const oldDocUrl = typeof oracleRec?.text === "string" ? oracleRec.text : null;
    if (!oldDocUrl) {
      throw new Error(`bag has no oracle: ${bagUrl}`);
    }

    // Open the old doc; enumerate every tiddler, tombstones included.
    const oldHandle = await opts.repo.find<MemeStoreDoc>(oldDocUrl as AutomergeUrl);
    await oldHandle.whenReady();
    const oldDoc   = oldHandle.doc();
    const oldEntry = (oldDoc?.tiddlers ?? {}) as Record<string, MutableLarRecord>;

    let tiddlerCount   = 0;
    let tombstoneCount = 0;

    // Mint a fresh doc and populate it with the materialized state.
    const newHandle = opts.repo.create<MemeStoreDoc>(emptyMemeStoreDoc());
    await newHandle.whenReady();
    newHandle.change((doc) => {
      const target = doc.tiddlers as Record<string, MutableLarRecord>;
      for (const [title, rec] of Object.entries(oldEntry)) {
        // Honor the Cassandra rule: tombstones survive Epochs as first-class
        // state. Carry deleted flag forward unchanged.
        target[title] = { ...rec };
        if (rec.deleted) tombstoneCount++;
        else             tiddlerCount++;
      }
    });

    // Update the catalog oracle tiddler. Direct catalog change — same
    // pattern as wiki-init's oracle write.
    opts.catalogHandle.change((doc) => {
      const tiddlers = doc.tiddlers as Record<string, MutableLarRecord>;
      const existing = tiddlers[bagUrl];
      tiddlers[bagUrl] = {
        title: bagUrl,
        text:  newHandle.url,
        fields: {
          ...((existing?.fields as Record<string, string> | undefined) ?? {}),
          "epoch-at":      new Date().toISOString(),
          "epoch-prev":    oldDocUrl,
        },
        bag:       existing?.bag       ?? "lar:///ha.ka.ba/@catalog",
        authority: existing?.authority ?? "lares-cli:bag-epoch",
      };
    });

    // Swap composite layer if the bag was mounted.
    let layerSwapped = false;
    if (opts.composite.hasBag(bagUrl)) {
      opts.composite.removeLayer(bagUrl);
      const writable = true;
      opts.composite.addLayer({
        bagId:    bagUrl,
        store:    new AutomergeDocStore(newHandle, bagUrl),
        writable,
      });
      layerSwapped = true;
    }

    // Re-pin if pinned (residency.pin is idempotent + name-keyed by URL,
    // and URL stays the same — composite-bagId, not Automerge-doc-URL).
    if (opts.residency.tier(bagUrl) === "pinned") {
      await opts.residency.pin(bagUrl, `epoch-rebound`);
    }

    return {
      bagUrl,
      oldDocUrl,
      newDocUrl:    newHandle.url,
      tiddlerCount,
      tombstoneCount,
      layerSwapped,
      note: "old doc retained in repo; prune via OS-level means or future GC",
    };
  };
}

function stringArg(args: Readonly<Record<string, unknown>>, key: string): string {
  const v = args[key];
  return typeof v === "string" ? v : "";
}

// Origin tag used by Epoch — reserved for future audit-log integration.
export const EPOCH_ORIGIN: ChangeOrigin = { kind: "lares-command", requestId: "epoch" };
