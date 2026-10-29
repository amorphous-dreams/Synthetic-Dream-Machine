import { afterEach, beforeEach, expect, test } from "vitest";
import { forgetEvidence } from "./glass-rig.js";
beforeEach(forgetEvidence); afterEach(forgetEvidence);
import * as stand from "../src/glass/stand.js";
import { makePortTransport } from "../src/port-transport.js";
import coreUrl from "../../lararium-tw5/tw5-core/tiddlywikicore-5.5.0-prerelease.js?url";

const cid = "0".repeat(64);
const lends = () => Object.fromEntries(["global", "Buffer", "process"].map(k => [k, Object.getOwnPropertyDescriptor(globalThis, k)]));
async function fixture(refusal?: string) {
  const bytes = new Uint8Array(await (await fetch(coreUrl)).arrayBuffer());
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const coreCid = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
  const host = document.createElement("div"); document.body.append(host);
  const messages: Record<string, any>[] = [];
  let port: ReturnType<typeof makePortTransport>;
  port = makePortTransport({ surface: () => "surface", mint: () => "binding", doors: {
    place(_surface, _binding, raw) {
      const msg = raw as Record<string, any>; messages.push(msg);
      if (refusal && msg.type === "port:open") return { ok: false as const, reason: refusal };
      if (msg.type === "port:open" || msg.type === "port:widen") queueMicrotask(() => port.deliver({ type: "port:snapshot", portId: msg.portId,
        snapshotId: `snapshot-${messages.length}`, i: 1, n: 1, records: [] }));
      return { ok: true as const };
    }, close() {},
  } });
  // readInputs supplies real core bytes without requiring an OPFS fixture.
  const seams = { readInputs: async () => ({ coreBytes: bytes, coreCid, preloadedTiddlers: [] }) };
  return { host, port, messages, seams, options: { host, port, inputs: { coreCid: cid, pluginCids: [] }, wikiUri: "wiki", actor: "actor" } };
}
const door = () => { const fn = (stand as any).standMirror; expect(fn).toBeTypeOf("function"); return fn; };
async function runDefault(search: string) {
  const f = await fixture(); const original = location.href;
  history.replaceState(null, "", `${location.pathname}${search}${location.hash}`);
  try {
    const result = await door()(f.options, f.seams);
    expect(result).toMatchObject({ kind: "mirror" });
    expect(await result.settled).toEqual({ width: "full" });
    expect(f.messages.find(m => m.type === "port:widen")?.width).toBe("full");
    result.unmount();
  } finally { history.replaceState(null, "", original); f.host.remove(); }
}
test("R1 CONTROL: a page with no selector opens skinny and promotes to full", async () => { await runDefault(""); });
test.each(["skinny", "none", "junk"])("R1: query glass=%s cannot select a width", async value => { await runDefault(`?glass=${value}`); });
test("R1: stored glass and width values cannot select a width", async () => {
  const saved = [localStorage, sessionStorage].map(s => [s.getItem("glass"), s.getItem("width")]);
  try {
    for (const storage of [localStorage, sessionStorage]) { storage.setItem("glass", "skinny"); storage.setItem("width", "none"); }
    await runDefault("");
  } finally {
    [localStorage, sessionStorage].forEach((s, i) => ["glass", "width"].forEach((key, j) => {
      const value = saved[i]![j]; if (value === null) s.removeItem(key); else s.setItem(key, value!);
    }));
  }
});
test.each(["port-not-granted", "transport-closed"])("R3: %s floors and returns lends", async reason => {
  const before = lends(); const f = await fixture(reason === "port-not-granted" ? reason : undefined);
  if (reason === "transport-closed") f.port.close();
  try {
    const result = await door()(f.options, f.seams);
    expect(result).toEqual({ kind: "floor", width: "none", why: reason });
    expect(f.host.shadowRoot?.childNodes.length ?? 0).toBe(0); expect(lends()).toEqual(before);
  } finally { f.host.remove(); }
});
test.each([
  ["L1", "mirror-no-shadow-root", { attachShadow: () => { throw new Error("no root"); } }],
  ["L2 miss", `glass-core-cas-miss:${cid}`, { readInputs: async () => { throw new Error(`glass-core-cas-miss:${cid}`); } }],
  ["L2 hash", `glass-core-sha256-mismatch:${cid}`, { readInputs: async () => { throw new Error(`glass-core-sha256-mismatch:${cid}`); } }],
  // bootEngine plants an L3 refusal; paint plants an L5 render failure.
  ["L3", "mirror-engine-refused:RangeError", { bootEngine: () => { throw new RangeError("capacity"); } }],
  ["L5", "mirror-paint-threw:Error", { paint: () => { throw new Error("paint"); } }],
])("R4: %s names its floor and returns lends", async (_step, why, fault) => {
  const before = lends(); const f = await fixture();
  try {
    const result = await door()(f.options, { ...f.seams, ...fault });
    expect(result).toEqual({ kind: "floor", width: "none", why });
    expect(f.host.shadowRoot?.childNodes.length ?? 0).toBe(0); expect(lends()).toEqual(before);
  } finally { f.host.remove(); }
});

test("CONTROL: the port forwards a full open and its snapshot", async () => {
  const f = await fixture();
  try {
    const received = new Promise<Record<string, unknown>>(resolve => f.port.onMessage(resolve));
    expect(f.port.send({ type: "port:open", portId: "control", width: "full" })).toEqual({ ok: true });
    expect(await received).toMatchObject({ type: "port:snapshot", portId: "control" });
    expect(f.messages[0]?.width).toBe("full");
  } finally { f.port.close(); f.host.remove(); }
});

test("R9: mirror lighting never takes a synchronous OPFS handle", async () => {
  const proto = (globalThis as any).FileSystemFileHandle?.prototype;
  const f = await fixture();
  const original = proto?.createSyncAccessHandle;
  let calls = 0;
  if (original) proto.createSyncAccessHandle = function (...args: unknown[]) { calls++; return original.apply(this, args); };
  try {
    const result = await door()(f.options, f.seams);
    expect(result).toMatchObject({ kind: "mirror" });
    await result.settled; expect(calls).toBe(0); result.unmount();
  } finally { if (original) proto.createSyncAccessHandle = original; f.host.remove(); }
});
