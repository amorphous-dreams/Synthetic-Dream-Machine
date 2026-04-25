/**
 * `lar:` URI resolution for the Lararium carrier spine.
 *
 * Resolution policy:
 * - AGENTS and LARES → lares/<ROOT>.md (caps-file)
 * - INDEXES/** and other ALL-CAPS roots → virtual namespace (caps-virtual)
 * - ha.ka.ba/<path> → lares/ha-ka-ba/<path>.md (tuple-file)
 * - other three-segment tuple roots → lares/chapel-perilous-opens/<root>/<path>.md
 *
 * NOTE: `lararium-core` is isomorphic — no `fs`, `path`, or `process` imports.
 * File existence and reading are delegated to the host (lararium-node).
 */

export interface LarResolution {
  readonly uri: string;
  readonly root: string;
  readonly childPath: readonly string[];
  /** Relative repo path from lares/ root (no leading slash). Null for virtual roots. */
  readonly resourcePath: string;
  /** Absolute-path-like string within lares/ — null for virtual. Caller resolves against laresRoot. */
  readonly laresRelPath: string | null;
  readonly kind: "caps-file" | "caps-virtual" | "tuple-file";
  readonly virtual: boolean;
}

const CAPS_FILE_ROOTS = new Set(["AGENTS", "LARES"]);
const VIRTUAL_CAPS_ROOTS = new Set(["INDEXES"]);
const STABLE_TUPLE_ROOT = "ha.ka.ba";

function splitLarUri(uri: string): { root: string; childPath: string[] } {
  const url = new URL(uri);
  if (url.protocol !== "lar:") throw new Error(`expected lar URI, got ${uri}`);
  if (url.host) throw new Error(`expected triple-slash lar URI, got ${uri}`);
  const rawPath = decodeURIComponent(url.pathname);
  const parts = rawPath.replace(/^\/+/, "").split("/").filter(Boolean);
  if (parts.length === 0) throw new Error(`lar URI needs a root segment: ${uri}`);
  const [root, ...childPath] = parts as [string, ...string[]];
  return { root, childPath };
}

function isTupleRoot(root: string): boolean {
  const parts = root.split(".");
  return parts.length === 3 && parts.every((p) => p.length > 0);
}

function isCapsRoot(root: string): boolean {
  return root === root.toUpperCase() && /[A-Z]/.test(root);
}

function withMdSuffix(p: string): string {
  const lastSegment = p.slice(p.lastIndexOf("/") + 1);
  return lastSegment.includes(".") ? p : p + ".md";
}

/**
 * Resolve a `lar:///...` URI into a LarResolution.
 * Does not perform any I/O — existence checking is the caller's responsibility.
 */
export function resolveLarUri(uri: string): LarResolution {
  const { root, childPath } = splitLarUri(uri);
  const resourcePath = [root, ...childPath].join("/");

  if (CAPS_FILE_ROOTS.has(root) && childPath.length === 0) {
    const laresRelPath = `${root}.md`;
    return { uri, root, childPath, resourcePath, laresRelPath, kind: "caps-file", virtual: false };
  }

  if (VIRTUAL_CAPS_ROOTS.has(root) || isCapsRoot(root)) {
    return { uri, root, childPath, resourcePath, laresRelPath: null, kind: "caps-virtual", virtual: true };
  }

  if (isTupleRoot(root)) {
    const base =
      root === STABLE_TUPLE_ROOT
        ? root.replace(/\./g, "-")
        : `chapel-perilous-opens/${root}`;
    const joined = childPath.length > 0 ? `${base}/${childPath.join("/")}` : base;
    const laresRelPath = withMdSuffix(joined);
    return { uri, root, childPath, resourcePath, laresRelPath, kind: "tuple-file", virtual: false };
  }

  throw new Error(`unsupported lar root "${root}" in ${uri}`);
}
