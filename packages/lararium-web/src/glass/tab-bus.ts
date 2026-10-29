import type { PortTransportDoors } from "../port-transport.js";

export interface TabBus {
  postMessage(message: unknown): void;
  addEventListener(type: "message", listener: (event: MessageEvent) => void): void;
  removeEventListener(type: "message", listener: (event: MessageEvent) => void): void;
}

type Frame = { kind: string; tab: string; binding?: string; surface?: string; msg?: unknown; nonce?: string };
const frame = (value: unknown): Frame | null => {
  if (!value || typeof value !== "object") return null;
  const item = value as Record<string, unknown>;
  return typeof item.kind === "string" && typeof item.tab === "string" ? item as Frame : null;
};

/** A follower holds its open requests so each new leader can send a fresh snapshot. */
export function makeFollowerDoors(bus: TabBus, tabId: string) {
  const opens = new Map<string, { surface: string; msg: unknown }>();
  const listeners = new Set<(binding: string, msg: unknown) => void>();
  const readyListeners = new Set<() => void>();
  let nonce = "";
  let sequence = 0;
  let ready = false;
  let leader = "";
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
      if (msg && typeof msg === "object" && (msg as { type?: string }).type === "port:open") opens.set(binding, { surface, msg });
      if (ready) bus.postMessage({ kind: "port-up", tab: tabId, binding, surface, msg });
      return { ok: true as const };
    },
    close(binding: string) {
      opens.delete(binding);
      if (ready) bus.postMessage({ kind: "port-up", tab: tabId, binding, surface: "", msg: { type: "port:close" } });
    },
    rehello,
    onReady(cb: () => void) { readyListeners.add(cb); return () => readyListeners.delete(cb); },
    onPortMessage(cb: (binding: string, msg: unknown) => void) { listeners.add(cb); return () => listeners.delete(cb); },
    dispose() { bus.removeEventListener("message", onMessage); },
  } satisfies PortTransportDoors & Record<string, unknown>;
}

/**
 * The leader owns the real port bindings and returns each reply to its tab. The leader alone names the surface a follower's port
 * serves (`surface()`): a frame's own surface value is ignored, so a follower can open a port on no other wiki and never on the
 * daemon. A tab that never said hello opens nothing, and with no surface to bind nothing places.
 */
export function serveFollowers(bus: TabBus, leaderDoors: PortTransportDoors, surface: () => string | null) {
  const bindings = new Map<string, { tab: string; binding: string }>();
  const greeted = new Set<string>();
  const onMessage = (event: MessageEvent) => {
    const item = frame(event.data);
    if (!item) return;
    if (item.kind === "hello" && typeof item.nonce === "string") {
      greeted.add(item.tab);
      bus.postMessage({ kind: "ready", tab: item.tab, nonce: item.nonce });
    } else if (item.kind === "port-up" && typeof item.binding === "string") {
      if (!greeted.has(item.tab)) return;
      const name = `tab:${item.tab}:${item.binding}`;
      if (item.msg && typeof item.msg === "object" && (item.msg as { type?: string }).type === "port:close") {
        if (bindings.has(name)) { leaderDoors.close(name); bindings.delete(name); }
        return;
      }
      const bound = surface();
      if (bound === null) return;
      bindings.set(name, { tab: item.tab, binding: item.binding });
      leaderDoors.place(bound, name, item.msg);
    }
  };
  bus.addEventListener("message", onMessage);
  bus.postMessage({ kind: "leader", tab: "*", nonce: crypto.randomUUID() });
  return {
    onPortMessage(binding: string, _islandKey: string, msg: unknown) {
      const owner = bindings.get(binding);
      if (owner) bus.postMessage({ kind: "port-down", tab: owner.tab, binding: owner.binding,
        msg: msg && typeof msg === "object" && "binding" in msg ? { ...msg, binding: owner.binding } : msg });
    },
    close() {
      bus.removeEventListener("message", onMessage);
      for (const binding of bindings.keys()) leaderDoors.close(binding);
      bindings.clear();
    },
  };
}
