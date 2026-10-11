/**
 * circle-verbs — the FOLLOW-GRAPH daemon verbs over the sovereign circles doc.
 *
 * "Adding to a circle IS the follow" (social-seed). The follow-graph's SOURCE OF TRUTH rides the circles
 * Automerge bag — a PER-NYM CRDT-set on each circle tiddler — a PRIVATE bag the self-slot FLEET-syncs
 * same-operator (so a follow lands on ALL the operator's own devices, matching the catalog registry) and the
 * DeterministicFederationGate NEVER volunteers to a cross-operator (the circles doc sits OUTSIDE its federatable set).
 * One graph, every device of the one human, no stranger — "the only surface human eyes have on the crypto
 * layer" for friends + wanderers.
 *
 * THE PER-NYM OBSERVED-REMOVE SET (M5, replacing a Lamport-counter race). A single shared counter per
 * tiddler cannot tell concurrent from later — a remove stamped by replica A at height 1 and a re-follow
 * stamped by replica B at height 3 (more unrelated history, no causal relation to A's remove) compared as
 * plain strings, and the higher height always "won", present or not. Worse: `cold-boot-ceremony`'s own
 * genesis follow stamped an ISO wall-clock string, which lexically outranks every zero-padded decimal
 * counter forever (`'0' < '2'`), so the operator's OWN follow could never be unfollowed at all.
 *
 * Membership now rides DOTTED per-nym fields: an add writes `mbr+:<nym>#<replica>.<n>` (`replica` is the
 * minting vessel's own device key; `n` is one past that replica's own highest dot in THIS tiddler — see
 * `nextDotForReplica`); a remove writes `mbr-:<nym>#<replica>.<n>` the same way. Each stamp's VALUE is not a
 * clock reading at all — it is the comma-joined set of opposite-kind dots this write OBSERVED locally at
 * write time (an add lists the remove-dots it saw for this nym; a remove lists the add-dots it saw).
 *
 * THE FOLD (`foldMembersDetailed`): a nym stands PRESENT iff SOME add-dot's observed-set is a SUPERSET of
 * every remove-dot presently on the nym — that add happened-after (or concurrently covered) every removal
 * this replica can see. A remove-dot no add has observed either came strictly later (causally) or ran fully
 * CONCURRENTLY with every add — either way remove wins, and only a FRESH, later add (one that observes that
 * remove) resurrects the nym. Concurrency is DETECTABLE, not merely resolved: when an add and a remove never
 * observed each other at all, the fold names the nym in a separate `concurrent` list rather than silently
 * picking a winner.
 *
 * LEGACY READ, not a shim: an un-dotted `mbr+:<nym>` (any value at all — the old Lamport counter, the old ISO
 * string, cold-boot-ceremony's former genesis stamp) parses as an add-dot with dot `""` that observed NOTHING.
 * Any remove — dotted or legacy — then dominates it (the value is never compared), and only a causally-later
 * dotted re-follow (one that observes that remove) brings the nym back. `cold-boot-ceremony.ts` mints the
 * DOTTED form now, so a fresh genesis follow is unfollowable from the moment it is born.
 *
 * Because every dot is its own key, a concurrent follow and unfollow of DIFFERENT nyms — or an add and a
 * remove of the SAME nym from different replicas — touch disjoint field keys, so Automerge's field-merge
 * keeps every edit: no fleet-mate's off-device follow is ever lost to a whole-field last-writer-wins.
 *
 * These reactors run IN the daemon worker (verify-then-delegate gated), reaching the circles doc by ACCESS (the
 * catalog registry names it) and writing-then-syncing — access≠load, never a mounted render layer. A follow
 * writes ONLY the circles doc; NO crossroads plane / board / announce shore is reachable here, so the graph never federates
 * by SHAPE. The ONE federated surface stays the glamour a human DELIBERATELY publishes — a separate act.
 *
 * The recognition layer (the handle-book: others' nyms + private petnames) stays LOCAL for now — a follow of
 * an unknown nym fails-closed CLIENT-side (composeFollow) BEFORE the membership write reaches this verb. The
 * handle-book + petname co-move onto the circles doc is the operator-named fork (see the handback finding).
 *
 * Meme: lar:///ha.ka.ba/lararium/tw5/circle-verbs
 */

import {
  circleTiddlerUri, CIRCLES_INNER, MEMBER_ADD_PREFIX,
  type LarTiddlerStore, type LarTiddlerRecord,
} from "@lararium/mesh";
import type { VerbReactor } from "./verb-dispatcher.js";
import type { TW5Engine } from "./tw5-vm.js";
import { CIRCLE_STATE_TITLE } from "./daemon-circle-tiddlers.js";

/** Resolve a read+write store over the circles doc — the daemon reaches it by ACCESS (the catalog registry
 *  names this face's `circles-<tag>`); access≠load, so no composite layer mounts. Throws LOUD when it is
 *  unresolved. Titles INSIDE the plane spell the namespace, so a circle reads the same on every face. */
export type ResolveCirclesStore = () => Promise<LarTiddlerStore>;

export interface CircleVerbOptions {
  readonly resolveStore: ResolveCirclesStore;
  /** The daemon TW5 VM — present → a mutation/list RE-RENDERS the daemon follow surface (a browser paints it;
   *  a headless node daemon rests the temp tiddler, never painting). Absent → pure data verbs, no render. */
  readonly tw5?: TW5Engine;
  /**
   * THIS vessel's own replica id — minted dots are keyed `<replica>.<n>`, so two devices never collide on
   * the same dot even when neither has seen the other's write. The caller should inject its own device key
   * (the same identity `cold-boot-ceremony` derives its `did` from) so the fleet's dots stay disjoint by
   * construction. OPTIONAL for back-compat with the one standing production call site
   * (`operator-daemon-behavior.ts`, out of this builder's lane) and every existing test: omitted falls back
   * to `DEFAULT_REPLICA`, which is SAFE for a single-device circle (no other replica ever mints that id) and
   * a known gap for a genuinely multi-device fleet until that call site injects its own `daemonAuth`-derived
   * DID here.
   */
  readonly replica?: string;
}

/** The fallback replica id when a caller injects none — safe for one device, a named gap for a fleet. */
const DEFAULT_REPLICA = "local";

/** The per-nym unfollow stamp: `mbr-:<nym>` (legacy) or `mbr-:<nym>#<dot>` holds the remove DOT. */
const MEMBER_RM_PREFIX = "mbr-:";

/** Separates a dotted field key's nym from its dot: `mbr+:<nym>#<replica>.<n>`. */
const DOT_SEP = "#";

function strArg(args: Record<string, unknown>, key: string): string {
  return typeof args[key] === "string" ? (args[key] as string).trim() : "";
}

/** The circle tiddler's mutable field bag (title + arbitrary fields, incl. the per-nym stamps). */
type CircleFields = Record<string, unknown>;

/** One parsed add- or remove-dot for a nym: its own dot id (`""` for a legacy, undotted stamp) and the set of
 *  opposite-kind dots it OBSERVED at write time (always empty for a legacy stamp — it observed nothing). */
interface DotEntry {
  readonly dot:      string;
  readonly observed: ReadonlySet<string>;
}

/** Parse a dotted field key's observed-set value: a comma-joined list of dot ids, or "" for none. Never a
 *  clock reading, never compared by magnitude — only set membership is ever read off it. */
function parseObservedSet(value: unknown): ReadonlySet<string> {
  if (typeof value !== "string" || value.length === 0) return new Set();
  return new Set(value.split(",").filter((s) => s.length > 0));
}

/** Split a field key on its prefix, returning the nym and its dot (`""` when the key carries no `#dot` —
 *  the legacy, undotted shape every pre-M5 writer still mints). */
function parseDotKey(key: string, prefix: string): { nym: string; dot: string } | null {
  if (!key.startsWith(prefix)) return null;
  const rest = key.slice(prefix.length);
  const i = rest.indexOf(DOT_SEP);
  return i === -1 ? { nym: rest, dot: "" } : { nym: rest.slice(0, i), dot: rest.slice(i + DOT_SEP.length) };
}

/** Collect every add- or remove-dot on this tiddler, grouped by nym. */
function collectDots(fields: CircleFields, prefix: string): Map<string, DotEntry[]> {
  const byNym = new Map<string, DotEntry[]>();
  for (const [key, value] of Object.entries(fields)) {
    if (typeof value !== "string") continue;
    const parsed = parseDotKey(key, prefix);
    if (!parsed) continue;
    const list = byNym.get(parsed.nym) ?? [];
    list.push({ dot: parsed.dot, observed: parseObservedSet(value) });
    byNym.set(parsed.nym, list);
  }
  return byNym;
}

function isSuperset(set: ReadonlySet<string>, subset: ReadonlySet<string>): boolean {
  for (const x of subset) if (!set.has(x)) return false;
  return true;
}

/**
 * Mint this replica's NEXT dot for a write landing on this circle tiddler: one past the highest `n` this
 * replica has observed in any of its own `<replica>.<n>` dots (add OR remove) on THIS tiddler. A writer only
 * ever advances past its own causal past — never a wall clock. Two DIFFERENT replicas never collide: each
 * only ever advances its own namespaced counter.
 */
function nextDotForReplica(fields: CircleFields, replica: string): string {
  const marker = `${DOT_SEP}${replica}.`;
  let max = -1;
  for (const key of Object.keys(fields)) {
    if (!key.startsWith(MEMBER_ADD_PREFIX) && !key.startsWith(MEMBER_RM_PREFIX)) continue;
    const idx = key.indexOf(marker);
    if (idx === -1) continue;
    const n = Number.parseInt(key.slice(idx + marker.length), 10);
    if (Number.isFinite(n) && n > max) max = n;
  }
  return `${replica}.${max + 1}`;
}

export interface FoldResult {
  /** Present nyms, sorted. */
  readonly present:    string[];
  /** Nyms where SOME add and SOME remove never observed each other at all — true concurrency, surfaced
   *  rather than silently resolved. Remove still wins (the nym reads absent either way). */
  readonly concurrent: string[];
}

/**
 * Fold a circle tiddler's fields into the PRESENT nym set (plus detected concurrency) — the observed-remove
 * CRDT read (M5). A nym with at least one add-dot stands PRESENT iff SOME add-dot's observed-removes is a
 * SUPERSET of every remove-dot currently on that nym (that add happened-after, or observed, every removal
 * this replica can see). A remove-dot no add has observed covers it either way — causally later, or fully
 * concurrent — so remove wins on both. True concurrency (an add and a remove that observed NEITHER other) is
 * named in `concurrent` rather than resolved silently.
 */
export function foldMembersDetailed(fields: CircleFields): FoldResult {
  const adds    = collectDots(fields, MEMBER_ADD_PREFIX);
  const removes = collectDots(fields, MEMBER_RM_PREFIX);
  const present: string[] = [];
  const concurrent: string[] = [];
  for (const [nym, addList] of adds) {
    const removeList = removes.get(nym) ?? [];
    const removeDots = new Set(removeList.map((r) => r.dot));
    const dominated = addList.some((a) => isSuperset(a.observed, removeDots));
    if (dominated) {
      present.push(nym);
      continue;
    }
    const trueConcurrent = addList.some((a) =>
      removeList.some((r) => !a.observed.has(r.dot) && !r.observed.has(a.dot)),
    );
    if (trueConcurrent) concurrent.push(nym);
  }
  present.sort();
  concurrent.sort();
  return { present, concurrent };
}

/** Present nyms alone — the shape every existing reader (circle-list, renderCircle) keys on. */
export function foldMembers(fields: CircleFields): string[] {
  return foldMembersDetailed(fields).present;
}

/** Read one circle's record + its folded present membership (+ detected concurrency) from the circles doc. */
async function readCircle(store: LarTiddlerStore, circle: string): Promise<{ record: LarTiddlerRecord | null; fields: CircleFields; members: string[]; concurrent: string[] }> {
  const record = await store.get(circleTiddlerUri(circle));
  const fields = (record?.tiddler ?? {}) as CircleFields;
  const { present, concurrent } = foldMembersDetailed(fields);
  return { record, fields, members: present, concurrent };
}

/** Render the daemon follow surface FROM the circles membership (positional fields the surface iterates by
 *  index). Petname/glamour ride BLANK — the worker holds no handle-book (the co-move fork); the follow-graph
 *  itself lands here, which is the recognition surface the operator ruled onto the circles doc. */
function renderCircle(tw5: TW5Engine | undefined, circle: string, members: readonly string[]): void {
  if (!tw5) return;
  const fields: Record<string, string> = {
    title: CIRCLE_STATE_TITLE,
    ts:    new Date().toISOString(),
    circle,
    count: String(members.length),
    list:  members.map((_, i) => String(i)).join(" "),
  };
  members.forEach((nym, i) => {
    fields[`nym-${i}`]     = nym;
    fields[`petname-${i}`] = "";
    fields[`glamour-${i}`] = "";
  });
  tw5.setTiddler(fields);
}

/**
 * circle-add — the FOLLOW: add a nym to a circle's per-nym membership stamps in the circles doc (idempotent — a re-add dedupes).
 * A non-system circle the operator names is BORN here (kind "Circle"). Writes ONLY the circles doc — never a board.
 */
export function makeCircleAddReactor(opts: CircleVerbOptions): VerbReactor {
  const replica = opts.replica ?? DEFAULT_REPLICA;
  return async (args) => {
    const circle = strArg(args, "circle");
    const nym    = strArg(args, "nym");
    if (!circle) throw new Error("circle-add: `circle` is required");
    if (!nym)    throw new Error("circle-add: `nym` is required");
    const store = await opts.resolveStore();
    const { fields: prevFields, members: prev } = await readCircle(store, circle);
    const added = !prev.includes(nym);
    const dot = nextDotForReplica(prevFields, replica);
    // This add's observed-set: every remove-dot (dotted or legacy) presently on THIS nym. A later fold that
    // reads this add's dot will treat it as dominant only if that set still covers every remove the nym
    // carries then — a remove this write never saw (because it lands concurrently, or strictly after) is
    // NOT in this set, so it is never silently absorbed.
    const observedRemoves = (collectDots(prevFields, MEMBER_RM_PREFIX).get(nym) ?? []).map((e) => e.dot);
    const stampKey = `${MEMBER_ADD_PREFIX}${nym}${DOT_SEP}${dot}`;
    // Stamp ONLY this nym's add-dot key — every OTHER member field rides through untouched (the `...prevFields`
    // spread re-asserts them, so the whole-record merge never drops a fleet-mate's key). `createdAt` is a
    // RENDER-ADVISORY timestamp only (never read by the fold) — the one wall-clock reading left in this
    // reactor, kept for a human to see when the circle was born.
    const next: LarTiddlerRecord = {
      tiddler: {
        ...prevFields,
        title:       circleTiddlerUri(circle),
        id:          circle,
        displayName: (typeof prevFields["displayName"] === "string" && prevFields["displayName"]) || circle,
        kind:        (typeof prevFields["kind"] === "string" && prevFields["kind"]) || "Circle",
        createdAt:   (typeof prevFields["createdAt"] === "string" && prevFields["createdAt"]) || new Date().toISOString(),
        [stampKey]:  observedRemoves.sort().join(","),
      } as LarTiddlerRecord["tiddler"],
      meta: { authority: "lares-verb" },
    };
    await store.put(next, { kind: "lares-verb", requestId: `circle-add-${dot}-${nym.slice(0, 8)}` });
    const members = foldMembers(next.tiddler as CircleFields);
    renderCircle(opts.tw5, circle, members);
    return { verb: "circle-add", circle, nym, members, added, federated: false };
  };
}

/**
 * circle-remove — the UNFOLLOW (kāpae, remove-wins): drop a nym from a circle's per-nym membership stamps. Idempotent (a
 * remove of an absent nym is a no-op; an absent circle stays uncreated). LOCAL to the circles doc — never a board.
 */
export function makeCircleRemoveReactor(opts: CircleVerbOptions): VerbReactor {
  const replica = opts.replica ?? DEFAULT_REPLICA;
  return async (args) => {
    const circle = strArg(args, "circle");
    const nym    = strArg(args, "nym");
    if (!circle) throw new Error("circle-remove: `circle` is required");
    if (!nym)    throw new Error("circle-remove: `nym` is required");
    const store = await opts.resolveStore();
    const { record, fields: prevFields, members: prev } = await readCircle(store, circle);
    const removed = prev.includes(nym);
    // Stamp this nym's REMOVE-DOT key whenever the circle EXISTS — even if the local view reads the nym
    // absent — so the tombstone outranks a concurrent add a fleet-mate made off-device that this replica
    // has not yet merged. An absent circle stays uncreated (nothing to unfollow). Only this one key is
    // touched; the dot's observed-set names every add-dot (dotted or legacy) presently on this nym.
    let members = prev.filter((m) => m !== nym);
    if (record) {
      const dot = nextDotForReplica(prevFields, replica);
      const observedAdds = (collectDots(prevFields, MEMBER_ADD_PREFIX).get(nym) ?? []).map((e) => e.dot);
      const stampKey = `${MEMBER_RM_PREFIX}${nym}${DOT_SEP}${dot}`;
      const next: LarTiddlerRecord = {
        tiddler: { ...prevFields, title: circleTiddlerUri(circle), [stampKey]: observedAdds.sort().join(",") } as LarTiddlerRecord["tiddler"],
        meta: { authority: "lares-verb" },
      };
      await store.put(next, { kind: "lares-verb", requestId: `circle-remove-${dot}-${nym.slice(0, 8)}` });
      members = foldMembers(next.tiddler as CircleFields);
    }
    renderCircle(opts.tw5, circle, members);
    return { verb: "circle-remove", circle, nym, members, removed, federated: false };
  };
}

/**
 * circle-list — READ the follow-view back from the circles doc's per-nym stamps. `circle` given → that circle's members
 * (+ a render); absent → every circle's membership. A pure read over the circles doc; it announces nothing.
 */
export function makeCircleListReactor(opts: CircleVerbOptions): VerbReactor {
  return async (args) => {
    const circle = strArg(args, "circle");
    const store  = await opts.resolveStore();
    if (circle) {
      const { members, concurrent } = await readCircle(store, circle);
      renderCircle(opts.tw5, circle, members);
      return { verb: "circle-list", circle, members, concurrent, federated: false };
    }
    // Every circle: the tiddlers under the namespace prefix. The plane's SELF-POINTER answers to that
    // face's own `circles-<tag>` and never carries this prefix at all, so it is skipped by shape rather
    // than by exclusion — as is any nested title.
    const prefix = `${CIRCLES_INNER}/`;
    const titles = (await store.listVisible()).sort();
    const circles: Array<{ circle: string; members: string[]; concurrent: string[] }> = [];
    for (const title of titles) {
      if (!title.startsWith(prefix)) continue;
      const id = title.slice(prefix.length);
      if (!id || id.includes("/")) continue;
      const { members, concurrent } = await readCircle(store, id);
      circles.push({ circle: id, members, concurrent });
    }
    return { verb: "circle-list", circles, federated: false };
  };
}

/** The three FOLLOW-GRAPH reactors over one circles store resolver — the bundle the daemon registers. */
export function makeCircleReactors(opts: CircleVerbOptions): { add: VerbReactor; remove: VerbReactor; list: VerbReactor } {
  return {
    add:    makeCircleAddReactor(opts),
    remove: makeCircleRemoveReactor(opts),
    list:   makeCircleListReactor(opts),
  };
}
