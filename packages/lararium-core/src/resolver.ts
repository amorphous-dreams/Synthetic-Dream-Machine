/**
 * `lar:` URI resolution for the Lararium carrier spine.
 *
 * Resolution policy:
 * - ha.ka.ba/@lares/{path} → packages/lares/{path}.md  (primary lares corpus path)
 * - ha.ka.ba/@lararium/{pkg}/v{ver}/{path} → packages/ha-ka-ba/{pkg-slug}/{path}.md  (engine corpus)
 * - ha.ka.ba/{other} → packages/lares/ha-ka-ba/{other}.md  (legacy compat — remove after URI sweep)
 * - AGENTS, LARES, README → packages/lares/{ROOT}.md  (caps-file legacy alias)
 * - INDEXES/** and other ALL-CAPS roots → virtual namespace (caps-virtual)
 * - other three-segment tuple roots → packages/lares/chapel-perilous-opens/{root}/{path}.md
 *
 * NOTE: `lararium-core` is isomorphic — no `fs`, `path`, or `process` imports.
 * File existence and reading are delegated to the host (lararium-node).
 */

export interface LarResolution {
  readonly uri: string;
  readonly root: string;
  readonly childPath: readonly string[];
  /** Relative path from packages/lares/ root (no leading slash). Null for virtual roots. */
  readonly resourcePath: string;
  /** Absolute-path-like string within packages/lares/ — null for virtual. Caller resolves against laresRoot. */
  readonly laresRelPath: string | null;
  readonly kind: "caps-file" | "caps-virtual" | "tuple-file";
  readonly virtual: boolean;
}

/**
 * Parsed hostful lar authority: `lar://alias:tier@host/...`
 * Trust tier is separate from identity — the host speaks, not overrides.
 */
export interface LarAuthority {
  readonly alias: string;
  readonly tier: string;
  readonly host: string;
}

export interface LarHostfulResolution extends LarResolution {
  readonly authority: LarAuthority;
  /** Hostful records never resolve to lares/ files — they are exchange records. */
  readonly kind: "caps-virtual";
  readonly virtual: true;
}

// Schema: lar:///ha.ka.ba/@lares/api/v0.1/lararium/lar-uri/uri-roots
const CAPS_FILE_ROOTS = new Set(["AGENTS", "LARES", "README"]);
const VIRTUAL_CAPS_ROOTS = new Set(["INDEXES"]);
const STABLE_TUPLE_ROOT = "ha.ka.ba";
const LARES_SCOPE    = "@lares";

function splitLarUri(uri: string): { root: string; childPath: string[] } {
  const url = new URL(uri);
  if (url.protocol !== "lar:") throw new Error(`expected lar URI, got ${uri}`);
  if (url.host) throw new Error(`expected triple-slash lar URI (hostless), got ${uri} — use parseHostfulLarUri for hostful`);
  const rawPath = decodeURIComponent(url.pathname);
  const parts = rawPath.replace(/^\/+/, "").split("/").filter(Boolean);
  if (parts.length === 0) throw new Error(`lar URI needs a root segment: ${uri}`);
  const [root, ...childPath] = parts as [string, ...string[]];
  return { root, childPath };
}

/**
 * Parse a hostful `lar://alias:tier@host/path` URI.
 * Returns the authority components and a virtual resolution.
 * Hostful records carry lower trust than hostless invariant memes.
 */
export function parseHostfulLarUri(uri: string): LarHostfulResolution {
  const url = new URL(uri);
  if (url.protocol !== "lar:") throw new Error(`expected lar URI, got ${uri}`);
  if (!url.host) throw new Error(`expected hostful lar URI (lar://alias:tier@host/...), got ${uri}`);

  // URL parser splits "alias:tier@host" as username=alias, password=tier, hostname=host
  const alias = decodeURIComponent(url.username);
  const tier = decodeURIComponent(url.password);
  const host = url.hostname;

  const rawPath = decodeURIComponent(url.pathname);
  const parts = rawPath.replace(/^\/+/, "").split("/").filter(Boolean);
  const [root = "", ...childPath] = parts;
  const resourcePath = [root, ...childPath].join("/");

  return Object.freeze({
    uri,
    root,
    childPath: Object.freeze(childPath),
    resourcePath,
    laresRelPath: null,
    kind: "caps-virtual" as const,
    virtual: true as const,
    authority: Object.freeze({ alias, tier, host }),
  });
}

/**
 * Returns true if the URI is a hostful live exchange record.
 * Hostful records must not silently override hostless invariant memes.
 */
export function isHostfulLarUri(uri: string): boolean {
  try {
    const url = new URL(uri);
    return url.protocol === "lar:" && url.host.length > 0;
  } catch {
    return false;
  }
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

  // Legacy caps-file roots: lar:///AGENTS → packages/lares/AGENTS.md
  // Kept as alias; canonical form is lar:///ha.ka.ba/@lares/AGENTS
  if (CAPS_FILE_ROOTS.has(root) && childPath.length === 0) {
    const laresRelPath = `${root}.md`;
    return { uri, root, childPath, resourcePath, laresRelPath, kind: "caps-file", virtual: false };
  }

  if (VIRTUAL_CAPS_ROOTS.has(root) || isCapsRoot(root)) {
    return { uri, root, childPath, resourcePath, laresRelPath: null, kind: "caps-virtual", virtual: true };
  }

  if (isTupleRoot(root) && root === STABLE_TUPLE_ROOT) {
    // lar:///ha.ka.ba/@lares/{rest} → packages/lares/{rest}.md  (canonical lares path)
    if (childPath[0] === LARES_SCOPE) {
      const rest = childPath.slice(1);
      // Top-level lares files: lar:///ha.ka.ba/@lares/AGENTS → AGENTS.md
      if (rest.length === 1 && CAPS_FILE_ROOTS.has(rest[0]!)) {
        return { uri, root, childPath, resourcePath, laresRelPath: `${rest[0]}.md`, kind: "caps-file", virtual: false };
      }
      const joined = rest.length > 0 ? rest.join("/") : "";
      const laresRelPath = joined ? withMdSuffix(joined) : "index.md";
      return { uri, root, childPath, resourcePath, laresRelPath, kind: "tuple-file", virtual: false };
    }

    // Legacy: lar:///ha.ka.ba/{rest} (no @lares scope) → ha-ka-ba/{rest}.md
    // Remove after URI sweep is complete.
    const base = root.replace(/\./g, "-");
    const joined = childPath.length > 0 ? `${base}/${childPath.join("/")}` : base;
    const laresRelPath = withMdSuffix(joined);
    return { uri, root, childPath, resourcePath, laresRelPath, kind: "tuple-file", virtual: false };
  }

  if (isTupleRoot(root)) {
    const base = `chapel-perilous-opens/${root}`;
    const joined = childPath.length > 0 ? `${base}/${childPath.join("/")}` : base;
    const laresRelPath = withMdSuffix(joined);
    return { uri, root, childPath, resourcePath, laresRelPath, kind: "tuple-file", virtual: false };
  }

  // Adjacent tagspace dirs — legacy; absorb into @lares scope after URI sweep
  if (root === "grammars" || root === "lararium-node") {
    const joined = childPath.length > 0 ? `${root}/${childPath.join("/")}` : root;
    const laresRelPath = withMdSuffix(joined);
    return { uri, root, childPath, resourcePath, laresRelPath, kind: "tuple-file", virtual: false };
  }

  throw new Error(`unsupported lar root "${root}" in ${uri}`);
}
