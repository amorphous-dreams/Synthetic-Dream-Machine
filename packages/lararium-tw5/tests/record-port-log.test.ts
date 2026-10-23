import { describe, expect, test } from "vitest";
import { createPortLog, echoBeforeWritten, validateTx, type PortRecord } from "../src/record-port-log.js";

const shape = { width: "full", localFilter: "local", fields: ["text", "tags"] };
const otherShape = { ...shape, width: "skinny" };
const record = (title: string, text = title): PortRecord => ({ title, fields: { text } });

describe("record port log", () => {
  test("port-echo-named-by-txid; CONTROL: foreign origin carries an empty cause", () => {
    const log = createPortLog({ bootNonce: "boot", lagByteBudget: 10000 });
    log.append([record("own")], ["tx-1"]);
    log.append([record("foreign")], []);
    const result = log.changesSince(log.cursorOf(shape, 0), shape);
    expect("entries" in result && result.entries.map((entry) => entry.causedBy)).toEqual([["tx-1"], []]);
  });

  test("port-write-retry-is-idempotent; CONTROL: a single-family write answers applied with one echo", () => {
    const log = createPortLog({ bootNonce: "boot", lagByteBudget: 10000 });
    const first = log.ledger.begin("tx-1", ["bag-a"]);
    expect(first.pending).toEqual(["bag-a"]);
    log.append([record("a")], ["tx-1"]);
    log.ledger.recordApplied("tx-1", "bag-a");
    const answer = log.ledger.answer("tx-1");
    expect(answer).toEqual({ txId: "tx-1", status: "applied", applied: ["bag-a"], failed: [] });
    expect(log.ledger.begin("tx-1", ["bag-a"])).toEqual({ pending: [], answer });
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
    log.ledger.begin("tx", ["a", "b"]);
    log.ledger.recordApplied("tx", "a");
    expect(log.ledger.answer("tx", ["b"])).toEqual({ txId: "tx", status: "partial", applied: ["a"], failed: ["b"] });
    expect(log.ledger.begin("tx", ["a", "b"]).pending).toEqual(["b"]);
    log.ledger.recordApplied("tx", "b");
    expect(log.ledger.answer("tx").status).toBe("applied");
    expect(log.ledger.begin("tx", ["a", "b"]).pending).toEqual([]);
  });

  test("port-partial-visible-by-txid; CONTROL: each family gets one sequence", () => {
    const log = createPortLog({ bootNonce: "boot", lagByteBudget: 10000 });
    log.append([record("a")], ["tx"]);
    log.append([record("b")], ["tx"]);
    const result = log.changesSince(log.cursorOf(shape, 0), shape);
    expect("entries" in result && result.entries.map((entry) => [entry.seq, entry.causedBy])).toEqual([[1, ["tx"]], [2, ["tx"]]]);
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
