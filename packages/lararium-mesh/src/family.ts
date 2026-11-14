/**
 * family — THE ONE FAMILY LAW, and the consequence every meme-aware act names before it lands.
 *
 * A meme names a FAMILY of tiddlers under one address: a root and the slot records it holds. Three laws
 * once answered "which records make one family" (a title prefix, the `$fragment-parent` edge, the `kahea`
 * references a text holds) and they disagreed. One law stands here, and every door reads through it:
 *
 *   COMPONENT EDGES make the family. A record belongs to a root when its `$fragment-parent` chain climbs to
 *   that root, or when a member's text calls it by a `kahea` reference. Both name a PART of the meme: the
 *   part leaves with its root, as one change.
 *
 *   OPTIONAL REFERENCES cross families. A `loulou` or a `pranala` edge names ANOTHER meme. It never joins a
 *   family, never blocks an act and never cascades: where its target leaves, the edge dangles and the
 *   consequence names it under `leaves`.
 *
 *   A PREFIX HOLDS NO AUTHORITY. A `<root>/path` title stands as its own meme (or its own plain tiddler); a
 *   `<root>#…` title that carries no edge and that no member calls stands plain. The address grammar still
 *   composes a slot's title onto its root's (`<root>#/a/b`, one raw `#`), so a reader may NARROW its
 *   candidates by that shape; membership rests on the edges alone.
 *
 * AN ORPHAN: a record whose `$fragment-parent` chain reaches no standing record. It stays live, and the
 * house keeps and flags it (`orphanFamilies`), since a concurrent re-root may still rescue it.
 *
 * A DELETE CARRIES TWO MEANINGS over a layered recipe, and the act names which (`mode`). KĀPAE (the default,
 * and what every delete door raised before the name stood): a tombstone in a writable layer, which SHADOWS
 * every record of the title beneath it, so the wiki reads the title gone while lower layers still hold it.
 * REVEAL: the topmost record retracts to absent, so the cascade falls through and the record beneath
 * surfaces. Where the view lends its layers (`layersOf`), each act names the layers that hold the title and
 * what the wiki reads afterward (`shadowed`, `reveals`). A family applies one mode to every member.
 *
 * PURE AND ISOMORPHIC. Every function here reads the `FamilyView` it gets handed and nothing else: no
 * store, no clock, no engine. Node and browser import this one module. The view lends the text grammar
 * (`refs`), since the sigil scanner lives above this package.
 *
 * Meme: lar:///ha.ka.ba/lares/docs/pono/wiki-surface-scout#/meme-aware-actions
 */

import { CARRIER_TYPE } from "./carrier-type.js";

/** The field a slot record names its immediate enclosing record by (one level up, never the root). */
export const FRAGMENT_PARENT_FIELD = "$fragment-parent";

/** The prefix an orphan flag stands under: one alert per root, `$:/temp` so each device raises its own. */
export const MEME_ORPHAN_ALERT_PREFIX = "$:/temp/lares/alert/meme-orphan/";

/** The folder suffix orphan slot children project under, beside their root's stem: `<root-stem>.orphans/`. */
export const ORPHAN_FOLDER_SUFFIX = ".orphans";

/** The alert title one root's orphans raise. */
export function memeOrphanAlertTitle(root: string): string {
  return `${MEME_ORPHAN_ALERT_PREFIX}${root}`;
}

export type FamilyFields = Readonly<Record<string, unknown>>;

/** One reference a record's text names, resolved to a full title. */
export interface FamilyReference {
  /** `kahea`: a slot call, a COMPONENT of this meme. `loulou` · `pranala`: an edge to another meme, optional. */
  readonly kind: "kahea" | "loulou" | "pranala";
  readonly to: string;
}

/**
 * THE STORE VIEW a reading runs over: whatever holds tiddlers, as one consistent synchronous snapshot. Only
 * `titles` and `read` stand required; each other door widens what the reading can name.
 */
export interface FamilyView {
  /** Every live title the view holds. */
  titles(): Iterable<string>;
  /** The live fields under one title; undefined where the view holds none (absent or tombstoned). */
  read(title: string): FamilyFields | undefined;
  /** The references a record's text names. Absent, the reading follows parent edges alone. */
  refs?(title: string, fields: FamilyFields): readonly FamilyReference[];
  /** The live titles whose text references `title`. Absent, the reading scans the view through `refs`. */
  referrers?(title: string): readonly string[];
  /** The live titles whose `$fragment-parent` names `parent`. Absent, the reading scans `titles`. */
  childrenOf?(parent: string): readonly string[];
  /** The version (a seq, a heads digest) the view read `title` at; null where it holds none. */
  version?(title: string): string | null;
  /**
   * Every layer that holds a record of `title`, topmost first, each `live` or a raised `kapae`. Absent, a
   * delete's acts name no `holds`, `shadowed` or `reveals`.
   */
  layersOf?(title: string): ReadonlyArray<{ readonly bag: string; readonly state: "live" | "kapae" }>;
  /** The layer (bag) `title` resolves from. */
  bagOf?(title: string): string | null;
  /** Whether the caller's standing grant writes `bag`. Absent, every bag reads writable. */
  writable?(bag: string): boolean;
  /** The layer a write or a shadowing tombstone lands in where a record's own layer takes none. */
  workingBag?(): string | null;
  /** True where the seat reads only: every write-bearing act refuses `read-only-seat`. */
  readonly readOnly?: boolean;
}

export type FamilyPosition = "root" | "slot" | "field" | "plain";

export interface FamilyEdge {
  readonly from: string;
  readonly to: string;
  /** `component`: part of the meme (root to slot). `reference`: an optional edge to another meme. */
  readonly kind: "component" | "reference";
  /** Which record carries the edge: the child's parent field, a `kahea` call in the parent's text, or both. */
  readonly via: "parent" | "kahea" | "parent+kahea" | "loulou" | "pranala";
  /** Whether the edge's far end stands in the view. */
  readonly stands: boolean;
}

export interface FamilyReading {
  readonly title: string;
  /** Whether the view holds a live record under the title. */
  readonly stands: boolean;
  readonly position: FamilyPosition;
  /** The field named, for a `field` position. */
  readonly field: string | null;
  /** The family's root address; null for a plain tiddler. */
  readonly root: string | null;
  readonly rootStands: boolean;
  /** The record one component edge up; null for a root or a plain tiddler. */
  readonly parent: string | null;
  /** True for a slot whose chain reaches no standing record. */
  readonly orphan: boolean;
  /**
   * The family's standing records. A whole family: the root first, then its slots in title order. An orphan:
   * its fellow orphans under the same dead root, in title order, and no root.
   */
  readonly members: readonly string[];
  readonly edges: readonly FamilyEdge[];
}

/** The address a slot title composes onto: the title up to its fragment mark. */
export function rootAddressOf(title: string): string {
  const at = title.indexOf("#");
  return at < 0 ? title : title.slice(0, at);
}

function parentOf(fields: FamilyFields | undefined): string | null {
  const parent = fields?.[FRAGMENT_PARENT_FIELD];
  return typeof parent === "string" && parent.length > 0 ? parent : null;
}

/** THE ROOT LAW over fields alone: the carrier type, no fragment in the title, no parent edge. */
export function isFamilyRoot(title: string, fields: FamilyFields | undefined): boolean {
  return fields?.["type"] === CARRIER_TYPE && !title.includes("#") && parentOf(fields) === null;
}

const MAX_HOPS = 64;

interface Climb { readonly top: string; readonly reaches: boolean; readonly parent: string | null }

/** Climb the parent edges from a record. `reaches` reads true where the chain ends on a standing record. */
function climb(view: FamilyView, title: string, fields: FamilyFields): Climb {
  const first = parentOf(fields);
  if (first === null) return { top: title, reaches: true, parent: null };
  const seen = new Set<string>([title]);
  let cur = first;
  for (let hops = 0; hops < MAX_HOPS; hops++) {
    if (seen.has(cur)) return { top: rootAddressOf(cur), reaches: false, parent: first };
    seen.add(cur);
    const at = view.read(cur);
    if (at === undefined) return { top: rootAddressOf(cur), reaches: false, parent: first };
    const next = parentOf(at);
    if (next === null) return { top: cur, reaches: true, parent: first };
    cur = next;
  }
  return { top: rootAddressOf(cur), reaches: false, parent: first };
}

function kaheaOf(view: FamilyView, title: string, fields: FamilyFields): string[] {
  return (view.refs?.(title, fields) ?? []).filter((ref) => ref.kind === "kahea").map((ref) => ref.to);
}

function edgeChildrenOf(view: FamilyView, parent: string): string[] {
  if (view.childrenOf) return [...view.childrenOf(parent)];
  const prefix = `${rootAddressOf(parent)}#`;
  const out: string[] = [];
  for (const title of view.titles()) {
    if (!title.startsWith(prefix) || title === parent) continue;
    if (parentOf(view.read(title)) === parent) out.push(title);
  }
  return out;
}

/** The standing component closure beneath one record, with the edges that carry it (dangling calls included). */
function closure(view: FamilyView, top: string): { members: string[]; edges: FamilyEdge[] } {
  const members = new Set<string>([top]);
  const edges: FamilyEdge[] = [];
  const queue = [top];
  for (let i = 0; i < queue.length; i++) {
    const from = queue[i]!;
    const fields = view.read(from);
    if (fields === undefined) continue;
    const called = new Set(kaheaOf(view, from, fields));
    const byEdge = new Set(edgeChildrenOf(view, from));
    for (const to of [...new Set([...byEdge, ...called])].sort()) {
      const stands = view.read(to) !== undefined;
      const via = byEdge.has(to) ? (called.has(to) ? "parent+kahea" : "parent") : "kahea";
      // A record that names ANOTHER parent belongs there: a call alone never steals a part.
      if (stands && via === "kahea" && parentOf(view.read(to)) !== null) continue;
      edges.push({ from, to, kind: "component", via, stands });
      if (stands && !members.has(to)) { members.add(to); queue.push(to); }
    }
  }
  const slots = [...members].filter((t) => t !== top).sort();
  return { members: [top, ...slots], edges };
}

function referenceEdges(view: FamilyView, members: readonly string[]): FamilyEdge[] {
  const edges: FamilyEdge[] = [];
  for (const from of members) {
    const fields = view.read(from);
    if (fields === undefined) continue;
    for (const ref of view.refs?.(from, fields) ?? []) {
      if (ref.kind === "kahea") continue;
      edges.push({ from, to: ref.to, kind: "reference", via: ref.kind, stands: view.read(rootAddressOf(ref.to)) !== undefined });
    }
  }
  return edges;
}

/**
 * THE ROOT A TITLE'S PARENT CHAIN NAMES, and whether the chain reaches a standing record: the cheap half of
 * `familyOf`, which reads the chain alone and no member. A title the view does not hold answers its own
 * root address (the fragment-path law: `root#/a/b` names `root`) and `reaches: false`.
 */
export function familyRootOf(view: FamilyView, title: string): { readonly root: string; readonly reaches: boolean } {
  const fields = view.read(title);
  if (fields === undefined) return { root: rootAddressOf(title), reaches: false };
  const up = climb(view, title, fields);
  return { root: rootAddressOf(up.top), reaches: up.reaches };
}

/** Every standing orphan under one root address, in title order. */
export function orphansUnder(view: FamilyView, root: string): string[] {
  const prefix = `${root}#`;
  const out: string[] = [];
  for (const title of view.titles()) {
    if (!title.startsWith(prefix)) continue;
    const fields = view.read(title);
    if (fields === undefined || parentOf(fields) === null) continue;
    const up = climb(view, title, fields);
    if (!up.reaches && up.top === root) out.push(title);
  }
  return out.sort();
}

/**
 * EVERY ORPHAN THE VIEW HOLDS, grouped by the root address its chain names: one pass over the titles that
 * carry a fragment. The node projector and the browser mirror raise their flags from this one predicate.
 */
export function orphanFamilies(view: FamilyView): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const title of view.titles()) {
    if (!title.includes("#")) continue;
    const fields = view.read(title);
    if (fields === undefined || parentOf(fields) === null) continue;
    const up = climb(view, title, fields);
    if (up.reaches) continue;
    const held = out.get(up.top);
    if (held) held.push(title); else out.set(up.top, [title]);
  }
  for (const titles of out.values()) titles.sort();
  return out;
}

/**
 * WHERE A TITLE STANDS: its position, its family, and each edge's kind. Total over any title of any view:
 * an absent title reads `stands: false` and `plain`.
 */
export function familyOf(view: FamilyView, title: string, opts: { readonly field?: string } = {}): FamilyReading {
  const fields = view.read(title);
  const field = opts.field ?? null;
  const plain = (stands: boolean): FamilyReading =>
    ({ title, stands, position: "plain", field, root: null, rootStands: false, parent: null, orphan: false, members: stands ? [title] : [], edges: [] });
  if (fields === undefined) return plain(false);

  const up = climb(view, title, fields);
  if (up.parent !== null) {
    if (!up.reaches) {
      const members = orphansUnder(view, up.top);
      return { title, stands: true, position: "slot", field, root: up.top, rootStands: view.read(up.top) !== undefined, parent: up.parent, orphan: true, members, edges: [{ from: up.parent, to: title, kind: "component", via: "parent", stands: view.read(up.parent) !== undefined }] };
    }
    const family = closure(view, up.top);
    return { title, stands: true, position: "slot", field, root: up.top, rootStands: true, parent: up.parent, orphan: false, members: family.members, edges: [...family.edges, ...referenceEdges(view, family.members)] };
  }

  // No parent edge. A fragment title a standing member calls reads as a slot by reference.
  if (title.includes("#")) {
    const base = rootAddressOf(title);
    if (view.read(base) !== undefined && parentOf(view.read(base)) === null) {
      const family = closure(view, base);
      const call = family.edges.find((edge) => edge.to === title && edge.stands);
      if (call) return { title, stands: true, position: "slot", field, root: base, rootStands: true, parent: call.from, orphan: false, members: family.members, edges: [...family.edges, ...referenceEdges(view, family.members)] };
    }
    return plain(true);
  }

  const family = closure(view, title);
  if (!isFamilyRoot(title, fields) && family.members.length === 1) return plain(true);
  return {
    title, stands: true, position: field !== null ? "field" : "root", field, root: title, rootStands: true, parent: null, orphan: false,
    members: family.members, edges: [...family.edges, ...referenceEdges(view, family.members)],
  };
}

/**
 * Every standing record beneath `title` by parent edges, at every depth, in title order: answered whether or
 * not `title` itself still stands, so a shore reads what a record that just left held.
 */
export function edgeDescendantsOf(view: FamilyView, title: string): string[] {
  const seen = new Set<string>([title]);
  const queue = [title];
  for (let i = 0; i < queue.length; i++) {
    for (const child of edgeChildrenOf(view, queue[i]!)) {
      if (seen.has(child)) continue;
      seen.add(child);
      queue.push(child);
    }
  }
  return queue.slice(1).sort();
}

/** A record and every standing component beneath it: the record first, then its slots in title order. */
export function componentsBeneath(view: FamilyView, title: string): string[] {
  return view.read(title) === undefined ? [] : closure(view, title).members;
}

/** The standing titles of the family a root address heads: the root and its component slots. Empty where no root stands. */
export function familyMembers(view: FamilyView, root: string): string[] {
  const fields = view.read(root);
  if (fields === undefined || parentOf(fields) !== null) return [];
  return closure(view, root).members;
}

// ─────────────────────────────────────────────────────────────────────────────────────────────────────────
// THE CONSEQUENCE
// ─────────────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * AN ACT ON ONE TARGET. `bare` names the tiddler-level act (the one title and nothing else); absent, the
 * act reads meme-aware and widens to the family by the gradient.
 */
export type FamilyAct =
  /** `mode`: `kapae` (default) shadows the title from a writable layer; `reveal` retracts the topmost record so the one beneath surfaces. */
  | { readonly kind: "delete"; readonly title: string; readonly bare?: boolean; readonly mode?: DeleteMode }
  /** `lands`: every title the new content lands (the root and each slot it declares). Absent, the one title lands. */
  | { readonly kind: "put"; readonly title: string; readonly lands?: readonly string[]; readonly bare?: boolean }
  | { readonly kind: "rename"; readonly title: string; readonly to: string; readonly bare?: boolean }
  /** `withRoot`: a slot subject carries its root's whole family (the caller named the root). */
  | { readonly kind: "move" | "copy"; readonly title: string; readonly toBag?: string; readonly toWiki?: string; readonly bare?: boolean; readonly withRoot?: boolean }
  | { readonly kind: "field"; readonly title: string; readonly field: string; readonly value: string | null };

export type DeleteMode = "kapae" | "reveal";

export type FamilyRefusalCode =
  | "absent"                         // the view holds no live record under the target
  | "slot-without-root"              // a slot moves, copies or re-titles only with the root that holds it
  | "family-spans-unwritable-layer"  // a member rests in a bag the grant cannot write and no working layer shadows it
  | "rename-target-stands"           // a record already stands at a title the rename would take
  | "reveal-top-unwritable"          // a reveal retracts the topmost record, and the grant cannot write the layer that holds it
  | "read-only-seat";                // the seat reads only

export interface ConsequenceAct {
  readonly title: string;
  /** `retract` removes a record to absent (a move's source), where `tombstone` shadows. */
  readonly act: "put" | "tombstone" | "retitle" | "retract";
  /** The layer the act lands in; null where the view names none. */
  readonly bag: string | null;
  /** The new title, for a `retitle`. */
  readonly to?: string;
  /** The layer the record rests in, where the act lands above it as a shadow. */
  readonly shadows?: string;
  /** The wiki the act lands in, for a move or copy across wikis. */
  readonly wiki?: string;
  /** A delete, where the view lends its layers: every layer holding a live record of the title, topmost first. */
  readonly holds?: readonly string[];
  /** A kāpae delete: the layers whose live records the tombstone shadows (they stay in their bags; the wiki reads the title gone). */
  readonly shadowed?: readonly string[];
  /** A reveal delete: the layer whose record the wiki reads afterward; null where nothing surfaces (the title reads absent). */
  readonly reveals?: string | null;
}

export interface Consequence {
  readonly act: FamilyAct["kind"];
  readonly target: string;
  readonly bare: boolean;
  readonly position: FamilyPosition;
  /** The family's root address; null for a plain tiddler. */
  readonly family: string | null;
  /** Every write the act lands. One family's acts in one bag land as ONE change. */
  readonly acts: readonly ConsequenceAct[];
  /** What stays behind, each with its reason: a dangling reference, a path child, a read-only root. */
  readonly leaves: ReadonlyArray<{ readonly title: string; readonly why: string }>;
  /** Records the act would leave live under a dead or absent root. */
  readonly orphans: readonly string[];
  /** Why the act refuses. A consequence that names one lands nothing. */
  readonly refusals: ReadonlyArray<{ readonly title: string; readonly code: FamilyRefusalCode }>;
  /** The version of every title the reading read or the act would write: a later apply binds to these. */
  readonly versions: Readonly<Record<string, string | null>>;
}

/** The titles a root's address prefixes by path: each stands as its own meme, and the family law leaves it. */
function pathChildren(view: FamilyView, root: string): string[] {
  const prefix = `${root}/`;
  const out: string[] = [];
  for (const title of view.titles()) if (title.startsWith(prefix) && !title.includes("#")) out.push(title);
  return out.sort();
}

function inboundReferences(view: FamilyView, members: readonly string[]): Array<{ title: string; kind: string }> {
  const inside = new Set(members);
  const targets = new Set(members);
  const out: Array<{ title: string; kind: string }> = [];
  const weigh = (from: string): void => {
    if (inside.has(from)) return;
    const fields = view.read(from);
    if (fields === undefined) return;
    for (const ref of view.refs?.(from, fields) ?? []) {
      if (ref.kind === "kahea") continue;
      if (targets.has(ref.to) || targets.has(rootAddressOf(ref.to))) { out.push({ title: from, kind: ref.kind }); return; }
    }
  };
  if (view.referrers) {
    const seen = new Set<string>();
    for (const member of members) for (const from of view.referrers(member)) if (!seen.has(from)) { seen.add(from); weigh(from); }
  } else if (view.refs) {
    for (const from of view.titles()) weigh(from);
  }
  return out.sort((a, b) => (a.title < b.title ? -1 : a.title > b.title ? 1 : 0));
}

/**
 * THE CONSEQUENCE of one act on one target, computed before anything lands. Pure: it reads the view and
 * writes nothing. The same function answers on node and in the browser, for a preview and for the door
 * that lands the act, so the two can never read the family differently.
 */
export function consequence(view: FamilyView, act: FamilyAct): Consequence {
  const touched = new Set<string>();
  const tracked: FamilyView = {
    ...view,
    titles: () => view.titles(),
    read: (title) => { touched.add(title); return view.read(title); },
  };
  const reading = familyOf(tracked, act.title, act.kind === "field" ? { field: act.field } : {});
  const bare = "bare" in act && act.bare === true;
  const acts: ConsequenceAct[] = [];
  const leaves: Array<{ title: string; why: string }> = [];
  const orphans: string[] = [];
  const refusals: Array<{ title: string; code: FamilyRefusalCode }> = [];

  const bagOf = (title: string): string | null => view.bagOf?.(title) ?? null;
  const writes = (bag: string | null): boolean => bag === null || view.writable === undefined || view.writable(bag);
  /** Where a write of `title` lands: its own layer where the grant writes it, else the working layer above it. */
  const landing = (title: string): { bag: string | null; shadows?: string } | null => {
    const own = bagOf(title);
    if (writes(own)) return { bag: own };
    const working = view.workingBag?.() ?? null;
    if (working === null || !writes(working)) return null;
    return { bag: working, shadows: own! };
  };
  const shadowingAct = (title: string, kind: "put" | "tombstone"): void => {
    const at = landing(title);
    if (at === null) { refusals.push({ title, code: "family-spans-unwritable-layer" }); return; }
    acts.push({ title, act: kind, bag: at.bag, ...(at.shadows !== undefined ? { shadows: at.shadows } : {}) });
    if (at.shadows !== undefined) leaves.push({ title, why: `stands-beneath:${at.shadows}` });
  };
  const mode: DeleteMode = act.kind === "delete" && act.mode === "reveal" ? "reveal" : "kapae";
  /** One member leaves, by the delete's mode: a kāpae tombstone that shadows, or a retract that reveals. */
  const leaveAct = (title: string): void => {
    const layers = view.layersOf?.(title);
    const holds = layers?.filter((layer) => layer.state === "live").map((layer) => layer.bag);
    if (mode === "kapae") {
      const at = landing(title);
      if (at === null) { refusals.push({ title, code: "family-spans-unwritable-layer" }); return; }
      acts.push({
        title, act: "tombstone", bag: at.bag, ...(at.shadows !== undefined ? { shadows: at.shadows } : {}),
        ...(holds !== undefined ? { holds, shadowed: holds.filter((bag) => bag !== at.bag) } : {}),
      });
      if (at.shadows !== undefined) leaves.push({ title, why: `stands-beneath:${at.shadows}` });
      return;
    }
    const own = bagOf(title);
    if (!writes(own)) {
      // The target must retract or the act means nothing; a fellow member this hand holds no record of stays as it reads.
      if (title === act.title) refusals.push({ title, code: "reveal-top-unwritable" });
      else leaves.push({ title, why: `reveal-keeps:${own}` });
      return;
    }
    // What surfaces: the next layer beneath the retracted one that holds any record; a kāpae there still shadows.
    const at = layers?.findIndex((layer) => layer.bag === own) ?? -1;
    const beneath = layers !== undefined && at >= 0 ? layers[at + 1] : undefined;
    acts.push({
      title, act: "retract", bag: own,
      ...(holds !== undefined ? { holds, reveals: beneath !== undefined && beneath.state === "live" ? beneath.bag : null } : {}),
    });
    if (beneath !== undefined && beneath.state === "live") leaves.push({ title, why: `revealed-from:${beneath.bag}` });
  };
  const namePathChildren = (root: string): void => {
    for (const title of pathChildren(tracked, root)) leaves.push({ title, why: "path-child-stands-as-its-own-meme" });
  };
  const nameDanglers = (members: readonly string[]): void => {
    for (const ref of inboundReferences(tracked, members)) leaves.push({ title: ref.title, why: `reference-dangles:${ref.kind}` });
  };
  /** The slot's own subtree: the slot and every component beneath it. */
  const subtreeOf = (slot: string): string[] => closure(tracked, slot).members;
  const callsByKahea = (parent: string, child: string): boolean =>
    reading.edges.some((edge) => edge.from === parent && edge.to === child && (edge.via === "kahea" || edge.via === "parent+kahea"));

  const done = (): Consequence => {
    if (view.readOnly === true && acts.length > 0) refusals.push({ title: act.title, code: "read-only-seat" });
    for (const row of acts) { touched.add(row.title); if (row.to !== undefined) touched.add(row.to); }
    const versions: Record<string, string | null> = {};
    for (const title of [...touched].sort()) versions[title] = view.version?.(title) ?? null;
    return { act: act.kind, target: act.title, bare, position: reading.position, family: reading.root, acts, leaves, orphans, refusals, versions };
  };

  if (!reading.stands && act.kind !== "put") {
    refusals.push({ title: act.title, code: "absent" });
    return done();
  }
  const isRoot = reading.position === "root" || reading.position === "field";
  const slots = isRoot ? reading.members.filter((t) => t !== act.title) : [];

  switch (act.kind) {
    case "delete": {
      if (isRoot) {
        if (bare) {
          leaveAct(act.title);
          orphans.push(...slots);
        } else {
          for (const member of reading.members) leaveAct(member);
        }
        namePathChildren(act.title);
        nameDanglers(bare ? [act.title] : reading.members);
      } else if (reading.position === "slot") {
        const subtree = subtreeOf(act.title);
        if (bare) {
          leaveAct(act.title);
          orphans.push(...subtree.filter((t) => t !== act.title));
        } else {
          for (const member of subtree) leaveAct(member);
        }
        const parent = reading.parent;
        if (parent !== null && !reading.orphan && callsByKahea(parent, act.title)) {
          const at = bare ? null : landing(parent);
          // The parent's call drops in the same change where the grant writes the parent's own layer.
          if (at !== null && at.shadows === undefined) acts.push({ title: parent, act: "put", bag: at.bag });
          else leaves.push({ title: parent, why: "reference-dangles:kahea" });
        }
        nameDanglers(bare ? [act.title] : subtree);
      } else {
        leaveAct(act.title);
        nameDanglers([act.title]);
      }
      break;
    }
    case "put": {
      const lands = act.lands ?? [act.title];
      for (const title of lands) shadowingAct(title, "put");
      if (act.lands !== undefined) {
        // What stood beneath the target: a root's slots, a slot's own subtree, the orphans a dead root left.
        const beneath = isRoot ? slots
          : reading.position === "slot" ? subtreeOf(act.title).filter((t) => t !== act.title)
          : !reading.stands ? orphansUnder(tracked, act.title)
          : [];
        const fresh = new Set(lands);
        for (const slot of beneath) {
          if (fresh.has(slot)) continue;
          if (bare) leaves.push({ title: slot, why: "slot-no-longer-declared" });
          else shadowingAct(slot, "tombstone");
        }
      }
      if (reading.position === "slot" && reading.root !== null && !reading.orphan) {
        const rootBag = bagOf(reading.root);
        leaves.push({ title: reading.root, why: writes(rootBag) ? "family-hash-moves" : `read-only:${rootBag}` });
      }
      if (reading.orphan) orphans.push(act.title);
      break;
    }
    case "rename": {
      const retitle = (title: string, to: string): void => {
        if (tracked.read(to) !== undefined) refusals.push({ title: to, code: "rename-target-stands" });
        const own = bagOf(title);
        if (!writes(own)) refusals.push({ title, code: "family-spans-unwritable-layer" });
        acts.push({ title, act: "retitle", bag: own, to });
      };
      if (isRoot) {
        retitle(act.title, act.to);
        if (bare) orphans.push(...slots);
        else for (const slot of slots) retitle(slot, act.to + slot.slice(act.title.length));
        namePathChildren(act.title);
        nameDanglers(bare ? [act.title] : reading.members);
      } else if (reading.position === "slot") {
        if (bare) {
          retitle(act.title, act.to);
          if (reading.parent !== null) leaves.push({ title: reading.parent, why: "reference-dangles:kahea" });
          orphans.push(...subtreeOf(act.title).filter((t) => t !== act.title));
        } else {
          refusals.push({ title: act.title, code: "slot-without-root" });
        }
      } else {
        retitle(act.title, act.to);
      }
      break;
    }
    case "move":
    case "copy": {
      const toBag = act.toBag ?? null;
      const carry = (title: string): void => {
        acts.push({ title, act: "put", bag: toBag, ...(act.toWiki !== undefined ? { wiki: act.toWiki } : {}) });
        if (act.kind !== "move") return;
        const own = bagOf(title);
        if (!writes(own)) refusals.push({ title, code: "family-spans-unwritable-layer" });
        acts.push({ title, act: "retract", bag: own });
      };
      if (isRoot) {
        if (bare) { carry(act.title); if (act.kind === "move") orphans.push(...slots); else leaves.push(...slots.map((title) => ({ title, why: "slot-stays-with-source" }))); }
        else for (const member of reading.members) carry(member);
        namePathChildren(act.title);
      } else if (reading.position === "slot") {
        if (bare) {
          carry(act.title);
          orphans.push(act.title);
          if (act.kind === "move" && reading.parent !== null) leaves.push({ title: reading.parent, why: "reference-dangles:kahea" });
        } else if (act.withRoot === true && reading.root !== null && !reading.orphan) {
          for (const member of reading.members) carry(member);
          namePathChildren(reading.root);
        } else {
          refusals.push({ title: act.title, code: "slot-without-root" });
          if (reading.root !== null) leaves.push({ title: reading.root, why: "the-caller-names-the-root" });
        }
      } else {
        carry(act.title);
      }
      break;
    }
    case "field": {
      shadowingAct(act.title, "put");
      if (reading.position === "field") leaves.push({ title: act.title, why: "block-check-re-mints" });
      if (reading.position === "slot" && reading.root !== null && !reading.orphan) {
        const rootBag = bagOf(reading.root);
        leaves.push({ title: reading.root, why: writes(rootBag) ? "family-hash-moves" : `read-only:${rootBag}` });
      }
      break;
    }
  }
  return done();
}

/** The tombstones a consequence lands, in the order it names them. */
export function tombstonesOf(c: Consequence): string[] {
  return c.acts.filter((row) => row.act === "tombstone").map((row) => row.title);
}

/** The retracts a consequence lands (a reveal delete, a move's source), in the order it names them. */
export function retractsOf(c: Consequence): string[] {
  return c.acts.filter((row) => row.act === "retract").map((row) => row.title);
}
