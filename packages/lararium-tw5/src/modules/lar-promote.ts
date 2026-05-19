/*\
title: lar:///ha.ka.ba/@lararium/tw5/modules/lar-promote
type: application/javascript
module-type: library
\*/
// @heleuma:required
/**
 * lar-promote — wiki-internal bag promotion library.
 *
 * Runs inside a TW5 wiki VM. The wiki's recipe stack surfaces oracle tiddlers
 * (kind="oracle") from the @lararium bag; each oracle tiddler's title is the
 * bag's lar: URI and carries `path-filter` + `mirror-root` fields so this
 * module can compute the correct `file-path` entirely inside the wiki layer.
 *
 * module-type: library  →  require()able by widgets and actions.
 *
 * Meme: lar:///ha.ka.ba/@lararium/tw5/modules/lar-promote
 *
 * Design invariants:
 *   - Oracle tiddler title = bag URI (e.g. "lar:///ha.ka.ba/@lares").
 *   - `path-filter` field = TW5 filter operator string (e.g. "lar-bag-path[lares]").
 *   - `mirror-root` field = repo-relative path (e.g. "bags/@lares").
 *   - file-path = mirror-root + "/" + relPath  (pure string concat, no path.join).
 *   - Promote = write target bag copy first, tombstone wiki-bag copy second.
 *   - Tombstone routes to the default writable bag (wiki bag) via IslandAdaptor.
 *   - The @lares copy surfaces through the recipe stack once the wiki-bag copy
 *     is removed (wiki bag has HIGHER priority than @lares in recipe order).
 *
 * No external imports — self-contained, runs in browser + Node TW5 VM.
 */

/** Minimal TW5 wiki surface this module requires. */
export interface PromoteWiki {
  getTiddler(title: string): { fields: Record<string, string | string[]> } | undefined | null;
  filterTiddlers(filter: string): string[];
  addTiddler(tiddler: unknown): void;
  deleteTiddler(title: string): void;
}

export interface PromotePlannedRecord {
  title: string;
  fields: Record<string, string | string[]>;
}

export interface PromoteResult {
  promoted: string[];
  skipped:  string[];
  childrenPromoted: string[];
  promotedTo: string;
  promotedAt: string;
  error?:   string;
}

export interface PromotePlan extends PromoteResult {
  copies: PromotePlannedRecord[];
  tombstones: string[];
}

const BAG_MIRROR_TAG = "lar:///ha.ka.ba/tags/lararium-bag-mirror";
const LARES_BAG_ID = "lar:///ha.ka.ba/@lares";
const LARARIUM_BAG_ID = "lar:///ha.ka.ba/@lararium";
const URI_PREFIX = "lar:///ha.ka.ba/";

function uniquePush(seen: Set<string>, target: string[], value: string): void {
  if (seen.has(value)) return;
  seen.add(value);
  target.push(value);
}

function expandPromotionUris(wiki: PromoteWiki, uris: readonly string[]): {
  ordered: string[];
  children: string[];
} {
  const ordered: string[] = [];
  const children: string[] = [];
  const seen = new Set<string>();

  for (const uri of uris) {
    uniquePush(seen, ordered, uri);
    const childPrefix = `${uri}#`;
    for (const child of wiki.filterTiddlers(`[prefix[${childPrefix}]]`)) {
      if (seen.has(child)) continue;
      seen.add(child);
      ordered.push(child);
      children.push(child);
    }
  }

  return { ordered, children };
}

function resolveOracle(lookupWiki: PromoteWiki, targetBagId: string): { fields: Record<string, string | string[]> } | undefined | null {
  if (targetBagId === LARES_BAG_ID) {
    return { fields: { title: targetBagId, "path-filter": "lar-bag-path[lares]", "mirror-root": "bags/@lares" } };
  }
  if (targetBagId === LARARIUM_BAG_ID) {
    return { fields: { title: targetBagId, "path-filter": "lar-bag-path[engine]", "mirror-root": "bags/@lararium" } };
  }

  const direct = lookupWiki.getTiddler(targetBagId);
  if (direct) return direct;

  const mirrorConfigTitle = lookupWiki.filterTiddlers(
    `[tag[${BAG_MIRROR_TAG}]field:bag-id[${targetBagId}]]`,
  )[0];
  return mirrorConfigTitle ? lookupWiki.getTiddler(mirrorConfigTitle) : undefined;
}

function splitHash(uri: string): [string, string | null] {
  const index = uri.indexOf("#");
  return index >= 0 ? [uri.slice(0, index), uri.slice(index + 1)] : [uri, null];
}

function stripMd(value: string): string {
  return value.endsWith(".md") ? value.slice(0, -3) : value;
}

function canonicalRelPath(uri: string, targetBagId: string): string | null {
  if (!uri.startsWith(URI_PREFIX)) return null;

  const [baseUri, fragment] = splitHash(uri.slice(URI_PREFIX.length));
  let base = stripMd(baseUri);
  if (!base) return null;

  if (targetBagId === LARES_BAG_ID) {
    if (base.startsWith("@lararium/")) return null;
    if (base.startsWith("@lares/")) base = base.slice("@lares/".length);
    else if (base.startsWith("@")) return null;
  } else if (targetBagId === LARARIUM_BAG_ID) {
    if (!base.startsWith("@lararium/")) return null;
    base = base.slice("@lararium/".length);
  } else {
    return null;
  }

  return fragment ? `${base}/${fragment}.md` : `${base}.md`;
}

function resolveRelPath(wiki: PromoteWiki, uri: string, targetBagId: string, pathFilter: string): string | null {
  const canonical = canonicalRelPath(uri, targetBagId);
  if (canonical) return canonical;

  const filterExpr = "[title[" + uri + "]" + pathFilter + "]";
  const relPaths = wiki.filterTiddlers(filterExpr);
  return relPaths && relPaths.length > 0 ? relPaths[0] ?? null : null;
}

/**
 * promoteUris — move tiddlers from the wiki bag into a canon bag.
 *
 * For each URI in `uris`:
 *   1. Read the target bag's oracle tiddler (title = targetBagId).
 *   2. Evaluate oracle's `path-filter` over [uri] to get the mirror-relative path.
 *   3. Set `bag` and `file-path` on the tiddler; write via wiki.addTiddler().
 *   4. Tombstone the wiki-bag copy via wiki.deleteTiddler() so @lares surfaces.
 *
 * @param tw     — the TW5 root object (provides Tiddler constructor)
 * @param wiki   — the TW5 wiki object ($tw.wiki)
 * @param uris   — lar: URIs to promote
 * @param targetBagId — e.g. "lar:///ha.ka.ba/@lares"
 */
export function promoteUris(
  tw:          { Tiddler: new (...args: unknown[]) => unknown },
  wiki:        PromoteWiki,
  uris:        string[],
  targetBagId: string,
  lookupWiki:  PromoteWiki = wiki,
): PromoteResult {
  const plan = planPromoteUris(wiki, uris, targetBagId, lookupWiki);
  if (plan.error) {
    return plan;
  }

  for (const copy of plan.copies) {
    wiki.addTiddler(new tw.Tiddler(copy.fields));
  }
  for (const title of plan.tombstones) {
    wiki.deleteTiddler(title);
  }

  return {
    promoted: plan.promoted,
    skipped: plan.skipped,
    childrenPromoted: plan.childrenPromoted,
    promotedTo: plan.promotedTo,
    promotedAt: plan.promotedAt,
  };
}

export function planPromoteUris(
  wiki:        PromoteWiki,
  uris:        string[],
  targetBagId: string,
  lookupWiki:  PromoteWiki = wiki,
): PromotePlan {
  const promotedAt = new Date().toISOString();
  const oracle = resolveOracle(lookupWiki, targetBagId);
  if (!oracle) {
    return {
      promoted: [],
      skipped: uris.slice(),
      childrenPromoted: [],
      promotedTo: targetBagId,
      promotedAt,
      copies: [],
      tombstones: [],
      error: "no oracle tiddler: " + targetBagId,
    };
  }

  const pathFilter = typeof oracle.fields["path-filter"] === "string" ? oracle.fields["path-filter"] : "";
  const mirrorRoot = typeof oracle.fields["mirror-root"] === "string" ? oracle.fields["mirror-root"] : "";
  if (!pathFilter || !mirrorRoot) {
    return {
      promoted: [],
      skipped:  uris.slice(),
      childrenPromoted: [],
      promotedTo: targetBagId,
      promotedAt,
      copies: [],
      tombstones: [],
      error:    "oracle missing path-filter/mirror-root: " + targetBagId,
    };
  }

  const expanded = expandPromotionUris(wiki, uris);
  const promoted: string[] = [];
  const skipped:  string[] = [];
  const copies: PromotePlannedRecord[] = [];
  const tombstones: string[] = [];

  for (const uri of expanded.ordered) {
    const existing = wiki.getTiddler(uri);
    if (!existing) { skipped.push(uri); continue; }

    const relPath = resolveRelPath(wiki, uri, targetBagId, pathFilter);
    if (!relPath) { skipped.push(uri); continue; }

    const filePath = mirrorRoot + "/" + relPath;

    copies.push({
      title: uri,
      fields: {
        ...existing.fields,
        title: uri,
        bag: targetBagId,
        "file-path": filePath,
      },
    });
    tombstones.push(uri);

    promoted.push(uri);
  }

  return {
    promoted,
    skipped,
    childrenPromoted: expanded.children.filter((uri) => promoted.includes(uri)),
    promotedTo: targetBagId,
    promotedAt,
    copies,
    tombstones,
  };
}
