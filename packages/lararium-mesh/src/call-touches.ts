/**
 * call-touches — THE DOCUMENTS ONE CALL CHANGED, tagged at the change itself (sealed-store#/owed, No silent loss).
 *
 * A door answers `owed` only for its own writes: never for a concurrent call's, never for a peer's sync, never for a
 * document that waited long before the call began. So each call runs inside a scope (`inCallScope`), and every local
 * change a Repo makes inside that scope notes its document and heads under the call's id (`watchCallTouches`). The
 * call's door takes the tally when it answers (`takeCallTouches`): a call that changed nothing owes nothing.
 *
 * THE SCOPE RIDES A RUNNER. A platform with an async context (node's `AsyncLocalStorage`) seats one (`seatCallScope`), so
 * a change made after any await of the call still tags; with none seated, the scope holds across the call's synchronous
 * start alone. A change made outside every scope (a peer's sync, the projector, a timer) tags no call.
 *
 * Bounded: a call that never answers leaves a tally; past `CALL_TOUCHES_BOUND` open tallies the oldest drops (counted in
 * `dropped`, never silent).
 *
 * Canon: lar:///ha.ka.ba/lararium/mesh/sealed-store#/owed · lar:///ha.ka.ba/kahua/memory/research/signer-refused
 */
import * as A from "@automerge/automerge";

/** How a platform carries the current call's id across its awaits. */
export interface CallScopeRunner {
  run<T>(id: string, fn: () => T): T;
  current(): string | undefined;
  /** Run `fn` outside every call: the Repo's own sync work (a find's drain of queued peer messages) tags no call. */
  exit<T>(fn: () => T): T;
}

/** What one call changed: each document's heads (hex, `A.getHeads`) after its latest change inside the call. */
export type CallTouches = Readonly<Record<string, readonly string[]>>;

export const CALL_TOUCHES_BOUND = 1024;

let syncCurrent: string | undefined;
const syncRunner: CallScopeRunner = {
  run(id, fn) {
    const held = syncCurrent;
    syncCurrent = id;
    try { return fn(); } finally { syncCurrent = held; }
  },
  current: () => syncCurrent,
  exit(fn) {
    const held = syncCurrent;
    syncCurrent = undefined;
    try { return fn(); } finally { syncCurrent = held; }
  },
};
let runner: CallScopeRunner = syncRunner;
const tallies = new Map<string, Map<string, readonly string[]>>();
let dropped = 0;

/** Seat the platform's async-context runner (node: `AsyncLocalStorage`); null restores the synchronous one. */
export function seatCallScope(next: CallScopeRunner | null): void { runner = next ?? syncRunner; }

/** Run `fn` as call `id`: every local change a watched Repo makes inside it tags this call. */
export function inCallScope<T>(id: string, fn: () => T): T {
  for (const sweep of sweeps) { try { sweep(); } catch { /* a table that will not read keeps what it attached */ } }
  if (!tallies.has(id)) {
    tallies.set(id, new Map());
    while (tallies.size > CALL_TOUCHES_BOUND) { tallies.delete(tallies.keys().next().value as string); dropped += 1; }
  }
  return runner.run(id, fn);
}

/** The current call's id, where a change runs inside one. */
export function currentCall(): string | undefined { return runner.current(); }

/** Note one document's change for the current call (none: the change tags nobody). */
export function noteCallChange(documentId: string, heads: readonly string[]): void {
  const id = runner.current();
  if (id === undefined) return;
  let tally = tallies.get(id);
  if (tally === undefined) { tally = new Map(); tallies.set(id, tally); }
  tally.set(documentId, [...heads]);
}

/** Fold what another isolate reported for call `id` (main's run of a delegated verb, a wiki island's verb) into its tally. */
export function addCallTouches(id: string, touches: CallTouches | null | undefined): void {
  if (!touches) return;
  let tally = tallies.get(id);
  if (tally === undefined) { tally = new Map(); tallies.set(id, tally); }
  for (const [documentId, heads] of Object.entries(touches)) if (Array.isArray(heads)) tally.set(documentId, [...heads]);
}

/** A report read off the wire with no trust: a malformed one reads as none. */
export function readCallTouches(raw: unknown): CallTouches | null {
  const value = typeof raw === "string" ? (() => { try { return JSON.parse(raw) as unknown; } catch { return null; } })() : raw;
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const out: Record<string, readonly string[]> = {};
  for (const [id, heads] of Object.entries(value as Record<string, unknown>)) {
    if (Array.isArray(heads) && heads.every((h: unknown) => typeof h === "string")) out[id] = heads as string[];
  }
  return out;
}

const untracked = new Map<string, Set<string>>();
/** A path that ran for call `id` and reported no changes (an isolate that tracked nothing): its door answers `untracked`. */
export function markCallUntracked(id: string, what: string): void {
  let set = untracked.get(id);
  if (set === undefined) { set = new Set(); untracked.set(id, set); }
  set.add(what);
  while (untracked.size > CALL_TOUCHES_BOUND) { untracked.delete(untracked.keys().next().value as string); dropped += 1; }
}
/** Take (and forget) the untracked paths call `id` met; empty where every path reported. */
export function takeCallUntracked(id: string): string[] {
  const set = untracked.get(id);
  untracked.delete(id);
  return set === undefined ? [] : [...set];
}

/** Take (and forget) what call `id` changed; null where it changed nothing. */
export function takeCallTouches(id: string): CallTouches | null {
  const tally = tallies.get(id);
  tallies.delete(id);
  if (tally === undefined || tally.size === 0) return null;
  return Object.fromEntries(tally);
}

/** How many open tallies the bound dropped, for a census. */
export function callTouchesDropped(): number { return dropped; }

interface WatchedHandle { readonly documentId: string; doc(): unknown; on(event: "change" | "heads-changed", fn: (e: { readonly doc: unknown }) => void): unknown }
interface WatchedRepo { readonly handles: Record<string, WatchedHandle | undefined>; on(event: "document", fn: (e: { readonly handle: WatchedHandle }) => void): unknown }

/**
 * Watch every handle `repo` holds or comes to hold: a change made inside a call's scope notes its document and heads for
 * that call. Answers nothing to stop: a Repo's handles live as long as it does.
 */
export function watchCallTouches(repo: WatchedRepo): void {
  const seen = new WeakSet<object>();
  const attach = (handle: WatchedHandle | undefined): void => {
    // Only a real handle attaches: a progress reading or a stand-in that carries no event door is left as it stands.
    if (handle === undefined || handle === null || typeof handle !== "object" || typeof (handle as { on?: unknown }).on !== "function" || seen.has(handle)) return;
    seen.add(handle);
    // `heads-changed` fires on every move of the heads, a change that carries no patch included; `change` beside it.
    const note = (e: { readonly doc: unknown }): void => {
      if (runner.current() === undefined) return;
      try { noteCallChange(handle.documentId, A.getHeads(e.doc as A.Doc<unknown>)); } catch { /* a change that will not read tags nothing */ }
    };
    handle.on("change", note);
    handle.on("heads-changed", note);
  };
  for (const handle of Object.values(repo.handles)) attach(handle);
  repo.on("document", (e) => attach(e.handle));
  // A HANDLE THE REPO MINTS LATER (create, import, clone, find) emits no `document` here: each door that hands one out
  // attaches it as it does, and every call's scope sweeps the table again, so no handle changes untagged.
  const r = repo as unknown as Record<string, unknown>;
  for (const name of ["create", "create2", "import", "clone"]) {
    const original = r[name];
    if (typeof original !== "function") continue;
    r[name] = function (this: unknown, ...args: unknown[]) { const handle = (original as (...a: unknown[]) => WatchedHandle).apply(this, args); attach(handle); return handle; };
  }
  for (const name of ["find", "findWithProgress"]) {
    const original = r[name];
    if (typeof original !== "function") continue;
    // A FIND RUNS OUTSIDE THE CALL: its sync work (the queued peer messages its synchronizer drains as the document opens)
    // is a peer's change, never the call's; the handle it answers comes back into the call's own continuation.
    r[name] = function (this: unknown, ...args: unknown[]) {
      const out = runner.exit(() => (original as (...a: unknown[]) => unknown).apply(this, args));
      if (out && typeof (out as Promise<unknown>).then === "function") void (out as Promise<WatchedHandle>).then((h) => attach(h), () => {});
      else if (out && typeof out === "object" && "documentId" in (out as object)) attach(out as WatchedHandle);
      else if (out && typeof out === "object" && "handle" in (out as object)) attach((out as { handle: WatchedHandle }).handle);
      return out;
    };
  }
  sweeps.add(() => { for (const handle of Object.values(repo.handles)) attach(handle); });
}

/** Each watched Repo's sweep of its handle table, run as every call's scope opens. */
const sweeps = new Set<() => void>();

/**
 * THE READ VERBS, an allow-list (fail-safe): a verb named here writes nothing, so an answer that reaches the seat with no
 * change report reads clean. Every other verb (any verb this list does not name, a new one included) that answers with no
 * report reads `untracked`, owed by name, never ok. A verb joins only when its handler provably writes no document.
 */
export const READ_VERBS: ReadonlySet<string> = new Set([
  "tiddler-get", "wiki-filter", "wiki-render", "wiki-status", "meme-get", "meme-list", "list-wikis", "where", "ddate",
  "events", "offer-list", "offer-show", "persona-state", "promote-state", "switcher-state", "share-list", "circle-list",
  "circle-state", "intent-view", "unbound-docs", "sealed-reading",
]);

/** Does an answer of `verb` that carried `reported` (a change report, even empty) read untracked? */
export function answersUntracked(verb: string, reported: boolean): boolean {
  return !reported && !READ_VERBS.has(verb);
}

/**
 * A READ RIDES THE ANSWER RING (`vessel-state` `answerRingOf`): a verb the house names READ, asked with no effect key,
 * writes no receipt fact and no outcome row. Its answer reaches its caller through the vessel's memory alone, and a
 * re-ask past that memory runs the read afresh, which changes nothing. An effect key names an effect to land once, so a
 * read that carries one keeps the ledger's road. The door and the island both read this one predicate, so neither waits
 * on a row the other never writes.
 */
export function ridesAnswerRing(verb: string, effectKey?: string | undefined): boolean {
  return effectKey === undefined && READ_VERBS.has(verb);
}
