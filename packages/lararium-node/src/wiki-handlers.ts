/**
 * wiki-handlers — command-tiddler handlers for whole-wiki operations.
 *
 * Reads composite for room oracle tiddlers under
 * `lar:///ha.ka.ba/@lararium/rooms/{slug}`. Each oracle tiddler's `text`
 * field carries the room's Automerge doc URL.
 *
 * E.4 ships the read-only handlers (list, which). E.5+ adds write handlers
 * (init, sync, pin, etc.) when the per-room mint ceremony lands.
 */

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import type { Repo, DocHandle, AutomergeUrl } from "@automerge/automerge-repo";
import {
  type CompositeStore, type LarTiddlerRecord, type ChangeOrigin, type MemeStoreDoc,
  type CatalogDoc, type MutableLarRecord, type BagResidencyManager,
  emptyMemeStoreDoc, ADMIN_BAG_ID, BAG_IDS, roomLarUri, roomDraftLarUri, recipeUri,
  CATALOG_DOC_URI, LARARIUM_DOC_URI, LARES_DOC_URI,
  parseBagStack, AutomergeDocStore,
} from "@lararium/core";
import { repoRoot } from "@lares/lares";
import type { CommandHandler } from "./command-dispatcher.js";

const ROOM_PREFIX = "lar:///ha.ka.ba/@lararium/rooms/";

export interface WikiHandlerOptions {
  readonly composite: CompositeStore;
}

/** Options for handlers that need raw repo access to mint new docs.
 *  operatorDid resolves lazily so the registry can register before the
 *  keyhive bridge has finished booting. */
export interface WikiMintHandlerOptions {
  readonly composite:     CompositeStore;
  readonly repo:          Repo;
  readonly catalogHandle: DocHandle<CatalogDoc>;
  readonly operatorDid:   () => Promise<string> | string;
}

/** Options for whole-wiki residency operations (pin/unpin). */
export interface WikiResidencyOptions {
  readonly composite: CompositeStore;
  readonly residency: BagResidencyManager;
}

/** Options for recipe-composition operations (add-bag / remove-bag).
 *  Combines mint surface (repo + composite) with residency for pin-on-add. */
export interface WikiComposeOptions {
  readonly composite: CompositeStore;
  readonly repo:      Repo;
  readonly residency: BagResidencyManager;
}

/**
 * `lares wiki list` — enumerate rooms registered in the catalog.
 *
 * Walks composite.listVisible(), filters titles matching the room oracle
 * shape, returns each as `{ slug, uri, automergeUrl }`. The Automerge URL
 * comes from the oracle tiddler's `text` field.
 */
export function createListWikisHandler(opts: WikiHandlerOptions): CommandHandler {
  return async () => {
    const titles  = await opts.composite.listVisible();
    const wikis: Array<{ slug: string; uri: string; automergeUrl: string | null }> = [];
    for (const title of titles) {
      if (!title.startsWith(ROOM_PREFIX)) continue;
      // Filter to direct children only — slug has no further `/`.
      const tail = title.slice(ROOM_PREFIX.length);
      if (tail.includes("/")) continue;
      const rec  = await opts.composite.get(title);
      wikis.push({
        slug:         tail,
        uri:          title,
        automergeUrl: typeof rec?.text === "string" ? rec.text : null,
      });
    }
    return { wikis };
  };
}

// ---------------------------------------------------------------------------
// init — mint a new wiki end-to-end
// ---------------------------------------------------------------------------

/**
 * `lares wiki init <slug>` — mint a fresh wiki.
 *
 * Idempotent: if the room oracle tiddler already exists in the catalog,
 * returns the existing URLs without re-minting.
 *
 * Creates:
 *   - canonical bag: a fresh MemeStoreDoc Automerge doc, oracle tiddler
 *     in catalog at title `roomLarUri(slug)`.
 *   - per-wiki draft bag: a fresh MemeStoreDoc, oracle tiddler in catalog
 *     at `${roomLarUri(slug)}/drafts/${operatorDid}`.
 *   - recipe tiddler at `recipeUri("@lararium", slug)` with the default
 *     bag stack: catalog → lararium → lares → corpus children → room
 *     canonical → per-wiki draft.
 */
export function createInitWikiHandler(opts: WikiMintHandlerOptions): CommandHandler {
  return async (args) => {
    const slug = stringArg(args, "slug");
    if (!slug) throw new Error("args.slug is required (the wiki name)");
    if (slug.includes("/") || slug.includes(" ")) {
      throw new Error(`invalid slug: "${slug}" (no slashes or spaces)`);
    }

    const did          = await opts.operatorDid();
    const roomKey      = roomLarUri(slug);
    const draftBagId   = roomDraftLarUri(slug);
    const draftKey     = `${roomKey}/drafts/${encodeURIComponent(did)}`;
    const recipeTitle  = recipeUri("@lararium", slug);

    // Idempotent skip — operator runs init twice, second run reports.
    const existingRoomRec   = await opts.composite.get(roomKey);
    const existingDraftRec  = await opts.composite.get(draftKey);
    const existingRecipeRec = await opts.composite.get(recipeTitle);
    if (existingRoomRec && existingDraftRec && existingRecipeRec) {
      return {
        slug,
        status: "already-exists",
        roomUri:     roomKey,
        roomDocUrl:  existingRoomRec.text ?? null,
        draftBagId,
        draftDocUrl: existingDraftRec.text ?? null,
        recipeUri:   recipeTitle,
      };
    }

    // Mint the docs we need.
    const roomHandle  = existingRoomRec?.text
      ? await opts.repo.find<MemeStoreDoc>(existingRoomRec.text as AutomergeUrl)
      : opts.repo.create<MemeStoreDoc>(emptyMemeStoreDoc());
    const draftHandle = existingDraftRec?.text
      ? await opts.repo.find<MemeStoreDoc>(existingDraftRec.text as AutomergeUrl)
      : opts.repo.create<MemeStoreDoc>(emptyMemeStoreDoc());

    // Wait for handle readiness before writing oracles (avoids URL race).
    if (!existingRoomRec)  await roomHandle.whenReady();
    if (!existingDraftRec) await draftHandle.whenReady();

    // Write catalog oracles. Idempotent — overwrites with same values when
    // the doc already existed.
    opts.catalogHandle.change((doc) => {
      const tiddlers = doc.tiddlers as Record<string, MutableLarRecord>;
      tiddlers[roomKey] = {
        title: roomKey, text: roomHandle.url,
        fields: { bag: BAG_IDS.catalog, authority: "lares-cli:wiki-init" },
      };
      tiddlers[draftKey] = {
        title: draftKey, text: draftHandle.url,
        fields: { bag: BAG_IDS.catalog, authority: "lares-cli:wiki-init" },
      };
    });

    // Write recipe tiddler — lives in the lararium island doc.
    const origin: ChangeOrigin = { kind: "lares-command", requestId: ctx_request_id_safe() };
    const recipe: LarTiddlerRecord = {
      title: recipeTitle,
      bag:   LARARIUM_DOC_URI,
      authority: "lares-cli:wiki-init",
      fields: {
        label:      slug,
        // Default bag stack: lowest priority → highest. Per-wiki draft sits
        // at top so it overlays canonical for the operator's working surface.
        "bag-stack":   `${CATALOG_DOC_URI} ${LARARIUM_DOC_URI} ${LARES_DOC_URI} ${roomKey} ${draftBagId}`,
        "writable-bag": draftBagId,
        "updated-at":   new Date().toISOString(),
      },
    };
    await opts.composite.put(recipe, origin);

    return {
      slug,
      status: existingRoomRec ? "completed-partial" : "minted",
      roomUri:     roomKey,
      roomDocUrl:  roomHandle.url,
      draftBagId,
      draftDocUrl: draftHandle.url,
      recipeUri:   recipeTitle,
    };
  };
}

// ---------------------------------------------------------------------------
// open — switch the daemon's active wiki (write an admin marker; restart-required)
// ---------------------------------------------------------------------------

const ACTIVE_WIKI_URI = `${ADMIN_BAG_ID}/active-wiki`;

/**
 * `lares wiki open <slug>` — set the daemon's active wiki marker.
 *
 * Writes a tiddler at `lar:///ha.ka.ba/@lararium/@admin/active-wiki` whose
 * `text` field carries the slug. The daemon reads this marker at boot and
 * mounts the matching room. Live re-mount lands in E.7 (hot-reload sprint);
 * E.5 minimum requires a daemon restart.
 *
 * Idempotent: setting to the current value returns "no-op".
 */
export function createOpenWikiHandler(opts: WikiHandlerOptions): CommandHandler {
  return async (args) => {
    const slug = stringArg(args, "slug");
    if (!slug) throw new Error("args.slug is required");

    const roomKey = roomLarUri(slug);
    const roomRec = await opts.composite.get(roomKey);
    if (!roomRec) {
      throw new Error(`wiki "${slug}" not registered — run \`lares wiki init ${slug}\` first`);
    }

    const marker = await opts.composite.get(ACTIVE_WIKI_URI);
    if (marker?.text === slug) {
      return { slug, status: "already-active", restartRequired: false };
    }

    const origin: ChangeOrigin = { kind: "lares-command", requestId: ctx_request_id_safe() };
    const record: LarTiddlerRecord = {
      title: ACTIVE_WIKI_URI,
      bag:   ADMIN_BAG_ID,
      authority: "lares-cli:wiki-open",
      text:  slug,
      fields: {
        "updated-at": new Date().toISOString(),
      },
    };
    await opts.composite.put(record, origin);

    return {
      slug,
      status: "marker-set",
      restartRequired: true,
      hint: "restart `lares serve` to mount this wiki as the active room",
    };
  };
}

// ---------------------------------------------------------------------------
// sync — ingest rooms/<slug>/memes/** files into the canonical bag
// ---------------------------------------------------------------------------

/**
 * `lares wiki sync <slug>` — disk → CRDT ingest.
 *
 * Walks `rooms/<slug>/memes/**` for `.md` files. For each file, derives a
 * tiddler title from the iam `uri-path` field (or falls back to a path-
 * based URI). Writes the file's full text as the tiddler's `text` field
 * directly into the wiki's canonical bag's Automerge doc — bypasses the
 * composite-overlay routing because the target wiki may not be the
 * daemon's currently-mounted active room.
 *
 * Idempotent: tiddlers whose existing record matches the file's text get
 * skipped (no-op write). Tiddlers whose URI lacks a record get created.
 *
 * Returns { slug, scanned, ingested, skipped, errors[] }.
 */
export function createSyncWikiHandler(opts: WikiMintHandlerOptions): CommandHandler {
  return async (args) => {
    const slug = stringArg(args, "slug");
    if (!slug) throw new Error("args.slug is required");

    const roomKey = roomLarUri(slug);
    const roomRec = await opts.composite.get(roomKey);
    if (!roomRec || typeof roomRec.text !== "string") {
      throw new Error(`wiki "${slug}" not registered — run \`lares wiki init ${slug}\` first`);
    }
    const roomDocUrl = roomRec.text;

    const memesRoot = join(repoRoot, "rooms", slug, "memes");
    if (!existsSync(memesRoot)) {
      return { slug, scanned: 0, ingested: 0, skipped: 0, errors: [], note: "no rooms/<slug>/memes/ directory" };
    }

    const files: string[] = [];
    walkMemes(memesRoot, files);

    // Open the wiki's canonical Automerge doc directly. This sidesteps the
    // composite-overlay routing — the target wiki may not be the daemon's
    // currently-mounted active room, so composite.put would fall through
    // to the default writable layer (today's altar-fire/draft) instead of
    // landing in the right bag. Direct doc writes go where intended.
    const handle = await opts.repo.find<MemeStoreDoc>(roomDocUrl as AutomergeUrl);
    await handle.whenReady();

    const errors: string[] = [];
    let ingested = 0;
    let skipped  = 0;

    for (const file of files) {
      try {
        const text = readFileSync(file, "utf8");
        const uri  = extractIamUri(text) ?? deriveUriFromPath(slug, memesRoot, file);
        const sourceFile = file.startsWith(repoRoot) ? file.slice(repoRoot.length + 1) : file;
        const syncedAt   = new Date().toISOString();

        // Read current state from the doc directly.
        const docState = handle.doc();
        const existing = (docState?.tiddlers as Record<string, MutableLarRecord> | undefined)?.[uri];
        if (existing && existing.text === text && !existing.deleted) {
          skipped++;
          continue;
        }

        handle.change((doc) => {
          const tiddlers = doc.tiddlers as Record<string, MutableLarRecord>;
          tiddlers[uri] = {
            title: uri,
            text,
            fields: {
              "source-file": sourceFile,
              "synced-at":   syncedAt,
            },
            bag:       roomKey,
            authority: "lares-cli:wiki-sync",
          };
        });
        ingested++;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`${file}: ${msg}`);
      }
    }

    return { slug, scanned: files.length, ingested, skipped, errors };
  };
}

// ---------------------------------------------------------------------------
// pin / unpin — whole-recipe residency operations
// ---------------------------------------------------------------------------

/**
 * `lares wiki pin <slug>` — pin every bag in the wiki's recipe.
 *
 * Reads the recipe tiddler, walks `bag-stack`, calls residency.pin for
 * each bag URI. Reason field encodes "wiki:<slug>:<bagSlot>" so unpin can
 * identify which pins belong to this wiki.
 *
 * Returns { slug, recipeUri, pinned: [{ bagUrl, reason }] }.
 */
export function createPinWikiHandler(opts: WikiResidencyOptions): CommandHandler {
  return async (args) => {
    const slug = stringArg(args, "slug");
    if (!slug) throw new Error("args.slug is required");

    const recipeTitle = recipeUri("@lararium", slug);
    const recipeRec   = await opts.composite.get(recipeTitle);
    if (!recipeRec) {
      throw new Error(`recipe not found for "${slug}" — run \`lares wiki init ${slug}\` first`);
    }

    const fields  = (recipeRec.fields ?? {}) as Record<string, string>;
    const bagStack = parseBagStack(fields["bag-stack"]);
    if (bagStack.length === 0) {
      return { slug, recipeUri: recipeTitle, pinned: [], note: "recipe has no bag-stack" };
    }

    const pinned: Array<{ bagUrl: string; reason: string }> = [];
    for (const bagUrl of bagStack) {
      const reason = `wiki:${slug}`;
      await opts.residency.pin(bagUrl, reason);
      pinned.push({ bagUrl, reason });
    }
    return { slug, recipeUri: recipeTitle, pinned };
  };
}

/**
 * `lares wiki unpin <slug>` — unpin every bag in the wiki's recipe.
 *
 * Walks the recipe's bag-stack and calls residency.unpin for each. Bags
 * that were pinned for OTHER reasons (e.g. boot:catalog from infrastructure
 * pins) lose their pin too — operator should re-pin those manually if they
 * want them back. The pin reason field doesn't gate unpin; it's
 * informational. Future refinement: scope unpin by reason prefix.
 */
export function createUnpinWikiHandler(opts: WikiResidencyOptions): CommandHandler {
  return async (args) => {
    const slug = stringArg(args, "slug");
    if (!slug) throw new Error("args.slug is required");

    const recipeTitle = recipeUri("@lararium", slug);
    const recipeRec   = await opts.composite.get(recipeTitle);
    if (!recipeRec) {
      throw new Error(`recipe not found for "${slug}"`);
    }

    const fields   = (recipeRec.fields ?? {}) as Record<string, string>;
    const bagStack = parseBagStack(fields["bag-stack"]);
    const unpinned: string[] = [];
    for (const bagUrl of bagStack) {
      opts.residency.unpin(bagUrl);
      unpinned.push(bagUrl);
    }
    return { slug, recipeUri: recipeTitle, unpinned };
  };
}

// ---------------------------------------------------------------------------
// add-bag / remove-bag — recipe composition (E.7, hot-reload)
// ---------------------------------------------------------------------------
//
// Hot-reload patterns (research-informed):
//   * Pattern 5 (SQLite refcount) — addLayer/removeLayer respect refcount;
//     the composite already supports both operations natively.
//   * Pattern 3 (MNT_DETACH drain) — remove-bag does not eagerly drop the
//     handle; LRU sweeper handles eventual GC. Title-set delta + StoryList
//     reconciliation lands in F-arc.
//   * Pattern 1 (VS Code per-title delta) — composite emits subscribe
//     events for layer changes today; F-arc adds per-title delta wrapping
//     for the TW5 vm's refresh pipeline.
//
// E.7 minimum: mutate recipe + addLayer/removeLayer at runtime. Auto-pin
// on add (operator just declared the bag relevant). Soft remove on
// remove-bag — bag drops from layer set; residency loses its wiki:<slug>
// pin reference; LRU eventually evicts.

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
export function createAddBagHandler(opts: WikiComposeOptions): CommandHandler {
  return async (args) => {
    const slug   = stringArg(args, "slug");
    const bagUrl = stringArg(args, "bagUrl");
    if (!slug)   throw new Error("args.slug is required");
    if (!bagUrl) throw new Error("args.bagUrl is required (the bag's lar: URI)");

    const recipeTitle = recipeUri("@lararium", slug);
    const recipeRec   = await opts.composite.get(recipeTitle);
    if (!recipeRec) {
      throw new Error(`recipe not found for "${slug}" — run \`lares wiki init ${slug}\` first`);
    }

    const fields  = (recipeRec.fields ?? {}) as Record<string, string>;
    const stack   = parseBagStack(fields["bag-stack"]);
    if (stack.includes(bagUrl)) {
      return { slug, recipeUri: recipeTitle, status: "already-in-stack", bagUrl };
    }

    // Append to the end (highest priority slot — overlays everything below).
    const nextStack = [...stack, bagUrl];

    // Mutate the recipe tiddler.
    const origin: ChangeOrigin = { kind: "lares-command", requestId: ctx_request_id_safe() };
    const updated: LarTiddlerRecord = {
      title:     recipeRec.title,
      bag:       recipeRec.bag ?? LARARIUM_DOC_URI,
      authority: recipeRec.authority ?? "lares-cli:wiki-add-bag",
      ...(recipeRec.text !== undefined && { text: recipeRec.text }),
      fields: {
        ...fields,
        "bag-stack":   nextStack.join(" "),
        "updated-at":  new Date().toISOString(),
      },
    };
    await opts.composite.put(updated, origin);

    // Add the layer to the live composite if not already present.
    let layerAdded = false;
    if (!opts.composite.hasBag(bagUrl)) {
      try {
        // Resolve the Automerge URL via composite read OR direct repo find.
        // The bag URL must already exist as a doc; try discovering its
        // automerge URL via a catalog oracle tiddler at the same URI.
        const oracleRec = await opts.composite.get(bagUrl);
        const docUrl = typeof oracleRec?.text === "string" ? oracleRec.text : null;
        if (docUrl) {
          const handle = await opts.repo.find<MemeStoreDoc>(docUrl as AutomergeUrl);
          await handle.whenReady();
          opts.composite.addLayer({
            bagId:    bagUrl,
            store:    new AutomergeDocStore(handle, bagUrl),
            writable: true,
          });
          layerAdded = true;
        }
      } catch (err) {
        // Layer-add failed; recipe mutation persists. Operator can retry.
        return {
          slug,
          recipeUri: recipeTitle,
          status: "recipe-updated-layer-not-mounted",
          bagUrl,
          stack: nextStack,
          error: err instanceof Error ? err.message : String(err),
        };
      }
    }

    // Auto-pin: operator just declared this bag relevant. Pattern 5.
    await opts.residency.pin(bagUrl, `wiki:${slug}`);

    return {
      slug,
      recipeUri:  recipeTitle,
      status:     layerAdded ? "added" : "added-recipe-only",
      bagUrl,
      stack:      nextStack,
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
 * Soft remove: drops from the composite layer set; unpins residency.
 * Active StoryList reconciliation (Pattern 3 MNT_DETACH drain) lands in
 * F-arc when the TW5 vm refresh pipeline gets touched. For now, operator
 * tabs/state pointing into the removed bag may resolve to nothing —
 * acceptable at hobbyist scale.
 */
export function createRemoveBagHandler(opts: WikiComposeOptions): CommandHandler {
  return async (args) => {
    const slug   = stringArg(args, "slug");
    const bagUrl = stringArg(args, "bagUrl");
    if (!slug)   throw new Error("args.slug is required");
    if (!bagUrl) throw new Error("args.bagUrl is required");

    const recipeTitle = recipeUri("@lararium", slug);
    const recipeRec   = await opts.composite.get(recipeTitle);
    if (!recipeRec) {
      throw new Error(`recipe not found for "${slug}"`);
    }

    const fields = (recipeRec.fields ?? {}) as Record<string, string>;
    const stack  = parseBagStack(fields["bag-stack"]);
    if (!stack.includes(bagUrl)) {
      return { slug, recipeUri: recipeTitle, status: "not-in-stack", bagUrl };
    }

    const nextStack = stack.filter((u) => u !== bagUrl);

    // Mutate the recipe.
    const origin: ChangeOrigin = { kind: "lares-command", requestId: ctx_request_id_safe() };
    const updated: LarTiddlerRecord = {
      title:     recipeRec.title,
      bag:       recipeRec.bag ?? LARARIUM_DOC_URI,
      authority: recipeRec.authority ?? "lares-cli:wiki-remove-bag",
      ...(recipeRec.text !== undefined && { text: recipeRec.text }),
      fields: {
        ...fields,
        "bag-stack":   nextStack.join(" "),
        "updated-at":  new Date().toISOString(),
      },
    };
    await opts.composite.put(updated, origin);

    // Soft remove: composite.removeLayer + residency.unpin. The Automerge
    // doc handle stays in the repo; future re-add reuses it.
    let layerRemoved = false;
    if (opts.composite.hasBag(bagUrl)) {
      opts.composite.removeLayer(bagUrl);
      layerRemoved = true;
    }
    opts.residency.unpin(bagUrl);

    return {
      slug,
      recipeUri:    recipeTitle,
      status:       layerRemoved ? "removed" : "removed-recipe-only",
      bagUrl,
      stack:        nextStack,
    };
  };
}

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

function stringArg(args: Readonly<Record<string, unknown>>, key: string): string {
  const v = args[key];
  return typeof v === "string" ? v : "";
}

function ctx_request_id_safe(): string {
  return `wiki-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function walkMemes(dir: string, out: string[]): void {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      walkMemes(full, out);
    } else if (entry.endsWith(".md")) {
      out.push(full);
    }
  }
}

/**
 * Extract the `uri-path` value from a memetic-wikitext iam toml block.
 * Cheap regex; we don't need full TOML parsing for this single field.
 * Returns the lar:/// URI, or null when no iam block matches.
 */
function extractIamUri(text: string): string | null {
  const iamMatch = text.match(/```toml iam\s*\n([\s\S]*?)\n```/);
  if (!iamMatch) return null;
  const block = iamMatch[1] ?? "";
  const uriPathMatch = block.match(/^uri-path\s*=\s*["']([^"']+)["']/m);
  if (!uriPathMatch) return null;
  return `lar:///${uriPathMatch[1]}`;
}

/**
 * Fallback URI derivation when no iam block declares uri-path. Uses the
 * file's path under rooms/<slug>/memes/ as the URI suffix.
 */
function deriveUriFromPath(slug: string, memesRoot: string, file: string): string {
  const rel = file.slice(memesRoot.length + 1).replace(/\.md$/, "").replace(/\\/g, "/");
  return `${roomLarUri(slug)}/memes/${rel}`;
}
