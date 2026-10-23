import { describe, expect, test } from "vitest";
import { isIslandToVesselMsg, isVesselToIslandMsg } from "../src/island-protocol.js";
import { PORT_CLOSE, PORT_OPEN, PORT_PRESENCE, PORT_WRITE, mkPortChanges, mkPortReset, mkPortSnapshot, mkPortWritten, readPortIslandMsg, readPortVesselMsg } from "../src/record-port.js";

const open = { type: PORT_OPEN, portId: "p1", wikiUri: "lar:///w", width: "skinny", actor: "alice", maxRecordBytes: 1024, maxBatchBytes: 4096 };

describe("the record port reads whole at the island door", () => {
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
    expect(isVesselToIslandMsg({ type: "port:ask", portId: "p1", askId: "a", kind: "invoke", subject: "act" })).toBe(true);
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
});

describe("the record port reads whole at the vessel door", () => {
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
});
