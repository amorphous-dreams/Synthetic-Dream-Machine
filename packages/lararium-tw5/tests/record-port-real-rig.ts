import { expect } from "vitest";
import { CompositeStore, type IslandToVesselMsg } from "@lararium/mesh";
import { AtomicMemoryStore } from "./atomic-memory-store.js";
import { hasRecordPort, type RecordPortOptions } from "../src/record-port-handler.js";
import type { IslandContext } from "../src/island-context.js";
import type { TW5Engine } from "../src/tw5-vm.js";

export const pump = async () => { for (let i = 0; i < 20; i++) { await Promise.resolve(); await new Promise<void>((resolve) => setImmediate(resolve)); } };
export const open = { type: "port:open", portId: "p", wikiUri: "wiki", actor: "p", width: "full", edits: true,
  presence: false, renders: ["blocks"], maxRecordBytes: 4096, maxBatchBytes: 8192 } as const;

export async function realPort(options: RecordPortOptions = {}, engine?: TW5Engine, extra: Partial<IslandContext> = {}) {
  const composite = new CompositeStore();
  const defaultStore = new AtomicMemoryStore("working");
  composite.addLayer({ bagId: "working", store: defaultStore, writable: true });
  const messages: IslandToVesselMsg[] = [];
  const ctx = { wikiUri: "wiki", composite, tw5: engine, handles: new Map(), recipe: { wikiSlug: "wiki" },
    post: (message: IslandToVesselMsg) => { messages.push(message); }, ...extra } as unknown as IslandContext;
  const cap = hasRecordPort({ mayEdit: () => true, bagGrant: () => true, ...options });
  const cleanup = await cap.onEa?.(ctx);
  const send = async (message: { type: string }) => {
    expect(cap.onSignal?.(message.type, message as never, ctx)).toBe(true);
    await pump();
  };
  const close = async () => { if (typeof cleanup === "function") await cleanup(); };
  return { composite, defaultStore, messages, ctx, send, close };
}

export function ofType<T extends IslandToVesselMsg["type"]>(messages: IslandToVesselMsg[], type: T): Extract<IslandToVesselMsg, { type: T }>[] {
  return messages.filter((message): message is Extract<IslandToVesselMsg, { type: T }> => message.type === type);
}
