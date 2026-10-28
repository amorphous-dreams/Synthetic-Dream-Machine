import { afterEach, beforeEach, expect, test } from "vitest";
import { standMirror } from "../src/glass/stand.js";
import { forgetEvidence, lends, rig } from "./glass-rig.js";

beforeEach(forgetEvidence); afterEach(forgetEvidence);

/** Throws a RangeError from the landing path once per listed width, in order, then lands quietly. */
const capacityAt = (...widths: string[]) => { const queue = [...widths]; return (_change: { title: string }, width: string) => {
  if (queue[0] === width) { queue.shift(); throw new RangeError("capacity"); } }; };

test("R7: one RangeError while full lands steps back to skinny once, on a fresh port", async () => {
  const r = await rig();
  try {
    const result = await standMirror(r.options, { ...r.seams, landed: capacityAt("full") }) as any;
    expect(result.kind).toBe("mirror");
    expect(await result.settled).toEqual({ width: "skinny", why: "mirror-snapshot-refused:RangeError" });
    const opens = r.opens();
    expect(opens.map(m => m.width)).toEqual(["skinny", "skinny"]);
    expect(opens[0]!.portId).not.toBe(opens[1]!.portId);
    expect(r.widens()).toHaveLength(1);
    expect(r.messages.some(m => m.type === "port:close" && m.portId === opens[0]!.portId)).toBe(true);
    expect(r.messages.filter(m => m.type === "port:write")).toEqual([]);   // the half-landed record never echoes back as a local edit
    result.unmount();
  } finally { r.host.remove(); }
});
test("R7 CONTROL: with no landing error the mirror promotes to full on one port, one open", async () => {
  const r = await rig();
  try {
    const result = await standMirror(r.options, r.seams) as any;
    expect(await result.settled).toEqual({ width: "full" });
    expect(r.opens()).toHaveLength(1); expect(r.widens()).toHaveLength(1);
    result.unmount();
  } finally { r.host.remove(); }
});
test("R7: a RangeError at the first skinny landing reads the none floor with one open and no promotion", async () => {
  const before = lends(); const r = await rig();
  try {
    const result = await standMirror(r.options, { ...r.seams, landed: capacityAt("skinny") });
    expect(result).toEqual({ kind: "floor", width: "none", why: "mirror-snapshot-refused:RangeError" });
    expect(r.opens()).toHaveLength(1); expect(r.widens()).toHaveLength(0);
    expect(r.host.shadowRoot?.childNodes.length ?? 0).toBe(0); expect(lends()).toEqual(before);
  } finally { r.host.remove(); }
});
test("R7: a second RangeError after the step reads the none floor and never opens a third port", async () => {
  const before = lends(); const r = await rig();
  try {
    const result = await standMirror(r.options, { ...r.seams, landed: capacityAt("full", "skinny") }) as any;
    expect(await result.settled).toEqual({ width: "none", why: "mirror-snapshot-refused:RangeError" });
    expect(r.opens().map(m => m.width)).toEqual(["skinny", "skinny"]);
    expect(r.host.shadowRoot?.querySelector("div")?.childNodes.length ?? 0).toBe(0); expect(lends()).toEqual(before);
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
test("R5: a snapshot that waits on a released gate, not a clock, still promotes to full", async () => {
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
