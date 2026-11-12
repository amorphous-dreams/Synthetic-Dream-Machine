import { afterEach, beforeEach, expect, test } from "vitest";
import { standMirror } from "../src/glass/stand.js";
import { forgetEvidence, lends, rig } from "./glass-rig.js";

beforeEach(forgetEvidence); afterEach(forgetEvidence);

/** Throws a RangeError from the engine's boot once per listed boot (1 = the first, at full), then boots quietly. */
const capacityAtBoot = (...boots: number[]) => { let boot = 0; return () => { boot += 1; if (boots.includes(boot)) throw new RangeError("capacity"); }; };
const change = (r: Awaited<ReturnType<typeof rig>>, portId: string, seq: number) =>
  r.port.deliver({ type: "port:changes", portId, cursor: `c-${seq}`, entries: [{ title: `Peer${seq}`, fields: { text: "p" }, seq, causedBy: [] }] });

test("R7: one RangeError while the full engine boots takes the one step: a fresh handoff at skinny, on a fresh port", async () => {
  const r = await rig();
  try {
    const result = await standMirror(r.options, { ...r.seams, bootEngine: capacityAtBoot(1) }) as any;
    expect(result.kind).toBe("mirror");
    expect(await result.settled).toEqual({ width: "skinny", why: "mirror-engine-refused:RangeError" });
    const opens = r.opens();
    expect(opens.map(m => m.width)).toEqual(["full", "skinny"]);
    expect(opens[0]!.portId).not.toBe(opens[1]!.portId);
    expect(r.messages.some(m => m.type === "port:close" && m.portId === opens[0]!.portId)).toBe(true);
    expect(r.messages.filter(m => m.type === "port:write")).toEqual([]);
    result.unmount();
  } finally { r.host.remove(); }
});
test("R7 CONTROL: with no error the mirror stands full on one port, one open", async () => {
  const r = await rig();
  try {
    const result = await standMirror(r.options, r.seams) as any;
    expect(await result.settled).toEqual({ width: "full" });
    expect(r.opens()).toHaveLength(1);
    result.unmount();
  } finally { r.host.remove(); }
});
test("R7: a RangeError at a boot the tab's evidence already holds at skinny reads the none floor with one open", async () => {
  sessionStorage.setItem("mirror:began:wiki", "left-by-a-boot-that-died");
  const before = lends(); const r = await rig();
  try {
    const result = await standMirror(r.options, { ...r.seams, bootEngine: capacityAtBoot(1) });
    expect(result).toEqual({ kind: "floor", width: "none", why: "mirror-engine-refused:RangeError" });
    expect(r.opens().map(m => m.width)).toEqual(["skinny"]);
    expect(r.host.shadowRoot?.childNodes.length ?? 0).toBe(0); expect(lends()).toEqual(before);
  } finally { r.host.remove(); }
});
test("R7: a RangeError in a landing on a standing full mirror steps it to skinny once on the same engine; a second tears it down", async () => {
  const before = lends(); const r = await rig(); let planted = 0;
  try {
    const result = await standMirror(r.options, { ...r.seams, landed: (c: { title: string }) => { if (c.title.startsWith("Peer") && planted++ < 2) throw new RangeError("capacity"); } }) as any;
    expect(await result.settled).toEqual({ width: "full" });
    const events: any[] = []; result.onEvent((event: unknown) => events.push(event));
    const tw = result.tw;
    change(r, r.opens()[0]!.portId, 50);
    expect(events).toEqual([{ type: "stepped", width: "skinny", why: "mirror-snapshot-refused:RangeError" }]);
    expect(result.width).toBe("skinny"); expect(result.tw).toBe(tw);                 // the same engine, a fresh open
    expect(r.opens().map(m => m.width)).toEqual(["full", "skinny"]);
    expect(r.opens()[1]!.boot).toBeUndefined();                                       // the engine stands: no second boot set
    await Promise.resolve(); await Promise.resolve();
    change(r, r.opens()[1]!.portId, 51);
    expect(events.at(-1)).toEqual({ type: "floor", why: "mirror-snapshot-refused:RangeError" });
    expect(r.opens()).toHaveLength(2);                                                // PINNED: no third port ever opens
    expect(r.host.shadowRoot?.querySelector("div")?.childNodes.length ?? 0).toBe(0); expect(lends()).toEqual(before);
  } finally { r.host.remove(); }
});
test("PINNED step count: full steps to skinny once before the engine stands, skinny then floors, and no third port ever opens", async () => {
  const before = lends(); const r = await rig();
  try {
    const result = await standMirror(r.options, { ...r.seams, bootEngine: capacityAtBoot(1, 2) });
    expect(result).toEqual({ kind: "floor", width: "none", why: "mirror-engine-refused:RangeError" });
    expect(r.opens().map(m => m.width)).toEqual(["full", "skinny"]);
    expect(r.host.shadowRoot?.childNodes.length ?? 0).toBe(0); expect(lends()).toEqual(before);
  } finally { r.host.remove(); }
});
test("R7: port:gone closes a standing mirror with the island's reason and never steps down", async () => {
  const r = await rig();
  try {
    const result = await standMirror(r.options, r.seams) as any;
    await result.settled;
    const events: any[] = []; result.onEvent((event: unknown) => events.push(event));
    r.port.deliver({ type: "port:gone", portId: r.opens()[0]!.portId, reason: "grant-revoked" });
    expect(events).toEqual([{ type: "gone", why: "grant-revoked" }]);
    expect(result.width).toBe("full"); expect(r.opens()).toHaveLength(1);
  } finally { r.host.remove(); }
});
test("R5: a snapshot that waits on a released gate, not a clock, still stands full", async () => {
  let release!: () => void; const gate = new Promise<void>(resolve => { release = resolve; });
  const r = await rig({ gate });
  try {
    const standing = standMirror(r.options, r.seams);
    await Promise.resolve();
    release();
    const result = await standing as any;
    expect(await result.settled).toEqual({ width: "full" });
    result.unmount();
  } finally { r.host.remove(); }
});
test("a snapshot of two chunks paints only after the second lands", async () => {
  let release!: () => void; const gate = new Promise<void>(resolve => { release = resolve; });
  const r = await rig({ gate, chunks: 2 });
  try {
    let settled = false;
    const standing = standMirror(r.options, r.seams).then(result => { settled = true; return result; });
    for (let turn = 0; turn < 50; turn++) await Promise.resolve();
    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));   // a frame of the page, not a wait on time: the first chunk has landed
    expect(settled).toBe(false);
    expect(r.host.shadowRoot?.querySelector("div")?.childNodes.length ?? 0).toBe(0);
    release();
    const result = await standing as any;
    expect(result.kind).toBe("mirror");
    expect(r.host.shadowRoot?.querySelector("div")?.childNodes.length).toBeGreaterThan(0);
    result.unmount();
  } finally { r.host.remove(); }
});
test("a port:gone before the mirror stands floors with the island's reason; a late capacity error cannot step it", async () => {
  const r = await rig();
  try {
    r.port.onMessage(message => { if (message.type === "port:snapshot") r.port.deliver({ type: "port:gone", portId: message.portId, reason: "grant-revoked" }); });
    const result = await standMirror(r.options, { ...r.seams, landed: () => { throw new RangeError("capacity"); } });
    expect(result).toEqual({ kind: "floor", width: "none", why: "grant-revoked" });
    expect(r.opens()).toHaveLength(1);
  } finally { r.host.remove(); }
});
