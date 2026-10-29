import { afterEach, beforeEach, expect, test } from "vitest";
import { standMirror } from "../src/glass/stand.js";
import { forgetEvidence, lends, rig } from "./glass-rig.js";

const KEY = "mirror:began:wiki";   // keyed by the wiki the mirror serves
const clear = () => { try { sessionStorage.removeItem(KEY); localStorage.removeItem(KEY); sessionStorage.removeItem("width"); } catch { /* storage may be blocked */ } };
beforeEach(forgetEvidence); afterEach(() => { forgetEvidence(); clear(); });

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
test("the evidence record stands while full lands and clears once full has painted", async () => {
  const r = await rig(); let during: string | null = null;
  r.onPlace(msg => { if (msg.type === "port:widen") during = sessionStorage.getItem(KEY); });
  try {
    const result = await standMirror(r.options, r.seams) as any;
    await result.settled;
    expect(during).toEqual(expect.any(String));
    // Full has landed but not yet painted: the record still stands. It clears once a frame has painted full.
    expect(sessionStorage.getItem(KEY)).not.toBeNull();
    await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
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
    expect(await result.settled).toEqual({ width: "skinny", why: "full-promotion-unfinished" });
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
test("a widen the port refuses leaves the tab at skinny with the reason named and no record behind", async () => {
  const r = await rig({ refuseWiden: "port-not-granted" });
  try {
    const result = await standMirror(r.options, r.seams) as any;
    expect(result.kind).toBe("mirror");
    expect(await result.settled).toEqual({ width: "skinny", why: "port-not-granted" });
    expect(sessionStorage.getItem(KEY)).toBeNull();
    result.unmount();
  } finally { r.host.remove(); }
});
test("a port:gone and snapshot that land before the door returns leave no engine behind", async () => {
  const before = lends(); const r = await rig();
  try {
    // Both arrive inside the open's own send, before the door has returned.
    r.onPlace(msg => { if (msg.type === "port:open") {
      r.port.deliver({ type: "port:snapshot", portId: msg.portId, snapshotId: "early", i: 1, n: 1, records: [] });
      r.port.deliver({ type: "port:gone", portId: msg.portId, reason: "grant-revoked" });
    } });
    const result = await standMirror(r.options, r.seams);
    expect(result).toEqual({ kind: "floor", width: "none", why: "grant-revoked" });
    expect(r.widens()).toHaveLength(0); expect(lends()).toEqual(before);
  } finally { r.host.remove(); }
});
test("a record under another wiki's key holds nothing for this wiki", async () => {
  sessionStorage.setItem("mirror:began:other-wiki", "left-by-another-wiki");
  const r = await rig();
  try {
    const result = await standMirror(r.options, r.seams) as any;
    expect(await result.settled).toEqual({ width: "full" });
    expect(sessionStorage.getItem("mirror:began:other-wiki")).toBe("left-by-another-wiki");
    result.unmount();
  } finally { sessionStorage.removeItem("mirror:began:other-wiki"); r.host.remove(); }
});
test("storage that refuses a write names evidence-unavailable and the tab still promotes", async () => {
  const r = await rig(); const states: any[] = [];
  const denied = { getItem: () => null, setItem: () => { throw new DOMException("denied", "SecurityError"); }, removeItem: () => {} };
  try {
    const result = await standMirror({ ...r.options, evidence: denied, onState: state => states.push(state) }, r.seams) as any;
    expect(await result.settled).toEqual({ width: "full" });
    expect(states).toContainEqual({ kind: "evidence-unavailable", why: "SecurityError" });
    result.unmount();
  } finally { r.host.remove(); }
});
test("CONTROL: storage that works names no evidence state", async () => {
  const r = await rig(); const states: any[] = [];
  try {
    const result = await standMirror({ ...r.options, onState: state => states.push(state) }, r.seams) as any;
    await result.settled;
    expect(states.filter(state => state.kind === "evidence-unavailable")).toEqual([]);
    result.unmount();
  } finally { r.host.remove(); }
});

const STANDING = "mirror:full-standing:wiki";
const afterPaint = () => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
test("the second record stands from full's first paint and clears on pagehide", async () => {
  const r = await rig();
  try {
    const result = await standMirror(r.options, r.seams) as any;
    await result.settled;
    expect(sessionStorage.getItem(STANDING)).toBeNull();                       // full has landed, not yet painted
    await afterPaint();
    expect(sessionStorage.getItem(STANDING)).not.toBeNull();                   // a frame painted full: the page stands
    window.dispatchEvent(new PageTransitionEvent("pagehide", { persisted: false }));
    expect(sessionStorage.getItem(STANDING)).toBeNull();                       // an orderly leave clears it
    result.unmount();
  } finally { r.host.remove(); }
});
test("a page that came back from the back-forward cache stands again, and an unmount clears the record", async () => {
  const r = await rig();
  try {
    const result = await standMirror(r.options, r.seams) as any;
    await result.settled; await afterPaint();
    window.dispatchEvent(new PageTransitionEvent("pagehide", { persisted: true }));
    expect(sessionStorage.getItem(STANDING)).toBeNull();
    window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true }));
    expect(sessionStorage.getItem(STANDING)).not.toBeNull();
    result.unmount();
    expect(sessionStorage.getItem(STANDING)).toBeNull();
  } finally { r.host.remove(); }
});
test("a full page that ended without a pagehide holds the next boot of this wiki at skinny, as evidence and never a flag", async () => {
  sessionStorage.setItem(STANDING, "left-by-a-full-page-that-died");
  const r = await rig();
  try {
    const result = await standMirror(r.options, r.seams) as any;
    expect(await result.settled).toEqual({ width: "skinny", why: "full-ended-without-pagehide" });
    expect(r.widens()).toHaveLength(0);
    expect(sessionStorage.getItem(STANDING)).toBe("left-by-a-full-page-that-died");
    result.unmount();
  } finally { r.host.remove(); }
});
test("CONTROL: another wiki's standing record holds nothing for this wiki", async () => {
  sessionStorage.setItem("mirror:full-standing:other-wiki", "elsewhere");
  const r = await rig();
  try {
    const result = await standMirror(r.options, r.seams) as any;
    expect(await result.settled).toEqual({ width: "full" });
    result.unmount();
  } finally { sessionStorage.removeItem("mirror:full-standing:other-wiki"); r.host.remove(); }
});

test("a widen the island leaves unanswered names the promotion wait instead of stranding promoting; CONTROL: an answered widen names none", async () => {
  const quiet = await rig({ swallowWiden: true }); const states: any[] = [];
  try {
    const result = await standMirror({ ...quiet.options, onState: state => states.push(state) }, quiet.seams) as any;
    for (let turn = 0; turn < 50; turn++) await Promise.resolve();
    expect(states).toContainEqual({ kind: "waiting", for: "promotion" });
    expect(result.width).toBe("skinny");
    result.unmount();
  } finally { quiet.host.remove(); }
  const loud = await rig(); const heard: any[] = [];
  try {
    const result = await standMirror({ ...loud.options, onState: state => heard.push(state) }, loud.seams) as any;
    await result.settled;
    expect(heard.filter(state => state.for === "promotion")).toEqual([{ kind: "waiting", for: "promotion" }]);   // named while it waited, once, then the answer ends it
    result.unmount();
  } finally { loud.host.remove(); }
});
