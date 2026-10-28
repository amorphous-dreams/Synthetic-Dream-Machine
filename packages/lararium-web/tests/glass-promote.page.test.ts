import { afterEach, expect, test } from "vitest";
import { standMirror } from "../src/glass/stand.js";
import { rig } from "./glass-rig.js";

const KEY = "mirror:began";
const clear = () => { try { sessionStorage.removeItem(KEY); localStorage.removeItem(KEY); sessionStorage.removeItem("width"); } catch { /* storage may be blocked */ } };
afterEach(clear);

test("skinny paints first, then one widen row on the same port promotes to full", async () => {
  const r = await rig();
  try {
    const result = await standMirror(r.options, r.seams) as any;
    expect(result.kind).toBe("mirror");
    expect(r.opens().map(m => m.width)).toEqual(["skinny"]);           // the first thing on the wire opens skinny
    expect(await result.settled).toEqual({ width: "full" });
    expect(r.widens()).toEqual([expect.objectContaining({ type: "port:widen", portId: r.opens()[0]!.portId, width: "full" })]);
    expect(result.width).toBe("full");
    expect(r.opens()).toHaveLength(1);
    result.unmount();
  } finally { r.host.remove(); }
});
test("the evidence record stands while full lands and clears once full has landed", async () => {
  const r = await rig(); let during: string | null = "unread";
  r.onPlace(msg => { if (msg.type === "port:widen") during = sessionStorage.getItem(KEY); });
  try {
    const result = await standMirror(r.options, r.seams) as any;
    await result.settled;
    expect(during).not.toBeNull();
    expect(sessionStorage.getItem(KEY)).toBeNull();
    result.unmount();
  } finally { r.host.remove(); }
});
test("a record from a full boot that never finished holds the tab at skinny and names why; the record stays", async () => {
  sessionStorage.setItem(KEY, "left-by-a-boot-that-died");
  const r = await rig();
  try {
    const result = await standMirror(r.options, r.seams) as any;
    expect(result.kind).toBe("mirror");
    expect(await result.settled).toEqual({ width: "skinny", why: "full-boot-did-not-paint" });
    expect(r.widens()).toHaveLength(0);
    expect(sessionStorage.getItem(KEY)).toBe("left-by-a-boot-that-died");
    result.unmount();
  } finally { r.host.remove(); }
});
test("a remembered width, or the record in another store, selects nothing", async () => {
  sessionStorage.setItem("width", "skinny"); localStorage.setItem(KEY, "elsewhere");
  const r = await rig();
  try {
    const result = await standMirror(r.options, r.seams) as any;
    expect(await result.settled).toEqual({ width: "full" });
    result.unmount();
  } finally { r.host.remove(); }
});
test("the mirror names the wait for the port's greeting, and a snapshot ends it", async () => {
  let release!: () => void; const gate = new Promise<void>(resolve => { release = resolve; });
  const r = await rig({ gate }); const states: unknown[] = [];
  try {
    const standing = standMirror({ ...r.options, onState: state => states.push(state) }, r.seams);
    for (let turn = 0; turn < 50; turn++) await Promise.resolve();
    expect(states).toEqual([{ kind: "waiting", for: "greeting" }]);
    release();
    const result = await standing as any;
    expect(states).toEqual([{ kind: "waiting", for: "greeting" }]);   // nothing else announces a wait
    result.unmount();
  } finally { r.host.remove(); }
});
