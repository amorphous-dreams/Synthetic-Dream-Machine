import type { PortTransportDoors } from "../port-transport.js";

export interface TabBus {
  postMessage(message: unknown): void;
  addEventListener(type: "message", listener: (event: MessageEvent) => void): void;
  removeEventListener(type: "message", listener: (event: MessageEvent) => void): void;
  close(): void;
}

/** What the leader lends a follower with its ready: the surface its mirror stands on, the actor it writes as, and the engine inputs. */
export type Lend = { surface: string; actor: string; inputs: { coreCid: string; pluginCids: readonly string[] } };

type Frame = { kind: string; tab: string; binding?: string; surface?: string; msg?: unknown; nonce?: string; lend?: Lend };
const frame = (value: unknown): Frame | null => {
  if (!value || typeof value !== "object") return null;
  const item = value as Record<string, unknown>;
  return typeof item.kind === "string" && typeof item.tab === "string" ? item as Frame : null;
};
const lendOf = (value: unknown): Lend | null => {
  if (!value || typeof value !== "object") return null;
  const item = value as Record<string, unknown>;
  const inputs = item.inputs as Record<string, unknown> | undefined;
  return typeof item.surface === "string" && typeof item.actor === "string" && inputs && typeof inputs.coreCid === "string" && Array.isArray(inputs.pluginCids)
    ? { surface: item.surface, actor: item.actor, inputs: { coreCid: inputs.coreCid, pluginCids: inputs.pluginCids.map(String) } } : null;
};
const typeOf = (msg: unknown): string | null => msg && typeof msg === "object" ? String((msg as { type?: unknown }).type ?? "") : null;

/**
 * A follower holds its open requests so each new leader can send a fresh snapshot, and a widen rewrites the remembered open
 * so a successor opens the port at the width the mirror reached. The ready that answers its hello carries the leader's lend.
 */
export function makeFollowerDoors(bus: TabBus, tabId: string) {
  const opens = new Map<string, { surface: string; msg: unknown }>();
  const listeners = new Set<(binding: string, msg: unknown) => void>();
  const readyListeners = new Set<() => void>();
  const lendListeners = new Set<(lend: Lend) => void>();
  let nonce = "";
  let sequence = 0;
  let ready = false;
  let leader = "";
  let lent: Lend | null = null;
  const onMessage = (event: MessageEvent) => {
    const item = frame(event.data);
    if (!item) return;
    if (item.kind === "leader" && item.nonce && item.nonce !== leader) {
      leader = item.nonce;
      rehello();
      return;
    }
    if (item.tab !== tabId) return;
    if (item.kind === "ready" && item.nonce === nonce) {
      ready = true;
      const lend = lendOf(item.lend);
      if (lend) { lent = lend; for (const listener of lendListeners) listener(lend); }
      for (const [binding, open] of opens) bus.postMessage({ kind: "port-up", tab: tabId, binding, surface: open.surface, msg: open.msg });
      for (const listener of readyListeners) listener();
    } else if (item.kind === "port-down" && typeof item.binding === "string") {
      for (const listener of listeners) listener(item.binding, item.msg);
    }
  };
  bus.addEventListener("message", onMessage);
  const rehello = () => {
    ready = false;
    nonce = `${tabId}:${++sequence}`;
    bus.postMessage({ kind: "hello", tab: tabId, nonce });
  };
  rehello();
  return {
    place(surface: string, binding: string, msg: unknown) {
      const type = typeOf(msg);
      if (type === "port:open") opens.set(binding, { surface, msg });
      else if (type === "port:widen") {
        const open = opens.get(binding);
        if (open) opens.set(binding, { surface, msg: { ...(open.msg as Record<string, unknown>), width: (msg as { width: unknown }).width } });
      }
      if (ready) bus.postMessage({ kind: "port-up", tab: tabId, binding, surface, msg });
      return { ok: true as const };
    },
    close(binding: string) {
      opens.delete(binding);
      if (ready) bus.postMessage({ kind: "port-up", tab: tabId, binding, surface: "", msg: { type: "port:close" } });
    },
    rehello,
    /** The leader's last lend, or null before any ready carried one. */
    lent: () => lent,
    onLend(cb: (lend: Lend) => void) { lendListeners.add(cb); if (lent) cb(lent); return () => lendListeners.delete(cb); },
    onReady(cb: () => void) { readyListeners.add(cb); return () => readyListeners.delete(cb); },
    onPortMessage(cb: (binding: string, msg: unknown) => void) { listeners.add(cb); return () => listeners.delete(cb); },
    dispose() { bus.removeEventListener("message", onMessage); },
  } satisfies PortTransportDoors & Record<string, unknown>;
}

/**
 * The leader owns the real port bindings and returns each reply to its tab. The leader alone names the surface a follower's port
 * serves (the lend's `surface`): a frame's own surface value is ignored, so a follower can open a port on no other wiki and never on
 * the daemon. A tab that never said hello opens nothing, and with nothing to lend nothing places. A hello that arrives before the
 * leader can lend parks, and `lend()` answers the parked hellos once it can: a late tab never misses its ready.
 */
export function serveFollowers(bus: TabBus, leaderDoors: PortTransportDoors, lend: () => Lend | null | Promise<Lend | null>) {
  const bindings = new Map<string, { tab: string; binding: string }>();
  const greeted = new Set<string>();
  const parked = new Map<string, string>();     // tab -> the nonce of its latest unanswered hello
  let bound: string | null = null;              // the surface the leader lends, once it lends
  let closed = false;
  const answer = async (tab: string, nonce: string): Promise<void> => {
    const value = await lend();
    if (closed || parked.get(tab) !== nonce) return;    // closed meanwhile, or a newer hello from this tab superseded it
    if (!value) return;                                  // nothing to lend yet: the hello stays parked for `lend()`
    parked.delete(tab);
    bound = value.surface;
    greeted.add(tab);
    bus.postMessage({ kind: "ready", tab, nonce, lend: value });
  };
  const onMessage = (event: MessageEvent) => {
    const item = frame(event.data);
    if (!item) return;
    if (item.kind === "hello" && typeof item.nonce === "string") {
      parked.set(item.tab, item.nonce);
      void answer(item.tab, item.nonce);
    } else if (item.kind === "port-up" && typeof item.binding === "string") {
      if (!greeted.has(item.tab)) return;
      const name = `tab:${item.tab}:${item.binding}`;
      if (typeOf(item.msg) === "port:close") {
        if (bindings.has(name)) { leaderDoors.close(name); bindings.delete(name); }
        return;
      }
      if (bound === null) return;
      bindings.set(name, { tab: item.tab, binding: item.binding });
      leaderDoors.place(bound, name, item.msg);
    }
  };
  bus.addEventListener("message", onMessage);
  bus.postMessage({ kind: "leader", tab: "*", nonce: crypto.randomUUID() });
  return {
    /** The leader can lend now (its surface stands): answer every parked hello. */
    lend() { for (const [tab, nonce] of [...parked]) void answer(tab, nonce); },
    onPortMessage(binding: string, _islandKey: string, msg: unknown) {
      const owner = bindings.get(binding);
      if (owner) bus.postMessage({ kind: "port-down", tab: owner.tab, binding: owner.binding,
        msg: msg && typeof msg === "object" && "binding" in msg ? { ...msg, binding: owner.binding } : msg });
    },
    close() {
      closed = true;
      bus.removeEventListener("message", onMessage);
      for (const binding of bindings.keys()) leaderDoors.close(binding);
      bindings.clear();
    },
  };
}
