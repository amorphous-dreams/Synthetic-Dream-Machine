/** Clockless, in-memory record log for one wiki actor. No store or transport owns this module. */

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

export interface PortShape {
  readonly width: string;
  readonly localFilter: string;
  readonly fields: readonly string[];
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
  readonly applied: Set<string>;
  answer?: WrittenAnswer;
}

/** A per-port ledger stores completed answers and resumes partial families. */
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
    begin(txId: string, families: readonly string[]): { pending: string[]; answer?: WrittenAnswer } {
      if (!txId || families.length === 0 || new Set(families).size !== families.length) throw new RangeError("invalid-transaction");
      let state = states.get(txId);
      if (state && (state.families.length !== families.length || state.families.some((family, i) => family !== families[i]))) {
        throw new RangeError("txid-family-mismatch");
      }
      if (!state) {
        let active = 0;
        for (const value of states.values()) if (!value.answer) active++;
        if (active >= inFlightLimit) throw new RangeError("in-flight-window-full");
        state = { families: [...families], applied: new Set() };
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
  let active: PortSnapshot | undefined;
  const entries: PortEntry[] = [];
  const ledger = createTxLedger();

  const shapeId = (shape: PortShape): string => {
    const key = JSON.stringify([shape.width, shape.localFilter, [...shape.fields].sort()]);
    let hash = 2166136261;
    for (const byte of new TextEncoder().encode(key)) hash = Math.imul(hash ^ byte, 16777619) >>> 0;
    return hash.toString(36);
  };
  const cursorOf = (shape: PortShape, seq: number): string => {
    if (!Number.isSafeInteger(seq) || seq < 0 || seq > headSeq) throw new RangeError("invalid-cursor-seq");
    return `${bootNonce}.${shapeId(shape)}.${seq}`;
  };
  const compact = (): void => {
    const wantedFloor = Math.max(0, headSeq - retainEntries);
    const newFloor = active ? Math.min(wantedFloor, active.baseSeq) : wantedFloor;
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
    append(records: readonly PortRecord[], causedBy: readonly string[]): { seq: number; cursorOf: (shape: PortShape) => string } {
      if (!Array.isArray(causedBy) || causedBy.some((id) => !id)) throw new RangeError("invalid-caused-by");
      if (headSeq + records.length > Number.MAX_SAFE_INTEGER) throw new RangeError("sequence-exhausted");
      for (const record of records) {
        const entry: PortEntry = { title: record.title, fields: { ...record.fields }, ...(record.deleted ? { deleted: true } : {}), seq: ++headSeq, causedBy: [...causedBy] };
        entries.push(entry);
        if (active) for (const chunk of active.chunks) {
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
    openSnapshot(shape: PortShape, records: readonly PortRecord[], maxBatchBytes: number): PortSnapshot {
      if (!Number.isSafeInteger(maxBatchBytes) || maxBatchBytes < 1) throw new RangeError("invalid-snapshot-limit");
      active = undefined;
      compact();
      const baseSeq = headSeq;
      const chunks: SnapshotChunk[] = [];
      let batch: PortRecord[] = [];
      let batchBytes = 0;
      for (const record of records) {
        if (record.seq === undefined || !Number.isSafeInteger(record.seq) || record.seq < 0 || record.seq > baseSeq) continue;
        const copy: PortRecord = { title: record.title, fields: { ...record.fields }, ...(record.deleted ? { deleted: true } : {}), seq: record.seq };
        const size = bytes(copy);
        if (size > maxBatchBytes) throw new RangeError("snapshot-record-too-large");
        if (batch.length && batchBytes + size > maxBatchBytes) {
          chunks.push({ i: chunks.length + 1, n: 0, records: batch });
          batch = [];
          batchBytes = 0;
        }
        batch.push(copy);
        batchBytes += size;
      }
      chunks.push({ i: chunks.length + 1, n: 0, records: batch });
      for (const chunk of chunks) chunk.n = chunks.length;
      active = { snapshotId: `${bootNonce}:snapshot:${++snapshotSerial}:${shapeId(shape)}`, baseSeq, chunks };
      return active;
    },
    finishSnapshot(snapshotId: string): boolean {
      if (!active || active.snapshotId !== snapshotId) return false;
      active = undefined;
      compact();
      return true;
    },
    supersedeSnapshot(): void { active = undefined; compact(); },
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
