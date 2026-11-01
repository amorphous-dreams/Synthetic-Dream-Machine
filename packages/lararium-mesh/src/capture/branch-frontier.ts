/**
 * branch-frontier — the FORK DETECTOR over a conversation parentUuid turn-DAG, and the worldline
 * handle derivations it keys.
 *
 * A `BranchContext` keys a frontier into the handle so same-session forks stop colliding on the
 * shared `run`. Given the transcript's parentUuid DAG this module detects branch points (a turn
 * with ≥2 children) and derives the per-turn `BranchContext`; {@link deriveHandle} and
 * {@link deriveRootHandle} fold its token into the run component. The source_file derivations
 * (surface · agent · handle · root handle) read the staged basename alone.
 *
 * The DAG reading is the git/Merkle "set of head hashes" idiom: a turn's branch identity is
 * the SET of branch-choice uuids it descended through — the immediate child taken at every
 * forking ancestor on the root→turn path. Two siblings of one fork carry distinct choices, so
 * they derive distinct frontiers → distinct handles; nested forks accumulate. A turn with NO
 * forking ancestor carries no frontier (returns undefined) → the handle stays byte-identical to
 * the unforked case (slice-1's invariant: absent a frontier, behavior is unchanged).
 *
 * Pure + dependency-free (bundles into the TW5 VM). The caller reads the transcript into
 * {uuid, parentUuid} nodes.
 *
 * Meme: lar:///ha.ka.ba/lararium/api/agent-worldline#/time (Fork = concurrency the DAG holds)
 */

/**
 * `lar_hv` — the enrich-logic version (the Kappa upgrade gate) a drawer's `lar_*` stamps carry.
 * THE single source for this number.
 */
export const LAR_HV = 7;

const SURFACES = ["claude", "codex", "copilot-vscode", "copilot-cli"];

/**
 * BranchContext — the turn-DAG fork signal. A same-session FORK (a transcript turn with
 * two children in the conversation parentUuid DAG = a branch point) makes both branches
 * derive the IDENTICAL `run` handle, so worldlineClockFor folds two timelines into one
 * (the collision). The cure: a BRANCH-FRONTIER component keyed into the handle.
 *
 * Branch identity = the FRONTIER (the set of head turn-uuids at the divergence point — the
 * git/Merkle "set of head hashes" reading). Derived data keys by (handle + frontier), so
 * two forks of one session derive DISTINCT handles. A normal spawn (no fork) carries no
 * frontier and is UNAFFECTED — the handle stays exactly `run.agentId` / `run`.
 *
 * The feed (the parentUuid turn-DAG → frontier) rides {@link branchContextForTurn} below; the
 * derivations here key it into the handle. Absent a frontier, the handle stays exactly `run`.
 */
export interface BranchContext {
  /**
   * The divergence frontier — the head turn-uuid(s) that distinguish this branch. A single
   * uuid (the divergence turn) or the set of heads. Empty/absent ⇒ no fork ⇒ no component.
   */
  readonly frontier?: string | readonly string[];
}

/**
 * A short, stable, dependency-free content token (FNV-1a/32, 8 hex). NOT a cryptographic
 * digest — it only needs to DISTINGUISH deterministically at session scale (this module bundles
 * into the TW5 VM + the browser twin, so no @noble import here). Used for the branch-frontier token.
 */
export function fnv1a8(s: string): string {
  let h = 0x811c9dc5; // FNV-1a 32-bit offset basis
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0; // FNV prime, keep unsigned
  }
  return h.toString(16).padStart(8, "0");
}

/**
 * A short, stable token for a branch frontier (FNV-1a/32, 8 hex). Order-independent over
 * a head SET (sorted before folding). Returns null when no frontier.
 */
export function deriveBranchFrontier(branch?: BranchContext): string | null {
  const f = branch?.frontier;
  if (f == null) return null;
  const heads = (Array.isArray(f) ? [...f] : [f as string]).filter((h) => h != null && h !== "");
  if (heads.length === 0) return null;
  return fnv1a8(heads.map(String).sort().join("\n"));
}

/**
 * Derive the originating harness from a staged source_file (prefixed `<surface>__…`).
 * An absent or un-prefixed source carries "unknown" HONESTLY — a guessed default would
 * stamp a guess as provenance and hide un-tokened producers.
 * Downstream reads the field as a free string (adapter.py FieldSpec, no enum), so
 * the honest value rides without breaking a consumer.
 */
export function deriveSurface(sourceFile?: string): string {
  if (!sourceFile) return "unknown";
  const base = sourceFile.replace(/\\/g, "/").split("/").pop() ?? "";
  const pfx = base.split("__")[0] ?? "";
  return SURFACES.includes(pfx) ? pfx : "unknown"; // no surface token → carried honestly, never guessed
}

/**
 * Strip one leading `<surface>__` token off a staged basename. Spirit basenames carry it
 * too (`<surface>__<name>__agent-<id>__run-<run>.jsonl`, spiritStageBasename) — without the
 * strip, deriveAgent's lazy `(.+?)` would swallow `<surface>__` into the agent label.
 * Un-prefixed names pass through untouched (the handle law never shifts).
 */
function stripSurfaceToken(base: string): string {
  const pfx = base.split("__")[0] ?? "";
  return SURFACES.includes(pfx) ? base.slice(pfx.length + 2) : base;
}

/**
 * Derive the tasked-spirit name from a subagent-staged source_file
 * (`<name>__agent-<id>__run-<run>.jsonl`, the convention from subagent-mine.ts), else null.
 * A basename without the run token names no spirit.
 * A drawer with a name reads as a spirit turn (lar_sidechain), kept queryable by
 * actor in the spirits wing — distinct from the main agent's verbatim.
 */
export function deriveAgent(sourceFile?: string): string | null {
  if (!sourceFile) return null;
  const base = stripSurfaceToken(sourceFile.replace(/\\/g, "/").split("/").pop() ?? "");
  const m = /^(.+?)__agent-[^/]+?__run-[^/]+\.jsonl$/.exec(base);
  return m ? (m[1] ?? null) : null;
}

/**
 * Derive the worldline lineage-path HANDLE from a subagent-staged source_file
 * (`<name>__agent-<id>__run-<run>.jsonl`, the convention from subagent-mine.ts).
 * Returns `<run>.<agentId>` — the run-root . span, the trace-id/span-id formalized
 * (lar:///…/agent-worldline#name) — or null. Identity rides this handle; the
 * pet-name (deriveAgent) only labels. A name without `__run-` yields null.
 * Flat `subagents/` gives a `run.child` path; deep parentUuid nesting is a
 * documented extension (agent-worldline#open).
 */
export function deriveHandle(sourceFile?: string, frontier?: string | null): string | null {
  if (!sourceFile) return null;
  const base = stripSurfaceToken(sourceFile.replace(/\\/g, "/").split("/").pop() ?? "");
  const m = /__agent-([^/]+?)__run-([^/]+)\.jsonl$/.exec(base);
  if (!m) return null;
  // The branch-frontier rides the RUN component (`run~frontier`), so split(".")[0] below
  // yields the branch-specific run — two same-session forks no longer collide.
  const run = frontier ? `${m[2]}~${frontier}` : m[2];
  return `${run}.${m[1]}`;
}

/**
 * Derive the ROOT worldline handle from a MAIN-agent staged source_file
 * (`<surface>__<run>.jsonl` — the convention for a top-level session transcript,
 * NO `__agent-` segment). Returns the run (= the session id), or null for a spirit
 * (handled by deriveHandle) or an un-prefixed name. The run a main drawer
 * yields here EQUALS the run-part of every spirit it spawned, so a spirit's
 * `lar_parent_handle` resolves back to the main agent's `lar_agent_handle` — the
 * attribution graph closes (agent-worldline#attribution).
 */
export function deriveRootHandle(sourceFile?: string, frontier?: string | null): string | null {
  if (!sourceFile) return null;
  const base = sourceFile.replace(/\\/g, "/").split("/").pop() ?? "";
  if (base.includes("__agent-")) return null; // a spirit — not a root
  const m = /^[^_]+__([^/]+)\.jsonl$/.exec(base); // <surface>__<run>.jsonl
  if (!m?.[1]) return null;
  // A same-session FORK gives both branches the same run → collision. The branch-frontier
  // makes the two roots distinct (`run~frontier`); a normal session carries none.
  return frontier ? `${m[1]}~${frontier}` : m[1];
}


/** One turn-DAG node — the minimal shape the fork reading needs (the transcript carries more). */
export interface TurnNode {
  /** The turn's stable message uuid (the DAG node id). */
  readonly uuid: string;
  /** The in-transcript parent message uuid, or null at a conversation root. */
  readonly parentUuid: string | null;
}

/**
 * The child index: parentUuid → the DISTINCT child uuids under it. The root's children sit under
 * the sentinel key `""` is NOT used — a null parent contributes no edge (a root has no fork-parent).
 */
export function buildChildIndex(turns: readonly TurnNode[]): Map<string, string[]> {
  const idx = new Map<string, string[]>();
  const seenEdge = new Set<string>();
  for (const t of turns) {
    const p = t.parentUuid;
    if (p == null || p === "" || !t.uuid) continue;
    const edge = `${p}\u0000${t.uuid}`;
    if (seenEdge.has(edge)) continue; // a transcript may repeat a (parent,child) — count it once
    seenEdge.add(edge);
    const kids = idx.get(p);
    if (kids) kids.push(t.uuid);
    else idx.set(p, [t.uuid]);
  }
  return idx;
}

/** The branch points: every parent uuid carrying ≥2 distinct children (a divergence in the DAG). */
export function findBranchPoints(turns: readonly TurnNode[]): Set<string> {
  const idx = buildChildIndex(turns);
  const forks = new Set<string>();
  for (const [parent, kids] of idx) if (kids.length >= 2) forks.add(parent);
  return forks;
}

/**
 * Derive a turn's {@link BranchContext} — the SET of branch-choice uuids it descended through.
 * Walk root-ward from the turn; at every node whose PARENT is a branch point, the node IS the
 * branch the turn took, so its uuid joins the frontier. Returns `undefined` when the turn passed
 * through no fork (no collision possible → no frontier → handle unaffected).
 *
 * Cycle-safe (a malformed DAG with a parent loop terminates on the seen-set).
 */
export function branchContextForTurn(turns: readonly TurnNode[], turnUuid: string): BranchContext | undefined {
  if (!turnUuid) return undefined;
  const parentOf = new Map<string, string | null>();
  for (const t of turns) if (t.uuid) parentOf.set(t.uuid, t.parentUuid ?? null);
  const forks = findBranchPoints(turns);
  if (forks.size === 0) return undefined;

  const frontier: string[] = [];
  const seen = new Set<string>();
  let cur: string | null = turnUuid;
  while (cur != null && cur !== "" && !seen.has(cur)) {
    seen.add(cur);
    const parent: string | null = parentOf.get(cur) ?? null;
    if (parent != null && parent !== "" && forks.has(parent)) frontier.push(cur);
    cur = parent;
  }
  if (frontier.length === 0) return undefined;
  return { frontier };
}
