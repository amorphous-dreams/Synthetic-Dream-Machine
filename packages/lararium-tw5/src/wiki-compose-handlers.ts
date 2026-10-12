import type { LarTiddlerRecord } from "@lararium/mesh";
import {
  bagStackFromRec,
  mutableLarRecord,
  recipeUri,
  SYSTEM_BAGS,
  wikiBagUri,
  mkDaemonResidencyOp,
  mkDaemonWikiAlert,
} from "@lararium/mesh";
import { effectiveRecipeOf, type RecipePlane } from "./recipe-planes.js";
import type { VerbReactor } from "./verb-dispatcher.js";
import { makeRequestId, stringArg } from "./handler-args.js";

/**
 * Read a recipe-verb's {slug, bagUrl} from the structured args — ONE contract for the
 * CLI / MCP AND the DOM path: the DOM summon rides the same `slug` / `bagUrl`
 * args (its `arg-slug` / `arg-bagUrl` fields the reaction-router lifts into the payload).
 */
function recipeArgs(args: Readonly<Record<string, unknown>>): { slug: string; bagUrl: string } {
  return {
    slug:   stringArg(args, "slug"),
    bagUrl: stringArg(args, "bagUrl"),
  };
}
import type { WikiComposeOptions } from "./wiki-handler-options.js";

/** The vessel's recipe for a slug, ready to edit. The effective record may stand in the oracle plane
 *  (a system wiki's default): the edit then writes the vessel's own record into the catalog, the
 *  default's fields beneath it, `composed-from` naming the default. */
async function recipeToEdit(
  opts: WikiComposeOptions, slug: string, authority: string, missing: string,
): Promise<{ recipeTitle: string; recipeRec: LarTiddlerRecord; adopt: boolean; standsAt: { title: string; plane: RecipePlane } }> {
  const effective = await effectiveRecipeOf(slug, opts);
  if (!effective) {
    throw new Error(SYSTEM_BAGS.has(wikiBagUri(slug))
      ? `recipe not found for "${slug}" — the oracle plane carries no default recipe for this system wiki`
      : missing);
  }
  const recipeTitle = recipeUri("catalog", slug);
  if (effective.plane === "catalog") return { recipeTitle, recipeRec: effective.record, adopt: false, standsAt: effective };
  const adopted: LarTiddlerRecord = {
    ...mutableLarRecord(recipeTitle, {}, authority),
    tiddler: { ...effective.record.tiddler, title: recipeTitle, "composed-from": effective.title },
  };
  return { recipeTitle, recipeRec: adopted, adopt: true, standsAt: effective };
}

/**
 * `lares wiki add-bag <slug> <bag-uri> [--at <position>]` — add a bag to
 * the wiki's recipe at runtime.
 *
 * Idempotent: if the bag URL is already in the recipe stack, returns
 * "already-in-stack" without mutation.
 *
 * The bag must already resolve to an Automerge doc the daemon's repo
 * can find. Minting fresh bags is out of scope (`wiki init` or specific
 * mint ceremonies handle that).
 */
export function makeAddBagReactor(opts: WikiComposeOptions): VerbReactor {
  return async (args) => {
    const { slug, bagUrl } = recipeArgs(args);
    if (!slug) throw new Error("args.slug is required");
    if (!bagUrl) throw new Error("args.bagUrl is required (the bag's lar: URI)");

    // The vessel's own recipe lives in catalog (registry) — read + write via the accessor; a system
    // wiki's default (oracle) is adopted into the catalog on the first edit.
    const { recipeTitle, recipeRec, adopt, standsAt } = await recipeToEdit(
      opts, slug, "lares-cli:wiki-add-bag",
      `recipe not found for "${slug}" — run \`lares wiki init ${slug}\` first`,
    );

    const stack = bagStackFromRec(recipeRec);
    if (stack.includes(bagUrl)) {
      return { slug, recipeUri: standsAt.title, recipePlane: standsAt.plane, status: "already-in-stack", bagUrl };
    }

    const nextStack = [...stack, bagUrl];

    const updated: LarTiddlerRecord = {
      tiddler: {
        ...recipeRec.tiddler,
        title: recipeTitle,
        "bag-stack": nextStack.join(" "),
        "updated-at": new Date().toISOString(),
      },
      meta: {
        ...(recipeRec.meta ?? {}),
        authority: recipeRec.meta?.authority ?? "lares-cli:wiki-add-bag",
      },
    };
    const catalogHandle = await opts.catalog.handle();
    catalogHandle.change((doc) => { (doc.tiddlers as Record<string, LarTiddlerRecord>)[recipeTitle] = updated; });

    // Pono: no live-layer mount. The recipe change syncs; each island mounts the bag
    // when it reconciles its own stack. Command main to pin the bag's residency.
    opts.post(mkDaemonResidencyOp({ requestId: makeRequestId("resop"), op: "pin", bagId: bagUrl, reason: `wiki:${slug}` }));
    // Live islands reconcile this via recipe-watch and clear the notice themselves;
    // the alert stays the FALLBACK for islands that sleep through the change.
    opts.post(mkDaemonWikiAlert({ wikiSlug: slug, message: `Bag added to "${slug}" — live islands mount it automatically; reboot if this notice persists.`, cause: "add-bag" }));

    return {
      slug,
      recipeUri: recipeTitle,
      recipePlane: "catalog" as RecipePlane,
      ...(adopt ? { adopted: true } : {}),
      status: "added",
      bagUrl,
      stack: nextStack,
      rebootRequired: false,
      note: "recipe updated + synced; live islands reconcile via recipe-watch (alert seeded as fallback for sleeping islands)",
    };
  };
}

/**
 * `lares wiki remove-bag <slug> <bag-uri>` — remove a bag from the wiki's
 * recipe at runtime.
 *
 * Idempotent: if the bag URL isn't in the recipe stack, returns
 * "not-in-stack" without mutation.
 *
 * Soft remove: the recipe change syncs; live islands drop the layer via
 * recipe-watch (departed titles tombstone, unshadowed records resurface).
 * Operator tabs/state pointing into the removed bag may resolve to nothing.
 */
export function makeRemoveBagReactor(opts: WikiComposeOptions): VerbReactor {
  return async (args) => {
    const { slug, bagUrl } = recipeArgs(args);
    if (!slug) throw new Error("args.slug is required");
    if (!bagUrl) throw new Error("args.bagUrl is required");

    const { recipeTitle, recipeRec, adopt, standsAt } = await recipeToEdit(
      opts, slug, "lares-cli:wiki-remove-bag", `recipe not found for "${slug}"`,
    );

    const stack = bagStackFromRec(recipeRec);
    if (!stack.includes(bagUrl)) {
      return { slug, recipeUri: standsAt.title, recipePlane: standsAt.plane, status: "not-in-stack", bagUrl };
    }

    const nextStack = stack.filter((u) => u !== bagUrl);

    const updated: LarTiddlerRecord = {
      tiddler: {
        ...recipeRec.tiddler,
        title: recipeTitle,
        "bag-stack": nextStack.join(" "),
        "updated-at": new Date().toISOString(),
      },
      meta: {
        ...(recipeRec.meta ?? {}),
        authority: recipeRec.meta?.authority ?? "lares-cli:wiki-remove-bag",
      },
    };
    const catalogHandle = await opts.catalog.handle();
    catalogHandle.change((doc) => { (doc.tiddlers as Record<string, LarTiddlerRecord>)[recipeTitle] = updated; });

    // Pono: no live-layer unmount from daemon. The recipe change syncs; each island
    // drops the bag itself (recipe-watch). Command main to release the bag's pin.
    // The alert stays the FALLBACK for islands that sleep through the change.
    opts.post(mkDaemonResidencyOp({ requestId: makeRequestId("resop"), op: "unpin", bagId: bagUrl }));
    opts.post(mkDaemonWikiAlert({ wikiSlug: slug, message: `Bag removed from "${slug}" — live islands drop it automatically; reboot if this notice persists.`, cause: "remove-bag" }));

    return {
      slug,
      recipeUri: recipeTitle,
      recipePlane: "catalog" as RecipePlane,
      ...(adopt ? { adopted: true } : {}),
      status: "removed",
      bagUrl,
      stack: nextStack,
      rebootRequired: false,
      note: "recipe updated + synced; live islands reconcile via recipe-watch (alert seeded as fallback for sleeping islands)",
    };
  };
}