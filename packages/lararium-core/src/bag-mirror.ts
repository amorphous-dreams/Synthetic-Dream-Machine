/**
 * BagMirrorConfig — describes how a writable bag's tiddlers project to disk.
 *
 * Each bag may opt into a filesystem mirror; the mirror root + URI-to-path
 * function determine where edits land. Bags without a mirror config never
 * write to disk (correct for operator-private bags: identities, groups,
 * sessions, admin).
 *
 * Canon-promotion law: wiki-bag mirrors live under a gitignored scratch root
 * (e.g. `wikis/{slug}/`); canonical bag mirrors live under `packages/`. Edits
 * land in the wiki mirror; promotion is the deliberate ceremony that moves
 * a tiddler from the wiki bag → canonical bag, with the disk side effect of
 * a file move from `wikis/{slug}/` → `packages/`. The git diff IS the
 * operator's signature on canon.
 *
 * Configuration source: programmatic for now; S5.6+ moves to admin-wiki
 * tiddlers tagged $:/tags/LarariumBagMirror.
 */

import { resolveLarUri } from "./resolver.js";

/** TW5 tag that identifies a bag-mirror-config tiddler in the admin wiki. */
export const LARARIUM_BAG_MIRROR_TAG = "$:/tags/LarariumBagMirror";

/** Strategy name as written in admin-wiki tiddlers. Maps to a MirrorPathFn. */
export type MirrorStrategyName = "lares" | "engine" | "wiki-shadow";

/**
 * Convert a lar: URI into a path relative to a mirror root.
 * Returns null when the URI doesn't resolve to a file (virtual / unsupported).
 */
export type MirrorPathFn = (uri: string) => string | null;

export interface BagMirrorConfig {
  /** The bag whose changes this mirror reflects. */
  readonly bagId: string;
  /** Absolute filesystem path; all writes are constrained under this root. */
  readonly mirrorRoot: string;
  /** URI → relative path under mirrorRoot. */
  readonly toRelPath: MirrorPathFn;
}

// ---------------------------------------------------------------------------
// Standard path strategies — readers that pick one of resolveLarUri's outputs
// ---------------------------------------------------------------------------

/**
 * Strategy: lares carriers.
 *   `lar:///ha.ka.ba/@lares/{path}`      → `{path}.md`
 *   `lar:///ha.ka.ba/{rest}`             → `{rest}.md`  (bare URI, no @-scope)
 *   `lar:///ha.ka.ba/{rest}#{frag}`      → `{rest}/{frag}.md`
 *
 * Apply under `packages/lares/memes/` mirrorRoot.
 * Bare URIs land here when promoted from a wiki bag to the lares bag.
 */
export const laresPathStrategy: MirrorPathFn = (uri) => {
  try {
    const r = resolveLarUri(uri);
    if (r.laresRelPath) return r.laresRelPath;
    // Bare ha.ka.ba/{rest} URIs promoted to the lares bag.
    const TUPLE_PREFIX = "lar:///ha.ka.ba/";
    if (uri.startsWith(TUPLE_PREFIX)) {
      const withoutScheme = uri.slice(TUPLE_PREFIX.length);
      if (withoutScheme.startsWith("@")) return null;
      const [pathPart, fragmentPart] = withoutScheme.split("#") as [string, string | undefined];
      if (!pathPart) return null;
      const basePath = pathPart.replace(/\.md$/, "");
      return fragmentPart ? `${basePath}/${fragmentPart}.md` : `${basePath}.md`;
    }
    return null;
  } catch { return null; }
};

/** Strategy: engine corpus — `lar:///ha.ka.ba/@lararium/{pkg}/v{ver}/{path}` → `packages/{pkg-slug}/memes/{path}.md`. */
export const enginePathStrategy: MirrorPathFn = (uri) => {
  try { return resolveLarUri(uri).engineRelPath ?? null; }
  catch { return null; }
};

/**
 * Strategy: wiki-shadow — preserves canonical disk structure so promotion is
 * a file move from `wikis/{slug}/…` → `packages/…`.
 *
 * Examples:
 *   `lar:///ha.ka.ba/@lares/foo`              → `lares/memes/foo.md`
 *   `lar:///ha.ka.ba/@lararium/core/v0.1/ast` → `lararium-core/memes/ast.md`
 *   `lar:///ha.ka.ba/docs/lares/foo`          → `memes/docs/lares/foo.md`
 *   `lar:///ha.ka.ba/docs/lares/foo#section`  → `memes/docs/lares/foo/section.md`
 *
 * Apply under `wikis/{slug}/` mirrorRoot.
 */
export const wikiShadowPathStrategy: MirrorPathFn = (uri) => {
  try {
    const r = resolveLarUri(uri);
    if (r.laresRelPath)  return `lares/memes/${r.laresRelPath}`;
    if (r.engineRelPath) return r.engineRelPath;

    // Bare ha.ka.ba/{rest} URIs — project under memes/.
    // lar:///ha.ka.ba/docs/lares/foo#section → memes/docs/lares/foo/section.md
    const TUPLE_PREFIX = "lar:///ha.ka.ba/";
    if (uri.startsWith(TUPLE_PREFIX)) {
      const withoutScheme = uri.slice(TUPLE_PREFIX.length);
      // @-prefixed first segment = doc-identity (virtual) — skip
      if (withoutScheme.startsWith("@")) return null;
      const [pathPart, fragmentPart] = withoutScheme.split("#") as [string, string | undefined];
      if (!pathPart) return null;
      const basePath = pathPart.replace(/\.md$/, "");
      if (fragmentPart) {
        return `memes/${basePath}/${fragmentPart}.md`;
      }
      return `memes/${basePath}.md`;
    }
    return null;
  } catch { return null; }
};
