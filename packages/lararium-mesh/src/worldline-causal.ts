/**
 * worldline-causal — the worldline's CAUSAL partial-order, an in-memory ITC registry keyed on
 * (handle × FRONTIER). SEPARATE from the rhythmic clocks (worldline-clock.ts) by the PATH-B cut:
 * causal rides ITC / the edge-DAG, the FfzClock stays purely rhythmic.
 *
 * Happened-before projects from the spawn/message/handback/retire structure, so the order is
 * concurrent-capable: siblings of one spawn with no message between them read "concurrent"
 * (agent-worldline #time, #attribution). Keyed turn-DAG (the operator's C-cut) — handles
 * survive rewind/fork because the turn-DAG node does.
 *
 * ## The (handle, frontier) address
 *
 * The registry key is `${handle}@${frontier}` — address = handle × FRONTIER, the frontier keyed
 * BY the handle, never smuggled INSIDE it. The handle stays a RIGID designator (baptized-fixed at
 * spawn); the frontier is the MOVING antichain — a short hash of the ITC event heads (the causal
 * history), so it advances on every event (tick, message, retire) and holds across a bare fork. Same-session
 * forks never collide: two spawns of one child handle across a rewind carry DIFFERENT
 * re-projected histories → different frontiers → distinct keys, so `worldlineSpawn` never
 * throws when a handle re-appears on a rewound-then-re-forked branch. The frontier is DERIVED from
 * the stamp — never authoritative state, so the composite key holds only because causal-order rides
 * a re-derivable projection (else the global-now sneaks back in).
 *
 * NOTE — the edge-DAG home: spawns persist as prov:Delegation triples, messages and handbacks
 * as prov:Communication triples (a handback marks `round: "close"`), and retirement closes the
 * Delegation interval (kg_add / kg_invalidate via `kg_io.py`); kapae (rewind) closes a turn's
 * triples (valid_to set, never deleted). This in-memory
 * ITC registry stays the live causal READ; the persisted edge-DAG is the durable home, and the
 * ITC verdict re-projects from those triples via worldline-trajectory's worldlineCausalFromEdges.
 *
 * Meme: lar:///ha.ka.ba/lararium/api/agent-worldline#/time
 */

import { itcSeed, itcFork, itcEvent, itcJoin, itcPeek, itcCompare, type ItcStamp, type ItcOrder, type ItcEvent } from "./itc.js";

/**
 * The worldline's CAUSAL partial-order carrier — one ITC stamp per (handle × frontier). Concurrent-
 * capable: the happened-before projects from the spawn/message/retire structure (the PATH-B cut keeps
 * this OFF the rhythmic FfzClock). The `stamps` keys are COMPOSITE (`${handle}@${frontier}`); read them
 * through {@link worldlineStampFor} / {@link worldlineHandles}, never by a bare-handle index.
 */
export interface WorldlineCausal {
  readonly stamps: Readonly<Record<string, ItcStamp>>;
}

/** The shore a frontier is appended on — the handle stays rigid, the frontier rides after this mark. */
const FRONTIER_SEP = "@";

/**
 * FNV-1a/32 → 8 hex — a short, stable, dependency-free fingerprint (twin of branch-frontier's fnv1a8,
 * inlined here so this module — and the pure `@lararium/mesh/worldline` VM subpath it feeds — pulls
 * in NOTHING heavier). NOT cryptographic; it only DISTINGUISHES frontiers deterministically.
 */
function fnv1a8(s: string): string {
  let h = 0x811c9dc5; // FNV-1a 32-bit offset basis
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0; // FNV prime, keep unsigned
  }
  return h.toString(16).padStart(8, "0");
}

/**
 * The stamp's CAUSAL FRONTIER fingerprint — a short, stable hash of its ITC event heads (the causal
 * history). The MOVING antichain: it advances on every event (tick, message, retire) and holds across a bare fork
 * (which leaves the event unchanged). Two spawns of one handle across a rewind carry different
 * re-projected histories → different frontiers. Derived, never authoritative (the guard).
 */
export function frontierOf(stamp: ItcStamp): string {
  return fnv1a8(canonEvent(stamp.event));
}

/** Canonical string of an ITC event tree — a deterministic fold (arrays + numbers only, JSON-safe). */
function canonEvent(e: ItcEvent): string {
  return typeof e === "number" ? String(e) : `[${e[0]},${canonEvent(e[1])},${canonEvent(e[2])}]`;
}

/**
 * The composite registry key: address = handle × frontier. Keyed BY the handle (rigid, baptized-
 * fixed), the frontier riding as a suffix over the value's moving history — NOT inside the handle.
 */
export function stampKey(handle: string, stamp: ItcStamp): string {
  return `${handle}${FRONTIER_SEP}${frontierOf(stamp)}`;
}

/**
 * Split a composite key back into its rigid handle (everything before the LAST `@`). A lineage-path
 * handle carries no `@` of its own (dotted form: `run.child`); the frontier suffix always does, so the
 * LAST `@` is the shore. A key with no `@` reads as a bare handle (defensive).
 */
export function handleFromKey(key: string): string {
  const at = key.lastIndexOf(FRONTIER_SEP);
  return at < 0 ? key : key.slice(0, at);
}

/** A resolved registry entry — its composite key + the stamp it holds. */
interface Resolved {
  readonly key: string;
  readonly stamp: ItcStamp;
}

/** One live entry: its stamp, its place in insertion order, and its composite key once something asks. */
interface Entry {
  readonly handle: string;
  stamp: ItcStamp;
  seq: number;
  key?: string;
}

/**
 * The mutable working registry every op runs on: each handle's entries in insertion order, keyed by
 * frontier only when a caller asks (an exact-key lookup, a spawn's collision guard, the freeze), so an
 * op costs its own stamps — never a copy of every live worldline, never a hash of a history it left
 * alone. A public op copies the registry into one draft and freezes it back; {@link worldlineDraft}
 * lets a long replay run many ops on one draft.
 */
class Draft {
  private readonly byHandle = new Map<string, Entry[]>();
  private seq = 0;

  constructor(from: Readonly<Record<string, ItcStamp>>) {
    for (const [key, stamp] of Object.entries(from)) this.append(handleFromKey(key), stamp, key);
  }

  private append(handle: string, stamp: ItcStamp, key?: string): Entry {
    const entry: Entry = { handle, stamp, seq: this.seq++, ...(key !== undefined ? { key } : {}) };
    (this.byHandle.get(handle) ?? this.byHandle.set(handle, []).get(handle)!).push(entry);
    return entry;
  }

  private keyOf(entry: Entry): string {
    return (entry.key ??= stampKey(entry.handle, entry.stamp));
  }

  /** Re-stamp an entry; a moved frontier re-keys it to the end of insertion order, a held one keeps its place. */
  private restamp(entry: Entry, stamp: ItcStamp, moved: boolean): void {
    entry.stamp = stamp;
    delete entry.key;
    if (moved) {
      const list = this.byHandle.get(entry.handle)!;
      list.splice(list.indexOf(entry), 1);
      list.push(entry);
      entry.seq = this.seq++;
    }
  }

  private drop(entry: Entry): void {
    const list = this.byHandle.get(entry.handle)!;
    list.splice(list.indexOf(entry), 1);
    if (list.length === 0) this.byHandle.delete(entry.handle);
  }

  /**
   * Resolve a reference — an EXACT composite key if one is present, else a bare HANDLE → its latest live
   * entry (the last-inserted `${handle}@…`, the current frontier of that handle); undefined when neither
   * hits. Insertion order = event order, so "latest" reads the frontier a message or compare means.
   */
  entry(ref: string): Entry | undefined {
    if (ref.includes(FRONTIER_SEP)) {
      const exact = this.byHandle.get(handleFromKey(ref))?.find((e) => this.keyOf(e) === ref);
      if (exact) return exact;
    }
    const list = this.byHandle.get(ref);
    return list && list.length > 0 ? list[list.length - 1] : undefined;
  }

  resolve(ref: string): Resolved | undefined {
    const e = this.entry(ref);
    return e ? { key: this.keyOf(e), stamp: e.stamp } : undefined;
  }

  freeze(): WorldlineCausal {
    const all = [...this.byHandle.values()].flat().sort((x, y) => x.seq - y.seq);
    const stamps: Record<string, ItcStamp> = {};
    for (const e of all) stamps[this.keyOf(e)] = e.stamp;
    return { stamps };
  }

  spawn(parent: string, child: string): void {
    const p = this.entry(parent);
    if (!p) throw new Error(`worldlineSpawn: unknown parent handle "${parent}"`);
    const [pNext, cNext] = itcFork(p.stamp);
    const prior = this.byHandle.get(child);
    if (prior) {
      const childKey = stampKey(child, cNext);
      if (prior.some((e) => this.keyOf(e) === childKey)) throw new Error(`worldlineSpawn: child "${childKey}" already exists`);
    }
    this.restamp(p, pNext, false); // fork leaves the event unchanged → the parent's key and place hold
    this.append(child, cNext);
  }

  tick(handle: string): void {
    const t = this.entry(handle);
    if (!t) throw new Error(`worldlineTick: unknown handle "${handle}"`);
    this.restamp(t, itcEvent(t.stamp), true);
  }

  deliver(sender: string, target: string, verb: string, keys: boolean): { sent: string; received: string } {
    const s = this.entry(sender);
    if (!s) throw new Error(`${verb}: unknown sender "${sender}"`);
    const t = this.entry(target);
    if (!t) throw new Error(`${verb}: unknown target "${target}"`);
    if (s === t) throw new Error(`${verb}: "${sender}" cannot message itself`);
    const sentStamp = itcEvent(s.stamp);                                    // the send: an event at the sender
    const receivedStamp = itcEvent(itcJoin(t.stamp, itcPeek(sentStamp)));   // the receive: join the sender's past, then tick
    s.stamp = sentStamp; t.stamp = receivedStamp;
    delete s.key; delete t.key;
    for (const e of [s, t]) {
      const list = this.byHandle.get(e.handle)!;
      list.splice(list.indexOf(e), 1);
      list.push(e);
      e.seq = this.seq++;
    }
    return keys ? { sent: this.keyOf(s), received: this.keyOf(t) } : { sent: "", received: "" };
  }

  retire(parent: string, child: string): void {
    const p = this.entry(parent);
    const ch = this.entry(child);
    if (!p) throw new Error(`worldlineRetire: unknown parent handle "${parent}"`);
    if (!ch) throw new Error(`worldlineRetire: unknown child handle "${child}"`);
    if (p === ch) throw new Error(`worldlineRetire: "${child}" cannot retire into itself`);
    const joined = itcEvent(itcJoin(p.stamp, ch.stamp));
    this.drop(ch);
    this.restamp(p, joined, true);
  }
}

/** A working registry a replay drives op by op; `freeze` yields the plain registry. */
export interface WorldlineDraft {
  spawn(parent: string, child: string): void;
  tick(handle: string): void;
  inject(sender: string, target: string): void;
  handback(parent: string, child: string): void;
  retire(parent: string, child: string): void;
  stampFor(handle: string): ItcStamp | undefined;
  freeze(): WorldlineCausal;
}

/** Open a working registry over `c` for many ops at the cost of each op alone (a replay's path). */
export function worldlineDraft(c: WorldlineCausal): WorldlineDraft {
  const d = new Draft(c.stamps);
  return {
    spawn: (parent, child) => d.spawn(parent, child),
    tick: (handle) => d.tick(handle),
    inject: (sender, target) => { d.deliver(sender, target, "worldlineInject", false); },
    handback: (parent, child) => { d.deliver(child, parent, "worldlineHandback", false); },
    retire: (parent, child) => d.retire(parent, child),
    stampFor: (handle) => d.entry(handle)?.stamp,
    freeze: () => d.freeze(),
  };
}

function resolveRef(c: WorldlineCausal, ref: string): Resolved | undefined {
  return new Draft(c.stamps).resolve(ref);
}

/** Seed the causal registry at the root worldline (the E-cut common cause — the operator). */
export function worldlineCausalSeed(rootHandle: string): WorldlineCausal {
  const s = itcSeed();
  return { stamps: { [stampKey(rootHandle, s)]: s } };
}

/**
 * SPAWN (fork) — the parent forks its stamp; the child inherits the shared history, so the
 * parent happened-before the child (the prov:Delegation edge). The parent's pre-spawn acts
 * precede the child; its post-spawn acts read concurrent with the child (the lightcone cut).
 *
 * The collision guard fires on the COMPOSITE child key, never the bare handle: re-spawning a
 * child handle whose frontier moved (a rewound-then-re-forked branch) succeeds — a distinct
 * (handle, frontier) entry rides alongside the earlier-frontier one.
 */
export function worldlineSpawn(c: WorldlineCausal, parent: string, child: string): WorldlineCausal {
  const d = new Draft(c.stamps);
  d.spawn(parent, child);
  return d.freeze();
}

/**
 * TICK (event) — one local event on a live worldline: the spirit's own work between messages. The
 * event advances → the frontier MOVES → the entry re-keys.
 */
export function worldlineTick(c: WorldlineCausal, handle: string): WorldlineCausal {
  const d = new Draft(c.stamps);
  d.tick(handle);
  return d.freeze();
}

/**
 * INJECT (message) — the rhizome's prov:Communication leg, between any two live worldlines (operator,
 * mains, spirits, grandchildren). The send ticks the sender; the receive joins the sender's history
 * into the recipient through an ownership-free peek, then ticks — so the receive happens-after the
 * send and each participant keeps its own ownership (two continuing writers stay distinct). FULL
 * ticks: every message rides an event (the operator's D-cut).
 */
export function worldlineInject(c: WorldlineCausal, sender: string, target: string): WorldlineCausal {
  const d = new Draft(c.stamps);
  d.deliver(sender, target, "worldlineInject", false);
  return d.freeze();
}

/** The receipt a handback leaves: who returned to whom, at which send and receive frontiers. */
export interface WorldlineReceipt {
  readonly parent: string;
  readonly child: string;
  /** The child's composite key at its return (the send event). */
  readonly sent: string;
  /** The parent's composite key at the receipt (the receive event). */
  readonly received: string;
}

/** A closed round — the registry after the handback plus its receipt. */
export interface WorldlineRound {
  readonly causal: WorldlineCausal;
  readonly receipt: WorldlineReceipt;
}

/**
 * HANDBACK (round close) — the child returns its result to the parent as a message: the parent's
 * receipt reads after the child's return, and the child stays live, owning its interval, so a later
 * round resumes on its own stamp. Retirement takes its own act ({@link worldlineRetire}).
 */
export function worldlineHandback(c: WorldlineCausal, parent: string, child: string): WorldlineRound {
  const d = new Draft(c.stamps);
  const keys = d.deliver(child, parent, "worldlineHandback", true);
  return { causal: d.freeze(), receipt: { parent, child, ...keys } };
}

/**
 * RESUME — a live spirit takes a new round from a message (the parent's, the operator's, a sibling's).
 * The round continues the child's own stamp; a retired or never-spawned child refuses, since only a
 * spawn mints a worldline.
 */
export function worldlineResume(c: WorldlineCausal, resumer: string, child: string): WorldlineCausal {
  const d = new Draft(c.stamps);
  if (!d.resolve(child)) {
    throw new Error(`worldlineResume: "${child}" stands retired or never spawned — spawn mints a worldline (worldlineSpawn), resume continues a live one`);
  }
  d.deliver(resumer, child, "worldlineResume", false);
  return d.freeze();
}

/**
 * RETIRE (join) — the explicit close of a continuing spirit: sum its ownership back into the parent
 * and max-join the histories, so the parent reads after everything the child witnessed. The child
 * leaves the registry; a later message to it refuses.
 */
export function worldlineRetire(c: WorldlineCausal, parent: string, child: string): WorldlineCausal {
  const d = new Draft(c.stamps);
  d.retire(parent, child);
  return d.freeze();
}

/**
 * The CAUSAL verdict between two worldlines — concurrent-capable (the read the rhythmic
 * ffzCompare can never give). "before"/"after"/"equal"/"concurrent" off the ITC histories.
 * Each argument reads as a bare handle (→ its latest frontier) or an exact composite key.
 */
export function worldlineCompare(c: WorldlineCausal, a: string, b: string): ItcOrder {
  const sa = resolveRef(c, a);
  const sb = resolveRef(c, b);
  if (!sa) throw new Error(`worldlineCompare: unknown handle "${a}"`);
  if (!sb) throw new Error(`worldlineCompare: unknown handle "${b}"`);
  return itcCompare(sa.stamp, sb.stamp);
}

// ---------------------------------------------------------------------------
// Accessors — read the composite-keyed registry by handle (never a bare index)
// ---------------------------------------------------------------------------

/** The live stamp for a handle (its latest frontier), or undefined when the handle is absent. */
export function worldlineStampFor(c: WorldlineCausal, handle: string): ItcStamp | undefined {
  return resolveRef(c, handle)?.stamp;
}

/** The distinct handles currently live in the registry (frontier stripped, deduped, first-seen order). */
export function worldlineHandles(c: WorldlineCausal): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const key of Object.keys(c.stamps)) {
    const h = handleFromKey(key);
    if (!seen.has(h)) { seen.add(h); out.push(h); }
  }
  return out;
}

/** Every composite key a handle carries — its concurrent frontiers (>1 only across a same-session fork). */
export function worldlineFrontiersFor(c: WorldlineCausal, handle: string): string[] {
  const prefix = handle + FRONTIER_SEP;
  return Object.keys(c.stamps).filter((k) => k === handle || k.startsWith(prefix));
}
