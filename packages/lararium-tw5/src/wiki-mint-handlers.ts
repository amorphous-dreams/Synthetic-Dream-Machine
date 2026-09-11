import type { AutomergeUrl } from "@lararium/mesh";
import type { ChangeOrigin, LarTiddlerRecord } from "@lararium/mesh";
import { ACTIVE_WIKI_URI, buildActiveWikiRecord, readActiveWikiSlug } from "./active-wiki.js";
import {
  DAEMON_BAG_ID,
  LARES_DOC_URI,
  LARARIUM_DOC_URI,
  emptyLarDoc,
  mutableLarRecord,
  mkDaemonWikiAlert,
  recipeRecordFields,
  recipeUri,
  wikiBagUri,
  wikiSlotUri,
} from "@lararium/mesh";
import type { VerbReactor } from "./verb-dispatcher.js";
import { makeRequestId, stringArg } from "./handler-args.js";
import type { WikiHandlerOptions, WikiMintHandlerOptions } from "./wiki-handler-options.js";

// makeListWikisReactor RELOCATED to @lararium/tw5 (worker-data-verbs) — list-wikis now
// runs in every vessel's daemon worker (sovereign-worker, verify-then-delegate gated).

export function makeInitWikiReactor(opts: WikiMintHandlerOptions): VerbReactor {
  return async (args) => {
    const slug = stringArg(args, "slug");
    if (!slug) throw new Error("args.slug is required (the wiki name)");
    if (slug.includes("/") || slug.includes(" ")) {
      throw new Error(`invalid slug: "${slug}" (no slashes or spaces)`);
    }

    const wikiKey = wikiBagUri(slug);            // canon (bags/{slug}); identity rides wikis/{slug}
    const draftBagId = wikiSlotUri(slug, "draft");
    const workingBagId = wikiSlotUri(slug, "working");
    // The user's wiki recipe is REGISTRY data (the user's composition choice) —
    // it lives in the user's catalog registry, NOT the lararium bag (protocol substrate). Read
    // it through the accessor (access≠load), like the wiki oracle. The record spells the SAME
    // cascade the mount lays (`recipeRecordFields` ⇆ `recipeFromRecord`): a user wiki = the oracle
    // floor + the lararium and lares libraries + its own canon; `writable-bag` = working.
    const recipeTitle = recipeUri("catalog", slug);

    const existingWikiUrl = await opts.catalog.urlOf(wikiKey);
    const existingRecipeRec = await opts.catalog.recordOf(recipeTitle);

    const wikiHandle = existingWikiUrl
      ? await opts.repo.find(existingWikiUrl as AutomergeUrl)
      : opts.repo.create(emptyLarDoc());
    if (!existingWikiUrl) await wikiHandle.whenReady();

    if (!existingWikiUrl || !existingRecipeRec) {
      // The oracle AND the user recipe land in catalog (registry) — one write.
      const catalogHandle = await opts.catalog.handle();
      const updatedAt = new Date().toISOString();
      catalogHandle.change((doc) => {
        const tiddlers = doc.tiddlers as Record<string, LarTiddlerRecord>;
        tiddlers[wikiKey] = mutableLarRecord(wikiKey, {
          text: wikiHandle.url,
          kind: "oracle",
          "path-filter": "lar-bag-path[wiki-shadow]",
          "mirror-root": `wikis/${slug}`,
        }, "lares-cli:wiki-init");
        if (!existingRecipeRec) {
          tiddlers[recipeTitle] = mutableLarRecord(recipeTitle, {
            ...recipeRecordFields({ wikiSlug: slug, libraryBags: [LARES_DOC_URI, LARARIUM_DOC_URI] }),
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
      await opts.registerBag?.(wikiKey);
      await opts.registerBag?.(workingBagId);
      await opts.registerBag?.(draftBagId);
    }

    return {
      slug,
      status: existingWikiUrl && existingRecipeRec ? "already-exists" : existingWikiUrl ? "completed-partial" : "minted",
      wikiUri: wikiKey,
      wikiDocUrl: wikiHandle.url,
      writableBag: workingBagId,
      draftBagId,
      draftDocUrl: draft.url,
      draftReach: draft.reach,
      recipeUri: recipeTitle,
    };
  };
}

export function makeOpenWikiReactor(opts: WikiHandlerOptions): VerbReactor {
  return async (args) => {
    const slug = stringArg(args, "slug");
    if (!slug) throw new Error("args.slug is required");

    const wikiKey = wikiBagUri(slug);
    // Wiki oracle lives in the catalog registry — read via the accessor, not the composite.
    const wikiUrl = await opts.catalog.urlOf(wikiKey);
    if (!wikiUrl) {
      throw new Error(`wiki "${slug}" not registered — run \`lares wiki init ${slug}\` first`);
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