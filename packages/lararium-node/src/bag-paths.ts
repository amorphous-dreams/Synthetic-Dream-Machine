/**
 * bag-paths — URI → mirror-relative-path factories.
 *
 * The named-bag layout (`bags/@NAME`) makes per-scope path computation
 * derivable from the bag scope alone. No oracle tiddler `path-filter` field
 * needed. Factories are pure functions; no I/O, no module state.
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

const HA_KA_BA_PREFIX = "lar:///ha.ka.ba/";

function splitHash(s: string): [string, string | null] {
  const i = s.indexOf("#");
  return i >= 0 ? [s.slice(0, i), s.slice(i + 1)] : [s, null];
}

function toRelMd(pathPart: string, frag: string | null): string {
  const base = pathPart.endsWith(".md") ? pathPart.slice(0, -3) : pathPart;
  return frag ? `${base}/${frag}.md` : `${base}.md`;
}

/**
 * Factory for single-scope named bags (e.g. "@lares", "@lararium").
 *
 * Maps `lar:///ha.ka.ba/@SCOPE/X` → `X.md` relative to the bag mirror root.
 * Returns null for any URI outside the scope.
 */
export function namedBagPath(scope: string): MirrorPathFn {
  const prefix = HA_KA_BA_PREFIX + scope + "/";
  return (uri) => {
    if (!uri.startsWith(prefix)) return null;
    const rest = uri.slice(prefix.length);
    if (!rest) return null;
    const [pathPart, frag] = splitHash(rest);
    return toRelMd(pathPart, frag);
  };
}

/**
 * Factory for wiki shadow bags (corpus view inside a wiki).
 *
 * Maps:
 *   `lar:///ha.ka.ba/@lares/X`      → `lares/X.md`
 *   `lar:///ha.ka.ba/@lararium/X`   → `lararium/X.md`
 *   Other `lar:///ha.ka.ba/X`       → `lares/X.md`  (bare ha.ka.ba path)
 *
 * Returns null for URIs outside `lar:///ha.ka.ba/`.
 */
export function wikiBagPath(): MirrorPathFn {
  const LARES_SCOPE    = "@lares/";
  const LARARIUM_SCOPE = "@lararium/";
  return (uri) => {
    if (!uri.startsWith(HA_KA_BA_PREFIX)) return null;
    let rest = uri.slice(HA_KA_BA_PREFIX.length);
    let dirPrefix: string;

    if (rest.startsWith(LARES_SCOPE)) {
      rest = rest.slice(LARES_SCOPE.length);
      dirPrefix = "lares/";
    } else if (rest.startsWith(LARARIUM_SCOPE)) {
      rest = rest.slice(LARARIUM_SCOPE.length);
      dirPrefix = "lararium/";
    } else if (rest.startsWith("@")) {
      return null;
    } else {
      dirPrefix = "lares/";
    }

    if (!rest) return null;
    const [pathPart, frag] = splitHash(rest);
    const rel = toRelMd(pathPart, frag);
    return `${dirPrefix}${rel}`;
  };
}
