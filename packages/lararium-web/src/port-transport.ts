import type { PortPlacement } from "@lararium/mesh/port-lease";

export interface PortTransportDoors {
  place(surface: string, binding: string, msg: unknown): PortPlacement;
  close(binding: string): void;
}

export type PortTransportEvent = { readonly type: "transport:refused"; readonly reason: string } | (Record<string, unknown> & { readonly type: string });

/** The page holds one opaque binding and forwards record messages without keeping records. */
export function makePortTransport(opts: {
  readonly doors: PortTransportDoors;
  readonly surface: () => string | null;
  readonly mint?: () => string;
}) {
  const binding = (opts.mint ?? (() => crypto.randomUUID()))();
  if (!binding) throw new Error("port-binding-absent");
  const listeners = new Set<(message: PortTransportEvent) => void>();
  let closed = false;
  const emit = (event: PortTransportEvent): void => { for (const listener of listeners) listener(event); };
  const send = (msg: unknown): PortPlacement => {
    const surface = opts.surface();
    const result: PortPlacement = closed ? { ok: false, reason: "transport-closed" }
      : surface === null ? { ok: false, reason: "surface-unknown" }
      : opts.doors.place(surface, binding, msg);
    if (!result.ok) emit({ type: "transport:refused", reason: result.reason });
    return result;
  };
  return {
    binding,
    open: send,
    send,
    close(): void { if (closed) return; closed = true; opts.doors.close(binding); },
    onMessage(listener: (message: PortTransportEvent) => void): () => void {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    deliver(portMsg: unknown): void {
      if (closed || !portMsg || typeof portMsg !== "object") return;
      const msg = portMsg as Record<string, unknown>;
      if (typeof msg.type !== "string" || (msg.binding !== undefined && msg.binding !== binding)) return;
      emit(msg as PortTransportEvent);
    },
  };
}

/** The page's road from the vessel's reply door to its transport: delivery reaches the transport for its own binding alone. */
export function makePortDelivery() {
  let transport: ReturnType<typeof makePortTransport> | null = null;
  return {
    /** The vessel's `onPortMessage`: a reply for another binding, or one before the transport stands, goes nowhere. */
    onPortMessage(binding: string, _islandKey: string, msg: unknown): void {
      if (transport !== null && binding === transport.binding) transport.deliver(msg);
    },
    attach(next: ReturnType<typeof makePortTransport>): void { transport = next; },
  };
}
