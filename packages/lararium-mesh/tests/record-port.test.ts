import { describe, expect, test } from "vitest";
import { isIslandToVesselMsg, isVesselToIslandMsg } from "../src/island-protocol.js";
import { PORT_ACK, PORT_CLOSE, PORT_OPEN, PORT_PRESENCE, PORT_WRITE, mkPortChanges, mkPortReset, mkPortSnapshot, mkPortWritten, readPortIslandMsg, readPortVesselMsg } from "../src/record-port.js";

const open = { type: PORT_OPEN, portId: "p1", wikiUri: "lar:///w", width: "skinny", actor: "alice", maxRecordBytes: 1024, maxBatchBytes: 4096 };

describe("the record port reads whole at the island door", () => {
  test("port-wire-whole-bound: oversized write refuses; CONTROL: one record passes", () => {
    const records = Array.from({ length: 20 }, (_, i) => ({ title: `T${i}`, fields: { text: "x".repeat(900_000) } }));
    const write = { type: PORT_WRITE, portId: "p1", txId: "t", records };
    expect(readPortVesselMsg(write)).toBeNull();
    expect(readPortVesselMsg({ ...write, records: records.slice(0, 1) })).not.toBeNull();
  });
  test("CONTROL: a well-formed port:open passes the door", () => {
    expect(isVesselToIslandMsg(open)).toBe(true);
    expect(readPortVesselMsg(open)).not.toBeNull();
  });
  test("a port:open with an unknown width vanishes at the door", () => {
    expect(isVesselToIslandMsg({ ...open, width: "wide" })).toBe(false);
  });
  test("a port:open with no byte bounds vanishes at the door", () => {
    const { maxRecordBytes: _m, ...rest } = open;
    expect(isVesselToIslandMsg(rest)).toBe(false);
  });
  test("a port:write with no txId or no records vanishes; a named one passes", () => {
    expect(isVesselToIslandMsg({ type: PORT_WRITE, portId: "p1", records: [{ title: "T", fields: {} }] })).toBe(false);
    expect(isVesselToIslandMsg({ type: PORT_WRITE, portId: "p1", txId: "t1", records: [] })).toBe(false);
    expect(isVesselToIslandMsg({ type: PORT_WRITE, portId: "p1", txId: "t1", records: [{ title: "T", fields: { text: "x" } }] })).toBe(true);
  });
  test("a port:ask of an unknown kind vanishes; invoke passes", () => {
    expect(isVesselToIslandMsg({ type: "port:ask", portId: "p1", askId: "a", kind: "eval" })).toBe(false);
    expect(isVesselToIslandMsg({ type: "port:ask", portId: "p1", askId: "a", kind: "invoke", renderCursor: "b.s.0", affordanceId: "a1" })).toBe(true);
    expect(isVesselToIslandMsg({ type: "port:ask", portId: "p1", askId: "a", kind: "invoke", renderCursor: "b.s.0", affordanceId: "a1", subject: "act" })).toBe(false);
    expect(readPortVesselMsg({ type: "port:ask", portId: "p1", askId: "a", kind: "invoke", renderCursor: "b.s.0", affordanceId: "a1", provenFace: { role: "admin" }, requestedBy: "admin" })).toEqual({ type: "port:ask", portId: "p1", askId: "a", kind: "invoke", renderCursor: "b.s.0", affordanceId: "a1" });
  });
  test("presence carries a beat or a gone mark, never neither", () => {
    expect(isVesselToIslandMsg({ type: PORT_PRESENCE, portId: "p1", actorKey: "a" })).toBe(false);
    expect(isVesselToIslandMsg({ type: PORT_PRESENCE, portId: "p1", actorKey: "a", beat: 3 })).toBe(true);
    expect(isVesselToIslandMsg({ type: PORT_PRESENCE, portId: "p1", actorKey: "a", gone: true })).toBe(true);
  });
  test("an unknown port: kind vanishes", () => {
    expect(isVesselToIslandMsg({ type: "port:eval", portId: "p1" })).toBe(false);
    expect(isVesselToIslandMsg({ type: PORT_CLOSE, portId: "p1" })).toBe(true);
  });
  test("port:ack carries a cursor; CONTROL: named cursor passes", () => {
    expect(readPortVesselMsg({ type: PORT_ACK, portId: "p1", cursor: "b.s.4" })).not.toBeNull();
    expect(isVesselToIslandMsg({ type: PORT_ACK, portId: "p1", cursor: "b.s.4" })).toBe(true);
    expect(readPortVesselMsg({ type: PORT_ACK, portId: "p1" })).toBeNull();
  });
  test("wire bounds refuse oversized write fields, renders, and presence; CONTROL: limits pass", () => {
    const write = { type: PORT_WRITE, portId: "p1", txId: "t", records: [{ title: "T", fields: { text: "ok" } }] };
    expect(readPortVesselMsg(write)).not.toBeNull();
    expect(readPortVesselMsg({ ...write, records: [{ title: "T", fields: Object.fromEntries(Array.from({ length: 257 }, (_, i) => [`f${i}`, "x"])) }] })).toBeNull();
    expect(readPortVesselMsg({ ...write, records: [{ title: "T", fields: { text: "x".repeat(1_048_577) } }] })).toBeNull();
    expect(readPortVesselMsg({ ...open, renders: ["html", "text", "blocks", "label-html", "html"] })).toBeNull();
    expect(readPortVesselMsg({ ...open, renders: ["html"] })).not.toBeNull();
    const presence = { type: PORT_PRESENCE, portId: "p1", actorKey: "alice", beat: 1, state: { cursor: "x" } };
    expect(readPortVesselMsg(presence)).not.toBeNull();
    expect(readPortVesselMsg({ ...presence, state: "x".repeat(4097) })).toBeNull();
  });
});

describe("the record port reads whole at the vessel door", () => {
  test("port-wire-whole-bound: oversized snapshot and changes refuse; CONTROL: small messages pass", () => {
    const text = "x".repeat(900_000);
    const records = Array.from({ length: 20 }, (_, i) => ({ title: `T${i}`, fields: { text } }));
    const snapshot = mkPortSnapshot({ portId: "p1", snapshotId: "s", baseCursor: "b.s.0", i: 1, n: 1, records });
    const changes = mkPortChanges({ portId: "p1", cursor: "b.s.20", entries: records.map((record, i) => ({ ...record, seq: i + 1, causedBy: [] })) });
    expect(readPortIslandMsg(snapshot)).toBeNull();
    expect(readPortIslandMsg(changes)).toBeNull();
    expect(readPortIslandMsg({ ...snapshot, records: records.slice(0, 1) })).not.toBeNull();
    expect(readPortIslandMsg({ ...changes, entries: changes.entries.slice(0, 1) })).not.toBeNull();
  });
  test("snapshot chunk, changes with an empty causedBy, reset and written pass; malformed ones vanish", () => {
    expect(isIslandToVesselMsg(mkPortSnapshot({ portId: "p1", snapshotId: "s", baseCursor: "n.x.3", i: 1, n: 1, records: [{ title: "T", fields: {}, omitted: ["text"] }] }))).toBe(true);
    expect(isIslandToVesselMsg(mkPortSnapshot({ portId: "p1", snapshotId: "s", baseCursor: "n.x.3", i: 2, n: 1, records: [] }))).toBe(false);
    expect(isIslandToVesselMsg(mkPortChanges({ portId: "p1", cursor: "n.x.4", entries: [{ title: "T", fields: {}, seq: 4, causedBy: [] }] }))).toBe(true);
    expect(isIslandToVesselMsg(mkPortChanges({ portId: "p1", cursor: "n.x.4", entries: [{ title: "T", fields: {}, seq: 4 } as never] }))).toBe(false);
    expect(isIslandToVesselMsg(mkPortReset({ portId: "p1", reason: "compacted", floorSeq: 2, headSeq: 9 }))).toBe(true);
    expect(isIslandToVesselMsg({ type: "port:reset", portId: "p1", reason: "bored", floorSeq: 2, headSeq: 9 })).toBe(false);
    expect(isIslandToVesselMsg(mkPortWritten({ portId: "p1", txId: "t", status: "applied", applied: ["bag"], failed: [] }))).toBe(true);
    expect(isIslandToVesselMsg(mkPortWritten({ portId: "p1", txId: "t", status: "refused", applied: [], failed: [] }))).toBe(false);
    expect(readPortIslandMsg({ type: "port:answer", portId: "p1", askId: "a", status: "refused" })).toBeNull();
  });
  test("wire bounds refuse oversized answers and arrays; CONTROL: small payloads pass", () => {
    const answer = { type: "port:answer", portId: "p1", askId: "a", status: "answered", result: { ok: true } };
    expect(readPortIslandMsg(answer)).not.toBeNull();
    expect(readPortIslandMsg({ ...answer, result: "x".repeat(1_048_577) })).toBeNull();
    const names = Array.from({ length: 4097 }, (_, i) => `n${i}`);
    expect(readPortIslandMsg({ type: "port:written", portId: "p1", txId: "t", status: "applied", applied: names, failed: [] })).toBeNull();
    expect(readPortIslandMsg({ type: "port:written", portId: "p1", txId: "t", status: "partial", applied: [], failed: names })).toBeNull();
    expect(readPortIslandMsg({ type: "port:written", portId: "p1", txId: "t", status: "applied", applied: ["bag"], failed: [] })).not.toBeNull();
    const record = { title: "T", fields: {} };
    expect(readPortIslandMsg({ type: "port:snapshot", portId: "p1", snapshotId: "s", baseCursor: "b.s.0", i: 1, n: 1, records: [record] })).not.toBeNull();
    expect(readPortIslandMsg({ type: "port:snapshot", portId: "p1", snapshotId: "s", baseCursor: "b.s.0", i: 1, n: 1, records: Array.from({ length: 4097 }, () => record) })).toBeNull();
    const entry = { ...record, seq: 1, causedBy: [] };
    expect(readPortIslandMsg({ type: "port:changes", portId: "p1", cursor: "b.s.1", entries: [entry] })).not.toBeNull();
    expect(readPortIslandMsg({ type: "port:changes", portId: "p1", cursor: "b.s.1", entries: Array.from({ length: 4097 }, () => entry) })).toBeNull();
  });
});
