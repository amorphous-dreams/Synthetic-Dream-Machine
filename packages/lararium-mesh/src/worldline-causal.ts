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

/**
 * Resolve a reference — an EXACT composite key if one is present, else a bare HANDLE → its (latest)
 * live entry (the last-inserted `${handle}@…`, the current frontier of that handle). Returns undefined
 * when neither hits. Insertion order = event order, so "latest" reads the handle's most-advanced
 * frontier — the one a message/compare means by a bare handle.
 */
function resolveRef(c: WorldlineCausal, ref: string): Resolved | undefined {
  const exact = c.stamps[ref];
  if (exact) return { key: ref, stamp: exact };
  const prefix = ref + FRONTIER_SEP;
  let found: Resolved | undefined;
  for (const key of Object.keys(c.stamps)) {
    if (key.startsWith(prefix)) found = { key, stamp: c.stamps[key]! }; // last wins → latest frontier
  }
  return found;
}

/** Set a stamp under its composite key, dropping a prior key when the frontier MOVED (re-key in place). */
function rekey(stamps: Record<string, ItcStamp>, priorKey: string | null, handle: string, stamp: ItcStamp): void {
  const key = stampKey(handle, stamp);
  if (priorKey !== null && priorKey !== key) delete stamps[priorKey];
  stamps[key] = stamp;
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
  const p = resolveRef(c, parent);
  if (!p) throw new Error(`worldlineSpawn: unknown parent handle "${parent}"`);
  const [pNext, cNext] = itcFork(p.stamp);
  const childKey = stampKey(child, cNext);
  if (c.stamps[childKey]) throw new Error(`worldlineSpawn: child "${childKey}" already exists`);
  const stamps = { ...c.stamps };
  rekey(stamps, p.key, parent, pNext); // fork leaves the event unchanged → parent key holds
  stamps[childKey] = cNext;
  return { stamps };
}

/**
 * TICK (event) — one local event on a live worldline: the spirit's own work between messages. The
 * event advances → the frontier MOVES → the entry re-keys.
 */
export function worldlineTick(c: WorldlineCausal, handle: string): WorldlineCausal {
  const t = resolveRef(c, handle);
  if (!t) throw new Error(`worldlineTick: unknown handle "${handle}"`);
  const stamps = { ...c.stamps };
  rekey(stamps, t.key, handleFromKey(t.key), itcEvent(t.stamp));
  return { stamps };
}

/** The composite keys a message leaves: the sender's send event and the recipient's receive event. */
interface Delivery {
  readonly causal: WorldlineCausal;
  readonly sent: string;
  readonly received: string;
}

function deliver(c: WorldlineCausal, sender: string, target: string, verb: string): Delivery {
  const s = resolveRef(c, sender);
  if (!s) throw new Error(`${verb}: unknown sender "${sender}"`);
  const t = resolveRef(c, target);
  if (!t) throw new Error(`${verb}: unknown target "${target}"`);
  if (s.key === t.key) throw new Error(`${verb}: "${sender}" cannot message itself`);
  const sentStamp = itcEvent(s.stamp);                                    // the send: an event at the sender
  const receivedStamp = itcEvent(itcJoin(t.stamp, itcPeek(sentStamp)));   // the receive: join the sender's past, then tick
  const stamps = { ...c.stamps };
  const sHandle = handleFromKey(s.key);
  const tHandle = handleFromKey(t.key);
  rekey(stamps, s.key, sHandle, sentStamp);
  rekey(stamps, t.key, tHandle, receivedStamp);
  return { causal: { stamps }, sent: stampKey(sHandle, sentStamp), received: stampKey(tHandle, receivedStamp) };
}

/**
 * INJECT (message) — the rhizome's prov:Communication leg, between any two live worldlines (operator,
 * mains, spirits, grandchildren). The send ticks the sender; the receive joins the sender's history
 * into the recipient through an ownership-free peek, then ticks — so the receive happens-after the
 * send and each participant keeps its own ownership (two continuing writers stay distinct). FULL
 * ticks: every message rides an event (the operator's D-cut).
 */
export function worldlineInject(c: WorldlineCausal, sender: string, target: string): WorldlineCausal {
  return deliver(c, sender, target, "worldlineInject").causal;
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
  const d = deliver(c, child, parent, "worldlineHandback");
  return { causal: d.causal, receipt: { parent, child, sent: d.sent, received: d.received } };
}

/**
 * RESUME — a live spirit takes a new round from a message (the parent's, the operator's, a sibling's).
 * The round continues the child's own stamp; a retired or never-spawned child refuses, since only a
 * spawn mints a worldline.
 */
export function worldlineResume(c: WorldlineCausal, resumer: string, child: string): WorldlineCausal {
  if (!resolveRef(c, child)) {
    throw new Error(`worldlineResume: "${child}" stands retired or never spawned — spawn mints a worldline (worldlineSpawn), resume continues a live one`);
  }
  return deliver(c, resumer, child, "worldlineResume").causal;
}

/**
 * RETIRE (join) — the explicit close of a continuing spirit: sum its ownership back into the parent
 * and max-join the histories, so the parent reads after everything the child witnessed. The child
 * leaves the registry; a later message to it refuses.
 */
export function worldlineRetire(c: WorldlineCausal, parent: string, child: string): WorldlineCausal {
  const p = resolveRef(c, parent);
  const ch = resolveRef(c, child);
  if (!p) throw new Error(`worldlineRetire: unknown parent handle "${parent}"`);
  if (!ch) throw new Error(`worldlineRetire: unknown child handle "${child}"`);
  if (p.key === ch.key) throw new Error(`worldlineRetire: "${child}" cannot retire into itself`);
  const joined = itcEvent(itcJoin(p.stamp, ch.stamp));
  const stamps = { ...c.stamps };
  delete stamps[ch.key];
  rekey(stamps, p.key, handleFromKey(p.key), joined);
  return { stamps };
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
