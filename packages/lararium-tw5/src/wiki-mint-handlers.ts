import type { AutomergeUrl } from "@lararium/mesh";
import type { ChangeOrigin, LarTiddlerRecord } from "@lararium/mesh";
import { catalogViewOf, houseCanonUrl, isFacePrivateSlug, resolveHouseCanon, tiddlerText } from "@lararium/mesh";
import { ACTIVE_WIKI_URI, buildActiveWikiRecord, readActiveWikiSlug } from "./active-wiki.js";
import {
  DAEMON_BAG_ID,
  emptyLarDoc,
  storedLarRecord,
  mkDaemonWikiAlert,
  recipeRecordFields,
  recipeUri,
  SYSTEM_BAGS,
  wikiBagUri,
  wikiSlotUri,
  wikiUri,
} from "@lararium/mesh";
import { effectiveRecipeOf } from "./recipe-planes.js";
import type { VerbReactor } from "./verb-dispatcher.js";
import { makeRequestId, stringArg } from "./handler-args.js";
import type { WikiHandlerOptions, WikiMintHandlerOptions, WikiRetireOptions } from "./wiki-handler-options.js";

// makeListWikisReactor RELOCATED to @lararium/tw5 (worker-data-verbs) — list-wikis now
// runs in every vessel's daemon worker (sovereign-worker, verify-then-delegate gated).

export function makeInitWikiReactor(opts: WikiMintHandlerOptions): VerbReactor {
  return async (args) => {
    const slug = stringArg(args, "slug");
    if (!slug) throw new Error("args.slug is required (the wiki name)");
    if (slug.includes("/") || slug.includes(" ")) {
      throw new Error(`invalid slug: "${slug}" (no slashes or spaces)`);
    }

    // ONE NAME, ONE URI: the nameless stack carries the wiki's name (`wikis/{slug}`), and the canon bag (`bags/{slug}`) stands as one
    // capability in it. The catalog row and the cap rest on the canon bag; the answer names the stack and the canon bag apart.
    const canonBag = wikiBagUri(slug);
    const stackUri = wikiUri(slug);
    // A system wiki's live canon doc rests in the Kahu realm (the vessel's `systemCanonUrl`); its default recipe stands in the oracle.
    if (SYSTEM_BAGS.has(canonBag)) {
      const wikiDocUrl = houseCanonUrl(await resolveHouseCanon<string>(canonBag, { realm: opts.systemCanonUrl, row: () => opts.catalog.urlOf(canonBag) }));
      const defaultRec = opts.oracle ? await opts.oracle.recordOf(recipeUri("oracle", slug)).catch(() => null) : null;
      const effective = wikiDocUrl && defaultRec && defaultRec.meta?.deleted !== true
        ? await effectiveRecipeOf(slug, { catalog: opts.catalog, oracle: opts.oracle })
        : null;
      if (!wikiDocUrl || !effective) {
        throw new Error(`system-bag: "${slug}" names a system bag, and no wiki stands on it`);
      }
      return {
        slug,
        status: "already-exists",
        system: true,
        wikiUri: stackUri,
        canonBag,
        wikiDocUrl,
        recipeUri: effective.title,
        recipePlane: effective.plane,
      };
    }
    const draftBagId = wikiSlotUri(slug, "draft");
    const workingBagId = wikiSlotUri(slug, "working");
    // The user's wiki recipe is REGISTRY data (the user's composition choice) —
    // it lives in the user's catalog registry, NOT the lararium bag (protocol substrate). Read
    // it through the accessor (access≠load), like the wiki oracle. The record spells the SAME
    // cascade the mount lays (`recipeRecordFields` ⇆ `recipeFromRecord`): the floor carries
    // lares and lararium read-only through oracle-floor under every recipe; a user wiki names its
    // own canon and chosen libraries, and `writable-bag` names working.
    const recipeTitle = recipeUri("catalog", slug);

    const existingWikiUrl = await opts.catalog.urlOf(canonBag);
    const existingRecipeRec = await opts.catalog.recordOf(recipeTitle);

    const wikiHandle = existingWikiUrl
      ? await opts.repo.find(existingWikiUrl as AutomergeUrl)
      : opts.repo.create(emptyLarDoc());
    // AT THE VEIL FLOOR the canon document files as the vessel's own before its first byte rests (sealed under the vessel's key).
    if (!existingWikiUrl && opts.veilFloor) await opts.veilFloor.nameCanon(slug, wikiHandle.documentId, wikiHandle.url);
    if (!existingWikiUrl) await wikiHandle.whenReady();

    if (!existingWikiUrl || !existingRecipeRec) {
      // The oracle AND the user recipe land in catalog (registry) — one write.
      const catalogHandle = await opts.catalog.handle();
      const updatedAt = new Date().toISOString();
      catalogHandle.change((doc) => {
        const tiddlers = doc.tiddlers;
        tiddlers[canonBag] = storedLarRecord(canonBag, {
          text: wikiHandle.url,
          kind: "oracle",
          "path-filter": "lar-bag-path[wiki-shadow]",
          // The veil's mark: the vessel itself minted this wiki with no face, so the row rests on the floor's half.
          ...(opts.veilFloor && !existingWikiUrl ? { "face-reach": "vessel-only", "minted-by": opts.veilFloor.mintedBy } : {}),
        }, "lares-cli:wiki-init");
        if (!existingRecipeRec) {
          tiddlers[recipeTitle] = storedLarRecord(recipeTitle, {
            ...recipeRecordFields({ wikiSlug: slug }),
            "updated-at": updatedAt,
          }, "lares-cli:wiki-init");
        }
      });
    }

    // The draft doc resolves through THE ONE resolver — a face binding when the vessel holds a seat,
    // the device floor when not — the same doc the mounts and `meme put --recipe` reach.
    const draft = await opts.resolveDraftDoc(slug);

    // Born-with-its-cap: register each freshly-minted wiki bag's Keyhive Document
    // + delegate admin in the same act as the mint, so the new wiki's canon, working and
    // draft bags hold their cap immediately — no cap-denied window (the elyncia-bag
    // friction's sibling for wiki init). Key on the lar: bag URLs — the strings the
    // cap-gate verifies against; an automerge handle.url names a CONTENT doc, a different object.
    if (!existingWikiUrl) {
      await opts.registerBag?.(canonBag);
      await opts.registerBag?.(workingBagId);
      await opts.registerBag?.(draftBagId);
    }

    return {
      slug,
      status: existingWikiUrl && existingRecipeRec ? "already-exists" : existingWikiUrl ? "completed-partial" : "minted",
      wikiUri: stackUri,
      canonBag,
      wikiDocUrl: wikiHandle.url,
      writableBag: workingBagId,
      draftBagId,
      draftDocUrl: draft.url,
      draftReach: draft.reach,
      recipeUri: recipeTitle,
    };
  };
}

/** A `retire-wiki` refusal, by name: the code leads the message (`<code>: <detail>`), as every verb refusal reads. */
export class WikiRetireRefusal extends Error {
  override readonly name = "WikiRetireRefusal";
  constructor(readonly code: "no-face" | "system-bag" | "wiki-face-private" | "no-such-wiki" | "not-the-owner" | "wiki-not-empty" | "retire-count-moved", detail: string) {
    super(`${code}: ${detail}`);
  }
}

/**
 * RETIRE A WIKI SHELL (`lares wiki retire <slug>`, the owner face's hand, never the AI seat): unmint what one face's
 * `init-wiki` laid over a slug, so the slug mints again cleanly under the face that should hold it.
 *
 * THE OWNER RETIRES. The worn face owns the shell where the vessel's ledger binds the slug's workbench under that face's own
 * cabal of one, or, where no workbench stands yet, where the face's own catalog half holds the canon row. A slug the ledger
 * binds under another face's realm, or a row resting on another half (the floor's veil mint), refuses `not-the-owner`.
 *
 * NOTHING DESTROYS CONTENT BY DEFAULT. A working layer or draft layer that holds a live record refuses `wiki-not-empty`,
 * naming the counts; `force` with `count` set to that very total retires anyway (the typed confirmation), and a total that
 * moved since refuses `retire-count-moved`.
 *
 * WHAT LEAVES: the face's catalog-half rows for the slug (the canon-bag row and the recipe row), the ledger rows binding the
 * workbench to the face's cabal (binding, key Documents, seats), and the face's Keyhive bindings of the shell's working and
 * draft bags. WHAT STAYS: the canon bag's document and every file of it (house canon from the checkout stays canon), and every
 * other face's rows. The answer names each.
 */
export function makeRetireWikiReactor(opts: WikiRetireOptions): VerbReactor {
  return async (args) => {
    const slug = stringArg(args, "slug");
    if (!slug) throw new Error("args.slug is required (the wiki name)");
    const canonBag = wikiBagUri(slug);
    if (SYSTEM_BAGS.has(canonBag)) throw new WikiRetireRefusal("system-bag", `"${slug}" names a system bag; no face minted it, and none retires it`);
    if (isFacePrivateSlug(slug)) throw new WikiRetireRefusal("wiki-face-private", `"${slug}" holds one face's memory (the daemon wiki); it never retires`);
    const recipeTitle = recipeUri("catalog", slug);

    // THE FACE'S OWN HALF: a split catalog names it; a plain catalog (a rig with no split) reads as the face's alone.
    const handle = await opts.catalog.handle();
    const view = catalogViewOf(handle);
    const half = view ? view.faceHandle() : handle;
    if (!half) throw new WikiRetireRefusal("no-face", "no face's catalog half stands here: wear the face that minted the wiki (`lares vault unlock`)");
    const own = (title: string): boolean => Object.hasOwn(half.doc()?.tiddlers ?? {}, title);
    const rows = [canonBag, recipeTitle].filter(own);

    const { bound, own: ownRealm } = await opts.shell.owner(slug);
    if (bound.length > 0 && !bound.includes(ownRealm)) {
      throw new WikiRetireRefusal("not-the-owner", `the workbench of "${slug}" stands under another face's realm on this vessel; wear that face to retire it`);
    }
    if (bound.length === 0 && rows.length === 0) {
      if (handle.doc()?.tiddlers?.[canonBag]) throw new WikiRetireRefusal("not-the-owner", `"${slug}" rests on another half of the catalog (the floor's), not this face's; this face minted no shell of it`);
      throw new WikiRetireRefusal("no-such-wiki", `this face holds no shell of "${slug}": no catalog row and no workbench`);
    }

    const contents = await opts.shell.contents(slug);
    const total = contents.working + contents.draft;
    if (total > 0 && args["force"] !== true) {
      throw new WikiRetireRefusal("wiki-not-empty", `"${slug}" holds ${total} record${total === 1 ? "" : "s"} (working ${contents.working}, draft ${contents.draft}); nothing retired. Carry them out first, or retire with --force --count ${total} to destroy them`);
    }
    if (total > 0 && Number(args["count"]) !== total) {
      throw new WikiRetireRefusal("retire-count-moved", `"${slug}" holds ${total} record${total === 1 ? "" : "s"} (working ${contents.working}, draft ${contents.draft}), and the confirmation named ${args["count"] === undefined ? "no count" : String(args["count"])}; nothing retired`);
    }

    const canonDoc = tiddlerText(half.doc()?.tiddlers?.[canonBag] as never) ?? null;
    if (rows.length > 0) half.change((doc) => { for (const title of rows) delete doc.tiddlers[title]; });
    const { realmId, ledgerRows } = await opts.shell.unbind(slug);
    const keyhiveBindings = await opts.shell.forget([wikiSlotUri(slug, "working"), wikiSlotUri(slug, "draft")]);

    return { slug, status: "retired", catalogRows: rows, ledgerRows, realmId, keyhiveBindings, records: contents, forced: total > 0, kept: { canonBag, canonDoc } };
  };
}

export function makeOpenWikiReactor(opts: WikiHandlerOptions): VerbReactor {
  return async (args) => {
    const slug = stringArg(args, "slug");
    if (!slug) throw new Error("args.slug is required");

    const canonBag = wikiBagUri(slug);
    // Wiki oracle lives in the catalog registry — read via the accessor, not the composite.
    const wikiUrl = await opts.catalog.urlOf(canonBag);
    if (!wikiUrl) {
      throw new Error(`no-such-bag: ${canonBag}`);
    }

    const marker = await opts.composite.get(ACTIVE_WIKI_URI);
    const currentSlug = readActiveWikiSlug(marker);
    if (currentSlug === slug) {
      return { slug, status: "already-active", liveApplied: true };
    }

    const origin: ChangeOrigin = { kind: "lares-verb", requestId: makeRequestId("wiki") };
    const record: LarTiddlerRecord = buildActiveWikiRecord(slug, "lares-cli:wiki-open");
    await opts.composite.put(record, origin, { bag: DAEMON_BAG_ID });

    // Reboot-pending: the active-wiki marker lives in the daemon bag (the running wiki doesn't
    // load it) — the switch only takes effect on next boot. Alert the wiki being
    // switched AWAY from (the one currently live), if any.
    if (currentSlug) {
      opts.post(mkDaemonWikiAlert({ wikiSlug: currentSlug, message: `Active wiki will switch to "${slug}" — reboot to load it.`, cause: "open-wiki" }));
    }

    return {
      slug,
      status: "selected-for-next-boot",
      liveApplied: false,
      rebootRequired: true,
      note: "active wiki marker updated; the current wiki keeps mounted until the next `lares vessel stand --foreground` boot (alert seeded)",
    };
  };
}
