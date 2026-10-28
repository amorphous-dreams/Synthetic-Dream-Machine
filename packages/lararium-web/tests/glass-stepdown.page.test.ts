import { expect, test } from "vitest";
import { standMirror } from "../src/glass/stand.js";
import { makePortTransport } from "../src/port-transport.js";
import coreUrl from "../../lararium-tw5/tw5-core/tiddlywikicore-5.5.0-prerelease.js?url";

const lends = () => Object.fromEntries(["global", "Buffer", "process"].map(k => [k, Object.getOwnPropertyDescriptor(globalThis, k)]));
/** A vessel stub: each `port:open` answers with one snapshot of one record, after a manual gate when `gate` is set. */
async function rig(gate?: Promise<void>) {
  const bytes = new Uint8Array(await (await fetch(coreUrl)).arrayBuffer());
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const coreCid = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
  const host = document.createElement("div"); document.body.append(host);
  const messages: Record<string, any>[] = [];
  let port: ReturnType<typeof makePortTransport>;
  port = makePortTransport({ surface: () => "surface", mint: () => "binding", doors: {
    place(_surface, _binding, raw) {
      const msg = raw as Record<string, any>; messages.push(msg);
      if (msg.type === "port:open") void Promise.resolve(gate).then(() => port.deliver({ type: "port:snapshot", portId: msg.portId,
        snapshotId: `s-${messages.length}`, i: 1, n: 1, records: [{ title: "Landed", fields: { text: "t" }, seq: 1 }] }));
      return { ok: true as const };
    }, close() {},
  } });
  const seams = { readInputs: async () => ({ coreBytes: bytes, coreCid, preloadedTiddlers: [] }) };
  const options = { host, port, inputs: { coreCid: "0".repeat(64), pluginCids: [] }, wikiUri: "wiki", actor: "actor" };
  const opens = () => messages.filter(m => m.type === "port:open");
  return { host, port, messages, seams, options, opens };
}
const capacityOnce = () => { let spent = false; return () => { if (!spent) { spent = true; throw new RangeError("capacity"); } }; };

test("R7: one RangeError in the landing path steps full to skinny once, with a fresh port", async () => {
  const r = await rig();
  try {
    const result = await standMirror(r.options, { ...r.seams, landed: capacityOnce() });
    expect(result).toMatchObject({ kind: "mirror", width: "skinny" });
    const opens = r.opens();
    expect(opens.map(m => m.width)).toEqual(["full", "skinny"]);
    expect(opens[0]!.portId).not.toBe(opens[1]!.portId);
    expect(r.messages.some(m => m.type === "port:close" && m.portId === opens[0]!.portId)).toBe(true);
    expect(r.messages.filter(m => m.type === "port:write")).toEqual([]);   // the half-landed record never echoes back as a local edit
    (result as any).unmount();
  } finally { r.host.remove(); }
});
test("R7 CONTROL: with no landing error the mirror stays full, one open", async () => {
  const r = await rig();
  try {
    const result = await standMirror(r.options, r.seams);
    expect(result).toMatchObject({ kind: "mirror", width: "full" });
    expect(r.opens()).toHaveLength(1);
    (result as any).unmount();
  } finally { r.host.remove(); }
});
test("R7: a second RangeError at skinny reads the none floor and never opens a third port", async () => {
  const before = lends(); const r = await rig();
  try {
    const result = await standMirror(r.options, { ...r.seams, landed: () => { throw new RangeError("capacity"); } });
    expect(r.messages.filter(m => m.type === "port:write")).toEqual([]);   // the half-landed record never echoes back as a local edit
    expect({ ...result, unmount: undefined }).toEqual({ kind: "floor", width: "none", why: "mirror-snapshot-refused:RangeError" });
    expect(r.opens().map(m => m.width)).toEqual(["full", "skinny"]);
    expect(r.host.shadowRoot?.childNodes.length ?? 0).toBe(0); expect(lends()).toEqual(before);
  } finally { r.host.remove(); }
});
test("R7: port:gone closes a standing mirror with the island's reason and never steps down", async () => {
  const r = await rig();
  try {
    const result = await standMirror(r.options, r.seams) as any;
    const events: any[] = []; result.onEvent((event: unknown) => events.push(event));
    const portId = r.opens()[0]!.portId;
    r.port.deliver({ type: "port:gone", portId, reason: "grant-revoked" });
    expect(events).toEqual([{ type: "gone", why: "grant-revoked" }]);
    expect(result.width).toBe("full"); expect(r.opens()).toHaveLength(1);
  } finally { r.host.remove(); }
});
test("R5: a snapshot that waits on a released gate, not a clock, still opens full", async () => {
  let release!: () => void; const gate = new Promise<void>(resolve => { release = resolve; });
  const r = await rig(gate);
  try {
    const standing = standMirror(r.options, r.seams);
    await Promise.resolve();
    release();
    expect(await standing).toMatchObject({ kind: "mirror", width: "full" });
    ((await standing) as any).unmount();
  } finally { r.host.remove(); }
});
