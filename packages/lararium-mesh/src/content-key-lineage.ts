/**
 * content-key-lineage — a bag's key versions as a causal lineage, and the roll that extends it.
 *
 * A bag's content key rolls at causal acts and never by a clock. Each key version cites its parent versions,
 * so the versions form a DAG, and the HEADS name the versions no other version cites. Nothing ranks two
 * versions: no clock, no arrival order and no id comparison picks a winner. Ids sort only to give one order
 * of output.
 *
 * A SPAN names a run of versions that share one causal base. A span takes the id of the version that opens
 * it and declares, at that opening, whether its history stands shareable; every version inside it carries
 * the same declaration.
 *
 *   founding    no parents; opens the first span
 *   removal     one or more parents, all of one span; the span continues
 *   admission   one or more parents; opens a new span (a from-now admission)
 *   join        two or more parents; one span continues it, unlike spans open a new one
 *
 * THE LINEAGE COUNTS A SUCCESSOR ONLY WHERE ITS TRANSITION VERIFIES. The caller supplies the evidence: the
 * reader's own ledger for a raise, its own reading of an admission act, and the proofs of a join.
 *
 * TWO UNLIKE FACTS UNDER ONE ID REFUSE BOTH, AND THEIR DESCENDANTS LEAVE THE READINGS WITH THEM. A version
 * STANDS only where every version in its causal past stands. The rule holds whatever order the facts arrived
 * in, so two readers that met the same facts end at the same heads; a first-seen winner would let them part
 * in silence. The conflict shows at every door, and the bag continues only from a version that descends from
 * neither fact.
 *
 * THE ROLL reads the lineage alone and keeps no memory of its own: a vessel owes a roll for a raise until it
 * holds a version that descends from a successor for that raise. Raises a vessel answers together share one
 * successor. Two vessels that count one raise from one head mint two siblings, and both stand until a writer
 * that holds every head joins them.
 *
 * THE SEAT ROLL FEEDS IT. A vessel that answers a counted raise hands one `SeatRoll` to its subscribers
 * (`seat-duties`, lar:///ha.ka.ba/lares/api/pono/kapae#/keys). `contentKeyRollSink` stands as that subscriber:
 * it rolls each bag the roll's scope reaches, keys its work on the scope and each raise, tolerates a repeat,
 * and REJECTS a roll it could not finish, so the vessel hands the same roll over again.
 *
 * Pure: no I/O, no clock, no timer, no random source. Stands specified in code until a composition subscribes
 * the sink and the lockbox store mints a key; out of the package barrel till then.
 * Canon: lar:///ha.ka.ba/lararium/mesh/sealed-store#/epochs · #/siblings
 */
import { isWellFormedText, readKeyVersionId, type KeyVersionId } from "./sealed-chunk.js";
import type { SeatRoll, SeatRollSink } from "./seat-duties.js";

// ── Facts ───────────────────────────────────────────────────────────────────────────────────────
export type KeyCause =
  | { readonly kind: "founding" }
  | { readonly kind: "removal";   readonly acts: readonly string[] }   // the ids of the counted raises it answers: unique, sorted, never empty
  | { readonly kind: "admission"; readonly act: string }   // the id of the from-now admission act
  | { readonly kind: "join" };
export const HISTORY_DECLARATIONS = ["shareable", "closed"] as const;
export type HistoryDeclaration = (typeof HISTORY_DECLARATIONS)[number];

/** What one counted key version record states. */
export interface KeyVersionFact {
  readonly keyVersion: KeyVersionId;
  /** Unique, sorted ascending. */
  readonly parents:    readonly KeyVersionId[];
  readonly span:       KeyVersionId;
  readonly history:    HistoryDeclaration;
  readonly cause:      KeyCause;
}

/** What the caller verified outside this module. The lineage asks; it never assumes. A caller builds the
 *  evidence for ONE bag: every answer speaks for that bag's own scope, and a raise or an admission act that
 *  counts in another scope answers false here. */
export interface TransitionEvidence {
  /** The reader's own ledger counts this raise, on an edge of this bag's own scope. */
  raiseCounts(act: string): boolean;
  /** The reader verified this admission act. */
  admissionVerifies(act: string): boolean;
  /** Every parent proof the reader could check passed. */
  joinProven(fact: KeyVersionFact): boolean;
}

export const LINEAGE_REFUSALS = [
  "version-malformed",      // bad ids, unsorted or repeated parents, an empty act, an unknown kind or history
  "version-conflict",       // an unlike fact already stands under this id: both refuse from then on
  "parent-unknown",         // a parent the lineage has not counted, or one that stands conflicted
  "second-founding",        // a founding where the lineage already holds a version
  "founding-shape",         // a founding with parents, or whose span differs from its own id
  "span-rule-broken",       // the span or history the fact names breaks the rule of its cause
  "cause-unverified",       // the evidence answers false for a removal's raise or an admission's act
  "join-too-few",           // a join that cites fewer than two parents
  "join-unproven",          // the evidence answers false for a join's proofs
] as const;
export type LineageRefusalName = (typeof LINEAGE_REFUSALS)[number];

/** A count answers the lineage that now holds the fact, or a named refusal. A `version-conflict` also hands
 *  back the lineage that now marks the id conflicted: the caller keeps THAT lineage. */
export type CountResult =
  | { readonly lineage: KeyLineage }
  | { readonly refusal: Exclude<LineageRefusalName, "version-conflict"> }
  | { readonly refusal: "version-conflict"; readonly conflicted: KeyLineage };

const ascending = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);
const isHistory = (value: unknown): value is HistoryDeclaration => (HISTORY_DECLARATIONS as readonly unknown[]).includes(value);
/** An act id: non-empty, well-formed text, so no two unlike ids share one encoding. */
const isAct = (act: unknown): act is string => isWellFormedText(act);
/** The acts a cause names, as one comparable list. */
const actsOf = (cause: KeyCause): readonly string[] => (cause.kind === "removal" ? cause.acts : cause.kind === "admission" ? [cause.act] : []);

/** Read a list of act ids: each a non-empty string, unique, in ascending order, at least one. */
export function readActs(value: unknown): readonly string[] | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  for (let i = 0; i < value.length; i++) {
    if (!isAct(value[i]) || (i > 0 && !(value[i - 1] < value[i]))) return null;
  }
  return Object.freeze([...value] as string[]);
}

function readCause(value: unknown): KeyCause | null {
  if (typeof value !== "object" || value === null) return null;
  const { kind, act, acts } = value as { kind?: unknown; act?: unknown; acts?: unknown };
  if (kind === "founding" || kind === "join") return Object.freeze({ kind });
  if (kind === "admission" && isAct(act)) return Object.freeze({ kind, act });
  if (kind === "removal") {
    const read = readActs(acts);
    return read === null ? null : Object.freeze({ kind, acts: read });
  }
  return null;
}

function readFact(value: unknown): KeyVersionFact | null {
  try {
    if (typeof value !== "object" || value === null) return null;
    const { keyVersion, parents, span, history, cause } = value as KeyVersionFact;
    const read = readCause(cause);
    if (readKeyVersionId(keyVersion) === null || readKeyVersionId(span) === null || !isHistory(history) || read === null || !Array.isArray(parents)) return null;
    for (let i = 0; i < parents.length; i++) {
      if (readKeyVersionId(parents[i]) === null || parents[i] === keyVersion) return null;
      if (i > 0 && !(parents[i - 1]! < parents[i]!)) return null;
    }
    return Object.freeze({ keyVersion, parents: Object.freeze([...parents]), span, history, cause: read });
  } catch { return null; }
}

function sameFact(a: KeyVersionFact, b: KeyVersionFact): boolean {
  return a.keyVersion === b.keyVersion && a.span === b.span && a.history === b.history
    && a.parents.length === b.parents.length && a.parents.every((parent, i) => parent === b.parents[i])
    && a.cause.kind === b.cause.kind && actsOf(a.cause).length === actsOf(b.cause).length
    && actsOf(a.cause).every((act, i) => act === actsOf(b.cause)[i]);
}

function answers(ask: () => boolean): boolean {
  try { return ask() === true; } catch { return false; }
}

// ── The lineage ─────────────────────────────────────────────────────────────────────────────────
/** Immutable. Every method answers a new lineage or a reading; none changes this one. */
export class KeyLineage {
  /** Every fact counted whose own id stands unconflicted. */
  readonly #counted: ReadonlyMap<KeyVersionId, KeyVersionFact>;
  readonly #conflicted: ReadonlySet<KeyVersionId>;
  /** The counted facts whose whole causal past stands: what every reading and every plan reads. */
  readonly #facts: ReadonlyMap<KeyVersionId, KeyVersionFact>;

  private constructor(counted: ReadonlyMap<KeyVersionId, KeyVersionFact>, conflicted: ReadonlySet<KeyVersionId>) {
    this.#counted = counted;
    this.#conflicted = conflicted;
    // A fact enters only after its parents (a count checks them), so one pass in insertion order settles standing.
    const standing = new Map<KeyVersionId, KeyVersionFact>();
    for (const [id, fact] of counted) if (fact.parents.every((parent) => standing.has(parent))) standing.set(id, fact);
    this.#facts = standing;
    Object.freeze(this);
  }

  static empty(): KeyLineage { return new KeyLineage(new Map(), new Set()); }

  /** Count one fact. The checks run: shape, conflict, parents, the cause's own shape, the span rule, the evidence. */
  count(input: unknown, evidence: TransitionEvidence): CountResult {
    const fact = readFact(input);
    if (fact === null) return { refusal: "version-malformed" };
    if (this.#conflicted.has(fact.keyVersion)) return { refusal: "version-conflict", conflicted: this };
    const counted = this.#counted.get(fact.keyVersion);
    if (counted !== undefined) {
      if (sameFact(counted, fact)) return { lineage: this };
      const rest = new Map(this.#counted);
      rest.delete(fact.keyVersion);
      return { refusal: "version-conflict", conflicted: new KeyLineage(rest, new Set([...this.#conflicted, fact.keyVersion])) };
    }
    const parents: KeyVersionFact[] = [];
    for (const id of fact.parents) {
      const parent = this.#facts.get(id);
      if (parent === undefined) return { refusal: "parent-unknown" };
      parents.push(parent);
    }
    const spans = new Set(parents.map((parent) => parent.span));
    const opensSpan = fact.span === fact.keyVersion;
    /** The version continues the one span all its parents share, under that span's own declaration. */
    const continues = (): boolean => spans.size === 1 && fact.span === parents[0]!.span && fact.history === this.historyOfSpan(fact.span);
    switch (fact.cause.kind) {
      case "founding":
        if (!this.unfounded) return { refusal: "second-founding" };
        if (parents.length > 0 || !opensSpan) return { refusal: "founding-shape" };
        break;
      case "removal":
        if (parents.length < 1 || !continues()) return { refusal: "span-rule-broken" };
        break;
      case "admission":
        if (parents.length < 1 || !opensSpan) return { refusal: "span-rule-broken" };
        break;
      case "join":
        if (parents.length < 2) return { refusal: "join-too-few" };
        if (spans.size === 1 ? !continues() : !opensSpan) return { refusal: "span-rule-broken" };
        break;
    }
    const cause = fact.cause;
    if (cause.kind === "removal" && !cause.acts.every((act) => answers(() => evidence.raiseCounts(act)))) return { refusal: "cause-unverified" };
    if (cause.kind === "admission" && !answers(() => evidence.admissionVerifies(cause.act))) return { refusal: "cause-unverified" };
    if (cause.kind === "join" && !answers(() => evidence.joinProven(fact))) return { refusal: "join-unproven" };
    const next = new Map(this.#counted);
    next.set(fact.keyVersion, fact);
    return { lineage: new KeyLineage(next, this.#conflicted) };
  }

  /** Does the version stand: counted, unconflicted, with its whole causal past standing? */
  has(id: KeyVersionId): boolean { return this.#facts.has(id); }
  fact(id: KeyVersionId): KeyVersionFact | null { return this.#facts.get(id) ?? null; }
  conflicted(id: KeyVersionId): boolean { return this.#conflicted.has(id); }
  /** Has no fact ever counted here? A bag whose founding stands conflicted reads founded, with no head. */
  get unfounded(): boolean { return this.#counted.size === 0 && this.#conflicted.size === 0; }

  /** The versions no counted version cites, sorted ascending. */
  heads(): readonly KeyVersionId[] {
    const cited = new Set<KeyVersionId>();
    for (const fact of this.#facts.values()) for (const parent of fact.parents) cited.add(parent);
    return Object.freeze([...this.#facts.keys()].filter((id) => !cited.has(id)).sort(ascending));
  }
  forked(): boolean { return this.heads().length > 1; }

  /** Every counted version of `span`, sorted ascending; empty for an unknown span. */
  versionsOfSpan(span: KeyVersionId): readonly KeyVersionId[] {
    return Object.freeze([...this.#facts.values()].filter((fact) => fact.span === span).map((fact) => fact.keyVersion).sort(ascending));
  }
  /** The declaration a span carries: its opener's where that stands counted, else any member's (they agree). */
  historyOfSpan(span: KeyVersionId): HistoryDeclaration | null {
    const opener = this.#facts.get(span);
    if (opener !== undefined) return opener.history;
    for (const fact of this.#facts.values()) if (fact.span === span) return fact.history;
    return null;
  }

  /** Does `ancestor` stand in the causal past of `descendant`, or equal it? */
  descends(descendant: KeyVersionId, ancestor: KeyVersionId): boolean {
    if (!this.#facts.has(descendant) || !this.#facts.has(ancestor)) return false;
    return this.#someAncestor(descendant, (fact) => fact.keyVersion === ancestor);
  }
  /** Does `id`, or any version in its causal past, satisfy `test`? */
  #someAncestor(id: KeyVersionId, test: (fact: KeyVersionFact) => boolean): boolean {
    const seen = new Set<KeyVersionId>();
    const todo = [id];
    while (todo.length > 0) {
      const next = todo.pop()!;
      if (seen.has(next)) continue;
      seen.add(next);
      const fact = this.#facts.get(next);
      if (fact === undefined) continue;
      if (test(fact)) return true;
      todo.push(...fact.parents);
    }
    return false;
  }
  /** Does `id` descend from, or stand as, a successor minted for the removal `act`? */
  followsRemoval(id: KeyVersionId, act: string): boolean {
    return this.#someAncestor(id, (fact) => fact.cause.kind === "removal" && fact.cause.acts.includes(act));
  }
}

// ── The roll ────────────────────────────────────────────────────────────────────────────────────
/** What a vessel plans to mint. `span: "self"` means the new version opens a span and takes its own id. */
export interface KeyRollPlan {
  /** Sorted ascending. */
  readonly parents: readonly KeyVersionId[];
  readonly span:    KeyVersionId | "self";
  readonly history: HistoryDeclaration;
  readonly cause:   KeyCause;
}
export const ROLL_REFUSALS = [
  "bag-unfounded",        // the lineage holds no version
  "bag-founded",          // a founding plan where a version already stands
  "own-edge-shadowed",    // a vessel that reads a shadow over its own edge mints no further version
  "already-rolled",       // the vessel already holds a successor for this raise
  "no-head-held",         // the vessel holds no head's key
  "join-owed",            // one plan got asked for, and the heads the vessel holds sit in unlike spans
  "heads-not-all-held",   // a join needs every head
  "nothing-to-join",      // a join with fewer than two heads
  "history-closed",       // a with-past admission into a span declared closed
  "act-malformed",
  "history-malformed",
] as const;
export type RollRefusalName = (typeof ROLL_REFUSALS)[number];
export type Planned = { readonly plan: KeyRollPlan } | { readonly refusal: RollRefusalName };

const planned = (parents: readonly KeyVersionId[], span: KeyVersionId | "self", history: HistoryDeclaration, cause: KeyCause): Planned =>
  ({ plan: Object.freeze({ parents: Object.freeze([...parents].sort(ascending)), span, history, cause: Object.freeze(cause) }) });
const heldHeads = (lineage: KeyLineage, held: ReadonlySet<KeyVersionId>): KeyVersionId[] => lineage.heads().filter((head) => held.has(head));
const spansOf = (lineage: KeyLineage, ids: readonly KeyVersionId[]): KeyVersionId[] => [...new Set(ids.map((id) => lineage.fact(id)!.span))];

/** The first version of a bag. */
export function planFounding(lineage: KeyLineage, history: HistoryDeclaration): Planned {
  if (!isHistory(history)) return { refusal: "history-malformed" };
  if (!lineage.unfounded) return { refusal: "bag-founded" };
  return planned([], "self", history, { kind: "founding" });
}

/**
 * Does this vessel still owe a roll for `act`? It owes one while any HEAD it holds stands outside the causal
 * future of a successor minted for that raise. A successor it counted and cannot open settles nothing, and a
 * vessel that holds no head has settled nothing.
 */
export function owesRoll(lineage: KeyLineage, act: string, held: ReadonlySet<KeyVersionId>): boolean {
  if (!isAct(act)) return false;
  const heads = heldHeads(lineage, held);
  return heads.length === 0 || heads.some((head) => !lineage.followsRemoval(head, act));
}

/**
 * A removal's successors, one for each span the vessel holds a head in. Raises answered together share ONE
 * successor per span: it cites every raise some head of that span still owes, and none already settled there.
 * Its parents name every head the vessel holds in that span, and the span continues. A roll never waits on a
 * join: heads of unlike spans each take their own successor, and both branches keep showing as a fork.
 */
export function planRemovalRolls(lineage: KeyLineage, args: { readonly acts: readonly string[]; readonly held: ReadonlySet<KeyVersionId>; readonly ownEdgeShadowed: boolean }):
  { readonly plans: readonly KeyRollPlan[] } | { readonly refusal: RollRefusalName } {
  const acts = readActs([...new Set(Array.isArray(args.acts) ? args.acts : [])].sort(ascending));
  if (acts === null) return { refusal: "act-malformed" };
  if (lineage.unfounded) return { refusal: "bag-unfounded" };
  if (args.ownEdgeShadowed !== false) return { refusal: "own-edge-shadowed" };
  const heads = heldHeads(lineage, args.held);
  if (heads.length === 0) return { refusal: "no-head-held" };
  const plans: KeyRollPlan[] = [];
  for (const span of spansOf(lineage, heads).sort(ascending)) {
    const parents = heads.filter((head) => lineage.fact(head)!.span === span);
    const owed = acts.filter((act) => parents.some((head) => !lineage.followsRemoval(head, act)));
    if (owed.length === 0) continue;
    const one = planned(parents, span, lineage.historyOfSpan(span)!, { kind: "removal", acts: Object.freeze(owed) });
    if ("plan" in one) plans.push(one.plan);
  }
  return plans.length === 0 ? { refusal: "already-rolled" } : { plans: Object.freeze(plans) };
}

/** The one successor a removal owes, where the vessel's heads share one span; `join-owed` where they do not
 *  and `planRemovalRolls` answers more than one. */
export function planRemovalRoll(lineage: KeyLineage, args: { readonly acts: readonly string[]; readonly held: ReadonlySet<KeyVersionId>; readonly ownEdgeShadowed: boolean }): Planned {
  const all = planRemovalRolls(lineage, args);
  if ("refusal" in all) return all;
  return all.plans.length === 1 ? { plan: all.plans[0]! } : { refusal: "join-owed" };
}

/** A from-now admission: its parents name every head the vessel holds, and a new span opens with `history`. */
export function planAdmissionFromNow(lineage: KeyLineage, args: { readonly act: string; readonly held: ReadonlySet<KeyVersionId>; readonly history: HistoryDeclaration; readonly ownEdgeShadowed: boolean }): Planned {
  if (!isAct(args.act)) return { refusal: "act-malformed" };
  if (!isHistory(args.history)) return { refusal: "history-malformed" };
  if (lineage.unfounded) return { refusal: "bag-unfounded" };
  if (args.ownEdgeShadowed !== false) return { refusal: "own-edge-shadowed" };
  const heads = heldHeads(lineage, args.held);
  if (heads.length === 0) return { refusal: "no-head-held" };
  return planned(heads, "self", args.history, { kind: "admission", act: args.act });
}

/** A join: the vessel holds EVERY head and two or more stand. One span continues; unlike spans open a new one. */
export function planJoin(lineage: KeyLineage, args: { readonly held: ReadonlySet<KeyVersionId>; readonly historyForNewSpan: HistoryDeclaration; readonly ownEdgeShadowed: boolean }): Planned {
  if (!isHistory(args.historyForNewSpan)) return { refusal: "history-malformed" };
  if (lineage.unfounded) return { refusal: "bag-unfounded" };
  if (args.ownEdgeShadowed !== false) return { refusal: "own-edge-shadowed" };
  const heads = lineage.heads();
  if (heads.length < 2) return { refusal: "nothing-to-join" };
  const mine = heldHeads(lineage, args.held);
  if (mine.length === 0) return { refusal: "no-head-held" };
  if (mine.length !== heads.length) return { refusal: "heads-not-all-held" };
  const spans = spansOf(lineage, heads);
  if (spans.length === 1) return planned(heads, spans[0]!, lineage.historyOfSpan(spans[0]!)!, { kind: "join" });
  return planned(heads, "self", args.historyForNewSpan, { kind: "join" });
}

/** A with-past admission mints nothing. It answers the versions to hand over: every version of the span of the
 *  head `from`, and none of an earlier span. A span declared closed hands over nothing. */
export function versionsToHandOver(lineage: KeyLineage, args: { readonly from: KeyVersionId; readonly held: ReadonlySet<KeyVersionId> }): { readonly versions: readonly KeyVersionId[] } | { readonly refusal: RollRefusalName } {
  if (lineage.unfounded) return { refusal: "bag-unfounded" };
  if (!lineage.heads().includes(args.from) || !args.held.has(args.from)) return { refusal: "no-head-held" };
  const span = lineage.fact(args.from)!.span;
  if (lineage.historyOfSpan(span) !== "shareable") return { refusal: "history-closed" };
  return { versions: lineage.versionsOfSpan(span) };
}

/** The plan as the fact a minted key states. */
export function factOfPlan(plan: KeyRollPlan, keyVersion: KeyVersionId): KeyVersionFact {
  return Object.freeze({ keyVersion, parents: Object.freeze([...plan.parents]), span: plan.span === "self" ? keyVersion : plan.span, history: plan.history, cause: plan.cause });
}

/**
 * Which head does a writer seal under? One head held: that head. Every head of several held: a join stands
 * owed. Some of several held: the head it last wrote under, where that still stands as a held head; otherwise
 * the choice reads `ambiguous` and a person or a caller chooses. No id comparison picks.
 */
export function writeHead(lineage: KeyLineage, held: ReadonlySet<KeyVersionId>, last?: KeyVersionId):
  | { readonly head: KeyVersionId } | { readonly joinOwed: readonly KeyVersionId[] } | { readonly ambiguous: readonly KeyVersionId[] }
  | { readonly refusal: "bag-unfounded" | "no-head-held" } {
  const heads = lineage.heads();
  if (heads.length === 0) return { refusal: "bag-unfounded" };
  const mine = heads.filter((head) => held.has(head));
  if (mine.length === 0) return { refusal: "no-head-held" };
  if (heads.length > 1 && mine.length === heads.length) return { joinOwed: heads };
  if (mine.length === 1) return { head: mine[0]! };
  if (last !== undefined && mine.includes(last)) return { head: last };
  return { ambiguous: Object.freeze(mine) };
}

// ── The seat roll and the content-key roll that follows it ──────────────────────────────────────
export type RollOutcomeName = "rolled" | "not-owed" | "unknown-bag" | "mint-failed" | RollRefusalName;
/** What one bag did with one seat roll. */
export interface RollOutcome {
  readonly scope:  string;
  readonly bagId:  string;
  /** The raises the roll named, as the vessel handed them over. */
  readonly raises: readonly string[];
  readonly result: RollOutcomeName;
  readonly keyVersion?: KeyVersionId;
}

/** What the content-key roll needs from its vessel. */
export interface RollerPorts {
  /** The bags whose key group `scope` names, as this vessel holds them. */
  bagsOf(scope: string): readonly string[];
  /** Null: this vessel holds no such bag. */
  lineageOf(bagId: string): KeyLineage | null;
  heldOf(bagId: string): ReadonlySet<KeyVersionId>;
  /** Does this vessel read a shadow over its own edge in `scope`? Such a vessel mints nothing there. */
  ownEdgeShadowed(scope: string): boolean;
  /** Mint the key, sign the record, wrap the lockboxes, and answer the fact it counted; null where it could not. */
  mint(bagId: string, plan: KeyRollPlan): Promise<KeyVersionFact | null>;
  report(outcome: RollOutcome): void;
}

/** The outcomes that leave a raise owed: the sink rejects the roll, and the vessel hands it over again. A bag
 *  the scope reaches and this vessel cannot roll yet (no head key in hand, no lineage read) stays owed: the
 *  raise must not read answered while that bag holds no successor. */
const COMES_AGAIN: ReadonlySet<RollOutcomeName> = new Set(["mint-failed", "no-head-held", "unknown-bag"]);

/**
 * The subscriber a vessel hands its seat rolls to. For one roll it visits every bag the scope reaches, in turn
 * and one at a time per bag: it skips a bag that owes no roll for these raises, plans one successor for each
 * span the vessel holds a head in, mints each and reports. It proceeds on every answer the key group gave
 * (`revoked`, `gone`, `no-authority`): the content key rolls whether or not the seat left.
 *
 * It REJECTS the roll where any bag could not finish (a mint that failed, a bag with no head key in hand, a
 * bag it could not read), so the raises stay unmarked and the same roll comes again; a repeat settles what
 * finished as `not-owed`. A vessel under its own shadow mints nothing and lets the roll settle: it performs
 * no key act in that scope. A port that throws counts as a mint that failed.
 */
export function contentKeyRollSink(ports: RollerPorts): SeatRollSink {
  const tails = new Map<string, Promise<unknown>>();
  const inTurn = <T>(bagId: string, act: () => Promise<T>): Promise<T> => {
    const run = (tails.get(bagId) ?? Promise.resolve()).then(act, act);
    const tail = run.catch(() => undefined);
    tails.set(bagId, tail);
    void tail.then(() => { if (tails.get(bagId) === tail) tails.delete(bagId); });
    return run;
  };
  const rollBag = async (roll: SeatRoll, bagId: string): Promise<RollOutcomeName> => {
    const say = (result: RollOutcomeName, keyVersion?: KeyVersionId): RollOutcomeName => {
      try { ports.report({ scope: roll.scope, bagId, raises: roll.raiseCids, result, ...(keyVersion !== undefined ? { keyVersion } : {}) }); } catch { /* a report that throws loses only itself */ }
      return result;
    };
    try {
      const lineage = ports.lineageOf(bagId);
      if (lineage === null) return say("unknown-bag");
      const choice = planRemovalRolls(lineage, { acts: roll.raiseCids, held: ports.heldOf(bagId), ownEdgeShadowed: ports.ownEdgeShadowed(roll.scope) });
      if ("refusal" in choice) return say(choice.refusal === "already-rolled" ? "not-owed" : choice.refusal);
      for (const plan of choice.plans) {
        const fact = await ports.mint(bagId, plan);
        if (fact === null) return say("mint-failed");
        say("rolled", fact.keyVersion);
      }
      return "rolled";
    } catch { return say("mint-failed"); }
  };
  return async (roll) => {
    let bags: readonly string[];
    try { bags = [...new Set(ports.bagsOf(roll.scope))]; }
    catch { throw new Error("content-key roll: this vessel could not name the scope's bags, so the roll stays owed"); }
    const unfinished: string[] = [];
    for (const bagId of bags) {
      const result = await inTurn(bagId, () => rollBag(roll, bagId));
      if (COMES_AGAIN.has(result)) unfinished.push(`${bagId} (${result})`);
    }
    if (unfinished.length > 0) throw new Error(`content-key roll: ${unfinished.length} bag(s) did not roll — ${unfinished.join(", ")} — the roll stays owed`);
  };
}

/** A test double for a vessel's roll subscription: `announce` hands one roll to every subscriber in turn, and
 *  the first rejection ends the delivery and rides out, as the vessel's own announce does. */
export class ScriptedSeatRolls {
  #sinks: SeatRollSink[] = [];
  subscribe(sink: SeatRollSink): () => void {
    this.#sinks.push(sink);
    return () => { this.#sinks = this.#sinks.filter((one) => one !== sink); };
  }
  async announce(roll: SeatRoll): Promise<void> { for (const sink of [...this.#sinks]) await sink(roll); }
  get subscribers(): number { return this.#sinks.length; }
}
