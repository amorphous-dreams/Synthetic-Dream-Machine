import { makePortTransport } from "../src/port-transport.js";
import coreUrl from "../../lararium-tw5/tw5-core/tiddlywikicore-5.5.0-prerelease.js?url";
import housePlugin from "../../lararium-tw5/plugins/lares-memetic-wikitext.json";

export const lends = () => Object.fromEntries(["global", "Buffer", "process"].map(k => [k, Object.getOwnPropertyDescriptor(globalThis, k)]));
const sha = async (bytes: Uint8Array): Promise<string> =>
  Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes as BufferSource)), byte => byte.toString(16).padStart(2, "0")).join("");
const base64 = (bytes: Uint8Array): string => { let binary = ""; for (let at = 0; at < bytes.length; at += 32768) binary += String.fromCharCode(...bytes.subarray(at, at + 32768)); return btoa(binary); };
const BOOT_CHUNK = 196_608;
/**
 * A vessel stub. Each `port:open` answers with a snapshot of `chunks` chunks on the portId it names; an open that carries `boot`
 * receives the boot set first (`port:boot`: the engine blob, then the house plugin blob, verbatim and chunked), as an island sends it.
 * The first chunk of an open answers at once; the rest wait on `gate` when one stands (a released promise, never a clock).
 */
export async function rig(options: { gate?: Promise<void>; chunks?: number; sealedRest?: boolean;
  /** The engine preloads the vessel names (default: the house plugin alone). */
  preloads?: Record<string, unknown>[];
  /** Records the wiki carries: each snapshot's first chunk lands them beside its own. */
  records?: Array<{ title: string; fields: Record<string, unknown> }> } = {}) {
  const chunks = options.chunks ?? 1;
  const bytes = new Uint8Array(await (await fetch(coreUrl)).arrayBuffer());
  const coreCid = await sha(bytes);
  const houseBytes = new TextEncoder().encode(JSON.stringify(housePlugin));
  const houseCid = await sha(houseBytes);
  const host = document.createElement("div"); document.body.append(host);
  const messages: Record<string, any>[] = [];
  const placed: Array<(msg: Record<string, any>) => void> = [];
  let port: ReturnType<typeof makePortTransport>;
  port = makePortTransport({ surface: () => "surface", mint: () => "binding", doors: {
    place(_surface, _binding, raw) {
      const msg = raw as Record<string, any>; messages.push(msg);
      for (const watcher of placed) watcher(msg);
      const chunk = (i: number) => port.deliver({ type: "port:snapshot", portId: msg.portId, snapshotId: `s-${messages.length}`, i, n: chunks,
        records: [...(i === 1 ? (options.records ?? []).map((record, n) => ({ ...record, seq: 1000 + n })) : []), { title: `Landed${i}`, fields: { text: "t" }, seq: i }] });
      const boot = () => [[coreCid, bytes, "engine"], [houseCid, houseBytes, "plugin"]].forEach(([cid, member, role], at) => {
        const whole = member as Uint8Array; const n = Math.ceil(whole.length / BOOT_CHUNK);
        for (let i = 1; i <= n; i++) port.deliver({ type: "port:boot", portId: msg.portId, cid, role, member: at + 1, members: 2, i, n,
          bytesBase64: base64(whole.subarray((i - 1) * BOOT_CHUNK, i * BOOT_CHUNK)) });
      });
      if (msg.type === "port:open") {
        if (msg.boot) queueMicrotask(boot);
        if (chunks === 1) void Promise.resolve(options.gate).then(() => chunk(1));
        else { queueMicrotask(() => chunk(1)); void Promise.resolve(options.gate).then(() => { for (let i = 2; i <= chunks; i++) chunk(i); }); }
      }
      return { ok: true as const };
    }, close() {},
  } });
  // A test's boot set in place of the port's handoff: the house plugin rides as the vessel's own preload; `sealedRest` is the vessel's word, false unless a test stands for a sealed vessel.
  const seams = { readInputs: async () => ({ coreBytes: bytes, coreCid, preloadedTiddlers: options.preloads ?? [housePlugin as Record<string, unknown>], sealedRest: options.sealedRest === true }) };
  const options2 = { host, port, inputs: { coreCid: "0".repeat(64), pluginCids: [] as string[] }, wikiUri: "wiki", actor: "actor" };
  return { host, port, messages, seams, options: options2, onPlace: (watcher: (msg: Record<string, any>) => void) => { placed.push(watcher); },
    /** The names a vessel gives for this stub's boot set: with them and no `readInputs` seam, the mirror boots from the port's own handoff. */
    names: { coreCid, pluginCids: [houseCid], sealedRest: options.sealedRest === true },
    opens: () => messages.filter(m => m.type === "port:open") };
}

/** A test starts from a tab with no evidence record: an earlier test's step-down leaves one behind, as a real boot would. */
export const forgetEvidence = (): void => { try { sessionStorage.removeItem("mirror:began:wiki"); sessionStorage.removeItem("mirror:full-standing:wiki"); sessionStorage.removeItem("mirror:began:lares"); } catch { /* storage may be blocked */ } };
