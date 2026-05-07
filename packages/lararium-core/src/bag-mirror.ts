/**
 * BagMirrorConfig — describes how a writable bag's tiddlers project to disk.
 *
 * Each bag may opt into a filesystem mirror; the mirror root + URI-to-path
 * function determine where edits land. Bags without a mirror config never
 * write to disk (correct for operator-private bags: identities, groups,
 * sessions, admin).
 *
 * Canon-promotion law: room-bag mirrors live under a gitignored scratch root
 * (e.g. `rooms/{slug}/`); canonical bag mirrors live under `packages/`. Edits
 * land in the room mirror; promotion is the deliberate ceremony that moves
 * a tiddler from the room bag → canonical bag, with the disk side effect of
 * a file move from `rooms/{slug}/` → `packages/`. The git diff IS the
 * operator's signature on canon.
 *
 * Configuration source: programmatic for now; S5.6+ moves to admin-room
 * tiddlers tagged $:/tags/LarariumBagMirror.
 */

import { resolveLarUri } from "./resolver.js";

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

/** Strategy: lares carriers — `lar:///ha.ka.ba/@lares/{path}` → `{path}.md`. */
export const laresPathStrategy: MirrorPathFn = (uri) => {
  try { return resolveLarUri(uri).laresRelPath ?? null; }
  catch { return null; }
};

/** Strategy: engine corpus — `lar:///ha.ka.ba/@lararium/{pkg}/v{ver}/{path}` → `packages/{pkg-slug}/memes/{path}.md`. */
export const enginePathStrategy: MirrorPathFn = (uri) => {
  try { return resolveLarUri(uri).engineRelPath ?? null; }
  catch { return null; }
};

/**
 * Strategy: room-shadow — preserves the canonical disk structure of whichever
 * bag the URI would canonically belong to, so promotion is a file move.
 *
 * Examples:
 *   `lar:///ha.ka.ba/@lares/foo`              → `lares/memes/foo.md`
 *   `lar:///ha.ka.ba/@lararium/core/v0.1/ast` → `lararium-core/memes/ast.md`
 *
 * Apply under `rooms/{slug}/` mirrorRoot; the resulting path mirrors the
 * canonical workspace location, making "promote to canon" a literal file move
 * from `rooms/{slug}/lares/memes/foo.md` → `packages/lares/memes/foo.md`.
 */
export const roomShadowPathStrategy: MirrorPathFn = (uri) => {
  try {
    const r = resolveLarUri(uri);
    if (r.laresRelPath)  return `lares/memes/${r.laresRelPath}`;
    if (r.engineRelPath) return r.engineRelPath; // already pkg-prefixed
    return null;
  } catch { return null; }
};
