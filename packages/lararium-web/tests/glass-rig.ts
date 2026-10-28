import { makePortTransport } from "../src/port-transport.js";
import coreUrl from "../../lararium-tw5/tw5-core/tiddlywikicore-5.5.0-prerelease.js?url";

export const lends = () => Object.fromEntries(["global", "Buffer", "process"].map(k => [k, Object.getOwnPropertyDescriptor(globalThis, k)]));
/**
 * A vessel stub. Each `port:open` and each `port:widen` answers with a snapshot of `chunks` chunks on the portId it names.
 * The first chunk of an open answers at once; the rest wait on `gate` when one stands (a released promise, never a clock).
 */
export async function rig(options: { gate?: Promise<void>; chunks?: number } = {}) {
  const chunks = options.chunks ?? 1;
  const bytes = new Uint8Array(await (await fetch(coreUrl)).arrayBuffer());
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const coreCid = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
  const host = document.createElement("div"); document.body.append(host);
  const messages: Record<string, any>[] = [];
  const placed: Array<(msg: Record<string, any>) => void> = [];
  let port: ReturnType<typeof makePortTransport>;
  port = makePortTransport({ surface: () => "surface", mint: () => "binding", doors: {
    place(_surface, _binding, raw) {
      const msg = raw as Record<string, any>; messages.push(msg);
      for (const watcher of placed) watcher(msg);
      const chunk = (i: number) => port.deliver({ type: "port:snapshot", portId: msg.portId, snapshotId: `s-${messages.length}`, i, n: chunks,
        records: [{ title: `Landed${i}`, fields: { text: "t" }, seq: i }] });
      if (msg.type === "port:open") {
        if (chunks === 1) void Promise.resolve(options.gate).then(() => chunk(1));
        else { queueMicrotask(() => chunk(1)); void Promise.resolve(options.gate).then(() => { for (let i = 2; i <= chunks; i++) chunk(i); }); }
      } else if (msg.type === "port:widen") queueMicrotask(() => { for (let i = 1; i <= chunks; i++) chunk(i); });
      return { ok: true as const };
    }, close() {},
  } });
  const seams = { readInputs: async () => ({ coreBytes: bytes, coreCid, preloadedTiddlers: [] }) };
  const options2 = { host, port, inputs: { coreCid: "0".repeat(64), pluginCids: [] }, wikiUri: "wiki", actor: "actor" };
  return { host, port, messages, seams, options: options2, onPlace: (watcher: (msg: Record<string, any>) => void) => { placed.push(watcher); },
    opens: () => messages.filter(m => m.type === "port:open"), widens: () => messages.filter(m => m.type === "port:widen") };
}
