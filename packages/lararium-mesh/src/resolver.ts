/**
 * `lar:` URI resolution for the Lararium carrier spine — TOPOLOGY ONLY.
 *
 * It answers what a URI NAMES: its root, its child path, whether the shape carries a caps root, and
 * whether anything on disk could back it. It answers nothing about WHERE — and that separation follows
 * the scheme's own law, since `lar:` names and never fetches.
 *
 * ── WHY NO DISK MAPPING LIVES HERE ANY LONGER ───────────────────────────────────────────────────
 * An earlier shape carried one: `ha.ka.ba/lares/{path}` → `packages/lares-core/memes/{path}.mem`, and a
 * matching rule for the engine packages. The corpus then moved into `bags/`, those trees stopped
 * existing, and the mapping kept computing paths that named nothing. Nothing joined them — no production
 * caller ever read the fields — so the rot surfaced nowhere and the header went on instructing every
 * reader, human or agent, to look in a directory the repo had deleted.
 *
 * A mapping nobody joins cannot go stale LOUDLY; it can only mislead quietly. So it went, rather than
 * getting re-pointed at `bags/` and inviting the same silence next time the corpus moves.
 *
 * DISK RESOLUTION RIDES THE CARRIER WALK instead (`listCarriers` over a bag directory), where a wrong
 * path fails immediately and visibly against a real filesystem.
 *
 * NOTE: `lararium-mesh` stays isomorphic — no `fs`, `path`, or `process` imports. The host reads files.
 *
 * Resolution policy:
 * - AGENTS, LARES, README → virtual until expressed under the lares bag
 * - a stable-tuple root with a corpus scope → tuple-file (a carrier MAY back it; the host decides)
 * - any other shape → virtual (wiki-only)
 */

export interface LarResolution {
  readonly uri: string;
  readonly root: string;
  readonly childPath: readonly string[];
  /** Composite resource path used for receipts and diagnostics. */
  readonly resourcePath: string;
  readonly kind: "caps-virtual" | "tuple-file";
  readonly virtual: boolean;
}

/**
 * Parsed hostful lar authority: `lar://alias:grant@host/...`
 * Trust grant is separate from identity — the host speaks, not overrides.
 */
export interface LarAuthority {
  readonly alias: string;
  readonly grant: string;
  readonly host: string;
}

/**
 * A hostful resolution: the base topology, plus the authority the address names.
 *
 * ── HOSTFUL/HOSTLESS NAMES WHAT THE URI NAMES, NEVER WHICH LAYER HOLDS IT (operator ruling) ─────
 * A hostful address states WHO SPOKE, under what grant, from where — a property of the CONTENT, which
 * keeps holding for as long as that content stands. It states nothing about residency, durability, or
 * trust tier, and a reader derives none of those from it: a captured exchange turn split into memes by
 * speaker-aim URI reads as a canon carrier holding a hostful address permanently.
 *
 * So this interface adds the authority and NARROWS NOTHING. An earlier shape pinned
 * `kind: "caps-virtual"` and `virtual: true` here, which encoded //hostful implies no disk backing// in
 * the type system — a residency verdict read off the address form, and unfalsifiable at the call site
 * because the type forbade the other answer. `kind` and `virtual` now carry whatever the topology
 * classifier reads, exactly as they do for a hostless address.
 *
 * Meme: lar:///ha.ka.ba/lares/docs/pono/canon-boundary#/the-promotion-boundary
 */
export interface LarHostfulResolution extends LarResolution {
  readonly authority: LarAuthority;
}

// The one root the scheme stands: lar:///ha.ka.ba/lares/api/pono/lar-uri (#scheme-syntax).
const STABLE_TUPLE_ROOT = "ha.ka.ba";
const LARES_SCOPE   = "lares";
const ENGINE_SCOPE  = "lararium";

function splitLarUri(uri: string): { root: string; childPath: string[]; fragmentPath: string[] } {
  // EQUALITY RIDES THE SPELLING (lar-uri #equality): addresses compare codepoint for codepoint with no
  // normalization, so the resolver must never manufacture an equality the author did not write. WHATWG
  // `new URL` removes dot-segments silently (RFC 3986 §5.2.4) and the segment filter below would
  // swallow empties — each rewrites the address before any lar-specific code reads it, which is the
  // spoofing surface the equality law closes. Reject the raw spelling; never resolve it.
  if (uri.startsWith("lar:///")) {
    const rawTail = uri.slice("lar:///".length).split("#")[0] ?? "";
    for (const seg of rawTail.split("/")) {
      if (seg === "." || seg === "..") throw new Error(`lar URI carries a dot-segment — rejected, never resolved: ${uri}`);
    }
    if (rawTail.length > 0 && (rawTail.includes("//") || rawTail.endsWith("/"))) {
      throw new Error(`lar URI carries an empty segment: ${uri}`);
    }
  }
  const url = new URL(uri);
  if (url.protocol !== "lar:") throw new Error(`expected lar URI, got ${uri}`);
  if (url.host) throw new Error(`expected triple-slash lar URI (hostless), got ${uri} — use parseHostfulLarUri for hostful`);
  const rawPath = decodeURIComponent(url.pathname);
  const parts = rawPath.replace(/^\/+/, "").split("/").filter(Boolean);
  if (parts.length === 0) throw new Error(`lar URI needs a root segment: ${uri}`);
  const [root, ...childPath] = parts as [string, ...string[]];
  // Fragment-path (`#parent/child/grandchild`) projects onto disk as nested
  // subdirectories — `lar:///foo#a/b` → `foo/a/b.mem`. The single-hash + path
  // invariant comes from lar:///ha.ka.ba/lares/api/pono/memetic-wikitext #anchors — the media type
  // owns fragment meaning (RFC 3986 §3.5); this resolver implements the path-shaped anchor it defines.
  const rawHash = decodeURIComponent(url.hash.replace(/^#/, ""));
  const fragmentPath = rawHash ? rawHash.split("/").filter(Boolean) : [];
  return { root, childPath, fragmentPath };
}

/**
 * Parse a hostful `lar://alias:grant@host/path` URI into its authority and its topology.
 *
 * The authority answers WHO SPOKE. The topology answers what the path shape names, read by the SAME
 * classifier a hostless address walks — the address form steers neither residency nor trust (see
 * `LarHostfulResolution`). A path whose root the classifier does not recognize resolves virtual, which
 * states //this parser found no backing shape//, never //a hostful name cannot have one//.
 */
export function parseHostfulLarUri(uri: string): LarHostfulResolution {
  const url = new URL(uri);
  if (url.protocol !== "lar:") throw new Error(`expected lar URI, got ${uri}`);
  if (!url.host) throw new Error(`expected hostful lar URI (lar://alias:grant@host/...), got ${uri}`);

  // URL parser splits "alias:grant@host" as username=alias, password=grant, hostname=host
  const alias = decodeURIComponent(url.username);
  const grant = decodeURIComponent(url.password);
  const host = url.hostname;

  const rawPath = decodeURIComponent(url.pathname);
  const parts = rawPath.replace(/^\/+/, "").split("/").filter(Boolean);
  const [root = "", ...childPath] = parts;
  const resourcePath = [root, ...childPath].join("/");

  // VIRTUAL AS A FALLBACK, NEVER AS A VERDICT ON THE ADDRESS FORM: an unrecognized root reads virtual
  // here where a hostless address would throw, because a hostful path carries speaker-minted roots the
  // stable taxonomy never registered. The recognized shapes classify identically either way.
  const topology = isTupleRoot(root)
    ? classifyStablePath(root, childPath)
    : { kind: "caps-virtual" as const, virtual: true };

  return Object.freeze({
    uri,
    root,
    childPath: Object.freeze(childPath),
    resourcePath,
    kind: topology.kind,
    virtual: topology.virtual,
    authority: Object.freeze({ alias, grant, host }),
  });
}

/**
 * Returns true if the URI names a speaker through an authority — the hostful form.
 *
 * It reports the ADDRESS FORM and nothing further. Trust tier, residency, and durability answer to
 * other readers entirely (see `LarHostfulResolution`); a caller routing any of those off this predicate
 * reads a content property as a layer property.
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

/**
 * Classify a three-term-root path into its topology — the ONE reader of path shape, walked by the
 * hostless and the hostful entry points alike so no classification hangs off the address form.
 */
function classifyStablePath(
  root: string,
  childPath: readonly string[],
): { kind: LarResolution["kind"]; virtual: boolean } {
  const VIRTUAL = { kind: "caps-virtual" as const, virtual: true };
  const FILE    = { kind: "tuple-file" as const,   virtual: false };

  if (root !== STABLE_TUPLE_ROOT) return VIRTUAL;

  if (childPath[0] === LARES_SCOPE) return FILE;

  // The engine scope names a file only below its own head segment.
  if (childPath[0] === ENGINE_SCOPE) return childPath[1] ? FILE : VIRTUAL;

  // lar:///ha.ka.ba/{bags|wikis}/{slug}[/{path}] — a CRDT surface addressed by its kind-plane. The KIND
  // SEGMENT names it; the slug that follows carries no marker and needs none, because the segment above
  // it already said which plane this is. Its interior is doc/registry data, never a corpus file, so it
  // resolves virtual — doc identity, not a disk path.
  //
  // A third arm here matched a bare leading `@`, from when the slug carried the marker instead of the
  // segment. Routing on it kept a retired address form REACHABLE: anything still minting one would have
  // resolved correctly and gone unnoticed, which is how a retired form outlives its retirement.
  //
  // ha.ka.ba/{rest} — a bare meme namespace with no lares/lararium disk mapping — resolves virtual too
  // (its file lives in its holding bag on disk, resolved elsewhere), so both arms land on VIRTUAL.
  return VIRTUAL;
}

/**
 * Resolve a `lar:///...` URI into a LarResolution.
 * Does not perform any I/O — existence checking is the caller's responsibility.
 */
export function resolveLarUri(uri: string): LarResolution {
  const { root, childPath } = splitLarUri(uri);
  const resourcePath = [root, ...childPath].join("/");

  // A root that carries no three-term tuple names no address this scheme rules (lar-uri #/path-taxonomy:
  // the root admits no exception), so it fails here rather than resolving to a shape nobody meant.
  // Stabilize an unrecognized tuple root by moving it into a recognized scope or by registering a custom
  // bag mirror in the daemon wiki.
  if (!isTupleRoot(root)) throw new Error(`unsupported lar root "${root}" in ${uri}`);

  const { kind, virtual } = classifyStablePath(root, childPath);
  return { uri, root, childPath, resourcePath, kind, virtual };
}
