import { describe, expect, test } from "vitest";
import { realPort, ofType, open } from "./record-port-real-rig.js";

const origin = { kind: "tw-local", instanceId: "foreign" } as const;
const widen = (width: string, portId = "p") => ({ type: "port:widen", portId, width });
async function standing(width: "skinny" | "full") {
  const r = await realPort();
  await r.composite.put({ tiddler: { title: "Ordinary", text: "body", tags: "one" } }, origin);
  await r.send({ ...open, width });
  return r;
}

describe("a port:widen row widens an open port in place", () => {
  test("skinny to full posts a fresh snapshot on the same portId with the omitted body; no reset, no gone", async () => {
    const r = await standing("skinny");
    expect(ofType(r.messages, "port:snapshot")[0]?.records[0]?.omitted).toContain("text");
    await r.send(widen("full"));
    const snapshots = ofType(r.messages, "port:snapshot");
    expect(snapshots).toHaveLength(2);
    expect(snapshots[1]).toMatchObject({ portId: "p" });
    expect(snapshots[1]!.snapshotId).not.toBe(snapshots[0]!.snapshotId);
    expect(snapshots[1]!.records[0]?.fields.text).toBe("body");
    expect(snapshots[1]!.records[0]?.omitted ?? []).not.toContain("text");
    expect(ofType(r.messages, "port:reset")).toEqual([]);
    expect(r.messages.some(m => m.type === "port:gone")).toBe(false);
    await r.close();
  });
  test("a later change reaches the widened port once, at full width", async () => {
    const r = await standing("skinny");
    await r.send(widen("full"));
    await r.composite.put({ tiddler: { title: "Later", text: "late body" } }, origin);
    await (await import("./record-port-real-rig.js")).pump();
    const entries = ofType(r.messages, "port:changes").flatMap(m => m.entries).filter(e => e.title === "Later");
    expect(entries).toHaveLength(1);
    expect(entries[0]!.fields.text).toBe("late body");
    await r.close();
  });
  test("CONTROL: a width that is not wider, and a port never opened, post nothing", async () => {
    const r = await standing("full");
    const count = r.messages.length;
    await r.send(widen("full")); await r.send(widen("skinny")); await r.send(widen("full", "never-opened"));
    expect(r.messages).toHaveLength(count);
    await r.close();
  });
});
