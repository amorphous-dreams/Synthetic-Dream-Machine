/**
 * shore-log — the vessel's log as records: one per distinct event, collapsed at the source, bounded by the ring.
 *
 * Control: a storm of one line stands ONE record whose count climbs; two subjects of one kind stand two; a secret-shaped
 * string never rides a record; the seq orders and the clock annotates; past the bound the oldest touched leaves and the
 * eviction counts on the ring's own record; the closing slice keeps each event's last line.
 */
import { describe, test, expect } from "vitest";
import {
  ShoreLogRing, classifyLogLine, closingSlice, readShoreLogPlacement, redactLogLine, shoreLogFields, shoreLogHeld,
  shoreLogJsonLine, shoreLogKey, shoreLogPlacements, shoreLogRecordOf, SHORE_LOG_EVICTED_KIND, SHORE_LOG_PREFIX,
} from "../src/shore-log.js";
import { isVesselToIslandMsg, mkDaemonShoreLog } from "../src/island-protocol.js";

const UNSEALED = (doc: string) => `[sealed-rest] save-unsealed (holder-silent: no answer): ${doc}… waits in memory, never clear, until a session seals it`;

describe("a line names its event", () => {
  test("the tag and the refusal word make the kind; the elided document id makes the subject", () => {
    expect(classifyLogLine(UNSEALED("3xYqAbCdEfGh"))).toEqual({ kind: "sealed-rest/save-unsealed", subject: "3xYqAbCdEfGh", severity: "warn" });
  });
  test("a line with no code reads its tag and its first words; a lar: URI names the subject", () => {
    const e = classifyLogLine("[shore] kept the disk: lar:///ha.ka.ba/x/y (/p) in bag — named, so …");
    expect(e?.kind).toBe("shore/kept-the-disk");
    expect(e?.subject).toBe("lar:///ha.ka.ba/x/y");
  });
  test("a face handle names the subject; an error word reads error; stderr reads at least warn", () => {
    expect(classifyLogLine("[faces] face h2 carries no mirror of its own (boom)")?.subject).toBe("h2");
    expect(classifyLogLine("[lararium] fatal: the store refused")?.severity).toBe("error");
    expect(classifyLogLine("[lararium] phase → boot", "stderr")?.severity).toBe("warn");
    expect(classifyLogLine("[lararium] phase → boot", "stdout")?.severity).toBe("info");
  });
  test("a blank line names nothing; an untagged line reads untagged; colour codes drop", () => {
    expect(classifyLogLine("   ")).toBeNull();
    expect(classifyLogLine("just some words here")?.kind).toBe("untagged/just-some-words");
    expect(classifyLogLine("\u001b[31m[faces] skips the folder\u001b[0m")?.kind).toBe("faces/skips-the-folder");
  });
});

describe("the ring collapses at the source", () => {
  test("a storm of one line stands one record: count climbs, seqs move, the line replaces", () => {
    let t = 0;
    const ring = new ShoreLogRing({ boot: "b00t", now: () => `t${++t}` });
    for (let i = 0; i < 5000; i++) ring.take(UNSEALED("3xYqAbCdEfGh"));
    const recs = ring.records();
    expect(recs).toHaveLength(1);
    expect(recs[0]).toMatchObject({ kind: "sealed-rest/save-unsealed", subject: "3xYqAbCdEfGh", count: 5000, firstSeq: 1, lastSeq: 5000, boot: "b00t", firstAt: "t1", lastAt: "t5000" });
    expect(ring.drainChanged()).toHaveLength(1);
    expect(ring.drainChanged()).toHaveLength(0);
  });
  test("two subjects of one kind stand two records, each its own key", () => {
    const ring = new ShoreLogRing({ boot: "b" });
    ring.take(UNSEALED("aaaaaaAAAA"));
    ring.take(UNSEALED("bbbbbbBBBB"));
    ring.take(UNSEALED("aaaaaaAAAA"));
    expect(ring.records().map((r) => [r.subject, r.count])).toEqual([["bbbbbbBBBB", 1], ["aaaaaaAAAA", 2]]);
    expect(shoreLogKey("k", "a")).not.toBe(shoreLogKey("k", "b"));
  });
  test("past the bound the oldest touched leaves, and the eviction counts on the ring's own record", () => {
    const ring = new ShoreLogRing({ boot: "b", capacity: 4 });
    for (let i = 0; i < 20; i++) ring.take(`[x] thing ${i} lar:///ha.ka.ba/s/${i}`);
    const recs = ring.records();
    expect(recs.length).toBeLessThanOrEqual(4);
    const evicted = recs.find((r) => r.kind === SHORE_LOG_EVICTED_KIND);
    expect(evicted).toBeDefined();
    expect(ring.evicted).toBeGreaterThan(0);
    expect(recs.some((r) => r.subject === "lar:///ha.ka.ba/s/19")).toBe(true);
    expect(recs.some((r) => r.subject === "lar:///ha.ka.ba/s/0")).toBe(false);
  });
});

describe("the strict secret-shape guard", () => {
  test("a token and a bare minted hex never ride a record's line", () => {
    const ring = new ShoreLogRing({ boot: "b" });
    const hex = "a".repeat(64);
    ring.take(`[wire] sent ghp_${"A".repeat(30)} and ${hex}`);
    const line = ring.records()[0]!.line;
    expect(line).not.toContain("ghp_");
    expect(line).not.toContain(hex);
    expect(line).toContain("[redacted: secret-shaped]");
  });
  test("the strict guard lets no fixture stand, and bounds the line", () => {
    expect(redactLogLine("AKIAIOSFODNN7EXAMPLE")).toContain("[redacted");
    expect(redactLogLine("x".repeat(5000)).length).toBeLessThanOrEqual(1000);
  });
});

describe("records cross as fields, JSON lines and island batches", () => {
  const ring = new ShoreLogRing({ boot: "b1", now: () => "t" });
  ring.take(UNSEALED("3xYqAbCdEfGh"));
  ring.take(UNSEALED("3xYqAbCdEfGh"));
  const rec = ring.records()[0]!;

  test("fields round-trip; a hand's ack reads held until the event recurs past it", () => {
    const fields = shoreLogFields(rec);
    expect(fields.title.startsWith(SHORE_LOG_PREFIX)).toBe(true);
    const back = shoreLogRecordOf(fields);
    expect(back).toMatchObject({ key: rec.key, count: 2, lastSeq: 2, ack: null });
    expect(shoreLogHeld(back!)).toBe(true);
    expect(shoreLogHeld({ lastSeq: 2, ack: 2 })).toBe(false);
    expect(shoreLogHeld({ lastSeq: 3, ack: 2 })).toBe(true);
  });
  test("the closing slice keeps each event's last line, ordered by its last change", () => {
    const other = new ShoreLogRing({ boot: "b1" });
    other.take("[faces] skips h1");
    const lines = [shoreLogJsonLine({ ...rec, count: 1, lastSeq: 1 }), shoreLogJsonLine(other.records()[0]!), "not json", shoreLogJsonLine(rec)];
    const slice = closingSlice(lines);
    expect(slice.map((r) => [r.kind, r.count])).toEqual([["faces/skips", 1], ["sealed-rest/save-unsealed", 2]]);
  });
  test("an island batch reads whole at the door; a placement off the prefix, or a field that reads no string, refuses", () => {
    const msg = mkDaemonShoreLog(shoreLogPlacements([rec]));
    expect(isVesselToIslandMsg(msg)).toBe(true);
    expect(readShoreLogPlacement({ title: "$:/elsewhere", fields: { title: "$:/elsewhere" } })).toBeNull();
    expect(isVesselToIslandMsg({ type: "daemon:shore-log", records: [{ title: shoreLogFields(rec).title, fields: { ...shoreLogFields(rec), count: 3 } }] })).toBe(false);
    expect(isVesselToIslandMsg({ type: "daemon:shore-log", records: "nope" })).toBe(false);
  });
});
