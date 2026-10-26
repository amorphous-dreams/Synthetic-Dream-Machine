import { describe, expect, test } from "vitest";
import { makePortDoor, makePortLeaseTable } from "../src/port-lease.js";
import type { PortGrant, PortMsg_Open, PortVesselToIslandMsg } from "../src/record-port.js";

const open: PortMsg_Open = { type: "port:open", portId: "p", wikiUri: "wiki", width: "full", actor: "page",
  edits: true, maxRecordBytes: 4096, maxBatchBytes: 8192 };
const grant: PortGrant = { faceId: "face", actor: "actor", edits: true, bags: ["b"], admin: false };

describe("port lease door", () => {
  test("second-binding-cannot-act-under-anothers-portid; CONTROL: holder places every page kind", () => {
    const posted: PortVesselToIslandMsg[] = [];
    const door = makePortDoor({ policy: () => grant, post: (_scope, msg) => { posted.push(msg); } });
    expect(door.place("wiki", "A", { type: "port:close", portId: "p" })).toEqual({ ok: false, reason: "port-unleased" });
    expect(door.place("wiki", "A", open)).toEqual({ ok: true });
    const others = [
      { type: "port:close", portId: "p" }, { type: "port:ack", portId: "p", cursor: "c" },
      { type: "port:ask", portId: "p", askId: "a", kind: "filter", subject: "[all[]]" },
      { type: "port:write", portId: "p", txId: "t", records: [{ title: "T", fields: {} }] },
      { type: "port:presence", portId: "p", actorKey: "a", beat: 1 }, open,
    ];
    const count = posted.length;
    for (const msg of others) expect(door.place("wiki", "B", msg)).toEqual({ ok: false, reason: "port-owned" });
    expect(posted).toHaveLength(count);
    for (const msg of others.slice(1)) expect(door.place("wiki", "A", msg).ok).toBe(true);
    expect(door.place("wiki", "A", others[0]).ok).toBe(true);
  });

  test("a-page-cannot-forge-the-lease; CONTROL: the door posts lease before open", () => {
    const posted: PortVesselToIslandMsg[] = [];
    const door = makePortDoor({ policy: () => grant, post: (_scope, msg) => { posted.push(msg); } });
    for (const type of ["port:lease", "port:gone"]) expect(door.place("wiki", "A", { type, portId: "p", grant }))
      .toEqual({ ok: false, reason: "port-kind-refused" });
    expect(door.place("wiki", "A", { type: "port:snapshot", portId: "p" })).toEqual({ ok: false, reason: "port-kind-refused" });
    expect(door.place("wiki", "A", { type: "port:write", portId: "p" })).toEqual({ ok: false, reason: "port-malformed" });
    expect(posted).toEqual([]);
    expect(door.place("wiki", "A", open).ok).toBe(true);
    expect(posted.map(msg => msg.type)).toEqual(["port:lease", "port:open"]);
  });

  test("no-policy-no-port; CONTROL: a live grant admits; revocation sends gone", () => {
    const posted: PortVesselToIslandMsg[] = [];
    expect(makePortDoor({ post: (_scope, msg) => { posted.push(msg); } }).place("wiki", "A", open))
      .toEqual({ ok: false, reason: "port-not-granted" });
    let held: PortGrant | null = null;
    const door = makePortDoor({ policy: () => held, post: (_scope, msg) => { posted.push(msg); } });
    expect(door.place("wiki", "A", open)).toEqual({ ok: false, reason: "port-not-granted" });
    held = grant;
    expect(door.place("wiki", "A", open).ok).toBe(true);
    held = null;
    expect(door.place("wiki", "A", { type: "port:ack", portId: "p", cursor: "c" }))
      .toEqual({ ok: false, reason: "port-not-granted" });
    expect(posted.at(-1)?.type).toBe("port:gone");
    expect(door.holderOf("wiki", "p")).toBeUndefined();
  });

  test("grant-change-resends-the-lease-before-the-write; CONTROL: unchanged grant sends one lease", () => {
    let current: PortGrant = grant;
    const posted: PortVesselToIslandMsg[] = [];
    const door = makePortDoor({ policy: () => current, post: (_scope, msg) => { posted.push(msg); } });
    const write = { type: "port:write", portId: "p", txId: "t", records: [{ title: "T", fields: {} }] };
    door.place("wiki", "A", open);
    door.place("wiki", "A", write);
    expect(posted.map(msg => msg.type)).toEqual(["port:lease", "port:open", "port:write"]);
    current = { ...grant, edits: false };
    door.place("wiki", "A", { ...write, txId: "u" });
    expect(posted.slice(-2).map(msg => msg.type)).toEqual(["port:lease", "port:write"]);
  });

  test("closePortBinding-posts-gone-for-every-lease-and-frees-the-portid; CONTROL: another binding opens", () => {
    const posted: Array<{ scope: string; msg: PortVesselToIslandMsg }> = [];
    const door = makePortDoor({ policy: () => grant, post: (scope, msg) => { posted.push({ scope, msg }); } });
    door.place("one", "A", open);
    door.place("two", "A", open);
    door.closeBinding("A");
    expect(posted.filter(({ msg }) => msg.type === "port:gone").map(({ scope }) => scope)).toEqual(["one", "two"]);
    expect(door.place("one", "B", open).ok).toBe(true);
  });

  test("scope release and holder table keep separate islands", () => {
    const table = makePortLeaseTable();
    expect(table.admit("one", "p", "A")).toBe(true);
    expect(table.admit("two", "p", "B")).toBe(true);
    expect(table.admit("one", "p", "B")).toBe(false);
    table.releaseScope("one");
    expect(table.holder("one", "p")).toBeUndefined();
    expect(table.holder("two", "p")).toBe("B");
  });
});
