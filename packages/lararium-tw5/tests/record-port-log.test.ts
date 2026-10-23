import { describe, expect, test } from "vitest";
import { createPortLog, echoBeforeWritten, transactionDigest, validateTx, type PortRecord } from "../src/record-port-log.js";
import { shapeId } from "../src/record-port-projection.js";

const shape = { width: "full" as const, localFilter: ["local"], fields: ["text", "tags"] };
const otherShape = { ...shape, width: "skinny" as const };
const record = (title: string, text = title): PortRecord => ({ title, fields: { text } });

describe("record port log", () => {
  test("txid-payload-mismatch binds ordered canonical payload; CONTROL: reordered field keys resume", () => {
    const ledger = createPortLog({ bootNonce: "boot", lagByteBudget: 1000 }).ledger;
    const original = transactionDigest([
      { title: "A", fields: { text: "one" } }, { title: "B", fields: { text: "two", tags: "x" }, bag: "second" },
    ]);
    ledger.begin("tx", ["(default)", "second"], original);
    ledger.recordApplied("tx", "(default)");
    ledger.answer("tx", ["second"]);
    const changed = transactionDigest([
      { title: "A", fields: { text: "one" } }, { title: "B", fields: { text: "changed", tags: "x" }, bag: "second" },
    ]);
    expect(() => ledger.begin("tx", ["(default)", "second"], changed)).toThrow("txid-payload-mismatch");
    const canonical = transactionDigest([
      { title: "A", fields: { text: "one" } }, { title: "B", fields: { tags: "x", text: "two" }, bag: "second" },
    ]);
    expect(canonical).toBe(original);
    expect(ledger.begin("tx", ["(default)", "second"], canonical).pending).toEqual(["second"]);
  });
  test("canonical shape hash drives log cursors; CONTROL: same shape resumes", () => {
    const log = createPortLog({ bootNonce: "boot", lagByteBudget: 1000 });
    expect(log.cursorOf(shape, 0)).toBe(`boot.${shapeId(shape)}.0`);
    expect(log.changesSince(log.cursorOf(shape, 0), shape)).toMatchObject({ entries: [] });
  });
  test("port-echo-named-by-txid; CONTROL: foreign origin carries an empty cause", () => {
    const log = createPortLog({ bootNonce: "boot", lagByteBudget: 10000 });
    log.append([record("own"), record("foreign")], [["tx-1"], []]);
    const result = log.changesSince(log.cursorOf(shape, 0), shape);
    expect("entries" in result && result.entries.map((entry) => entry.causedBy)).toEqual([["tx-1"], []]);
  });

  test("port-write-retry-is-idempotent; CONTROL: a single-family write answers applied with one echo", () => {
    const log = createPortLog({ bootNonce: "boot", lagByteBudget: 10000 });
    const first = log.ledger.begin("tx-1", ["bag-a"], "payload-a");
    expect(first.pending).toEqual(["bag-a"]);
    log.append([record("a")], ["tx-1"]);
    log.ledger.recordApplied("tx-1", "bag-a");
    const answer = log.ledger.answer("tx-1");
    expect(answer).toEqual({ txId: "tx-1", status: "applied", applied: ["bag-a"], failed: [] });
    expect(log.ledger.begin("tx-1", ["bag-a"], "payload-a")).toEqual({ pending: [], answer });
    expect(log.headSeq).toBe(1);
  });

  test("port-written-follows-echo; CONTROL: one echo precedes one applied answer", () => {
    const written = { txId: "tx", status: "applied" as const };
    const messages = echoBeforeWritten([{ kind: "changes", family: "a" }, { kind: "changes", family: "b" }], written);
    expect(messages.map((item) => "kind" in item ? item.kind : "written")).toEqual(["changes", "changes", "written"]);
    expect(echoBeforeWritten([{ kind: "changes" }], written)).toEqual([{ kind: "changes" }, written]);
  });

  test("port-write-refused-whole; CONTROL: a bounded batch passes validation", () => {
    const log = createPortLog({ bootNonce: "boot", lagByteBudget: 10000 });
    expect(log.appendValidated([record("too-big", "x".repeat(100))], ["tx"], { maxRecordBytes: 80, maxBatchBytes: 200 })).toEqual({ refused: "record-too-large" });
    expect(log.appendValidated([record("a", "x".repeat(30)), record("b", "x".repeat(30))], ["tx"], { maxRecordBytes: 100, maxBatchBytes: 80 })).toEqual({ refused: "batch-too-large" });
    expect(log.headSeq).toBe(0);
    expect(validateTx([record("small")], { maxRecordBytes: 100, maxBatchBytes: 100 })).toEqual({ accepted: true });
    expect(log.appendValidated([record("small")], ["tx"], { maxRecordBytes: 100, maxBatchBytes: 100 })).toMatchObject({ accepted: true, seq: 1 });
  });

  test("port-write-partial-resumes; CONTROL: an applied family stays applied", () => {
    const log = createPortLog({ bootNonce: "boot", lagByteBudget: 10000 });
    log.ledger.begin("tx", ["a", "b"], "payload-ab");
    log.ledger.recordApplied("tx", "a");
    expect(log.ledger.answer("tx", ["b"])).toEqual({ txId: "tx", status: "partial", applied: ["a"], failed: ["b"] });
    expect(log.ledger.begin("tx", ["a", "b"], "payload-ab").pending).toEqual(["b"]);
    log.ledger.recordApplied("tx", "b");
    expect(log.ledger.answer("tx").status).toBe("applied");
    expect(log.ledger.begin("tx", ["a", "b"], "payload-ab").pending).toEqual([]);
  });

  test("port-partial-visible-by-txid; CONTROL: one family appends contiguous entry sequences", () => {
    const log = createPortLog({ bootNonce: "boot", lagByteBudget: 10000 });
    log.append([record("a"), record("b")], ["tx"]);
    log.append([record("c")], ["tx"]);
    const result = log.changesSince(log.cursorOf(shape, 0), shape);
    expect("entries" in result && result.entries.map((entry) => [entry.seq, entry.causedBy])).toEqual([[1, ["tx"]], [2, ["tx"]], [3, ["tx"]]]);
  });

  test("port-snapshot-base-is-stable; CONTROL: no change gives a complete plain snapshot", () => {
    const log = createPortLog({ bootNonce: "boot", retainEntries: 1, lagByteBudget: 10000 });
    log.append([record("a"), record("b")], []);
    const snap = log.openSnapshot(shape, [{ ...record("a"), seq: 1 }, { ...record("b"), seq: 2 }], 1000);
    expect(snap.baseSeq).toBe(2);
    expect(snap.chunks.flatMap((chunk) => chunk.records.map((r) => r.title))).toEqual(["a", "b"]);
    log.append([record("c")], []);
    expect(log.floorSeq).toBeLessThanOrEqual(2);
    log.finishSnapshot(snap.snapshotId);
    expect(log.floorSeq).toBe(2);
  });

  test("port-snapshot-changed-record-arrives-once; CONTROL: unchanged record stays in transfer", () => {
    const log = createPortLog({ bootNonce: "boot", lagByteBudget: 10000 });
    log.append([record("changed"), record("steady")], []);
    const snap = log.openSnapshot(shape, [{ ...record("changed"), seq: 1 }, { ...record("steady"), seq: 2 }], 1000);
    log.append([record("changed", "new")], []);
    expect(snap.chunks.flatMap((chunk) => chunk.records.map((r) => r.title))).toEqual(["steady"]);
    const delta = log.changesSince(log.cursorOf(shape, snap.baseSeq), shape);
    expect("entries" in delta && delta.entries.map((r) => r.title)).toEqual(["changed"]);
  });

  test("concurrent snapshot pins protect each open; CONTROL: finishing both permits compaction", () => {
    const log = createPortLog({ bootNonce: "boot", retainEntries: 1, lagByteBudget: 10000 });
    log.append([record("a")], []);
    const first = log.openSnapshot(shape, [{ ...record("a"), seq: 1 }], 1000);
    const second = log.openSnapshot(shape, [{ ...record("a"), seq: 1 }], 1000);
    log.append([record("b"), record("c")], []);
    log.finishSnapshot(first.snapshotId);
    expect(log.floorSeq).toBe(1);
    log.finishSnapshot(second.snapshotId);
    expect(log.floorSeq).toBe(2);
  });

  test("port-cursor-reset-on-width-change; CONTROL: same shape resumes", () => {
    const log = createPortLog({ bootNonce: "boot", lagByteBudget: 10000 });
    const cursor = log.cursorOf(shape, 0);
    expect(log.changesSince(cursor, otherShape)).toMatchObject({ reset: { reason: "shape-changed" } });
    expect(log.changesSince(cursor, shape)).toMatchObject({ entries: [] });
  });

  test("port-cursor-reset-on-expiry; CONTROL: cursor inside retention resumes", () => {
    const log = createPortLog({ bootNonce: "new", retainEntries: 1, lagByteBudget: 10000 });
    log.append([record("a"), record("b")], []);
    expect(log.changesSince(log.cursorOf(shape, 0), shape)).toMatchObject({ reset: { reason: "compacted" } });
    expect(log.changesSince("old." + log.shapeId(shape) + ".1", shape)).toMatchObject({ reset: { reason: "island-restarted" } });
    expect(log.changesSince(log.cursorOf(shape, 1), shape)).toMatchObject({ entries: [{ title: "b", seq: 2 }] });
  });

  test("port-tombstone-then-compaction-resets; CONTROL: tombstone in range arrives as delete", () => {
    const log = createPortLog({ bootNonce: "boot", retainEntries: 1, lagByteBudget: 10000 });
    log.append([{ title: "gone", fields: {}, deleted: true }], []);
    expect(log.changesSince(log.cursorOf(shape, 0), shape)).toMatchObject({ entries: [{ title: "gone", deleted: true, seq: 1 }] });
    log.append([record("next")], []);
    expect(log.changesSince(log.cursorOf(shape, 0), shape)).toMatchObject({ reset: { reason: "compacted" } });
  });

  test("lagged reset; CONTROL: small backlog delivers changes", () => {
    const log = createPortLog({ bootNonce: "boot", lagByteBudget: 90 });
    const cursor = log.cursorOf(shape, 0);
    log.append([record("a")], []);
    expect(log.changesSince(cursor, shape)).toHaveProperty("entries");
    log.append([record("b", "x".repeat(100))], []);
    expect(log.changesSince(cursor, shape)).toMatchObject({ reset: { reason: "lagged" } });
  });
});
