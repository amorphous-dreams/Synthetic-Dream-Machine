import { describe, expect, test } from "vitest";
import { VesselIslandPoolCore } from "../src/vessel-island-pool-core.js";
import { mkEa, mkTeardownAck } from "../src/island-protocol.js";
import type { VesselIslandHost, VesselWorkerHandle } from "../src/vessel-host.js";
import type { WikiMountSpec } from "../src/wiki-recipe.js";
import type { PortGrant } from "../src/record-port.js";

const KEY = "wiki";
const grant: PortGrant = { faceId: "face", actor: "actor", edits: true, bags: [], admin: false };
const spec: WikiMountSpec = { coreHash: null, recipe: { wikiSlug: "wiki" }, grants: { islandUrl: "automerge:fixture", wikiUrl: null } };
const open = { type: "port:open", portId: "p", wikiUri: KEY, width: "full", actor: "page", edits: true,
  maxRecordBytes: 4096, maxBatchBytes: 8192 };

function rig(options: { policy?: () => PortGrant | null } = {}) {
  const posted: unknown[] = [];
  const listeners = new Set<(raw: unknown) => void>();
  const hear = (msg: unknown): void => { for (const fn of [...listeners]) fn(msg); };
  const host: VesselIslandHost = {
    spawnWorker(): VesselWorkerHandle {
      return { post(msg) {
        posted.push(msg);
        const type = (msg as { type?: string }).type;
        if (type === "manifest" || type === "teardown") queueMicrotask(() => hear(type === "manifest" ? mkEa(KEY) : mkTeardownAck()));
      }, listen(fn) { listeners.add(fn); return () => { listeners.delete(fn); }; }, onError: () => () => {}, terminate() {} };
    },
    newSyncChannel() { const { port1, port2 } = new MessageChannel(); return { mainPort: port1, syncPort: port2 }; },
    storage: () => undefined,
  };
  const delivered: Array<{ binding: string; msg: unknown }> = [];
  const dropped: Array<{ key: string; type: string; reason: string }> = [];
  const pool = new VesselIslandPoolCore({ host, resolvePluginCids: async () => ({ ok: true, pluginCids: [] }),
    ...(options.policy ? { portPolicy: options.policy } : {}),
    onPortMessage: (binding, _key, msg) => { delivered.push({ binding, msg }); },
    onPortDrop: (key, type, reason) => { dropped.push({ key, type, reason }); } });
  return { pool, posted, delivered, dropped, emit: (msg: unknown) => hear(msg) };
}

describe("vessel pool port leases", () => {
  test("reply-with-no-lease-drops-by-name; CONTROL: only its holder receives a leased reply", async () => {
    const r = rig({ policy: () => grant });
    await r.pool.mountWiki(KEY, spec);
    const changes = { type: "port:changes", portId: "p", cursor: "c", entries: [] };
    r.emit(changes);
    expect(r.delivered).toEqual([]);
    expect(r.dropped).toEqual([{ key: KEY, type: "port:changes", reason: "no-port-lease" }]);
    expect(r.pool.placePort(KEY, "A", open).ok).toBe(true);
    expect(r.pool.placePort(KEY, "B", { ...open, portId: "q" }).ok).toBe(true);
    r.emit(changes);
    expect(r.delivered).toEqual([{ binding: "A", msg: changes }]);
    await r.pool.disposeAll();
  });

  test("pool placement refuses forged lease and other bindings; CONTROL: posts lease before open", async () => {
    const r = rig({ policy: () => grant });
    await r.pool.mountWiki(KEY, spec);
    const start = r.posted.length;
    expect(r.pool.placePort(KEY, "A", { type: "port:lease", portId: "p", grant })).toEqual({ ok: false, reason: "port-kind-refused" });
    expect(r.pool.placePort(KEY, "A", { type: "port:gone", portId: "p" })).toEqual({ ok: false, reason: "port-kind-refused" });
    expect(r.posted).toHaveLength(start);
    expect(r.pool.placePort(KEY, "A", open).ok).toBe(true);
    expect(r.posted.slice(-2).map(msg => (msg as { type: string }).type)).toEqual(["port:lease", "port:open"]);
    const held = r.posted.length;
    expect(r.pool.placePort(KEY, "B", { type: "port:close", portId: "p" })).toEqual({ ok: false, reason: "port-owned" });
    expect(r.posted).toHaveLength(held);
    await r.pool.disposeAll();
  });

  test("pool with no policy refuses open; CONTROL: granted pool opens", async () => {
    const absent = rig();
    await absent.pool.mountWiki(KEY, spec);
    const count = absent.posted.length;
    expect(absent.pool.placePort(KEY, "A", open)).toEqual({ ok: false, reason: "port-not-granted" });
    expect(absent.posted).toHaveLength(count);
    await absent.pool.disposeAll();
    const allowed = rig({ policy: () => grant });
    await allowed.pool.mountWiki(KEY, spec);
    expect(allowed.pool.placePort(KEY, "A", open).ok).toBe(true);
    await allowed.pool.disposeAll();
  });
});
