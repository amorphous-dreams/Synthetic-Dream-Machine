import type { LarTiddlerRecord } from "@lararium/mesh/tiddler-store";
import { storedRecord } from "@lararium/mesh/stored-record";
import { bagStackFromRec } from "@lararium/mesh/bag-stack-from-rec";
import { mutableLarRecord } from "@lararium/mesh/base-doc";
import { recipeUri } from "@lararium/mesh/lar-uris";
import { SYSTEM_BAGS, floorUntrueLibraries, structuralSlots, wikiBagUri } from "@lararium/mesh/wiki-recipe";
import { mkDaemonWikiAlert } from "@lararium/mesh/island-protocol";
import { effectiveRecipeOf, type RecipePlane } from "./recipe-planes.js";
import type { VerbReactor } from "./verb-dispatcher.js";
import { stringArg } from "./handler-args.js";

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
    catalogHandle.change((doc) => { doc.tiddlers[recipeTitle] = storedRecord(updated); });

    // Pono: no live-layer mount. The recipe change syncs; each island mounts the bag
    // when it reconciles its own stack; the bag's residency derives from the islands that reference it.
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
    catalogHandle.change((doc) => { doc.tiddlers[recipeTitle] = storedRecord(updated); });

    // Pono: no live-layer unmount from daemon. The recipe change syncs; each island
    // drops the bag itself (recipe-watch).
    // The alert stays the FALLBACK for islands that sleep through the change.
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
/**
 * `lares wiki true-floor <slug>` — TRUE ONE RECIPE TO THE CANON FLOOR BY PLACE (ruling 2026-11-26-canon-floor-by-place), by hand.
 *
 * The rule rides every derivation (`canonFloorOf`, `floorRecordsFor`): every wiki's floor stacks `lares`, the herm/hearth wiki's
 * stacks `lararium` and `lares`, and no other wiki stacks `lararium` by default. A recipe record written before the ruling may
 * still name `lararium` (or a TW5 docs bag) as a library where the table withholds it, and a library outranks the floor. No boot
 * moves that record: this door drops exactly those libraries (`floorUntrueLibraries`) when a hand asks, and answers a RECEIPT,
 * which the record carries too (`floor-trued-from`: the stack it held before). No recipe lacks `lares`: the floor lays it under
 * every wiki, so the door adds none.
 *
 * Idempotent: a recipe that stacks nothing untrue answers `already-true` and writes nothing.
 */
export function makeTrueFloorReactor(opts: WikiComposeOptions): VerbReactor {
  return async (args) => {
    const slug = stringArg(args, "slug");
    if (!slug) throw new Error("true-floor: the verb takes a slug (`lares wiki true-floor <slug>`)");

    const { recipeTitle, recipeRec, adopt, standsAt } = await recipeToEdit(
      opts, slug, "lares-cli:wiki-true-floor", `recipe not found for "${slug}"`,
    );

    const stack = bagStackFromRec(recipeRec);
    const structural = structuralSlots(slug);
    const dropped = floorUntrueLibraries(slug, stack.filter((uri) => !structural.has(uri)));
    if (dropped.length === 0) {
      return { slug, recipeUri: standsAt.title, recipePlane: standsAt.plane, status: "already-true", dropped: [], stack };
    }

    const nextStack = stack.filter((uri) => !dropped.includes(uri));
    const at = new Date().toISOString();
    const updated: LarTiddlerRecord = {
      tiddler: {
        ...recipeRec.tiddler,
        title: recipeTitle,
        "bag-stack": nextStack.join(" "),
        "floor-trued-from": stack.join(" "),
        "updated-at": at,
      },
      meta: {
        ...(recipeRec.meta ?? {}),
        authority: recipeRec.meta?.authority ?? "lares-cli:wiki-true-floor",
      },
    };
    const catalogHandle = await opts.catalog.handle();
    catalogHandle.change((doc) => { doc.tiddlers[recipeTitle] = storedRecord(updated); });

    opts.post(mkDaemonWikiAlert({ wikiSlug: slug, message: `"${slug}" trued to the canon floor by place (dropped ${dropped.join(", ")}): live islands reconcile; reboot if this notice persists.`, cause: "true-floor" }));

    return {
      slug,
      recipeUri: recipeTitle,
      recipePlane: "catalog" as RecipePlane,
      ...(adopt ? { adopted: true } : {}),
      status: "trued",
      dropped,
      stack: nextStack,
      receipt: { verb: "true-floor", slug, recipe: recipeTitle, at, before: stack, after: nextStack, dropped },
      note: "recipe trued + synced; live islands reconcile via recipe-watch; the record keeps its prior stack under floor-trued-from",
    };
  };
}
