/**
 * gate-withdrawal-store — where a gate's withdrawal memory RESTS: rows of the gate's own vessel store.
 *
 * A gate that forgets a denial admits the withdrawn vessel again, so what a sovereign gate learned of a
 * face's withdrawals outlives a restart. This module keeps that memory in rows a vessel's store hands it,
 * one row per face key, and reads it back through the withdrawal fold alone.
 *
 * The invariants:
 *   · A ROW HOLDS SIGNED EVENTS AND NOTHING ELSE. Each row carries the withdrawal events one face key
 *     signed, in one canonical encoding. No certificate, no vessel's key, no time and no count rides it.
 *   · EVERY EVENT VERIFIES AGAIN AT LOAD. A row passes the fold before the gate believes it: one event the
 *     face key never signed, one event of another face, a row past its bound or a torn row loads as NOTHING,
 *     and `onTorn` hears its name. The row proves who signed each event and never how the event arrived.
 *   · ONE ROW PER FACE KEY, NAMED BY A DIGEST. The name binds one face key to one Nexus
 *     (`faceProofSubjectRef`). The store reads one row for one presenter and offers no walk of its rows.
 *   · IT ONLY ACCRETES. A keep joins what the row holds with what arrives, under one writer per row, and
 *     writes only where the join holds an event the row lacked. An older view never replaces a later one:
 *     where the vessel's door refuses a write, this store drops its view of that row and verifies it again.
 *     Every adapter over one set of rows shares that one writer; across processes the vessel's one store
 *     door keeps one holder (lar:///ha.ka.ba/lararium/mesh/harbor).
 *   · A ROW HOLDS AT MOST 1024 EVENTS. A join that would pass the bound writes nothing, and the row keeps
 *     what it held.
 *   · NO FENCE AGAINST A ROLLBACK. Every event of an older copy still verifies, so a hand that restores one
 *     makes the gate forget what it learned since. The law names that; nothing here cures it.
 *
 * WHERE THE ROWS REST belongs to the vessel: sealed under the vessel key, behind its one store door, and on
 * no board another operator reads. A sovereign gate alone asks this store; a locked vessel opens no row, and
 * a floor gate asks none. This module reads and writes bytes through `GateMemoryRows` and seals nothing.
 *
 * It compiles no registry (lar:///ha.ka.ba/lares/api/pono/registry-filter#/the-test): every event stands
 * authored by its subject's own hand, the gate reads it as of its own last learning, and nothing enumerates.
 *
 * Stands specified in code until the socket cutover wires it; out of the package barrel till then.
 *
 * Canon: lar:///ha.ka.ba/lares/api/pono/face-proof#/the-withdrawal-proof
 */
import { canonicalJsonBytes } from "./crypto.js";
import { foldWithdrawals, heldWithdrawals, isWithdrawalMemory, learnWithdrawals, type WithdrawalMemory } from "./face-authority.js";
import type { GateWithdrawalMemory } from "./face-gate.js";
import { faceProofSubjectRef, own, type FaceScope } from "./face-proof-subjects.js";

/** The vessel store's door for a gate's memory: one row of bytes per name. The vessel seals what rests. */
export interface GateMemoryRows {
  read(name: string): Uint8Array | null | Promise<Uint8Array | null>;
  write(name: string, bytes: Uint8Array): void | Promise<void>;
}

/** The most bytes one row may hold: 1024 events, each under a kilobyte. A longer row loads as nothing. */
export const GATE_MEMORY_ROW_MAX_BYTES = 1 << 20;

/**
 * A gate's withdrawal memory over a vessel's rows. `onTorn` hears the name of a row that loaded as nothing
 * although it stood: the vessel's own log may say so; the wire never does.
 */
export function storedWithdrawals(rows: GateMemoryRows, opts: { readonly onTorn?: (name: string) => void } = {}): GateWithdrawalMemory {
  // Two adapters over one set of rows share one writer queue and one verified view: a second adapter never
  // joins against a row the first already moved.
  let shared = SHARED.get(rows);
  if (shared === undefined) { shared = { verified: new Map(), writing: new Map(), dropped: new Map() }; SHARED.set(rows, shared); }
  /** What this process already verified, by row name: a row verifies once per process, and again after a restart. */
  const { verified, writing, dropped } = shared;

  async function load(scope: FaceScope): Promise<WithdrawalMemory | null> {
    const name = faceProofSubjectRef(scope);
    const known = verified.get(name);
    if (known !== undefined) return known;
    // A read that began before a refused write dropped this row's view may hold bytes the row no longer holds:
    // it answers its own caller and seats nothing.
    const drops = dropped.get(name) ?? 0;
    const bytes = await rows.read(name);
    if (bytes === null) return null;
    const torn = (): null => { try { opts.onTorn?.(name); } catch { /* a log never decides */ } return null; };
    if (!(bytes instanceof Uint8Array) || bytes.length > GATE_MEMORY_ROW_MAX_BYTES) return torn();
    let events: unknown;
    try { events = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)); } catch { return torn(); }
    // The fold reads every event through the withdrawal's own reader and holds each to this scope.
    const fold = foldWithdrawals(scope, events);
    if (!own(fold, "memory")) return torn();
    if ((dropped.get(name) ?? 0) === drops) verified.set(name, fold.memory);
    return fold.memory;
  }

  return {
    read: (scope) => load(scope),
    keep(memory) {
      if (!isWithdrawalMemory(memory)) return;
      const name = faceProofSubjectRef(memory.scope);
      const turn = (writing.get(name) ?? Promise.resolve()).then(async () => {
        const standing = await load(memory.scope);
        const joined = standing === null ? { memory } : learnWithdrawals(standing, heldWithdrawals(memory));
        // A join past the bound refuses: the row keeps what it held.
        if (!own(joined, "memory")) return;
        const held = heldWithdrawals(joined.memory);
        if (standing !== null && held.length === heldWithdrawals(standing).length) return;      // nothing new: nothing to write
        if (held.length === 0) return;
        // A write the vessel's door refuses (another writer moved the row since this view verified it) drops the
        // view: the next read verifies the row again, and never answers from what the row no longer holds.
        try { await rows.write(name, canonicalJsonBytes(held)); }
        catch (refused) { verified.delete(name); dropped.set(name, (dropped.get(name) ?? 0) + 1); throw refused; }
        verified.set(name, joined.memory);
      });
      const settled = turn.catch(() => undefined);
      writing.set(name, settled);
      void settled.then(() => { if (writing.get(name) === settled) writing.delete(name); });
      return turn;
    },
  };
}

/** What every adapter over one set of rows shares: one writer per row, and what this process verified of each. */
const SHARED = new WeakMap<GateMemoryRows, { verified: Map<string, WithdrawalMemory>; writing: Map<string, Promise<void>>; dropped: Map<string, number> }>();

/**
 * Rows kept in this process alone: a stand-in for a vessel's store, for suites and for nothing else.
 * `reopen` answers a new door over the same bytes, as a restarted process opens its store again.
 */
export interface MemoryRows extends GateMemoryRows {
  names(): string[];
  peek(name: string): Uint8Array | null;
  reopen(): MemoryRows;
  readonly writes: number;
}
export function memoryRows(held: Map<string, Uint8Array> = new Map()): MemoryRows {
  let writes = 0;
  return {
    read: (name) => { const bytes = held.get(name); return bytes === undefined ? null : Uint8Array.from(bytes); },
    write: (name, bytes) => { writes++; held.set(name, Uint8Array.from(bytes)); },
    names: () => [...held.keys()].sort(),
    peek: (name) => held.get(name) ?? null,
    reopen: () => memoryRows(held),
    get writes() { return writes; },
  };
}
