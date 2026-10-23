/** Clockless, in-memory record log for one wiki actor. No store or transport owns this module. */
import { shapeId, type PortShape } from "./record-port-projection.js";
export type { PortShape } from "./record-port-projection.js";

export interface PortRecord {
  readonly title: string;
  readonly fields: Readonly<Record<string, string>>;
  readonly deleted?: boolean;
  readonly seq?: number;
}

export interface PortEntry extends PortRecord {
  readonly seq: number;
  readonly causedBy: readonly string[];
}


export type ResetReason = "island-restarted" | "compacted" | "shape-changed" | "lagged";
export interface PortReset {
  readonly reason: ResetReason;
  readonly floorSeq: number;
  readonly headSeq: number;
}

export interface SnapshotChunk {
  readonly i: number;
  n: number;
  readonly records: PortRecord[];
}

export interface PortSnapshot {
  readonly snapshotId: string;
  readonly baseSeq: number;
  readonly chunks: SnapshotChunk[];
}

export interface WrittenAnswer {
  readonly txId: string;
  readonly status: "applied" | "partial";
  readonly applied: readonly string[];
  readonly failed: readonly string[];
}

interface LedgerState {
  readonly families: readonly string[];
  readonly digest: string;
  readonly applied: Set<string>;
  answer?: WrittenAnswer;
}

/** Canonical ordered write payload, hashed with FNV-1a 64 over UTF-8 bytes. */
export function transactionDigest(records: readonly {
  readonly title: string;
  readonly fields: Readonly<Record<string, string>>;
  readonly tombstone?: true;
  readonly bag?: string;
}[]): string {
  const families = [...new Set(records.map(record => record.bag ?? "(default)"))];
  const canonical = JSON.stringify([families, records.map(record => [
    record.title,
    Object.entries(record.fields).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0),
    record.tombstone === true,
    record.bag ?? null,
  ])]);
  let hash = 0xcbf29ce484222325n;
  for (const byte of new TextEncoder().encode(canonical)) {
    hash = ((hash ^ BigInt(byte)) * 0x100000001b3n) & 0xffffffffffffffffn;
  }
  return `${canonical.length}:${hash.toString(16).padStart(16, "0")}`;
}

/** A per-actor ledger stores completed answers and resumes partial families. */
export function createTxLedger(limit = 1024, inFlightLimit = 128) {
  if (!Number.isSafeInteger(limit) || limit < 1 || !Number.isSafeInteger(inFlightLimit) || inFlightLimit < 1) {
    throw new RangeError("invalid-ledger-limit");
  }
  const states = new Map<string, LedgerState>();
  const completed: string[] = [];
  const stateFor = (txId: string): LedgerState => {
    const state = states.get(txId);
    if (!state) throw new RangeError("unknown-txid");
    return state;
  };
  return {
    has(txId: string): boolean { return states.has(txId); },
    matches(txId: string, digest: string): boolean {
      const state = states.get(txId);
      return !state || state.digest === digest;
    },
    begin(txId: string, families: readonly string[], digest: string): { pending: string[]; answer?: WrittenAnswer } {
      if (!txId || !digest || families.length === 0 || new Set(families).size !== families.length) throw new RangeError("invalid-transaction");
      let state = states.get(txId);
      if (state && (state.digest !== digest || state.families.length !== families.length || state.families.some((family, i) => family !== families[i]))) {
        throw new RangeError("txid-payload-mismatch");
      }
      if (!state) {
        let active = 0;
        for (const value of states.values()) if (!value.answer) active++;
        if (active >= inFlightLimit) throw new RangeError("in-flight-window-full");
        state = { families: [...families], digest, applied: new Set() };
        states.set(txId, state);
      }
      if (state.answer?.status === "applied") return { pending: [], answer: state.answer };
      return { pending: state.families.filter((family) => !state.applied.has(family)) };
    },
    recordApplied(txId: string, family: string): void {
      const state = stateFor(txId);
      if (!state.families.includes(family)) throw new RangeError("unknown-family");
      if (state.answer?.status === "applied") throw new RangeError("transaction-complete");
      state.applied.add(family);
    },
    answer(txId: string, failed: readonly string[] = []): WrittenAnswer {
      const state = stateFor(txId);
      if (state.answer?.status === "applied") return state.answer;
      if (failed.some((family) => !state.families.includes(family) || state.applied.has(family))) throw new RangeError("invalid-failed-family");
      const applied = state.families.filter((family) => state.applied.has(family));
      const pending = state.families.filter((family) => !state.applied.has(family));
      if (pending.length && failed.length === 0) throw new RangeError("unanswered-families");
      const answer: WrittenAnswer = { txId, status: pending.length ? "partial" : "applied", applied, failed: [...failed] };
      state.answer = answer;
      if (answer.status === "applied") {
        completed.push(txId);
        while (completed.length > limit) states.delete(completed.shift()!);
      }
      return answer;
    },
  };
}

const bytes = (value: unknown): number => new TextEncoder().encode(JSON.stringify(value)).length;

export function validateTx(
  records: readonly PortRecord[],
  limits: { readonly maxRecordBytes: number; readonly maxBatchBytes: number; readonly validateRecord?: (record: PortRecord) => string | undefined },
): { accepted: true } | { refused: string } {
  if (!Number.isSafeInteger(limits.maxRecordBytes) || limits.maxRecordBytes < 1 || !Number.isSafeInteger(limits.maxBatchBytes) || limits.maxBatchBytes < 1) {
    throw new RangeError("invalid-write-limits");
  }
  let total = 0;
  for (const record of records) {
    const refusal = limits.validateRecord?.(record);
    if (refusal) return { refused: refusal };
    const size = bytes(record);
    if (size > limits.maxRecordBytes) return { refused: "record-too-large" };
    total += size;
  }
  if (total > limits.maxBatchBytes) return { refused: "batch-too-large" };
  return { accepted: true };
}

/** The caller enqueues this array in one flush. */
export function echoBeforeWritten<T, W>(changes: readonly T[], written: W): Array<T | W> {
  return [...changes, written];
}

export function createPortLog(options: { readonly bootNonce: string; readonly retainEntries?: number; readonly lagByteBudget: number }) {
  const { bootNonce, lagByteBudget } = options;
  const retainEntries = options.retainEntries ?? 4096;
  if (!bootNonce || bootNonce.includes(".") || !Number.isSafeInteger(retainEntries) || retainEntries < 1 || !Number.isSafeInteger(lagByteBudget) || lagByteBudget < 1) {
    throw new RangeError("invalid-port-log-options");
  }
  let headSeq = 0;
  let floorSeq = 0;
  let snapshotSerial = 0;
  const active = new Map<string, PortSnapshot>();
  const entries: PortEntry[] = [];
  const ledger = createTxLedger();

  const cursorOf = (shape: PortShape, seq: number): string => {
    if (!Number.isSafeInteger(seq) || seq < 0 || seq > headSeq) throw new RangeError("invalid-cursor-seq");
    return `${bootNonce}.${shapeId(shape)}.${seq}`;
  };
  const compact = (): void => {
    const wantedFloor = Math.max(0, headSeq - retainEntries);
    const newFloor = Math.min(wantedFloor, ...[...active.values()].map(snapshot => snapshot.baseSeq));
    while (entries.length && entries[0]!.seq <= newFloor) entries.shift();
    floorSeq = newFloor;
  };
  const reset = (reason: ResetReason) => ({ reset: { reason, floorSeq, headSeq } });

  return {
    ledger,
    get headSeq() { return headSeq; },
    get floorSeq() { return floorSeq; },
    shapeId,
    cursorOf,
    parseCursor(cursor: string): { bootNonce: string; shapeId: string; seq: number } | undefined {
      const match = /^([^.]+)\.([^.]+)\.(0|[1-9]\d*)$/.exec(cursor);
      if (!match) return undefined;
      const seq = Number(match[3]);
      if (!Number.isSafeInteger(seq)) return undefined;
      return { bootNonce: match[1]!, shapeId: match[2]!, seq };
    },
    append(records: readonly PortRecord[], causedBy: readonly string[] | readonly (readonly string[])[]): { seq: number; cursorOf: (shape: PortShape) => string } {
      const causes: readonly (readonly string[])[] = Array.isArray(causedBy[0])
        ? causedBy as readonly (readonly string[])[] : records.map(() => causedBy as readonly string[]);
      if (causes.length !== records.length || causes.some(cause => !Array.isArray(cause) || cause.some(id => !id))) throw new RangeError("invalid-caused-by");
      if (headSeq + records.length > Number.MAX_SAFE_INTEGER) throw new RangeError("sequence-exhausted");
      for (const [index, record] of records.entries()) {
        const entry: PortEntry = { title: record.title, fields: { ...record.fields }, ...(record.deleted ? { deleted: true } : {}), seq: ++headSeq, causedBy: [...causes[index]!] };
        entries.push(entry);
        for (const snapshot of active.values()) for (const chunk of snapshot.chunks) {
          const index = chunk.records.findIndex((item) => item.title === entry.title);
          if (index >= 0) chunk.records.splice(index, 1);
        }
      }
      compact();
      const seq = headSeq;
      return { seq, cursorOf: (shape) => cursorOf(shape, seq) };
    },
    appendValidated(
      records: readonly PortRecord[], causedBy: readonly string[],
      limits: Parameters<typeof validateTx>[1],
    ): { refused: string } | { accepted: true; seq: number; cursorOf: (shape: PortShape) => string } {
      const verdict = validateTx(records, limits);
      if ("refused" in verdict) return verdict;
      return { accepted: true, ...this.append(records, causedBy) };
    },
    openSnapshot(shape: PortShape, records: readonly PortRecord[], maxBatchBytes: number, atSeq = headSeq): PortSnapshot {
      if (!Number.isSafeInteger(maxBatchBytes) || maxBatchBytes < 1) throw new RangeError("invalid-snapshot-limit");
      compact();
      const baseSeq = atSeq;
      const chunks: SnapshotChunk[] = [];
      let batch: PortRecord[] = [];
      let batchBytes = 0;
      for (const record of records) {
        if (record.seq === undefined || !Number.isSafeInteger(record.seq) || record.seq < 0 || record.seq > baseSeq) continue;
        const copy: PortRecord = { title: record.title, fields: { ...record.fields }, ...(record.deleted ? { deleted: true } : {}), seq: record.seq };
        const size = bytes(copy);
        if (size > maxBatchBytes) throw new RangeError("snapshot-record-too-large");
        if (batch.length && (batchBytes + size > maxBatchBytes || batch.length >= 4096)) {
          chunks.push({ i: chunks.length + 1, n: 0, records: batch });
          batch = [];
          batchBytes = 0;
        }
        batch.push(copy);
        batchBytes += size;
      }
      chunks.push({ i: chunks.length + 1, n: 0, records: batch });
      for (const chunk of chunks) chunk.n = chunks.length;
      const snapshot = { snapshotId: `${bootNonce}:snapshot:${++snapshotSerial}:${shapeId(shape)}`, baseSeq, chunks };
      active.set(snapshot.snapshotId, snapshot);
      return snapshot;
    },
    finishSnapshot(snapshotId: string): boolean {
      if (!active.delete(snapshotId)) return false;
      compact();
      return true;
    },
    supersedeSnapshot(): void { active.clear(); compact(); },
    changesSince(cursor: string, shape: PortShape): { entries: PortEntry[]; headCursor: string } | { reset: PortReset } {
      const parsed = this.parseCursor(cursor);
      if (!parsed || parsed.bootNonce !== bootNonce) return reset("island-restarted");
      if (parsed.shapeId !== shapeId(shape)) return reset("shape-changed");
      if (parsed.seq < floorSeq || parsed.seq > headSeq) return reset("compacted");
      const pending = entries.filter((entry) => entry.seq > parsed.seq);
      if (pending.reduce((size, entry) => size + bytes(entry), 0) > lagByteBudget) return reset("lagged");
      return { entries: pending.map((entry) => ({ ...entry, fields: { ...entry.fields }, causedBy: [...entry.causedBy] })), headCursor: cursorOf(shape, headSeq) };
    },
  };
}
